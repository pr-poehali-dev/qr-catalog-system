import Icon from "@/components/ui/icon";
import UploadZone from "./UploadZone";

interface UploadStepProps {
  csvFile: File | null;
  zipFile: File | null;
  loading: boolean;
  error: string;
  onCsvFile: (f: File) => void;
  onZipFile: (f: File) => void;
  onProcess: () => void;
}

export default function UploadStep({
  csvFile,
  zipFile,
  loading,
  error,
  onCsvFile,
  onZipFile,
  onProcess,
}: UploadStepProps) {
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1" style={{ color: "#2F4F4F" }}>
          Загрузка данных
        </h2>
        <p className="text-sm text-gray-400 font-ibm">
          Загрузите файл с товарами и архив с фотографиями
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <UploadZone
          label="Excel / CSV файл"
          hint="Столбцы: Категория, Фото, Артикул, Параметры, Цена, Ссылка"
          accept=".xlsx,.xls,.csv"
          icon="FileSpreadsheet"
          file={csvFile}
          onFile={onCsvFile}
        />
        <UploadZone
          label="ZIP с фотографиями"
          hint="Имена файлов должны содержать артикул товара"
          accept=".zip"
          icon="Archive"
          file={zipFile}
          onFile={onZipFile}
        />
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
