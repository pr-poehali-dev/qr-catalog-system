import { QRCodeCanvas } from "qrcode.react";
import Icon from "@/components/ui/icon";
import { ProductRow } from "@/lib/processFiles";

interface ResultTableProps {
  products: ProductRow[];
  qrRefs: React.MutableRefObject<Record<string, HTMLCanvasElement | null>>;
  onDownloadCSV: () => void;
  onDownloadPDF: () => void;
}

export default function ResultTable({ products, qrRefs, onDownloadCSV, onDownloadPDF }: ResultTableProps) {
  return (
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
            onClick={onDownloadCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all hover:bg-gray-50"
            style={{ borderColor: "#2F4F4F", color: "#2F4F4F" }}
          >
            <Icon name="Download" size={14} />
            CSV ссылок
          </button>
          <button
            onClick={onDownloadPDF}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-medium transition-all hover:opacity-90"
            style={{ background: "#2F4F4F" }}
          >
            <Icon name="FileText" size={14} />
            PDF с QR
          </button>
        </div>
      </div>

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
                      ref={(el) => { if (el) qrRefs.current[p.article] = el; }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Скрытые полноразмерные QR для PDF */}
      <div className="hidden">
        {products.map((p) => (
          <QRCodeCanvas
            key={`pdf-${p.article}`}
            value={p.url}
            size={200}
            fgColor="#2F4F4F"
            bgColor="#ffffff"
            ref={(el) => { if (el) qrRefs.current[p.article] = el; }}
          />
        ))}
      </div>
    </div>
  );
}
