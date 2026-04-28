import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PP } from '../../utils/theme';
import { avatarColor, initials } from '../../utils/avatar';
import { generateWhatsAppText, openWhatsApp } from '../../utils/whatsapp';
import { Loader2, CheckCircle2, User, MessageCircle, MapPin, Users, Calendar } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

// ── Component ─────────────────────────────────────────────────────────────────

const MatchJoinLite: React.FC = () => {
  const { shareToken } = useParams<{ shareToken: string }>();

  const [match, setMatch] = useState<any | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState('');
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch ────────────────────────────────────────────────────
  const fetchMatch = useCallback(async () => {
    if (!shareToken) { setNotFound(true); setLoading(false); return; }

    const { data } = await supabase
      .from('free_matches')
      .select(`*, match_participants (id, attendance_status, participant_type, guest_name, player:player_id (name))`)
      .eq('share_token', shareToken)
      .maybeSingle();

    if (!data) { setNotFound(true); setLoading(false); return; }

    setMatch(data);
    setParticipants(
      (data.match_participants || []).filter((p: any) =>
        p.attendance_status === 'joined' || p.attendance_status === 'confirmed'
      )
    );
    setLoading(false);
  }, [shareToken]);

  useEffect(() => { fetchMatch(); }, [fetchMatch]);

  // ── Join ─────────────────────────────────────────────────────
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!match || !name.trim()) return;
    setJoining(true);
    setError(null);

    const nextSlot = participants.length + 1;
    const willBeFull = nextSlot >= match.max_players;

    const { error: err } = await supabase.from('match_participants').insert({
      match_id: match.id,
      participant_type: 'claimable_guest',
      guest_name: name.trim(),
      slot_index: nextSlot,
      joined_via: 'link',
      attendance_status: 'joined',
    });

    if (err) {
      setError('No se pudo apuntar. Inténtalo de nuevo.');
    } else {
      if (willBeFull) {
        await supabase.from('free_matches').update({ status: 'full' }).eq('id', match.id);
      }
      setJoined(true);
      await fetchMatch();
    }
    setJoining(false);
  };

  // ── Share ─────────────────────────────────────────────────────
  const handleShare = () => {
    if (!match) return;
    openWhatsApp(generateWhatsAppText(match, participants));
  };

  // ── Render ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: PP.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} color={PP.primary} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (notFound || !match) {
    return (
      <div style={{ minHeight: '100vh', background: PP.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', fontFamily: PP.font }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🎾</div>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: PP.ink, marginBottom: 8 }}>Partido no encontrado</h1>
        <p style={{ fontSize: 14, color: PP.mute }}>Este enlace no existe o ha expirado.</p>
      </div>
    );
  }

  const spotsLeft = match.max_players - participants.length;
  const isFull = spotsLeft <= 0;
  const isFinished = match.status === 'finished' || match.status === 'cancelled';

  return (
    <div style={{ minHeight: '100vh', background: PP.bg, display: 'flex', justifyContent: 'center', padding: '24px 16px', fontFamily: PP.font }}>
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Match card */}
        <div style={{ background: PP.card, borderRadius: 24, border: `1px solid ${PP.hair}`, boxShadow: PP.shadowLg, overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ padding: '24px 20px 20px', borderBottom: `1px solid ${PP.hair}` }}>
            <div style={{ fontSize: 48, fontWeight: 900, color: PP.ink, letterSpacing: -2, lineHeight: 1, fontFeatureSettings: '"tnum"' }}>
              {fmtTime(match.scheduled_at)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <Calendar size={13} color={PP.muteSoft} />
              <span style={{ fontSize: 13, fontWeight: 600, color: PP.ink2, textTransform: 'capitalize' }}>
                {fmtDate(match.scheduled_at)}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
              {match.court && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <MapPin size={13} color={PP.muteSoft} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: PP.ink2 }}>{match.court}</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Users size={13} color={PP.muteSoft} />
                <span style={{ fontSize: 12, fontWeight: 700, color: isFull ? PP.mute : PP.primary }}>
                  {participants.length}/{match.max_players} jugadores
                </span>
              </div>
            </div>
          </div>

          {/* Slots */}
          <div style={{ padding: '16px 20px 20px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: PP.mute, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 }}>Jugadores</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: match.max_players }).map((_, i) => {
                const p = participants[i];
                const playerName = p ? (p.player?.name || p.guest_name || 'Jugador') : '';
                const ac = playerName ? avatarColor(playerName) : null;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
                    {p && ac ? (
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: ac.bg, color: ac.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                        {initials(playerName)}
                      </div>
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: PP.primaryTint, border: `2px dashed ${PP.primary}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <User size={14} color={PP.primary} />
                      </div>
                    )}
                    <span style={{ fontSize: 14, fontWeight: p ? 700 : 600, color: p ? PP.ink : PP.primary }}>
                      {p ? playerName : 'Plaza libre'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action zone */}
          <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Partido terminado */}
            {isFinished && (
              <div style={{ background: PP.hair, borderRadius: 16, padding: '14px 16px', textAlign: 'center', fontSize: 14, fontWeight: 700, color: PP.mute }}>
                Este partido ya ha finalizado.
              </div>
            )}

            {/* Completo */}
            {isFull && !isFinished && !joined && (
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 16, padding: '14px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 900, color: '#92400e' }}>Partido completo</p>
                <p style={{ fontSize: 12, color: '#b45309', marginTop: 4 }}>No quedan plazas disponibles.</p>
              </div>
            )}

            {/* Tras apuntarse */}
            {joined && (
              <>
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircle2 size={22} color="#10b981" style={{ flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 900, color: '#065f46' }}>¡Estás apuntado!</p>
                    <p style={{ fontSize: 12, color: '#059669', marginTop: 2 }}>Avisa al grupo por WhatsApp 👇</p>
                  </div>
                </div>
                <button
                  onClick={handleShare}
                  style={{ width: '100%', padding: '16px', borderRadius: 16, border: 0, background: '#25D366', color: '#fff', fontSize: 16, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: PP.font }}
                >
                  <MessageCircle size={22} /> Compartir en WhatsApp
                </button>
              </>
            )}

            {/* Formulario apuntarse */}
            {!isFull && !isFinished && !joined && (
              <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ position: 'relative' }}>
                  <User size={16} color={PP.muteSoft} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Tu nombre"
                    style={{ width: '100%', padding: '14px 14px 14px 40px', borderRadius: 14, border: `1.5px solid ${PP.hair}`, fontSize: 15, fontWeight: 600, color: PP.ink, fontFamily: PP.font, outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => (e.target.style.borderColor = PP.primary)}
                    onBlur={e => (e.target.style.borderColor = PP.hair)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={joining || !name.trim()}
                  style={{ width: '100%', padding: '16px', borderRadius: 16, border: 0, background: PP.primary, color: '#fff', fontSize: 16, fontWeight: 900, cursor: joining || !name.trim() ? 'not-allowed' : 'pointer', opacity: joining || !name.trim() ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: PP.font }}
                >
                  {joining ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : 'Apuntarme'}
                </button>
              </form>
            )}

            {error && (
              <p style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', textAlign: 'center' }}>{error}</p>
            )}

            {/* Compartir (antes de apuntarse) */}
            {!isFinished && !joined && (
              <button
                onClick={handleShare}
                style={{ width: '100%', padding: '13px', borderRadius: 14, border: 0, background: '#dcfce7', color: '#15803d', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: PP.font }}
              >
                <MessageCircle size={16} /> Compartir partido
              </button>
            )}
          </div>
        </div>

        {/* Branding */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: PP.mute, marginBottom: 2 }}>Organizado con</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: PP.ink, fontFamily: PP.font }}>
            Para<span style={{ color: PP.primary }}>Pádel</span>
          </div>
        </div>

      </div>
      {/* Spinner keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default MatchJoinLite;
