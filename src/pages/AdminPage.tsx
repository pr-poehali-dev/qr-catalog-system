import { useState, useRef, useEffect } from "react";
import jsPDF from "jspdf";
import Icon from "@/components/ui/icon";
import UploadStep from "@/components/admin/UploadStep";
import ResultTable from "@/components/admin/ResultTable";
import {
  ProductRow,
  parseSpreadsheet,
  parseZip,
  buildProducts,
  saveToServer,
  updatePrices,
  encodeArticle,
} from "@/lib/processFiles";

const PRODUCTS_URL = "https://functions.poehali.dev/2d53c3f9-ece3-4909-b127-ad2dd38059f9";
const SETTINGS_URL = "https://functions.poehali.dev/aafea221-e9fd-48bb-8c97-bb6ea04441e9";
const BASE_URL = window.location.origin;

export default function AdminPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [step, setStep] = useState<"upload" | "result">("upload");
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const qrRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [priceFile, setPriceFile] = useState<File | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceStatus, setPriceStatus] = useState("");
  const [priceError, setPriceError] = useState("");
  const priceInputRef = useRef<HTMLInputElement>(null);

  // Загружаем существующие товары и пароль при монтировании
  useEffect(() => {
    Promise.all([
      fetch(`${PRODUCTS_URL}?all=1`).then((r) => r.json()).catch(() => ({ products: [] })),
      fetch(SETTINGS_URL).then((r) => r.json()).catch(() => ({ password: "2024" })),
    ]).then(([prodData, settingsData]) => {
      setCurrentPassword(settingsData.password ?? "2024");
      const list: ProductRow[] = (prodData.products ?? []).map((p: Record<string, string>) => ({
        article: p.article,
        category: p.category,
        params: p.params,
        price: p.price,
        gallery: p.gallery,
        hasPhoto: !!p.photo_url,
        url: `${BASE_URL}/?c=${encodeArticle(p.article)}`,
      }));
      if (list.length > 0) {
        setProducts(list);
        setStep("result");
      }
    }).finally(() => setLoadingExisting(false));
  }, []);

  const handleSavePassword = async () => {
    if (!newPassword.trim()) return;
    setPasswordError("");
    const resp = await fetch(`${SETTINGS_URL}?action=update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword.trim() }),
    });
    if (resp.ok) {
      setCurrentPassword(newPassword.trim());
      setPasswordSaved(true);
      setNewPassword("");
      setTimeout(() => setPasswordSaved(false), 2500);
    } else {
      setPasswordError("Не удалось сохранить пароль");
    }
  };

  const handleProcess = async () => {
    if (!csvFile) { setError("Загрузите файл Excel или CSV"); return; }
    setError("");
    setLoading(true);

    try {
      const rows = await parseSpreadsheet(csvFile);
      const dataRows = rows.slice(1).filter((r) => String(r[2] ?? "").trim() !== "");

      if (dataRows.length === 0) {
        setError("Не найдено строк с данными. Убедитесь что: 1) артикул в столбце C (3-й), 2) данные начинаются со 2-й строки, 3) файл не пустой.");
        setLoading(false);
        return;
      }

      const photoMap = zipFile ? await parseZip(zipFile) : {};
      const result = buildProducts(rows, photoMap);

      await saveToServer(result, (msg) => setError(msg));

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

  const handleDownloadPDF = (selectedArticles: string[]) => {
    const toprint = products.filter((p) => selectedArticles.includes(p.article));
    if (toprint.length === 0) return;

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const pageW = 210;
    const pageH = 297;
    const margin = 8;
    const qrSize = 30;
    const labelH = 6;
    const cellPad = 3;
    const gap = 2;

    const cellW = qrSize + cellPad * 2;
    const cellH = qrSize + labelH + cellPad * 2;
    const cols = Math.floor((pageW - margin * 2 + gap) / (cellW + gap));
    const rows = Math.floor((pageH - margin * 2 + gap) / (cellH + gap));
    const perPage = cols * rows;
    const stepX = cellW + gap;
    const stepY = cellH + gap;
    const gridW = cols * cellW + (cols - 1) * gap;
    const gridH = rows * cellH + (rows - 1) * gap;
    const startX = (pageW - gridW) / 2;
    const startY = (pageH - gridH) / 2;

    for (let i = 0; i < toprint.length; i++) {
      if (i > 0 && i % perPage === 0) doc.addPage();
      const pos = i % perPage;
      const col = pos % cols;
      const row = Math.floor(pos / cols);
      const x = startX + col * stepX;
      const y = startY + row * stepY;

      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.2);
      doc.setLineDashPattern([1, 1], 0);
      doc.rect(x, y, cellW, cellH);
      doc.setLineDashPattern([], 0);

      const canvas = qrRefs.current[toprint[i].article];
      if (canvas) {
        doc.addImage(canvas.toDataURL("image/png"), "PNG", x + cellPad, y + cellPad, qrSize, qrSize);
      }

      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(47, 79, 79);
      doc.text(toprint[i].article, x + cellW / 2, y + cellPad + qrSize + 4, {
        align: "center",
        maxWidth: cellW - 2,
      });
    }

    doc.save("qr-codes.pdf");
  };

  const handleUpdatePrices = async () => {
    if (!priceFile) return;
    setPriceError("");
    setPriceStatus("");
    setPriceLoading(true);
    try {
      const { updated, inserted } = await updatePrices(priceFile, (msg) => setPriceStatus(msg));
      setPriceStatus(`Готово: обновлено ${updated}, добавлено ${inserted} товаров`);
      setPriceFile(null);
      if (priceInputRef.current) priceInputRef.current.value = "";
    } catch (e) {
      setPriceError(e instanceof Error ? e.message : String(e));
    }
    setPriceLoading(false);
  };

  const handleDownloadCSV = () => {
    const header = ["Артикул", "Найдено фото", "Ссылка на карточку"];
    const csvRows = products.map((p) => [p.article, p.hasPhoto ? "Да" : "Нет", p.url]);
    const csv = [header, ...csvRows].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "catalog-links.csv";
    a.click();
  };

  if (loadingExisting) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "#2F4F4F", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-golos">
      <div style={{ background: "#2F4F4F" }} className="px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Админ-панель</h1>
            <p className="text-xs text-white/50 font-ibm mt-0.5">Каталог товаров с QR-кодами</p>
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

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">
        {step === "upload" && (
          <UploadStep
            csvFile={csvFile}
            zipFile={zipFile}
            loading={loading}
            error={error}
            onCsvFile={setCsvFile}
            onZipFile={setZipFile}
            onProcess={handleProcess}
          />
        )}
        {step === "result" && (
          <ResultTable
            products={products}
            qrRefs={qrRefs}
            onDownloadCSV={handleDownloadCSV}
            onDownloadPDF={handleDownloadPDF}
          />
        )}

        {/* Обновление цен */}
        <div
          className="border rounded-xl p-5 space-y-3"
          style={{ borderColor: "rgba(47,79,79,0.12)" }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: "#2F4F4F" }}>
              Обновить цены
            </p>
            <p className="text-xs text-gray-400 font-ibm mt-0.5">
              Загрузите Excel/CSV — цены обновятся по артикулам. Новые артикулы добавятся в базу.
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <label
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-all hover:border-[#2F4F4F] font-ibm"
              style={{ borderColor: "#c8d8d8", color: "#2F4F4F" }}
            >
              <Icon name="FileSpreadsheet" size={15} />
              {priceFile ? priceFile.name : "Выбрать файл"}
              <input
                ref={priceInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  setPriceFile(e.target.files?.[0] ?? null);
                  setPriceStatus("");
                  setPriceError("");
                }}
              />
            </label>
            <button
              onClick={handleUpdatePrices}
              disabled={!priceFile || priceLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: "#2F4F4F" }}
            >
              {priceLoading
                ? <><Icon name="Loader2" size={14} className="animate-spin" /> Обновляю...</>
                : <><Icon name="RefreshCw" size={14} /> Обновить цены</>}
            </button>
          </div>
          {priceStatus && (
            <p className="text-xs font-ibm flex items-center gap-1" style={{ color: "#2F4F4F" }}>
              <Icon name="CheckCircle" size={12} />{priceStatus}
            </p>
          )}
          {priceError && (
            <p className="text-xs text-red-500 font-ibm flex items-center gap-1">
              <Icon name="AlertCircle" size={12} />{priceError}
            </p>
          )}
        </div>

        {/* Смена пароля каталога */}
        <div
          className="border rounded-xl p-5 space-y-3"
          style={{ borderColor: "rgba(47,79,79,0.12)" }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: "#2F4F4F" }}>
              Пароль для просмотра каталога
            </p>
            <p className="text-xs text-gray-400 font-ibm mt-0.5">
              Текущий пароль:{" "}
              <span className="font-medium text-gray-600 font-mono">
                {currentPassword ?? "..."}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setPasswordError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSavePassword()}
              placeholder="Новый пароль"
              className="flex-1 px-3 py-2 rounded-lg border text-sm font-ibm outline-none transition-all focus:border-[#2F4F4F]"
              style={{ borderColor: "#c8d8d8", color: "#2F4F4F" }}
            />
            <button
              onClick={handleSavePassword}
              disabled={!newPassword.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: "#2F4F4F" }}
            >
              {passwordSaved
                ? <><Icon name="Check" size={14} /> Сохранено</>
                : <><Icon name="KeyRound" size={14} /> Сохранить</>}
            </button>
          </div>
          {passwordError && (
            <p className="text-xs text-red-500 font-ibm flex items-center gap-1">
              <Icon name="AlertCircle" size={12} />{passwordError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}