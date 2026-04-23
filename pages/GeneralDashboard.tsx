import React, { useEffect, useState, useCallback } from 'react';
import { useTournament } from '../store/TournamentContext';
import { useHistory } from '../store/HistoryContext';
import { useNotifications } from '../store/NotificationContext';
import { useAuth } from '../store/AuthContext';
import { useNavigate } from 'react-router-dom';
import { PP } from '../utils/theme';
import { supabase } from '../lib/supabase';
import {
  Swords, Trophy, LayoutGrid, Users, Plus,
  Clock, ChevronRight, Upload,
} from 'lucide-react';
import { generateClubMatchesText, openWhatsApp } from '../utils/whatsapp';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmtTime = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
};

const relTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'Ahora';
  if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} h`;
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

// ─── sub-components ──────────────────────────────────────────────────────────

const tile: React.CSSProperties = {
  background: PP.card,
  border: `1px solid ${PP.hair}`,
  borderRadius: 16,
  boxShadow: PP.shadow,
};

// KPI tile
interface KPIProps { label: string; value: React.ReactNode; sub?: string; delta?: string; accent?: string; icon: React.ReactNode; onClick?: () => void; }
const KPITile: React.FC<KPIProps> = ({ label, value, sub, delta, accent = PP.primary, icon, onClick }) => (
  <div onClick={onClick} style={{ ...tile, padding: 18, minHeight: 120, cursor: onClick ? 'pointer' : 'default', display: 'flex', flexDirection: 'column' }}
    onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.boxShadow = PP.shadowLg; }}
    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = PP.shadow; }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: PP.mute, textTransform: 'uppercase', letterSpacing: 1.2 }}>{label}</div>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: `${accent}18`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
    </div>
    <div style={{ fontSize: 44, fontWeight: 800, color: PP.ink, letterSpacing: -1.6, lineHeight: 1, marginTop: 12, fontFeatureSettings: '"tnum"' }}>{value}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
      {sub && <span style={{ fontSize: 12, color: PP.mute, fontWeight: 600 }}>{sub}</span>}
      {delta && <span style={{ fontSize: 12, fontWeight: 700, color: (delta.startsWith('-') && delta !== '-') ? '#B23A3A' : PP.ok }}>{delta}</span>}
    </div>
  </div>
);

// Slot dots
const SlotDots: React.FC<{ filled: number; total: number }> = ({ filled, total }) => (
  <span style={{ display: 'inline-flex', gap: 3 }}>
    {Array.from({ length: total }).map((_, i) => (
      <span key={i} style={{ width: 8, height: 8, borderRadius: 4, background: i < filled ? PP.primary : PP.hairStrong }} />
    ))}
  </span>
);

// Pill
const Pill: React.FC<{ tone?: 'primary' | 'mute' | 'ok'; children: React.ReactNode }> = ({ tone = 'primary', children }) => {
  const styles = {
    primary: { background: PP.primaryTint, color: PP.primary },
    mute:    { background: '#F1F3F7',      color: PP.mute },
    ok:      { background: PP.okTint,      color: '#0E8F6A' },
  };
  return (
    <span style={{ ...styles[tone], padding: '4px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' as const }}>
      {children}
    </span>
  );
};

// Tile wrapper with optional header
const TileBox: React.FC<{ title?: string; kicker?: string; action?: React.ReactNode; padding?: number; style?: React.CSSProperties; children: React.ReactNode }> =
  ({ title, kicker, action, padding = 20, style = {}, children }) => (
    <div style={{ ...tile, padding: 0, ...style, overflow: style.overflow }}>
      <div style={{ padding: padding === 0 ? 0 : `${padding}px ${padding}px ${title || kicker ? 0 : padding}px` }}>
        {(title || action) && (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, padding: padding === 0 ? '20px 20px 0' : undefined }}>
            <div>
              {kicker && <div style={{ fontSize: 10.5, fontWeight: 700, color: PP.mute, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 }}>{kicker}</div>}
              {title && <div style={{ fontSize: 14, fontWeight: 700, color: PP.ink, letterSpacing: -0.2 }}>{title}</div>}
            </div>
            {action}
          </div>
        )}
      </div>
      <div style={{ padding: title || kicker ? `0 ${padding}px ${padding}px` : `${padding}px` }}>
        {children}
      </div>
    </div>
  );

// Shortcut button
const Shortcut: React.FC<{ icon: React.ReactNode; label: string; sub: string; onClick?: () => void }> = ({ icon, label, sub, onClick }) => (
  <button onClick={onClick} style={{
    textAlign: 'left', padding: 12, borderRadius: 10,
    background: PP.bg, border: `1px solid ${PP.hair}`,
    display: 'flex', flexDirection: 'column', gap: 8,
    cursor: 'pointer', fontFamily: PP.font, color: PP.ink, minHeight: 78,
    width: '100%',
  }}>
    <div style={{ width: 26, height: 26, borderRadius: 7, background: PP.card, border: `1px solid ${PP.hair}`, color: PP.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: -0.1 }}>{label}</div>
      <div style={{ fontSize: 10.5, color: PP.mute, fontWeight: 500 }}>{sub}</div>
    </div>
  </button>
);

// ─── Main component ───────────────────────────────────────────────────────────

const GeneralDashboard: React.FC = () => {
  const { state, fetchTournamentList } = useTournament();
  const { clubData } = useHistory();
  const { notifications } = useNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── state ──
  const [openMatches, setOpenMatches] = useState<any[]>([]);
  const [courts, setCourts] = useState<any[]>([]);
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [liveMatches, setLiveMatches] = useState<any[]>([]);

  const clubId = clubData?.id;

  useEffect(() => { fetchTournamentList(); }, [fetchTournamentList]);

  const loadData = useCallback(async () => {
    if (!clubId) return;

    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);

    // Open matches today
    const { data: matchData } = await supabase
      .from('free_matches')
      .select(`id, scheduled_at, court, level, status, max_players,
        match_participants(id, attendance_status)`)
      .eq('club_id', clubId)
      .gte('scheduled_at', todayStart.toISOString())
      .lte('scheduled_at', todayEnd.toISOString())
      .order('scheduled_at');
    setOpenMatches(matchData || []);

    // Player count
    const { count } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId);
    setPlayerCount(count ?? null);

    // Courts with current occupancy
    if (clubData.courts_enabled) {
      const [{ data: courtConfigs }, { data: reservations }, { data: blocks }] = await Promise.all([
        supabase.from('court_availability').select('court_number, court_name, is_active').eq('club_id', clubId).eq('is_active', true).order('sort_order'),
        supabase.from('court_reservations').select('court_number, start_at, end_at, player_name, status')
          .eq('club_id', clubId)
          .not('status', 'in', '("rejected","cancelled")')
          .lte('start_at', now.toISOString())
          .gte('end_at', now.toISOString()),
        supabase.from('court_blocks').select('court_number, start_at, end_at, reason, block_type')
          .eq('club_id', clubId)
          .lte('start_at', now.toISOString())
          .gte('end_at', now.toISOString()),
      ]);

      const mapped = (courtConfigs || []).map((c: any) => {
        const res = (reservations || []).find((r: any) => r.court_number === c.court_number);
        const blk = (blocks || []).find((b: any) => b.court_number === c.court_number);
        if (blk) return { name: c.court_name, status: 'bloqueada', user: blk.reason || 'Bloqueado', until: fmtTime(blk.end_at) };
        if (res) return { name: c.court_name, status: 'ocupada', user: res.player_name || 'Reservado', until: fmtTime(res.end_at) };
        return { name: c.court_name, status: 'libre', user: '', until: '—' };
      });
      setCourts(mapped);
    }
  }, [clubId, clubData.courts_enabled]);

  // Load active tournament's current round matches
  const loadLiveMatches = useCallback(async () => {
    const active = (state.tournamentList || []).find(t => t.status === 'active');
    if (!active) { setLiveMatches([]); return; }

    const { data: rounds } = await supabase
      .from('rounds')
      .select('id, round_number')
      .eq('tournament_id', active.id)
      .eq('status', 'active')
      .order('round_number', { ascending: false })
      .limit(1);

    if (!rounds || rounds.length === 0) { setLiveMatches([]); return; }

    const { data: matches } = await supabase
      .from('round_matches')
      .select(`id, court, score_a, score_b,
        pair_a:pair_a_id(player1:player1_id(name), player2:player2_id(name)),
        pair_b:pair_b_id(player1:player1_id(name), player2:player2_id(name))`)
      .eq('round_id', rounds[0].id)
      .limit(3);

    setLiveMatches(matches || []);
  }, [state.tournamentList]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadLiveMatches(); }, [loadLiveMatches]);

  // ── derived values ──
  const activeTournament = (state.tournamentList || []).find(t => t.status === 'active');
  const openMatchesToday = openMatches.filter(m => m.status === 'open' || m.status === 'pending');
  const completeToday   = openMatches.filter(m => {
    const filled = (m.match_participants || []).filter((p: any) => p.attendance_status !== 'cancelled').length;
    return filled >= (m.max_players || 4);
  }).length;
  const occupiedCourts = courts.filter(c => c.status === 'ocupada' || c.status === 'bloqueada').length;
  const totalCourts    = courts.length;

  const showDefaultBranding = clubData.name === 'Mi Club de Padel' || clubData.name === 'ParaPadel';
  const clubDisplayName = showDefaultBranding ? 'ParaPádel' : clubData.name;
  const hour = new Date().getHours();
  const greeting = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const adminName = user?.email?.split('@')[0]?.replace(/[._-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) ?? '';
  const dateStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(/^\w/, c => c.toUpperCase());

  const handleShareAll = () => {
    if (!clubId || !clubData?.name) return;
    const rows = openMatchesToday.map(m => ({
      scheduled_at: m.scheduled_at,
      level: m.level,
      court: m.court,
      max_players: m.max_players || 4,
      spots_taken: (m.match_participants || []).filter((p: any) => p.attendance_status !== 'cancelled').length,
    }));
    const text = generateClubMatchesText(clubData.name, clubId, rows);
    openWhatsApp(text);
  };

  // Activity from notifications (most recent 5)
  const activityColors: Record<string, string> = {
    invite: PP.primary, match_start: PP.ok, result: '#F59E0B',
    alert: '#B23A3A', info: '#6F3FD9', default: PP.mute,
  };

  const activityItems = [...notifications]
    .sort((a: any, b: any) => new Date(b.created_at || b.timestamp || 0).getTime() - new Date(a.created_at || a.timestamp || 0).getTime())
    .slice(0, 5);

  // ── render ──
  return (
    <div style={{ fontFamily: PP.font, color: PP.ink }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: PP.ink, letterSpacing: -0.8, lineHeight: 1.05 }}>
            {greeting}{adminName ? `, ${adminName.split(' ')[0]}` : ''}
          </h1>
          <p style={{ fontSize: 13.5, color: PP.mute, fontWeight: 500, marginTop: 6 }}>
            {dateStr} · {clubDisplayName}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={() => navigate('/partidos')} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px',
            borderRadius: 10, border: `1px solid ${PP.hairStrong}`, background: PP.card,
            color: PP.ink2, fontFamily: PP.font, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}><Plus size={15}/> Nuevo partido</button>
          <button onClick={() => navigate('/setup')} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px',
            borderRadius: 10, border: 0, background: PP.primary,
            color: '#fff', fontFamily: PP.font, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}><Trophy size={15}/> Crear torneo</button>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 14, marginBottom: 16 }}>
        <KPITile
          label="Partidos abiertos hoy"
          value={openMatchesToday.length}
          sub={`${completeToday} completos · ${openMatchesToday.length - completeToday} con hueco`}
          delta={openMatchesToday.length > 0 ? `+${openMatchesToday.length}` : undefined}
          accent={PP.primary}
          icon={<Swords size={15}/>}
          onClick={() => navigate('/partidos')}
        />
        <KPITile
          label="Pistas ocupadas"
          value={totalCourts > 0 ? `${occupiedCourts}/${totalCourts}` : (clubData.courts_enabled ? '—' : 'N/A')}
          sub={totalCourts > 0 ? `${Math.round((occupiedCourts / totalCourts) * 100)}% ocupación` : 'Sin pistas configuradas'}
          accent={PP.ok}
          icon={<LayoutGrid size={15}/>}
          onClick={clubData.courts_enabled ? () => navigate('/courts') : undefined}
        />
        <KPITile
          label="Inscritos Minis"
          value={activeTournament ? ((activeTournament as any).pairsCount ?? '—') : '—'}
          sub={activeTournament ? `${activeTournament.name} · ${activeTournament.status === 'active' ? 'En curso' : 'Inscripción'}` : 'Sin torneo activo'}
          delta={activeTournament?.status === 'active' ? 'en vivo' : undefined}
          accent="#F59E0B"
          icon={<Trophy size={15}/>}
          onClick={() => navigate('/minis')}
        />
        <KPITile
          label="Jugadores"
          value={playerCount ?? '—'}
          sub="en el club"
          accent="#6F3FD9"
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="2"/>
              <path d="M2 20c0-3 3-5 7-5s7 2 7 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="17" cy="8" r="2.5" stroke="currentColor" strokeWidth="2"/>
              <path d="M16 14c3 0 6 2 6 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          }
          onClick={() => navigate('/players')}
        />
      </div>

      {/* ── Bento row 2: Torneo · Pistas · Atajos ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 16 }} className="md:bento-row2">
        <div className="hidden md:grid md:grid-cols-[1.55fr_1fr_0.85fr]" style={{ gap: 16 }}>

          {/* Torneo en curso */}
          {activeTournament ? (
            <div style={{ ...tile, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Gradient header */}
              <div style={{ padding: 20, background: 'linear-gradient(135deg, #575AF9 0%, #8A5CF6 100%)', color: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                      Torneo en curso · {(activeTournament as any).format?.replace('_', ' ').toUpperCase() || 'Minis'}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5, marginTop: 6, lineHeight: 1.15 }}>
                      {activeTournament.name}
                    </div>
                    <div style={{ fontSize: 12.5, opacity: 0.85, fontWeight: 500, marginTop: 4 }}>
                      {(activeTournament as any).phase || 'Fase activa'}
                    </div>
                  </div>
                  <span style={{ background: 'rgba(255,255,255,0.22)', color: '#fff', padding: '4px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    En vivo
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 24, marginTop: 20 }}>
                  {[
                    { label: 'Parejas',   value: (activeTournament as any).pairsCount ?? '—' },
                    { label: 'Jugados',   value: (activeTournament as any).matchesPlayed ?? '—' },
                    { label: 'Restantes', value: (activeTournament as any).matchesPending ?? '—' },
                  ].map(k => (
                    <div key={k.label}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1 }}>{k.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: -0.6, marginTop: 4, lineHeight: 1 }}>{k.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live matches */}
              <div style={{ padding: '14px 20px', background: '#fff', flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: PP.mute, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Ahora jugando</div>
                {liveMatches.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: PP.muteSoft, fontWeight: 500, padding: '8px 0' }}>Sin partidos activos en este momento</div>
                ) : liveMatches.map((m: any, i: number) => {
                  const p1 = m.pair_a ? `${m.pair_a.player1?.name?.split(' ')[0] ?? '?'} / ${m.pair_a.player2?.name?.split(' ')[0] ?? '?'}` : 'Pareja A';
                  const p2 = m.pair_b ? `${m.pair_b.player1?.name?.split(' ')[0] ?? '?'} / ${m.pair_b.player2?.name?.split(' ')[0] ?? '?'}` : 'Pareja B';
                  const score = (m.score_a != null && m.score_b != null) ? `${m.score_a}-${m.score_b}` : '—';
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${PP.hair}` }}>
                      <span style={{ width: 6, height: 6, borderRadius: 3, background: '#EF4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.15)', flexShrink: 0 }}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: PP.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p1} <span style={{ color: PP.muteSoft, fontWeight: 600 }}>vs</span> {p2}
                        </div>
                        {m.court && <div style={{ fontSize: 11, color: PP.mute, fontWeight: 500, marginTop: 1 }}>{m.court}</div>}
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: PP.ink, fontFeatureSettings: '"tnum"', letterSpacing: -0.2 }}>{score}</div>
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div style={{ borderTop: `1px solid ${PP.hair}`, padding: '12px 20px', display: 'flex', gap: 10 }}>
                <button onClick={() => navigate(`/tournament/active`)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                  borderRadius: 10, border: 0, background: PP.ink, color: '#fff',
                  fontFamily: PP.font, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}><Trophy size={14}/> Abrir modo directo</button>
                <button onClick={() => navigate('/tournament/results')} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                  borderRadius: 10, border: `1px solid ${PP.hairStrong}`, background: PP.card,
                  color: PP.ink2, fontFamily: PP.font, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>Ver clasificación</button>
              </div>
            </div>
          ) : (
            /* No active tournament — empty state */
            <div style={{ ...tile, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center', minHeight: 280 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: PP.primaryTint, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Trophy size={26} style={{ color: PP.primary }}/>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: PP.ink, letterSpacing: -0.3 }}>Sin torneo activo</div>
              <div style={{ fontSize: 13, color: PP.mute, fontWeight: 500, marginTop: 6, maxWidth: 240 }}>Crea un Mini torneo para empezar a gestionar partidas en vivo.</div>
              <button onClick={() => navigate('/setup')} style={{
                marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px',
                borderRadius: 10, border: 0, background: PP.primary, color: '#fff',
                fontFamily: PP.font, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}><Plus size={15}/> Crear torneo</button>
            </div>
          )}

          {/* Pistas ocupadas */}
          <div style={{ ...tile, padding: 20, display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: PP.mute, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 }}>Hoy</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: PP.ink, letterSpacing: -0.2 }}>Ocupación de pistas</div>
              </div>
              <button onClick={() => navigate('/courts')} style={{ padding: '6px 12px', borderRadius: 9, border: `1px solid ${PP.hairStrong}`, background: PP.card, color: PP.ink2, fontFamily: PP.font, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Ver calendario
              </button>
            </div>
            {courts.length === 0 ? (
              <div style={{ fontSize: 12.5, color: PP.muteSoft, fontWeight: 500, padding: '8px 0' }}>
                {clubData.courts_enabled ? 'Sin pistas configuradas' : 'Módulo de pistas no activado'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {courts.slice(0, 7).map((c, i) => {
                  const col = c.status === 'ocupada'
                    ? { bg: PP.primaryTint, dot: PP.primary, fg: PP.primary }
                    : c.status === 'bloqueada'
                    ? { bg: '#FEF3C7', dot: PP.warn, fg: '#8A6B00' }
                    : { bg: PP.okTint, dot: PP.ok, fg: '#0E8F6A' };
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, background: col.bg }}>
                      <span style={{ width: 7, height: 7, borderRadius: 4, background: col.dot, flexShrink: 0 }}/>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: PP.ink, minWidth: 60 }}>{c.name}</span>
                      <span style={{ flex: 1, fontSize: 11.5, fontWeight: 500, color: PP.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.user || 'Libre'}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: col.fg, fontFeatureSettings: '"tnum"', flexShrink: 0 }}>{c.until}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Atajos */}
          <div style={{ ...tile, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: PP.ink, letterSpacing: -0.2, marginBottom: 12 }}>Atajos</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Shortcut icon={<Plus size={15}/>} label="Nuevo partido" sub="abierto" onClick={() => navigate('/partidos')}/>
              <Shortcut icon={<Trophy size={15}/>} label="Crear torneo" sub="Minis" onClick={() => navigate('/setup')}/>
              <Shortcut
                icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
                label="Reservar" sub="pista"
                onClick={() => navigate('/courts')}
              />
              <Shortcut
                icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 3v14m0 0l-5-5m5 5l5-5M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                label="Importar" sub="jugadores CSV"
                onClick={() => navigate('/players')}
              />
            </div>
          </div>

        </div>

        {/* Mobile: show only shortcuts + tournament CTA */}
        <div className="md:hidden flex flex-col gap-4">
          {activeTournament && (
            <div style={{ background: 'linear-gradient(135deg, #575AF9 0%, #8A5CF6 100%)', borderRadius: 16, padding: 20, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 1 }}>Torneo en curso</div>
                <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.4, marginTop: 4 }}>{activeTournament.name}</div>
              </div>
              <button onClick={() => navigate('/tournament/active')} style={{ background: 'rgba(255,255,255,0.2)', border: 0, color: '#fff', padding: '8px 14px', borderRadius: 10, fontFamily: PP.font, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                Abrir <ChevronRight size={14} style={{ display: 'inline', verticalAlign: 'middle' }}/>
              </button>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Shortcut icon={<Plus size={15}/>} label="Nuevo partido" sub="abierto" onClick={() => navigate('/partidos')}/>
            <Shortcut icon={<Trophy size={15}/>} label="Crear torneo" sub="Minis" onClick={() => navigate('/setup')}/>
            <Shortcut icon={<LayoutGrid size={15}/>} label="Reservar" sub="pista" onClick={() => navigate('/courts')}/>
            <Shortcut icon={<Users size={15}/>} label="Jugadores" sub="gestionar" onClick={() => navigate('/players')}/>
          </div>
        </div>
      </div>

      {/* ── Row 3: Partidos hoy + Actividad ── */}
      <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr]" style={{ gap: 16 }}>

        {/* Partidos abiertos hoy */}
        <div style={{ ...tile }}>
          <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: PP.ink, letterSpacing: -0.2 }}>Partidos abiertos · hoy</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {openMatchesToday.length > 0 && (
                <button onClick={handleShareAll} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 9, border: `1px solid ${PP.hairStrong}`, background: PP.card, color: PP.ink2, fontFamily: PP.font, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#25D366' }}><path d="M12 2a10 10 0 00-8.5 15.2L2 22l4.9-1.5A10 10 0 1012 2z"/></svg>
                  Compartir
                </button>
              )}
              <button onClick={() => navigate('/partidos')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 9, border: 0, background: PP.primary, color: '#fff', fontFamily: PP.font, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <Plus size={13}/> Crear
              </button>
            </div>
          </div>

          {openMatches.length === 0 ? (
            <div style={{ padding: '24px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: PP.muteSoft, fontWeight: 500 }}>No hay partidos programados para hoy</div>
              <button onClick={() => navigate('/partidos')} style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: PP.primary, background: 'none', border: 0, cursor: 'pointer' }}>Crear el primero →</button>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 60px 120px 100px 60px', padding: '8px 20px', fontSize: 11, fontWeight: 700, color: PP.mute, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                <span>Hora</span><span>Pista</span><span>Nivel</span><span>Plazas</span><span>Estado</span><span/>
              </div>
              {openMatches.slice(0, 5).map((m, i) => {
                const filled = (m.match_participants || []).filter((p: any) => p.attendance_status !== 'cancelled').length;
                const total  = m.max_players || 4;
                const isFull = filled >= total;
                return (
                  <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 60px 120px 100px 60px', padding: '10px 20px', borderTop: `1px solid ${PP.hair}`, alignItems: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: PP.ink, letterSpacing: -0.4, fontFeatureSettings: '"tnum"' }}>{fmtTime(m.scheduled_at)}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: PP.ink2 }}>{m.court || '—'}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: PP.ink2 }}>{m.level || '—'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <SlotDots filled={filled} total={total}/>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isFull ? PP.mute : PP.primary }}>{filled}/{total}</span>
                    </span>
                    <span>{isFull ? <Pill tone="mute">Completo</Pill> : <Pill tone="primary">Abierto</Pill>}</span>
                    <span style={{ textAlign: 'right' }}>
                      <button onClick={() => navigate('/partidos')} style={{ background: 'none', border: 0, color: PP.primary, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: PP.font }}>Ver ›</button>
                    </span>
                  </div>
                );
              })}
              {openMatches.length > 5 && (
                <div style={{ borderTop: `1px solid ${PP.hair}`, padding: '10px 20px' }}>
                  <button onClick={() => navigate('/partidos')} style={{ background: 'none', border: 0, color: PP.primary, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: PP.font }}>
                    Ver todos ({openMatches.length}) →
                  </button>
                </div>
              )}
              {/* bottom padding */}
              <div style={{ height: 8 }}/>
            </>
          )}
        </div>

        {/* Actividad reciente */}
        <div style={{ ...tile, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: PP.ink, letterSpacing: -0.2, marginBottom: 14 }}>Actividad reciente</div>
          {activityItems.length === 0 ? (
            <div style={{ fontSize: 12.5, color: PP.muteSoft, fontWeight: 500, padding: '8px 0' }}>Sin actividad reciente</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {activityItems.map((notif: any, i: number) => (
                <div key={notif.id || i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: i ? `1px solid ${PP.hair}` : 'none' }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: activityColors[notif.type] || activityColors.default, marginTop: 6, flexShrink: 0 }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: PP.ink2, fontWeight: 500, lineHeight: 1.3 }}>
                      {notif.title || notif.message || notif.body || 'Actividad'}
                    </div>
                    <div style={{ fontSize: 11, color: PP.muteSoft, fontWeight: 500, marginTop: 2 }}>
                      {relTime(notif.created_at || notif.timestamp || new Date().toISOString())}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default GeneralDashboard;
