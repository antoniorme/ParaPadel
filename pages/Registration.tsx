import React, { useState } from 'react';
import { useTournament, TOURNAMENT_CATEGORIES, GenerationMethod, getPairElo } from '../store/TournamentContext';
import { Users, Trash2, Edit2, Plus, Search, Check, Save, User, X, AlertTriangle, TrendingUp, ListOrdered, Clock, Shuffle, CheckCircle } from 'lucide-react';
import { Player, Pair } from '../types';

type ViewMode = 'menu' | 'pair-form';

// --- MANUAL WIZARD COMPONENT ---
interface WizardProps {
    pairs: Pair[];
    players: Player[];
    onComplete: (orderedPairs: Pair[]) => void;
    onCancel: () => void;
    formatName: (p?: Player) => string;
}

const ManualGroupingWizard: React.FC<WizardProps> = ({ pairs, players, onComplete, onCancel, formatName }) => {
    const [currentGroupIdx, setCurrentGroupIdx] = useState(0); // 0=A, 1=B, 2=C, 3=D
    const [orderedPairs, setOrderedPairs] = useState<Pair[]>([]);
    
    const groups = ['A', 'B', 'C', 'D'];
    const currentGroup = groups[currentGroupIdx];
    
    // Parejas ya asignadas a grupos anteriores
    const assignedIds = new Set(orderedPairs.map(p => p.id));
    // Parejas disponibles para asignar
    const availablePairs = pairs.filter(p => !assignedIds.has(p.id));
    
    // Selección temporal para el grupo actual
    const [selectedForGroup, setSelectedForGroup] = useState<string[]>([]);

    const toggleSelection = (id: string) => {
        if (selectedForGroup.includes(id)) {
            setSelectedForGroup(selectedForGroup.filter(pid => pid !== id));
        } else {
            if (selectedForGroup.length < 4) {
                setSelectedForGroup([...selectedForGroup, id]);
            }
        }
    };

    const confirmGroup = () => {
        if (selectedForGroup.length !== 4) return;
        
        // Añadir las seleccionadas al orden final
        const newGroupPairs = selectedForGroup.map(id => pairs.find(p => p.id === id)!);
        const newOrder = [...orderedPairs, ...newGroupPairs];
        setOrderedPairs(newOrder);
        setSelectedForGroup([]);

        if (currentGroupIdx < 3) {
            setCurrentGroupIdx(currentGroupIdx + 1);
        } else {
            // Finalizado
            onComplete(newOrder);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl h-[85vh] flex flex-col">
                <div className="text-center mb-4">
                    <h3 className="text-2xl font-black text-slate-900">Configurar Grupo {currentGroup}</h3>
                    <p className="text-slate-500 text-sm">Selecciona 4 parejas de la lista</p>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-2 mb-4 custom-scrollbar">
                    {availablePairs.map(pair => {
                        const p1 = players.find(p => p.id === pair.player1Id);
                        const p2 = players.find(p => p.id === pair.player2Id);
                        const isSelected = selectedForGroup.includes(pair.id);
                        
                        return (
                            <div 
                                key={pair.id} 
                                onClick={() => toggleSelection(pair.id)}
                                className={`p-3 rounded-xl border-2 flex justify-between items-center cursor-pointer transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-white hover:border-slate-300'}`}
                            >
                                <div>
                                    <div className="font-bold text-slate-800 text-sm">{formatName(p1)}</div>
                                    <div className="font-bold text-slate-800 text-sm">& {formatName(p2)}</div>
                                </div>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                                    {isSelected && <Check size={14} className="text-white" strokeWidth={3}/>}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
                    <div className="text-center font-bold text-emerald-600 mb-2">
                        Seleccionadas: {selectedForGroup.length} / 4
                    </div>
                    <button 
                        onClick={confirmGroup}
                        disabled={selectedForGroup.length !== 4}
                        className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 ${selectedForGroup.length === 4 ? 'bg-emerald-600 text-white animate-pulse' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    >
                        {currentGroupIdx === 3 ? 'Finalizar y Empezar' : `Confirmar Grupo ${currentGroup} >`}
                    </button>
                    <button onClick={onCancel} className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">Cancelar</button>
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

const Registration: React.FC = () => {
  const { state, addPlayerToDB, createPairInDB, updatePairDB, deletePairDB, startTournamentDB, formatPlayerName } = useTournament();
  const [viewMode, setViewMode] = useState<ViewMode>('menu');

  const [isEditingPairId, setIsEditingPairId] = useState<string | null>(null);
  const [selectedP1, setSelectedP1] = useState('');
  const [selectedP2, setSelectedP2] = useState('');
  
  // MODAL STATES
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [showManualWizard, setShowManualWizard] = useState(false);
  
  // Logic Change: Generation Method State
  const [generationMethod, setGenerationMethod] = useState<GenerationMethod>('elo-balanced');

  const activePairs = state.pairs || [];

  const assignedPlayerIds = activePairs.reduce((acc, pair) => {
      if (isEditingPairId && pair.id === isEditingPairId) return acc;
      if (pair.player1Id) acc.add(pair.player1Id);
      if (pair.player2Id) acc.add(pair.player2Id);
      return acc;
  }, new Set<string>());

  const PlayerSelector = ({ label, selectedId, onSelect, otherSelectedId }: any) => {
      const [tab, setTab] = useState<'search' | 'new'>('search');
      const [searchQuery, setSearchQuery] = useState('');
      const [newPlayer, setNewPlayer] = useState({ name: '', nickname: '', categories: [] as string[], saveRecord: false, manual_rating: 5 });
      
      const selectedPlayer = state.players.find(p => p.id === selectedId);
      
      const filteredPlayers = state.players.filter(p => {
          const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                (p.nickname && p.nickname.toLowerCase().includes(searchQuery.toLowerCase()));
          const notAssigned = !assignedPlayerIds.has(p.id);
          const notOtherSlot = p.id !== otherSelectedId;
          
          return matchesSearch && notAssigned && notOtherSlot;
      });

      const handleCreatePlayer = async () => {
          if(!newPlayer.name) return;
          const newId = await addPlayerToDB(newPlayer);
          if(newId) { onSelect(newId); setNewPlayer({ name: '', nickname: '', categories: [], saveRecord: false, manual_rating: 5 }); setTab('search'); }
      };
      const toggleNewCat = (cat: string) => { setNewPlayer(prev => { const exists = prev.categories.includes(cat); return { ...prev, categories: exists ? prev.categories.filter(c => c !== cat) : [...prev.categories, cat] }; }); };

      return (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 shadow-sm">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">{label}</label>
              {selectedId ? (
                  <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-emerald-200 shadow-sm animate-fade-in">
                      <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 border border-emerald-200"><User size={16} /></div>
                          <div>
                              <div className="font-bold text-slate-800 text-sm">{formatPlayerName(selectedPlayer)}</div>
                          </div>
                      </div>
                      <button onClick={() => onSelect('')} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><X size={18}/></button>
                  </div>
              ) : (
                  <>
                      <div className="flex bg-white p-1 rounded-lg border border-slate-200 mb-3 shadow-sm">
                          <button onClick={() => setTab('search')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${tab === 'search' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Search size={14}/> Buscar</button>
                          <button onClick={() => setTab('new')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${tab === 'new' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Plus size={14}/> Nuevo</button>
                      </div>
                      {tab === 'search' ? (
                          <div className="animate-fade-in">
                              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Escribe para buscar..." className="w-full p-3 text-sm bg-white border border-slate-300 rounded-lg mb-2 focus:border-blue-500 outline-none text-slate-800 placeholder:text-slate-400 shadow-inner" autoFocus />
                              <div className="max-h-40 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                  {filteredPlayers.slice(0, 50).map(p => (
                                      <button key={p.id} onClick={() => onSelect(p.id)} className="w-full text-left p-2 hover:bg-blue-50 rounded flex items-center justify-between text-sm text-slate-700 border border-transparent hover:border-blue-100 transition-colors">
                                          <span className="font-medium">{formatPlayerName(p)}</span>
                                          <div className="flex items-center gap-2">{p.categories?.[0] && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{p.categories[0]}</span>}</div>
                                      </button>
                                  ))}
                                  {filteredPlayers.length === 0 && <p className="text-xs text-center text-slate-400 py-4 italic">No hay jugadores disponibles.</p>}
                              </div>
                          </div>
                      ) : (
                          <div className="space-y-3 animate-fade-in">
                              <input placeholder="Nombre completo" value={newPlayer.name} onChange={e => setNewPlayer({...newPlayer, name: e.target.value})} className="w-full p-3 text-sm bg-white border border-slate-300 rounded-lg outline-none focus:border-emerald-500 text-slate-800 placeholder:text-slate-400" autoFocus />
                              <input placeholder="Apodo (opcional)" value={newPlayer.nickname} onChange={e => setNewPlayer({...newPlayer, nickname: e.target.value})} className="w-full p-3 text-sm bg-white border border-slate-300 rounded-lg outline-none focus:border-emerald-500 text-slate-800 placeholder:text-slate-400" />
                              
                              <div className="bg-slate-100 p-3 rounded-lg border border-slate-200">
                                  <div className="flex justify-between items-center mb-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Nivel (ELO Manual)</label>
                                    <span className="text-sm font-black text-emerald-600">{newPlayer.manual_rating}</span>
                                  </div>
                                  <input 
                                    type="range" min="1" max="10" step="0.5" 
                                    value={newPlayer.manual_rating} 
                                    onChange={e => setNewPlayer({...newPlayer, manual_rating: parseFloat(e.target.value)})}
                                    className="w-full accent-emerald-600 h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer"
                                  />
                              </div>

                              <div className="flex flex-wrap gap-1.5">{TOURNAMENT_CATEGORIES.map(c => (<button key={c} onClick={() => toggleNewCat(c)} className={`px-2.5 py-1.5 text-[10px] font-bold rounded-md border transition-all ${newPlayer.categories.includes(c) ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-200'}`}>{c}</button>))}</div>
                              <div onClick={() => setNewPlayer(p => ({...p, saveRecord: !p.saveRecord}))} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${newPlayer.saveRecord ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${newPlayer.saveRecord ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'}`}>{newPlayer.saveRecord && <Check size={14} className="text-white" strokeWidth={3} />}</div>
                                  <span className={`text-xs font-bold ${newPlayer.saveRecord ? 'text-emerald-700' : 'text-slate-500'}`}>Guardar en Base de Datos</span>
                              </div>
                              <button onClick={handleCreatePlayer} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-md transition-colors flex items-center justify-center gap-2"><Check size={16}/> Usar Jugador</button>
                          </div>
                      )}
                  </>
              )}
          </div>
      );
  };

  const handleSavePair = async () => {
      if (!selectedP1 || !selectedP2) return setAlertMessage("Selecciona dos jugadores.");
      if (selectedP1 === selectedP2) return setAlertMessage("Los jugadores deben ser distintos.");

      if (isEditingPairId) {
          await updatePairDB(isEditingPairId, selectedP1, selectedP2);
      } else {
          if (state.pairs.length >= 20) return setAlertMessage("Límite de parejas alcanzado.");
          await createPairInDB(selectedP1, selectedP2);
      }
      
      setSelectedP1(''); setSelectedP2(''); setIsEditingPairId(null);
      setViewMode('menu');
  };

  const startEditPair = (pairId: string) => {
      const pair = state.pairs.find(p => p.id === pairId);
      if (!pair) return;
      setSelectedP1(pair.player1Id);
      setSelectedP2(pair.player2Id);
      setIsEditingPairId(pairId);
      setViewMode('pair-form');
  };

  const deletePairHandler = async () => {
      if (showDeleteModal) {
          await deletePairDB(showDeleteModal);
          setShowDeleteModal(null);
      }
  };
  
  const handleStartClick = async () => {
      if (generationMethod === 'manual') {
          // Si es manual, abrimos el Wizard en lugar de empezar directamente
          setShowManualWizard(true);
      } else {
          try {
              await startTournamentDB(generationMethod);
          } catch (e: any) {
              setAlertMessage(e.message || "Error al iniciar el torneo.");
          }
      }
  };

  const handleManualWizardComplete = async (orderedPairs: Pair[]) => {
      setShowManualWizard(false);
      try {
          // Llamamos a start pasando el orden custom
          await startTournamentDB('manual', orderedPairs);
      } catch (e: any) {
          setAlertMessage(e.message || "Error al iniciar el torneo manual.");
      }
  };

  const canStart = activePairs.filter(p => !p.isReserve).length === 16;

  const PairList = ({ pairs, title, colorClass }: { pairs: any[], title: string, colorClass: string }) => (
      <div className="mt-8">
            <h3 className={`text-sm uppercase font-bold mb-4 tracking-wider ${colorClass}`}>{title}</h3>
            <div className="space-y-3">
                {pairs.map((pair, idx) => {
                    const p1 = state.players.find(p => p.id === pair.player1Id);
                    const p2 = state.players.find(p => p.id === pair.player2Id);
                    const pairElo = getPairElo(pair, state.players);

                    return (
                        <div key={pair.id} className="bg-white p-4 rounded-xl flex items-center justify-between border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-4 overflow-hidden w-full">
                                <span className="bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 text-slate-500 border border-slate-200">{idx + 1}</span>
                                <div className="flex flex-col w-full">
                                    <div className="text-base font-bold text-slate-800 truncate">{formatPlayerName(p1)}</div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-emerald-500 text-xs font-black">&</span>
                                        <div className="text-base font-bold text-slate-800 truncate">{formatPlayerName(p2)}</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col items-center justify-center bg-slate-50 px-2 py-1 rounded border border-slate-100 min-w-[50px]">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1"><TrendingUp size={8}/> ELO</span>
                                    <span className="text-xs font-black text-slate-700">{pairElo}</span>
                                </div>

                                <div className="flex items-center gap-1">
                                    <button onClick={() => startEditPair(pair.id)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-200 transition-colors"><Edit2 size={18}/></button>
                                    <button onClick={() => setShowDeleteModal(pair.id)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 rounded-lg border border-slate-100 hover:border-red-200 transition-colors"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        </div>
                    )
                })}
                 {pairs.length === 0 && <p className="text-slate-400 text-sm italic p-6 text-center border-2 border-dashed border-slate-200 rounded-xl">No hay parejas registradas.</p>}
            </div>
      </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div><h2 className="text-2xl font-bold text-slate-900">Registro</h2><p className="text-sm text-slate-500">Gestión de Inscripciones</p></div>
        <div className={`flex flex-col items-end ${activePairs.filter(p => !p.isReserve).length === 16 ? 'text-emerald-600' : 'text-blue-600'}`}><span className="text-4xl font-bold">{activePairs.filter(p => !p.isReserve).length}<span className="text-xl text-slate-300">/16</span></span></div>
      </div>

      {viewMode === 'menu' && (
          <>
            <button onClick={() => { setIsEditingPairId(null); setSelectedP1(''); setSelectedP2(''); setViewMode('pair-form'); }} className="w-full bg-white hover:bg-emerald-50 border-2 border-emerald-100 hover:border-emerald-300 p-6 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all shadow-sm active:scale-95 group">
                <div className="bg-emerald-100 p-3 rounded-full text-emerald-600 group-hover:bg-emerald-200 transition-colors"><Users size={32} /></div>
                <span className="font-black text-emerald-800 text-lg">AÑADIR NUEVA PAREJA</span>
            </button>

            <PairList pairs={activePairs.filter(p => !p.isReserve)} title="Parejas Confirmadas" colorClass="text-emerald-600" />
            
            {activePairs.filter(p => p.isReserve).length > 0 && (
                 <PairList pairs={activePairs.filter(p => p.isReserve)} title="Reservas" colorClass="text-orange-500" />
            )}

            {state.status === 'setup' && (
                <div className="fixed bottom-[80px] left-0 right-0 px-4 z-30 pointer-events-none">
                    <div className="max-w-3xl mx-auto pointer-events-auto bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-[0_-5px_20px_rgba(0,0,0,0.1)]">
                        {canStart && (
                             <div className="grid grid-cols-4 gap-2 mb-3">
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
                        )}
                        <button 
                            onClick={handleStartClick}
                            disabled={!canStart}
                            className={`w-full py-4 rounded-2xl font-bold shadow-xl text-xl transition-all ${canStart ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white animate-pulse active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                        >
                            EMPEZAR TORNEO
                        </button>
                    </div>
                </div>
            )}
          </>
      )}

      {viewMode === 'pair-form' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-lg animate-slide-up">
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2"><Users className="text-emerald-600"/>{isEditingPairId ? 'Editar Pareja' : 'Nueva Pareja'}</h3>
              <PlayerSelector 
                label="JUGADOR 1" 
                selectedId={selectedP1} 
                onSelect={setSelectedP1} 
                otherSelectedId={selectedP2}
              />
              <div className="flex justify-center items-center gap-4 my-6">
                  <div className="h-px bg-slate-200 flex-1"></div>
                  <span className="bg-slate-100 text-slate-400 text-xs px-3 py-1 rounded-full font-bold border border-slate-200">&</span>
                  <div className="h-px bg-slate-200 flex-1"></div>
              </div>
              <PlayerSelector 
                label="JUGADOR 2" 
                selectedId={selectedP2} 
                onSelect={setSelectedP2} 
                otherSelectedId={selectedP1}
              />
              <div className="flex gap-3 mt-8 pt-4 border-t border-slate-100">
                  <button onClick={() => setViewMode('menu')} className="flex-1 py-4 bg-slate-100 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors">Cancelar</button>
                  <button onClick={handleSavePair} className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-colors active:scale-95"><Save size={20} /> Guardar Pareja</button>
              </div>
          </div>
      )}
      
      {showDeleteModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in text-center">
                  <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
                      <Trash2 size={32} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">¿Eliminar Pareja?</h3>
                  <p className="text-slate-500 mb-6">Esta acción no se puede deshacer.</p>
                  <div className="flex gap-3">
                      <button onClick={() => setShowDeleteModal(null)} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold">Cancelar</button>
                      <button onClick={deletePairHandler} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold shadow-lg">Eliminar</button>
                  </div>
              </div>
          </div>
      )}

      {alertMessage && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in text-center">
                  <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-600">
                      <AlertTriangle size={32} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">Atención</h3>
                  <p className="text-slate-500 mb-6">{alertMessage}</p>
                  <button onClick={() => setAlertMessage(null)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg">Entendido</button>
              </div>
          </div>
      )}

      {showManualWizard && (
          <ManualGroupingWizard 
            pairs={activePairs.filter(p => !p.isReserve)} 
            players={state.players}
            onCancel={() => setShowManualWizard(false)}
            onComplete={handleManualWizardComplete}
            formatName={formatPlayerName}
          />
      )}
    </div>
  );
};

export default Registration;