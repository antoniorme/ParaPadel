import React, { useState } from 'react';
import { useTournament, GenerationMethod } from '../store/TournamentContext';
import { useTimer } from '../store/TimerContext';
import { ChevronRight, Edit2, Info, User, Play, AlertTriangle, X, TrendingUp, ListOrdered, Clock, Shuffle, Coffee, CheckCircle, XCircle, Trophy, Medal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ActiveTournament: React.FC = () => {
  const { state, updateScoreDB, nextRoundDB, startTournamentDB, formatPlayerName } = useTournament();
  const { resetTimer, startTimer } = useTimer();
  const navigate = useNavigate();
  
  // --- STATE ---
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  
  // Updated Info State to support "Eliminated" status
  const [nextMatchInfo, setNextMatchInfo] = useState<{ 
      pA_Name: string, pA_Status: string, pA_Next: string, pA_Won: boolean,
      pB_Name: string, pB_Status: string, pB_Next: string, pB_Won: boolean
  } | null>(null);

  const [lastEditedMatchId, setLastEditedMatchId] = useState<string | null>(null);
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const [showRoundConfirm, setShowRoundConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [generationMethod, setGenerationMethod] = useState<GenerationMethod>('elo-balanced');

  // --- DATA FILTERING & LOGIC ---
  const currentMatches = state.matches.filter(m => m.round === state.currentRound);
  
  // 1. Identificar partidos duplicados (Technical Rest) vs Jugables
  const sortedMatchesPriority = [...currentMatches].sort((a, b) => {
      // Pista 0 al final
      if (a.courtId === 0 && b.courtId !== 0) return 1;
      if (a.courtId !== 0 && b.courtId === 0) return -1;

      // Si comparten pista, Main va primero
      if (a.courtId === b.courtId) {
          if (a.bracket === 'main' && b.bracket !== 'main') return -1;
          if (b.bracket === 'main' && a.bracket !== 'main') return 1;
      }
      return a.courtId - b.courtId;
  });

  const playableMatchIds = new Set<string>();
  const seenCourts = new Set<number>();

  sortedMatchesPriority.forEach(m => {
      if (m.courtId > 0) {
          if (!seenCourts.has(m.courtId)) {
              playableMatchIds.add(m.id);
              seenCourts.add(m.courtId);
          }
      }
  });

  // 2. Calcular estado de finalización
  // EXCEPCIÓN: Si estamos en modo "Setup" o "Finished", no calculamos esto igual
  const activePlayableMatches = currentMatches.filter(m => playableMatchIds.has(m.id));
  const finishedPlayableMatches = activePlayableMatches.filter(m => m.isFinished).length;
  // Aceptamos avanzar si todos los jugables están terminados.
  const allMatchesFinished = activePlayableMatches.length > 0 && activePlayableMatches.length === finishedPlayableMatches;

  const isTournamentFinished = state.status === 'finished' || state.currentRound > 8;

  // --- HELPERS ---
  const getPairName = (id: string) => {
    const pair = state.pairs.find(p => p.id === id);
    if (!pair) return 'Unknown';
    const p1 = state.players.find(p => p.id === pair.player1Id);
    const p2 = state.players.find(p => p.id === pair.player2Id);
    const name1 = formatPlayerName ? formatPlayerName(p1) : (p1?.name || 'P1');
    const name2 = formatPlayerName ? formatPlayerName(p2) : (p2?.name || 'P2');
    return `${name1} & ${name2}`;
  };

  const getPairMatches = (pairId: string) => {
      const matches = state.matches.filter(m => m.pairAId === pairId || m.pairBId === pairId);
      return matches.sort((a, b) => a.round - b.round);
  };

  const getPhaseLabel = (m: any) => {
      if (m.round <= 4) return '';
      if (m.phase === 'qf') return 'Cuartos';
      if (m.phase === 'sf') return 'Semis';
      if (m.phase === 'final') return 'Final';
      return 'Playoff';
  };

  // --- PREDICTION LOGIC ---
  const predictNextRoundInfo = (matchId: string, sA: number, sB: number) => {
      const match = state.matches.find(m => m.id === matchId);
      if (!match) return null;

      const pA_Won = sA > sB;
      const round = state.currentRound;
      
      const getNextInfo = (isWinner: boolean, currentCourt: number, bracket: string | null) => {
          if (!isWinner) return { status: 'Eliminado', next: '' };
          
          if (round === 7 && bracket === 'main') return { status: '¡CAMPEÓN!', next: '🏆' }; 
          if (round === 8) return { status: '¡CAMPEÓN!', next: '🏆' };

          if (round === 5) { 
              if (bracket === 'main') {
                  if (currentCourt === 1 || currentCourt === 3) return { status: 'Clasificado a Semis', next: 'Pista 1' };
                  if (currentCourt === 2 || currentCourt === 4) return { status: 'Clasificado a Semis', next: 'Pista 2' };
              } else {
                  if (currentCourt === 5) return { status: 'Clasificado a Semis', next: 'Pista 2 (R7)' };
                  if (currentCourt === 6) return { status: 'Clasificado a Semis', next: 'Pista 3 (R7)' };
              }
          }
          
          if (round === 6) { 
              if (bracket === 'main') return { status: 'Clasificado a Final', next: 'Pista 1' };
              if (currentCourt === 3) return { status: 'Clasificado a Semis', next: 'Pista 2 (R7)' };
              if (currentCourt === 4) return { status: 'Clasificado a Semis', next: 'Pista 3 (R7)' };
          }
          
          if (round === 7 && bracket === 'consolation') {
              return { status: 'Clasificado a Final', next: 'Pista 1 (R8)' };
          }

          return { status: 'Clasificado', next: 'Siguiente Ronda' };
      };

      const infoA = getNextInfo(pA_Won, match.courtId, match.bracket as any);
      const infoB = getNextInfo(!pA_Won, match.courtId, match.bracket as any);

      return {
          pA_Name: getPairName(match.pairAId),
          pA_Status: infoA.status,
          pA_Next: infoA.next,
          pA_Won: pA_Won,
          pB_Name: getPairName(match.pairBId),
          pB_Status: infoB.status,
          pB_Next: infoB.next,
          pB_Won: !pA_Won
      };
  };

  // --- HANDLERS ---
  const handleStart = async () => {
      if (generationMethod === 'manual') {
          navigate('/registration');
          return;
      }
      try {
          await startTournamentDB(generationMethod);
          resetTimer(); 
          startTimer();
      } catch (e: any) {
          setErrorMessage(e.message || "Error desconocido al iniciar torneo.");
      }
  };

  const handleSaveScore = () => {
    if (selectedMatchId && scoreA !== '' && scoreB !== '') {
        const valA = parseInt(scoreA);
        const valB = parseInt(scoreB);
        if (valA === valB) return alert("El partido no puede terminar en empate.");

        updateScoreDB(selectedMatchId, valA, valB);
        
        const info = predictNextRoundInfo(selectedMatchId, valA, valB);
        if (info) {
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
  };

  const handleNextRoundClick = () => {
      if (!allMatchesFinished && !isTournamentFinished) {
          const remaining = activePlayableMatches.length - finishedPlayableMatches;
          // Robustez: Si el sistema falla y no detecta bien, permitir avanzar si es R7+
          if (state.currentRound < 7) {
            return alert(`No se puede avanzar ronda. Faltan ${remaining} partido(s) activos por finalizar.`);
          }
      }
      setShowRoundConfirm(true);
  };

  const confirmNextRound = async () => {
      setShowRoundConfirm(false);
      try {
          resetTimer(); 
          await nextRoundDB();
      } catch (e: any) {
          console.error("Error advancing round:", e);
          setErrorMessage(`Error al avanzar: ${e.message || e}`);
      }
  };

  // --- CALCULATE CHAMPIONS (For Finished View) ---
  const getChampions = () => {
      // Logic to find winners of Final Main (R7 Court 1) and Final Cons (R8 Court 1)
      const finalMain = state.matches.find(m => m.round === 7 && m.courtId === 1 && m.bracket === 'main');
      const finalCons = state.matches.find(m => m.round === 8 && m.courtId === 1 && m.bracket === 'consolation');

      const getWinnerName = (m?: any) => {
          if(!m || !m.isFinished) return 'Pendiente';
          return (m.scoreA > m.scoreB) ? getPairName(m.pairAId) : getPairName(m.pairBId);
      };

      return {
          main: getWinnerName(finalMain),
          cons: getWinnerName(finalCons)
      };
  };

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

  // --- VIEW: SETUP (BEFORE START) ---
  if (state.status === 'setup') {
      const canStart = state.pairs.filter(p => !p.isReserve).length === 16;
      return (
          <div className="flex flex-col items-center justify-center h-[70vh] p-6 text-center space-y-8">
              <div className="bg-slate-100 p-6 rounded-full animate-pulse">
                  <Play size={48} className="text-slate-400 ml-1" />
              </div>
              <div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">Torneo Listo</h2>
                  <p className="text-slate-500 max-w-xs mx-auto">
                      Hay {state.pairs.length} parejas registradas. {canStart ? 'Todo listo.' : 'Necesitas 16 parejas titulares.'}
                  </p>
              </div>
              
              {canStart && (
                  <div className="w-full max-w-xs space-y-2">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Configurar Grupos</p>
                      <div className="grid grid-cols-4 gap-2">
                          <button onClick={() => setGenerationMethod('arrival')} className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all ${generationMethod === 'arrival' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-400 bg-white'}`}>
                              <Clock size={18} className="mb-1"/>
                              <span className="text-[9px] font-bold uppercase text-center leading-tight">Llegada</span>
                          </button>
                          <button onClick={() => setGenerationMethod('manual')} className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all ${generationMethod === 'manual' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-400 bg-white'}`}>
                              <ListOrdered size={18} className="mb-1"/>
                              <span className="text-[9px] font-bold uppercase text-center leading-tight">Manual</span>
                          </button>
                          <button onClick={() => setGenerationMethod('elo-balanced')} className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all ${generationMethod === 'elo-balanced' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-400 bg-white'}`}>
                              <TrendingUp size={18} className="mb-1"/>
                              <span className="text-[9px] font-bold uppercase text-center leading-tight">Nivel</span>
                          </button>
                          <button onClick={() => setGenerationMethod('elo-mixed')} className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all ${generationMethod === 'elo-mixed' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-400 bg-white'}`}>
                              <Shuffle size={18} className="mb-1"/>
                              <span className="text-[9px] font-bold uppercase text-center leading-tight">Mix</span>
                          </button>
                      </div>
                  </div>
              )}

              <button 
                onClick={handleStart} 
                disabled={!canStart}
                className={`w-full max-w-xs px-8 py-5 rounded-xl font-bold text-lg shadow-xl flex items-center justify-center gap-2 transition-all ${canStart ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white active:scale-95 hover:shadow-2xl' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
              >
                  <Play size={24} fill="currentColor" /> EMPEZAR TORNEO
              </button>

               {errorMessage && (
                  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in text-center">
                          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                              <AlertTriangle size={32} />
                          </div>
                          <h3 className="text-xl font-black text-slate-900 mb-2">Error</h3>
                          <p className="text-slate-500 mb-6 text-sm break-words">{errorMessage}</p>
                          <button onClick={() => setErrorMessage(null)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg">Entendido</button>
                      </div>
                  </div>
              )}
          </div>
      )
  }

  // --- VIEW: FINISHED TOURNAMENT SUMMARY ---
  if (isTournamentFinished) {
      const champions = getChampions();
      return (
          <div className="space-y-6 pb-20 pt-10 text-center animate-fade-in">
              <div className="inline-block p-6 bg-emerald-100 rounded-full shadow-lg mb-4 animate-bounce">
                  <Trophy size={64} className="text-emerald-600" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-2">¡Torneo Finalizado!</h2>
              <p className="text-slate-500 max-w-xs mx-auto mb-10">
                  Enhorabuena a todos los participantes. Aquí están los resultados finales.
              </p>

              <div className="grid grid-cols-1 gap-6 max-w-md mx-auto">
                  <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-xl transform hover:scale-105 transition-transform">
                      <div className="flex justify-center mb-4"><Trophy size={32} className="text-yellow-300"/></div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-100 mb-2">Campeones Principales</h3>
                      <div className="text-2xl font-black">{champions.main}</div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-lg transform hover:scale-105 transition-transform">
                      <div className="flex justify-center mb-4"><Medal size={32} className="text-blue-500"/></div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Campeones Consolación</h3>
                      <div className="text-2xl font-black text-slate-800">{champions.cons}</div>
                  </div>
              </div>

              <div className="mt-12 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                  <p className="text-sm text-slate-500 mb-4">
                      Para archivar este torneo y comenzar uno nuevo, ve al panel de inicio.
                  </p>
                  <button 
                      onClick={() => navigate('/dashboard')}
                      className="px-8 py-3 bg-slate-800 text-white rounded-xl font-bold shadow-lg"
                  >
                      Ir al Panel de Control
                  </button>
              </div>
          </div>
      );
  }

  // --- VIEW: ACTIVE TOURNAMENT ---
  return (
    <div className="space-y-6 pb-32">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Ronda {state.currentRound}</h2>
          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider">
              {state.currentRound <= 4 ? 'Fase de Grupos' : 'Playoffs'}
          </span>
      </div>

      {/* Matches List */}
      <div className="space-y-4">
        {sortedMatchesPriority.length === 0 ? (
            <div className="text-center py-10 text-slate-400 italic">Cargando partidos...</div>
        ) : (
            sortedMatchesPriority.map(match => {
                // LÓGICA DE VISUALIZACIÓN
                const isWaiting = match.courtId === 0;
                // Es "Blocked" si NO es Playable (es un duplicado de pista de consolación)
                const isPlayable = playableMatchIds.has(match.id);
                const isTechnicalRest = !isPlayable && !isWaiting; // Si no es jugable y no es Court 0, es un descanso técnico

                return (
                <div key={match.id} className={`relative rounded-2xl border overflow-hidden ${isWaiting ? 'bg-slate-50 border-slate-300' : isTechnicalRest ? 'bg-slate-100 opacity-60' : match.isFinished ? 'border-emerald-200 bg-emerald-50/30' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div className={`${isWaiting ? 'bg-slate-200' : 'bg-slate-100'} px-4 py-2 flex justify-between items-center border-b border-slate-200`}>
                        <span className={`font-bold text-xs uppercase flex gap-2 items-center ${isWaiting ? 'text-slate-600' : 'text-slate-700'}`}>
                            {isWaiting ? (
                                <span className="flex items-center gap-1"><Coffee size={14}/> EN ESPERA (Siguiente Turno)</span>
                            ) : isTechnicalRest ? (
                                <span className="flex items-center gap-1"><Coffee size={14}/> DESCANSO (Pista {match.courtId})</span>
                            ) : (
                                `Pista ${match.courtId}`
                            )}
                            {getPhaseLabel(match) && <span className="text-slate-400">- {getPhaseLabel(match)}</span>}
                            {match.bracket === 'consolation' && <span className="text-blue-500">(Consolación)</span>}
                        </span>
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
                             <span className={`text-lg font-bold w-3/4 truncate flex items-center gap-2 ${isTechnicalRest ? 'text-slate-400' : 'text-slate-800'}`}>
                                 {getPairName(match.pairAId)} <Info size={14} className="text-slate-300"/>
                             </span>
                             <span className="text-3xl font-black text-slate-900">{match.scoreA ?? '-'}</span>
                        </div>
                        <div 
                            className="flex items-center justify-between cursor-pointer hover:bg-slate-50 p-1 -mx-1 rounded transition-colors"
                            onClick={() => setSelectedPairId(match.pairBId)}
                        >
                             <span className={`text-lg font-bold w-3/4 truncate flex items-center gap-2 ${isTechnicalRest ? 'text-slate-400' : 'text-slate-800'}`}>
                                 {getPairName(match.pairBId)} <Info size={14} className="text-slate-300"/>
                             </span>
                             <span className="text-3xl font-black text-slate-900">{match.scoreB ?? '-'}</span>
                        </div>

                        {!match.isFinished && !isTechnicalRest && !isWaiting && (
                            <button 
                                onClick={() => handleOpenScore(match.id, match.scoreA, match.scoreB)}
                                className={`w-full mt-6 py-4 rounded-xl text-base font-bold text-white shadow-md touch-manipulation bg-blue-600 active:bg-blue-700`}
                            >
                                Introducir Resultado
                            </button>
                        )}
                        
                        {isWaiting && !match.isFinished && (
                            <button 
                                onClick={() => handleOpenScore(match.id, match.scoreA, match.scoreB)}
                                className={`w-full mt-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-center text-xs font-bold text-slate-500 uppercase transition-colors`}
                            >
                                Forzar Resultado (Opcional)
                            </button>
                        )}

                        {isTechnicalRest && (
                             <div className="w-full mt-4 py-2 bg-slate-200 rounded-lg text-center text-xs font-bold text-slate-400 uppercase">
                                 Pista Ocupada
                             </div>
                        )}
                    </div>
                </div>
                );
            })
        )}
      </div>

      {/* Floating Action Button for Next Round - CENTERED IN CONTAINER */}
      {!isTournamentFinished && (
          <div className="fixed bottom-24 left-0 right-0 z-30 pointer-events-none">
            <div className="max-w-3xl mx-auto relative px-4 text-center pointer-events-auto">
                <button 
                    onClick={handleNextRoundClick}
                    className={`inline-flex items-center gap-2 px-8 py-4 rounded-full shadow-2xl font-black text-lg transition-all ${allMatchesFinished ? 'bg-emerald-600 text-white hover:bg-emerald-500 animate-bounce' : 'bg-slate-800 text-slate-400 opacity-90'}`}
                >
                    Siguiente Ronda <ChevronRight size={24} />
                </button>
            </div>
          </div>
      )}

      {/* MODAL: INPUT SCORE */}
      {selectedMatchId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
             <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-scale-in">
                 <div className="text-center mb-6">
                     <h3 className="text-2xl font-black text-slate-800">Resultado</h3>
                     <p className="text-slate-500">Introduce el marcador final</p>
                 </div>
                 
                 <div className="flex items-center justify-between gap-4 mb-8">
                     <div className="flex-1">
                         <div className="bg-slate-50 rounded-2xl border-2 border-slate-200 p-2 mb-2">
                             <input 
                                type="tel" 
                                value={scoreA} 
                                onChange={(e) => setScoreA(e.target.value)}
                                className="w-full bg-transparent text-center text-5xl font-black text-slate-900 outline-none p-2"
                                autoFocus
                             />
                         </div>
                         <p className="text-xs font-bold text-center text-slate-500 truncate px-1">
                             {state.matches.find(m => m.id === selectedMatchId) ? getPairName(state.matches.find(m => m.id === selectedMatchId)!.pairAId) : 'P1'}
                         </p>
                     </div>
                     <span className="text-2xl font-black text-slate-300">-</span>
                     <div className="flex-1">
                         <div className="bg-slate-50 rounded-2xl border-2 border-slate-200 p-2 mb-2">
                             <input 
                                type="tel" 
                                value={scoreB} 
                                onChange={(e) => setScoreB(e.target.value)}
                                className="w-full bg-transparent text-center text-5xl font-black text-slate-900 outline-none p-2"
                             />
                         </div>
                         <p className="text-xs font-bold text-center text-slate-500 truncate px-1">
                             {state.matches.find(m => m.id === selectedMatchId) ? getPairName(state.matches.find(m => m.id === selectedMatchId)!.pairBId) : 'P2'}
                         </p>
                     </div>
                 </div>

                 <div className="flex gap-3">
                     <button onClick={() => setSelectedMatchId(null)} className="flex-1 py-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancelar</button>
                     <button onClick={handleSaveScore} className="flex-1 py-4 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg transition-colors">Guardar</button>
                 </div>
             </div>
        </div>
      )}

      {/* MODAL: NEXT MATCH INFO */}
      {nextMatchInfo && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-scale-in text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                      <Info size={32} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-4">Resultado Playoff</h3>
                  
                  <div className="space-y-3 mb-6 text-left">
                      {/* PAIR A */}
                      <div className={`p-3 rounded-xl border ${nextMatchInfo.pA_Won ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                          <div className="flex justify-between items-center mb-1">
                              <p className="text-xs font-bold text-slate-400 uppercase">Pareja 1</p>
                              {nextMatchInfo.pA_Won ? <CheckCircle size={14} className="text-emerald-500"/> : <XCircle size={14} className="text-rose-500"/>}
                          </div>
                          <div className="font-bold text-slate-800">{nextMatchInfo.pA_Name}</div>
                          <div className={`font-bold text-sm mt-1 ${nextMatchInfo.pA_Won ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {nextMatchInfo.pA_Status} {nextMatchInfo.pA_Next ? `➜ ${nextMatchInfo.pA_Next}` : ''}
                          </div>
                      </div>

                      {/* PAIR B */}
                      <div className={`p-3 rounded-xl border ${nextMatchInfo.pB_Won ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                          <div className="flex justify-between items-center mb-1">
                              <p className="text-xs font-bold text-slate-400 uppercase">Pareja 2</p>
                              {nextMatchInfo.pB_Won ? <CheckCircle size={14} className="text-emerald-500"/> : <XCircle size={14} className="text-rose-500"/>}
                          </div>
                          <div className="font-bold text-slate-800">{nextMatchInfo.pB_Name}</div>
                          <div className={`font-bold text-sm mt-1 ${nextMatchInfo.pB_Won ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {nextMatchInfo.pB_Status} {nextMatchInfo.pB_Next ? `➜ ${nextMatchInfo.pB_Next}` : ''}
                          </div>
                      </div>
                  </div>

                  <button onClick={handleCloseInfoModal} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg">Continuar</button>
              </div>
          </div>
      )}

      {/* MODAL: ROUND CONFIRM */}
      {showRoundConfirm && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-scale-in text-center">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600 animate-pulse">
                      <Play size={40} fill="currentColor" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2">¿Avanzar Ronda?</h3>
                  <p className="text-slate-500 mb-8">
                      {state.currentRound === 5 
                        ? "Se activarán las Semifinales del Principal y los partidos de Consolación pendientes."
                        : "Se generarán los siguientes partidos. Asegúrate de que todos los resultados estén correctos."}
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                      <button onClick={confirmNextRound} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg transition-transform active:scale-95">
                          Confirmar y Avanzar
                      </button>
                      <button onClick={() => setShowRoundConfirm(false)} className="w-full py-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">
                          Revisar Resultados
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL: PAIR DETAILS */}
      {selectedPairId && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center sm:p-4">
              <div className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md shadow-2xl animate-slide-up h-[80vh] sm:h-auto flex flex-col">
                  <div className="flex justify-end mb-2">
                      <button onClick={() => setSelectedPairId(null)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><X size={20}/></button>
                  </div>
                  <PairDetailContent pairId={selectedPairId} />
              </div>
          </div>
      )}
    </div>
  );
};

export default ActiveTournament;