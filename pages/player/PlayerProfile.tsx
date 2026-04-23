
import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournament } from '../../store/TournamentContext';
import { useHistory } from '../../store/HistoryContext';
import { useAuth } from '../../store/AuthContext';
import { THEME, PP } from '../../utils/theme';
import { avatarColor, initials as getInitials } from '../../utils/avatar';
import {
  ArrowLeft, Key, Trash2, AlertTriangle, Lock, Check, Loader2,
  TrendingUp, Shield, ChevronDown, ChevronUp, Edit3, Trophy,
  Calendar, Star, LogOut,
} from 'lucide-react';
import { Modal } from '../../components';
import { calculateDisplayRanking, getPairTeamElo, calculateMatchDelta } from '../../utils/Elo';
import { categoryFromElo, CATEGORY_SHORT } from '../../utils/categories';
import { TournamentState, Player } from '../../types';
import { supabase } from '../../lib/supabase';

// ── INTERFACES ────────────────────────────────────────────────────────────────

interface ProcessedMatch {
  id: string;
  roundLabel: string;
  partnerName: string;
  opponentsName: string;
  score: string;
  result: 'win' | 'loss' | 'pending';
  eloDelta: number;
  timestamp: number;
}

interface ProcessedTournament {
  id: string;
  title: string;
  date: string;
  format: string;
  resultBadge?: 'champion' | 'consolation' | null;
  matches: ProcessedMatch[];
  eloChangeTotal: number;
}

// ── ELO SPARKLINE ─────────────────────────────────────────────────────────────

// Stepped sparkline — cada partido es un escalón (estilo del prototipo)
const EloSparkline: React.FC<{ data: number[] }> = ({ data }) => {
  if (data.length < 2) return null;
  const W = 340; const H = 120;
  const pad = { t: 14, r: 8, b: 18, l: 8 };
  const w = W - pad.l - pad.r;
  const h = H - pad.t - pad.b;
  const minV = Math.min(...data);
  const maxV = Math.max(...data);
  const range = Math.max(1, maxV - minV);
  const stepX = w / (data.length - 1);
  const y = (v: number) => pad.t + h - ((v - minV) / range) * h;

  // Stepped path: horizontal then vertical between points
  let d = `M ${pad.l} ${y(data[0])}`;
  for (let i = 1; i < data.length; i++) {
    const px = pad.l + stepX * i;
    d += ` L ${px} ${y(data[i - 1])} L ${px} ${y(data[i])}`;
  }
  const area = d + ` L ${pad.l + w} ${pad.t + h} L ${pad.l} ${pad.t + h} Z`;

  const delta = data[data.length - 1] - data[0];
  const isPos = delta >= 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' as const, letterSpacing: 1 }}>
          Evolución ELO
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color: isPos ? '#6EE7B7' : '#fca5a5' }}>
          {isPos ? '+' : ''}{Math.round(delta)} pts
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', height: H }}>
        <defs>
          <linearGradient id="eloGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PP.primary} stopOpacity="0.25"/>
            <stop offset="100%" stopColor={PP.primary} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={area} fill="url(#eloGrad)"/>
        <path d={d} fill="none" stroke={PP.primary} strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter"/>
        <line x1={pad.l} y1={pad.t + h + 1} x2={pad.l + w} y2={pad.t + h + 1} stroke="rgba(255,255,255,0.08)"/>
        <circle cx={pad.l + stepX * (data.length - 1)} cy={y(data[data.length - 1])} r="5" fill={PP.primary} stroke="#fff" strokeWidth="2"/>
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginTop: 4 }}>
        <span>{Math.round(data[0])}</span>
        <span style={{ color: '#A5B4FC', fontWeight: 800 }}>{Math.round(data[data.length - 1])}</span>
      </div>
    </div>
  );
};

// ── FIABILIDAD HELPER ─────────────────────────────────────────────────────────

const getFiabilidad = (matches: number): { score: number; label: string; color: string } => {
  const score = Math.min(100, Math.round((matches / 20) * 100));
  if (score >= 80) return { score, label: 'Alta', color: '#10b981' };
  if (score >= 50) return { score, label: 'Media', color: THEME.cta };
  if (score >= 20) return { score, label: 'Baja', color: '#f59e0b' };
  return { score, label: 'Nueva', color: '#94a3b8' };
};

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

const PlayerProfile: React.FC = () => {
  const navigate = useNavigate();
  const { state, formatPlayerName, deletePlayerDB } = useTournament();
  const { pastTournaments } = useHistory();
  const { signOut, user } = useAuth();

  const [myPlayerId] = useState<string>(() => localStorage.getItem('padel_sim_player_id') || '');
  const contextPlayer = state.players.find(p => p.id === myPlayerId);

  const [dbPlayer, setDbPlayer] = useState<Player | null>(null);
  const [socialStats, setSocialStats] = useState({ followers: 0, following: 0 });
  const [partidosCount, setPartidosCount] = useState(0);

  const [expandedTournamentId, setExpandedTournamentId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [showPrefsModal, setShowPrefsModal] = useState(false);

  // Password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState(false);

  // Preferences
  const [prefPosition, setPrefPosition] = useState<'right' | 'backhand' | undefined>();
  const [prefBothSides, setPrefBothSides] = useState(false);
  const [prefSaving, setPrefSaving] = useState(false);

  useEffect(() => {
    if (!myPlayerId) return;

    supabase.from('players').select('*').eq('id', myPlayerId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setDbPlayer(data as Player);
          setPrefPosition((data as Player).preferred_position);
          setPrefBothSides((data as Player).play_both_sides || false);
        }
      }).catch(() => {});

    Promise.all([
      supabase.from('player_follows').select('id', { count: 'exact', head: true }).eq('following_id', myPlayerId),
      supabase.from('player_follows').select('id', { count: 'exact', head: true }).eq('follower_id', myPlayerId),
    ]).then(([r1, r2]) => setSocialStats({ followers: r1.count || 0, following: r2.count || 0 }))
      .catch(() => {});

    supabase.from('match_participants').select('id', { count: 'exact', head: true })
      .eq('player_id', myPlayerId)
      .in('attendance_status', ['joined', 'confirmed'])
      .then(({ count }) => setPartidosCount(count || 0))
      .catch(() => {});
  }, [myPlayerId]);

  const currentPlayer = dbPlayer || contextPlayer;

  // ── HISTORY DATA ENGINE ────────────────────────────────────────────────────

  const historyData = useMemo(() => {
    if (!currentPlayer) return { tournaments: [], stats: { matches: 0, wins: 0, winRate: 0, titles: 0 } };
    const stats = { matches: 0, wins: 0, titles: 0, winRate: 0 };
    const processedTournaments: ProcessedTournament[] = [];

    const processTournamentState = (tId: string, tData: TournamentState, tDate: string, tTitle?: string) => {
      const myPair = tData.pairs.find(p => p.player1Id === myPlayerId || p.player2Id === myPlayerId);
      if (!myPair) return;
      const partnerId = myPair.player1Id === myPlayerId ? myPair.player2Id : myPair.player1Id;
      const partner = tData.players.find(p => p.id === partnerId);
      const partnerName = formatPlayerName(partner);
      const myTeamElo = partner ? getPairTeamElo(currentPlayer, partner) : 1500;
      const tMatches: ProcessedMatch[] = [];
      let tEloChange = 0;
      let resultBadge: 'champion' | 'consolation' | null = null;

      tData.matches.filter(m => m.pairAId === myPair.id || m.pairBId === myPair.id).forEach(m => {
        if (!m.isFinished) return;
        stats.matches++;
        const isPairA = m.pairAId === myPair.id;
        const myScore = isPairA ? m.scoreA : m.scoreB;
        const oppScore = isPairA ? m.scoreB : m.scoreA;
        const won = (myScore || 0) > (oppScore || 0);
        if (won) {
          stats.wins++;
          if (m.round === 7 || (tData.format === '10_mini' && m.round === 6)) {
            if (m.bracket === 'main') { resultBadge = 'champion'; stats.titles++; }
            else if (m.bracket === 'consolation') resultBadge = 'consolation';
          }
        }
        const oppId = isPairA ? m.pairBId : m.pairAId;
        const oppPair = tData.pairs.find(p => p.id === oppId);
        let oppNames = 'Desconocidos';
        let oppTeamElo = 1500;
        if (oppPair) {
          const op1 = tData.players.find(p => p.id === oppPair.player1Id);
          const op2 = tData.players.find(p => p.id === oppPair.player2Id);
          if (op1 && op2) oppTeamElo = getPairTeamElo(op1, op2);
          oppNames = `${formatPlayerName(op1)} & ${formatPlayerName(op2)}`;
        }
        const rawDelta = calculateMatchDelta(myTeamElo, oppTeamElo, m.scoreA || 0, m.scoreB || 0);
        const myDelta = isPairA ? rawDelta : -rawDelta;
        tEloChange += myDelta;
        tMatches.push({
          id: m.id, roundLabel: m.phase === 'group' ? `R${m.round}` : m.phase.toUpperCase(),
          partnerName, opponentsName: oppNames, score: `${myScore} - ${oppScore}`,
          result: won ? 'win' : 'loss', eloDelta: myDelta, timestamp: m.round,
        });
      });
      tMatches.sort((a, b) => a.timestamp - b.timestamp);
      if (tMatches.length > 0) {
        processedTournaments.push({
          id: tId, title: tTitle || `Mini Torneo ${tData.format?.replace('_mini', '') || '16'}`,
          date: tDate, format: tData.format, resultBadge, matches: tMatches, eloChangeTotal: tEloChange,
        });
      }
    };

    pastTournaments.forEach(pt => { if (pt.data) processTournamentState(pt.id, pt.data, pt.date); });
    if (state.status !== 'setup') processTournamentState(state.id || 'active', state, new Date().toISOString(), state.title);
    processedTournaments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    stats.winRate = stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0;
    return { tournaments: processedTournaments, stats };
  }, [currentPlayer, pastTournaments, state, myPlayerId, formatPlayerName]);

  // ELO progression for sparkline
  const eloHistory = useMemo(() => {
    if (!currentPlayer || historyData.tournaments.length < 2) return [];
    const currentElo = calculateDisplayRanking(currentPlayer);
    const totalChange = historyData.tournaments.reduce((s, t) => s + t.eloChangeTotal, 0);
    const initialElo = Math.max(500, currentElo - totalChange);
    const chrono = [...historyData.tournaments].reverse();
    const points: number[] = [initialElo];
    let running = initialElo;
    chrono.forEach(t => { running = Math.max(0, running + t.eloChangeTotal); points.push(Math.round(running)); });
    return points;
  }, [currentPlayer, historyData]);

  // Handlers
  const handleDeleteAccount = async () => {
    if (!currentPlayer) return;
    try {
      await deletePlayerDB(currentPlayer.id);
      localStorage.removeItem('padel_sim_player_id');
      if (user) await signOut();
      navigate('/');
    } catch (_) {}
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassLoading(true); setPassError(null);
    if (newPassword !== confirmPassword) { setPassError('Las contraseñas no coinciden'); setPassLoading(false); return; }
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPassSuccess(true);
      setTimeout(() => { setShowChangePassModal(false); setPassSuccess(false); setNewPassword(''); setConfirmPassword(''); }, 2000);
    } catch (err: any) { setPassError(err.message); } finally { setPassLoading(false); }
  };

  const handleSavePreferences = async () => {
    if (!myPlayerId) return;
    setPrefSaving(true);
    try {
      await supabase.from('players').update({ preferred_position: prefPosition, play_both_sides: prefBothSides }).eq('id', myPlayerId);
      if (dbPlayer) setDbPlayer({ ...dbPlayer, preferred_position: prefPosition, play_both_sides: prefBothSides });
      setShowPrefsModal(false);
    } catch (_) {} finally { setPrefSaving(false); }
  };

  if (!currentPlayer) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p className="font-bold">Perfil no encontrado.</p>
        <button onClick={() => navigate('/p/dashboard')} className="mt-4 font-bold text-sm" style={{ color: THEME.cta }}>
          Volver al inicio
        </button>
      </div>
    );
  }

  const currentElo = calculateDisplayRanking(currentPlayer);
  const rangeFloor = Math.floor(currentElo / 1000) * 1000;
  const progressPct = Math.max(0, Math.min(100, ((currentElo - rangeFloor) / 1000) * 100));
  const totalMatches = historyData.stats.matches + partidosCount;
  const fiabilidad = getFiabilidad(totalMatches);
  const ac = avatarColor(currentPlayer.name);
  const avatarInitials = getInitials(currentPlayer.name);
  const displayName = currentPlayer.nickname || currentPlayer.name;
  const elocat = categoryFromElo(currentElo);
  const clubcat = currentPlayer.categories?.[0];

  return (
    <div style={{ background: PP.bg, minHeight: '100vh', paddingBottom: 96, fontFamily: PP.font }}>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div style={{ background: PP.card, padding: '20px 20px 24px', borderBottom: `1px solid ${PP.hair}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <button
            onClick={() => navigate('/p/dashboard')}
            style={{ width: 40, height: 40, borderRadius: 14, background: PP.bg, border: `1px solid ${PP.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: PP.ink2, cursor: 'pointer' }}
          >
            <ArrowLeft size={18} />
          </button>
          <span style={{ fontSize: 12, fontWeight: 700, color: PP.mute, textTransform: 'uppercase', letterSpacing: 1.2 }}>Mi Perfil</span>
          <button onClick={() => setShowChangePassModal(true)} style={{ width: 40, height: 40, borderRadius: 14, background: PP.bg, border: `1px solid ${PP.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: PP.mute, cursor: 'pointer' }}>
            <Key size={18} />
          </button>
        </div>

        {/* Avatar + nombre */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ width: 96, height: 96, borderRadius: '50%', background: ac.bg, color: ac.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 36, marginBottom: 12 }}>
            {avatarInitials}
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: PP.ink, letterSpacing: -0.6, margin: 0 }}>{displayName}</h2>
          {currentPlayer.nickname && currentPlayer.name !== displayName && (
            <p style={{ fontSize: 13, color: PP.mute, fontWeight: 600, marginTop: 2 }}>{currentPlayer.name}</p>
          )}

          {/* Category badges — Club + Global */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' as const, justifyContent: 'center' }}>
            {clubcat && (
              <div style={{ padding: '6px 14px', borderRadius: 12, background: PP.card, border: `1px solid ${PP.hairStrong}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: PP.mute, textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Club</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: PP.ink, letterSpacing: -0.3 }}>{clubcat}</span>
              </div>
            )}
            <div style={{ padding: '6px 14px', borderRadius: 12, background: PP.primaryTint, border: `1px solid ${PP.hairStrong}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: PP.mute, textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Global</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: PP.primary, letterSpacing: -0.3 }}>{CATEGORY_SHORT[elocat]}</span>
            </div>
            <div style={{ padding: '6px 14px', borderRadius: 12, background: `${fiabilidad.color}15`, border: `1px solid ${fiabilidad.color}30`, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={10} color={fiabilidad.color} />
              <span style={{ fontSize: 12, fontWeight: 700, color: fiabilidad.color }}>{fiabilidad.label}</span>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: `1px solid ${PP.hair}`, paddingTop: 16 }}>
          {[
            { label: 'Jugados',    value: totalMatches,                    color: PP.ink },
            { label: 'Victorias',  value: `${historyData.stats.winRate}%`, color: PP.ok },
            { label: 'Seguidores', value: socialStats.followers,           color: PP.ink },
            { label: 'Títulos',    value: historyData.stats.titles,        color: PP.warn },
          ].map((s, i) => (
            <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0', borderLeft: i > 0 ? `1px solid ${PP.hair}` : 'none' }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: s.color, letterSpacing: -0.5 }}>{s.value}</span>
              <span style={{ fontSize: 9, color: PP.mute, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginTop: 2 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── ELO CARD (progress + sparkline) ───────────────────────────────── */}
        <div style={{ background: PP.ink, borderRadius: 24, padding: 20, color: '#fff', boxShadow: PP.shadowLg }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.4, textTransform: 'uppercase' as const }}>Evolución ELO</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1, fontFeatureSettings: '"tnum"' }}>{currentElo}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.08)', padding: 3, borderRadius: 10 }}>
              {['1M', '3M', '6M', '1A'].map((t, i) => (
                <div key={t} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 7, background: i === 2 ? 'rgba(255,255,255,0.15)' : 'transparent', color: i === 2 ? '#fff' : 'rgba(255,255,255,0.4)' }}>{t}</div>
              ))}
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>Progreso en {CATEGORY_SHORT[elocat]}</span>
              <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{Math.round(progressPct)}%</span>
            </div>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.12)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', background: '#A5B4FC', borderRadius: 999, transition: 'width .4s ease' }} />
            </div>
          </div>
          {eloHistory.length >= 2
            ? <EloSparkline data={eloHistory} />
            : (
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12, padding: '16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={22} />
                Juega más torneos para ver tu evolución
              </div>
            )
          }
        </div>

        {/* ── CLUB RATING CARD ──────────────────────────────────────────────── */}
        {dbPlayer && (dbPlayer.club_rating != null || (dbPlayer.club_confidence ?? 0) > 0) && (
          <div style={{ background: PP.card, borderRadius: 20, padding: 16, border: `1px solid ${PP.hair}`, boxShadow: PP.shadow }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: PP.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Star size={15} color={PP.primary} /> Rating Partidos Libres
              </span>
              <span style={{ fontSize: 22, fontWeight: 800, color: PP.primary, letterSpacing: -0.5 }}>
                {dbPlayer.club_rating ?? 1200}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 6, background: PP.hair, borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, Math.max(0, ((dbPlayer.club_rating ?? 1200) - 800) / 16))}%`, height: '100%', background: PP.primary, borderRadius: 999, transition: 'width .7s ease' }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: PP.mute }}>
                {dbPlayer.club_confidence ?? 0} partido{(dbPlayer.club_confidence ?? 0) !== 1 ? 's' : ''} verificado{(dbPlayer.club_confidence ?? 0) !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}

        {/* ── FIABILIDAD CARD ────────────────────────────────────────────────── */}
        <div style={{ background: PP.card, borderRadius: 20, padding: 16, border: `1px solid ${PP.hair}`, boxShadow: PP.shadow }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `${fiabilidad.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Shield size={20} color={fiabilidad.color} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: PP.ink }}>Fiabilidad del nivel</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: fiabilidad.color }}>{fiabilidad.score}%</span>
              </div>
              <p style={{ fontSize: 11, color: PP.mute, marginTop: 2, lineHeight: 1.4 }}>
                {fiabilidad.score < 30 ? 'El sistema está aprendiendo tu nivel. Juega más partidos.'
                  : fiabilidad.score < 70 ? `Nivel en ajuste (${totalMatches} partidos). Sigue jugando.`
                  : 'Nivel estable. Tu ELO refleja con precisión tu nivel real.'}
              </p>
              <div style={{ height: 5, background: PP.hair, borderRadius: 999, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ width: `${fiabilidad.score}%`, height: '100%', background: fiabilidad.color, borderRadius: 999, transition: 'width .7s ease' }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── PREFERENCIAS CARD ──────────────────────────────────────────────── */}
        <div style={{ background: PP.card, borderRadius: 20, padding: 16, border: `1px solid ${PP.hair}`, boxShadow: PP.shadow }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: PP.ink }}>Preferencias de juego</span>
            <button
              onClick={() => setShowPrefsModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: PP.mute, background: PP.bg, border: `1px solid ${PP.hairStrong}`, borderRadius: 10, padding: '6px 12px', cursor: 'pointer' }}
            >
              <Edit3 size={11} /> Editar
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Posición', value: currentPlayer.preferred_position === 'right' ? '🎾 Derecha' : currentPlayer.preferred_position === 'backhand' ? '🎾 Revés' : '— Sin definir' },
              { label: 'Ambos lados', value: currentPlayer.play_both_sides ? '✓ Sí' : '✗ No' },
            ].map(s => (
              <div key={s.label} style={{ background: PP.bg, borderRadius: 12, padding: 12, border: `1px solid ${PP.hair}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: PP.mute, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: PP.ink2 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── TOURNAMENT HISTORY ─────────────────────────────────────────────── */}
        <div>
          <h3 style={{ fontSize: 11, fontWeight: 700, color: PP.mute, textTransform: 'uppercase' as const, letterSpacing: 1.4, marginBottom: 12, marginLeft: 4 }}>
            Historial de Torneos
          </h3>
          {historyData.tournaments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Trophy size={32} color={PP.hairStrong} style={{ margin: '0 auto 8px' }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: PP.mute }}>Sin torneos jugados todavía</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {historyData.tournaments.map(t => {
                const isOpen = expandedTournamentId === t.id;
                return (
                  <div key={t.id} style={{ background: PP.card, borderRadius: 20, border: `1px solid ${PP.hair}`, overflow: 'hidden', boxShadow: PP.shadow }}>
                    <button
                      style={{ width: '100%', padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', background: 'none', border: 0, cursor: 'pointer' }}
                      onClick={() => setExpandedTournamentId(isOpen ? null : t.id)}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <Calendar size={10} color={PP.mute} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: PP.mute }}>
                            {new Date(t.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          {t.resultBadge === 'champion' && (
                            <span style={{ background: PP.warnTint, color: PP.warn, padding: '2px 8px', borderRadius: 99, fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Trophy size={7} /> Campeón
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: PP.ink }}>{t.title}</div>
                        <div style={{ fontSize: 12, color: PP.mute, marginTop: 2 }}>{t.matches.length} partidos jugados</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: t.eloChangeTotal >= 0 ? PP.ok : '#EF4444' }}>
                          {t.eloChangeTotal > 0 ? '+' : ''}{Math.round(t.eloChangeTotal)} pts
                        </span>
                        {isOpen ? <ChevronUp size={14} color={PP.muteSoft} /> : <ChevronDown size={14} color={PP.muteSoft} />}
                      </div>
                    </button>

                    {isOpen && (
                      <div style={{ borderTop: `1px solid ${PP.hair}` }}>
                        {t.matches.map((m, i) => (
                          <div key={m.id} style={{ padding: '12px 16px', borderBottom: i < t.matches.length - 1 ? `1px solid ${PP.hair}` : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 4, borderRadius: 4, alignSelf: 'stretch', minHeight: 36, background: m.result === 'win' ? PP.ok : '#EF4444', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: PP.mute, textTransform: 'uppercase' as const }}>{m.roundLabel}</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: PP.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>vs {m.opponentsName}</div>
                              <div style={{ fontSize: 11, color: PP.mute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>con {m.partnerName}</div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: m.result === 'win' ? PP.ok : '#EF4444', fontFeatureSettings: '"tnum"' }}>{m.score}</div>
                              {m.eloDelta !== 0 && (
                                <div style={{ fontSize: 10, fontWeight: 700, color: m.eloDelta > 0 ? PP.ok : '#EF4444' }}>
                                  {m.eloDelta > 0 ? '+' : ''}{Math.round(m.eloDelta)} pts
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── ACCOUNT ACTIONS ────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
          <button
            onClick={() => setShowChangePassModal(true)}
            style={{ width: '100%', padding: '14px 0', borderRadius: 20, border: `1px solid ${PP.hairStrong}`, background: PP.card, color: PP.ink2, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}
          >
            <Key size={16} /> Cambiar contraseña
          </button>
          <button
            onClick={async () => { await signOut(); navigate('/'); }}
            style={{ width: '100%', padding: '14px 0', borderRadius: 20, border: `1px solid ${PP.hairStrong}`, background: PP.card, color: PP.ink2, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}
          >
            <LogOut size={16} /> Cerrar sesión
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{ width: '100%', padding: '14px 0', borderRadius: 20, border: '1px solid #fee2e2', background: '#fff5f5', color: '#EF4444', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}
          >
            <Trash2 size={16} /> Eliminar mi cuenta
          </button>
        </div>
      </div>

      {/* ── MODALS ──────────────────────────────────────────────────────────── */}

      <Modal isOpen={showChangePassModal} onClose={() => setShowChangePassModal(false)}
        title="Nueva Contraseña" icon={<Lock size={28} />} iconColor="brand" size="sm">
        {passSuccess ? (
          <div className="bg-emerald-50 p-6 rounded-2xl text-center">
            <Check size={40} className="mx-auto text-emerald-500 mb-2" />
            <p className="font-bold text-emerald-800">¡Contraseña guardada!</p>
          </div>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-3">
            <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#575AF9] font-bold" minLength={6} />
            <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirma contraseña"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#575AF9] font-bold" />
            {passError && <p className="text-rose-500 text-xs font-bold">{passError}</p>}
            <button type="submit" disabled={passLoading}
              className="w-full py-4 rounded-xl font-black text-white disabled:opacity-50 transition-opacity"
              style={{ background: THEME.cta }}>
              {passLoading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'GUARDAR'}
            </button>
          </form>
        )}
      </Modal>

      <Modal isOpen={showPrefsModal} onClose={() => setShowPrefsModal(false)}
        title="Preferencias de Juego" icon={<Star size={24} />} iconColor="brand" size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Posición preferida</label>
            <div className="grid grid-cols-2 gap-2">
              {(['right', 'backhand'] as const).map(pos => (
                <button key={pos} onClick={() => setPrefPosition(pos)}
                  className={`p-3.5 rounded-xl border-2 font-bold text-sm transition-all ${
                    prefPosition === pos
                      ? 'border-[#575AF9] bg-[#575AF9]/10 text-[#575AF9]'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                  {pos === 'right' ? '🎾 Derecha' : '🎾 Revés'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <div className="text-sm font-bold text-slate-700">Juego ambos lados</div>
              <div className="text-xs text-slate-400 mt-0.5">Puedo jugar de derecha y de revés</div>
            </div>
            <button
              onClick={() => setPrefBothSides(!prefBothSides)}
              className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${prefBothSides ? '' : 'bg-slate-300'}`}
              style={prefBothSides ? { background: THEME.cta } : {}}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all ${prefBothSides ? 'left-[26px]' : 'left-0.5'}`} />
            </button>
          </div>
          <button onClick={handleSavePreferences} disabled={prefSaving}
            className="w-full py-3.5 rounded-xl font-black text-white disabled:opacity-50 transition-opacity"
            style={{ background: THEME.cta }}>
            {prefSaving ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'GUARDAR PREFERENCIAS'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}
        title="¿Estás seguro?"
        body="Esta acción es irreversible. Se borrará tu perfil, historial y ranking ELO."
        icon={<AlertTriangle size={28} />} iconColor="danger"
        actions={[
          { label: 'Cancelar', onClick: () => setShowDeleteConfirm(false), variant: 'secondary' },
          { label: 'Sí, eliminar', onClick: handleDeleteAccount, variant: 'danger' },
        ]}
      />
    </div>
  );
};

export default PlayerProfile;
