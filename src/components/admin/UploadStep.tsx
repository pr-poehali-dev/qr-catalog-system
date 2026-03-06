import Icon from "@/components/ui/icon";
import UploadZone from "./UploadZone";

interface UploadStepProps {
  csvFile: File | null;
  loading: boolean;
  error: string;
  overwrite: boolean;
  onCsvFile: (f: File) => void;
  onOverwriteChange: (v: boolean) => void;
  onProcess: () => void;
}

export default function UploadStep({
  csvFile,
  loading,
  error,
  overwrite,
  onCsvFile,
  onOverwriteChange,
  onProcess,
}: UploadStepProps) {
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1" style={{ color: "#2F4F4F" }}>
          Загрузка артикулов
        </h2>
        <p className="text-sm text-gray-400 font-ibm">
          Загрузите файл с товарами: Категория, Фото, Артикул, Параметры, Цена, Ссылка
        </p>
      </div>

      <UploadZone
        label="Excel / CSV файл"
        hint="Столбцы: Категория, Фото, Артикул, Параметры, Цена, Ссылка"
        accept=".xlsx,.xls,.csv"
        icon="FileSpreadsheet"
        file={csvFile}
        onFile={onCsvFile}
      />

      {/* Переключатель режима */}
      <div
        className="flex items-center gap-3 p-4 rounded-xl border"
        style={{ borderColor: "rgba(47,79,79,0.12)" }}
      >
        <button
          type="button"
          onClick={() => onOverwriteChange(!overwrite)}
          className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
          style={{ background: overwrite ? "#2F4F4F" : "#d1d5db" }}
          aria-checked={overwrite}
          role="switch"
        >
          <span
            className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200"
            style={{ transform: overwrite ? "translateX(16px)" : "translateX(0)" }}
          />
        </button>
        <div>
          <p className="text-sm font-medium" style={{ color: "#2F4F4F" }}>
            {overwrite ? "Перезаписать все данные" : "Добавить только новые"}
          </p>
          <p className="text-xs text-gray-400 font-ibm">
            {overwrite
              ? "Существующие товары будут заменены из файла"
              : "Существующие артикулы не изменятся, добавятся только новые"}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm font-ibm animate-fade-in">
          <Icon name="AlertCircle" size={16} />
          {error}
        </div>
      )}

      <button
        onClick={onProcess}
        disabled={loading || !csvFile}
        className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-white font-semibold text-sm transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: "#2F4F4F" }}
      >
        {loading ? (
          <>
            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            {error.startsWith("Загружаю") || error.startsWith("Сохраняю") ? error : "Обработка..."}
          </>
        ) : (
          <>
            <Icon name="Zap" size={16} />
            Обработать
          </>
        )}
      </button>
    </div>
  );
}
