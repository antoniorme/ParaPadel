import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
  success: () => {},
  error: () => {},
  warning: () => {},
});

const TOAST_STYLES: Record<ToastType, { bg: string; icon: React.ReactNode }> = {
  success: { bg: 'bg-slate-900 text-white',     icon: <CheckCircle size={16} className="text-emerald-400 shrink-0" /> },
  error:   { bg: 'bg-rose-600 text-white',       icon: <XCircle size={16} className="text-rose-200 shrink-0" /> },
  warning: { bg: 'bg-amber-500 text-white',      icon: <AlertTriangle size={16} className="text-amber-100 shrink-0" /> },
  info:    { bg: 'bg-indigo-600 text-white',     icon: <Info size={16} className="text-indigo-200 shrink-0" /> },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev.slice(-3), { id, type, message }]); // máximo 4 a la vez
    timers.current[id] = setTimeout(() => remove(id), 3500);
  }, [remove]);

  const success = useCallback((m: string) => toast(m, 'success'), [toast]);
  const error   = useCallback((m: string) => toast(m, 'error'),   [toast]);
  const warning = useCallback((m: string) => toast(m, 'warning'), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning }}>
      {children}
      {/* Portal de toasts — esquina inferior derecha */}
      <div className="fixed bottom-6 right-4 z-[999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => {
          const style = TOAST_STYLES[t.type];
          return (
            <div
              key={t.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-xs pointer-events-auto ${style.bg} animate-slide-up`}
            >
              {style.icon}
              <span className="flex-1">{t.message}</span>
              <button
                onClick={() => remove(t.id)}
                className="opacity-60 hover:opacity-100 transition-opacity shrink-0"
                aria-label="Cerrar"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
