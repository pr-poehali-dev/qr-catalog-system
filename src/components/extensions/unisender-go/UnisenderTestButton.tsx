/**
 * Unisender Go - Test Button Component
 *
 * Кнопка для проверки настройки email-рассылки.
 * Показывается до первой успешной отправки, потом скрывается.
 */

import { useState, useEffect } from "react";
import { useUnisender } from "./useUnisender";

interface UnisenderTestButtonProps {
  apiUrl: string;
  /** Ключ для localStorage, по умолчанию "unisender_configured" */
  storageKey?: string;
  /** Принудительно показать кнопку (для отладки) */
  forceShow?: boolean;
}

export function UnisenderTestButton({
  apiUrl,
  storageKey = "unisender_configured",
  forceShow = false,
}: UnisenderTestButtonProps) {
  const [isConfigured, setIsConfigured] = useState(true); // скрываем по умолчанию до проверки
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const { sendTest, isLoading } = useUnisender({ apiUrl });

  // Проверяем localStorage при монтировании
  useEffect(() => {
    const configured = localStorage.getItem(storageKey);
    setIsConfigured(configured === "true" && !forceShow);
  }, [storageKey, forceShow]);

  // Если уже настроено — не показываем
  if (isConfigured) {
    return null;
  }

  const handleTest = async () => {
    if (!email.trim()) {
      setStatus("error");
      setMessage("Введите email");
      return;
    }

    if (!email.includes("@")) {
      setStatus("error");
      setMessage("Неверный формат email");
      return;
    }

    setStatus("idle");
    setMessage("");

    const result = await sendTest({ to_email: email.trim() });

    if (result.success) {
      setStatus("success");
      setMessage("Тестовое письмо отправлено! Проверьте почту.");
      // Сохраняем в localStorage что настройка завершена
      localStorage.setItem(storageKey, "true");
      // Скрываем через 3 секунды
      setTimeout(() => {
        setIsConfigured(true);
      }, 3000);
    } else {
      setStatus("error");
      setMessage(result.error || "Ошибка отправки");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.icon}>📧</span>
          <span style={styles.title}>Проверка Email-уведомлений</span>
        </div>

        <p style={styles.description}>
          Отправьте тестовое письмо, чтобы убедиться что Unisender Go настроен правильно.
        </p>

        <div style={styles.form}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Ваш email для проверки"
            style={styles.input}
            disabled={isLoading}
          />
          <button
            onClick={handleTest}
            disabled={isLoading}
            style={{
              ...styles.button,
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? "Отправка..." : "Отправить тестовое письмо"}
          </button>
        </div>

        {message && (
          <div
            style={{
              ...styles.message,
              backgroundColor: status === "success" ? "#d4edda" : "#f8d7da",
              color: status === "success" ? "#155724" : "#721c24",
            }}
          >
            {message}
          </div>
        )}

        <p style={styles.hint}>
          После успешной отправки эта панель исчезнет.
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: 9999,
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
    padding: "20px",
    maxWidth: "360px",
    border: "1px solid #e0e0e0",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "12px",
  },
  icon: {
    fontSize: "24px",
  },
  title: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#333",
  },
  description: {
    fontSize: "14px",
    color: "#666",
    marginBottom: "16px",
    lineHeight: 1.4,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  input: {
    padding: "10px 12px",
    fontSize: "14px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    outline: "none",
    transition: "border-color 0.2s",
  },
  button: {
    padding: "10px 16px",
    fontSize: "14px",
    fontWeight: 500,
    color: "#fff",
    backgroundColor: "#7c3aed",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  message: {
    marginTop: "12px",
    padding: "10px 12px",
    borderRadius: "8px",
    fontSize: "13px",
  },
  hint: {
    marginTop: "12px",
    fontSize: "12px",
    color: "#999",
    textAlign: "center",
  },
};

export default UnisenderTestButton;
