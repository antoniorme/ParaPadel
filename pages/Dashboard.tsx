
import React, { useState, useEffect } from 'react';
import { useTournament } from '../store/TournamentContext';
import { THEME, getFormatColor } from '../utils/theme';
import { useHistory } from '../store/HistoryContext';
import { useTimer } from '../store/TimerContext';
import { Users, PlayCircle, CheckCircle, Clock, Play, Trophy, Smartphone, Link, Check, Settings, Edit, Shuffle, ListOrdered, TrendingUp, X, Check as CheckIcon, AlertTriangle, Lock, ArrowLeft, Calendar, LayoutGrid } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { TournamentFormat, GenerationMethod, Pair, Player } from '../types';
import ClubDashboard from './ClubDashboard'; // Fallback view

// --- COMPONENTS ---

// 1. MANUAL WIZARD (Kept same logic, just minor style tweaks if needed)
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
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[150] flex flex-col items-center justify-center p-4">
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
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-[#575AF9] border-[#575AF9]' : 'border-slate-300'}`}>{isSelected && <CheckIcon size={14} className="text-white" strokeWidth={3}/>}</div>
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

// 2. MAIN DASHBOARD
const Dashboard: React.FC = () => {
  const { state, startTournamentDB, setTournamentFormat, formatPlayerName, closeTournament } = useTournament();
  const { archiveTournament } = useHistory();
  const { resetTimer, startTimer } = useTimer();
  const { user } = useAuth();
  const navigate = useNavigate();

  // LOCAL UI STATE
  const [showGenerationModal, setShowGenerationModal] = useState(false);
  const [generationMethod, setGenerationMethod] = useState<GenerationMethod>('elo-balanced');
  const [showManualWizard, setShowManualWizard] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // ROUTING CHECK
  if (!state.id || state.status === 'finished') {
      return <ClubDashboard />;
  }

  // --- CALCULATIONS ---
  const isSetupMode = state.status === 'setup';
  const isActiveMode = state.status === 'active';
  
  // Format Logic
  const limitMap: Record<TournamentFormat, number> = { '16_mini': 16, '12_mini': 12, '10_mini': 10, '8_mini': 8 };
  const currentLimit = limitMap[state.format] || 16;
  
  // Counts
  const confirmedPairs = state.pairs.filter(p => !p.isReserve && p.player2Id && p.status === 'confirmed');
  const totalConfirmed = confirmedPairs.length;
  const reservePairsCount = state.pairs.filter(p => p.isReserve && p.player2Id).length;
  const canStart = totalConfirmed >= currentLimit;
  const missingPairs = Math.max(0, currentLimit - totalConfirmed);

  // Format Date
  const dateObj = new Date(state.startDate || Date.now());
  const dateStr = dateObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long' });
  const timeStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  // --- HANDLERS ---

  const handleBackToClub = () => {
      closeTournament();
      navigate('/dashboard');
  };

  const handleCopyLink = () => {
      if (!user) return;
      const url = `${window.location.origin}/#/join/${user.id}`;
      navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleStartTournament = async () => {
      if (generationMethod === 'manual') { setShowManualWizard(true); return; }
      try { 
          await startTournamentDB(generationMethod); 
          resetTimer(); startTimer();
          setShowGenerationModal(false);
          navigate('/active');
      } catch (e: any) { setErrorMessage(e.message || "Error al iniciar."); }
  };

  const handleManualWizardComplete = async (orderedPairs: Pair[]) => {
      setShowManualWizard(false);
      try { 
          await startTournamentDB('manual', orderedPairs); 
          resetTimer(); startTimer();
          setShowGenerationModal(false);
          navigate('/active');
      } catch (e: any) { setErrorMessage(e.message || "Error manual."); }
  };

  // --- RENDER HELPERS ---

  const StatCard = ({ title, value, subValue, icon: Icon, color, onClick, active }: any) => (
    <div 
      onClick={onClick}
      className={`p-4 rounded-2xl border transition-all shadow-sm flex flex-col justify-between h-24 relative overflow-hidden ${active ? 'bg-white border-slate-200 hover:border-blue-300 cursor-pointer' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
    >
      <div className="flex justify-between items-start z-10">
          <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider opacity-70">{title}</h3>
              <div className={`text-2xl font-black tracking-tight mt-1 ${active ? 'text-slate-800' : 'text-slate-400'}`}>{value}</div>
          </div>
          <div className={`p-2 rounded-xl ${active ? color.replace('text-', 'bg-').replace('400', '50') + ' ' + color.replace('400', '600') : 'bg-slate-100 text-slate-300'}`}>
            <Icon size={20} />
          </div>
      </div>
      {subValue && active && (
          <div className="text-[10px] font-bold text-slate-500 mt-auto z-10">{subValue}</div>
      )}
    </div>
  );

  return (
    <div className="pb-10 space-y-6">
      
      {/* 1. TOP NAVIGATION & HEADER */}
      <div>
          <button 
            onClick={handleBackToClub}
            className="flex items-center gap-2 text-slate-500 font-bold text-sm hover:text-slate-800 transition-colors mb-4 px-1"
          >
              <ArrowLeft size={18}/> Volver al Club
          </button>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Trophy size={120} />
              </div>
              
              <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${isSetupMode ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                          {isSetupMode ? 'Configuración' : 'En Juego'}
                      </span>
                      <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                          <Calendar size={12}/> {dateStr}, {timeStr}
                      </span>
                  </div>
                  <h1 className="text-2xl font-black text-slate-900 leading-tight">{state.title || 'Torneo Sin Título'}</h1>
                  <p className="text-sm text-slate-500 font-medium mt-0.5">{state.levelRange || 'Nivel Abierto'}</p>
              </div>
          </div>
      </div>

      {/* 2. KEY METRICS GRID */}
      <div className="grid grid-cols-3 gap-3">
          <StatCard 
            title="Parejas" 
            value={`${totalConfirmed}/${currentLimit}`} 
            subValue={reservePairsCount > 0 ? `+${reservePairsCount} Reservas` : null}
            icon={Users} 
            color="text-blue-400" 
            active={true}
            onClick={() => navigate('/registration')}
          />
          
          <StatCard 
            title="Estado" 
            value={isActiveMode ? 'ACTIVO' : 'SETUP'} 
            icon={isSetupMode ? Settings : PlayCircle} 
            color={isActiveMode ? "text-rose-400" : "text-amber-400"} 
            active={true}
          />

          {isActiveMode ? (
              <StatCard 
                title="Ronda" 
                value={state.currentRound} 
                icon={Clock} 
                color="text-emerald-400" 
                active={true}
                onClick={() => navigate('/active')}
              />
          ) : (
              <StatCard 
                title="Formato" 
                value={currentLimit} 
                subValue="Parejas"
                icon={LayoutGrid} 
                color="text-slate-400" 
                active={false}
              />
          )}
      </div>

      {/* 3. SETUP PHASE PANEL */}
      {isSetupMode && (
          <div className="animate-fade-in space-y-6">
              
              {/* Format Selector */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Settings size={18} className="text-slate-400"/> Formato del Torneo
                  </h3>
                  
                  <div className="grid grid-cols-4 gap-2 mb-6">
                      {['16_mini', '12_mini', '10_mini', '8_mini'].map((fmt) => {
                          const isSelected = state.format === fmt;
                          const num = fmt.split('_')[0];
                          return (
                              <button 
                                key={fmt}
                                onClick={() => setTournamentFormat(fmt as TournamentFormat)}
                                className={`py-3 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${isSelected ? 'border-[#575AF9] bg-indigo-50 text-[#575AF9]' : 'border-slate-100 text-slate-400 hover:border-slate-300'}`}
                              >
                                  <span className="text-lg font-black">{num}</span>
                                  <span className="text-[9px] font-bold uppercase">Parejas</span>
                              </button>
                          )
                      })}
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-2 flex justify-between text-xs font-bold">
                      <span className={missingPairs > 0 ? "text-amber-600" : "text-emerald-600"}>
                          {missingPairs > 0 ? `Faltan ${missingPairs} parejas` : '¡Completo!'}
                      </span>
                      <span className="text-slate-400">{Math.round((totalConfirmed / currentLimit) * 100)}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-6">
                      <div 
                        className={`h-full transition-all duration-500 rounded-full ${missingPairs > 0 ? 'bg-amber-400' : 'bg-emerald-500'}`} 
                        style={{ width: `${Math.min((totalConfirmed / currentLimit) * 100, 100)}%` }}
                      ></div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-1 gap-3">
                      <button 
                        onClick={() => navigate('/registration')}
                        className="w-full py-4 bg-white border-2 border-indigo-100 text-indigo-700 font-bold rounded-xl hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
                      >
                          <Users size={20}/> Gestionar Inscripciones
                      </button>
                      <button 
                        onClick={handleCopyLink}
                        className="w-full py-3 bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                          {linkCopied ? <Check size={16}/> : <Link size={16}/>}
                          {linkCopied ? 'Copiado' : 'Copiar Link Público'}
                      </button>
                  </div>
              </div>

              {/* Launch Button */}
              <button 
                onClick={() => setShowGenerationModal(true)}
                disabled={!canStart}
                style={{ backgroundColor: canStart ? THEME.cta : '#e2e8f0' }}
                className={`w-full py-6 rounded-xl font-bold text-white text-lg shadow-lg flex items-center justify-center gap-3 transition-all ${canStart ? 'hover:opacity-90 active:scale-95' : 'cursor-not-allowed text-slate-400'}`}
              >
                  {canStart ? <Play size={24} fill="currentColor"/> : <Lock size={24}/>}
                  GENERAR CUADROS Y EMPEZAR
              </button>
          </div>
      )}

      {/* 4. ACTIVE PHASE PANEL */}
      {isActiveMode && (
          <div className="animate-slide-up space-y-4">
              <button 
                onClick={() => navigate('/active')}
                className="w-full py-8 bg-rose-600 text-white rounded-2xl font-black text-xl shadow-xl shadow-rose-200 flex flex-col items-center justify-center gap-2 animate-pulse hover:bg-rose-700 transition-colors"
              >
                  <div className="flex items-center gap-3">
                      <PlayCircle size={32} fill="currentColor"/>
                      IR AL DIRECTO
                  </div>
                  <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full text-white uppercase tracking-wider">
                      Gestionar Partidos
                  </span>
              </button>

              <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => navigate('/checkin')}
                    className="p-4 bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-emerald-300 transition-all shadow-sm"
                  >
                      <Clock size={24} className="text-emerald-500"/>
                      <span className="font-bold text-slate-700">Control Pistas</span>
                  </button>
                  <button 
                    onClick={() => navigate('/results')}
                    className="p-4 bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-blue-300 transition-all shadow-sm"
                  >
                      <Trophy size={24} className="text-blue-500"/>
                      <span className="font-bold text-slate-700">Resultados</span>
                  </button>
              </div>
              
              <div className="pt-4 border-t border-slate-200 mt-4">
                  <button onClick={() => navigate('/setup')} className="w-full py-3 text-slate-400 font-bold text-xs flex items-center justify-center gap-2 hover:text-slate-600 transition-colors">
                      <Edit size={14}/> Editar Detalles del Torneo
                  </button>
              </div>
          </div>
      )}

      {/* GENERATION MODAL (Hidden by default) */}
      {showGenerationModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center sm:p-4">
              <div className="bg-white w-full h-auto rounded-t-3xl sm:rounded-3xl p-6 max-w-lg shadow-2xl animate-slide-up">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-slate-900">Tipo de Sorteo</h3>
                      <button onClick={() => setShowGenerationModal(false)} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                      <button onClick={() => setGenerationMethod('elo-balanced')} className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${generationMethod === 'elo-balanced' ? 'border-[#575AF9] bg-indigo-50' : 'border-slate-100'}`}>
                          <TrendingUp size={24} className="text-[#575AF9]"/>
                          <div>
                              <div className="font-bold text-slate-900">Por Nivel (Equilibrado)</div>
                              <div className="text-xs text-slate-500">Mejores al Grupo A, peores al D.</div>
                          </div>
                      </button>
                      <button onClick={() => setGenerationMethod('elo-mixed')} className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${generationMethod === 'elo-mixed' ? 'border-[#575AF9] bg-indigo-50' : 'border-slate-100'}`}>
                          <Shuffle size={24} className="text-[#575AF9]"/>
                          <div>
                              <div className="font-bold text-slate-900">Mix (Cremallera)</div>
                              <div className="text-xs text-slate-500">Reparte el nivel en todos los grupos.</div>
                          </div>
                      </button>
                      <button onClick={() => setGenerationMethod('manual')} className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${generationMethod === 'manual' ? 'border-[#575AF9] bg-indigo-50' : 'border-slate-100'}`}>
                          <ListOrdered size={24} className="text-[#575AF9]"/>
                          <div>
                              <div className="font-bold text-slate-900">Manual</div>
                              <div className="text-xs text-slate-500">Tú decides los grupos uno a uno.</div>
                          </div>
                      </button>
                  </div>

                  <button 
                    onClick={handleStartTournament}
                    style={{ backgroundColor: THEME.cta }} 
                    className="w-full py-4 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 hover:opacity-90 active:scale-95"
                  >
                      <Play size={20} fill="currentColor"/> EMPEZAR YA
                  </button>
              </div>
          </div>
      )}

      {/* ERROR & WIZARD MODALS */}
      {errorMessage && (
          <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center p-4">
              <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm text-center">
                  <AlertTriangle size={32} className="mx-auto text-rose-500 mb-2"/>
                  <p className="font-bold text-slate-800 mb-4">{errorMessage}</p>
                  <button onClick={() => setErrorMessage(null)} className="w-full py-3 bg-slate-100 font-bold rounded-xl">Cerrar</button>
              </div>
          </div>
      )}

      {showManualWizard && (
          <ManualGroupingWizard 
            pairs={confirmedPairs.slice(0, currentLimit)} 
            players={state.players} 
            onCancel={() => setShowManualWizard(false)} 
            onComplete={handleManualWizardComplete} 
            formatName={formatPlayerName} 
            limit={currentLimit} 
          />
      )}

    </div>
  );
};

export default Dashboard;
