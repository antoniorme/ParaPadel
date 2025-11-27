
import React, { useState, useEffect } from 'react';
import { useTournament } from '../store/TournamentContext';
import { Clock, Play, Square, ChevronRight, Edit2 } from 'lucide-react';

const MATCH_DURATION = 18 * 60;

const ActiveTournament: React.FC = () => {
  const { state, updateScoreDB, nextRoundDB, startTournamentDB } = useTournament();
  const [timeLeft, setTimeLeft] = useState(MATCH_DURATION);
  const [timerActive, setTimerActive] = useState(false);
  
  useEffect(() => {
    let interval: any;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0) {
      setTimerActive(false);
      const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3');
      audio.play().catch(e => console.log("Audio play blocked", e));
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');

  const currentMatches = state.matches.filter(m => m.round === state.currentRound);
  currentMatches.sort((a, b) => a.courtId - b.courtId);

  const getPairName = (id: string) => {
    const pair = state.pairs.find(p => p.id === id);
    if (!pair) return 'Unknown';
    const p1 = state.players.find(p => p.id === pair.player1Id);
    const p2 = state.players.find(p => p.id === pair.player2Id);
    // Use Nickname if available, else first name
    const n1 = p1?.nickname || p1?.name.split(' ')[0] || '';
    const n2 = p2?.nickname || p2?.name.split(' ')[0] || '';
    return `${n1} & ${n2}`;
  };

  const handleSaveScore = () => {
    if (selectedMatchId && scoreA !== '' && scoreB !== '') {
        const valA = parseInt(scoreA);
        const valB = parseInt(scoreB);
        
        if (valA === valB) {
            alert("El partido no puede terminar en empate. Debe haber un ganador.");
            return;
        }

        updateScoreDB(selectedMatchId, valA, valB);
        setSelectedMatchId(null); setScoreA(''); setScoreB('');
    }
  };
  
  const handleOpenScore = (matchId: string, currentScoreA: number | null, currentScoreB: number | null) => {
      setSelectedMatchId(matchId);
      setScoreA(currentScoreA !== null ? currentScoreA.toString() : '');
      setScoreB(currentScoreB !== null ? currentScoreB.toString() : '');
  };

  const allMatchesFinished = currentMatches.length > 0 && currentMatches.every(m => m.isFinished);

  const handleNextRound = () => {
      if (!allMatchesFinished) return alert("Faltan resultados por introducir.");
      if(window.confirm('¿Pasar a la siguiente ronda?')) {
        setTimerActive(false);
        setTimeLeft(MATCH_DURATION);
        nextRoundDB();
      }
  };

  if (state.status === 'setup') {
      return (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 p-6 text-center">
              <p className="mb-4 text-lg">El torneo no ha comenzado.</p>
              <button onClick={() => startTournamentDB()} className="text-blue-600 font-bold">Empezar Ahora</button>
          </div>
      )
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 pb-4 -mx-6 px-6 pt-4 shadow-sm transition-all">
        <div className="flex items-center justify-between">
            <div>
                <h2 className="text-xl font-bold text-slate-900">Ronda {state.currentRound}</h2>
                <p className="text-sm text-slate-500 font-medium">{state.currentRound <= 4 ? 'Fase de Grupos' : 'Playoffs'}</p>
            </div>
            
            <div className={`flex flex-col items-end ${timeLeft === 0 ? 'animate-bounce text-red-600' : 'text-slate-800'}`}>
                <div className="text-4xl font-mono font-black tracking-wider">
                    {formatTime(timeLeft)}
                </div>
                <div className="flex gap-2 mt-1">
                    <button onClick={() => setTimerActive(!timerActive)} className="p-2 bg-slate-100 rounded-full border border-slate-300 active:scale-90 transition-transform text-slate-700">
                        {timerActive ? <Square size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                    </button>
                    <button onClick={() => setTimeLeft(MATCH_DURATION)} className="p-2 bg-slate-100 rounded-full border border-slate-300 active:scale-90 transition-transform text-slate-700">
                        <Clock size={20} />
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* Matches */}
      <div className="space-y-4">
        {currentMatches.map(match => (
            <div 
                key={match.id} 
                className={`relative bg-white rounded-2xl border ${match.isFinished ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 shadow-sm'} overflow-hidden transition-all`}
            >
                <div className="bg-slate-100 px-4 py-2 flex justify-between items-center border-b border-slate-200">
                    <span className="font-bold text-slate-700 text-sm">Pista {match.courtId}</span>
                    
                    <div className="flex items-center gap-2">
                         {match.isFinished && (
                             <>
                                <span className="text-[10px] uppercase font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">Finalizado</span>
                                <button 
                                    onClick={() => handleOpenScore(match.id, match.scoreA, match.scoreB)}
                                    className="p-1 text-slate-400 hover:text-blue-500"
                                >
                                    <Edit2 size={14} />
                                </button>
                             </>
                         )}
                    </div>
                </div>
                
                <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                         <span className="text-lg text-slate-800 font-bold w-3/4 truncate">{getPairName(match.pairAId)}</span>
                         <span className="text-3xl font-black text-slate-900">{match.scoreA ?? '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                         <span className="text-lg text-slate-800 font-bold w-3/4 truncate">{getPairName(match.pairBId)}</span>
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
        ))}
      </div>

      {allMatchesFinished && (
          <div className="fixed bottom-20 left-0 right-0 p-6 z-50 flex justify-center">
              <button 
                onClick={handleNextRound}
                className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-5 rounded-full shadow-2xl text-xl font-bold animate-bounce"
              >
                Siguiente Ronda <ChevronRight />
              </button>
          </div>
      )}

      {selectedMatchId && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-end md:items-center justify-center sm:p-4">
              <div className="bg-white rounded-t-3xl md:rounded-3xl p-8 w-full max-w-sm animate-slide-up shadow-2xl">
                  <h3 className="text-2xl font-bold text-slate-800 mb-8 text-center border-b border-slate-100 pb-4">
                      Resultado Pista {currentMatches.find(m => m.id === selectedMatchId)?.courtId}
                  </h3>
                  
                  <div className="flex items-center gap-6 mb-8">
                      <div className="flex-1">
                           <input 
                            type="number" inputMode="numeric" pattern="[0-9]*"
                            className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-4 text-4xl text-center text-slate-900 focus:border-blue-500 outline-none font-black"
                            value={scoreA} onChange={e => setScoreA(e.target.value)} autoFocus placeholder="0"
                          />
                      </div>
                      <span className="text-slate-300 font-bold text-2xl">-</span>
                      <div className="flex-1">
                           <input 
                            type="number" inputMode="numeric" pattern="[0-9]*"
                            className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-4 text-4xl text-center text-slate-900 focus:border-blue-500 outline-none font-black"
                            value={scoreB} onChange={e => setScoreB(e.target.value)} placeholder="0"
                          />
                      </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => setSelectedMatchId(null)} className="py-4 rounded-xl bg-slate-100 text-slate-600 font-bold text-lg">Cancelar</button>
                      <button onClick={handleSaveScore} className="py-4 rounded-xl bg-emerald-600 text-white font-bold text-lg shadow-lg">Guardar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ActiveTournament;
