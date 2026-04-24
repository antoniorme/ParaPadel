import React from 'react';

interface AvatarProps {
  name: string;
  size?: number;   // px, default 32
  radius?: number; // border-radius px, default 8
}

const COLORS = ['#4F46E5', '#7C3AED', '#DB2777', '#059669', '#D97706', '#DC2626', '#0284C7', '#0F766E'];

const getColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
};

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

export const Avatar: React.FC<AvatarProps> = ({ name, size = 32, radius = 8 }) => (
  <div
    style={{
      width: size, height: size, borderRadius: radius,
      background: getColor(name),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 800, fontSize: Math.round(size * 0.38),
      flexShrink: 0, userSelect: 'none',
    }}
  >
    {initials(name)}
  </div>
);
