
import React, { useState, useEffect } from 'react';
import { useTournament } from '../store/TournamentContext';
import { THEME, getFormatColor } from '../utils/theme';
import { useTimer } from '../store/TimerContext';
import { ChevronRight, Edit2, Info, User, Play, RotateCcw, CheckCircle, XCircle, Trophy, Medal, Settings, Coffee, ArrowRight, Archive, X, AlertTriangle, CloudOff, RefreshCw } from 'lucide-react';
import { Modal } from '../components';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

// --- TYPES ---
interface NextMatchInfo {
    pairA: { name: string; status: 'win' | 'loss'; nextText: string; highlight: boolean };
    pairB: { name: string; status: 'win' | 'loss'; nextText: string; highlight: boolean };
}

interface AlertState {
    type: 'error' | 'success' | 'info';
    title: string;
    message: string;
}

// --- EXTRACTED COMPONENT: PAIR DETAIL MODAL ---
const PairDetailModal = ({ pairId, onClose }: { pairId: string; onClose: () => void }) => {
    const { state, formatPlayerName } = useTournament();

    const getPairName = (id: string) => {
        const pair = state.pairs.find(p => p.id === id);
        if (!pair) return 'Unknown';
        const p1 = state.players.find(p => p.id === pair.player1Id);
        const p2 = state.players.find(p => p.id === pair.player2Id);
        return `${formatPlayerName(p1)} & ${formatPlayerName(p2)}`;
    };

    const matches = state.matches.filter(m => m.pairAId === pairId || m.pairBId === pairId).sort((a, b) => a.round - b.round);
    const pairName = getPairName(pairId);

    return (
        <Modal isOpen={true} onClose={onClose} title={pairName} body="Calendario de Partidos" icon={<User size={28}/>} iconColor="brand" size="md">
            <div className="space-y-2 max-h-72 overflow-y-auto">
                {matches.map(m => {
                    const isPairA = m.pairAId === pairId;
                    const opponentId = isPairA ? m.pairBId : m.pairAId;
                    const opponentName = getPairName(opponentId);
                    const myScore = isPairA ? m.scoreA : m.scoreB;
                    const oppScore = isPairA ? m.scoreB : m.scoreA;
                    let resultClass = 'bg-slate-50 border-slate-200';
                    if (m.isFinished) {
                        if ((myScore || 0) > (oppScore || 0)) resultClass = 'bg-emerald-50 border-emerald-200';
                        else resultClass = 'bg-rose-50 border-rose-200';
                    }
                    return (
                        <div key={m.id} className={`p-3 rounded-xl border ${resultClass} flex justify-between items-center text-left`}>
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">R{m.round} - P{m.courtId}</div>
                                <div className="font-bold text-slate-800 text-sm">vs {opponentName}</div>
                            </div>
                            <div className="text-lg font-black text-slate-900">{m.isFinished ? `${myScore} - ${oppScore}` : 'Pendiente'}</div>
                        </div>
                    );
                })}
            </div>
        </Modal>
    );
};

// --- MAIN COMPONENT ---
export default function ActiveTournament() {
  const { state, updateScoreDB, nextRoundDB, resetToSetupDB, formatPlayerName, finishTournamentDB, archiveAndResetDB, pendingSyncCount, setOverlayOpen } = useTournament();
  const { resetTimer } = useTimer();
  const { isOnline } = useAuth();
  const navigate = useNavigate();
  
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  
  const [nextMatchInfo, setNextMatchInfo] = useState<NextMatchInfo | null>(null);
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const [showRoundConfirm, setShowRoundConfirm] = useState(false);
  const [alertMessage, setAlertMessage] = useState<AlertState | null>(null);
  
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  // Sync Overlay State
  const isAnyModalOpen = !!(selectedMatchId || nextMatchInfo || alertMessage || showResetConfirm || showRoundConfirm || selectedPairId || showArchiveConfirm);
  useEffect(() => {
      setOverlayOpen(isAnyModalOpen);
      return () => setOverlayOpen(false);
  }, [isAnyModalOpen, setOverlayOpen]);

  const themeColor = getFormatColor(state.format);

  const currentMatches = state.matches.filter(m => m.round === state.currentRound);
  
  const sortedMatchesPriority = [...currentMatches].sort((a, b) => {
      if (a.courtId === 0 && b.courtId !== 0) return 1;
      if (a.courtId !== 0 && b.courtId === 0) return -1;
      if (a.courtId === b.courtId) { if (a.bracket === 'main' && b.bracket !== 'main') return -1; if (b.bracket === 'main' && a.bracket !== 'main') return 1; }
      return a.courtId - b.courtId;
  });

  const playableMatchIds = new Set<string>();
  const seenCourts = new Set<number>();
  sortedMatchesPriority.forEach(m => { if (m.courtId > 0) { if (!seenCourts.has(m.courtId)) { playableMatchIds.add(m.id); seenCourts.add(m.courtId); } } });

  const activePlayableMatches = currentMatches.filter(m => playableMatchIds.has(m.id));
  const finishedPlayableMatches = activePlayableMatches.filter(m => m.isFinished).length;
  const allMatchesFinished = activePlayableMatches.length > 0 && activePlayableMatches.length === finishedPlayableMatches;
  const isTournamentFinished = state.status === 'finished' || state.currentRound > 8;

  let maxRound = 6;
  if (state.format === '16_mini') {
      const isSimultaneous = state.courts.length >= 8;
      maxRound = isSimultaneous ? 7 : 8;
  }
  const isFinalRound = state.currentRound === maxRound;

  const getPairName = (id: string) => {
    const pair = state.pairs.find(p => p.id === id);
    if (!pair) return 'Unknown';
    const p1 = state.players.find(p => p.id === pair.player1Id);
    const p2 = state.players.find(p => p.id === pair.player2Id);
    return `${formatPlayerName(p1)} & ${formatPlayerName(p2)}`;
  };

  const getPhaseLabel = (m: any) => {
      if (m.round <= 4) return '';
      if (m.phase === 'qf') return 'Cuartos';
      if (m.phase === 'sf') return 'Semis';
      if (m.phase === 'final') return 'Final';
      return 'Playoff';
  };

  const handleResetToSetup = async () => { 
      try {
        await resetToSetupDB(); 
        setShowResetConfirm(false); 
        navigate('/tournament/dashboard'); 
      } catch (e: any) {
        setAlertMessage({ type: 'error', title: 'Error', message: e.message });
      }
  };
  
  const handleArchive = async () => {
      try {
        await archiveAndResetDB();
        navigate('/tournament/dashboard');
      } catch (e: any) {
        setAlertMessage({ type: 'error', title: 'Error', message: e.message });
      }
  };

  const getNextStepText = (pairId: string, isWinner: boolean, phase: string, courtId: number, bracket: string) => {
      const nextMatch = state.matches.find(m => (m.pairAId === pairId || m.pairBId === pairId) && m.round > state.currentRound);
      
      if (nextMatch) {
          const opponentId = nextMatch.pairAId === pairId ? nextMatch.pairBId : nextMatch.pairAId;
          const opponentName = getPairName(opponentId);
          const shortOpName = opponentName !== 'Unknown' ? opponentName.split('&')[0].trim() : '...';

          if (nextMatch.courtId > 0) return `A Pista ${nextMatch.courtId} (vs ${shortOpName})`;
          return `Espera turno (vs ${shortOpName})`;
      }

      if (phase === 'group') {
           const maxGroupRound = state.format === '16_mini' ? 4 : 3;
           if (state.currentRound >= maxGroupRound) return "Esperando Fase Final";
           return "Descanso / Espera";
      }
      if (phase === 'qf') {
          if (!isWinner) return "Eliminado";
          if (bracket === 'main') {
              if (courtId === 1 || courtId === 2) return "A Semis (Pista 1)";
              return "A Semis (Pista 2)";
          }
          if (bracket === 'consolation') {
               return "A Semis Cons.";
          }
      }
      if (phase === 'sf') {
           if (!isWinner) return "Eliminado";
           if (bracket === 'main') return "¡A LA FINAL! (Pista 1)";
           if (bracket === 'consolation') return "¡A FINAL CONS.! (Pista 2)";
      }
      if (phase === 'final') {
          if (isWinner) return "¡CAMPEONES!";
          return "Subcampeones";
      }
      return "Finalizado";
  };

  const handleSaveScore = async () => {
    if (selectedMatchId && scoreA !== '' && scoreB !== '') {
        const valA = parseInt(scoreA); const valB = parseInt(scoreB);
        if (valA === valB) {
            setAlertMessage({ type: 'error', title: 'Empate no permitido', message: 'Los partidos de torneo deben tener un ganador.' });
            return;
        }
        
        const m = state.matches.find(m => m.id === selectedMatchId);
        if (!m) return;

        await updateScoreDB(selectedMatchId, valA, valB);
        
        const pAWon = valA > valB;
        const pAName = getPairName(m.pairAId);
        const pBName = getPairName(m.pairBId);

        const nextInfo: NextMatchInfo = {
            pairA: {
                name: pAName,
                status: pAWon ? 'win' : 'loss',
                highlight: pAWon,
                nextText: getNextStepText(m.pairAId, pAWon, m.phase, m.courtId, m.bracket || 'main')
            },
            pairB: {
                name: pBName,
                status: !pAWon ? 'win' : 'loss',
                highlight: !pAWon,
                nextText: getNextStepText(m.pairBId, !pAWon, m.phase, m.courtId, m.bracket || 'main')
            }
        };

        setNextMatchInfo(nextInfo);
        setSelectedMatchId(null); 
        setScoreA(''); 
        setScoreB('');
    }
  };

  const handleCloseInfoModal = () => {
      setNextMatchInfo(null);
      const nextMatch = sortedMatchesPriority.find(m => !m.isFinished && m.courtId > 0);
      if (nextMatch) {
          handleOpenScore(nextMatch.id, nextMatch.scoreA, nextMatch.scoreB);
      }
  };
  
  const handleOpenScore = (matchId: string, currentScoreA: number | null, currentScoreB: number | null) => {
      setSelectedMatchId(matchId); 
      setScoreA(currentScoreA !== null ? currentScoreA.toString() : ''); 
      setScoreB(currentScoreB !== null ? currentScoreB.toString() : '');
  };

  const handleNextRoundClick = () => {
      if (!allMatchesFinished && !isTournamentFinished) {
          const remaining = activePlayableMatches.length - finishedPlayableMatches;
          if (state.currentRound < 7) {
              setAlertMessage({ 
                  type: 'error', 
                  title: 'Ronda incompleta', 
                  message: `No se puede avanzar. Faltan ${remaining} partido(s) activos por finalizar.` 
              });
              return;
          }
      }
      setShowRoundConfirm(true);
  };
  
  const handleFinishTournament = async () => {
       if (!allMatchesFinished) return;
       try { await finishTournamentDB(); } catch (e: any) { setAlertMessage({ type: 'error', title: 'Error', message: e.message }); }
  };

  const confirmNextRound = async () => { 
      setShowRoundConfirm(false); 
      try { 
          resetTimer(); 
          await nextRoundDB(); 
      } catch (e: any) { 
          setAlertMessage({ type: 'error', title: 'Error al avanzar', message: e.message || e }); 
      } 
  };

  const getChampions = () => {
      let finalMainRound = 7; let finalConsRound = 8;
      if (state.format === '16_mini') { finalMainRound = 7; finalConsRound = 8; }
      else if (state.format === '10_mini') { finalMainRound = 6; finalConsRound = 4; }
      else if (state.format === '8_mini') { finalMainRound = 6; finalConsRound = 6; }
      else if (state.format === '12_mini') { finalMainRound = 6; finalConsRound = 5; }
      const finalMain = state.matches.find(m => m.round === finalMainRound && m.bracket === 'main' && m.courtId === 1);
      const finalCons = state.matches.find(m => m.round === finalConsRound && m.bracket === 'consolation');
      const getWinnerName = (m?: any) => { if(!m || !m.isFinished) return 'Pendiente'; return (m.scoreA > m.scoreB) ? getPairName(m.pairAId) : getPairName(m.pairBId); };
      return { main: getWinnerName(finalMain), cons: getWinnerName(finalCons) };
  };

  // 1. SETUP STATE
  if (state.status === 'setup') {
      return (
          <div className="flex flex-col h-full items-center justify-center py-20 text-center animate-fade-in text-white relative z-10">
              <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center text-slate-300 mb-6 border border-white/10">
                  <Settings size={40} />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Preparando Torneo</h2>
              <p className="text-slate-400 max-w-xs mx-auto mb-8">
                  El torneo está en fase de registro. Ve al Panel de Control para generar los cuadros y empezar.
              </p>
              <button 
                onClick={() => navigate('/tournament/dashboard')}
                className="px-8 py-3 bg-white text-slate-900 rounded-xl font-bold shadow-lg hover:bg-slate-100"
              >
                  Ir al Panel
              </button>
          </div>
      );
  }

  // 2. FINISHED STATE
  if (isTournamentFinished) {
      const champions = getChampions();
      return (
          <div className="space-y-6 pb-20 pt-10 text-center animate-fade-in text-white relative z-10">
              <h2 className="text-3xl font-black mb-2">¡Torneo Finalizado!</h2>
              <p className="text-slate-400 max-w-xs mx-auto mb-10">Enhorabuena a todos los participantes. Aquí están los resultados finales.</p>
              
              <div className="grid grid-cols-1 gap-6 max-w-md mx-auto">
                <div style={{ backgroundColor: themeColor }} className="rounded-2xl p-6 text-white shadow-xl transform hover:scale-105 transition-transform border border-white/20">
                    <div className="flex justify-center mb-4"><Trophy size={32} className="text-yellow-300"/></div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-100 mb-2">Campeones Principales</h3>
                    <div className="text-2xl font-black">{champions.main}</div>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-lg transform hover:scale-105 transition-transform text-slate-900">
                    <div className="flex justify-center mb-4"><Medal size={32} className="text-blue-500"/></div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Campeones Consolación</h3>
                    <div className="text-2xl font-black">{champions.cons}</div>
                </div>
              </div>

              <div className="mt-12 bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10">
                <p className="text-sm text-slate-400 mb-4">Guardar resultados en el historial y preparar un nuevo torneo.</p>
                <button 
                    onClick={() => setShowArchiveConfirm(true)} 
                    className="w-full px-8 py-4 bg-white text-slate-900 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors"
                >
                    <Archive size={20} /> Archivar y Cerrar Torneo
                </button>
              </div>

              <Modal
                isOpen={showArchiveConfirm}
                onClose={() => setShowArchiveConfirm(false)}
                title="¿Archivar Torneo?"
                body="El torneo actual se guardará en el historial y la aplicación quedará lista para un nuevo registro."
                icon={<Archive size={28}/>}
                iconColor="info"
                actions={[
                    { label: 'Cancelar', onClick: () => setShowArchiveConfirm(false), variant: 'secondary' },
                    { label: 'Confirmar', onClick: handleArchive, variant: 'primary' },
                ]}
              />
          </div>
      );
  }

  // 3. ACTIVE MATCHES STATE ("DIRECTO")
  return (
    <div className="relative min-h-screen text-slate-900 pb-32">
        {/* Background handled by Layout (dark mode) */}

        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between text-white">
                <button onClick={() => navigate('/minis')} className="flex items-center gap-2 text-slate-300 font-bold text-sm hover:text-white transition-colors">
                    <ArrowRight size={18} className="rotate-180"/> Volver a Minis
                </button>
                {!isOnline ? (
                    <div className="bg-amber-500/20 border border-amber-500/50 rounded-full px-4 py-1 flex items-center gap-2 text-amber-200 text-xs font-bold uppercase">
                        <CloudOff size={14}/> {pendingSyncCount} Pendientes
                    </div>
                ) : pendingSyncCount > 0 ? (
                    <div className="bg-blue-500/20 border border-blue-500/50 rounded-full px-4 py-1 flex items-center gap-2 text-blue-200 text-xs font-bold uppercase">
                        <RefreshCw size={14} className="animate-spin"/> Sincronizando...
                    </div>
                ) : null}
            </div>

            {/* ROUND HEADER */}
            <div style={{ backgroundColor: themeColor }} className="rounded-2xl shadow-xl p-6 flex items-center justify-between border border-white/10 text-white">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-black tracking-tight">Ronda {state.currentRound}</h2>
                        <span className="px-3 py-1 bg-white/20 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm border border-white/10">
                            {state.currentRound <= (state.format === '16_mini' ? 4 : 3) ? 'Fase de Grupos' : 'Playoffs'}
                        </span>
                    </div>
                    <button 
                        onClick={() => setShowResetConfirm(true)} 
                        className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
                        title="Reiniciar Configuración"
                    >
                        <RotateCcw size={20}/>
                    </button>
            </div>
            
            {/* MATCH GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {sortedMatchesPriority.length === 0 ? (<div className="text-center py-10 text-slate-400 italic col-span-full">Cargando partidos...</div>) : (
                    sortedMatchesPriority.map(match => {
                        const isWaiting = match.courtId === 0; 
                        const isPlayable = playableMatchIds.has(match.id); 
                        const isTechnicalRest = !isPlayable && !isWaiting;
                        
                        const cardClasses = isWaiting 
                            ? 'bg-slate-100 border-slate-300 opacity-90' 
                            : isTechnicalRest 
                                ? 'bg-slate-200 opacity-70' 
                                : match.isFinished 
                                    ? 'bg-white border-emerald-400'
                                    : 'bg-white border-slate-200 shadow-lg';
                        
                        const headerBg = isWaiting ? 'bg-slate-300' : isTechnicalRest ? 'bg-slate-300' : 'bg-slate-50';

                        return (
                        <div key={match.id} className={`relative rounded-2xl border overflow-hidden ${cardClasses} flex flex-col text-slate-900`}>
                            <div className={`${headerBg} px-5 py-3 flex justify-between items-center border-b ${isWaiting ? 'border-slate-400' : 'border-slate-100'}`}>
                                <div className="flex items-center gap-3">
                                    {isWaiting ? (
                                        <span className="flex items-center gap-2 text-slate-600 font-bold text-xs uppercase">
                                            <Coffee size={16}/> EN ESPERA
                                        </span>
                                    ) : isTechnicalRest ? (
                                        <span className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase">
                                            <Coffee size={16}/> DESCANSO (Pista {match.courtId})
                                        </span>
                                    ) : (
                                        <span 
                                            className="px-3 py-1 rounded-lg text-xs font-black tracking-wider uppercase border"
                                            style={{ 
                                                color: themeColor, 
                                                backgroundColor: `${themeColor}15`, 
                                                borderColor: `${themeColor}20`
                                            }}
                                        >
                                            PISTA {match.courtId}
                                        </span>
                                    )}
                                    
                                    {getPhaseLabel(match) && <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{getPhaseLabel(match)}</span>}
                                    {match.bracket === 'consolation' && <span className="text-blue-600 text-[10px] font-bold uppercase tracking-wider">Cons.</span>}
                                </div>
                                {match.isFinished && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full border border-emerald-200">Finalizado</span>
                                        <button onClick={() => handleOpenScore(match.id, match.scoreA, match.scoreB)} className="p-1 text-slate-500 hover:text-blue-600 bg-white rounded-lg transition-colors border border-slate-200"><Edit2 size={12} /></button>
                                    </div>
                                )}
                            </div>
                            
                            <div className="p-4 flex-1 flex flex-col justify-center">
                                <div className="flex items-center justify-between mb-2 cursor-pointer hover:bg-slate-100 p-1 -mx-1 rounded transition-colors" onClick={() => setSelectedPairId(match.pairAId)}><span className={`text-base font-bold w-3/4 truncate flex items-center gap-2 ${isTechnicalRest ? 'text-slate-500' : 'text-slate-800'}`}>{getPairName(match.pairAId)} <Info size={12} className="text-slate-300"/></span><span className="text-2xl font-black text-slate-900">{match.scoreA ?? '-'}</span></div>
                                <div className="flex items-center justify-between cursor-pointer hover:bg-slate-100 p-1 -mx-1 rounded transition-colors" onClick={() => setSelectedPairId(match.pairBId)}><span className={`text-base font-bold w-3/4 truncate flex items-center gap-2 ${isTechnicalRest ? 'text-slate-500' : 'text-slate-800'}`}>{getPairName(match.pairBId)} <Info size={12} className="text-slate-300"/></span><span className="text-2xl font-black text-slate-900">{match.scoreB ?? '-'}</span></div>
                                {!match.isFinished && !isTechnicalRest && !isWaiting && (
                                    <button 
                                        onClick={() => handleOpenScore(match.id, match.scoreA, match.scoreB)} 
                                        style={{ backgroundColor: THEME.cta }} 
                                        className={`w-full mt-4 py-3 rounded-xl text-sm font-bold text-white shadow-md touch-manipulation hover:opacity-90 active:scale-98 transition-transform`}
                                    >
                                        Introducir Resultado
                                    </button>
                                )}
                                {isWaiting && !match.isFinished && (<button onClick={() => handleOpenScore(match.id, match.scoreA, match.scoreB)} className={`w-full mt-4 py-2 bg-slate-300 hover:bg-slate-400 rounded-lg text-center text-[10px] font-bold text-slate-600 uppercase transition-colors`}>Forzar Resultado</button>)}
                                {isTechnicalRest && (<div className="w-full mt-4 py-2 bg-slate-300 rounded-lg text-center text-[10px] font-bold text-slate-500 uppercase">Pista Ocupada</div>)}
                            </div>
                        </div>
                        );
                    })
                )}
            </div>

            {!isTournamentFinished && (
                // CHANGED: Use Sticky position at bottom of container instead of fixed to prevent overlap
                <div className="sticky bottom-0 z-30 pt-4 pb-2 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent flex justify-center">
                    <div className="relative pointer-events-auto">
                        {isFinalRound ? (
                            <button 
                                onClick={handleFinishTournament} 
                                disabled={!allMatchesFinished}
                                className={`inline-flex items-center gap-2 px-8 py-4 rounded-full shadow-2xl font-black text-lg transition-all border-4 ${allMatchesFinished ? 'bg-purple-600 text-white hover:bg-purple-500 animate-bounce border-purple-400' : 'bg-slate-800 text-slate-400 opacity-90 border-slate-700'}`}
                            >
                                <Trophy size={24} /> Finalizar Torneo
                            </button>
                        ) : (
                            <button 
                                onClick={handleNextRoundClick} 
                                className={`inline-flex items-center gap-2 px-8 py-4 rounded-full shadow-2xl font-black text-lg transition-all text-white bg-slate-900 hover:bg-slate-800 active:scale-95 border-2 border-white/20`}
                            >
                                Siguiente Ronda <ChevronRight size={24} />
                            </button>
                        )}
                    </div>
                </div>
            )}
            
        </div>

            {/* SCORE MODAL */}
            <Modal
                isOpen={!!selectedMatchId}
                onClose={() => setSelectedMatchId(null)}
                title={`PISTA ${state.matches.find(m => m.id === selectedMatchId)?.courtId ?? ''}`}
                body={`Ronda ${state.matches.find(m => m.id === selectedMatchId)?.round ?? ''}`}
                size="sm"
                actions={[
                    { label: 'Cancelar', onClick: () => setSelectedMatchId(null), variant: 'secondary' },
                    { label: 'Guardar', onClick: handleSaveScore, variant: 'primary' },
                ]}
            >
                <div className="flex items-center justify-center gap-4">
                    <div className="flex-1 text-center">
                        <div className="bg-slate-50 rounded-2xl border-2 border-slate-200 p-2 mb-2">
                            <input type="tel" value={scoreA} onChange={(e) => setScoreA(e.target.value)} className="w-full bg-transparent text-center text-5xl font-black text-slate-900 outline-none p-2" autoFocus/>
                        </div>
                        <p className="text-xs font-bold text-center text-slate-500 truncate">
                            {state.matches.find(m => m.id === selectedMatchId) ? getPairName(state.matches.find(m => m.id === selectedMatchId)!.pairAId) : 'P1'}
                        </p>
                    </div>
                    <span className="text-2xl font-black text-slate-300 pb-6">-</span>
                    <div className="flex-1 text-center">
                        <div className="bg-slate-50 rounded-2xl border-2 border-slate-200 p-2 mb-2">
                            <input type="tel" value={scoreB} onChange={(e) => setScoreB(e.target.value)} className="w-full bg-transparent text-center text-5xl font-black text-slate-900 outline-none p-2"/>
                        </div>
                        <p className="text-xs font-bold text-center text-slate-500 truncate">
                            {state.matches.find(m => m.id === selectedMatchId) ? getPairName(state.matches.find(m => m.id === selectedMatchId)!.pairBId) : 'P2'}
                        </p>
                    </div>
                </div>
            </Modal>

            {/* NEXT MATCH INFO MODAL */}
            <Modal
                isOpen={!!nextMatchInfo}
                onClose={handleCloseInfoModal}
                title="Información Post-Partido"
                icon={<Info size={28}/>}
                iconColor="info"
                size="sm"
                actions={[{ label: 'Continuar y Siguiente Partido', onClick: handleCloseInfoModal, variant: 'primary' }]}
            >
                {nextMatchInfo && (
                    <div className="space-y-3 text-left">
                        <div className={`p-3 rounded-xl border ${nextMatchInfo.pairA.highlight ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-xs font-bold text-slate-400 uppercase">Pareja 1</p>
                                {nextMatchInfo.pairA.status === 'win' ? <CheckCircle size={14} className="text-emerald-500"/> : <XCircle size={14} className="text-slate-400"/>}
                            </div>
                            <div className="font-bold text-slate-800 truncate">{nextMatchInfo.pairA.name}</div>
                            <div className={`font-bold text-sm mt-1 flex items-center gap-1 ${nextMatchInfo.pairA.highlight ? 'text-emerald-600' : 'text-slate-500'}`}><ArrowRight size={14}/> {nextMatchInfo.pairA.nextText}</div>
                        </div>
                        <div className={`p-3 rounded-xl border ${nextMatchInfo.pairB.highlight ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-xs font-bold text-slate-400 uppercase">Pareja 2</p>
                                {nextMatchInfo.pairB.status === 'win' ? <CheckCircle size={14} className="text-emerald-500"/> : <XCircle size={14} className="text-slate-400"/>}
                            </div>
                            <div className="font-bold text-slate-800 truncate">{nextMatchInfo.pairB.name}</div>
                            <div className={`font-bold text-sm mt-1 flex items-center gap-1 ${nextMatchInfo.pairB.highlight ? 'text-emerald-600' : 'text-slate-500'}`}><ArrowRight size={14}/> {nextMatchInfo.pairB.nextText}</div>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                isOpen={!!alertMessage}
                onClose={() => setAlertMessage(null)}
                title={alertMessage?.title ?? ''}
                body={alertMessage?.message}
                icon={alertMessage?.type === 'error' ? <X size={28}/> : <AlertTriangle size={28}/>}
                iconColor={alertMessage?.type === 'error' ? 'danger' : 'warning'}
                actions={[{ label: 'Entendido', onClick: () => setAlertMessage(null), variant: 'primary' }]}
            />

            <Modal
                isOpen={showResetConfirm}
                onClose={() => setShowResetConfirm(false)}
                title="¿Reiniciar Configuración?"
                icon={<RotateCcw size={28}/>}
                iconColor="danger"
                actions={[
                    { label: 'Cancelar', onClick: () => setShowResetConfirm(false), variant: 'secondary' },
                    { label: 'Reiniciar', onClick: handleResetToSetup, variant: 'danger' },
                ]}
            >
                <p className="text-slate-500 text-sm">
                    Se borrarán todos los partidos generados y volverás a la pantalla de configuración. <strong className="block mt-2 text-slate-800">Las parejas inscritas NO se borrarán.</strong>
                </p>
            </Modal>

            <Modal
                isOpen={showRoundConfirm}
                onClose={() => setShowRoundConfirm(false)}
                title="¿Avanzar Ronda?"
                body="Se generarán los partidos de la siguiente fase. Asegúrate de que todos los resultados actuales estén correctos."
                icon={<Play size={28} fill="currentColor"/>}
                iconColor="success"
                actions={[
                    { label: 'Revisar Resultados', onClick: () => setShowRoundConfirm(false), variant: 'secondary' },
                    { label: 'Confirmar y Avanzar', onClick: confirmNextRound, variant: 'primary' },
                ]}
            />
            
            {/* PAIR DETAIL MODAL USAGE */}
            {selectedPairId && <PairDetailModal pairId={selectedPairId} onClose={() => setSelectedPairId(null)} />}
            
    </div> 
  );
}
