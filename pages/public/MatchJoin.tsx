import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/AuthContext';
import { generateWhatsAppText, openWhatsApp } from '../../utils/whatsapp';
import { Match, MatchParticipant } from '../../types';
import {
  Calendar, Clock, MapPin, Users, BarChart2, Share2,
  Loader2, CheckCircle2, ArrowLeft, User, Phone, MessageCircle,
  Lock, LogIn
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

const statusLabel: Record<string, { label: string; color: string }> = {
  open:        { label: 'Abierto',       color: '#10b981' },
  full:        { label: 'Completo',      color: '#f59e0b' },
  in_progress: { label: 'En juego',      color: '#575AF9' },
  finished:    { label: 'Finalizado',    color: '#64748b' },
  cancelled:   { label: 'Cancelado',     color: '#ef4444' },
};

// ── Component ─────────────────────────────────────────────────────────────────

const MatchJoin: React.FC = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [match, setMatch] = useState<Match | null>(null);
  const [participants, setParticipants] = useState<MatchParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Mi player record
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [alreadyJoined, setAlreadyJoined] = useState(false);

  // Join states
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  // ── Fetch match ─────────────────────────────────────────────
  const fetchMatch = useCallback(async () => {
    if (!shareToken) { setNotFound(true); setLoading(false); return; }

    const { data, error } = await supabase
      .from('free_matches')
      .select(`
        *,
        match_participants (
          id, slot_index, team, attendance_status, participant_type,
          user_id, player_id, guest_name,
          player:player_id ( id, name, nickname )
        )
      `)
      .eq('share_token', shareToken)
      .maybeSingle();

    if (error || !data) { setNotFound(true); setLoading(false); return; }

    setMatch(data as unknown as Match);
    const parts = (data.match_participants || []) as MatchParticipant[];
    setParticipants(parts.filter(p =>
      p.attendance_status === 'joined' || p.attendance_status === 'confirmed'
    ));
    setLoading(false);
  }, [shareToken]);

  useEffect(() => { fetchMatch(); }, [fetchMatch]);

  // ── My player id ─────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase.from('players').select('id').eq('profile_user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setMyPlayerId(data.id); });
  }, [user]);

  // ── Check if already joined ──────────────────────────────────
  useEffect(() => {
    if (!match) return;
    const isJoined = participants.some(
      (p) => (myPlayerId && p.player_id === myPlayerId) || (user && p.user_id === user.id)
    );
    setAlreadyJoined(isJoined);
  }, [participants, myPlayerId, user, match]);

  // ── Real-time updates ────────────────────────────────────────
  useEffect(() => {
    if (!match?.id) return;
    const channel = supabase
      .channel(`match-join-${match.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'match_participants',
        filter: `match_id=eq.${match.id}`,
      }, fetchMatch)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [match?.id, fetchMatch]);

  // ── Join as registered player ────────────────────────────────
  const handleJoinRegistered = async () => {
    if (!match || !user) return;
    setJoining(true);
    setJoinError(null);

    const nextSlot = participants.length + 1;

    const { error } = await supabase.from('match_participants').insert({
      match_id: match.id,
      participant_type: 'registered_player',
      user_id: user.id,
      player_id: myPlayerId || null,
      slot_index: nextSlot,
      joined_via: 'link',
      attendance_status: 'joined',
    });

    if (error) {
      setJoinError('No se pudo unir al partido. Inténtalo de nuevo.');
    } else {
      setJoined(true);
      await fetchMatch();
    }
    setJoining(false);
  };

  // ── Join as guest ────────────────────────────────────────────
  const handleJoinGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!match || !guestName.trim()) return;
    setJoining(true);
    setJoinError(null);

    const nextSlot = participants.length + 1;

    const { error } = await supabase.from('match_participants').insert({
      match_id: match.id,
      participant_type: 'claimable_guest',
      user_id: null,
      player_id: null,
      guest_name: guestName.trim(),
      guest_phone: guestPhone.trim() || null,
      slot_index: nextSlot,
      joined_via: 'link',
      attendance_status: 'joined',
    });

    if (error) {
      setJoinError('No se pudo unir. Inténtalo de nuevo.');
    } else {
      setJoined(true);
      await fetchMatch();
    }
    setJoining(false);
  };

  // ── Share ────────────────────────────────────────────────────
  const handleShare = () => {
    if (!match) return;
    const text = generateWhatsAppText(match, participants);
    openWhatsApp(text);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  // ── Render states ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  if (notFound || !match) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-4">🎾</div>
        <h1 className="text-xl font-black text-slate-900 mb-2">Partido no encontrado</h1>
        <p className="text-slate-400 text-sm mb-6">Este enlace no existe o ha expirado.</p>
        <button onClick={() => navigate('/')} className="text-sm font-bold text-indigo-600">
          Volver al inicio
        </button>
      </div>
    );
  }

  const spotsLeft = match.max_players - participants.length;
  const isFull = spotsLeft <= 0;
  const isFinished = match.status === 'finished' || match.status === 'cancelled';
  const st = statusLabel[match.status] || statusLabel['open'];

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-sm space-y-4">

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-slate-500 text-sm font-bold hover:text-slate-800"
        >
          <ArrowLeft size={16} /> Volver
        </button>

        {/* Match card */}
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden">

          {/* Header band */}
          <div
            className="px-6 py-5 text-white"
            style={{ background: 'linear-gradient(135deg, #2B2DBF, #575AF9)' }}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">
                  Partido Abierto
                </div>
                <div className="text-3xl font-black">{formatTime(match.scheduled_at)}</div>
                <div className="text-sm opacity-80 mt-0.5 capitalize">
                  {formatDate(match.scheduled_at)}
                </div>
              </div>
              <span
                className="px-3 py-1 rounded-full text-[11px] font-black uppercase"
                style={{ background: `${st.color}30`, color: st.color, border: `1px solid ${st.color}50` }}
              >
                {st.label}
              </span>
            </div>

            {/* Info row */}
            <div className="flex flex-wrap gap-3 mt-3">
              {match.level && (
                <span className="flex items-center gap-1 text-xs font-bold opacity-90">
                  <BarChart2 size={13} /> {match.level}
                </span>
              )}
              {match.court && (
                <span className="flex items-center gap-1 text-xs font-bold opacity-90">
                  <MapPin size={13} /> {match.court}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs font-bold opacity-90">
                <Users size={13} /> {participants.length}/{match.max_players} jugadores
              </span>
            </div>
          </div>

          {/* Players list */}
          <div className="px-6 py-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Jugadores</p>
            <div className="space-y-2">
              {Array.from({ length: match.max_players }).map((_, i) => {
                const p = participants[i];
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${
                        p ? 'text-white' : 'bg-slate-100 text-slate-300'
                      }`}
                      style={p ? { background: '#575AF9' } : {}}
                    >
                      {p ? (p.player?.name || p.guest_name || '?')[0].toUpperCase() : (i + 1)}
                    </div>
                    <span
                      className={`text-sm font-bold ${p ? 'text-slate-900' : 'text-slate-300 italic'}`}
                    >
                      {p
                        ? (p.player?.name || p.guest_name || 'Jugador')
                        : 'Libre'}
                    </span>
                    {p?.participant_type === 'claimable_guest' && (
                      <span className="ml-auto text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">
                        Invitado
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {match.notes && (
              <p className="mt-4 text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2">
                {match.notes}
              </p>
            )}
          </div>

          {/* Action zone */}
          <div className="px-6 pb-6 space-y-3">

            {/* Already joined */}
            {(alreadyJoined || joined) && !isFinished && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3">
                <CheckCircle2 size={22} className="text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-black text-emerald-800">¡Estás apuntado!</p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    Te esperamos en la pista.
                  </p>
                </div>
              </div>
            )}

            {/* Match finished */}
            {isFinished && (
              <div className="bg-slate-100 rounded-2xl p-4 text-center text-sm text-slate-500 font-bold">
                Este partido ya ha finalizado.
              </div>
            )}

            {/* Full */}
            {isFull && !isFinished && !alreadyJoined && !joined && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center">
                <p className="text-sm font-black text-amber-700">Partido completo</p>
                <p className="text-xs text-amber-600 mt-0.5">No quedan plazas disponibles.</p>
              </div>
            )}

            {/* Join — registered player */}
            {!isFull && !isFinished && !alreadyJoined && !joined && user && !showGuestForm && (
              <button
                onClick={handleJoinRegistered}
                disabled={joining}
                className="w-full py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:scale-95 transition-all disabled:opacity-60"
                style={{ background: '#575AF9' }}
              >
                {joining ? <Loader2 size={20} className="animate-spin" /> : <>Apuntarme</>}
              </button>
            )}

            {/* Join — not logged in */}
            {!isFull && !isFinished && !alreadyJoined && !joined && !user && !showGuestForm && (
              <div className="space-y-2">
                <button
                  onClick={() => navigate(`/auth?redirect=/m/${shareToken}`)}
                  className="w-full py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:scale-95 transition-all"
                  style={{ background: '#575AF9' }}
                >
                  <LogIn size={18} /> Entrar y apuntarme
                </button>
                <button
                  onClick={() => setShowGuestForm(true)}
                  className="w-full py-3 rounded-2xl font-bold text-slate-600 text-sm bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  Unirme como invitado
                </button>
              </div>
            )}

            {/* Guest form */}
            {!isFull && !isFinished && !joined && showGuestForm && (
              <form onSubmit={handleJoinGuest} className="space-y-3">
                <div className="relative">
                  <User size={16} className="absolute left-3 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Tu nombre *"
                    className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium focus:border-[#575AF9] outline-none"
                  />
                </div>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-3.5 text-slate-400" />
                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="Móvil (opcional)"
                    className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium focus:border-[#575AF9] outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowGuestForm(false)}
                    className="flex-1 py-3 rounded-xl font-bold text-slate-500 bg-slate-100 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={joining || !guestName.trim()}
                    className="flex-1 py-3 rounded-xl font-black text-white text-sm flex items-center justify-center gap-1 disabled:opacity-60"
                    style={{ background: '#575AF9' }}
                  >
                    {joining ? <Loader2 size={16} className="animate-spin" /> : 'Apuntarme'}
                  </button>
                </div>
              </form>
            )}

            {joinError && (
              <p className="text-rose-500 text-xs font-bold text-center">{joinError}</p>
            )}

            {/* WhatsApp share — always visible when match is open */}
            {!isFinished && (
              <button
                onClick={handleShare}
                className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 bg-emerald-500 text-white hover:bg-emerald-600 transition-all active:scale-95"
              >
                <MessageCircle size={18} /> Compartir por WhatsApp
              </button>
            )}

            {/* Copy link */}
            <button
              onClick={handleCopyLink}
              className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
            >
              <Share2 size={16} /> Copiar enlace
            </button>
          </div>
        </div>

        {/* Branding */}
        <div className="text-center">
          <div className="text-xs text-slate-400 font-medium mb-0.5">Organizado con</div>
          <div className="text-base font-black text-slate-700">
            Para<span style={{ color: '#575AF9' }}>Pádel</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default MatchJoin;
