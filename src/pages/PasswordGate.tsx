import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { CATALOG_PASSWORD_KEY } from "./AdminPage";

interface PasswordGateProps {
  children: React.ReactNode;
  mode: "catalog" | "admin";
}

const ADMIN_PASSWORD = "Pizza999i$%jw-rt188!";

function getCatalogPassword(): string {
  return localStorage.getItem(CATALOG_PASSWORD_KEY) || "2024";
}

const COOKIES = {
  catalog: "catalog_auth",
  admin: "admin_auth",
};

const COOKIE_DAYS = 30;

function setCookie(name: string, value: string, days: number) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? match[2] : null;
}

export default function PasswordGate({ children, mode }: PasswordGateProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    const cookie = getCookie(COOKIES[mode]);
    if (cookie === "ok") setAuthenticated(true);
    setChecking(false);
  }, [mode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPassword = mode === "admin" ? ADMIN_PASSWORD : getCatalogPassword();
    if (input === correctPassword) {
      setCookie(COOKIES[mode], "ok", COOKIE_DAYS);
      setAuthenticated(true);
      setError(false);
    } else {
      setError(true);
      setShake(true);
      setInput("");
      setTimeout(() => setShake(false), 500);
    }
  };

  if (checking) return null;
  if (authenticated) return <>{children}</>;

  const isAdmin = mode === "admin";

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 font-golos">
      <div
        className={`w-full max-w-sm ${shake ? "animate-shake" : "animate-scale-in"}`}
        style={{ animationFillMode: "both" }}
      >
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "#2F4F4F" }}
          >
            <Icon name={isAdmin ? "ShieldCheck" : "Lock"} size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: "#2F4F4F" }}>
            {isAdmin ? "Админ-панель" : "Каталог товаров"}
          </h1>
          <p className="text-sm text-gray-400 mt-1 font-ibm">
            {isAdmin ? "Введите пароль администратора" : "Введите пароль для просмотра"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(false); }}
              placeholder="Пароль"
              autoFocus
              className={`w-full px-4 py-3 pr-11 rounded-xl border text-sm font-ibm outline-none transition-all duration-200 ${
                error
                  ? "border-red-300 bg-red-50 text-red-900"
                  : "border-gray-200 bg-gray-50 focus:border-[#2F4F4F] focus:bg-white"
              }`}
              style={{ color: error ? undefined : "#2F4F4F" }}
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Icon name={showPass ? "EyeOff" : "Eye"} size={16} />
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1 font-ibm animate-fade-in">
              <Icon name="AlertCircle" size={12} />
              Неверный пароль
            </p>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
            style={{ background: "#2F4F4F" }}
          >
            Войти
          </button>
        </form>
      </div>

      <style>{`
        @keyframes animate-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .animate-shake { animation: animate-shake 0.5s ease-in-out; }
      `}</style>
    </div>
  );
}