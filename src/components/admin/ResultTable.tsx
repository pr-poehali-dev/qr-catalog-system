import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import * as XLSX from "xlsx";
import Icon from "@/components/ui/icon";
import { ProductRow } from "@/lib/processFiles";

interface ResultTableProps {
  products: ProductRow[];
  onDownloadCSV: () => void;
  onDownloadPDF: (selected: string[]) => void;
}

export default function ResultTable({ products, onDownloadCSV, onDownloadPDF }: ResultTableProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(products.map((p) => p.article)));
  const [orderFile, setOrderFile] = useState<string | null>(null);
  const [orderMap, setOrderMap] = useState<Map<string, number> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allChecked = selected.size === products.length;
  const someChecked = selected.size > 0 && !allChecked;

  const toggleAll = () => {
    if (allChecked) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products.map((p) => p.article)));
    }
  };

  const toggle = (article: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(article)) next.delete(article);
      else next.add(article);
      return next;
    });
  };

  const handleOrderFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target!.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const map = new Map<string, number>();
      rows.forEach((row, idx) => {
        const val = String(row[0] ?? "").trim();
        if (val) map.set(val, idx);
      });
      setOrderMap(map);
      setOrderFile(file.name);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const clearOrder = () => {
    setOrderFile(null);
    setOrderMap(null);
  };

  const handleExportPDF = () => {
    const selectedArticles = Array.from(selected);
    if (!orderMap) {
      onDownloadPDF(selectedArticles);
      return;
    }
    const sorted = [...selectedArticles].sort((a, b) => {
      const ia = orderMap.has(a) ? orderMap.get(a)! : Infinity;
      const ib = orderMap.has(b) ? orderMap.get(b)! : Infinity;
      return ia - ib;
    });
    onDownloadPDF(sorted);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "#2F4F4F" }}>
            Результат обработки
          </h2>
          <p className="text-sm text-gray-400 font-ibm">
            Найдено {products.length} товаров ·{" "}
            {products.filter((p) => p.hasPhoto).length} с фото ·{" "}
            <span style={{ color: "#2F4F4F" }} className="font-medium">
              {selected.size} выбрано для PDF
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center justify-end">
          {orderFile ? (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border"
              style={{ borderColor: "#2F4F4F", color: "#2F4F4F", background: "rgba(47,79,79,0.05)" }}
            >
              <Icon name="ListOrdered" size={13} />
              <span className="max-w-[120px] truncate font-ibm">{orderFile}</span>
              <button
                onClick={clearOrder}
                className="hover:opacity-60 transition-opacity ml-1"
                title="Сбросить порядок"
              >
                <Icon name="X" size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all hover:bg-gray-50"
              style={{ borderColor: "rgba(47,79,79,0.4)", color: "#2F4F4F" }}
              title="Загрузить Excel с порядком артикулов"
            >
              <Icon name="ListOrdered" size={14} />
              Порядок QR
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleOrderFile}
          />
          <button
            onClick={onDownloadCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all hover:bg-gray-50"
            style={{ borderColor: "#2F4F4F", color: "#2F4F4F" }}
          >
            <Icon name="Download" size={14} />
            CSV ссылок
          </button>
          <button
            onClick={handleExportPDF}
            disabled={selected.size === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-medium transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: "#2F4F4F" }}
          >
            <Icon name="FileText" size={14} />
            PDF с QR{selected.size < products.length ? ` (${selected.size})` : ""}
            {orderFile && <Icon name="ArrowUpDown" size={12} />}
          </button>
        </div>
      </div>

      {orderMap && (
        <div
          className="flex items-start gap-2 px-4 py-3 rounded-lg text-sm font-ibm"
          style={{ background: "rgba(47,79,79,0.06)", color: "#2F4F4F" }}
        >
          <Icon name="Info" size={15} className="mt-0.5 shrink-0" />
          <span>
            Порядок из файла применён: {orderMap.size} артикулов.
            Артикулы не из файла будут добавлены в конец.
          </span>
        </div>
      )}

      <div className="border rounded-xl overflow-hidden" style={{ borderColor: "rgba(47,79,79,0.2)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-ibm">
            <thead>
              <tr style={{ background: "#2F4F4F" }}>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = someChecked; }}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded cursor-pointer accent-white"
                    title={allChecked ? "Снять все" : "Выбрать все"}
                  />
                </th>
                <th className="text-left px-4 py-3 text-white/70 font-medium text-xs uppercase tracking-wider">Артикул</th>
                <th className="text-left px-4 py-3 text-white/70 font-medium text-xs uppercase tracking-wider">Фото</th>
                <th className="text-left px-4 py-3 text-white/70 font-medium text-xs uppercase tracking-wider">Ссылка на карточку</th>
                <th className="text-left px-4 py-3 text-white/70 font-medium text-xs uppercase tracking-wider">QR-код</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, idx) => {
                const isSelected = selected.has(p.article);
                const orderPos = orderMap?.get(p.article);
                return (
                  <tr
                    key={p.article}
                    onClick={() => toggle(p.article)}
                    className="border-t transition-colors hover:bg-gray-50 cursor-pointer"
                    style={{
                      borderColor: "rgba(47,79,79,0.08)",
                      animationDelay: `${idx * 20}ms`,
                      background: isSelected ? "rgba(47,79,79,0.03)" : undefined,
                    }}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(p.article)}
                        className="w-4 h-4 rounded cursor-pointer"
                        style={{ accentColor: "#2F4F4F" }}
                      />
                    </td>
                    <td className="px-4 py-3 font-golos font-semibold" style={{ color: "#2F4F4F" }}>
                      <div className="flex items-center gap-2">
                        {p.article}
                        {orderPos !== undefined && (
                          <span
                            className="text-[10px] font-ibm font-normal px-1.5 py-0.5 rounded"
                            style={{ background: "rgba(47,79,79,0.12)", color: "#2F4F4F" }}
                          >
                            #{orderPos + 1}
                          </span>
                        )}
                      </div>
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
                        onClick={(e) => e.stopPropagation()}
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
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
