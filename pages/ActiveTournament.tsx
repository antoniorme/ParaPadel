import React, { useState, useEffect } from 'react';
import { useTournament } from '../store/TournamentContext';
import { useTimer } from '../store/TimerContext';
import { TournamentFormat, Player, Pair, GenerationMethod } from '../types';
import { ChevronRight, Edit2, Info, User, Play, AlertTriangle, X, TrendingUp, ListOrdered, Clock, Shuffle, Coffee, CheckCircle, XCircle, Trophy, Medal, Check, Settings, RotateCcw } from 'lucide-react';
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
                            <div key={pair.id} onClick={() => toggleSelection(pair.id)} className={`p-3 rounded-xl border-2 flex justify-between items-center cursor-pointer transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-white hover:border-slate-300'}`}>
                                <div><div className="font-bold text-slate-800 text-sm">{formatName(p1)}</div><div className="font-bold text-slate-800 text-sm">& {formatName(p2)}</div></div>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>{isSelected && <Check size={14} className="text-white" strokeWidth={3}/>}</div>
                            </div>
                        )
                    })}
                </div>
                <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
                    <div className="text-center font-bold text-emerald-600 mb-2">Seleccionadas: {selectedForGroup.length} / {effectiveGroupSize}</div>
                    <button onClick={confirmGroup} disabled={selectedForGroup.length !== effectiveGroupSize} className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 ${selectedForGroup.length === effectiveGroupSize ? 'bg-emerald-600 text-white animate-pulse' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>{currentGroupIdx === groupNames.length - 1 ? 'Finalizar y Empezar' : `Confirmar Grupo ${currentGroup} >`}</button>
                    <button onClick={onCancel} className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">Cancelar</button>
                </div>
            </div>
        </div>
    );
};

const ActiveTournament: React.FC = () => {
  const { state, updateScoreDB, nextRoundDB, startTournamentDB, resetToSetupDB, formatPlayerName, setTournamentFormat } = useTournament();
  const { resetTimer, startTimer } = useTimer();
  const navigate = useNavigate();
  
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [nextMatchInfo, setNextMatchInfo] = useState<{ pA_Name: string, pA_Status: string, pA_Next: string, pA_Won: boolean, pB_Name: string, pB_Status: string, pB_Next: string, pB_Won: boolean } | null>(null);
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const [showRoundConfirm, setShowRoundConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [generationMethod, setGenerationMethod] = useState<GenerationMethod>('elo-balanced');
  const [selectedFormat, setSelectedFormat] = useState<TournamentFormat>('16_mini');
  const [showManualWizard, setShowManualWizard] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => { if(state.format) setSelectedFormat(state.format); }, [state.format]);

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

  const handleManualWizardComplete = async (orderedPairs: Pair[]) => {
      setShowManualWizard(false);
      try { await startTournamentDB('manual', orderedPairs); resetTimer(); startTimer(); } catch (e: any) { setErrorMessage(e.message || "Error al iniciar el torneo manual."); }
  };

  const handleSaveScore = () => {
    if (selectedMatchId && scoreA !== '' && scoreB !== '') {
        const valA = parseInt(scoreA); const valB = parseInt(scoreB);
        if (valA === valB) return alert("El partido no puede terminar en empate.");
        const m = state.matches.find(m => m.id === selectedMatchId);
        if (m && m.phase !== 'group') {
             const pairA = getPairName(m.pairAId); const pairB = getPairName(m.pairBId); const pAWon = valA > valB;
             let nextStr = 'Siguiente Ronda'; if (m.phase === 'qf') nextStr = 'Semis'; if (m.phase === 'sf') nextStr = 'Final';
             setNextMatchInfo({ pA_Name: pairA, pA_Won: pAWon, pA_Status: pAWon ? 'Clasificado' : 'Eliminado', pA_Next: pAWon ? nextStr : '', pB_Name: pairB, pB_Won: !pAWon, pB_Status: !pAWon ? 'Clasificado' : 'Eliminado', pB_Next: !pAWon ? nextStr : '' });
        }
        updateScoreDB(selectedMatchId, valA, valB); setSelectedMatchId(null); setScoreA(''); setScoreB('');
    }
  };
  
  const handleOpenScore = (matchId: string, currentScoreA: number | null, currentScoreB: number | null) => {
      setSelectedMatchId(matchId); setScoreA(currentScoreA !== null ? currentScoreA.toString() : ''); setScoreB(currentScoreB !== null ? currentScoreB.toString() : '');
  };

  const handleNextRoundClick = () => {
      if (!allMatchesFinished && !isTournamentFinished) {
          const remaining = activePlayableMatches.length - finishedPlayableMatches;
          if (state.currentRound < 7) return alert(`No se puede avanzar ronda. Faltan ${remaining} partido(s) activos por finalizar.`);
      }
      setShowRoundConfirm(true);
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
          <div className="space-y-4"><div className="text-center mb-6"><div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2 text-emerald-600"><User size={32} /></div><h3 className="text-xl font-black text-slate-900">{pairName}</h3><p className="text-slate-500 text-xs uppercase font-bold">Calendario de Partidos</p></div><div className="space-y-2 max-h-60 overflow-y-auto pr-1">{matches.map(m => { const isPairA = m.pairAId === pairId; const opponentId = isPairA ? m.pairBId : m.pairAId; const opponentName = getPairName(opponentId); const myScore = isPairA ? m.scoreA : m.scoreB; const oppScore = isPairA ? m.scoreB : m.scoreA; const resultClass = !m.isFinished ? 'bg-slate-50 border-slate-200' : (myScore || 0) > (oppScore || 0) ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'; return (<div key={m.id} className={`p-3 rounded-xl border ${resultClass} flex justify-between items-center`}><div><div className="text-[10px] font-bold text-slate-400 uppercase mb-1">R{m.round} - P{m.courtId}</div><div className="font-bold text-slate-800 text-sm">vs {opponentName}</div></div><div className="text-lg font-black text-slate-900">{m.isFinished ? `${myScore} - ${oppScore}` : 'Pendiente'}</div></div>)})}</div></div>
      );
  };

  if (state.status === 'setup') {
      let limit = 16; if (selectedFormat === '10_mini') limit = 10; if (selectedFormat === '12_mini') limit = 12; if (selectedFormat === '8_mini') limit = 8;
      const totalPairs = state.pairs.length; const canStart = totalPairs >= limit; const reservesCount = Math.max(0, totalPairs - limit);
      return (
          <div className="flex flex-col h-full space-y-6 pb-20">
              <div className="text-center mb-4"><div className="inline-block p-4 bg-emerald-100 rounded-full mb-4 animate-pulse"><Settings size={40} className="text-emerald-600" /></div><h2 className="text-3xl font-black text-slate-900">Torneo Listo</h2><p className="text-slate-500">Configura los parámetros finales</p></div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between"><div><h3 className="text-sm font-bold text-slate-400 uppercase">Parejas Inscritas</h3><p className="text-xs text-slate-400">Titulares: {limit} {reservesCount > 0 && `(+${reservesCount} Reservas)`}</p></div><div className={`text-4xl font-black ${canStart ? 'text-emerald-500' : 'text-orange-500'}`}>{totalPairs}<span className="text-xl text-slate-300">/{limit}</span></div></div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Tipo de Mini</h3><div className="grid grid-cols-4 gap-2"><button onClick={() => handleFormatChange('16_mini')} className={`py-3 rounded-xl font-bold border-2 transition-all ${selectedFormat === '16_mini' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-500 hover:border-slate-300'}`}>16</button><button onClick={() => handleFormatChange('12_mini')} className={`py-3 rounded-xl font-bold border-2 transition-all ${selectedFormat === '12_mini' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-500 hover:border-slate-300'}`}>12</button><button onClick={() => handleFormatChange('10_mini')} className={`py-3 rounded-xl font-bold border-2 transition-all ${selectedFormat === '10_mini' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-500 hover:border-slate-300'}`}>10</button><button onClick={() => handleFormatChange('8_mini')} className={`py-3 rounded-xl font-bold border-2 transition-all ${selectedFormat === '8_mini' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-500 hover:border-slate-300'}`}>8</button></div></div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Generación de Grupos</h3><div className="grid grid-cols-2 gap-3"><button onClick={() => setGenerationMethod('arrival')} className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${generationMethod === 'arrival' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-500'}`}><Clock size={18}/> <span className="text-xs font-bold uppercase">Llegada</span></button><button onClick={() => setGenerationMethod('manual')} className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${generationMethod === 'manual' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-500'}`}><ListOrdered size={18}/> <span className="text-xs font-bold uppercase">Manual</span></button><button onClick={() => setGenerationMethod('elo-balanced')} className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${generationMethod === 'elo-balanced' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-500'}`}><TrendingUp size={18}/> <span className="text-xs font-bold uppercase">Nivel</span></button><button onClick={() => setGenerationMethod('elo-mixed')} className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${generationMethod === 'elo-mixed' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-500'}`}><Shuffle size={18}/> <span className="text-xs font-bold uppercase">Mix</span></button></div></div>
              <button onClick={handleStart} disabled={!canStart} className={`w-full py-5 rounded-2xl font-bold text-lg shadow-xl flex items-center justify-center gap-2 transition-all ${canStart ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white active:scale-95 hover:shadow-2xl' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}><Play size={24} fill="currentColor" /> EMPEZAR TORNEO</button>
               {errorMessage && (<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"><div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in text-center"><div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600"><AlertTriangle size={32} /></div><h3 className="text-xl font-black text-slate-900 mb-2">Error</h3><p className="text-slate-500 mb-6 text-sm break-words">{errorMessage}</p><button onClick={() => setErrorMessage(null)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg">Entendido</button></div></div>)}
              {showManualWizard && (<ManualGroupingWizard pairs={state.pairs.filter(p => !p.isReserve).slice(0, limit)} players={state.players} onCancel={() => setShowManualWizard(false)} onComplete={handleManualWizardComplete} formatName={formatPlayerName} limit={limit} />)}
          </div>
      )
  }

  if (isTournamentFinished) {
      const champions = getChampions();
      return (
          <div className="space-y-6 pb-20 pt-10 text-center animate-fade-in">
              <div className="inline-block p-6 bg-emerald-100 rounded-full shadow-lg mb-4 animate-bounce"><Trophy size={64} className="text-emerald-600" /></div><h2 className="text-3xl font-black text-slate-900 mb-2">¡Torneo Finalizado!</h2><p className="text-slate-500 max-w-xs mx-auto mb-10">Enhorabuena a todos los participantes. Aquí están los resultados finales.</p>
              <div className="grid grid-cols-1 gap-6 max-w-md mx-auto"><div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-xl transform hover:scale-105 transition-transform"><div className="flex justify-center mb-4"><Trophy size={32} className="text-yellow-300"/></div><h3 className="text-xs font-bold uppercase tracking-widest text-emerald-100 mb-2">Campeones Principales</h3><div className="text-2xl font-black">{champions.main}</div></div><div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-lg transform hover:scale-105 transition-transform"><div className="flex justify-center mb-4"><Medal size={32} className="text-blue-500"/></div><h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Campeones Consolación</h3><div className="text-2xl font-black text-slate-800">{champions.cons}</div></div></div>
              <div className="mt-12 bg-slate-50 p-6 rounded-2xl border border-slate-200"><p className="text-sm text-slate-500 mb-4">Para archivar este torneo y comenzar uno nuevo, ve al panel de inicio.</p><button onClick={() => navigate('/dashboard')} className="px-8 py-3 bg-slate-800 text-white rounded-xl font-bold shadow-lg">Ir al Panel de Control</button></div>
          </div>
      );
  }

  return (
    <div className="space-y-6 pb-32">
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between sticky top-16 z-20"><div className="flex items-center gap-2"><h2 className="text-xl font-bold text-slate-900">Ronda {state.currentRound}</h2><span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider">{state.currentRound <= (state.format === '16_mini' ? 4 : 3) ? 'Fase de Grupos' : 'Playoffs'}</span></div><button onClick={() => setShowResetConfirm(true)} className="p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200"><Settings size={20}/></button></div>
      <div className="space-y-4">
        {sortedMatchesPriority.length === 0 ? (<div className="text-center py-10 text-slate-400 italic">Cargando partidos...</div>) : (
            sortedMatchesPriority.map(match => {
                const isWaiting = match.courtId === 0; const isPlayable = playableMatchIds.has(match.id); const isTechnicalRest = !isPlayable && !isWaiting;
                return (
                <div key={match.id} className={`relative rounded-2xl border overflow-hidden ${isWaiting ? 'bg-slate-50 border-slate-300' : isTechnicalRest ? 'bg-slate-100 opacity-60' : match.isFinished ? 'border-emerald-200 bg-emerald-50/30' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div className={`${isWaiting ? 'bg-slate-200' : 'bg-slate-100'} px-4 py-2 flex justify-between items-center border-b border-slate-200`}><span className={`font-bold text-xs uppercase flex gap-2 items-center ${isWaiting ? 'text-slate-600' : 'text-slate-700'}`}>{isWaiting ? (<span className="flex items-center gap-1"><Coffee size={14}/> EN ESPERA (Siguiente Turno)</span>) : isTechnicalRest ? (<span className="flex items-center gap-1"><Coffee size={14}/> DESCANSO (Pista {match.courtId})</span>) : (`Pista ${match.courtId}`)}{getPhaseLabel(match) && <span className="text-slate-400">- {getPhaseLabel(match)}</span>}{match.bracket === 'consolation' && <span className="text-blue-500">(Consolación)</span>}</span>{match.isFinished && (<button onClick={() => handleOpenScore(match.id, match.scoreA, match.scoreB)} className="p-1 text-slate-400 hover:text-blue-500"><Edit2 size={14} /></button>)}</div>
                    <div className="p-5">
                        <div className="flex items-center justify-between mb-3 cursor-pointer hover:bg-slate-50 p-1 -mx-1 rounded transition-colors" onClick={() => setSelectedPairId(match.pairAId)}><span className={`text-lg font-bold w-3/4 truncate flex items-center gap-2 ${isTechnicalRest ? 'text-slate-400' : 'text-slate-800'}`}>{getPairName(match.pairAId)} <Info size={14} className="text-slate-300"/></span><span className="text-3xl font-black text-slate-900">{match.scoreA ?? '-'}</span></div>
                        <div className="flex items-center justify-between cursor-pointer hover:bg-slate-50 p-1 -mx-1 rounded transition-colors" onClick={() => setSelectedPairId(match.pairBId)}><span className={`text-lg font-bold w-3/4 truncate flex items-center gap-2 ${isTechnicalRest ? 'text-slate-400' : 'text-slate-800'}`}>{getPairName(match.pairBId)} <Info size={14} className="text-slate-300"/></span><span className="text-3xl font-black text-slate-900">{match.scoreB ?? '-'}</span></div>
                        {!match.isFinished && !isTechnicalRest && !isWaiting && (<button onClick={() => handleOpenScore(match.id, match.scoreA, match.scoreB)} className={`w-full mt-6 py-4 rounded-xl text-base font-bold text-white shadow-md touch-manipulation bg-blue-600 active:bg-blue-700`}>Introducir Resultado</button>)}
                        {isWaiting && !match.isFinished && (<button onClick={() => handleOpenScore(match.id, match.scoreA, match.scoreB)} className={`w-full mt-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-center text-xs font-bold text-slate-500 uppercase transition-colors`}>Forzar Resultado (Opcional)</button>)}
                        {isTechnicalRest && (<div className="w-full mt-4 py-2 bg-slate-200 rounded-lg text-center text-xs font-bold text-slate-400 uppercase">Pista Ocupada</div>)}
                    </div>
                </div>
                );
            })
        )}
      </div>
      {!isTournamentFinished && (<div className="fixed bottom-24 left-0 right-0 z-30 pointer-events-none"><div className="max-w-3xl mx-auto relative px-4 text-center pointer-events-auto"><button onClick={handleNextRoundClick} className={`inline-flex items-center gap-2 px-8 py-4 rounded-full shadow-2xl font-black text-lg transition-all ${allMatchesFinished ? 'bg-emerald-600 text-white hover:bg-emerald-500 animate-bounce' : 'bg-slate-800 text-slate-400 opacity-90'}`}>Siguiente Ronda <ChevronRight size={24} /></button></div></div>)}
      {selectedMatchId && (<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in"><div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-scale-in"><div className="text-center mb-6"><h3 className="text-2xl font-black text-slate-800">Resultado</h3><p className="text-slate-500">Introduce el marcador final</p></div><div className="flex items-center justify-between gap-4 mb-8"><div className="flex-1"><div className="bg-slate-50 rounded-2xl border-2 border-slate-200 p-2 mb-2"><input type="tel" value={scoreA} onChange={(e) => setScoreA(e.target.value)} className="w-full bg-transparent text-center text-5xl font-black text-slate-900 outline-none p-2" autoFocus/></div><p className="text-xs font-bold text-center text-slate-500 truncate px-1">{state.matches.find(m => m.id === selectedMatchId) ? getPairName(state.matches.find(m => m.id === selectedMatchId)!.pairAId) : 'P1'}</p></div><span className="text-2xl font-black text-slate-300">-</span><div className="flex-1"><div className="bg-slate-50 rounded-2xl border-2 border-slate-200 p-2 mb-2"><input type="tel" value={scoreB} onChange={(e) => setScoreB(e.target.value)} className="w-full bg-transparent text-center text-5xl font-black text-slate-900 outline-none p-2"/></div><p className="text-xs font-bold text-center text-slate-500 truncate px-1">{state.matches.find(m => m.id === selectedMatchId) ? getPairName(state.matches.find(m => m.id === selectedMatchId)!.pairBId) : 'P2'}</p></div></div><div className="flex gap-3"><button onClick={() => setSelectedMatchId(null)} className="flex-1 py-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancelar</button><button onClick={handleSaveScore} className="flex-1 py-4 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg transition-colors">Guardar</button></div></div></div>)}
      {showResetConfirm && (<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"><div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in text-center"><div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600"><RotateCcw size={32} /></div><h3 className="text-xl font-black text-slate-900 mb-2">¿Reiniciar Configuración?</h3><p className="text-slate-500 mb-6 text-sm">Se borrarán todos los partidos generados y volverás a la pantalla de configuración. <strong className="block mt-2 text-slate-800">Las parejas inscritas NO se borrarán.</strong></p><div className="flex gap-3"><button onClick={() => setShowResetConfirm(false)} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold">Cancelar</button><button onClick={handleResetToSetup} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg">Reiniciar</button></div></div></div>)}
      {nextMatchInfo && (<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"><div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-scale-in text-center"><div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600"><Info size={32} /></div><h3 className="text-xl font-black text-slate-900 mb-4">Resultado Playoff</h3><div className="space-y-3 mb-6 text-left"><div className={`p-3 rounded-xl border ${nextMatchInfo.pA_Won ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}><div className="flex justify-between items-center mb-1"><p className="text-xs font-bold text-slate-400 uppercase">Pareja 1</p>{nextMatchInfo.pA_Won ? <CheckCircle size={14} className="text-emerald-500"/> : <XCircle size={14} className="text-rose-500"/>}</div><div className="font-bold text-slate-800">{nextMatchInfo.pA_Name}</div><div className={`font-bold text-sm mt-1 ${nextMatchInfo.pA_Won ? 'text-emerald-600' : 'text-rose-600'}`}>{nextMatchInfo.pA_Status} {nextMatchInfo.pA_Next ? `➜ ${nextMatchInfo.pA_Next}` : ''}</div></div><div className={`p-3 rounded-xl border ${nextMatchInfo.pB_Won ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}><div className="flex justify-between items-center mb-1"><p className="text-xs font-bold text-slate-400 uppercase">Pareja 2</p>{nextMatchInfo.pB_Won ? <CheckCircle size={14} className="text-emerald-500"/> : <XCircle size={14} className="text-rose-500"/>}</div><div className="font-bold text-slate-800">{nextMatchInfo.pB_Name}</div><div className={`font-bold text-sm mt-1 ${nextMatchInfo.pB_Won ? 'text-emerald-600' : 'text-rose-600'}`}>{nextMatchInfo.pB_Status} {nextMatchInfo.pB_Next ? `➜ ${nextMatchInfo.pB_Next}` : ''}</div></div></div><button onClick={() => setNextMatchInfo(null)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg">Continuar</button></div></div>)}
      {showRoundConfirm && (<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"><div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-scale-in text-center"><div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600 animate-pulse"><Play size={40} fill="currentColor" /></div><h3 className="text-2xl font-black text-slate-900 mb-2">¿Avanzar Ronda?</h3><p className="text-slate-500 mb-8">Se generarán los partidos de la siguiente fase. Asegúrate de que todos los resultados actuales estén correctos.</p><div className="grid grid-cols-1 gap-3"><button onClick={confirmNextRound} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg transition-transform active:scale-95">Confirmar y Avanzar</button><button onClick={() => setShowRoundConfirm(false)} className="w-full py-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">Revisar Resultados</button></div></div></div>)}
      {selectedPairId && (<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center sm:p-4"><div className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md shadow-2xl animate-slide-up h-[80vh] sm:h-auto flex flex-col"><div className="flex justify-end mb-2"><button onClick={() => setSelectedPairId(null)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><X size={20}/></button></div><PairDetailContent pairId={selectedPairId} /></div></div>)}
    </div>
  );
};

export default ActiveTournament;