import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  body?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Para usar sobre fondo oscuro (contexto Mini/Liga) */
  dark?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  body,
  action,
  dark = false,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
        dark ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-300'
      }`}>
        {icon}
      </div>
      <h3 className={`text-lg font-black mb-2 ${dark ? 'text-white' : 'text-slate-700'}`}>
        {title}
      </h3>
      {body && (
        <p className={`text-sm max-w-xs leading-relaxed mb-6 ${dark ? 'text-slate-400' : 'text-slate-400'}`}>
          {body}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 bg-[#575AF9] text-white rounded-xl font-bold text-sm shadow-lg hover:opacity-90 active:scale-95 transition-all"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
