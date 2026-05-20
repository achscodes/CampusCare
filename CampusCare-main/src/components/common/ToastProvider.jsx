import { useCallback, useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { registerToast } from "../../utils/toast";
import "./ToastProvider.css";

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const defaultDuration = (variant) => (variant === "error" ? 6200 : 4200);

/**
 * Mount once in `App` so `showToast()` works app-wide.
 */
export default function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const push = useCallback((message, options = {}) => {
    const variant = options.variant ?? "info";
    const duration = options.duration ?? defaultDuration(variant);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setItems((prev) => [...prev, { id, message, variant, duration }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  useEffect(() => {
    registerToast(push);
    return () => registerToast(null);
  }, [push]);

  return (
    <>
      {children}
      <div className="cc-toast-host" aria-live="polite" aria-relevant="additions text">
        {items.map((t) => {
          const Icon = ICONS[t.variant] ?? ICONS.info;
          return (
            <div key={t.id} className={`cc-toast cc-toast--${t.variant}`} role="status">
              <Icon className="cc-toast__icon" size={20} strokeWidth={2} aria-hidden />
              <span className="cc-toast__text">{t.message}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
