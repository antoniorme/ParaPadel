import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/AuthContext';
import { generateWhatsAppText, generateClubMatchesText, openWhatsApp } from '../../utils/whatsapp';
import { Match, MatchParticipant } from '../../types';
import {
  MapPin, Users, BarChart2, Share2,
  Loader2, CheckCircle2, ArrowLeft, User, Phone, MessageCircle,
  LogIn, UserCheck, PlusCircle, X, Flag, ClipboardList
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

  // Host: añadir placeholder
  const [isHost, setIsHost] = useState(false);
  const [addingSlot, setAddingSlot] = useState<number | null>(null);
  const [placeholderName, setPlaceholderName] = useState('');
  const [savingPlaceholder, setSavingPlaceholder] = useState(false);

  // Reclamación de invitado
  const [claiming, setClaiming] = useState<string | null>(null);

  // Resultado
  const [result, setResult] = useState<any | null>(null);
  const [showResultForm, setShowResultForm] = useState(false);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [teamAssignments, setTeamAssignments] = useState<Record<string, 'A' | 'B'>>({});
  const [submittingResult, setSubmittingResult] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);

  // Disputa
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [myDispute, setMyDispute] = useState(false);

  // ── Fetch match ─────────────────────────────────────────────
  const fetchMatch = useCallback(async () => {
    if (!shareToken) { setNotFound(true); setLoading(false); return; }

    const { data, error } = await supabase
      .from('free_matches')
      .select(`
        *,
        match_participants (
          id, slot_index, team, attendance_status, participant_type,
          user_id, player_id, guest_name, claimed_user_id,
          player:player_id ( id, name, nickname )
        ),
        match_results!match_id (
          id, team_a_score, team_b_score, status, submitted_at,
          match_result_disputes!match_result_id (
            id, raised_by_user_id, reason, status
          )
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
    setResult((data as any).match_results?.[0] || null);
    setLoading(false);
  }, [shareToken]);

  useEffect(() => { fetchMatch(); }, [fetchMatch]);

  // ── My player id ─────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase.from('players').select('id').eq('profile_user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setMyPlayerId(data.id); });
  }, [user]);

  // ── Pre-asignar equipos al abrir el formulario de resultado ──
  useEffect(() => {
    if (!showResultForm || participants.length === 0) return;
    const half = Math.ceil(participants.length / 2);
    const init: Record<string, 'A' | 'B'> = {};
    participants.forEach((p, i) => { init[p.id] = i < half ? 'A' : 'B'; });
    setTeamAssignments(init);
  }, [showResultForm]);

  // ── Detect host ──────────────────────────────────────────────
  useEffect(() => {
    if (user && match) {
      setIsHost(
        user.id === match.created_by_user_id ||
        user.id === (match as any).host_user_id
      );
    }
  }, [user, match]);

  // ── Auto-final: si han pasado 24h sin disputa ────────────────
  useEffect(() => {
    if (!result || result.status !== 'pending_confirmation' || !match) return;
    const elapsed = (Date.now() - new Date(result.submitted_at).getTime()) / (1000 * 60 * 60);
    if (elapsed < 24) return;
    Promise.all([
      supabase.from('match_results').update({ status: 'final' }).eq('id', result.id),
      supabase.from('free_matches').update({ result_status: 'final', status: 'finished' }).eq('id', match.id),
    ]).then(() => fetchMatch());
  }, [result, match]);

  // ── ¿Ya disputé este resultado? ──────────────────────────────
  useEffect(() => {
    if (!result || !user) return;
    const disputes: any[] = result.match_result_disputes || [];
    setMyDispute(disputes.some((d: any) => d.raised_by_user_id === user.id));
  }, [result, user]);

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

  // ── Submit result (host) ─────────────────────────────────────
  const handleSubmitResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!match || !user) return;
    const a = parseInt(scoreA);
    const b = parseInt(scoreB);
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0) {
      setResultError('Introduce un marcador válido.');
      return;
    }
    setSubmittingResult(true);
    setResultError(null);

    // 1. Guardar asignaciones de equipo
    const teamUpdates = Object.entries(teamAssignments).map(([id, team]) =>
      supabase.from('match_participants').update({ team }).eq('id', id)
    );
    await Promise.all(teamUpdates);

    // 2. Insertar resultado + marcar partido como finished
    const [r1] = await Promise.all([
      supabase.from('match_results').insert({
        match_id: match.id,
        submitted_by_user_id: user.id,
        team_a_score: a,
        team_b_score: b,
        status: 'pending_confirmation',
        rating_impact_mode: 'full',
      }),
      supabase.from('free_matches').update({
        result_status: 'pending_confirmation',
        status: 'finished',
      }).eq('id', match.id),
    ]);

    if (r1.error) {
      setResultError('Error al guardar el resultado.');
    } else {
      setShowResultForm(false);
      setScoreA('');
      setScoreB('');
      await fetchMatch();
    }
    setSubmittingResult(false);
  };

  // ── Dispute result (registered participant) ──────────────────
  const handleDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!result || !user) return;
    setSubmittingDispute(true);
    const { error } = await supabase.from('match_result_disputes').insert({
      match_result_id: result.id,
      raised_by_user_id: user.id,
      reason: disputeReason.trim() || null,
      status: 'open',
    });
    if (!error) {
      setShowDisputeForm(false);
      setMyDispute(true);
    }
    setSubmittingDispute(false);
  };

  // ── Add placeholder (host only) ──────────────────────────────
  const handleAddPlaceholder = async (slotIndex: number) => {
    if (!match || !placeholderName.trim()) return;
    setSavingPlaceholder(true);
    const { error } = await supabase.from('match_participants').insert({
      match_id: match.id,
      participant_type: 'placeholder_guest',
      user_id: null,
      player_id: null,
      guest_name: placeholderName.trim(),
      slot_index: slotIndex,
      joined_via: 'manual',
      attendance_status: 'joined',
      is_rating_eligible: false,
    });
    if (!error) {
      setAddingSlot(null);
      setPlaceholderName('');
      await fetchMatch();
    }
    setSavingPlaceholder(false);
  };

  // ── Claim guest entry ────────────────────────────────────────
  const handleClaim = async (participantId: string) => {
    if (!user) return;
    setClaiming(participantId);
    const { error } = await supabase
      .from('match_participants')
      .update({
        claimed_user_id: user.id,
        user_id: user.id,
        player_id: myPlayerId || null,
        participant_type: 'registered_player',
        is_rating_eligible: true,
      })
      .eq('id', participantId);
    if (!error) {
      setAlreadyJoined(true);
      await fetchMatch();
    }
    setClaiming(null);
  };

  // ── Share ────────────────────────────────────────────────────
  const handleShare = async () => {
    if (!match) return;
    const clubId = (match as any).club_id;

    // If this match belongs to a club, share the full club matches page
    if (clubId) {
      const [{ data: clubData }, { data: matchData }] = await Promise.all([
        supabase.from('clubs').select('name').eq('id', clubId).maybeSingle(),
        supabase
          .from('free_matches')
          .select('id, scheduled_at, level, court, max_players, match_participants!match_id(id, attendance_status)')
          .eq('club_id', clubId)
          .eq('status', 'open')
          .gte('scheduled_at', new Date().toISOString())
          .order('scheduled_at', { ascending: true }),
      ]);

      const clubName = clubData?.name || '';
      const openMatches = (matchData || []).map((m: any) => ({
        scheduled_at: m.scheduled_at,
        level: m.level,
        court: m.court,
        max_players: m.max_players,
        spots_taken: (m.match_participants || []).filter(
          (p: any) => ['joined', 'confirmed'].includes(p.attendance_status)
        ).length,
      }));

      const text = generateClubMatchesText(clubName, clubId, openMatches);
      openWhatsApp(text);
      return;
    }

    // Fallback: single match share
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
                const slotIndex = i + 1;
                const isMe = p && (
                  (myPlayerId && p.player_id === myPlayerId) ||
                  (user && (p.user_id === user.id || p.claimed_user_id === user.id))
                );
                const isClaimable = p &&
                  p.participant_type === 'claimable_guest' &&
                  !p.claimed_user_id &&
                  user &&
                  !alreadyJoined && !joined;

                // Inline form for host adding placeholder
                if (addingSlot === slotIndex) {
                  return (
                    <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                      <input
                        autoFocus
                        type="text"
                        value={placeholderName}
                        onChange={e => setPlaceholderName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddPlaceholder(slotIndex)}
                        placeholder="Nombre del jugador"
                        className="flex-1 text-sm bg-transparent outline-none text-slate-900 font-medium"
                      />
                      <button
                        onClick={() => handleAddPlaceholder(slotIndex)}
                        disabled={savingPlaceholder || !placeholderName.trim()}
                        className="text-[11px] font-black text-white px-2 py-1 rounded-lg disabled:opacity-40"
                        style={{ background: '#575AF9' }}
                      >
                        {savingPlaceholder ? <Loader2 size={12} className="animate-spin" /> : 'OK'}
                      </button>
                      <button onClick={() => setAddingSlot(null)} className="text-slate-400 hover:text-slate-600">
                        <X size={14} />
                      </button>
                    </div>
                  );
                }

                return (
                  <div key={i} className="flex items-center gap-3 min-h-[36px]">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                        p ? 'text-white' : 'bg-slate-100 text-slate-300'
                      }`}
                      style={p ? { background: p.participant_type === 'placeholder_guest' ? '#94a3b8' : '#575AF9' } : {}}
                    >
                      {p ? (p.player?.name || p.guest_name || '?')[0].toUpperCase() : slotIndex}
                    </div>
                    <span className={`text-sm font-bold flex-1 ${p ? 'text-slate-900' : 'text-slate-300 italic'}`}>
                      {p ? (p.player?.name || p.guest_name || 'Jugador') : 'Libre'}
                    </span>

                    {/* Badges */}
                    {isMe && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        Tú
                      </span>
                    )}
                    {p?.participant_type === 'claimable_guest' && !p.claimed_user_id && !isMe && (
                      <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">
                        Invitado
                      </span>
                    )}
                    {p?.participant_type === 'placeholder_guest' && !isMe && (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        Reservado
                      </span>
                    )}

                    {/* Claim button */}
                    {isClaimable && (
                      <button
                        onClick={() => handleClaim(p.id)}
                        disabled={!!claiming}
                        className="flex items-center gap-1 text-[11px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-all disabled:opacity-60"
                      >
                        {claiming === p.id
                          ? <Loader2 size={11} className="animate-spin" />
                          : <><UserCheck size={11} /> Soy yo</>
                        }
                      </button>
                    )}

                    {/* Add placeholder button (host, empty slot, match open) */}
                    {!p && isHost && !isFull && !isFinished && (
                      <button
                        onClick={() => { setAddingSlot(slotIndex); setPlaceholderName(''); }}
                        className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-all"
                      >
                        <PlusCircle size={14} /> Añadir
                      </button>
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

          {/* ── Resultado ────────────────────────────────────── */}
          {result && (() => {
            const isParticipant = participants.some(p =>
              p.participant_type === 'registered_player' &&
              ((myPlayerId && p.player_id === myPlayerId) ||
               (user && (p.user_id === user.id || (p as any).claimed_user_id === user.id)))
            );
            const statusMeta = result.status === 'final'
              ? { label: 'Confirmado', cls: 'bg-emerald-50 text-emerald-600' }
              : result.status === 'disputed'
              ? { label: 'Disputado', cls: 'bg-rose-50 text-rose-500' }
              : { label: 'Pendiente 24h', cls: 'bg-amber-50 text-amber-600' };

            return (
              <div className="px-6 pb-4">
                <div className="border border-slate-100 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <ClipboardList size={13} /> Resultado
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${statusMeta.cls}`}>
                      {statusMeta.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-8 py-2">
                    <div className="text-center">
                      <div className="text-[10px] text-slate-400 font-bold mb-1">Equipo A</div>
                      <div className="text-5xl font-black text-slate-900">{result.team_a_score}</div>
                    </div>
                    <div className="text-slate-200 font-black text-3xl">—</div>
                    <div className="text-center">
                      <div className="text-[10px] text-slate-400 font-bold mb-1">Equipo B</div>
                      <div className="text-5xl font-black text-slate-900">{result.team_b_score}</div>
                    </div>
                  </div>

                  {/* Dispute */}
                  {result.status === 'pending_confirmation' && isParticipant && !myDispute && !showDisputeForm && (
                    <button
                      onClick={() => setShowDisputeForm(true)}
                      className="mt-3 w-full py-2 rounded-xl text-xs font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Flag size={13} /> Disputar resultado
                    </button>
                  )}

                  {showDisputeForm && (
                    <form onSubmit={handleDispute} className="mt-3 space-y-2">
                      <textarea
                        value={disputeReason}
                        onChange={e => setDisputeReason(e.target.value)}
                        placeholder="Motivo de la disputa (opcional)"
                        rows={2}
                        className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-rose-300 resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowDisputeForm(false)}
                          className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-500 bg-slate-100"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={submittingDispute}
                          className="flex-1 py-2 rounded-xl text-xs font-black text-white bg-rose-500 disabled:opacity-60 flex items-center justify-center"
                        >
                          {submittingDispute ? <Loader2 size={13} className="animate-spin" /> : 'Enviar disputa'}
                        </button>
                      </div>
                    </form>
                  )}

                  {myDispute && (
                    <p className="mt-3 text-center text-xs font-bold text-rose-500">
                      Disputa enviada — el administrador la revisará
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── Registrar resultado (host, sin resultado aún) ─── */}
          {!result && isHost && participants.length > 0 && !isFinished && (
            <div className="px-6 pb-4">
              {!showResultForm ? (
                <button
                  onClick={() => setShowResultForm(true)}
                  className="w-full py-3 rounded-2xl text-sm font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center gap-2 transition-all"
                >
                  <ClipboardList size={16} /> Registrar resultado
                </button>
              ) : (
                <form onSubmit={handleSubmitResult} className="space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Marcador final</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="text-[10px] text-slate-400 font-bold mb-1 text-center">Equipo A</div>
                      <input
                        type="number" min="0" max="99"
                        value={scoreA}
                        onChange={e => setScoreA(e.target.value)}
                        placeholder="0"
                        required
                        className="w-full text-center text-2xl font-black rounded-xl border border-slate-200 py-3 outline-none focus:border-[#575AF9]"
                      />
                    </div>
                    <div className="text-slate-300 font-black text-xl pt-4">–</div>
                    <div className="flex-1">
                      <div className="text-[10px] text-slate-400 font-bold mb-1 text-center">Equipo B</div>
                      <input
                        type="number" min="0" max="99"
                        value={scoreB}
                        onChange={e => setScoreB(e.target.value)}
                        placeholder="0"
                        required
                        className="w-full text-center text-2xl font-black rounded-xl border border-slate-200 py-3 outline-none focus:border-[#575AF9]"
                      />
                    </div>
                  </div>
                  {/* Team assignment */}
                  {participants.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Equipos</p>
                      <div className="space-y-1.5">
                        {participants.map(p => {
                          const name = p.player?.name || p.guest_name || 'Jugador';
                          const team = teamAssignments[p.id] || 'A';
                          return (
                            <div key={p.id} className="flex items-center gap-2">
                              <span className="flex-1 text-sm font-medium text-slate-700 truncate">{name}</span>
                              <div className="flex rounded-lg overflow-hidden border border-slate-200 text-xs font-black">
                                <button
                                  type="button"
                                  onClick={() => setTeamAssignments(t => ({ ...t, [p.id]: 'A' }))}
                                  className={`px-3 py-1.5 transition-all ${team === 'A' ? 'text-white' : 'text-slate-400 bg-white'}`}
                                  style={team === 'A' ? { background: '#575AF9' } : {}}
                                >A</button>
                                <button
                                  type="button"
                                  onClick={() => setTeamAssignments(t => ({ ...t, [p.id]: 'B' }))}
                                  className={`px-3 py-1.5 transition-all ${team === 'B' ? 'text-white' : 'text-slate-400 bg-white'}`}
                                  style={team === 'B' ? { background: '#10b981' } : {}}
                                >B</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {resultError && <p className="text-xs text-rose-500 font-bold">{resultError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowResultForm(false); setResultError(null); }}
                      className="flex-1 py-3 rounded-xl font-bold text-slate-500 bg-slate-100 text-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submittingResult}
                      className="flex-1 py-3 rounded-xl font-black text-white text-sm flex items-center justify-center gap-1 disabled:opacity-60"
                      style={{ background: '#575AF9' }}
                    >
                      {submittingResult ? <Loader2 size={16} className="animate-spin" /> : 'Guardar'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

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

            {/* Ver más partidos del club */}
            {(match as any).club_id && (
              <button
                onClick={() => navigate(`/club/${(match as any).club_id}/partidos`)}
                className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all"
              >
                Ver todos los partidos del club
              </button>
            )}

            {/* WhatsApp share — always visible when match is open */}
            {!isFinished && (
              <button
                onClick={handleShare}
                className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 bg-emerald-500 text-white hover:bg-emerald-600 transition-all active:scale-95"
              >
                <MessageCircle size={18} /> Compartir todos los partidos
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
