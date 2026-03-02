import Icon from "@/components/ui/icon";

export default function Index() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center font-golos p-6 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 animate-scale-in"
        style={{ background: "#2F4F4F" }}
      >
        <Icon name="QrCode" size={32} className="text-white" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight mb-2 animate-fade-in" style={{ color: "#2F4F4F" }}>
        Каталог товаров
      </h1>
      <p className="text-sm text-gray-400 font-ibm max-w-xs leading-relaxed animate-fade-in">
        Отсканируйте QR-код с упаковки товара, чтобы открыть карточку с описанием и фотографиями.
      </p>

      <div
        className="mt-10 p-4 rounded-xl border text-left w-full max-w-xs animate-slide-up"
        style={{ borderColor: "rgba(47,79,79,0.15)", background: "rgba(47,79,79,0.02)" }}
      >
        <p className="text-xs font-ibm text-gray-400 uppercase tracking-wider mb-3">Для администратора</p>
        <a
          href="/admin"
          className="flex items-center gap-2 text-sm font-semibold transition-colors hover:opacity-70"
          style={{ color: "#2F4F4F" }}
        >
          <Icon name="Settings" size={16} />
          Перейти в админ-панель
        </a>
      </div>
    </div>
  );
}
