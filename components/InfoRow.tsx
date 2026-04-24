import React from 'react';

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

export const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value }) => (
  <div className="flex items-center gap-2 text-sm">
    <span className="text-slate-400 shrink-0">{icon}</span>
    <span className="text-slate-400 text-xs w-20 shrink-0">{label}</span>
    <span className="font-bold text-slate-800 truncate">{value}</span>
  </div>
);
