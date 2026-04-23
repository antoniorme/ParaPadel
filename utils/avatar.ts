/**
 * Avatar utilities — sistema de avatares con inline styles.
 *
 * USA inline styles (no clases Tailwind dinámicas) para evitar que el
 * JIT de Tailwind purgue las clases en producción.
 */

export interface AvatarColor {
  bg: string;
  fg: string;
}

export const AVATAR_PALETTE: AvatarColor[] = [
  { bg: '#EEF0FF', fg: '#575AF9' },
  { bg: '#FFE8E1', fg: '#D9541A' },
  { bg: '#E7F8F1', fg: '#0E8F6A' },
  { bg: '#FFF4CC', fg: '#8A6B00' },
  { bg: '#F0E6FF', fg: '#6F3FD9' },
  { bg: '#DCEEFF', fg: '#1E63B8' },
  { bg: '#FFE4F1', fg: '#B8336A' },
  { bg: '#E3EEE6', fg: '#3F7A52' },
];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Devuelve el par { bg, fg } para un nombre dado */
export function avatarColor(name: string): AvatarColor {
  return AVATAR_PALETTE[hashCode(name || 'x') % AVATAR_PALETTE.length];
}

/** Devuelve 1-2 iniciales en mayúsculas */
export function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}
