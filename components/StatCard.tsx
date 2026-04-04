import React from 'react';

interface StatCardProps {
  value: string | number;
  label: string;
  delta?: string;
  deltaType?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  /** Color del valor principal */
  valueColor?: 'default' | 'brand' | 'danger' | 'success' | 'warning';
  onClick?: () => void;
  className?: string;
}

const VALUE_COLORS = {
  default: 'text-slate-900',
  brand:   'text-[#575AF9]',
  danger:  'text-rose-600',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
};

const DELTA_COLORS = {
  up:      'text-emerald-600',
  down:    'text-rose-500',
  neutral: 'text-slate-400',
};

export const StatCard: React.FC<StatCardProps> = ({
  value,
  label,
  delta,
  deltaType = 'neutral',
  icon,
  valueColor = 'default',
  onClick,
  className = '',
}) => {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      onClick={onClick}
      className={`bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-left w-full transition-all ${onClick ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer active:scale-[0.98]' : ''} ${className}`}
    >
      {icon && (
        <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 mb-3">
          {icon}
        </div>
      )}
      <div className={`text-3xl font-black tracking-tight leading-none ${VALUE_COLORS[valueColor]}`}>
        {value}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1.5">
        {label}
      </div>
      {delta && (
        <div className={`text-xs font-bold mt-2 ${DELTA_COLORS[deltaType]}`}>
          {delta}
        </div>
      )}
    </Tag>
  );
};
