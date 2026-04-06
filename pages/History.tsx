
import React, { useState } from 'react';
import { useHistory } from '../store/HistoryContext';
import { useTournament } from '../store/TournamentContext';
import { Calendar, Trophy, ChevronDown, ChevronUp, User, Users, Grid, GitMerge, Shield } from 'lucide-react';
import { EmptyState } from '../components';
import { Player, Pair, Match } from '../types';

type TabType = 'participants' | 'main' | 'cons' | 'group';

const History: React.FC = () => {
  const { pastTournaments } = useHistory();
  const { formatPlayerName, getPairElo } = useTournament(); 
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('main');

  const formatDate = (isoString: string) => {
      return new Date(isoString).toLocaleDateString('es-ES', { 
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
      });
  };

  const getFormatLabel = (fmt?: string) => {
      if (!fmt) return 'MINI';
      if (fmt === '16_mini') return 'MINI 16 PAREJAS';
      if (fmt === '12_mini') return 'MINI 12 PAREJAS';
      if (fmt === '10_mini') return 'MINI 10 PAREJAS';
      if (fmt === '8_mini') return 'MINI 8 PAREJAS';
      return fmt.toUpperCase();
  };

  const getPairName = (pairId: string, players: Player[], pairs: Pair[]) => {
      const pair = pairs.find(p => p.id === pairId);
      if (!pair) return 'Desconocido';
      const p1 = players.find(p => p.id === pair.player1Id);
      const p2 = players.find(p => p.id === pair.player2Id);
      return `${formatPlayerName(p1)} & ${formatPlayerName(p2)}`;
  };

  const getComputedWinner = (tData: any, bracket: 'main' | 'consolation') => {
      const round = bracket === 'main' ? 7 : 8;
      const finalMatch = tData.matches.find((m: Match) => m.round === round && m.bracket === bracket && m.isFinished);
      if (!finalMatch) return 'No registrado';
      const winnerId = (finalMatch.scoreA || 0) > (finalMatch.scoreB || 0) ? finalMatch.pairAId : finalMatch.pairBId;
      return getPairName(winnerId, tData.players, tData.pairs);
  };

  return (
    <div className="space-y-6 pb-20">
      <h2 className="text-2xl font-black text-slate-900">Historial de Minis</h2>

      {pastTournaments.length === 0 ? (
          <EmptyState
              icon={<Trophy size={32}/>}
              title="Aún no hay torneos finalizados"
          />
      ) : (
          <div className="space-y-4">
              {pastTournaments.map(t => {
                  const hasData = !!t.data;
                  const displayWinnerMain = (t.winnerMain && t.winnerMain !== 'Desconocido') ? t.winnerMain : (hasData ? getComputedWinner(t.data, 'main') : 'Desconocido');
                  const displayWinnerCons = (t.winnerConsolation && t.winnerConsolation !== 'Desconocido') ? t.winnerConsolation : (hasData ? getComputedWinner(t.data, 'consolation') : 'Desconocido');

                  return (
                  <div key={t.id} className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
                      <div 
                        onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
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
                          <div className={`p-3 rounded-2xl transition-all ${expandedId === t.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                              {expandedId === t.id ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                          </div>
                      </div>

                      {expandedId === t.id && (
                          <div className="bg-slate-950 border-t border-slate-800 animate-fade-in">
                              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="bg-slate-900 p-5 rounded-2xl border border-emerald-900/30 shadow-inner relative overflow-hidden">
                                      <div className="absolute -right-3 -top-3 text-emerald-500/10"><Trophy size={60}/></div>
                                      <div className="text-[10px] font-black text-emerald-500 uppercase mb-3 tracking-widest">Campeones Oro</div>
                                      <div className="font-black text-white text-base leading-tight">{displayWinnerMain}</div>
                                  </div>
                                  <div className="bg-slate-900 p-5 rounded-2xl border border-blue-900/30 shadow-inner relative overflow-hidden">
                                      <div className="absolute -right-3 -top-3 text-blue-500/10"><Shield size={60}/></div>
                                      <div className="text-[10px] font-black text-blue-500 uppercase mb-3 tracking-widest">Consolación</div>
                                      <div className="font-black text-white text-base leading-tight">{displayWinnerCons}</div>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>
              )})}
          </div>
      )}
    </div>
  );
};

export default History;
