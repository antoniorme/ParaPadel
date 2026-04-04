import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'neutral' | 'pending';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

const STYLES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger:  'bg-rose-100 text-rose-700',
  info:    'bg-blue-100 text-blue-700',
  brand:   'bg-indigo-100 text-[#575AF9]',
  neutral: 'bg-slate-100 text-slate-600',
  pending: 'bg-amber-100 text-amber-600',
};

const DOT_COLORS: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger:  'bg-rose-500',
  info:    'bg-blue-500',
  brand:   'bg-[#575AF9]',
  neutral: 'bg-slate-400',
  pending: 'bg-amber-400',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  dot = false,
  className = '',
}) => {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${STYLES[variant]} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_COLORS[variant]}`} />}
      {children}
    </span>
  );
};
