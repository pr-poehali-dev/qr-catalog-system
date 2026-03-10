import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

const TG_AUTH_URL = "https://functions.poehali.dev/420b5ea1-6f3d-420d-bb72-398ac6d4f617";

const TelegramCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setErrorMsg("Токен не найден");
      return;
    }

    fetch(`${TG_AUTH_URL}?action=callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.access_token && data.refresh_token) {
          localStorage.setItem("telegram_auth_refresh_token", data.refresh_token);
          navigate("/", { replace: true });
        } else {
          setStatus("error");
          setErrorMsg(data.error || "Ошибка авторизации");
        }
      })
      .catch((err) => {
        setStatus("error");
        setErrorMsg("Ошибка сети: " + err.message);
      });
  }, []);

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center">
      {status === "loading" ? (
        <>
          <div className="text-[#4ade80] font-extrabold text-2xl tracking-wide uppercase animate-pulse mb-4">
            Jaguar
          </div>
          <p className="text-white/40 text-sm">Авторизация через Telegram...</p>
        </>
      ) : (
        <>
          <p className="text-red-400 text-sm mb-4">{errorMsg || "Ошибка авторизации. Попробуйте снова."}</p>
          <button
            onClick={() => navigate("/", { replace: true })}
            className="bg-[#4ade80] text-black font-bold text-sm rounded-xl px-6 py-3 hover:bg-[#4ade80]/90 transition-colors"
          >
            На главную
          </button>
        </>
      )}
    </div>
  );
};

export default TelegramCallback;