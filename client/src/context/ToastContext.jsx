import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CircleCheck, AlertCircle, X } from 'lucide-react';

const ToastContext = createContext(null);
let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((l) => l.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (message, type = 'success') => {
      const id = nextId++;
      setToasts((l) => [...l.slice(-2), { id, message, type }]);
      setTimeout(() => dismiss(id), 3500);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ success: (m) => show(m, 'success'), error: (m) => show(m, 'error') }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'error' ? <AlertCircle size={18} /> : <CircleCheck size={18} />}
            <span>{t.message}</span>
            <button className="icon-btn" onClick={() => dismiss(t.id)} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
