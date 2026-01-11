
import React, { useState } from 'react';
import { useTournament } from '../store/TournamentContext';
import { getFormatColor } from '../utils/theme';
import { Trophy, Grid, GitMerge, ArrowLeft, Edit2, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { PosterGenerator } from '../components/PosterGenerator';

const Results: React.FC = () => {
  const { state, updateScoreDB, formatPlayerName } = useTournament();
  
  // Format Logic Helpers
  const isMini10 = state.format === '10_mini';
  const isMini8 = state.format === '8_mini';
  const isMini12 = state.format === '12_mini';
  
  // Dynamic Theme Color
  const themeColor = getFormatColor(state.format);

  let playoffStartRound = 5; // Default 16
  if (isMini10) playoffStartRound = 4;
  if (isMini8) playoffStartRound = 4;
  if (isMini12) playoffStartRound = 4;
  
  const [tab, setTab] = useState<'groups' | 'bracket'>(state.currentRound >= playoffStartRound ? 'bracket' : 'groups');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [editMatchId, setEditMatchId] = useState<string | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // Poster Logic
  const [showPoster, setShowPoster] = useState(false);
  const [posterData, setPosterData] = useState<any>(null);

  const getPairName = (id: string) => {
    const pair = state.pairs.find(p => p.id === id);
    if (!pair) return '...';
    const p1 = state.players.find(p => p.id === pair.player1Id);
    const p2 = state.players.find(p => p.id === pair.player2Id);
    return `${formatPlayerName(p1)} & ${formatPlayerName(p2)}`;
  };

  const handleOpenPoster = (winnerName: string) => {
      setPosterData({
          title: state.title || "Mini Torneo",
          winnerNames: winnerName,
          category: state.levelRange || "Abierto",
          type: 'champions'
      });
      setShowPoster(true);
  };

  const getSortedGroupPairs = (groupId: string) => {
      const group = state.groups.find(g => g.id === groupId);
      if (!group) return [];
      const pairs = group.pairIds.map(pid => state.pairs.find(p => p.id === pid)!);
      return pairs.sort((a, b) => {
          if (b.stats.won !== a.stats.won) return b.stats.won - a.stats.won;
          return b.stats.gameDiff - a.stats.gameDiff;
      });
  };

  const BracketMatch = ({ title, p1, p2, scoreA, scoreB, isFinal }: any) => {
      const hasResult = scoreA !== null && scoreB !== null;
      const winner = hasResult ? (scoreA > scoreB ? 'p1' : 'p2') : null;

      return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mb-2 relative group">
            <div className="bg-slate-50 px-3 py-1 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100 flex justify-between items-center">
                <span>{title}</span>
                <div className="flex items-center gap-2">
                    {hasResult && <span className="text-slate-800">{scoreA} - {scoreB}</span>}
                    {isFinal && hasResult && (
                        <button 
                            onClick={() => handleOpenPoster(winner === 'p1' ? p1 : p2)}
                            className="p-1 text-amber-500 hover:scale-110 transition-transform"
                        >
                            <ImageIcon size={14}/>
                        </button>
                    )}
                </div>
            </div>
            <div className="p-3 text-sm">
                <div className={`flex justify-between p-1 rounded ${winner === 'p1' ? 'bg-emerald-50' : ''}`}>
                    <span className={`font-medium truncate ${winner === 'p1' ? 'text-emerald-600 font-bold' : 'text-slate-600'}`}>{p1}</span>
                    {winner === 'p1' && <Trophy size={14} className="text-emerald-500 flex-shrink-0"/>}
                </div>
                <div className={`flex justify-between mt-1 p-1 rounded ${winner === 'p2' ? 'bg-emerald-50' : ''}`}>
                    <span className={`font-medium truncate ${winner === 'p2' ? 'text-emerald-600 font-bold' : 'text-slate-600'}`}>{p2}</span>
                    {winner === 'p2' && <Trophy size={14} className="text-emerald-500 flex-shrink-0"/>}
                </div>
            </div>
        </div>
      );
  };

  const getGroupPosName = (g: string, p: number) => {
      if (state.currentRound < playoffStartRound) return `${p}º Grp ${g}`;
      const sorted = getSortedGroupPairs(g);
      const pair = sorted[p-1];
      return pair ? getPairName(pair.id) : `?`;
  };

  const getMatchData = (round: number, courtId: number) => {
      const m = state.matches.find(m => m.round === round && m.courtId === courtId);
      if (!m) return { p1: '?', p2: '?', scoreA: null, scoreB: null };
      return {
          p1: getPairName(m.pairAId),
          p2: getPairName(m.pairBId),
          scoreA: m.scoreA,
          scoreB: m.scoreB
      };
  };

  const handleSaveEdit = () => {
      if (editMatchId && scoreA !== '' && scoreB !== '') {
          const valA = parseInt(scoreA);
          const valB = parseInt(scoreB);
           if (valA === valB) { 
               setAlertMessage("El partido no puede terminar en empate.");
               return; 
           }
          updateScoreDB(editMatchId, valA, valB);
          setEditMatchId(null);
      }
  };

  // --- BRACKET DATA PREP ---
  let qf1, qf2, qf3, qf4, sf1, sf2, finalMain;
  let qfC1, qfC2, qfC3, qfC4, sfC1, sfC2, finalCons;
  let roundQF, roundSF, roundFinal, roundFinalCons;

  if (isMini10) {
      roundQF = 4; roundSF = 5; roundFinal = 6; roundFinalCons = 4;
      qf1 = { ...getMatchData(4, 1), p1: getGroupPosName('A',1), p2: getGroupPosName('B',4) }; 
      qf2 = { ...getMatchData(4, 2), p1: getGroupPosName('B',1), p2: getGroupPosName('A',4) }; 
      qf3 = { ...getMatchData(4, 3), p1: getGroupPosName('A',2), p2: getGroupPosName('B',3) }; 
      qf4 = { ...getMatchData(4, 4), p1: getGroupPosName('B',2), p2: getGroupPosName('A',3) }; 
      sf1 = getMatchData(5, 1); sf2 = getMatchData(5, 2); finalMain = getMatchData(6, 1);
      finalCons = { ...getMatchData(4, 5), p1: getGroupPosName('A',5), p2: getGroupPosName('B',5) };
  } 
  else if (isMini8) {
      roundQF = 4; roundSF = 5; roundFinal = 6; roundFinalCons = 6;
      qf1 = { ...getMatchData(4, 1), p1: getGroupPosName('A',1), p2: getGroupPosName('B',2) }; 
      qf2 = { ...getMatchData(4, 2), p1: getGroupPosName('B',1), p2: getGroupPosName('A',2) }; 
      qf3 = { ...getMatchData(4, 3), p1: getGroupPosName('A',3), p2: getGroupPosName('B',4) }; 
      qf4 = { ...getMatchData(4, 4), p1: getGroupPosName('B',3), p2: getGroupPosName('A',4) }; 
      sf1 = getMatchData(5, 1); sf2 = getMatchData(5, 2); finalMain = getMatchData(6, 1);
      sfC1 = getMatchData(5, 3); sfC2 = getMatchData(5, 4); finalCons = getMatchData(6, 2);
  }
  else if (isMini12) {
      roundQF = 4; roundSF = 5; roundFinal = 6; roundFinalCons = 5;
      qf1 = getMatchData(4, 1); qf2 = getMatchData(4, 2); qf3 = getMatchData(4, 3); qf4 = getMatchData(4, 4);
      sf1 = getMatchData(5, 1); sf2 = getMatchData(5, 2); finalMain = getMatchData(6, 1);
      sfC1 = getMatchData(4, 5); sfC2 = getMatchData(4, 6); finalCons = getMatchData(5, 3);
  }
  else {
      // 16 Pairs (Default)
      roundQF = 5; roundSF = 6; roundFinal = 7; roundFinalCons = 8;
      qf1 = { ...getMatchData(5, 1), p1: getGroupPosName('A',1), p2: getGroupPosName('C',2) };
      qf2 = { ...getMatchData(5, 2), p1: getGroupPosName('C',1), p2: getGroupPosName('A',2) };
      qf3 = { ...getMatchData(5, 3), p1: getGroupPosName('B',1), p2: getGroupPosName('D',2) };
      qf4 = { ...getMatchData(5, 4), p1: getGroupPosName('D',1), p2: getGroupPosName('B',2) };
      sf1 = getMatchData(6, 1); sf2 = getMatchData(6, 2); finalMain = getMatchData(7, 1);
      qfC1 = { ...getMatchData(5, 5), p1: getGroupPosName('A',3), p2: getGroupPosName('C',4) };
      qfC2 = { ...getMatchData(5, 6), p1: getGroupPosName('C',3), p2: getGroupPosName('A',4) };
      qfC3 = { ...getMatchData(6, 3), p1: getGroupPosName('B',3), p2: getGroupPosName('D',4) };
      qfC4 = { ...getMatchData(6, 4), p1: getGroupPosName('D',3), p2: getGroupPosName('B',4) };
      sfC1 = getMatchData(7, 2); sfC2 = getMatchData(7, 3); finalCons = getMatchData(8, 1);
  }

  if (selectedGroup) {
      const group = state.groups.find(g => g.id === selectedGroup);
      const groupPairIds = group?.pairIds || [];
      const groupMatches = state.matches.filter(m => groupPairIds.includes(m.pairAId) || groupPairIds.includes(m.pairBId));
      groupMatches.sort((a, b) => a.round - b.round); 
      return (
          <div className="space-y-6 pb-20 text-white">
              <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setSelectedGroup(null)} className="p-2 bg-white/10 border border-white/10 rounded-full text-slate-300 hover:text-white hover:bg-white/20"><ArrowLeft size={20} /></button>
                  <h2 className="text-2xl font-bold">Partidos Grupo {selectedGroup}</h2>
              </div>
              <div className="space-y-3">
                  {groupMatches.map(match => (
                      <div key={match.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm text-slate-900">
                          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                              <span className="text-xs font-bold text-slate-400 uppercase">Ronda {match.round}</span>
                              <button onClick={() => { setEditMatchId(match.id); setScoreA(match.scoreA?.toString() || ''); setScoreB(match.scoreB?.toString() || ''); }} className="text-slate-400 hover:text-blue-500"><Edit2 size={16} /></button>
                          </div>
                          <div className="flex items-center justify-between mb-2">
                              <span className="text-slate-700 font-bold">{getPairName(match.pairAId)}</span>
                              <span className="text-xl font-black text-slate-900">{match.scoreA ?? '-'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                              <span className="text-slate-700 font-bold">{getPairName(match.pairBId)}</span>
                              <span className="text-xl font-black text-slate-900">{match.scoreB ?? '-'}</span>
                          </div>
                      </div>
                  ))}
              </div>
               {editMatchId && (
                    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl text-slate-900">
                            <h3 className="text-lg font-bold mb-4 text-center">Editar Resultado</h3>
                             <div className="flex gap-4 mb-6">
                                <input type="number" value={scoreA} onChange={e => setScoreA(e.target.value)} className="flex-1 bg-slate-50 border rounded-xl p-3 text-2xl text-center font-bold text-slate-900" />
                                <span className="text-2xl font-bold text-slate-300">-</span>
                                <input type="number" value={scoreB} onChange={e => setScoreB(e.target.value)} className="flex-1 bg-slate-50 border rounded-xl p-3 text-2xl text-center font-bold text-slate-900" />
                             </div>
                             <div className="flex gap-2">
                                 <button onClick={() => setEditMatchId(null)} className="flex-1 py-3 rounded-xl bg-slate-100 font-bold text-slate-600">Cancelar</button>
                                 <button onClick={handleSaveEdit} className="flex-1 py-3 rounded-xl bg-emerald-600 font-bold text-white">Guardar</button>
                             </div>
                        </div>
                    </div>
               )}
          </div>
      );
  }

  return (
    <div className="space-y-6 pb-20 text-white">
      <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">Resultados</h2>
            <div className="px-3 py-1 bg-white/10 text-white rounded-lg text-xs font-bold uppercase tracking-wider border border-white/10">
                Ronda {state.currentRound}
            </div>
          </div>
          <div className="flex bg-white/10 p-1 rounded-lg">
              <button onClick={() => setTab('groups')} style={{ color: tab === 'groups' ? themeColor : undefined }} className={`p-2 rounded-md transition-all ${tab === 'groups' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}><Grid size={20}/></button>
              <button onClick={() => setTab('bracket')} style={{ color: tab === 'bracket' ? themeColor : undefined }} className={`p-2 rounded-md transition-all ${tab === 'bracket' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}><GitMerge size={20}/></button>
          </div>
      </div>

      {tab === 'groups' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {state.groups.map(group => (
                <div key={group.id} onClick={() => setSelectedGroup(group.id)} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm cursor-pointer hover:border-blue-500/50 transition-colors group">
                    <div className="bg-slate-50 px-4 py-3 font-bold text-slate-600 flex justify-between group-hover:bg-slate-100 group-hover:text-slate-800 transition-colors">
                        <span>GRUPO {group.id}</span>
                        <span className="text-[10px] uppercase tracking-wider bg-white px-2 py-1 rounded text-slate-400 border border-slate-100">Ver Partidos</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {getSortedGroupPairs(group.id).map((pair, idx) => (
                            <div key={pair.id} className={`flex justify-between items-center p-4 ${idx < (isMini12 ? 2 : isMini10 ? 4 : 2) ? 'bg-emerald-50' : ''}`}>
                                <div className="flex items-center gap-3">
                                    <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${idx < (isMini12 ? 2 : isMini10 ? 4 : 2) ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{idx + 1}</span>
                                    <span className="text-sm font-bold text-slate-800">{getPairName(pair.id)}</span>
                                </div>
                                <div className="flex gap-4 text-sm font-mono mr-1">
                                    <div className="flex flex-col items-center"><span className="text-[10px] text-slate-400 uppercase">Vic</span><span className="font-bold text-slate-800">{pair.stats.won}</span></div>
                                    <div className="flex flex-col items-center w-8"><span className="text-[10px] text-slate-400 uppercase">Dif</span><span className={`font-bold ${pair.stats.gameDiff > 0 ? 'text-emerald-500' : pair.stats.gameDiff < 0 ? 'text-rose-500' : 'text-slate-400'}`}>{pair.stats.gameDiff > 0 ? '+' : ''}{pair.stats.gameDiff}</span></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
      )}

      {tab === 'bracket' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* MAIN BRACKET - INVERTED ORDER (FINAL -> SF -> QF) */}
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                  <h3 className="text-emerald-400 font-bold mb-4 text-center flex items-center justify-center gap-2"><Trophy size={18}/> Cuadrante Oro</h3>
                  <div className="space-y-6 relative flex flex-col-reverse">
                      
                      {/* QF */}
                      <div>
                          <p className="text-xs text-slate-400 font-bold mb-2 uppercase tracking-widest">Cuartos</p>
                          <BracketMatch title="QF1" {...qf1} />
                          <BracketMatch title="QF2" {...qf2} />
                          <BracketMatch title="QF3" {...qf3} />
                          <BracketMatch title="QF4" {...qf4} />
                      </div>
                      
                      {/* SF */}
                      {state.currentRound >= roundSF && (
                          <div className="animate-fade-in mb-4">
                              <p className="text-xs text-slate-400 font-bold mb-2 uppercase tracking-widest">Semis</p>
                              <BracketMatch title="SF1" {...sf1} />
                              <BracketMatch title="SF2" {...sf2} />
                          </div>
                      )}

                      {/* FINAL */}
                      {state.currentRound >= roundFinal && (
                          <div className="animate-fade-in mb-4">
                              <p className="text-xs text-emerald-400 font-bold mb-2 flex items-center gap-1 uppercase tracking-widest"><Trophy size={12}/> Gran Final</p>
                              <div className="border-2 border-amber-500/50 rounded-lg shadow-lg bg-amber-500/10">
                                  <BracketMatch title="FINAL ORO" {...finalMain} isFinal={true} />
                              </div>
                          </div>
                      )}
                  </div>
              </div>

              {/* CONSOLATION BRACKET - INVERTED ORDER */}
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                  <h3 className="text-blue-400 font-bold mb-4 text-center flex items-center justify-center gap-2"><Grid size={18}/> Cuadrante Plata</h3>
                  <div className="space-y-6 relative flex flex-col-reverse">
                      
                      {isMini10 ? (
                          /* --- MINI 10 CONSOLATION (Direct Final) --- */
                          <div>
                              <p className="text-xs text-blue-400 font-bold mb-2 flex items-center gap-1 uppercase tracking-widest"><Trophy size={12}/> Final Consolación</p>
                              <div className="border-2 border-blue-500/30 rounded-lg shadow-sm">
                                  <BracketMatch title="FINAL PLATA" {...finalCons} isFinal={true} />
                              </div>
                          </div>
                      ) : (
                          /* --- OTHERS --- */
                          <>
                             {/* FINAL */}
                             {state.currentRound >= roundFinalCons && (
                                <div className="animate-fade-in mb-4">
                                    <p className="text-xs text-blue-400 font-bold mb-2 flex items-center gap-1 uppercase tracking-widest"><Trophy size={12}/> Final Plata</p>
                                    <div className="border-2 border-blue-500/30 rounded-lg shadow-sm">
                                        <BracketMatch title="FINAL PLATA" {...finalCons} isFinal={true} />
                                    </div>
                                </div>
                            )}
                          </>
                      )}
                  </div>
              </div>
          </div>
      )}

      <PosterGenerator 
        isOpen={showPoster} 
        onClose={() => setShowPoster(false)} 
        data={posterData} 
      />
    </div>
  );
};

export default Results;
