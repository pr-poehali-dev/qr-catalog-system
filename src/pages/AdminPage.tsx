import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { QRCodeCanvas } from "qrcode.react";
import jsPDF from "jspdf";
import Icon from "@/components/ui/icon";

const PRODUCTS_URL = "https://functions.poehali.dev/2d53c3f9-ece3-4909-b127-ad2dd38059f9";

interface ProductRow {
  article: string;
  category: string;
  params: string;
  price: string;
  gallery: string;
  hasPhoto: boolean;
  photo?: string;
  url: string;
}

const BASE_URL = window.location.origin;

function slugify(article: string) {
  return encodeURIComponent(article);
}

export default function AdminPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [step, setStep] = useState<"upload" | "result">("upload");
  const [loading, setLoading] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const qrRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  const handleProcess = async () => {
    if (!csvFile) {
      setError("Загрузите файл Excel или CSV");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const csvBuffer = await csvFile.arrayBuffer();
      const fileName = csvFile.name.toLowerCase();

      let rows: unknown[][];

      if (fileName.endsWith(".csv")) {
        // CSV: пробуем UTF-8, потом windows-1251
        let text = "";
        try {
          text = new TextDecoder("utf-8").decode(new Uint8Array(csvBuffer));
        } catch {
          text = new TextDecoder("windows-1251").decode(new Uint8Array(csvBuffer));
        }
        const separator = text.indexOf(";") !== -1 ? ";" : ",";
        rows = text
          .split(/\r?\n/)
          .filter((line) => line.trim() !== "")
          .map((line) =>
            line.split(separator).map((cell) => cell.trim().replace(/^"|"$/g, ""))
          );
      } else {
        // Excel (.xlsx / .xls)
        const wb = XLSX.read(csvBuffer, { type: "array", cellText: false, raw: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: "",
          raw: false,
        }) as unknown[][];
      }

      const dataRows = rows.slice(1).filter((r) => String(r[2] ?? "").trim() !== "");

      if (dataRows.length === 0) {
        setError(
          "Не найдено строк с данными. Убедитесь что: 1) артикул в столбце C (3-й), 2) данные начинаются со 2-й строки, 3) файл не пустой."
        );
        setLoading(false);
        return;
      }

      const photoMap: Record<string, string> = {};

      if (zipFile) {
        const zip = await JSZip.loadAsync(await zipFile.arrayBuffer());
        const photoPromises: Promise<void>[] = [];

        zip.forEach((relativePath, file) => {
          if (file.dir) return;
          const ext = relativePath.split(".").pop()?.toLowerCase();
          if (!["jpg", "jpeg", "png"].includes(ext || "")) return;

          const baseName = relativePath.split("/").pop()?.replace(/\.[^.]+$/, "") || "";

          photoPromises.push(
            file.async("base64").then((b64) => {
              const mime = ext === "png" ? "image/png" : "image/jpeg";
              photoMap[baseName.toLowerCase()] = `data:${mime};base64,${b64}`;
            })
          );
        });

        await Promise.all(photoPromises);
      }

      const result: ProductRow[] = dataRows.map((row) => {
        const article = String(row[2] ?? "").trim();
        // Нормализуем для поиска: оставляем только буквы, цифры, дефис
        const articleNorm = article.toLowerCase().replace(/[\s_]/g, "-");

        let foundPhoto: string | undefined;
        let hasPhoto = false;

        // Варианты написания артикула для поиска по имени файла
        const artVariants = [
          article.toLowerCase(),
          article.toLowerCase().replace(/\//g, "-"),
          article.toLowerCase().replace(/\//g, "_"),
          article.toLowerCase().replace(/[^a-z0-9а-яё]/gi, ""),
          article.toLowerCase().replace(/[^a-z0-9а-яё]/gi, "-"),
        ].filter(Boolean);

        for (const [key, dataUrl] of Object.entries(photoMap)) {
          const keyNorm = key.toLowerCase();
          const matched = artVariants.some(
            (v) => keyNorm.includes(v) || v.includes(keyNorm)
          );
          if (matched) {
            foundPhoto = dataUrl;
            hasPhoto = true;
            break;
          }
        }

        return {
          article,
          category: String(row[0] ?? "").trim(),
          params: String(row[3] ?? "").trim(),
          price: String(row[4] ?? "").trim(),
          gallery: String(row[5] ?? "").trim(),
          hasPhoto,
          photo: foundPhoto,
          url: `${BASE_URL}/?article=${slugify(article)}`,
        };
      });

      // Отправляем данные на сервер (БД + S3 для фото)
      setError("Загружаю на сервер...");

      // Формируем словарь фото по артикулу для отправки
      const photosPayload: Record<string, string> = {};
      result.forEach((p) => {
        if (p.photo) photosPayload[p.article] = p.photo;
      });

      const saveResp = await fetch(PRODUCTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: result.map((p) => ({
            article: p.article,
            category: p.category,
            params: p.params,
            price: p.price,
            gallery: p.gallery,
          })),
          photos: photosPayload,
        }),
      });

      if (!saveResp.ok) {
        const err = await saveResp.json().catch(() => ({}));
        throw new Error(err.error || `Ошибка сервера ${saveResp.status}`);
      }

      setError("");

      setProducts(result);
      setStep("result");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Ошибка: ${msg}. Убедитесь что файл не повреждён и соответствует формату Excel/CSV.`);
      console.error(e);
    }

    setLoading(false);
  };

  const handleDownloadPDF = async () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // A4: 210×297 мм
    // Ячейка: QR 30×30 мм + подпись ~6 мм + отступ = ~38 мм высота, ~36 мм ширина
    const pageW = 210;
    const pageH = 297;
    const margin = 8;        // поля страницы
    const qrSize = 30;       // размер QR кода
    const labelH = 6;        // высота подписи под QR
    const cellPad = 3;       // отступ внутри рамки
    const gap = 2;           // зазор между ячейками

    // Размер ячейки с рамкой
    const cellW = qrSize + cellPad * 2;
    const cellH = qrSize + labelH + cellPad * 2;

    const cols = Math.floor((pageW - margin * 2 + gap) / (cellW + gap));
    const rows = Math.floor((pageH - margin * 2 + gap) / (cellH + gap));
    const perPage = cols * rows;

    // Общий шаг
    const stepX = cellW + gap;
    const stepY = cellH + gap;

    // Центрируем сетку на странице
    const gridW = cols * cellW + (cols - 1) * gap;
    const gridH = rows * cellH + (rows - 1) * gap;
    const startX = (pageW - gridW) / 2;
    const startY = (pageH - gridH) / 2;

    for (let i = 0; i < products.length; i++) {
      if (i > 0 && i % perPage === 0) doc.addPage();

      const pos = i % perPage;
      const col = pos % cols;
      const row = Math.floor(pos / cols);

      const x = startX + col * stepX;
      const y = startY + row * stepY;

      // Рамка для отреза — тонкая пунктирная линия
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.2);
      doc.setLineDashPattern([1, 1], 0);
      doc.rect(x, y, cellW, cellH);
      doc.setLineDashPattern([], 0);

      // QR код
      const canvas = qrRefs.current[products[i].article];
      if (canvas) {
        const imgData = canvas.toDataURL("image/png");
        doc.addImage(imgData, "PNG", x + cellPad, y + cellPad, qrSize, qrSize);
      }

      // Артикул под QR
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(47, 79, 79);
      doc.text(
        products[i].article,
        x + cellW / 2,
        y + cellPad + qrSize + 4,
        { align: "center", maxWidth: cellW - 2 }
      );
    }

    doc.save("qr-codes.pdf");
  };

  const handleDownloadCSV = () => {
    const header = ["Артикул", "Найдено фото", "Ссылка на карточку"];
    const rows = products.map((p) => [
      p.article,
      p.hasPhoto ? "Да" : "Нет",
      p.url,
    ]);
    const csv = [header, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "catalog-links.csv";
    a.click();
  };

  return (
    <div className="min-h-screen bg-white font-golos">
      {/* Header */}
      <div style={{ background: "#2F4F4F" }} className="px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Админ-панель
            </h1>
            <p className="text-xs text-white/50 font-ibm mt-0.5">
              Каталог товаров с QR-кодами
            </p>
          </div>
          {step === "result" && (
            <button
              onClick={() => setStep("upload")}
              className="text-xs text-white/60 hover:text-white transition-colors flex items-center gap-1"
            >
              <Icon name="ArrowLeft" size={14} />
              Загрузить новый
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {step === "upload" && (
          <div className="animate-fade-in space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1" style={{ color: "#2F4F4F" }}>
                Загрузка данных
              </h2>
              <p className="text-sm text-gray-400 font-ibm">
                Загрузите файл с товарами и архив с фотографиями
              </p>
            </div>

            {/* Upload zones */}
            <div className="grid gap-4 sm:grid-cols-2">
              <UploadZone
                label="Excel / CSV файл"
                hint="Столбцы: Категория, Фото, Артикул, Параметры, Цена, Ссылка"
                accept=".xlsx,.xls,.csv"
                icon="FileSpreadsheet"
                file={csvFile}
                onFile={setCsvFile}
              />
              <UploadZone
                label="ZIP с фотографиями"
                hint="Имена файлов должны содержать артикул товара"
                accept=".zip"
                icon="Archive"
                file={zipFile}
                onFile={setZipFile}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-500 text-sm font-ibm animate-fade-in">
                <Icon name="AlertCircle" size={16} />
                {error}
              </div>
            )}

            <button
              onClick={handleProcess}
              disabled={loading || !csvFile}
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-white font-semibold text-sm transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "#2F4F4F" }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Обработка...
                </>
              ) : (
                <>
                  <Icon name="Zap" size={16} />
                  Обработать
                </>
              )}
            </button>
          </div>
        )}

        {step === "result" && (
          <div className="animate-fade-in space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: "#2F4F4F" }}>
                  Результат обработки
                </h2>
                <p className="text-sm text-gray-400 font-ibm">
                  Найдено {products.length} товаров ·{" "}
                  {products.filter((p) => p.hasPhoto).length} с фото
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadCSV}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all hover:bg-gray-50"
                  style={{ borderColor: "#2F4F4F", color: "#2F4F4F" }}
                >
                  <Icon name="Download" size={14} />
                  CSV ссылок
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-medium transition-all hover:opacity-90"
                  style={{ background: "#2F4F4F" }}
                >
                  <Icon name="FileText" size={14} />
                  PDF с QR
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="border rounded-xl overflow-hidden" style={{ borderColor: "#2F4F4F", borderOpacity: 0.15 }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-ibm">
                  <thead>
                    <tr style={{ background: "#2F4F4F" }}>
                      <th className="text-left px-4 py-3 text-white/70 font-medium text-xs uppercase tracking-wider">Артикул</th>
                      <th className="text-left px-4 py-3 text-white/70 font-medium text-xs uppercase tracking-wider">Фото</th>
                      <th className="text-left px-4 py-3 text-white/70 font-medium text-xs uppercase tracking-wider">Ссылка на карточку</th>
                      <th className="text-left px-4 py-3 text-white/70 font-medium text-xs uppercase tracking-wider">QR-код</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p, idx) => (
                      <tr
                        key={p.article}
                        className="border-t transition-colors hover:bg-gray-50"
                        style={{ borderColor: "rgba(47,79,79,0.08)", animationDelay: `${idx * 20}ms` }}
                      >
                        <td className="px-4 py-3 font-golos font-semibold" style={{ color: "#2F4F4F" }}>
                          {p.article}
                        </td>
                        <td className="px-4 py-3">
                          {p.hasPhoto ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <Icon name="Check" size={11} />
                              Найдено
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                              <Icon name="X" size={11} />
                              Нет
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs underline underline-offset-2 hover:opacity-70 transition-opacity truncate max-w-[200px] block"
                            style={{ color: "#2F4F4F" }}
                          >
                            {p.url}
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <QRCodeCanvas
                            value={p.url}
                            size={56}
                            fgColor="#2F4F4F"
                            bgColor="#ffffff"
                            ref={(el) => {
                              if (el) qrRefs.current[p.article] = el;
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Hidden full-size QR for PDF */}
            <div className="hidden">
              {products.map((p) => (
                <QRCodeCanvas
                  key={`pdf-${p.article}`}
                  value={p.url}
                  size={200}
                  fgColor="#2F4F4F"
                  bgColor="#ffffff"
                  ref={(el) => {
                    if (el) qrRefs.current[p.article] = el;
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface UploadZoneProps {
  label: string;
  hint: string;
  accept: string;
  icon: string;
  file: File | null;
  onFile: (f: File) => void;
}

function UploadZone({ label, hint, accept, icon, file, onFile }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      className="relative rounded-xl border-2 border-dashed p-6 cursor-pointer transition-all duration-200 flex flex-col items-center text-center gap-3 group"
      style={{
        borderColor: drag ? "#2F4F4F" : file ? "#2F4F4F" : "#c8d8d8",
        background: drag ? "rgba(47,79,79,0.04)" : file ? "rgba(47,79,79,0.02)" : "#fff",
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
        style={{ background: file ? "#2F4F4F" : "rgba(47,79,79,0.08)" }}
      >
        <Icon
          name={file ? "CheckCircle" : icon}
          size={20}
          className={file ? "text-white" : undefined}
          style={{ color: file ? undefined : "#2F4F4F" }}
        />
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: "#2F4F4F" }}>
          {file ? file.name : label}
        </p>
        <p className="text-xs text-gray-400 font-ibm mt-0.5">
          {file ? `${(file.size / 1024).toFixed(0)} КБ` : hint}
        </p>
      </div>
      {!file && (
        <p className="text-xs text-gray-300 font-ibm">
          Нажмите или перетащите файл
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </div>
  );
}