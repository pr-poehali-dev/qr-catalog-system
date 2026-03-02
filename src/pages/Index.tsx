export default function Index() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center font-golos p-6">
      <a
        href="/admin"
        className="text-sm font-medium underline underline-offset-4 hover:opacity-60 transition-opacity"
        style={{ color: "#2F4F4F" }}
      >
        Войти в панель управления
      </a>
    </div>
  );
}