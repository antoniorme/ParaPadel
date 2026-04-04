import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'dark' | 'white';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  pill?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:   'bg-[#575AF9] text-white hover:opacity-90 shadow-[0_4px_14px_rgba(87,90,249,0.3)]',
  secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  danger:    'bg-rose-600 text-white hover:bg-rose-700',
  ghost:     'bg-transparent text-[#575AF9] border-2 border-[#575AF9] hover:bg-indigo-50',
  dark:      'bg-slate-900 text-white hover:bg-slate-800',
  white:     'bg-white text-slate-900 hover:bg-slate-50 border border-slate-200',
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: 'px-4 py-2.5 text-sm min-h-[40px]',   // acciones secundarias, filtros
  md: 'px-6 py-3 text-sm min-h-[44px]',      // botón estándar (toque mínimo 44px)
  lg: 'px-8 py-4 text-base min-h-[52px]',    // CTA principal de página
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  pill = false,
  loading = false,
  icon,
  iconRight,
  children,
  disabled,
  className = '',
  ...props
}) => {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center gap-2 font-bold transition-all
        active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none
        ${pill ? 'rounded-full' : 'rounded-xl'}
        ${fullWidth ? 'w-full' : ''}
        ${VARIANT_STYLES[variant]}
        ${SIZE_STYLES[size]}
        ${className}
      `}
    >
      {loading ? (
        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
};
