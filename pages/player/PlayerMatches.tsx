import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournament } from '../../store/TournamentContext';
import { useHistory } from '../../store/HistoryContext';
import { THEME, getFormatColor } from '../../utils/theme';
import { Trophy, Medal, ChevronDown, ChevronUp, Swords, Compass } from 'lucide-react';
import ClubMatchBrowser from './ClubMatchBrowser';

type MatchFilter = 'all' | 'win' | 'loss';
import { calculateDisplayRanking, calculateMatchDelta, getPairTeamElo } from '../../utils/Elo';
import { TournamentState } from '../../types';
import { supabase } from '../../lib/supabase';

const getAvatarColor = (name: string): string => {
  const colors = ['#4F46E5','#7C3AED','#DB2777','#059669','#D97706','#DC2626','#0284C7','#0F766E'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

interface ProcessedMatch {
  id: string;
  roundLabel: string;
  partnerName: string;
  opponentsName: string;
  score: string;
  result: 'win' | 'loss';
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

interface FreeMatchDisplay {
  id: string;
  scheduled_at: string;
  court?: string;
  level?: string;
  share_token: string;
  result_status: string;
  myTeam: 'A' | 'B' | null;
  teamA: string[];  // player names on team A
  teamB: string[];  // player names on team B
  score_a: number;
  score_b: number;
}

const PHASE_LABELS: Record<string, string> = { group: 'Grupos', qf: 'QF', sf: 'SF', final: 'Final' };

type MainTab = 'mis' | 'explorar';

const PlayerMatches: React.FC = () => {
  const navigate = useNavigate();
  const { state, formatPlayerName } = useTournament();
  const { pastTournaments, clubData } = useHistory();

  const [mainTab, setMainTab] = useState<MainTab>('mis');
  const [myPlayerId] = useState<string>(() => localStorage.getItem('padel_sim_player_id') || '');
  const currentPlayer = state.players.find(p => p.id === myPlayerId);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [partidos, setPartidos] = useState<FreeMatchDisplay[]>([]);
  const [filter, setFilter] = useState<MatchFilter>('all');

  // Load free matches from new tables
  useEffect(() => {
    if (!myPlayerId) return;
    supabase
      .from('match_participants')
      .select(`
        player_id,
        free_matches!match_id (
          id, scheduled_at, court, level, share_token, result_status,
          match_participants!match_id (
            player_id, team, attendance_status, participant_type, guest_name,
            players!player_id (id, name)
          ),
          match_results!match_id (team_a_score, team_b_score)
        )
      `)
      .eq('player_id', myPlayerId)
      .in('attendance_status', ['joined', 'confirmed'])
      .then(({ data }) => {
        if (!data) return;
        const seen = new Set<string>();
        const rows: FreeMatchDisplay[] = [];
        for (const row of data as any[]) {
          const fm = row.free_matches;
          if (!fm || !['final', 'pending_confirmation'].includes(fm.result_status) || seen.has(fm.id)) continue;
          seen.add(fm.id);
          const result = fm.match_results?.[0];
          if (!result) continue;
          const allParts = (fm.match_participants || []).filter(
            (p: any) => p.attendance_status === 'joined' || p.attendance_status === 'confirmed'
          );
          const myPart = allParts.find((p: any) => p.player_id === myPlayerId);
          const myTeam = myPart?.team ?? null;
          const getName = (p: any) => p.players?.name || p.guest_name || '?';
          const teamA = allParts.filter((p: any) => p.team === 'A').map(getName);
          const teamB = allParts.filter((p: any) => p.team === 'B').map(getName);
          rows.push({
            id: fm.id,
            scheduled_at: fm.scheduled_at,
            court: fm.court,
            level: fm.level,
            share_token: fm.share_token,
            result_status: fm.result_status,
            myTeam,
            teamA,
            teamB,
            score_a: result.team_a_score,
            score_b: result.team_b_score,
          });
        }
        rows.sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));
        setPartidos(rows.slice(0, 20));
      })
      .catch(() => {}); // table may not exist yet
  }, [myPlayerId]);

  const historyData = useMemo(() => {
    if (!currentPlayer) return { tournaments: [], stats: { matches: 0, wins: 0, winRate: 0, titles: 0 } };

    const stats = { matches: 0, wins: 0, titles: 0, winRate: 0 };
    const processed: ProcessedTournament[] = [];

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

      tData.matches
        .filter(m => m.isFinished && (m.pairAId === myPair.id || m.pairBId === myPair.id))
        .forEach(m => {
          stats.matches++;
          const isPairA = m.pairAId === myPair.id;
          const myScore = isPairA ? m.scoreA : m.scoreB;
          const oppScore = isPairA ? m.scoreB : m.scoreA;
          const won = (myScore || 0) > (oppScore || 0);
          if (won) {
            stats.wins++;
            if (m.phase === 'final') {
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
            id: m.id,
            roundLabel: m.phase === 'group' ? `Ronda ${m.round}` : (PHASE_LABELS[m.phase] || m.phase),
            partnerName,
            opponentsName: oppNames,
            score: `${myScore ?? '—'} – ${oppScore ?? '—'}`,
            result: won ? 'win' : 'loss',
            eloDelta: myDelta,
            timestamp: m.round,
          });
        });

      tMatches.sort((a, b) => a.timestamp - b.timestamp);
      if (tMatches.length > 0) {
        processed.push({
          id: tId,
          title: tTitle || `Mini Torneo ${tData.format?.replace('_mini', '') || '16'}P`,
          date: tDate,
          format: tData.format,
          resultBadge,
          matches: tMatches,
          eloChangeTotal: tEloChange,
        });
      }
    };

    pastTournaments.forEach(pt => { if (pt.data) processTournamentState(pt.id, pt.data, pt.date); });
    if (state.status !== 'setup') processTournamentState(state.id || 'active', state, new Date().toISOString(), state.title);
    processed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    stats.winRate = stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0;
    return { tournaments: processed, stats };
  }, [currentPlayer, pastTournaments, state]);

  const { tournaments, stats } = historyData;

  const freeWins = useMemo(() =>
    partidos.filter(p => {
      const myScore = p.myTeam === 'A' ? p.score_a : p.score_b;
      const oppScore = p.myTeam === 'A' ? p.score_b : p.score_a;
      return myScore > oppScore;
    }).length,
  [partidos]);

  const totalMatches = stats.matches + partidos.length;
  const totalWins = stats.wins + freeWins;
  const totalLosses = totalMatches - totalWins;

  // Filtered tournaments — only show those that have at least one matching match
  const filteredTournaments = useMemo(() => {
    if (filter === 'all') return tournaments;
    return tournaments
      .map(t => ({ ...t, matches: t.matches.filter(m => m.result === filter) }))
      .filter(t => t.matches.length > 0);
  }, [tournaments, filter]);

  // Filtered partidos libres
  const filteredPartidos = useMemo(() => {
    if (filter === 'all') return partidos;
    return partidos.filter(p => {
      const myScore = p.myTeam === 'A' ? p.score_a : p.score_b;
      const oppScore = p.myTeam === 'A' ? p.score_b : p.score_a;
      return filter === 'win' ? myScore > oppScore : myScore <= oppScore;
    });
  }, [partidos, filter]);

  const FILTERS: { key: MatchFilter; label: string; count: number }[] = [
    { key: 'all',  label: 'Todos',     count: totalMatches },
    { key: 'win',  label: 'Victorias', count: totalWins },
    { key: 'loss', label: 'Derrotas',  count: totalLosses },
  ];

  return (
    <div className="p-4 pb-6">
      {/* Header + tab toggle */}
      <div className="mb-4">
        <h1 className="text-2xl font-black text-slate-900">Partidos</h1>
        <div className="flex gap-1 mt-3 bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => setMainTab('mis')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
              mainTab === 'mis' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
            }`}
          >
            Mis Partidos
          </button>
          <button
            onClick={() => setMainTab('explorar')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 ${
              mainTab === 'explorar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
            }`}
          >
            <Compass size={12} />
            Explorar
          </button>
        </div>
      </div>

      {/* Explorar tab */}
      {mainTab === 'explorar' && <ClubMatchBrowser />}

      {/* Mis Partidos tab */}
      {mainTab === 'mis' && (<>
      {!currentPlayer ? (
        <div className="p-8 text-center">
          <Swords size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-bold">Perfil no vinculado</p>
          <button onClick={() => navigate('/p/dashboard')} className="mt-3 text-sm font-bold" style={{ color: THEME.cta }}>Volver al inicio</button>
        </div>
      ) : (<>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Jugados',   value: totalMatches },
          { label: 'Victorias', value: stats.wins },
          { label: 'Ratio',     value: `${stats.winRate}%` },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-3 text-center border border-slate-100">
            <div className="text-xl font-black text-slate-900">{s.value}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-5">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
              filter === f.key
                ? 'text-white border-transparent shadow-sm'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
            style={filter === f.key ? { background: THEME.cta } : {}}
          >
            {f.label}
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              filter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Partidos Libres */}
      {filteredPartidos.length > 0 && (
        <div className="mb-5">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Partidos Libres</div>
          <div className="space-y-2">
            {filteredPartidos.map(p => {
              const myScore = p.myTeam === 'A' ? p.score_a : p.score_b;
              const oppScore = p.myTeam === 'A' ? p.score_b : p.score_a;
              const won = myScore > oppScore;
              const myTeamNames = (p.myTeam === 'A' ? p.teamA : p.teamB).join(' & ') || '—';
              const oppTeamNames = (p.myTeam === 'A' ? p.teamB : p.teamA).join(' & ') || '—';
              return (
                <div
                  key={p.id}
                  className="bg-white rounded-xl p-3 border border-slate-100 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-all"
                  onClick={() => navigate(`/m/${p.share_token}`)}
                >
                  <div className={`w-1.5 rounded-full self-stretch ${won ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-400 mb-0.5">
                      {new Date(p.scheduled_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      {p.court ? ` · ${p.court}` : ''}
                    </div>
                    <div className="text-sm font-bold text-slate-700 truncate">
                      {myTeamNames} <span className="text-slate-400 font-normal">vs</span> {oppTeamNames}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-lg font-black tabular-nums ${won ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {myScore}–{oppScore}
                    </div>
                    {p.result_status === 'pending_confirmation' && (
                      <div className="text-[10px] font-bold text-amber-500 mt-0.5">Pendiente</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tournament History */}
      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Historial de Torneos</div>

      {filteredTournaments.length === 0 ? (
        <div className="text-center py-12">
          <Trophy size={36} className="mx-auto mb-3 text-slate-200" />
          <p className="text-slate-400 font-bold text-sm">
            {filter === 'all' ? 'Sin torneos jugados todavía' : `Sin ${filter === 'win' ? 'victorias' : 'derrotas'} registradas`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTournaments.map(t => {
            const isExpanded = expandedId === t.id;
            const color = getFormatColor(t.format as any);
            const dateStr = new Date(t.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
            return (
              <div key={t.id} className="rounded-2xl overflow-hidden border border-slate-800" style={{ background: '#0F172A' }}>
                {/* Tournament header */}
                <button
                  className="w-full p-4 flex items-center gap-3 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black shrink-0"
                    style={{ background: color }}>
                    {t.format?.replace('_mini', '') || '16'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black text-white">{t.title}</div>
                    <div className="text-xs text-slate-500">{dateStr}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.resultBadge === 'champion' && (
                      <span className="text-xs font-black bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Trophy size={10} /> Campeón
                      </span>
                    )}
                    {t.resultBadge === 'consolation' && (
                      <span className="text-xs font-black bg-slate-600 text-slate-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Medal size={10} /> Consolación
                      </span>
                    )}
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${t.eloChangeTotal >= 0 ? 'bg-emerald-900 text-emerald-400' : 'bg-rose-900 text-rose-400'}`}>
                      {t.eloChangeTotal >= 0 ? '+' : ''}{Math.round(t.eloChangeTotal)} ELO
                    </span>
                    {isExpanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                  </div>
                </button>

                {/* Match list */}
                {isExpanded && (
                  <div className="border-t border-slate-800 divide-y divide-slate-800">
                    {t.matches.map(m => (
                      <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                        <div className={`w-1.5 rounded-full self-stretch ${m.result === 'win' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">{m.roundLabel}</div>
                          <div className="text-xs font-bold text-slate-300 truncate">
                            <span className="text-slate-500">vs </span>{m.opponentsName}
                          </div>
                          <div className="text-[10px] text-slate-600 mt-0.5">Con {m.partnerName}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-sm font-black tabular-nums ${m.result === 'win' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {m.score}
                          </div>
                          <div className={`text-[10px] font-bold ${m.eloDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {m.eloDelta >= 0 ? '+' : ''}{Math.round(m.eloDelta)} ELO
                          </div>
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
      </>)} {/* end currentPlayer check */}
      </>)} {/* end mis tab */}
    </div>
  );
};

export default PlayerMatches;
