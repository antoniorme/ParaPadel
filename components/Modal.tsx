import React, { useEffect } from 'react';
import { X } from 'lucide-react';

type ModalVariant = 'primary' | 'secondary' | 'danger';

interface ModalAction {
  label: string;
  onClick: () => void;
  variant?: ModalVariant;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  body?: string;
  icon?: React.ReactNode;
  /** 'danger' | 'success' | 'warning' | 'info' | 'brand' */
  iconColor?: 'danger' | 'success' | 'warning' | 'info' | 'brand';
  actions?: ModalAction[];
  children?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const ICON_STYLES: Record<string, string> = {
  danger:  'bg-rose-100 text-rose-600',
  success: 'bg-emerald-100 text-emerald-600',
  warning: 'bg-amber-100 text-amber-600',
  info:    'bg-blue-100 text-blue-600',
  brand:   'bg-indigo-100 text-indigo-600',
};

const BTN_STYLES: Record<ModalVariant, string> = {
  primary:   'bg-[#575AF9] text-white hover:opacity-90',
  secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  danger:    'bg-rose-600 text-white hover:bg-rose-700',
};

const SIZE_STYLES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  body,
  icon,
  iconColor = 'brand',
  actions = [],
  children,
  size = 'sm',
}) => {
  // Cierra con Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`bg-white rounded-2xl p-6 w-full ${SIZE_STYLES[size]} shadow-2xl animate-scale-in text-center`}>
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200 transition-colors"
          aria-label="Cerrar"
        >
          <X size={16} />
        </button>

        {/* Icono */}
        {icon && (
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${ICON_STYLES[iconColor]}`}>
            {icon}
          </div>
        )}

        {/* Título */}
        <h3 className="text-xl font-black text-slate-900 mb-2">{title}</h3>

        {/* Cuerpo */}
        {body && <p className="text-slate-500 text-sm mb-5 leading-relaxed">{body}</p>}

        {/* Contenido custom */}
        {children && <div className="mb-5">{children}</div>}

        {/* Acciones */}
        {actions.length > 0 && (
          <div className={`flex gap-3 ${actions.length === 1 ? 'justify-center' : ''}`}>
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${BTN_STYLES[action.variant ?? 'secondary']}`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
