import React, { useState } from 'react';
import { useTournament } from '../store/TournamentContext';
import { useTimer } from '../store/TimerContext';
import { Square, ChevronRight, Edit2, Info, User, Play, AlertTriangle, X } from 'lucide-react';

const ActiveTournament: React.FC = () => {
  const { state, updateScoreDB, nextRoundDB, startTournamentDB, formatPlayerName } = useTournament();
  const { resetTimer, startTimer } = useTimer();
  
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [nextMatchInfo, setNextMatchInfo] = useState<{ pA: string, nextCourtA: string, pB: string, nextCourtB: string } | null>(null);
  const [lastEditedMatchId, setLastEditedMatchId] = useState<string | null>(null);
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const [showRoundConfirm, setShowRoundConfirm] = useState(false);

  const currentMatches = state.matches.filter(m => m.round === state.currentRound);
  currentMatches.sort((a, b) => a.courtId - b.courtId);

  const getPairName = (id: string) => {
    const pair = state.pairs.find(p => p.id === id);
    if (!pair) return 'Unknown';
    const p1 = state.players.find(p => p.id === pair.player1Id);
    const p2 = state.players.find(p => p.id === pair.player2Id);
    return `${formatPlayerName(p1)} & ${formatPlayerName(p2)}`;
  };

  const findNextMatchInfo = (pairId: string, currentRound: number) => {
      const nextRound = currentRound + 1;
      const nextMatch = state.matches.find(m => m.round === nextRound && (m.pairAId === pairId || m.pairBId === pairId));
      if (nextMatch) return `Pista ${nextMatch.courtId}`;
      if (nextRound <= 4) return "Descansa";
      return "Pendiente";
  };

  const getPairMatches = (pairId: string) => {
      const matches = state.matches.filter(m => m.pairAId === pairId || m.pairBId === pairId);
      return matches.sort((a, b) => a.round - b.round);
  };

  const handleSaveScore = () => {
    if (selectedMatchId && scoreA !== '' && scoreB !== '') {
        const valA = parseInt(scoreA);
        const valB = parseInt(scoreB);
        if (valA === valB) return alert("El partido no puede terminar en empate.");

        updateScoreDB(selectedMatchId, valA, valB);
        
        const match = state.matches.find(m => m.id === selectedMatchId);
        if (match) {
            const info = {
                pA: getPairName(match.pairAId),
                nextCourtA: findNextMatchInfo(match.pairAId, state.currentRound),
                pB: getPairName(match.pairBId),
                nextCourtB: findNextMatchInfo(match.pairBId, state.currentRound)
            };
            setNextMatchInfo(info);
            setLastEditedMatchId(selectedMatchId);
        }

        setSelectedMatchId(null); setScoreA(''); setScoreB('');
    }
  };
  
  const handleOpenScore = (matchId: string, currentScoreA: number | null, currentScoreB: number | null) => {
      setSelectedMatchId(matchId);
      setScoreA(currentScoreA !== null ? currentScoreA.toString() : '');
      setScoreB(currentScoreB !== null ? currentScoreB.toString() : '');
  };

  const handleCloseInfoModal = () => {
      setNextMatchInfo(null);
      if (lastEditedMatchId) {
          const currentIndex = currentMatches.findIndex(m => m.id === lastEditedMatchId);
          if (currentIndex !== -1 && currentIndex < currentMatches.length - 1) {
              const nextMatch = currentMatches[currentIndex + 1];
              if (!nextMatch.isFinished) {
                  handleOpenScore(nextMatch.id, nextMatch.scoreA, nextMatch.scoreB);
              }
          }
      }
  };

  const totalMatches = currentMatches.length;
  const finishedMatches = currentMatches.filter(m => m.isFinished).length;
  const allMatchesFinished = totalMatches > 0 && totalMatches === finishedMatches;

  const handleNextRoundClick = () => {
      if (!allMatchesFinished) return alert("Todos los partidos deben finalizar antes de avanzar.");
      setShowRoundConfirm(true);
  };

  const confirmNextRound = async () => {
      setShowRoundConfirm(false);
      try {
          resetTimer(); 
          await nextRoundDB();
      } catch (e: any) {
          alert(`Error: ${e.message || e}`);
      }
  };

  const handleStart = async () => {
      await startTournamentDB();
      resetTimer(); 
      startTimer();
  }

  const PairDetailContent = ({ pairId }: { pairId: string }) => {
      const matches = getPairMatches(pairId);
      const pairName = getPairName(pairId);
      return (
          <div className="space-y-4">
              <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2 text-emerald-600">
                      <User size={32} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900">{pairName}</h3>
                  <p className="text-slate-500 text-xs uppercase font-bold">Calendario de Partidos</p>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {matches.map(m => {
                      const isPairA = m.pairAId === pairId;
                      const opponentId = isPairA ? m.pairBId : m.pairAId;
                      const opponentName = getPairName(opponentId);
                      const myScore = isPairA ? m.scoreA : m.scoreB;
                      const oppScore = isPairA ? m.scoreB : m.scoreA;
                      const resultClass = !m.isFinished ? 'bg-slate-50 border-slate-200' :
                                          (myScore || 0) > (oppScore || 0) ? 'bg-emerald-50 border-emerald-200' : 
                                          'bg-rose-50 border-rose-200';
                      return (
                          <div key={m.id} className={`p-3 rounded-xl border ${resultClass} flex justify-between items-center`}>
                              <div>
                                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                                      Ronda {m.round} - Pista {m.courtId}
                                  </div>
                                  <div className="font-bold text-slate-800 text-sm">vs {opponentName}</div>
                              </div>
                              <div className="text-lg font-black text-slate-900">
                                  {m.isFinished ? `${myScore} - ${oppScore}` : 'Pendiente'}
                              </div>
                          </div>
                      )
                  })}
                  {matches.length === 0 && <p className="text-center text-slate-400 text-sm">No hay partidos asignados.</p>}
              </div>
          </div>
      );
  };

  if (state.status === 'setup') {
      const canStart = state.pairs.filter(p => !p.isReserve).length === 16;
      return (
          <div className="flex flex-col items-center justify-center h-[60vh] p-6 text-center space-y-6">
              <div className="bg-slate-100 p-6 rounded-full">
                  <Play size={48} className="text-slate-400 ml-1" />
              </div>
              <div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">Torneo Listo</h2>
                  <p className="text-slate-500 max-w-xs mx-auto">
                      Hay {state.pairs.length} parejas registradas. {canStart ? 'Todo listo.' : 'Necesitas 16 parejas.'}
                  </p>
              </div>
              <button 
                onClick={handleStart} 
                disabled={!canStart}
                className={`px-8 py-4 rounded-xl font-bold text-lg shadow-lg flex items-center gap-2 transition-all ${canStart ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 shadow-emerald-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
              >
                  <Play size={20} fill="currentColor" /> EMPEZAR TORNEO
              </button>
          </div>
      )
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 pb-4 -mx-6 px-6 pt-4 shadow-sm">
        <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Ronda {state.currentRound}</h2>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider">
                {state.currentRound <= 4 ? 'Fase de Grupos' : 'Playoffs'}
            </span>
        </div>
      </div>

      <div className="space-y-4">
        {currentMatches.length === 0 ? (
            <div className="text-center py-10 text-slate-400 italic">Cargando partidos...</div>
        ) : (
            currentMatches.map(match => (
                <div key={match.id} className={`relative bg-white rounded-2xl border ${match.isFinished ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 shadow-sm'} overflow-hidden`}>
                    <div className="bg-slate-100 px-4 py-2 flex justify-between items-center border-b border-slate-200">
                        <span className="font-bold text-slate-700 text-sm">Pista {match.courtId}</span>
                        {match.isFinished && (
                             <button onClick={() => handleOpenScore(match.id, match.scoreA, match.scoreB)} className="p-1 text-slate-400 hover:text-blue-500">
                                 <Edit2 size={14} />
                             </button>
                        )}
                    </div>
                    
                    <div className="p-5">
                        <div 
                            className="flex items-center justify-between mb-3 cursor-pointer hover:bg-slate-50 p-1 -mx-1 rounded transition-colors"
                            onClick={() => setSelectedPairId(match.pairAId)}
                        >
                             <span className="text-lg text-slate-800 font-bold w-3/4 truncate flex items-center gap-2">
                                 {getPairName(match.pairAId)} <Info size={14} className="text-slate-300"/>
                             </span>
                             <span className="text-3xl font-black text-slate-900">{match.scoreA ?? '-'}</span>
                        </div>
                        <div 
                            className="flex items-center justify-between cursor-pointer hover:bg-slate-50 p-1 -mx-1 rounded transition-colors"
                            onClick={() => setSelectedPairId(match.pairBId)}
                        >
                             <span className="text-lg text-slate-800 font-bold w-3/4 truncate flex items-center gap-2">
                                 {getPairName(match.pairBId)} <Info size={14} className="text-slate-300"/>
                             </span>
                             <span className="text-3xl font-black text-slate-900">{match.scoreB ?? '-'}</span>
                        </div>

                        {!match.isFinished && (
                            <button 
                                onClick={() => handleOpenScore(match.id, match.scoreA, match.scoreB)}
                                className="w-full mt-6 py-4 bg-blue-600 active:bg-blue-700 rounded-xl text-base font-bold text-white shadow-md touch-manipulation"
                            >
                                Introducir Resultado
                            </button>
                        )}
                    </div>
                </div>
            ))
        )}
      </div>

      {currentMatches.length > 0 && (
          <div className="fixed bottom-20 left-0 right-0 p-6 z-50 flex justify-center">
              <button 
                onClick={handleNextRoundClick}
                disabled={!allMatchesFinished}
                className={`flex items-center gap-3 px-10 py-5 rounded-full shadow-2xl text-xl font-bold transition-all ${allMatchesFinished ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-bounce' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}
              >
                Siguiente Ronda <ChevronRight />
              </button>
          </div>
      )}

      {selectedMatchId && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-end md:items-center justify-center sm:p-4">
              <div className="bg-white rounded-t-3xl md:rounded-3xl p-8 w-full max-w-sm animate-slide-up shadow-2xl">
                  <h3 className="text-2xl font-bold text-slate-800 mb-8 text-center border-b border-slate-100 pb-4">Resultado Pista {currentMatches.find(m => m.id === selectedMatchId)?.courtId}</h3>
                  <div className="flex items-center gap-6 mb-8">
                      <div className="flex-1"><input type="number" inputMode="numeric" className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-4 text-4xl text-center font-black" value={scoreA} onChange={e => setScoreA(e.target.value)} autoFocus /></div>
                      <span className="text-slate-300 font-bold text-2xl">-</span>
                      <div className="flex-1"><input type="number" inputMode="numeric" className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-4 text-4xl text-center font-black" value={scoreB} onChange={e => setScoreB(e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => setSelectedMatchId(null)} className="py-4 rounded-xl bg-slate-100 text-slate-600 font-bold text-lg">Cancelar</button>
                      <button onClick={handleSaveScore} className="py-4 rounded-xl bg-emerald-600 text-white font-bold text-lg shadow-lg">Guardar</button>
                  </div>
              </div>
          </div>
      )}

      {nextMatchInfo && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[70] flex items-center justify-center p-6" onClick={handleCloseInfoModal}>
              <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-slide-up text-center" onClick={e => e.stopPropagation()}>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600"><Info size={24} /></div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">Próximo Partido</h3>
                  <p className="text-slate-500 text-sm mb-6">Información para los jugadores</p>
                  
                  <div className="space-y-4">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <div className="font-bold text-slate-800 text-lg mb-1">{nextMatchInfo.pA}</div>
                          <div className="text-emerald-600 font-black uppercase tracking-wide">{nextMatchInfo.nextCourtA}</div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <div className="font-bold text-slate-800 text-lg mb-1">{nextMatchInfo.pB}</div>
                          <div className="text-emerald-600 font-black uppercase tracking-wide">{nextMatchInfo.nextCourtB}</div>
                      </div>
                  </div>

                  <button 
                    onClick={handleCloseInfoModal}
                    className="w-full mt-6 py-4 bg-slate-900 text-white rounded-xl font-bold shadow-lg"
                  >
                      Entendido
                  </button>
              </div>
          </div>
      )}

      {selectedPairId && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[70] flex items-center justify-center p-6" onClick={() => setSelectedPairId(null)}>
              <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
                  <PairDetailContent pairId={selectedPairId} />
                  <button onClick={() => setSelectedPairId(null)} className="w-full mt-6 py-4 bg-slate-100 text-slate-600 rounded-xl font-bold">Cerrar</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default ActiveTournament;