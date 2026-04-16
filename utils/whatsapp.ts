import { Match, MatchParticipant } from '../types';

/**
 * Genera el texto de WhatsApp para compartir un partido.
 * Formato familiar para grupos de pádel.
 */
export function generateWhatsAppText(
  match: Match,
  participants: MatchParticipant[]
): string {
  const date = new Date(match.scheduled_at);
  const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const active = participants.filter(
    (p) => p.attendance_status === 'joined' || p.attendance_status === 'confirmed'
  );
  const spotsLeft = match.max_players - active.length;
  const shareUrl = `${window.location.origin}/m/${match.share_token}`;

  const lines: string[] = [];

  lines.push(`🎾 *PARTIDO ABIERTO*`);
  lines.push(`📅 ${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)} a las ${timeStr}`);
  if (match.level) lines.push(`📊 ${match.level}`);
  if (match.court) lines.push(`🏟 ${match.court}`);
  if (match.notes) lines.push(`📝 ${match.notes}`);
  lines.push('');

  // Slots: nombre o guión
  for (let i = 0; i < match.max_players; i++) {
    const p = active[i];
    if (p) {
      lines.push(p.player?.name || p.guest_name || '—');
    } else {
      lines.push('—');
    }
  }

  lines.push('');
  if (spotsLeft === 0) {
    lines.push('✅ Partido completo');
  } else if (spotsLeft === 1) {
    lines.push('Falta 1 jugador');
  } else {
    lines.push(`Faltan ${spotsLeft} jugadores`);
  }

  lines.push('');
  lines.push(`🔗 ${shareUrl}`);

  return lines.join('\n');
}

/** Abre WhatsApp con el texto prellenado */
export function openWhatsApp(text: string): void {
  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/?text=${encoded}`, '_blank');
}
