
import React, { useState, useEffect } from 'react';
import { useTournament } from '../store/TournamentContext';
import { THEME } from '../utils/theme';
import { useHistory } from '../store/HistoryContext';
import { useTimer } from '../store/TimerContext';
import { 
    Users, PlayCircle, Clock, Play, Trophy, Share2, 
    Link, Check, Settings, Edit, Shuffle, 
    ListOrdered, TrendingUp, X, Check as CheckIcon, 
    AlertTriangle, Lock, ArrowLeft, Calendar, LayoutGrid, 
    Hourglass, Gift, FileText, MessageCircle, Copy, Plus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { Modal } from '../components';
import { TournamentFormat, GenerationMethod, Pair, Player } from '../types';

// --- HELPERS ---
const getNumEmoji = (n: number) => {
    const emojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    if (n <= 10) return emojis[n];
    return n.toString().split('').map(digit => emojis[parseInt(digit)]).join('');
};

// --- COMPONENTS ---

// 1. MANUAL WIZARD
interface WizardProps {
    pairs: Pair[];
    players: Player[];
    onComplete: (orderedPairs: Pair[]) => void;
    onCancel: () => void;
    formatName: (p?: Player) => string;
    limit: number; 
}

const ManualGroupingWizard: React.FC<WizardProps> = ({ pairs, players, onComplete, onCancel, formatName, limit }) => {
    // Determine groups based on limit
    let groupNames = ['G1', 'G2', 'G3', 'G4'];
    if (limit === 10) groupNames = ['G1', 'G2'];
    if (limit === 8) groupNames = ['G1', 'G2'];
    if (limit === 12) groupNames = ['G1', 'G2', 'G3'];
    
    const effectiveGroupSize = limit === 10 ? 5 : 4;

    // State: Map of GroupName -> Array of Pair IDs
    const [groups, setGroups] = useState<Record<string, string[]>>(() => {
        const initial: Record<string, string[]> = {};
        groupNames.forEach(g => initial[g] = []);
        return initial;
    });

    const [activeGroup, setActiveGroup] = useState<string>(groupNames[0]);

    // Derived: Available pairs (not in any group)
    const assignedPairIds = new Set(Object.values(groups).flat());
    const availablePairs = pairs.filter(p => !assignedPairIds.has(p.id));

    const isComplete = Object.values(groups).every(g => g.length === effectiveGroupSize);
    const totalAssigned = assignedPairIds.size;

    const handleAddPair = (pairId: string) => {
        if (groups[activeGroup].length >= effectiveGroupSize) return;
        setGroups(prev => ({
            ...prev,
            [activeGroup]: [...prev[activeGroup], pairId]
        }));
    };

    const handleRemovePair = (pairId: string, groupName: string) => {
        setGroups(prev => ({
            ...prev,
            [groupName]: prev[groupName].filter(id => id !== pairId)
        }));
    };

    const handleFinish = () => {
        if (!isComplete) return;
        // Flatten groups in order
        const orderedPairs: Pair[] = [];
        groupNames.forEach(g => {
            groups[g].forEach(pairId => {
                const pair = pairs.find(p => p.id === pairId);
                if (pair) orderedPairs.push(pair);
            });
        });
        onComplete(orderedPairs);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-[150] flex flex-col items-center justify-end sm:justify-center sm:p-4">
            <div className="bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:rounded-3xl sm:max-w-4xl shadow-2xl flex flex-col overflow-hidden">
                
                {/* Header */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                    <h3 className="text-lg font-black text-slate-900">Organizar Grupos ({totalAssigned}/{limit})</h3>
                    <button onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full"><X size={20}/></button>
                </div>

                <div className="flex-1 flex flex-col sm:flex-row overflow-hidden bg-slate-50">
                    
                    {/* LEFT PANEL: GROUPS & ACTIVE GROUP CONTENT */}
                    <div className="flex-1 flex flex-col border-r border-slate-200 overflow-hidden">
                        
                        {/* Group Tabs */}
                        <div className="flex overflow-x-auto p-2 gap-2 bg-white border-b border-slate-100 shrink-0 no-scrollbar">
                            {groupNames.map(g => {
                                const count = groups[g].length;
                                const isFull = count === effectiveGroupSize;
                                const isActive = activeGroup === g;
                                return (
                                    <button 
                                        key={g} 
                                        onClick={() => setActiveGroup(g)}
                                        className={`flex-1 min-w-[60px] py-2 px-3 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${isActive ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-100 bg-white text-slate-400 hover:bg-slate-50'}`}
                                    >
                                        <span className={`text-[10px] font-bold uppercase ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>{g}</span>
                                        <span className={`text-sm font-black ${isFull ? 'text-emerald-500' : isActive ? 'text-slate-800' : 'text-slate-300'}`}>{count}/{effectiveGroupSize}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Active Group Content */}
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Integrantes {activeGroup}</h4>
                            {groups[activeGroup].length === 0 ? (
                                <div className="h-32 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-200 rounded-2xl">
                                    <Users size={24} className="mb-2 opacity-50"/>
                                    <span className="text-xs font-bold">Grupo Vacío</span>
                                    <span className="text-[10px]">Selecciona parejas para añadir</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {groups[activeGroup].map(pairId => {
                                        const pair = pairs.find(p => p.id === pairId);
                                        if (!pair) return null;
                                        const p1 = players.find(p => p.id === pair.player1Id);
                                        const p2 = players.find(p => p.id === pair.player2Id);
                                        return (
                                            <div key={pairId} className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm flex justify-between items-start animate-scale-in relative group">
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-bold text-slate-800 text-xs truncate">{formatName(p1)}</div>
                                                    <div className="font-bold text-slate-600 text-xs truncate">{formatName(p2)}</div>
                                                </div>
                                                <button onClick={() => handleRemovePair(pairId, activeGroup)} className="absolute top-1 right-1 p-1 text-rose-300 hover:text-rose-500 bg-white rounded-full transition-colors">
                                                    <X size={14}/>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT PANEL: AVAILABLE PAIRS */}
                    <div className="flex-1 flex flex-col bg-white sm:border-l border-slate-200 h-1/2 sm:h-auto overflow-hidden shadow-[0_-4px_20px_rgba(0,0,0,0.05)] sm:shadow-none z-10">
                        <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><ListOrdered size={14}/> Disponibles ({availablePairs.length})</h4>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {availablePairs.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 text-sm">Todas las parejas asignadas.</div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {availablePairs.map(pair => {
                                        const p1 = players.find(p => p.id === pair.player1Id);
                                        const p2 = players.find(p => p.id === pair.player2Id);
                                        const isGroupFull = groups[activeGroup].length >= effectiveGroupSize;
                                        return (
                                            <button 
                                                key={pair.id} 
                                                onClick={() => handleAddPair(pair.id)}
                                                disabled={isGroupFull}
                                                className={`w-full p-2 rounded-xl border flex flex-col items-start text-left transition-all relative ${isGroupFull ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-100' : 'bg-white border-slate-100 hover:border-indigo-300 hover:shadow-md cursor-pointer'}`}
                                            >
                                                <div className="w-full">
                                                    <div className="font-bold text-slate-800 text-xs truncate">{formatName(p1)}</div>
                                                    <div className="font-bold text-slate-600 text-xs truncate">{formatName(p2)}</div>
                                                </div>
                                                {!isGroupFull && <div className="absolute top-1 right-1 text-indigo-200"><Plus size={12}/></div>}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-white shrink-0 flex justify-center">
                    <button 
                        onClick={handleFinish} 
                        disabled={!isComplete} 
                        className={`transition-all rounded-xl font-black flex items-center justify-center gap-2 ${isComplete ? 'w-full py-4 text-lg bg-[#575AF9] text-white shadow-lg hover:opacity-90 active:scale-95' : 'w-auto px-8 py-3 text-sm bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                    >
                        {isComplete ? 'CONFIRMAR Y EMPEZAR' : `Asignando... (${totalAssigned}/${limit})`}
                        {isComplete && <Play size={20} fill="currentColor"/>}
                    </button>
                </div>
            </div>
        </div>
    );
};

// 2. TOURNAMENT MANAGER (Single Mini Context)
const TournamentManager: React.FC = () => {
  const { state, startTournamentDB, formatPlayerName, closeTournament, setOverlayOpen } = useTournament();
  const { clubData } = useHistory();
  const { resetTimer, startTimer } = useTimer();
  const { user } = useAuth();
  const navigate = useNavigate();

  // LOCAL UI STATE
  const [showGenerationModal, setShowGenerationModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [generationMethod, setGenerationMethod] = useState<GenerationMethod>('elo-balanced');
  const [showManualWizard, setShowManualWizard] = useState(false);

  // Sync Overlay State
  useEffect(() => {
      setOverlayOpen(showManualWizard || showGenerationModal || showShareModal);
      return () => setOverlayOpen(false);
  }, [showManualWizard, showGenerationModal, showShareModal]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // If no tournament selected, redirect to list
  if (!state.id) {
      navigate('/minis');
      return null;
  }

  // --- CALCULATIONS ---
  const isSetupMode = state.status === 'setup';
  const isActiveMode = state.status === 'active';
  
  const limitMap: Record<TournamentFormat, number> = { '16_mini': 16, '12_mini': 12, '10_mini': 10, '8_mini': 8 };
  const currentLimit = limitMap[state.format] || 16;
  
  const confirmedPairs = state.pairs.filter(p => p.player2Id && p.status === 'confirmed');
  const titularPairs = confirmedPairs.filter(p => !p.isReserve).slice(0, currentLimit);
  const reservePairs = confirmedPairs.filter(p => p.isReserve || confirmedPairs.indexOf(p) >= currentLimit);
  
  const canStart = titularPairs.length >= currentLimit;
  const missingPairs = Math.max(0, currentLimit - titularPairs.length);

  const dateObj = new Date(state.startDate || Date.now());
  const dateStr = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }).toUpperCase();
  const timeStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  // --- SHARE LOGIC ---
  const generateWhatsAppMessage = () => {
      return `Torneo en ${clubData.name} - ${state.title}\nApúntate: ${window.location.origin}/#/join/${user?.id}`;
  };

  const handleCopyMessage = () => {
      const msg = generateWhatsAppMessage();
      navigator.clipboard.writeText(msg);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleStartTournament = async () => {
      if (generationMethod === 'manual') { setShowManualWizard(true); return; }
      try { 
          await startTournamentDB(generationMethod); 
          resetTimer(); startTimer();
          setShowGenerationModal(false);
          navigate('/tournament/active');
      } catch (e: any) { setErrorMessage(e.message || "Error al iniciar."); }
  };

  const handleManualWizardComplete = async (orderedPairs: Pair[]) => {
      setShowManualWizard(false);
      try { 
          await startTournamentDB('manual', orderedPairs); 
          resetTimer(); startTimer();
          setShowGenerationModal(false);
          navigate('/tournament/active');
      } catch (e: any) { setErrorMessage(e.message || "Error manual."); }
  };

  const StatCard = ({ title, value, subValue, icon: Icon, onClick, active }: any) => (
    <div 
      onClick={onClick}
      className={`p-4 rounded-2xl border transition-all shadow-sm flex flex-col justify-between h-24 relative overflow-hidden bg-white border-slate-100 cursor-pointer hover:border-indigo-200 hover:shadow-md`}
    >
      <div className="flex justify-between items-start z-10">
          <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider opacity-70 text-slate-400">{title}</h3>
              <div className="text-2xl font-black tracking-tight mt-1 text-slate-800">{value}</div>
          </div>
          <div className={`p-2 rounded-xl bg-slate-50 text-indigo-500`}>
            <Icon size={20} />
          </div>
      </div>
      {subValue && active && (
          <div className="text-[10px] font-bold text-slate-400 mt-auto z-10">{subValue}</div>
      )}
    </div>
  );

  return (
    <div className="pb-10 space-y-6 text-white animate-fade-in">
      
      {/* 1. HEADER */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><Trophy size={120} /></div>
          <div className="relative z-10 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${isSetupMode ? 'bg-orange-100 text-orange-600 border-orange-200' : 'bg-emerald-100 text-emerald-600 border-emerald-200'}`}>
                        {isSetupMode ? 'Inscripción' : 'En Juego'}
                    </span>
                    <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                        <Calendar size={12}/> {dateStr}, {timeStr}
                    </span>
                </div>
                <button onClick={() => navigate('/setup')} className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-500 rounded-lg transition-colors">
                    <Edit size={16}/>
                </button>
              </div>
              <h1 className="text-2xl font-black text-slate-900 leading-tight">{state.title || 'Torneo Sin Título'}</h1>
              <div className="flex flex-wrap gap-2 pt-1">
                  {state.levelRange && <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md text-xs font-bold text-slate-600 border border-slate-100"><TrendingUp size={12}/> {state.levelRange}</div>}
              </div>
          </div>
      </div>

      {/* 2. KEY METRICS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="Inscritos" value={`${titularPairs.length}/${currentLimit}`} subValue={reservePairs.length > 0 ? `+${reservePairs.length} Reservas` : null} icon={Users} onClick={() => navigate('/tournament/registration')} active={true} />
          {isActiveMode ? (
              <StatCard title="Ronda Actual" value={`Ronda ${state.currentRound}`} icon={Clock} onClick={() => navigate('/tournament/active')} active={true} />
          ) : (
              <StatCard title="Formato" value={`Mini ${currentLimit}`} icon={LayoutGrid} onClick={() => navigate('/setup')} active={true} />
          )}
          <StatCard title="Control" value="Pistas" icon={Settings} onClick={() => navigate('/tournament/checkin')} active={true} />
          <StatCard title="Resultados" value="Live" icon={Trophy} onClick={() => navigate('/tournament/results')} active={true} />
      </div>

      {/* 3. SETUP PHASE PANEL */}
      {isSetupMode && (
          <div className="animate-fade-in space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><Settings size={18} className="text-slate-400"/> Gestión de Inscripciones</h3>
                  
                  {/* Progress Bar */}
                  <div className="mb-2 flex justify-between text-xs font-bold">
                      <span className={missingPairs > 0 ? "text-amber-500" : "text-emerald-500"}>{missingPairs > 0 ? `Faltan ${missingPairs} parejas` : '¡Completo!'}</span>
                      <span className="text-slate-400">{Math.round((titularPairs.length / currentLimit) * 100)}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-6">
                      <div className={`h-full transition-all duration-500 rounded-full ${missingPairs > 0 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min((titularPairs.length / currentLimit) * 100, 100)}%` }}></div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button onClick={() => navigate('/tournament/registration')} className="w-full py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold rounded-xl transition-all flex items-center justify-center gap-2">
                          <Users size={18}/> Lista Jugadores
                      </button>
                      <button onClick={() => setShowShareModal(true)} className="w-full py-3 bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition-all flex items-center justify-center gap-2">
                          <Share2 size={18}/> Convocatoria
                      </button>
                  </div>
              </div>

              {/* Launch Button */}
              <button 
                onClick={() => setShowGenerationModal(true)}
                disabled={!canStart}
                style={{ backgroundColor: canStart ? THEME.cta : '#e2e8f0' }}
                className={`w-full py-6 rounded-xl font-black text-white text-lg shadow-lg flex flex-col items-center justify-center gap-1 transition-all ${canStart ? 'hover:opacity-90 active:scale-95' : 'cursor-not-allowed text-slate-400'}`}
              >
                  <div className="flex items-center gap-2">
                    {canStart ? <Play size={24} fill="currentColor"/> : <Lock size={24}/>}
                    {canStart ? 'GENERAR CUADROS Y EMPEZAR' : 'NECESITAS EL CUPO COMPLETO'}
                  </div>
                  {!canStart && <span className="text-[10px] font-bold uppercase opacity-60">Faltan {missingPairs} parejas titulares</span>}
              </button>
          </div>
      )}

      {/* 4. ACTIVE PHASE PANEL */}
      {isActiveMode && (
          <div className="animate-slide-up space-y-4">
              <button onClick={() => navigate('/tournament/active')} style={{ backgroundColor: THEME.cta }} className="w-full py-8 text-white rounded-2xl font-black text-xl shadow-xl shadow-indigo-900/50 flex flex-col items-center justify-center gap-2 hover:opacity-90 transition-colors">
                  <div className="flex items-center gap-3"><PlayCircle size={32} fill="currentColor"/> IR AL DIRECTO</div>
                  <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full text-white uppercase tracking-wider">Gestionar Partidos</span>
              </button>
          </div>
      )}

      <Modal
          isOpen={showGenerationModal}
          onClose={() => setShowGenerationModal(false)}
          title="Tipo de Sorteo"
          size="md"
          actions={[{ label: 'EMPEZAR YA', onClick: handleStartTournament, variant: 'primary' }]}
      >
          <div className="space-y-2 text-left">
              <button onClick={() => setGenerationMethod('elo-balanced')} className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${generationMethod === 'elo-balanced' ? 'border-[#575AF9] bg-indigo-50' : 'border-slate-100'}`}><TrendingUp size={20} className="text-[#575AF9]"/><div><div className="font-bold text-slate-900 text-sm">Por Nivel (Equilibrado)</div><div className="text-xs text-slate-500">Mejores al Grupo A, peores al D.</div></div></button>
              <button onClick={() => setGenerationMethod('elo-mixed')} className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${generationMethod === 'elo-mixed' ? 'border-[#575AF9] bg-indigo-50' : 'border-slate-100'}`}><Shuffle size={20} className="text-[#575AF9]"/><div><div className="font-bold text-slate-900 text-sm">Mix (Cremallera)</div><div className="text-xs text-slate-500">Reparte el nivel en todos los grupos.</div></div></button>
              <button onClick={() => setGenerationMethod('manual')} className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${generationMethod === 'manual' ? 'border-[#575AF9] bg-indigo-50' : 'border-slate-100'}`}><ListOrdered size={20} className="text-[#575AF9]"/><div><div className="font-bold text-slate-900 text-sm">Manual</div><div className="text-xs text-slate-500">Elige tú mismo los grupos.</div></div></button>
          </div>
      </Modal>

      <Modal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          title="Compartir Torneo"
          icon={<MessageCircle size={28} />}
          iconColor="success"
          size="md"
          actions={[{ label: linkCopied ? '¡Copiado!' : 'Copiar Texto', onClick: handleCopyMessage, variant: 'secondary' }]}
      >
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-xs whitespace-pre-wrap leading-relaxed text-slate-700 select-all max-h-48 overflow-y-auto text-left">
              {generateWhatsAppMessage()}
          </div>
      </Modal>

      {/* MANUAL WIZARD */}
      {showManualWizard && (
          <ManualGroupingWizard 
              pairs={confirmedPairs}
              players={state.players}
              onComplete={handleManualWizardComplete}
              onCancel={() => setShowManualWizard(false)}
              formatName={formatPlayerName}
              limit={currentLimit}
          />
      )}

    </div>
  );
};

export default TournamentManager;
