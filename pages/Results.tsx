
import React, { useState } from 'react';
import { useTournament } from '../store/TournamentContext';
import { Trophy, Grid, GitMerge, ArrowLeft, Edit2 } from 'lucide-react';

const Results: React.FC = () => {
  const { state, updateScoreDB, formatPlayerName } = useTournament();
  // Determinar ronda de playoffs según formato
  const isMini10 = state.format === '10_mini';
  const playoffStartRound = isMini10 ? 4 : 5;
  
  const [tab, setTab] = useState<'groups' | 'bracket'>(state.currentRound >= playoffStartRound ? 'bracket' : 'groups');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [editMatchId, setEditMatchId] = useState<string | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');

  const getPairName = (id: string) => {
    const pair = state.pairs.find(p => p.id === id);
    if (!pair) return '...';
    const p1 = state.players.find(p => p.id === pair.player1Id);
    const p2 = state.players.find(p => p.id === pair.player2Id);
    return `${formatPlayerName(p1)} & ${formatPlayerName(p2)}`;
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

  const BracketMatch = ({ title, p1, p2, scoreA, scoreB }: any) => {
      const hasResult = scoreA !== null && scoreB !== null;
      const winner = hasResult ? (scoreA > scoreB ? 'p1' : 'p2') : null;

      return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mb-2">
            <div className="bg-slate-50 px-3 py-1 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100 flex justify-between">
                <span>{title}</span>
                {hasResult && <span className="text-slate-500">{scoreA} - {scoreB}</span>}
            </div>
            <div className="p-3 text-sm">
                <div className={`flex justify-between p-1 rounded ${winner === 'p1' ? 'bg-emerald-50' : ''}`}>
                    <span className={`font-medium truncate ${winner === 'p1' ? 'text-emerald-700 font-bold' : 'text-slate-600'}`}>{p1}</span>
                    {winner === 'p1' && <Trophy size={14} className="text-emerald-500 flex-shrink-0"/>}
                </div>
                <div className={`flex justify-between mt-1 p-1 rounded ${winner === 'p2' ? 'bg-emerald-50' : ''}`}>
                    <span className={`font-medium truncate ${winner === 'p2' ? 'text-emerald-700 font-bold' : 'text-slate-600'}`}>{p2}</span>
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

  // Helper to find match data by round/court or ID
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
           if (valA === valB) { return alert("El partido no puede terminar en empate."); }
          updateScoreDB(editMatchId, valA, valB);
          setEditMatchId(null);
      }
  };

  // --- BRACKET DATA PREP (DYNAMIC BASED ON FORMAT) ---
  let qf1, qf2, qf3, qf4, sf1, sf2, finalMain;
  let qfC1, qfC2, qfC3, qfC4, sfC1, sfC2, finalCons;

  // Rounds for display logic
  let roundQF, roundSF, roundFinal, roundFinalCons;

  if (isMini10) {
      // --- LOGIC 10 PAIRS ---
      // Playoffs start at Round 4
      roundQF = 4; roundSF = 5; roundFinal = 6; roundFinalCons = 4;

      // Main Bracket (Cross A vs B)
      qf1 = { ...getMatchData(4, 1), p1: getGroupPosName('A',1), p2: getGroupPosName('B',4) }; // 1A vs 4B
      qf2 = { ...getMatchData(4, 2), p1: getGroupPosName('B',1), p2: getGroupPosName('A',4) }; // 1B vs 4A
      qf3 = { ...getMatchData(4, 3), p1: getGroupPosName('A',2), p2: getGroupPosName('B',3) }; // 2A vs 3B
      qf4 = { ...getMatchData(4, 4), p1: getGroupPosName('B',2), p2: getGroupPosName('A',3) }; // 2B vs 3A
      
      sf1 = getMatchData(5, 1);
      sf2 = getMatchData(5, 2);
      finalMain = getMatchData(6, 1);

      // Consolation (Direct Final in Round 4, Court 5)
      finalCons = { ...getMatchData(4, 5), p1: getGroupPosName('A',5), p2: getGroupPosName('B',5) };

  } else {
      // --- LOGIC 16 PAIRS (DEFAULT) ---
      // Playoffs start at Round 5
      roundQF = 5; roundSF = 6; roundFinal = 7; roundFinalCons = 8;

      // Main Bracket (Cross A vs C, B vs D)
      qf1 = { ...getMatchData(5, 1), p1: getGroupPosName('A',1), p2: getGroupPosName('C',2) };
      qf2 = { ...getMatchData(5, 2), p1: getGroupPosName('C',1), p2: getGroupPosName('A',2) };
      qf3 = { ...getMatchData(5, 3), p1: getGroupPosName('B',1), p2: getGroupPosName('D',2) };
      qf4 = { ...getMatchData(5, 4), p1: getGroupPosName('D',1), p2: getGroupPosName('B',2) };
      
      sf1 = getMatchData(6, 1);
      sf2 = getMatchData(6, 2);
      finalMain = getMatchData(7, 1);

      // Consolation Bracket
      qfC1 = { ...getMatchData(5, 5), p1: getGroupPosName('A',3), p2: getGroupPosName('C',4) };
      qfC2 = { ...getMatchData(5, 6), p1: getGroupPosName('C',3), p2: getGroupPosName('A',4) };
      // Turno 2 Consolación (R6)
      qfC3 = { ...getMatchData(6, 3), p1: getGroupPosName('B',3), p2: getGroupPosName('D',4) };
      qfC4 = { ...getMatchData(6, 4), p1: getGroupPosName('D',3), p2: getGroupPosName('B',4) };
      
      sfC1 = getMatchData(7, 2);
      sfC2 = getMatchData(7, 3);
      finalCons = getMatchData(8, 1);
  }


  if (selectedGroup) {
      const group = state.groups.find(g => g.id === selectedGroup);
      const groupPairIds = group?.pairIds || [];
      const groupMatches = state.matches.filter(m => groupPairIds.includes(m.pairAId) || groupPairIds.includes(m.pairBId));
      groupMatches.sort((a, b) => a.round - b.round); 
      
      return (
          <div className="space-y-6 pb-20">
              <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setSelectedGroup(null)} className="p-2 bg-white border border-slate-200 rounded-full text-slate-600"><ArrowLeft size={20} /></button>
                  <h2 className="text-2xl font-bold text-slate-900">Partidos Grupo {selectedGroup}</h2>
              </div>

              <div className="space-y-3">
                  {groupMatches.map(match => (
                      <div key={match.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                              <span className="text-xs font-bold text-slate-400 uppercase">Ronda {match.round}</span>
                              <button onClick={() => { setEditMatchId(match.id); setScoreA(match.scoreA?.toString() || ''); setScoreB(match.scoreB?.toString() || ''); }} className="text-slate-400 hover:text-blue-500"><Edit2 size={16} /></button>
                          </div>
                          <div className="flex items-center justify-between mb-2">
                              <span className="text-slate-800 font-bold">{getPairName(match.pairAId)}</span>
                              <span className="text-xl font-black text-slate-900">{match.scoreA ?? '-'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                              <span className="text-slate-800 font-bold">{getPairName(match.pairBId)}</span>
                              <span className="text-xl font-black text-slate-900">{match.scoreB ?? '-'}</span>
                          </div>
                      </div>
                  ))}
              </div>
               {editMatchId && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl">
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
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Resultados</h2>
          <div className="flex bg-slate-200 p-1 rounded-lg">
              <button onClick={() => setTab('groups')} className={`p-2 rounded-md transition-all ${tab === 'groups' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}><Grid size={20}/></button>
              <button onClick={() => setTab('bracket')} className={`p-2 rounded-md transition-all ${tab === 'bracket' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}><GitMerge size={20}/></button>
          </div>
      </div>

      {tab === 'groups' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {state.groups.map(group => (
                <div key={group.id} onClick={() => setSelectedGroup(group.id)} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm cursor-pointer hover:border-blue-300 transition-colors group">
                    <div className="bg-slate-100 px-4 py-3 font-bold text-slate-700 flex justify-between group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors">
                        <span>GRUPO {group.id}</span>
                        <span className="text-[10px] uppercase tracking-wider bg-slate-200 px-2 py-1 rounded text-slate-500">Ver Partidos</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {getSortedGroupPairs(group.id).map((pair, idx) => (
                            <div key={pair.id} className={`flex justify-between items-center p-4 ${idx < (isMini10 ? 4 : 2) ? 'bg-emerald-50/30' : ''}`}>
                                <div className="flex items-center gap-3">
                                    <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${idx < (isMini10 ? 4 : 2) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{idx + 1}</span>
                                    <span className="text-sm font-bold text-slate-800">{getPairName(pair.id)}</span>
                                </div>
                                <div className="flex gap-4 text-sm font-mono mr-1">
                                    <div className="flex flex-col items-center"><span className="text-[10px] text-slate-400 uppercase">Vic</span><span className="font-bold text-slate-900">{pair.stats.won}</span></div>
                                    <div className="flex flex-col items-center w-8"><span className="text-[10px] text-slate-400 uppercase">Dif</span><span className={`font-bold ${pair.stats.gameDiff > 0 ? 'text-emerald-600' : pair.stats.gameDiff < 0 ? 'text-rose-500' : 'text-slate-400'}`}>{pair.stats.gameDiff > 0 ? '+' : ''}{pair.stats.gameDiff}</span></div>
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
              {/* MAIN BRACKET */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h3 className="text-emerald-600 font-bold mb-4 text-center flex items-center justify-center gap-2"><Trophy size={18}/> Cuadro Principal</h3>
                  <div className="space-y-6 relative">
                      {/* QF */}
                      <div>
                          <p className="text-xs text-slate-400 font-bold mb-2">CUARTOS DE FINAL</p>
                          <BracketMatch title="QF1" {...qf1} />
                          <BracketMatch title="QF2" {...qf2} />
                          <BracketMatch title="QF3" {...qf3} />
                          <BracketMatch title="QF4" {...qf4} />
                      </div>
                      
                      {/* SF */}
                      {state.currentRound >= roundSF && (
                          <div className="animate-fade-in">
                              <p className="text-xs text-slate-400 font-bold mb-2">SEMIFINALES</p>
                              <BracketMatch title="SF1" {...sf1} />
                              <BracketMatch title="SF2" {...sf2} />
                          </div>
                      )}

                      {/* FINAL */}
                      {state.currentRound >= roundFinal && (
                          <div className="animate-fade-in">
                              <p className="text-xs text-emerald-600 font-bold mb-2 flex items-center gap-1"><Trophy size={12}/> GRAN FINAL</p>
                              <div className="border-2 border-emerald-100 rounded-lg shadow-sm">
                                  <BracketMatch title="FINAL" {...finalMain} />
                              </div>
                          </div>
                      )}
                  </div>
              </div>

              {/* CONSOLATION BRACKET */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h3 className="text-blue-500 font-bold mb-4 text-center flex items-center justify-center gap-2"><Grid size={18}/> Consolación</h3>
                  <div className="space-y-6 relative">
                      
                      {isMini10 ? (
                          /* --- MINI 10 CONSOLATION (Direct Final) --- */
                          <div>
                              <p className="text-xs text-blue-600 font-bold mb-2 flex items-center gap-1"><Trophy size={12}/> FINAL CONSOLACIÓN</p>
                              <div className="border-2 border-blue-100 rounded-lg shadow-sm">
                                  <BracketMatch title="FINAL CONS." {...finalCons} />
                              </div>
                          </div>
                      ) : (
                          /* --- MINI 16 CONSOLATION (Full Bracket) --- */
                          <>
                            {/* QF */}
                            <div>
                                <p className="text-xs text-slate-400 font-bold mb-2">CUARTOS DE FINAL</p>
                                <BracketMatch title="QF C1" {...qfC1} />
                                <BracketMatch title="QF C2" {...qfC2} />
                                <BracketMatch title="QF C3" {...qfC3} />
                                <BracketMatch title="QF C4" {...qfC4} />
                            </div>

                            {/* SF */}
                            {state.currentRound >= 7 && (
                                <div className="animate-fade-in">
                                    <p className="text-xs text-slate-400 font-bold mb-2">SEMIFINALES</p>
                                    <BracketMatch title="SF C1" {...sfC1} />
                                    <BracketMatch title="SF C2" {...sfC2} />
                                </div>
                            )}

                             {/* FINAL */}
                             {state.currentRound >= 8 && (
                                <div className="animate-fade-in">
                                    <p className="text-xs text-blue-600 font-bold mb-2 flex items-center gap-1"><Trophy size={12}/> FINAL CONSOLACIÓN</p>
                                    <div className="border-2 border-blue-100 rounded-lg shadow-sm">
                                        <BracketMatch title="FINAL CONS." {...finalCons} />
                                    </div>
                                </div>
                            )}
                          </>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Results;
