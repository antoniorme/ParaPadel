
import React, { useState } from 'react';
import { useHistory } from '../store/HistoryContext';
import { Calendar, Trophy, ChevronDown, ChevronUp, Shield, Loader2 } from 'lucide-react';
import { EmptyState } from '../components';
import { Player, Pair, TournamentMatch as Match } from '../types';
import { supabase } from '../lib/supabase';

type DetailData = { players: Player[]; pairs: Pair[]; matches: Match[] };
type TabType = 'winners' | 'main' | 'cons';

const History: React.FC = () => {
  const { pastTournaments } = useHistory();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, DetailData>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [activeTabs, setActiveTabs] = useState<Record<string, TabType>>({});

  const getTab = (id: string): TabType => activeTabs[id] || 'winners';
  const setTab = (id: string, tab: TabType) => setActiveTabs(prev => ({ ...prev, [id]: tab }));

  const formatDate = (isoString: string) =>
    new Date(isoString).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const getFormatLabel = (fmt?: string) => {
    if (!fmt) return 'MINI';
    if (fmt === '16_mini') return 'MINI 16 PAREJAS';
    if (fmt === '12_mini') return 'MINI 12 PAREJAS';
    if (fmt === '10_mini') return 'MINI 10 PAREJAS';
    if (fmt === '8_mini') return 'MINI 8 PAREJAS';
    return fmt.toUpperCase();
  };

  const fmtPlayer = (p?: Player) => {
    if (!p) return '?';
    return p.nickname ? `${p.name.split(' ')[0]} "${p.nickname}"` : p.name.split(' ')[0];
  };

  const getPairName = (pairId: string, players: Player[], pairs: Pair[]) => {
    const pair = pairs.find(p => p.id === pairId);
    if (!pair) return 'Desconocido';
    const p1 = players.find(p => p.id === pair.player1Id);
    const p2 = players.find(p => p.id === pair.player2Id);
    return `${fmtPlayer(p1)} & ${fmtPlayer(p2)}`;
  };

  const fetchDetail = async (tournamentId: string, existingData?: any) => {
    if (existingData) {
      setDetailCache(prev => ({
        ...prev,
        [tournamentId]: { players: existingData.players || [], pairs: existingData.pairs || [], matches: existingData.matches || [] }
      }));
      return;
    }
    if (detailCache[tournamentId] || loadingId === tournamentId) return;
    setLoadingId(tournamentId);
    try {
      const [pairsRes, matchesRes] = await Promise.all([
        supabase.from('tournament_pairs').select('*').eq('tournament_id', tournamentId),
        supabase.from('matches').select('*').eq('tournament_id', tournamentId)
      ]);
      const rawPairs = pairsRes.data || [];
      const rawMatches = matchesRes.data || [];
      const playerIds = [...new Set(rawPairs.flatMap((p: any) => [p.player1_id, p.player2_id].filter(Boolean)))] as string[];
      const { data: rawPlayers } = playerIds.length > 0
        ? await supabase.from('players').select('id, name, nickname').in('id', playerIds)
        : { data: [] };

      const pairs: Pair[] = rawPairs.map((p: any) => ({
        id: p.id, tournament_id: p.tournament_id, player1Id: p.player1_id, player2Id: p.player2_id,
        name: p.name || 'Pareja', waterReceived: false, paidP1: false, paidP2: false,
        stats: { played: 0, won: 0, gameDiff: 0 }, isReserve: false, status: 'confirmed'
      }));
      const matches: Match[] = rawMatches.map((m: any) => ({
        id: m.id, round: m.round, phase: m.phase || 'group', bracket: m.bracket,
        courtId: m.court_id, pairAId: m.pair_a_id, pairBId: m.pair_b_id,
        scoreA: m.score_a, scoreB: m.score_b, isFinished: m.is_finished
      }));

      setDetailCache(prev => ({
        ...prev,
        [tournamentId]: { players: (rawPlayers || []) as Player[], pairs, matches }
      }));
    } catch {}
    setLoadingId(null);
  };

  const handleExpand = (t: any) => {
    const isOpening = expandedId !== t.id;
    setExpandedId(isOpening ? t.id : null);
    if (isOpening) fetchDetail(t.id, t.data);
  };

  const phaseLabel = (phase: string) => {
    if (phase === 'final') return 'Final';
    if (phase === 'sf') return 'Semifinal';
    if (phase === 'qf') return 'Cuartos de Final';
    return 'Fase de Grupos';
  };

  const renderMatches = (detail: DetailData, bracket: 'main' | 'consolation') => {
    const bracketMatches = detail.matches
      .filter(m => m.bracket === bracket && m.isFinished)
      .sort((a, b) => a.round - b.round);

    if (bracketMatches.length === 0) {
      return <p className="text-center text-slate-500 text-sm py-6">Sin resultados registrados</p>;
    }

    const grouped: Record<string, Match[]> = {};
    bracketMatches.forEach(m => {
      if (!grouped[m.phase]) grouped[m.phase] = [];
      grouped[m.phase].push(m);
    });

    const phaseOrder = ['group', 'qf', 'sf', 'final'];
    const sortedPhases = Object.keys(grouped).sort((a, b) => phaseOrder.indexOf(a) - phaseOrder.indexOf(b));

    return (
      <div className="space-y-5">
        {sortedPhases.map(phase => (
          <div key={phase}>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 pl-1">{phaseLabel(phase)}</div>
            <div className="space-y-2">
              {grouped[phase].map(match => {
                const aName = getPairName(match.pairAId, detail.players, detail.pairs);
                const bName = getPairName(match.pairBId, detail.players, detail.pairs);
                const aWins = (match.scoreA ?? 0) > (match.scoreB ?? 0);
                return (
                  <div key={match.id} className="bg-slate-800 rounded-xl px-3 py-2.5 flex items-center gap-2 text-xs">
                    <span className={`flex-1 font-bold text-right leading-tight ${aWins ? 'text-white' : 'text-slate-500'}`}>{aName}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`w-7 h-7 flex items-center justify-center rounded-lg font-black text-sm ${aWins ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'}`}>{match.scoreA ?? '-'}</span>
                      <span className="text-slate-600 text-[10px] font-black">–</span>
                      <span className={`w-7 h-7 flex items-center justify-center rounded-lg font-black text-sm ${!aWins ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'}`}>{match.scoreB ?? '-'}</span>
                    </div>
                    <span className={`flex-1 font-bold leading-tight ${!aWins ? 'text-white' : 'text-slate-500'}`}>{bName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      <h2 className="text-2xl font-black text-slate-900">Historial de Minis</h2>

      {pastTournaments.length === 0 ? (
        <EmptyState icon={<Trophy size={32}/>} title="Aún no hay torneos finalizados" />
      ) : (
        <div className="space-y-4">
          {pastTournaments.map(t => {
            const isExpanded = expandedId === t.id;
            const detail = detailCache[t.id];
            const isLoading = loadingId === t.id;
            const tab = getTab(t.id);

            return (
              <div key={t.id} className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
                <div
                  onClick={() => handleExpand(t)}
                  className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-800 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 text-slate-500 text-[10px] uppercase font-black mb-2 tracking-widest">
                      {getFormatLabel(t.format)}
                    </div>
                    <div className="text-lg font-black text-white capitalize flex items-center gap-3">
                      <Calendar size={18} className="text-indigo-500"/>
                      {formatDate(t.date)}
                    </div>
                  </div>
                  <div className={`p-3 rounded-2xl transition-all ${isExpanded ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                    {isExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                  </div>
                </div>

                {isExpanded && (
                  <div className="bg-slate-950 border-t border-slate-800">
                    {/* Tab strip */}
                    <div className="flex border-b border-slate-800">
                      {(['winners', 'main', 'cons'] as TabType[]).map(tabId => (
                        <button
                          key={tabId}
                          onClick={e => { e.stopPropagation(); setTab(t.id, tabId); }}
                          className={`flex-1 py-3 text-[11px] font-black uppercase tracking-wider transition-colors border-b-2 ${tab === tabId ? 'text-indigo-400 border-indigo-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                        >
                          {tabId === 'winners' ? 'Ganadores' : tabId === 'main' ? '🥇 Oro' : '🥈 Plata'}
                        </button>
                      ))}
                    </div>

                    <div className="p-5">
                      {tab === 'winners' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-slate-900 p-5 rounded-2xl border border-emerald-900/30 shadow-inner relative overflow-hidden">
                            <div className="absolute -right-3 -top-3 text-emerald-500/10"><Trophy size={60}/></div>
                            <div className="text-[10px] font-black text-emerald-500 uppercase mb-3 tracking-widest">Campeones Oro</div>
                            <div className="font-black text-white text-base leading-tight">
                              {t.winnerMain && t.winnerMain !== 'No registrado' ? t.winnerMain : 'No registrado'}
                            </div>
                          </div>
                          <div className="bg-slate-900 p-5 rounded-2xl border border-blue-900/30 shadow-inner relative overflow-hidden">
                            <div className="absolute -right-3 -top-3 text-blue-500/10"><Shield size={60}/></div>
                            <div className="text-[10px] font-black text-blue-500 uppercase mb-3 tracking-widest">Consolación</div>
                            <div className="font-black text-white text-base leading-tight">
                              {t.winnerConsolation && t.winnerConsolation !== 'No registrado' ? t.winnerConsolation : 'No registrado'}
                            </div>
                          </div>
                        </div>
                      )}

                      {(tab === 'main' || tab === 'cons') && (
                        isLoading ? (
                          <div className="flex items-center justify-center py-8 text-slate-500 gap-3">
                            <Loader2 size={20} className="animate-spin"/>
                            <span className="text-sm font-bold">Cargando resultados...</span>
                          </div>
                        ) : detail ? (
                          renderMatches(detail, tab === 'main' ? 'main' : 'consolation')
                        ) : (
                          <p className="text-center text-slate-500 text-sm py-6">Sin datos disponibles</p>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default History;
