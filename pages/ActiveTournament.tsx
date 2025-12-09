
import React, { useState, useEffect } from 'react';
import { useTournament } from '../store/TournamentContext';
import { THEME, getFormatColor } from '../utils/theme';
import { useTimer } from '../store/TimerContext';
import { TournamentFormat, Player, Pair, GenerationMethod } from '../types';
import { ChevronRight, Edit2, Info, User, Play, AlertTriangle, X, TrendingUp, ListOrdered, Clock, Shuffle, Coffee, CheckCircle, XCircle, Trophy, Medal, Settings, RotateCcw, Check, ArrowRight, Archive, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface WizardProps {
    pairs: Pair[];
    players: Player[];
    onComplete: (orderedPairs: Pair[]) => void;
    onCancel: () => void;
    formatName: (p?: Player) => string;
    limit: number; 
}

const ManualGroupingWizard: React.FC<WizardProps> = ({ pairs, players, onComplete, onCancel, formatName, limit }) => {
    const [currentGroupIdx, setCurrentGroupIdx] = useState(0); 
    const [orderedPairs, setOrderedPairs] = useState<Pair[]>([]);
    
    let groupNames = ['A', 'B', 'C', 'D'];
    if (limit === 10) groupNames = ['A', 'B'];
    if (limit === 8) groupNames = ['A', 'B'];
    if (limit === 12) groupNames = ['A', 'B', 'C'];
    
    const effectiveGroupSize = limit === 10 ? 5 : 4;
    const currentGroup = groupNames[currentGroupIdx];
    const assignedIds = new Set(orderedPairs.map(p => p.id));
    const availablePairs = pairs.filter(p => !assignedIds.has(p.id));
    const [selectedForGroup, setSelectedForGroup] = useState<string[]>([]);

    const toggleSelection = (id: string) => {
        if (selectedForGroup.includes(id)) setSelectedForGroup(selectedForGroup.filter(pid => pid !== id));
        else if (selectedForGroup.length < effectiveGroupSize) setSelectedForGroup([...selectedForGroup, id]);
    };

    const confirmGroup = () => {
        if (selectedForGroup.length !== effectiveGroupSize) return;
        const newGroupPairs = selectedForGroup.map(id => pairs.find(p => p.id === id)!);
        const newOrder = [...orderedPairs, ...newGroupPairs];
        setOrderedPairs(newOrder); setSelectedForGroup([]);
        if (currentGroupIdx < groupNames.length - 1) setCurrentGroupIdx(currentGroupIdx + 1);
        else onComplete(newOrder);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[100] flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl h-[85vh] flex flex-col">
                <div className="text-center mb-4"><h3 className="text-2xl font-black text-slate-900">Configurar Grupo {currentGroup}</h3><p className="text-slate-500 text-sm">Selecciona {effectiveGroupSize} parejas de la lista</p></div>
                <div className="flex-1 overflow-y-auto pr-2 space-y-2 mb-4 custom-scrollbar">
                    {availablePairs.map(pair => {
                        const p1 = players.find(p => p.id === pair.player1Id);
                        const p2 = players.find(p => p.id === pair.player2Id);
                        const isSelected = selectedForGroup.includes(pair.id);
                        return (
                            <div key={pair.id} onClick={() => toggleSelection(pair.id)} className={`p-3 rounded-xl border-2 flex justify-between items-center cursor-pointer transition-all ${isSelected ? 'border-[#575AF9] bg-indigo-50' : 'border-slate-100 bg-white hover:border-slate-300'}`}>
                                <div><div className="font-bold text-slate-800 text-sm">{formatName(p1)}</div><div className="font-bold text-slate-800 text-sm">& {formatName(p2)}</div></div>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-[#575AF9] border-[#575AF9]' : 'border-slate-300'}`}>{isSelected && <Check size={14} className="text-white" strokeWidth={3}/>}</div>
                            </div>
                        )
                    })}
                </div>
                <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
                    <div className="text-center font-bold text-[#575AF9] mb-2">Seleccionadas: {selectedForGroup.length} / {effectiveGroupSize}</div>
                    <button onClick={confirmGroup} disabled={selectedForGroup.length !== effectiveGroupSize} className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 ${selectedForGroup.length === effectiveGroupSize ? 'bg-[#575AF9] text-white animate-pulse' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>{currentGroupIdx === groupNames.length - 1 ? 'Finalizar y Empezar' : `Confirmar Grupo ${currentGroup} >`}</button>
                    <button onClick={onCancel} className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">Cancelar</button>
                </div>
            </div>
        </div>
    );
};

interface NextMatchInfo {
    pairA: { name: string; status: 'win' | 'loss'; nextText: string; highlight: boolean };
    pairB: { name: string; status: 'win' | 'loss'; nextText: string; highlight: boolean };
}

const ActiveTournament: React.FC = () => {
  const { state, updateScoreDB, nextRoundDB, startTournamentDB, resetToSetupDB, formatPlayerName, setTournamentFormat, finishTournamentDB, archiveAndResetDB } = useTournament();
  const { resetTimer, startTimer } = useTimer();
  const navigate = useNavigate();
  
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  
  const [nextMatchInfo, setNextMatchInfo] = useState<NextMatchInfo | null>(null);
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const [showRoundConfirm, setShowRoundConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // SETUP STATE
  const [generationMethod, setGenerationMethod] = useState<GenerationMethod>('elo-balanced');
  const [selectedFormat, setSelectedFormat] = useState<TournamentFormat>('16_mini');
  const [showManualWizard, setShowManualWizard] = useState(false);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  useEffect(() => { if(state.format) setSelectedFormat(state.format); }, [state.format]);

  const themeColor = getFormatColor(state.format);

  const handleFormatChange = (fmt: TournamentFormat) => {
      setSelectedFormat(fmt);
      setTournamentFormat(fmt); 
  };

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

  const handleStart = async () => {
      if (generationMethod === 'manual') { setShowManualWizard(true); return; }
      try { await startTournamentDB(generationMethod); resetTimer(); startTimer(); } catch (e: any) { setErrorMessage(e.message || "Error desconocido al iniciar torneo."); }
  };

  const handleResetToSetup = async () => { await resetToSetupDB(); setShowResetConfirm(false); };
  
  const handleArchive = async () => {
      await archiveAndResetDB();
      navigate('/dashboard');
  };

  const handleManualWizardComplete = async (orderedPairs: Pair[]) => {
      setShowManualWizard(false);
      try { await startTournamentDB('manual', orderedPairs); resetTimer(); startTimer(); } catch (e: any) { setErrorMessage(e.message || "Error al iniciar el torneo manual."); }
  };

  // UPDATED LOGIC: Prioritize Next Match over Phase Label
  const getNextStepText = (pairId: string, isWinner: boolean, phase: string, courtId: number, bracket: string) => {
      // 1. Look ahead for ANY scheduled match in a future round
      const nextMatch = state.matches.find(m => (m.pairAId === pairId || m.pairBId === pairId) && m.round > state.currentRound);
      
      if (nextMatch) {
          const opponentId = nextMatch.pairAId === pairId ? nextMatch.pairBId : nextMatch.pairAId;
          const opponentName = getPairName(opponentId);
          const shortOpName = opponentName !== 'Unknown' ? opponentName.split('&')[0].trim() : '...';

          if (nextMatch.courtId > 0) return `A Pista ${nextMatch.courtId} (vs ${shortOpName})`;
          return `Espera turno (vs ${shortOpName})`;
      }

      // 2. Fallbacks based on Phase
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
        if (valA === valB) return alert("El partido no puede terminar en empate.");
        
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
          if (state.currentRound < 7) return alert(`No se puede avanzar ronda. Faltan ${remaining} partido(s) activos por finalizar.`);
      }
      setShowRoundConfirm(true);
  };
  
  const handleFinishTournament = async () => {
       if (!allMatchesFinished) return;
       try { await finishTournamentDB(); } catch (e: any) { setErrorMessage("Error al finalizar: " + e.message); }
  };

  const confirmNextRound = async () => { setShowRoundConfirm(false); try { resetTimer(); await nextRoundDB(); } catch (e: any) { setErrorMessage(`Error al avanzar: ${e.message || e}`); } };

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

  const PairDetailContent = ({ pairId }: { pairId: string }) => {
      const matches = getPairMatches(pairId); const pairName = getPairName(pairId);
      return (
          <div className="space-y-4"><div className="text-center mb-6"><div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-2 text-[#575AF9]"><User size={32} /></div><h3 className="text-xl font-black text-slate-900">{pairName}</h3><p className="text-slate-500 text-xs uppercase font-bold">Calendario de Partidos</p></div><div className="space-y-2 max-h-60 overflow-y-auto pr-1">{matches.map(m => { const isPairA = m.pairAId === pairId; const opponentId = isPairA ? m.pairBId : m.pairAId; const opponentName = getPairName(opponentId); const myScore = isPairA ? m.scoreA : m.scoreB; const oppScore = isPairA ? m.scoreB : m.scoreA; const resultClass = !m.isFinished ? 'bg-slate-50 border-slate-200' : (myScore || 0) > (oppScore || 0) ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'; return (<div key={m.id} className={`p-3 rounded-xl border ${resultClass} flex justify-between items-center`}><div><div className="text-[10px] font-bold text-slate-400 uppercase mb-1">R{m.round} - P{m.courtId}</div><div className="font-bold text-slate-800 text-sm">vs {opponentName}</div></div><div className="text-lg font-black text-slate-900">{m.isFinished ? `${myScore} - ${oppScore}` : 'Pendiente'}</div></div>)})}</div></div>
      );
  };

  if (state.status === 'setup') {
      let limit = 16; if (selectedFormat === '10_mini') limit = 10; if (selectedFormat === '12_mini') limit = 12; if (selectedFormat === '8_mini') limit = 8;
      const totalPairs = state.pairs.length; const canStart = totalPairs >= limit; 

      return (
          <div className="flex flex-col h-full space-y-6 pb-20">
              <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-slate-900">Configuración Técnica</h2>
                  <div className={`px-4 py-2 rounded-xl text-xs font-bold uppercase border ${canStart ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-orange-100 text-orange-600 border-orange-200'}`}>
                      {totalPairs}/{limit} Parejas
                  </div>
              </div>

              {/* Tournament Info Summary */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-start gap-4">
                  <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                      <Trophy size={24} className="text-[#575AF9]"/>
                  </div>
                  <div>
                      <h3 className="font-black text-slate-800">{state.title || 'Mini Torneo'}</h3>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          <span className="flex items-center gap-1"><Calendar size={12}/> {state.startDate ? new Date(state.startDate).toLocaleDateString() : 'Hoy'}</span>
                          <span>|</span>
                          <span>{state.levelRange || 'Nivel Abierto'}</span>
                      </div>
                  </div>
              </div>

              {/* TECHNICAL CONFIG */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                  <div className="flex items-center gap-2 mb-2 text-slate-400 font-bold text-xs uppercase tracking-wider">
                      <Settings size={16}/> Configuración de Brackets
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-600 uppercase mb-2">Formato (Parejas)</h3>
                    <div className="grid grid-cols-4 gap-2">
                        <button onClick={() => handleFormatChange('16_mini')} className={`py-3 rounded-xl font-bold border-2 transition-all text-sm ${selectedFormat === '16_mini' ? 'border-[#575AF9] bg-indigo-50 text-[#575AF9]' : 'border-slate-100 text-slate-500 hover:border-slate-300'}`}>16</button>
                        <button onClick={() => handleFormatChange('12_mini')} className={`py-3 rounded-xl font-bold border-2 transition-all text-sm ${selectedFormat === '12_mini' ? 'border-[#575AF9] bg-indigo-50 text-[#575AF9]' : 'border-slate-100 text-slate-500 hover:border-slate-300'}`}>12</button>
                        <button onClick={() => handleFormatChange('10_mini')} className={`py-3 rounded-xl font-bold border-2 transition-all text-sm ${selectedFormat === '10_mini' ? 'border-[#575AF9] bg-indigo-50 text-[#575AF9]' : 'border-slate-100 text-slate-500 hover:border-slate-300'}`}>10</button>
                        <button onClick={() => handleFormatChange('8_mini')} className={`py-3 rounded-xl font-bold border-2 transition-all text-sm ${selectedFormat === '8_mini' ? 'border-[#575AF9] bg-indigo-50 text-[#575AF9]' : 'border-slate-100 text-slate-500 hover:border-slate-300'}`}>8</button>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-600 uppercase mb-2">Orden de Grupos</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setGenerationMethod('arrival')} className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${generationMethod === 'arrival' ? 'border-[#575AF9] bg-indigo-50 text-[#575AF9]' : 'border-slate-100 text-slate-500'}`}><Clock size={18}/> <span className="text-xs font-bold uppercase">Llegada</span></button>
                        <button onClick={() => setGenerationMethod('manual')} className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${generationMethod === 'manual' ? 'border-[#575AF9] bg-indigo-50 text-[#575AF9]' : 'border-slate-100 text-slate-500'}`}><ListOrdered size={18}/> <span className="text-xs font-bold uppercase">Manual</span></button>
                        <button onClick={() => setGenerationMethod('elo-balanced')} className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${generationMethod === 'elo-balanced' ? 'border-[#575AF9] bg-indigo-50 text-[#575AF9]' : 'border-slate-100 text-slate-500'}`}><TrendingUp size={18}/> <span className="text-xs font-bold uppercase">Nivel</span></button>
                        <button onClick={() => setGenerationMethod('elo-mixed')} className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${generationMethod === 'elo-mixed' ? 'border-[#575AF9] bg-indigo-50 text-[#575AF9]' : 'border-slate-100 text-slate-500'}`}><Shuffle size={18}/> <span className="text-xs font-bold uppercase">Mix</span></button>
                    </div>
                  </div>
              </div>
              
              <button onClick={handleStart} disabled={!canStart} style={{ backgroundColor: canStart ? THEME.cta : '#e2e8f0' }} className={`w-full py-5 rounded-2xl font-bold text-lg shadow-xl flex items-center justify-center gap-2 transition-all ${canStart ? 'text-white active:scale-95 hover:shadow-2xl hover:opacity-90' : 'text-slate-400 cursor-not-allowed'}`}><Play size={24} fill="currentColor" /> GENERAR CUADROS Y EMPEZAR</button>
               {errorMessage && (<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"><div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in text-center"><div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600"><AlertTriangle size={32} /></div><h3 className="text-xl font-black text-slate-900 mb-2">Error</h3><p className="text-slate-500 mb-6 text-sm break-words">{errorMessage}</p><button onClick={() => setErrorMessage(null)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg">Entendido</button></div></div>)}
              {showManualWizard && (<ManualGroupingWizard pairs={state.pairs.filter(p => !p.isReserve).slice(0, limit)} players={state.players} onCancel={() => setShowManualWizard(false)} onComplete={handleManualWizardComplete} formatName={formatPlayerName} limit={limit} />)}
          </div>
      )
  }

  if (isTournamentFinished) {
      const champions = getChampions();
      return (
          <div className="space-y-6 pb-20 pt-10 text-center animate-fade-in">
              <h2 className="text-3xl font-black text-slate-900 mb-2">¡Torneo Finalizado!</h2>
              <p className="text-slate-500 max-w-xs mx-auto mb-10">Enhorabuena a todos los participantes. Aquí están los resultados finales.</p>
              
              <div className="grid grid-cols-1 gap-6 max-w-md mx-auto">
                <div style={{ backgroundColor: themeColor }} className="rounded-2xl p-6 text-white shadow-xl transform hover:scale-105 transition-transform">
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
                <p className="text-sm text-slate-500 mb-4">Guardar resultados en el historial y preparar un nuevo torneo.</p>
                <button 
                    onClick={() => setShowArchiveConfirm(true)} 
                    className="w-full px-8 py-4 bg-slate-900 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
                >
                    <Archive size={20} /> Archivar y Cerrar Torneo
                </button>
              </div>

              {/* Archive Confirmation Modal */}
              {showArchiveConfirm && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in text-center">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                            <Archive size={32} />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">¿Archivar Torneo?</h3>
                        <p className="text-slate-500 mb-6 text-sm">
                            El torneo actual se guardará en el historial y la aplicación quedará lista para un nuevo registro.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowArchiveConfirm(false)} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200">
                                Cancelar
                            </button>
                            <button onClick={handleArchive} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700">
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
              )}
          </div>
      );
  }

  return (
    <div className="space-y-6 pb-32">
      {/* Floating Sticky Header (Boxed & Better Spaced) */}
      <div className="sticky top-20 z-30 pt-4 -mx-1 px-1">
        <div style={{ backgroundColor: themeColor }} className="rounded-2xl shadow-lg p-4 flex items-center justify-between text-white transition-colors duration-300">
            <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight">Ronda {state.currentRound}</h2>
                <span className="px-3 py-1 bg-white/20 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm border border-white/10">
                    {state.currentRound <= (state.format === '16_mini' ? 4 : 3) ? 'Fase de Grupos' : 'Playoffs'}
                </span>
            </div>
            <button 
                onClick={() => setShowResetConfirm(true)} 
                className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
            >
                <Settings size={20}/>
            </button>
        </div>
      </div>
      
      <div className="space-y-4">
        {sortedMatchesPriority.length === 0 ? (<div className="text-center py-10 text-slate-400 italic">Cargando partidos...</div>) : (
            sortedMatchesPriority.map(match => {
                const isWaiting = match.courtId === 0; const isPlayable = playableMatchIds.has(match.id); const isTechnicalRest = !isPlayable && !isWaiting;
                
                const cardClasses = isWaiting 
                    ? 'bg-slate-50 border-slate-300' 
                    : isTechnicalRest 
                        ? 'bg-slate-100 opacity-60' 
                        : match.isFinished 
                            ? 'bg-white border-emerald-200'
                            : 'bg-white border-slate-200 shadow-sm';
                
                const headerBg = isWaiting ? 'bg-slate-200' : isTechnicalRest ? 'bg-slate-200' : 'bg-white';

                return (
                <div key={match.id} className={`relative rounded-2xl border overflow-hidden ${cardClasses}`}>
                    <div className={`${headerBg} px-5 py-4 flex justify-between items-center border-b ${isWaiting ? 'border-slate-300' : 'border-slate-100'}`}>
                        
                        <div className="flex items-center gap-3">
                             {isWaiting ? (
                                 <span className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase">
                                     <Coffee size={16}/> EN ESPERA
                                 </span>
                             ) : isTechnicalRest ? (
                                 <span className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase">
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
                             
                             {getPhaseLabel(match) && <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{getPhaseLabel(match)}</span>}
                             {match.bracket === 'consolation' && <span className="text-blue-500 text-[10px] font-bold uppercase tracking-wider">Cons.</span>}
                        </div>
                        
                        {match.isFinished && (
                             <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">Finalizado</span>
                                <button onClick={() => handleOpenScore(match.id, match.scoreA, match.scoreB)} className="p-1.5 text-slate-400 hover:text-blue-500 bg-slate-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
                             </div>
                        )}
                    </div>
                    
                    <div className="p-5">
                        <div className="flex items-center justify-between mb-3 cursor-pointer hover:bg-slate-50 p-1 -mx-1 rounded transition-colors" onClick={() => setSelectedPairId(match.pairAId)}><span className={`text-lg font-bold w-3/4 truncate flex items-center gap-2 ${isTechnicalRest ? 'text-slate-400' : 'text-slate-800'}`}>{getPairName(match.pairAId)} <Info size={14} className="text-slate-300"/></span><span className="text-3xl font-black text-slate-900">{match.scoreA ?? '-'}</span></div>
                        <div className="flex items-center justify-between cursor-pointer hover:bg-slate-50 p-1 -mx-1 rounded transition-colors" onClick={() => setSelectedPairId(match.pairBId)}><span className={`text-lg font-bold w-3/4 truncate flex items-center gap-2 ${isTechnicalRest ? 'text-slate-400' : 'text-slate-800'}`}>{getPairName(match.pairBId)} <Info size={14} className="text-slate-300"/></span><span className="text-3xl font-black text-slate-900">{match.scoreB ?? '-'}</span></div>
                        
                        {!match.isFinished && !isTechnicalRest && !isWaiting && (
                            <button 
                                onClick={() => handleOpenScore(match.id, match.scoreA, match.scoreB)} 
                                style={{ backgroundColor: THEME.cta }} 
                                className={`w-full mt-6 py-4 rounded-xl text-base font-bold text-white shadow-md touch-manipulation hover:opacity-90 active:scale-98 transition-transform`}
                            >
                                Introducir Resultado
                            </button>
                        )}
                        
                        {isWaiting && !match.isFinished && (<button onClick={() => handleOpenScore(match.id, match.scoreA, match.scoreB)} className={`w-full mt-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-center text-xs font-bold text-slate-500 uppercase transition-colors`}>Forzar Resultado (Opcional)</button>)}
                        {isTechnicalRest && (<div className="w-full mt-4 py-2 bg-slate-200 rounded-lg text-center text-xs font-bold text-slate-400 uppercase">Pista Ocupada</div>)}
                    </div>
                </div>
                );
            })
        )}
      </div>
      {!isTournamentFinished && (
        <div className="fixed bottom-24 left-0 right-0 z-30 pointer-events-none">
          <div className="max-w-3xl mx-auto relative px-4 text-center pointer-events-auto">
            {isFinalRound ? (
                <button 
                    onClick={handleFinishTournament} 
                    disabled={!allMatchesFinished}
                    className={`inline-flex items-center gap-2 px-8 py-4 rounded-full shadow-2xl font-black text-lg transition-all ${allMatchesFinished ? 'bg-purple-600 text-white hover:bg-purple-500 animate-bounce' : 'bg-slate-800 text-slate-400 opacity-90'}`}
                >
                    <Trophy size={24} /> Finalizar Torneo
                </button>
            ) : (
                <button 
                    onClick={handleNextRoundClick} 
                    className={`inline-flex items-center gap-2 px-8 py-4 rounded-full shadow-2xl font-black text-lg transition-all text-white bg-slate-900 hover:bg-slate-800 active:scale-95`}
                >
                    Siguiente Ronda <ChevronRight size={24} />
                </button>
            )}
          </div>
        </div>
      )}
      
      {selectedMatchId && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-scale-in">
                  <div className="text-center mb-6">
                      <h3 className="text-3xl font-black text-slate-900 mb-1">
                          PISTA {state.matches.find(m => m.id === selectedMatchId)?.courtId}
                      </h3>
                      <div className="inline-block px-3 py-1 bg-slate-100 rounded-full text-slate-500 font-bold text-xs uppercase tracking-wider">
                          Ronda {state.matches.find(m => m.id === selectedMatchId)?.round}
                      </div>
                  </div>
                  
                  <div className="flex items-center justify-between gap-4 mb-8">
                      <div className="flex-1 w-1/2">
                          <div className="bg-slate-50 rounded-2xl border-2 border-slate-200 p-2 mb-2">
                              <input 
                                type="tel" 
                                value={scoreA} 
                                onChange={(e) => setScoreA(e.target.value)} 
                                className="w-full bg-transparent text-center text-5xl font-black text-slate-900 outline-none p-2" 
                                autoFocus
                              />
                          </div>
                          <p className="text-xs font-bold text-center text-slate-500 px-1 mt-2 h-8 flex items-center justify-center leading-tight line-clamp-2 overflow-hidden">
                              {state.matches.find(m => m.id === selectedMatchId) ? getPairName(state.matches.find(m => m.id === selectedMatchId)!.pairAId) : 'P1'}
                          </p>
                      </div>
                      
                      <span className="text-2xl font-black text-slate-300 pb-8">-</span>
                      
                      <div className="flex-1 w-1/2">
                          <div className="bg-slate-50 rounded-2xl border-2 border-slate-200 p-2 mb-2">
                              <input 
                                type="tel" 
                                value={scoreB} 
                                onChange={(e) => setScoreB(e.target.value)} 
                                className="w-full bg-transparent text-center text-5xl font-black text-slate-900 outline-none p-2"
                              />
                          </div>
                          <p className="text-xs font-bold text-center text-slate-500 px-1 mt-2 h-8 flex items-center justify-center leading-tight line-clamp-2 overflow-hidden">
                              {state.matches.find(m => m.id === selectedMatchId) ? getPairName(state.matches.find(m => m.id === selectedMatchId)!.pairBId) : 'P2'}
                          </p>
                      </div>
                  </div>
                  
                  <div className="flex gap-3">
                      <button onClick={() => setSelectedMatchId(null)} className="flex-1 py-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancelar</button>
                      <button onClick={handleSaveScore} style={{ backgroundColor: THEME.cta }} className="flex-1 py-4 rounded-xl font-bold text-white shadow-lg transition-colors hover:opacity-90">Guardar</button>
                  </div>
              </div>
          </div>
      )}
      
      {nextMatchInfo && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-scale-in text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                      <Info size={32} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-4">Información Post-Partido</h3>
                  
                  <div className="space-y-3 mb-6 text-left">
                      <div className={`p-3 rounded-xl border ${nextMatchInfo.pairA.highlight ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="flex justify-between items-center mb-1">
                              <p className="text-xs font-bold text-slate-400 uppercase">Pareja 1</p>
                              {nextMatchInfo.pairA.status === 'win' ? <CheckCircle size={14} className="text-emerald-500"/> : <XCircle size={14} className="text-slate-400"/>}
                          </div>
                          <div className="font-bold text-slate-800 truncate">{nextMatchInfo.pairA.name}</div>
                          <div className={`font-bold text-sm mt-1 flex items-center gap-1 ${nextMatchInfo.pairA.highlight ? 'text-emerald-600' : 'text-slate-500'}`}>
                              <ArrowRight size={14}/> {nextMatchInfo.pairA.nextText}
                          </div>
                      </div>

                      <div className={`p-3 rounded-xl border ${nextMatchInfo.pairB.highlight ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="flex justify-between items-center mb-1">
                              <p className="text-xs font-bold text-slate-400 uppercase">Pareja 2</p>
                              {nextMatchInfo.pairB.status === 'win' ? <CheckCircle size={14} className="text-emerald-500"/> : <XCircle size={14} className="text-slate-400"/>}
                          </div>
                          <div className="font-bold text-slate-800 truncate">{nextMatchInfo.pairB.name}</div>
                          <div className={`font-bold text-sm mt-1 flex items-center gap-1 ${nextMatchInfo.pairB.highlight ? 'text-emerald-600' : 'text-slate-500'}`}>
                              <ArrowRight size={14}/> {nextMatchInfo.pairB.nextText}
                          </div>
                      </div>
                  </div>

                  <button onClick={handleCloseInfoModal} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-transform">
                      Continuar y Siguiente Partido
                  </button>
              </div>
          </div>
      )}

      {showResetConfirm && (<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"><div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in text-center"><div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600"><RotateCcw size={32} /></div><h3 className="text-xl font-black text-slate-900 mb-2">¿Reiniciar Configuración?</h3><p className="text-slate-500 mb-6 text-sm">Se borrarán todos los partidos generados y volverás a la pantalla de configuración. <strong className="block mt-2 text-slate-800">Las parejas inscritas NO se borrarán.</strong></p><div className="flex gap-3"><button onClick={() => setShowResetConfirm(false)} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold">Cancelar</button><button onClick={handleResetToSetup} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg">Reiniciar</button></div></div></div>)}
      {showRoundConfirm && (<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"><div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-scale-in text-center"><div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600 animate-pulse"><Play size={40} fill="currentColor" /></div><h3 className="text-2xl font-black text-slate-900 mb-2">¿Avanzar Ronda?</h3><p className="text-slate-500 mb-8">Se generarán los partidos de la siguiente fase. Asegúrate de que todos los resultados actuales estén correctos.</p><div className="grid grid-cols-1 gap-3"><button onClick={confirmNextRound} style={{ backgroundColor: THEME.cta }} className="w-full py-4 text-white rounded-xl font-bold shadow-lg transition-transform active:scale-95 hover:opacity-90">Confirmar y Avanzar</button><button onClick={() => setShowRoundConfirm(false)} className="w-full py-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">Revisar Resultados</button></div></div></div>)}
      {selectedPairId && (<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center sm:p-4"><div className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md shadow-2xl animate-slide-up h-[80vh] sm:h-auto flex flex-col"><div className="flex justify-end mb-2"><button onClick={() => setSelectedPairId(null)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><X size={20}/></button></div><PairDetailContent pairId={selectedPairId} /></div></div>)}
    </div>
  );
};

export default ActiveTournament;
