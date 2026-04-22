
import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournament } from '../../store/TournamentContext';
import { useHistory } from '../../store/HistoryContext';
import { useAuth } from '../../store/AuthContext';
import { THEME } from '../../utils/theme';
import {
  ArrowLeft, Key, Trash2, AlertTriangle, Lock, Check, Loader2,
  TrendingUp, Shield, ChevronDown, ChevronUp, Edit3, Trophy,
  Calendar, Star,
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

const EloSparkline: React.FC<{ data: number[] }> = ({ data }) => {
  if (data.length < 2) return null;
  const W = 280; const H = 64; const P = 8;
  const minV = Math.min(...data);
  const maxV = Math.max(...data);
  const range = maxV - minV || 200;
  const pts = data.map((v, i) => ({
    x: P + (i / (data.length - 1)) * (W - P * 2),
    y: P + (H - P * 2) - ((v - minV) / range) * (H - P * 2),
  }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${H - P} L${pts[0].x.toFixed(1)},${H - P} Z`;
  const isPos = data[data.length - 1] >= data[0];
  const color = isPos ? '#10b981' : '#f43f5e';
  const delta = data[data.length - 1] - data[0];

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
          <TrendingUp size={11} /> Evolución ELO
        </span>
        <span className={`text-xs font-black ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isPos ? '+' : ''}{Math.round(delta)} pts
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 64 }}>
        <defs>
          <linearGradient id="eloFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#eloFill)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={pts[0].x} cy={pts[0].y} r="3" fill="transparent" stroke={color} strokeWidth="2" />
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="4" fill={color} stroke="white" strokeWidth="2" />
      </svg>
      <div className="flex justify-between text-[10px] text-slate-600 font-mono mt-1">
        <span>{Math.round(data[0])}</span>
        <span className="font-bold" style={{ color }}>{Math.round(data[data.length - 1])}</span>
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
  const initials = currentPlayer.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const displayName = currentPlayer.nickname || currentPlayer.name;

  return (
    <div className="bg-slate-50 min-h-screen pb-24">

      {/* ── HEADER CARD ─────────────────────────────────────────────────────── */}
      <div className="bg-white px-5 pt-5 pb-6 rounded-b-3xl shadow-sm border-b border-slate-100">
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => navigate('/p/dashboard')}
            className="p-2 bg-slate-50 border border-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mi Perfil</h1>
          <button onClick={() => setShowChangePassModal(true)} className="p-2 text-slate-400 hover:text-slate-700 transition-colors">
            <Key size={18} />
          </button>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center mb-5">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#2B2DBF] to-[#575AF9] p-0.5 shadow-xl mb-3">
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-2xl font-black text-white">
              {initials}
            </div>
          </div>
          <h2 className="text-xl font-black text-slate-900">{displayName}</h2>
          {currentPlayer.nickname && currentPlayer.name !== displayName && (
            <p className="text-sm text-slate-400 mt-0.5">{currentPlayer.name}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap justify-center">
            {/* Categoría asignada por el club */}
            {currentPlayer.categories && currentPlayer.categories.length > 0 && (
              <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold uppercase">
                {currentPlayer.categories[0]}
              </span>
            )}
            {/* Categoría global por ELO — solo si difiere de la del club */}
            {(() => {
              const elocat = categoryFromElo(currentElo);
              const clubcat = currentPlayer.categories?.[0];
              if (clubcat && clubcat !== elocat) {
                return (
                  <span className="flex items-center gap-1 bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-1 rounded-full text-xs font-bold">
                    <Trophy size={10} /> Global: {CATEGORY_SHORT[elocat]}
                  </span>
                );
              }
              if (!clubcat) {
                return (
                  <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold uppercase">
                    {CATEGORY_SHORT[elocat]}
                  </span>
                );
              }
              return null;
            })()}
            <span className="font-black text-base" style={{ color: THEME.cta }}>{currentElo} pts</span>
            <span
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border"
              style={{ backgroundColor: `${fiabilidad.color}15`, color: fiabilidad.color, borderColor: `${fiabilidad.color}30` }}
            >
              <Shield size={10} /> {fiabilidad.label}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 divide-x divide-slate-100">
          {[
            { label: 'Jugados',   value: totalMatches,                  color: 'text-slate-900' },
            { label: 'Victorias', value: `${historyData.stats.winRate}%`, color: 'text-emerald-500' },
            { label: 'Seguidores', value: socialStats.followers,         color: 'text-slate-900' },
            { label: 'Títulos',   value: historyData.stats.titles,       color: 'text-amber-500' },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center py-1">
              <span className={`text-lg font-black ${s.color}`}>{s.value}</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* ── ELO CARD (progress + sparkline) ───────────────────────────────── */}
        <div className="bg-slate-900 rounded-2xl p-4 text-white">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Progreso · {CATEGORY_SHORT[categoryFromElo(currentElo)]}
            </span>
            <span className="text-xs font-bold text-slate-400">{Math.round(progressPct)}%</span>
          </div>
          <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-4">
            <div
              className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {eloHistory.length >= 2
            ? <EloSparkline data={eloHistory} />
            : (
              <div className="text-center text-slate-600 text-xs py-4 flex flex-col items-center gap-1.5">
                <TrendingUp size={22} className="text-slate-700" />
                Juega más torneos para ver tu evolución de nivel
              </div>
            )
          }
        </div>

        {/* ── CLUB RATING CARD ──────────────────────────────────────────────── */}
        {dbPlayer && (dbPlayer.club_rating != null || (dbPlayer.club_confidence ?? 0) > 0) && (
          <div className="bg-white rounded-2xl p-4 border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Star size={15} style={{ color: THEME.cta }} /> Rating Partidos Libres
              </span>
              <span className="text-xl font-black" style={{ color: THEME.cta }}>
                {dbPlayer.club_rating ?? 1200}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, Math.max(0, ((dbPlayer.club_rating ?? 1200) - 800) / 16))}%`,
                    backgroundColor: THEME.cta,
                  }}
                />
              </div>
              <span className="text-[11px] font-bold text-slate-400">
                {(dbPlayer.club_confidence ?? 0)} partido{(dbPlayer.club_confidence ?? 0) !== 1 ? 's' : ''} verificado{(dbPlayer.club_confidence ?? 0) !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}

        {/* ── FIABILIDAD CARD ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${fiabilidad.color}15` }}>
              <Shield size={20} style={{ color: fiabilidad.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-black text-slate-900">Fiabilidad del nivel</span>
                <span className="text-xl font-black" style={{ color: fiabilidad.color }}>{fiabilidad.score}%</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                {fiabilidad.score < 30
                  ? 'El sistema está aprendiendo tu nivel. Juega más partidos.'
                  : fiabilidad.score < 70
                  ? `Nivel en ajuste (${totalMatches} partidos). Sigue jugando.`
                  : `Nivel estable. Tu ELO refleja con precisión tu nivel real.`}
              </p>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${fiabilidad.score}%`, backgroundColor: fiabilidad.color }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── PREFERENCIAS CARD ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-black text-slate-900">Preferencias de juego</span>
            <button
              onClick={() => setShowPrefsModal(true)}
              className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 transition-colors"
            >
              <Edit3 size={11} /> Editar
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Posición</div>
              <div className="text-sm font-bold text-slate-700">
                {currentPlayer.preferred_position === 'right' ? '🎾 Derecha'
                  : currentPlayer.preferred_position === 'backhand' ? '🎾 Revés'
                  : <span className="text-slate-400">— Sin definir</span>}
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Ambos lados</div>
              <div className={`text-sm font-bold ${currentPlayer.play_both_sides ? 'text-emerald-600' : 'text-slate-400'}`}>
                {currentPlayer.play_both_sides ? '✓ Sí' : '✗ No'}
              </div>
            </div>
          </div>
        </div>

        {/* ── TOURNAMENT HISTORY ─────────────────────────────────────────────── */}
        <div>
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">
            Historial de Torneos
          </h3>
          {historyData.tournaments.length === 0 ? (
            <div className="text-center py-10">
              <Trophy size={32} className="mx-auto mb-2 text-slate-200" />
              <p className="text-slate-400 text-sm font-bold">Sin torneos jugados todavía</p>
            </div>
          ) : (
            <div className="space-y-2">
              {historyData.tournaments.map(t => {
                const isOpen = expandedTournamentId === t.id;
                return (
                  <div key={t.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                    <button
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedTournamentId(isOpen ? null : t.id)}
                    >
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Calendar size={10} className="text-slate-400" />
                          <span className="text-[10px] font-bold text-slate-400">
                            {new Date(t.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          {t.resultBadge === 'champion' && (
                            <span className="bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full text-[9px] font-black flex items-center gap-0.5">
                              <Trophy size={7} /> Campeón
                            </span>
                          )}
                        </div>
                        <div className="font-black text-slate-900 text-sm">{t.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{t.matches.length} partidos jugados</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-sm font-black ${t.eloChangeTotal >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {t.eloChangeTotal > 0 ? '+' : ''}{Math.round(t.eloChangeTotal)} pts
                        </span>
                        {isOpen
                          ? <ChevronUp size={14} className="text-slate-300" />
                          : <ChevronDown size={14} className="text-slate-300" />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-50 divide-y divide-slate-50">
                        {t.matches.map(m => (
                          <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                            <div className={`w-1 rounded-full self-stretch min-h-[36px] ${m.result === 'win' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] font-bold text-slate-400 uppercase">{m.roundLabel}</div>
                              <div className="text-sm font-bold text-slate-700 truncate">vs {m.opponentsName}</div>
                              <div className="text-xs text-slate-400 truncate">con {m.partnerName}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className={`text-sm font-black tabular-nums ${m.result === 'win' ? 'text-emerald-600' : 'text-rose-500'}`}>
                                {m.score}
                              </div>
                              {m.eloDelta !== 0 && (
                                <div className={`text-[10px] font-bold ${m.eloDelta > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
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
        <div className="space-y-2 pt-2">
          <button
            onClick={() => setShowChangePassModal(true)}
            className="w-full py-3.5 rounded-2xl border border-slate-200 bg-white text-slate-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
          >
            <Key size={16} /> Cambiar contraseña
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-3.5 rounded-2xl border border-rose-100 bg-rose-50 text-rose-500 font-bold text-sm flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors"
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
