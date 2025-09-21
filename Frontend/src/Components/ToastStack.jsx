import React, { useEffect } from "react";

export default function ToastStack({ toasts, onClose }) {
  useEffect(() => {
    const timers = toasts.map(t => setTimeout(() => onClose(t.id), t.duration ?? 3000));
    return () => timers.forEach(clearTimeout);
  }, [toasts, onClose]);

  return (
    <div className="mgreg-toastStack" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`mgreg-toast ${t.variant ? `mgreg-toast--${t.variant}` : ""}`}>
          {t.icon && <span className="mgreg-toastIc" aria-hidden="true">{t.icon}</span>}
          <div className="mgreg-toastBody">
            {t.title && <strong className="mgreg-toastTitle">{t.title}</strong>}
            <div className="mgreg-toastMsg">{t.message}</div>
          </div>
          <button className="mgreg-toastClose" onClick={() => onClose(t.id)} aria-label="Cerrar">×</button>
        </div>
      ))}
    </div>
  );
}
