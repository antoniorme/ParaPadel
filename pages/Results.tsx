import React, { useState } from 'react';
import { useTournament } from '../store/TournamentContext';
import { Trophy, Grid, GitMerge, ArrowLeft, Edit2 } from 'lucide-react';

const Results: React.FC = () => {
  const { state, updateScoreDB, formatPlayerName } = useTournament(); // Use global helper
  const [tab, setTab] = useState<'groups' | 'bracket'>('groups');
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
            <div className="bg-slate-50 px-3 py-1 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100">{title}</div>
            <div className="p-3 text-sm">
                <div className={`flex justify-between p-1 rounded ${winner === 'p1' ? 'bg-emerald-50' : ''}`}>
                    <span className={`font-medium ${winner === 'p1' ? 'text-emerald-700 font-bold' : 'text-slate-600'}`}>{p1}</span>
                    {winner === 'p1' && <Trophy size={14} className="text-emerald-500"/>}
                </div>
                <div className={`flex justify-between mt-1 p-1 rounded ${winner === 'p2' ? 'bg-emerald-50' : ''}`}>
                    <span className={`font-medium ${winner === 'p2' ? 'text-emerald-700 font-bold' : 'text-slate-600'}`}>{p2}</span>
                    {winner === 'p2' && <Trophy size={14} className="text-emerald-500"/>}
                </div>
            </div>
        </div>
      );
  };

  const getGroupPosName = (g: string, p: number) => {
      if (state.currentRound < 5) return `${p}º Grp ${g}`;
      const sorted = getSortedGroupPairs(g);
      const pair = sorted[p-1];
      return pair ? getPairName(pair.id) : `?`;
  };

  const getMatchData = (idSuffix: string) => {
      return { scoreA: null, scoreB: null };
  }

  const handleSaveEdit = () => {
      if (editMatchId && scoreA !== '' && scoreB !== '') {
          const valA = parseInt(scoreA);
          const valB = parseInt(scoreB);
           if (valA === valB) { return alert("El partido no puede terminar en empate."); }
          updateScoreDB(editMatchId, valA, valB);
          setEditMatchId(null);
      }
  };

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
                            <div key={pair.id} className={`flex justify-between items-center p-4 ${idx < 2 ? 'bg-emerald-50/30' : ''}`}>
                                <div className="flex items-center gap-3">
                                    <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${idx < 2 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{idx + 1}</span>
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
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h3 className="text-emerald-600 font-bold mb-4 text-center flex items-center justify-center gap-2"><Trophy size={18}/> Cuadro Principal</h3>
                  <div className="space-y-6 relative">
                      <div>
                          <p className="text-xs text-slate-400 font-bold mb-2">CUARTOS</p>
                          <BracketMatch title="QF1" p1={getGroupPosName('A',1)} p2={getGroupPosName('C',2)} {...getMatchData('qf-m-1')} />
                          <BracketMatch title="QF2" p1={getGroupPosName('C',1)} p2={getGroupPosName('A',2)} {...getMatchData('qf-m-2')} />
                          <BracketMatch title="QF3" p1={getGroupPosName('B',1)} p2={getGroupPosName('D',2)} {...getMatchData('qf-m-3')} />
                          <BracketMatch title="QF4" p1={getGroupPosName('D',1)} p2={getGroupPosName('B',2)} {...getMatchData('qf-m-4')} />
                      </div>
                      <p className="text-center text-xs text-slate-400 mt-4 italic">El cuadro se genera automáticamente al finalizar la fase de grupos.</p>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Results;