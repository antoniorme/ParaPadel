import React, { useState, useEffect, useCallback } from 'react';
import { useTournament } from '../store/TournamentContext';
import { useHistory } from '../store/HistoryContext';
import { useToast } from '../components/Toast';
import { Modal, Button, EmptyState, CreateMatchModal } from '../components';
import type { CreateMatchPrefill } from '../components';
import { THEME, PP } from '../utils/theme';
import { calculateMatchDelta } from '../utils/Elo';
import { generateClubMatchesText, openWhatsApp } from '../utils/whatsapp';
import { supabase } from '../lib/supabase';
import { Player, Match, MatchParticipant } from '../types';
import {
  Swords, Plus, CheckCircle2, Clock, Trash2,
  ChevronDown, ChevronUp, Zap, MessageCircle,
  LayoutGrid, ChevronRight, Flag, ShieldCheck, Sun, Sunset, X,
} from 'lucide-react';

// ── HELPERS CALENDARIO ────────────────────────────────────────────────────────

const timeToMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const minsToTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toLocalDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

interface FreeSlot { courtNumber: number; courtName: string; startTime: string; }
interface CourtSummary { courtNumber: number; courtName: string; morning: FreeSlot[]; afternoon: FreeSlot[]; }

// ── HELPERS ───────────────────────────────────────────────────────────────────

const getAvatarColor = (name: string): string => {
  const colors = ['#4F46E5','#7C3AED','#DB2777','#059669','#D97706','#DC2626','#0284C7','#0F766E'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const fmtTime = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

const fmtDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return { day: d.getDate(), month: d.toLocaleDateString('es-ES', { month: 'short' }) };
  } catch { return { day: '—', month: '' }; }
};

// ── COMPONENT ─────────────────────────────────────────────────────────────────

const MatchManager: React.FC = () => {
  const { state, formatPlayerName, addPlayerToDB } = useTournament();
  const { clubData } = useHistory();
  const { success, error: toastError } = useToast();

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'finished'>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tableReady, setTableReady] = useState(true);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);

  // Score modal
  const [scoreMatch, setScoreMatch] = useState<Match | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [savingScore, setSavingScore] = useState(false);

  // Delete modal
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Dispute resolution
  const [resolvingDispute, setResolvingDispute] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const allPlayers: Player[] = state.players;
  const clubId = clubData?.id || state.players[0]?.user_id;

  // Free slots por fecha (si courts_enabled)
  const [courtSummaries, setCourtSummaries] = useState<CourtSummary[]>([]);
  const [courtDetail, setCourtDetail] = useState<CourtSummary | null>(null);
  const [slotsDate, setSlotsDate] = useState(toLocalDateStr(new Date()));

  const [createPrefill, setCreatePrefill] = useState<CreateMatchPrefill | undefined>(undefined);

  const loadTodaySlots = useCallback(async () => {
    if (!clubId || !clubData.courts_enabled) return;
    const dateObj = new Date(`${slotsDate}T00:00:00`);
    const todayStart = new Date(dateObj); todayStart.setHours(0,0,0,0);
    const todayEnd   = new Date(dateObj); todayEnd.setHours(23,59,59,999);

    const [{ data: courts }, { data: reservations }, { data: blocks }] = await Promise.all([
      supabase.from('court_availability').select('court_number, court_name, open_time, close_time, active_days, is_active')
        .eq('club_id', clubId).eq('is_active', true).order('sort_order'),
      supabase.from('court_reservations').select('court_number, start_at, end_at, status')
        .eq('club_id', clubId).not('status', 'in', '("rejected","cancelled")')
        .gte('start_at', todayStart.toISOString()).lte('start_at', todayEnd.toISOString()),
      supabase.from('court_blocks').select('court_number, start_at, end_at')
        .eq('club_id', clubId)
        .gte('start_at', todayStart.toISOString()).lte('start_at', todayEnd.toISOString()),
    ]);

    if (!courts) return;
    const todayDow = new Date(`${slotsDate}T12:00:00`).getDay();
    const isToday = slotsDate === toLocalDateStr(new Date());
    const nowMins = isToday ? new Date().getHours() * 60 + new Date().getMinutes() : 0;

    const summaryMap = new Map<number, CourtSummary>();

    courts.forEach((c: any) => {
      if (!c.active_days.includes(todayDow)) return;
      summaryMap.set(c.court_number, { courtNumber: c.court_number, courtName: c.court_name, morning: [], afternoon: [] });
      const open = timeToMins(c.open_time);
      const close = timeToMins(c.close_time);
      const occupied = [
        ...(reservations || []).filter((r: any) => r.court_number === c.court_number)
          .map((r: any) => ({ start: timeToMins(r.start_at.slice(11,16)), end: timeToMins(r.end_at.slice(11,16)) })),
        ...(blocks || []).filter((b: any) => b.court_number === c.court_number)
          .map((b: any) => ({ start: timeToMins(b.start_at.slice(11,16)), end: timeToMins(b.end_at.slice(11,16)) })),
      ];
      const isOccupied = (s: number, e: number) => occupied.some(r => s < r.end && e > r.start);
      let t = open;
      while (t + 90 <= close) {
        if (t >= nowMins && !isOccupied(t, t + 90)) {
          const slot: FreeSlot = { courtNumber: c.court_number, courtName: c.court_name, startTime: minsToTime(t) };
          const entry = summaryMap.get(c.court_number)!;
          if (t < 14 * 60) entry.morning.push(slot); else entry.afternoon.push(slot);
        }
        t += 30;
      }
    });

    setCourtSummaries(Array.from(summaryMap.values()));
  }, [clubId, clubData.courts_enabled, slotsDate]);

  // ── LOAD ────────────────────────────────────────────────────

  const loadMatches = useCallback(async () => {
    if (!clubId) { setLoading(false); return; }
    setLoading(true);

    const { data, error } = await supabase
      .from('free_matches')
      .select(`
        *,
        match_participants (
          id, player_id, team, slot_index, attendance_status, participant_type,
          guest_name,
          player:player_id (
            id, name, nickname, global_rating, manual_rating,
            category_ratings, main_category, categories
          )
        ),
        match_results (
          id, team_a_score, team_b_score, status, rating_impact_mode,
          match_result_disputes ( id, raised_by_user_id, reason, status )
        )
      `)
      .eq('club_id', clubId)
      .order('scheduled_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') {
        setTableReady(false);
        setMatches([]);
      } else {
        toastError('Error al cargar partidos');
      }
    } else {
      setTableReady(true);
      setMatches((data || []) as Match[]);
    }
    setLoading(false);
  }, [clubId]);

  useEffect(() => { loadMatches(); }, [loadMatches]);
  useEffect(() => { loadTodaySlots(); }, [loadTodaySlots]);


  // ── CLUB RATING HELPER ──────────────────────────────────────

  const applyClubRating = async (m: Match, teamAScore: number, teamBScore: number) => {
    const parts = (m.match_participants || []) as MatchParticipant[];
    const teamA = parts.filter(p => p.team === 'A' && p.player).map(p => p.player as Player);
    const teamB = parts.filter(p => p.team === 'B' && p.player).map(p => p.player as Player);
    if (teamA.length === 0 || teamB.length === 0) return;

    const clubElo = (p: Player) => p.club_rating ?? 1200;
    const eloA = teamA.length === 2
      ? (clubElo(teamA[0]) + clubElo(teamA[1])) / 2
      : clubElo(teamA[0]);
    const eloB = teamB.length === 2
      ? (clubElo(teamB[0]) + clubElo(teamB[1])) / 2
      : clubElo(teamB[0]);

    const delta = calculateMatchDelta(eloA, eloB, teamAScore, teamBScore);
    const allPlayers = [
      ...teamA.map(p => ({ p, d: delta })),
      ...teamB.map(p => ({ p, d: -delta })),
    ];

    await Promise.all(allPlayers.map(({ p, d }) =>
      supabase.from('players').update({
        club_rating: Math.max(100, Math.round(clubElo(p) + d)),
        club_confidence: (p.club_confidence ?? 0) + 1,
      }).eq('id', p.id)
    ));

    await supabase.from('free_matches').update({ elo_processed: true }).eq('id', m.id);
  };

  // ── SAVE SCORE + ELO ────────────────────────────────────────

  const handleSaveScore = async () => {
    if (!scoreMatch) return;
    const a = parseInt(scoreA);
    const b = parseInt(scoreB);
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0) { toastError('Resultado inválido'); return; }
    if (a === b) { toastError('El resultado no puede ser empate'); return; }

    setSavingScore(true);

    // 1. Insertar resultado
    const { error: resErr } = await supabase
      .from('match_results')
      .insert({
        match_id: scoreMatch.id,
        team_a_score: a,
        team_b_score: b,
        status: 'final',
        rating_impact_mode: 'full',
      });

    if (resErr) { toastError('Error al guardar resultado'); setSavingScore(false); return; }

    // 2. Actualizar estado del partido
    await supabase
      .from('free_matches')
      .update({ status: 'finished', result_status: 'final' })
      .eq('id', scoreMatch.id);

    // 3. Procesar club_rating si no está procesado
    if (!scoreMatch.elo_processed) {
      await applyClubRating(scoreMatch, a, b);
    }

    setSavingScore(false);
    success('Resultado guardado · ELO actualizado');
    setScoreMatch(null);
    setScoreA(''); setScoreB('');
    loadMatches();
  };

  // ── DELETE ──────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const [{ error }] = await Promise.all([
      supabase.from('free_matches').delete().eq('id', deleteId),
      supabase.from('court_reservations').delete().eq('club_id', clubId).eq('notes', `match:${deleteId}`),
    ]);
    setDeleting(false);
    if (error) { toastError('Error al eliminar'); return; }
    success('Partido eliminado');
    setDeleteId(null);
    loadMatches();
    loadTodaySlots();
  };

  // ── RESOLVE DISPUTE ─────────────────────────────────────────

  const handleResolveDispute = async () => {
    if (!resolvingDispute) return;
    setResolving(true);

    const [{ error: resErr }, { error: dispErr }] = await Promise.all([
      supabase.from('match_results').update({ status: 'final' }).eq('id', resolvingDispute),
      supabase.from('match_result_disputes').update({ status: 'resolved' }).eq('match_result_id', resolvingDispute),
    ]);

    if (resErr || dispErr) {
      toastError('Error al resolver la disputa');
    } else {
      // Apply club_rating for the resolved match
      const m = matches.find(match =>
        (match.match_results || []).some((r: any) => r.id === resolvingDispute)
      );
      if (m && !m.elo_processed) {
        const result = (m.match_results || []).find((r: any) => r.id === resolvingDispute);
        if (result) {
          await applyClubRating(m, result.team_a_score, result.team_b_score);
        }
      }
      success('Resultado finalizado · club_rating actualizado');
      setResolvingDispute(null);
      loadMatches();
    }
    setResolving(false);
  };

  // ── HELPERS UI ──────────────────────────────────────────────

  const getTeamPlayers = (m: Match, team: 'A' | 'B'): Player[] =>
    (m.match_participants || [])
      .filter((p: any) => p.team === team && p.player && p.attendance_status !== 'cancelled')
      .sort((a, b) => (a.slot_index || 0) - (b.slot_index || 0))
      .map((p: any) => p.player as Player);

  // Nombres para mostrar: incluye jugadores registrados E invitados
  const teamNames = (m: Match, team: 'A' | 'B'): string[] =>
    (m.match_participants || [])
      .filter((p: any) => p.team === team && p.attendance_status !== 'cancelled')
      .sort((a: any, b: any) => (a.slot_index || 0) - (b.slot_index || 0))
      .map((p: any) => {
        if (p.player) return p.player.nickname ? `"${p.player.nickname}"` : p.player.name.split(' ')[0];
        if (p.guest_name) return p.guest_name.split(' ')[0];
        return '?';
      });

  const pairLabel = (players: Player[]) => {
    if (players.length === 0) return '—';
    return players.map(p => p.nickname ? `"${p.nickname}"` : p.name.split(' ')[0]).join(' & ');
  };

  const pairLabelNames = (names: string[]) => names.length === 0 ? '—' : names.join(' & ');

  const getResult = (m: Match) => (m.match_results || [])[0] || null;

  const filtered = matches.filter(m =>
    tab === 'pending' ? m.status !== 'finished' && m.status !== 'cancelled' : m.status === 'finished'
  );

  const handleShareClub = () => {
    if (!clubId || !clubData?.name) return;
    const openMatches = matches
      .filter(m => m.status === 'open' && m.scheduled_at && m.scheduled_at >= new Date().toISOString())
      .sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!))
      .map(m => ({
        scheduled_at: m.scheduled_at!,
        level: m.level,
        court: m.court,
        max_players: m.max_players || 4,
        spots_taken: (m.match_participants || []).filter(
          (p: MatchParticipant) => p.attendance_status === 'joined' || p.attendance_status === 'confirmed'
        ).length,
      }));
    const text = generateClubMatchesText(clubData.name, clubId, openMatches);
    openWhatsApp(text);
  };

  // ── RENDER ──────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: PP.font }} className="space-y-6">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: PP.ink, letterSpacing: -0.8, lineHeight: 1.05 }}>Partidos Abiertos</h1>
          <p style={{ fontSize: 13.5, color: PP.mute, fontWeight: 500, marginTop: 6 }}>
            Partidos libres publicados · los jugadores se unen por enlace público
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {filtered.some(m => m.status === 'open') && (
            <button
              onClick={handleShareClub}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '9px 14px', borderRadius: 10, border: 0,
                background: '#25D366', color: '#fff',
                fontFamily: PP.font, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <MessageCircle size={15}/> Compartir todos
            </button>
          )}
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '9px 14px', borderRadius: 10, border: 0,
              background: PP.primary, color: '#fff',
              fontFamily: PP.font, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <Plus size={15}/> Crear partido
          </button>
        </div>
      </div>

      {/* Pistas — selector de fecha + cards */}
      {clubData.courts_enabled && courtSummaries.length > 0 && (
        <div style={{ background: PP.card, border: `1px solid ${PP.hair}`, borderRadius: 16, boxShadow: PP.shadow, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${PP.hair}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Fecha grande */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: PP.ink, letterSpacing: -0.3 }}>
                {new Date(`${slotsDate}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
              {slotsDate === toLocalDateStr(new Date()) && (
                <span style={{ fontSize: 10, fontWeight: 700, color: PP.primary, background: PP.primaryTint, borderRadius: 5, padding: '1px 6px' }}>Hoy</span>
              )}
              {slotsDate === toLocalDateStr(new Date(Date.now() + 86400000)) && (
                <span style={{ fontSize: 10, fontWeight: 700, color: PP.muteSoft, background: PP.hair, borderRadius: 5, padding: '1px 6px' }}>Mañana</span>
              )}
            </div>
            {/* Selector prev/next */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button
                onClick={() => { const d = new Date(`${slotsDate}T12:00:00`); d.setDate(d.getDate() - 1); setSlotsDate(toLocalDateStr(d)); }}
                style={{ background: 'none', border: `1px solid ${PP.hair}`, borderRadius: 6, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: PP.muteSoft }}
              >
                <ChevronDown size={13} style={{ transform: 'rotate(90deg)' }} />
              </button>
              <button
                onClick={() => { const d = new Date(`${slotsDate}T12:00:00`); d.setDate(d.getDate() + 1); setSlotsDate(toLocalDateStr(d)); }}
                style={{ background: 'none', border: `1px solid ${PP.hair}`, borderRadius: 6, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: PP.muteSoft }}
              >
                <ChevronDown size={13} style={{ transform: 'rotate(-90deg)' }} />
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, padding: '12px 14px', overflowX: 'auto' }}>
            {courtSummaries.map(cs => {
              const total = cs.morning.length + cs.afternoon.length;
              return (
                <button
                  key={cs.courtNumber}
                  onClick={() => setCourtDetail(cs)}
                  style={{
                    flexShrink: 0, minWidth: 130, background: PP.bg, border: `1.5px solid ${PP.hair}`,
                    borderRadius: 14, padding: '12px 14px', textAlign: 'left', cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = PP.primary)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = PP.hair)}
                >
                  <div style={{ fontSize: 13, fontWeight: 800, color: PP.ink, marginBottom: 8, letterSpacing: -0.3 }}>{cs.courtName}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Sun size={12} style={{ color: '#F59E0B', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: cs.morning.length > 0 ? PP.ink : PP.muteSoft }}>
                        {cs.morning.length > 0 ? `${cs.morning.length} mañana` : 'Sin mañana'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Sunset size={12} style={{ color: '#8B5CF6', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: cs.afternoon.length > 0 ? PP.ink : PP.muteSoft }}>
                        {cs.afternoon.length > 0 ? `${cs.afternoon.length} tarde` : 'Sin tarde'}
                      </span>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: total > 0 ? PP.primary : PP.muteSoft, display: 'flex', alignItems: 'center', gap: 3 }}>
                    {total > 0 ? `${total} huecos · Ver` : 'Completa'}{total > 0 && <ChevronRight size={10} />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Court detail modal */}
      {courtDetail && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setCourtDetail(null)}
        >
          <div
            style={{ background: PP.card, borderRadius: 20, width: '100%', maxWidth: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${PP.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: PP.ink, letterSpacing: -0.4 }}>{courtDetail.courtName} · Hoy</div>
              <button onClick={() => setCourtDetail(null)} style={{ background: 'none', border: 0, cursor: 'pointer', color: PP.muteSoft, display: 'flex', alignItems: 'center' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '12px 16px', maxHeight: 400, overflowY: 'auto' }}>
              {courtDetail.morning.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Sun size={12} style={{ color: '#F59E0B' }} />
                    <span style={{ fontSize: 10, fontWeight: 800, color: PP.mute, textTransform: 'uppercase', letterSpacing: 1 }}>Mañana</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {courtDetail.morning.map((s, i) => (
                      <button key={i} onClick={() => { setCreatePrefill({ date: slotsDate, time: s.startTime, courtName: s.courtName, courtNumber: s.courtNumber }); setCourtDetail(null); setShowCreate(true); }}
                        style={{ padding: '7px 14px', borderRadius: 10, border: `1.5px solid ${PP.hair}`, background: PP.bg, fontSize: 13, fontWeight: 700, color: PP.ink, cursor: 'pointer', transition: 'background 0.12s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = PP.primaryTint)}
                        onMouseLeave={e => (e.currentTarget.style.background = PP.bg)}
                      >
                        {s.startTime}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {courtDetail.afternoon.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Sunset size={12} style={{ color: '#8B5CF6' }} />
                    <span style={{ fontSize: 10, fontWeight: 800, color: PP.mute, textTransform: 'uppercase', letterSpacing: 1 }}>Tarde</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {courtDetail.afternoon.map((s, i) => (
                      <button key={i} onClick={() => { setCreatePrefill({ date: slotsDate, time: s.startTime, courtName: s.courtName, courtNumber: s.courtNumber }); setCourtDetail(null); setShowCreate(true); }}
                        style={{ padding: '7px 14px', borderRadius: 10, border: `1.5px solid ${PP.hair}`, background: PP.bg, fontSize: 13, fontWeight: 700, color: PP.ink, cursor: 'pointer', transition: 'background 0.12s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = PP.primaryTint)}
                        onMouseLeave={e => (e.currentTarget.style.background = PP.bg)}
                      >
                        {s.startTime}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Migration warning */}
      {!tableReady && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 text-sm">
          <div className="font-bold text-amber-800 mb-1">⚠️ Migración pendiente</div>
          <p className="text-amber-700 text-xs">
            Ejecuta el archivo <code className="bg-amber-100 px-1 rounded">supabase/migrations/20260416_matches_unified.sql</code> en el SQL Editor de Supabase para activar este módulo.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', background: PP.hairStrong, borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {([['pending', 'Pendientes'], ['finished', 'Finalizados']] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            style={{
              padding: '8px 20px', borderRadius: 9, border: 0, cursor: 'pointer',
              fontFamily: PP.font, fontSize: 13, fontWeight: 700,
              background: tab === v ? PP.card : 'transparent',
              color: tab === v ? PP.ink : PP.mute,
              boxShadow: tab === v ? PP.shadow : 'none',
            }}
          >
            {l}
            {tab === v && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, color: PP.muteSoft }}>({filtered.length})</span>}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 font-bold animate-pulse">Cargando partidos...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Swords size={28} />}
          title={tab === 'pending' ? 'Sin partidos pendientes' : 'Sin partidos finalizados'}
          body={tab === 'pending' ? 'Crea un partido libre entre jugadores del club.' : 'Los partidos terminados aparecerán aquí.'}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(m => {
            const isExpanded = expandedId === m.id;
            const teamA = getTeamPlayers(m, 'A');
            const teamB = getTeamPlayers(m, 'B');
            const result = getResult(m);
            const timeStr = m.scheduled_at ? fmtTime(m.scheduled_at) : '—';
            const dateInfo = fmtDate(m.scheduled_at);

            return (
              <div key={m.id} style={{
                background: PP.card, border: `1px solid ${PP.hair}`,
                borderRadius: 16, boxShadow: PP.shadow,
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
              }}>
                <button
                  style={{ width: '100%', background: 'none', border: 0, textAlign: 'left', cursor: 'pointer', padding: 0 }}
                  onClick={() => setExpandedId(isExpanded ? null : m.id)}
                >
                  {/* Time hero header */}
                  <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: `1px solid ${PP.hair}` }}>
                    <div style={{ padding: '14px 12px 14px 16px', borderRight: `1px solid ${PP.hair}`, minWidth: 76, flexShrink: 0 }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: PP.ink, letterSpacing: -1, lineHeight: 1, fontFeatureSettings: '"tnum"' }}>{timeStr}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: PP.mute, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4 }}>
                        {dateInfo.day} {dateInfo.month}
                      </div>
                    </div>
                    <div style={{ flex: 1, padding: '14px 14px 14px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          {m.court && <div style={{ fontSize: 13, fontWeight: 700, color: PP.ink, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.court}</div>}
                          <div style={{ fontSize: 11, color: PP.mute, fontWeight: 500, marginTop: 2 }}>
                            {m.level ? `Nivel ${m.level}` : 'Libre'}
                          </div>
                        </div>
                        <div style={{ flexShrink: 0 }}>
                          {result ? (
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 15, fontWeight: 800, color: PP.ink, fontFeatureSettings: '"tnum"' }}>
                                {result.team_a_score} – {result.team_b_score}
                              </div>
                              {result.status === 'disputed' || (result.match_result_disputes || []).some((d: any) => d.status === 'open') ? (
                                <div style={{ fontSize: 10, fontWeight: 700, color: PP.error, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
                                  <Flag size={9}/> Disputado
                                </div>
                              ) : result.status === 'pending_confirmation' ? (
                                <div style={{ fontSize: 10, fontWeight: 700, color: PP.warn, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
                                  <Clock size={9}/> Pendiente
                                </div>
                              ) : m.elo_processed ? (
                                <div style={{ fontSize: 10, fontWeight: 700, color: PP.ok, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
                                  <Zap size={9}/> ELO ok
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', background: PP.primaryTint, color: PP.primary, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8 }}>
                              Abierto
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px 0 0', flexShrink: 0 }}>
                      {isExpanded ? <ChevronUp size={14} color={PP.muteSoft}/> : <ChevronDown size={14} color={PP.muteSoft}/>}
                    </div>
                  </div>

                  {/* Teams strip */}
                  <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: PP.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pairLabelNames(teamNames(m, 'A'))}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: PP.muteSoft, flexShrink: 0 }}>VS</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: PP.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{pairLabelNames(teamNames(m, 'B'))}</span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {(['A', 'B'] as const).map(side => {
                        const allParts = (m.match_participants || [])
                          .filter((p: any) => p.team === side && p.attendance_status !== 'cancelled')
                          .sort((a: any, b: any) => (a.slot_index || 0) - (b.slot_index || 0));
                        const won = result
                          ? (side === 'A' ? result.team_a_score > result.team_b_score : result.team_b_score > result.team_a_score)
                          : false;
                        return (
                          <div key={side} className={`rounded-xl p-3 ${won ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50'}`}>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                              Pareja {side}
                              {won && <span className="ml-1 text-emerald-600">· Ganador</span>}
                            </div>
                            {allParts.length === 0 ? (
                              <div className="text-xs text-slate-400 italic">Sin jugadores</div>
                            ) : allParts.map((p: any) => {
                              const name = p.player?.name || p.guest_name || '?';
                              const isGuest = !p.player;
                              return (
                                <div key={p.id} className="flex items-center gap-2 mb-1">
                                  <div
                                    className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[9px] font-black shrink-0"
                                    style={{ background: isGuest ? '#94a3b8' : getAvatarColor(name) }}
                                  >
                                    {name[0]?.toUpperCase()}
                                  </div>
                                  <span className="text-xs font-bold text-slate-700 truncate">{name}</span>
                                  {isGuest
                                    ? <span className="text-[10px] text-slate-400 ml-auto">Invitado</span>
                                    : <span className="text-[10px] font-bold text-slate-400 ml-auto tabular-nums">{p.player.club_rating ?? 1200}</span>
                                  }
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>

                    {m.notes && (
                      <p className="text-xs text-slate-400 italic">{m.notes}</p>
                    )}

                    {/* Disputes */}
                    {result && (() => {
                      const disputes: any[] = result.match_result_disputes || [];
                      const openDisputes = disputes.filter((d: any) => d.status === 'open');
                      if (openDisputes.length === 0) return null;
                      return (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-black text-rose-600 uppercase tracking-wider">
                            <Flag size={12} /> {openDisputes.length} disputa{openDisputes.length > 1 ? 's' : ''} abierta{openDisputes.length > 1 ? 's' : ''}
                          </div>
                          {openDisputes.map((d: any) => d.reason && (
                            <p key={d.id} className="text-xs text-rose-700 bg-rose-100 rounded-lg px-2 py-1.5">
                              "{d.reason}"
                            </p>
                          ))}
                          <Button
                            variant="primary"
                            onClick={() => setResolvingDispute(result.id)}
                          >
                            <ShieldCheck size={14} /> Finalizar resultado
                          </Button>
                        </div>
                      );
                    })()}

                    <div className="flex gap-2 pt-1">
                      {!result && (
                        <Button
                          variant="primary"
                          onClick={() => { setScoreMatch(m); setExpandedId(null); }}
                        >
                          <CheckCircle2 size={14} /> Añadir resultado
                        </Button>
                      )}
                      {clubData?.lite_join_enabled && m.share_token && (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            const url = `${window.location.origin}/ml/${m.share_token}`;
                            openWhatsApp(`🎾 ¡Partido abierto!\n👉 ${url}`);
                          }}
                        >
                          <MessageCircle size={14} />
                        </Button>
                      )}
                      <Button variant="danger" onClick={() => setDeleteId(m.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── CREATE MODAL ─────────────────────────────────────── */}
      <CreateMatchModal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setCreatePrefill(undefined); }}
        onCreated={() => { loadMatches(); loadTodaySlots(); }}
        prefill={createPrefill}
      />

      {/* ── SCORE MODAL ──────────────────────────────────────── */}
      <Modal
        isOpen={!!scoreMatch}
        onClose={() => setScoreMatch(null)}
        title="Resultado del partido"
        icon={<CheckCircle2 size={22} />}
        iconColor="success"
        actions={[
          { label: 'Cancelar', onClick: () => setScoreMatch(null), variant: 'secondary' },
          { label: 'Guardar + procesar ELO', onClick: handleSaveScore, variant: 'primary', loading: savingScore },
        ]}
      >
        {scoreMatch && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-3 text-sm text-center font-bold text-slate-700">
              {pairLabel(getTeamPlayers(scoreMatch, 'A'))}
              <span className="text-slate-400 mx-2">VS</span>
              {pairLabel(getTeamPlayers(scoreMatch, 'B'))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {(['A', 'B'] as const).map(side => (
                <div key={side}>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 text-center">
                    {pairLabel(getTeamPlayers(scoreMatch, side))}
                  </label>
                  <input
                    type="number" min="0" max="9"
                    className="w-full px-3 py-4 border-2 border-slate-200 rounded-2xl text-3xl font-black text-center text-slate-900 outline-none focus:border-indigo-400"
                    placeholder="0"
                    value={side === 'A' ? scoreA : scoreB}
                    onChange={e => side === 'A' ? setScoreA(e.target.value) : setScoreB(e.target.value)}
                  />
                </div>
              ))}
            </div>
            {scoreA && scoreB && scoreA !== scoreB && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700">
                <Zap size={12} className="inline mr-1" />
                Al guardar se actualizará el ELO automáticamente.
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── RESOLVE DISPUTE MODAL ────────────────────────────── */}
      <Modal
        isOpen={!!resolvingDispute}
        onClose={() => setResolvingDispute(null)}
        title="¿Finalizar resultado?"
        icon={<ShieldCheck size={22} />}
        iconColor="info"
        actions={[
          { label: 'Cancelar', onClick: () => setResolvingDispute(null), variant: 'secondary' },
          { label: 'Confirmar y finalizar', onClick: handleResolveDispute, variant: 'primary', loading: resolving },
        ]}
      >
        <p className="text-sm text-slate-600">
          El resultado se marcará como <strong>final</strong> y se aplicará el ELO de partidos libres automáticamente. Esta acción no se puede deshacer.
        </p>
      </Modal>

      {/* ── DELETE MODAL ─────────────────────────────────────── */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="¿Eliminar partido?"
        icon={<Trash2 size={22} />}
        iconColor="danger"
        actions={[
          { label: 'Cancelar', onClick: () => setDeleteId(null), variant: 'secondary' },
          { label: 'Eliminar', onClick: handleDelete, variant: 'danger', loading: deleting },
        ]}
      >
        <p className="text-sm text-slate-600">
          Esta acción no se puede deshacer. Si el partido ya tenía ELO procesado, los puntos <strong>no se revertirán</strong>.
        </p>
      </Modal>
    </div>
  );
};

export default MatchManager;
