import { useEffect, useState } from "react";
import { useTelegramAuth } from "@/components/extensions/telegram-bot/useTelegramAuth";

const TG_AUTH_URL = "https://functions.poehali.dev/420b5ea1-6f3d-420d-bb72-398ac6d4f617";
const TG_BOT_USERNAME = "Jaguar_Official_bot";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready: () => void;
        expand: () => void;
        initDataUnsafe?: { user?: { id: number } };
      };
    };
  }
}

interface AuthScreenProps {
  onAuth: () => void;
}

const AuthScreen = ({ onAuth }: AuthScreenProps) => {
  const [webAppError, setWebAppError] = useState("");
  const [authStarted, setAuthStarted] = useState(false);

  const tgAuth = useTelegramAuth({
    apiUrls: {
      callback: `${TG_AUTH_URL}?action=callback`,
      refresh: `${TG_AUTH_URL}?action=refresh`,
      logout: `${TG_AUTH_URL}?action=logout`,
    },
    botUsername: TG_BOT_USERNAME,
  });

  useEffect(() => {
    if (tgAuth.isAuthenticated) onAuth();
  }, [tgAuth.isAuthenticated]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      setAuthStarted(true);
      window.history.replaceState({}, "", window.location.pathname);
      tgAuth.handleCallback(token);
      return;
    }

    let done = false;
    const tryWebApp = () => {
      if (done) return;
      const tgWebApp = window.Telegram?.WebApp;
      const initData = tgWebApp?.initData;
      if (initData) {
        done = true;
        setAuthStarted(true);
        tgWebApp!.ready();
        tgWebApp!.expand();
        fetch(`${TG_AUTH_URL}?action=webapp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ init_data: initData }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.access_token && data.refresh_token) {
              localStorage.setItem("telegram_auth_refresh_token", data.refresh_token);
              window.location.reload();
            } else {
              setWebAppError(data.error || "Ошибка авторизации");
            }
          })
          .catch(() => {
            setWebAppError("Ошибка соединения");
          });
      }
    };

    // Telegram WebApp SDK может инициализироваться асинхронно
    tryWebApp();
    const t1 = setTimeout(tryWebApp, 200);
    const t2 = setTimeout(tryWebApp, 800);
    const t3 = setTimeout(tryWebApp, 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 px-6 text-center">
        <img
          src="https://cdn.poehali.dev/projects/0458ff35-1488-42b4-a47d-9a48901b711f/bucket/bdee33c2-9378-4db9-9a37-c87d8ac6f8cf.jpg"
          alt="Jaguar"
          className={`w-20 h-20 object-contain ${authStarted && !webAppError ? "animate-pulse" : ""}`}
        />
        <span className="text-[#4ade80] font-extrabold text-lg tracking-wider uppercase">
          Jaguar
        </span>

        {webAppError ? (
          <p className="text-red-400/80 text-sm mt-2">{webAppError}</p>
        ) : authStarted ? (
          <span className="text-white/40 text-sm">Вход...</span>
        ) : (
          <p className="text-white/40 text-sm mt-2">
            Откройте приложение через Telegram
          </p>
        )}
      </div>
    </div>
  );
};

export default AuthScreen;