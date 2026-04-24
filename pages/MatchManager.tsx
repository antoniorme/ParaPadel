import React, { useState, useEffect, useCallback } from 'react';
import { useTournament } from '../store/TournamentContext';
import { useHistory } from '../store/HistoryContext';
import { useToast } from '../components/Toast';
import { Modal, Button, EmptyState, PlayerSelector } from '../components';
import { THEME, PP } from '../utils/theme';
import { calculateMatchDelta } from '../utils/Elo';
import { generateClubMatchesText, openWhatsApp } from '../utils/whatsapp';
import { supabase } from '../lib/supabase';
import { Player, Match, MatchParticipant } from '../types';
import { MATCH_LEVELS } from '../utils/categories';
import {
  Swords, Plus, CheckCircle2, Clock, Trash2,
  ChevronDown, ChevronUp, Zap, MessageCircle,
  LayoutGrid, ChevronRight, Flag, ShieldCheck, Sun, Sunset, X, Search,
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
  const [creating, setCreating] = useState(false);
  // Cada slot: nombre libre (invitado) + playerId opcional (si buscan/crean)
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '',
    court: '',
    courtNumber: 0,
    level: '',
    slots: [
      { name: '', playerId: '' },
      { name: '', playerId: '' },
      { name: '', playerId: '' },
      { name: '', playerId: '' },
    ] as { name: string; playerId: string }[],
    notes: '',
  });
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [slotTab, setSlotTab] = useState<'search' | 'new'>('search');

  // Available courts for the select
  const [availableCourts, setAvailableCourts] = useState<{ courtNumber: number; courtName: string }[]>([]);

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

  // Free slots de hoy (si courts_enabled)
  const [courtSummaries, setCourtSummaries] = useState<CourtSummary[]>([]);
  const [courtDetail, setCourtDetail] = useState<CourtSummary | null>(null);

  const loadTodaySlots = useCallback(async () => {
    if (!clubId || !clubData.courts_enabled) return;
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999);

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
    const todayDow = new Date().getDay();
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();

    // Populate courts list for the select (all active courts, not just those with free slots)
    setAvailableCourts(
      (courts as any[])
        .filter(c => c.active_days.includes(todayDow))
        .map(c => ({ courtNumber: c.court_number, courtName: c.court_name }))
    );

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

    setCourtSummaries(Array.from(summaryMap.values()).filter(s => s.morning.length + s.afternoon.length > 0));
  }, [clubId, clubData.courts_enabled]);

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

  // ── CREATE ──────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!form.date || !form.time) {
      toastError('La fecha y la hora son obligatorias');
      return;
    }
    setCreating(true);

    // Timestamps correctos con zona horaria (igual que buildTimestamp en ClubCalendar)
    const startDate = new Date(`${form.date}T${form.time}:00`);
    const endDate = new Date(startDate.getTime() + 90 * 60 * 1000);
    const scheduledAt = startDate.toISOString();
    const startAt = startDate.toISOString();
    const endAt = endDate.toISOString();

    // Check solapamiento antes de crear
    if (form.courtNumber) {
      const { data: overlap } = await supabase
        .from('court_reservations')
        .select('id')
        .eq('club_id', clubId)
        .eq('court_number', form.courtNumber)
        .not('status', 'in', '("rejected","cancelled")')
        .lt('start_at', endAt)
        .gt('end_at', startAt)
        .limit(1);
      if (overlap && overlap.length > 0) {
        toastError('Esa pista ya está ocupada en ese horario');
        setCreating(false);
        return;
      }
    }

    // 1. Crear el partido
    const { data: matchData, error: matchErr } = await supabase
      .from('free_matches')
      .insert({
        club_id: clubId,
        scheduled_at: scheduledAt,
        court: form.court || null,
        level: form.level || null,
        notes: form.notes || null,
        max_players: 4,
        status: 'open',
      })
      .select('id')
      .single();

    if (matchErr || !matchData) {
      toastError('Error al crear el partido');
      setCreating(false);
      return;
    }

    // 2. Insertar participantes
    const participants = form.slots
      .map((s, i) => {
        if (!s.name.trim() && !s.playerId) return null;
        return s.playerId
          ? { match_id: matchData.id, player_id: s.playerId, slot_index: i + 1, team: i < 2 ? 'A' : 'B', participant_type: 'registered_player', joined_via: 'manual', attendance_status: 'joined' }
          : { match_id: matchData.id, guest_name: s.name.trim(), slot_index: i + 1, team: i < 2 ? 'A' : 'B', participant_type: 'claimable_guest', joined_via: 'manual', attendance_status: 'joined' };
      })
      .filter(Boolean);

    if (participants.length > 0) {
      const { error: partErr } = await supabase.from('match_participants').insert(participants);
      if (partErr) toastError('Partido creado pero hubo un error con los jugadores');
    }

    // 3. Bloquear slot en el calendario (court_reservations = fuente única de verdad)
    if (form.courtNumber) {
      await supabase.from('court_reservations').insert({
        club_id: clubId,
        court_number: form.courtNumber,
        start_at: startAt,
        end_at: endAt,
        status: 'confirmed',
        source: 'admin',
        notes: `match:${matchData.id}`,
      });
    }

    success('Partido creado');

    setCreating(false);
    setShowCreate(false);
    setForm({ date: new Date().toISOString().split('T')[0], time: '', court: '', courtNumber: 0, level: '', slots: [{name:'',playerId:''},{name:'',playerId:''},{name:'',playerId:''},{name:'',playerId:''}], notes: '' });
    setOpenSlot(null);
    loadMatches();
    loadTodaySlots();
  };

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
      .filter(p => p.team === team && p.player && p.attendance_status !== 'cancelled')
      .sort((a, b) => (a.slot_index || 0) - (b.slot_index || 0))
      .map(p => p.player as Player);

  const pairLabel = (players: Player[]) => {
    if (players.length === 0) return '—';
    return players.map(p => p.nickname ? `"${p.nickname}"` : p.name.split(' ')[0]).join(' & ');
  };

  const getResult = (m: Match) => (m.match_results || [])[0] || null;

  const eloPreview = () => {
    const p1a = allPlayers.find(p => p.id === form.p1a);
    const p2a = allPlayers.find(p => p.id === form.p2a);
    const p1b = allPlayers.find(p => p.id === form.p1b);
    const p2b = allPlayers.find(p => p.id === form.p2b);
    if (!p1a || !p1b) return null;
    const cr = (p: Player) => p.club_rating ?? 1200;
    const eloA = p2a ? (cr(p1a) + cr(p2a)) / 2 : cr(p1a);
    const eloB = p2b ? (cr(p1b) + cr(p2b)) / 2 : cr(p1b);
    const delta = Math.abs(calculateMatchDelta(eloA, eloB, 1, 0));
    return { eloA: Math.round(eloA), eloB: Math.round(eloB), delta };
  };
  const preview = eloPreview();

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

      {/* Pistas libres hoy — horizontal cards */}
      {clubData.courts_enabled && courtSummaries.length > 0 && (
        <div style={{ background: PP.card, border: `1px solid ${PP.hair}`, borderRadius: 16, boxShadow: PP.shadow, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${PP.hair}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <LayoutGrid size={14} style={{ color: PP.muteSoft }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: PP.mute, textTransform: 'uppercase', letterSpacing: 1 }}>Pistas libres hoy · 1h30</span>
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
                  <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: PP.primary, display: 'flex', alignItems: 'center', gap: 3 }}>
                    {total} huecos · Ver <ChevronRight size={10} />
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
                      <button key={i} onClick={() => { setForm(f => ({ ...f, date: toLocalDateStr(new Date()), time: s.startTime, court: s.courtName, courtNumber: s.courtNumber })); setCourtDetail(null); setShowCreate(true); }}
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
                      <button key={i} onClick={() => { setForm(f => ({ ...f, date: toLocalDateStr(new Date()), time: s.startTime, court: s.courtName, courtNumber: s.courtNumber })); setCourtDetail(null); setShowCreate(true); }}
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
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: PP.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pairLabel(teamA)}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: PP.muteSoft, flexShrink: 0 }}>VS</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: PP.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{pairLabel(teamB)}</span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {(['A', 'B'] as const).map(side => {
                        const players = getTeamPlayers(m, side);
                        const won = result
                          ? (side === 'A' ? result.team_a_score > result.team_b_score : result.team_b_score > result.team_a_score)
                          : false;
                        return (
                          <div key={side} className={`rounded-xl p-3 ${won ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50'}`}>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                              Pareja {side}
                              {won && <span className="ml-1 text-emerald-600">· Ganador</span>}
                            </div>
                            {players.length === 0 ? (
                              <div className="text-xs text-slate-400 italic">Sin jugadores</div>
                            ) : players.map(pl => (
                              <div key={pl.id} className="flex items-center gap-2 mb-1">
                                <div
                                  className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[9px] font-black shrink-0"
                                  style={{ background: getAvatarColor(pl.name) }}
                                >
                                  {pl.name[0]}
                                </div>
                                <span className="text-xs font-bold text-slate-700 truncate">{pl.name}</span>
                                <span className="text-[10px] font-bold text-slate-400 ml-auto tabular-nums">
                                  {pl.club_rating ?? 1200}
                                </span>
                              </div>
                            ))}
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
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nuevo partido"
        icon={<Swords size={22} />}
        iconColor="info"
        actions={[
          { label: 'Cancelar', onClick: () => setShowCreate(false), variant: 'secondary' },
          { label: 'Crear partido', onClick: handleCreate, variant: 'primary', loading: creating },
        ]}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Fecha</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none focus:border-indigo-400"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Hora</label>
              <input
                type="time"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none focus:border-indigo-400"
                value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Pista</label>
              {availableCourts.length > 0 ? (
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none focus:border-indigo-400 bg-white"
                  value={form.courtNumber || ''}
                  onChange={e => {
                    const cn = parseInt(e.target.value);
                    const c = availableCourts.find(x => x.courtNumber === cn);
                    setForm(f => ({ ...f, courtNumber: cn || 0, court: c?.courtName || '' }));
                  }}
                >
                  <option value="">— Sin pista —</option>
                  {availableCourts.map(c => (
                    <option key={c.courtNumber} value={c.courtNumber}>{c.courtName}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none focus:border-indigo-400"
                  placeholder="Ej. Pista 2"
                  value={form.court}
                  onChange={e => setForm(f => ({ ...f, court: e.target.value, courtNumber: 0 }))}
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Nivel</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none focus:border-indigo-400 bg-white"
                value={form.level}
                onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
              >
                <option value="">Abierto (cualquier nivel)</option>
                {MATCH_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Jugadores 1-4 */}
          <div style={{ borderTop: `1px solid ${PP.hair}`, paddingTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: PP.mute, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Jugadores</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {form.slots.map((slot, i) => {
                const linked = slot.playerId ? allPlayers.find(p => p.id === slot.playerId) : null;
                const isOpen = openSlot === i;
                return (
                  <div key={i} style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* Número */}
                      <span style={{ fontSize: 13, fontWeight: 800, color: PP.muteSoft, minWidth: 14, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                      {/* Input de nombre */}
                      <input
                        style={{
                          flex: 1, padding: '8px 11px', borderRadius: 10,
                          border: `1.5px solid ${slot.name || slot.playerId ? PP.primary : PP.hair}`,
                          background: linked ? PP.primaryTint : PP.bg,
                          fontFamily: PP.font, fontSize: 13, fontWeight: 600,
                          color: PP.ink, outline: 'none', minWidth: 0,
                        }}
                        placeholder="Nombre del jugador"
                        value={slot.name}
                        onChange={e => setForm(f => ({ ...f, slots: f.slots.map((s, j) => j === i ? { name: e.target.value, playerId: '' } : s) }))}
                      />
                      {/* Buscar */}
                      <button
                        type="button"
                        onClick={() => { setSlotTab('search'); setOpenSlot(isOpen && slotTab === 'search' ? null : i); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '7px 9px', borderRadius: 8, border: `1px solid ${PP.hair}`, background: PP.card, fontSize: 11, fontWeight: 700, color: PP.ink2, cursor: 'pointer', flexShrink: 0, fontFamily: PP.font }}
                      >
                        <Search size={11}/> Buscar
                      </button>
                      {/* Crear */}
                      <button
                        type="button"
                        onClick={() => { setSlotTab('new'); setOpenSlot(isOpen && slotTab === 'new' ? null : i); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '7px 9px', borderRadius: 8, border: 0, background: PP.primary, fontSize: 11, fontWeight: 700, color: '#fff', cursor: 'pointer', flexShrink: 0, fontFamily: PP.font }}
                      >
                        <Plus size={11}/>
                      </button>
                    </div>
                    {/* Dropdown PlayerSelector */}
                    {isOpen && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 22, right: 0, zIndex: 500, background: PP.card, borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', border: `1px solid ${PP.hair}`, overflow: 'hidden' }}>
                        <PlayerSelector
                          label=""
                          selectedId={slot.playerId}
                          onSelect={id => {
                            const p = allPlayers.find(x => x.id === id);
                            setForm(f => ({ ...f, slots: f.slots.map((s, j) => j === i ? { name: p ? formatPlayerName(p) : '', playerId: id } : s) }));
                            setOpenSlot(null);
                          }}
                          otherSelectedId=""
                          players={allPlayers.filter(p => !form.slots.some((s, j) => j !== i && s.playerId === p.id))}
                          onAddPlayer={async (p) => {
                            const id = await addPlayerToDB(p);
                            if (id) {
                              setForm(f => ({ ...f, slots: f.slots.map((s, j) => j === i ? { name: p.name || '', playerId: id } : s) }));
                              setOpenSlot(null);
                            }
                            return id;
                          }}
                          formatName={formatPlayerName}
                          initialTab={slotTab}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {preview && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
              <div className="text-xs font-bold text-indigo-600 mb-1 flex items-center gap-1">
                <Zap size={12} /> ELO en juego
              </div>
              <div className="text-xs text-indigo-700">
                Si gana Pareja A: <strong>+{preview.delta} / -{preview.delta}</strong> pts
              </div>
              <div className="text-xs text-indigo-500">
                Rating club A: {preview.eloA} vs B: {preview.eloB}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Notas (opcional)</label>
            <textarea
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-indigo-400 resize-none"
              rows={2}
              placeholder="Partido amistoso, eliminatoria..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

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
