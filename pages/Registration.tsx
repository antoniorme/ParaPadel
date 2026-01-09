
import React, { useState, useMemo } from 'react';
import { useTournament, TOURNAMENT_CATEGORIES } from '../store/TournamentContext';
import { THEME } from '../utils/theme';
import { Users, Trash2, Edit2, Save, X, AlertTriangle, TrendingUp, Link as LinkIcon, UserPlus, Activity, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { PlayerSelector } from '../components/PlayerSelector';
import { calculateDisplayRanking } from '../utils/Elo';

// --- MAIN REGISTRATION COMPONENT ---
const Registration: React.FC = () => {
  const { state, addPlayerToDB, createPairInDB, updatePairDB, deletePairDB, formatPlayerName, assignPartnerDB } = useTournament();
  
  // MODAL STATES
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const [isEditingPairId, setIsEditingPairId] = useState<string | null>(null);
  
  const [selectedP1, setSelectedP1] = useState('');
  const [selectedP2, setSelectedP2] = useState('');
  
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  
  // SOLO MATCHING STATES
  const [showSoloMatchModal, setShowSoloMatchModal] = useState<string | null>(null); 
  const [selectedSoloPartner, setSelectedSoloPartner] = useState('');

  const currentFormat = state.format || '16_mini';
  const activePairs = state.pairs.filter(p => p.player2Id !== null) || [];
  const soloPairs = state.pairs.filter(p => p.player2Id === null) || [];
  const totalRegistered = activePairs.length;

  // Filter out players who are already assigned to a pair (confirmed or solo)
  // But allow if we are editing the current pair, or if checking against "otherSelectedId"
  const availablePlayers = state.players.filter(p => {
      const isAssigned = state.pairs.some(pair => {
          if (isEditingPairId && pair.id === isEditingPairId) return false;
          return pair.player1Id === p.id || pair.player2Id === p.id;
      });
      return !isAssigned;
  });

  // HELPER: Calculate Average ELO for sorting and display
  const getPairAverageElo = (pair: any) => {
      const p1 = state.players.find(p => p.id === pair.player1Id);
      const p2 = state.players.find(p => p.id === pair.player2Id);
      const elo1 = p1 ? calculateDisplayRanking(p1) : 1200;
      const elo2 = p2 ? calculateDisplayRanking(p2) : elo1; 
      return Math.round((elo1 + elo2) / 2);
  };

  // HELPER: Determine Tournament ELO Range based on levelRange string
  const getTournamentRange = () => {
      const text = (state.levelRange || '').toLowerCase();
      if (text.includes('1ª') || text.includes('1a')) return { min: 5000, max: 6000, label: '1ª Cat' };
      if (text.includes('2ª') || text.includes('2a')) return { min: 4000, max: 5000, label: '2ª Cat' };
      if (text.includes('3ª') || text.includes('3a')) return { min: 3000, max: 4000, label: '3ª Cat' };
      if (text.includes('4ª') || text.includes('4a')) return { min: 2000, max: 3000, label: '4ª Cat' };
      if (text.includes('5ª') || text.includes('5a')) return { min: 1000, max: 2000, label: '5ª Cat' };
      if (text.includes('iniciacion') || text.includes('iniciación')) return { min: 0, max: 1000, label: 'Iniciación' };
      return null; // Dynamic / Open
  };

  const tournamentRange = getTournamentRange();

  // SORTED PAIRS (Highest Average ELO first)
  const sortedActivePairs = useMemo(() => {
      return [...activePairs].sort((a, b) => getPairAverageElo(b) - getPairAverageElo(a));
  }, [activePairs, state.players]);

  const openNewPairModal = () => {
    setIsEditingPairId(null);
    setSelectedP1('');
    setSelectedP2('');
    setIsPairModalOpen(true);
  };

  const startEditPair = (pairId: string) => {
      const pair = state.pairs.find(p => p.id === pairId);
      if (!pair) return;
      setSelectedP1(pair.player1Id);
      setSelectedP2(pair.player2Id || '');
      setIsEditingPairId(pairId);
      setIsPairModalOpen(true);
  };

  const closePairModal = () => {
      setIsPairModalOpen(false);
      setIsEditingPairId(null);
      setSelectedP1('');
      setSelectedP2('');
  };

  const handleSavePair = async () => {
      if (!selectedP1 || !selectedP2) return setAlertMessage("Selecciona dos jugadores.");
      if (selectedP1 === selectedP2) return setAlertMessage("Los jugadores deben ser distintos.");

      if (isEditingPairId) {
          await updatePairDB(isEditingPairId, selectedP1, selectedP2);
      } else {
          if (state.pairs.filter(p=>p.player2Id).length >= 32) return setAlertMessage("Límite de parejas alcanzado.");
          await createPairInDB(selectedP1, selectedP2);
      }
      
      closePairModal();
  };

  const deletePairHandler = async () => {
      if (showDeleteModal) {
          await deletePairDB(showDeleteModal);
          setShowDeleteModal(null);
      }
  };

  const handleOpenSoloMatch = (soloId: string) => {
      setShowSoloMatchModal(soloId);
      setSelectedSoloPartner('');
  };

  const handleConfirmSoloMatch = async () => {
      if (!showSoloMatchModal || !selectedSoloPartner) return;
      const partnerAsSolo = soloPairs.find(p => p.player1Id === selectedSoloPartner);
      const mergeId = partnerAsSolo ? partnerAsSolo.id : undefined;
      await assignPartnerDB(showSoloMatchModal, selectedSoloPartner, mergeId);
      setShowSoloMatchModal(null);
      setSelectedSoloPartner('');
  };

  const PairList = ({ pairs, title, colorClass }: { pairs: any[], title: string, colorClass: string }) => (
      <div className="mt-8">
            <h3 className={`text-sm uppercase font-bold mb-4 tracking-wider ${colorClass}`}>{title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pairs.map((pair, idx) => {
                    const p1 = state.players.find(p => p.id === pair.player1Id);
                    const p2 = state.players.find(p => p.id === pair.player2Id);
                    const avgElo = getPairAverageElo(pair);
                    
                    // Logic for Bar: Use strict Tournament Range OR Dynamic 1000pt block
                    const rangeMin = tournamentRange ? tournamentRange.min : Math.floor(avgElo / 1000) * 1000;
                    const rangeMax = tournamentRange ? tournamentRange.max : rangeMin + 1000;
                    
                    let progressPercent = 0;
                    let barColor = THEME.cta;
                    let statusLabel = null;

                    if (avgElo > rangeMax) {
                        progressPercent = 100;
                        barColor = '#F59E0B'; // Amber/Gold for "Over"
                        statusLabel = (
                            <div className="text-[9px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <ArrowUpCircle size={10}/> NIVEL SUPERIOR
                            </div>
                        );
                    } else if (avgElo < rangeMin) {
                        progressPercent = 5; // Minimal bar
                        barColor = '#EF4444'; // Red for "Under"
                        statusLabel = (
                            <div className="text-[9px] font-black text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <ArrowDownCircle size={10}/> NIVEL BAJO
                            </div>
                        );
                    } else {
                        progressPercent = Math.max(5, Math.min(100, ((avgElo - rangeMin) / (rangeMax - rangeMin)) * 100));
                    }

                    return (
                        <div key={pair.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
                            {/* TOP PART: NAMES AND ACTIONS */}
                            <div className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3 overflow-hidden w-full">
                                    <span className="bg-slate-100 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-slate-500 border border-slate-200">{idx + 1}</span>
                                    <div className="flex flex-col w-full min-w-0">
                                        <div className="text-sm font-bold text-slate-800 truncate">{formatPlayerName(p1)}</div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span style={{ color: THEME.cta }} className="text-[10px] font-black">&</span>
                                            <div className="text-sm font-bold text-slate-800 truncate">{formatPlayerName(p2)}</div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                    <button onClick={() => startEditPair(pair.id)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg hover:bg-blue-50 transition-colors"><Edit2 size={16}/></button>
                                    <button onClick={() => setShowDeleteModal(pair.id)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={16}/></button>
                                </div>
                            </div>

                            {/* BOTTOM STRIP: ELO BAR */}
                            <div className="bg-slate-50 px-4 py-2 border-t border-slate-100">
                                <div className="flex justify-between items-center mb-1.5">
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        <Activity size={10} className="text-slate-400"/> Media {avgElo}
                                    </div>
                                    {statusLabel}
                                </div>
                                
                                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden flex relative">
                                    <div 
                                        className="h-full rounded-full transition-all duration-500" 
                                        style={{ 
                                            width: `${progressPercent}%`, 
                                            backgroundColor: barColor 
                                        }}
                                    ></div>
                                </div>
                                
                                <div className="flex justify-between mt-1 text-[9px] text-slate-400 font-mono">
                                    <span>{rangeMin}</span>
                                    <span>{rangeMax}</span>
                                </div>
                            </div>
                        </div>
                    )
                })}
                 {pairs.length === 0 && <p className="text-slate-400 text-sm italic p-6 text-center border-2 border-dashed border-slate-200 rounded-xl col-span-full">No hay parejas registradas.</p>}
            </div>
      </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div><h2 className="text-2xl font-bold text-slate-900">Registro</h2><p className="text-sm text-slate-500">Gestión de Inscripciones</p></div>
        <div className={`flex flex-col items-end text-blue-600`}><span className="text-4xl font-bold">{totalRegistered}</span></div>
      </div>

      <button onClick={openNewPairModal} className="w-full bg-white hover:bg-indigo-50 border-2 border-indigo-100 hover:border-[#575AF9] p-6 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all shadow-sm active:scale-95 group">
          <div style={{ color: THEME.cta }} className="bg-indigo-100 p-3 rounded-full group-hover:bg-indigo-200 transition-colors"><Users size={32} /></div>
          <span className="font-black text-indigo-900 text-lg">AÑADIR NUEVA PAREJA</span>
      </button>
      
      {/* SOLO PLAYERS BAG */}
      {soloPairs.length > 0 && (
          <div className="mt-8 bg-amber-50 p-6 rounded-2xl border border-amber-100">
              <div className="flex items-center gap-2 mb-4">
                  <UserPlus className="text-amber-600"/>
                  <h3 className="text-sm uppercase font-bold tracking-wider text-amber-700">Bolsa de Jugadores (Sin Pareja)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {soloPairs.map(solo => {
                      const p = state.players.find(p => p.id === solo.player1Id);
                      return (
                          <div key={solo.id} className="bg-white p-4 rounded-xl shadow-sm border border-amber-200 flex justify-between items-center">
                              <div className="font-bold text-slate-800">{formatPlayerName(p)}</div>
                              <div className="flex gap-2">
                                  <button onClick={() => handleOpenSoloMatch(solo.id)} className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-200 flex items-center gap-1">
                                      <LinkIcon size={12}/> Emparejar
                                  </button>
                                  <button onClick={() => setShowDeleteModal(solo.id)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      <PairList pairs={sortedActivePairs} title="Parejas Inscritas (Por Nivel)" colorClass="text-slate-600" />

      {/* PAIR MODAL */}
      {isPairModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white w-full h-[90vh] sm:h-auto sm:max-h-[85vh] sm:rounded-3xl sm:max-w-lg shadow-2xl animate-slide-up flex flex-col">
                  {/* Compact Header */}
                  <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 shrink-0">
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                          <Users style={{ color: THEME.cta }} size={20}/>
                          {isEditingPairId ? 'Editar Pareja' : 'Nueva Pareja'}
                      </h3>
                      <button onClick={closePairModal} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors">
                          <X size={20}/>
                      </button>
                  </div>
                  
                  {/* Scrollable Body */}
                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                      <PlayerSelector 
                        label="JUGADOR 1" 
                        selectedId={selectedP1} 
                        onSelect={setSelectedP1} 
                        otherSelectedId={selectedP2}
                        players={availablePlayers.concat(selectedP1 ? [state.players.find(p=>p.id===selectedP1)!].filter(Boolean) : [])}
                        onAddPlayer={addPlayerToDB}
                        formatName={formatPlayerName}
                      />
                      <div className="flex justify-center items-center gap-4 my-4">
                          <div className="h-px bg-slate-200 flex-1"></div>
                          <span className="bg-slate-100 text-slate-400 text-xs px-3 py-1 rounded-full font-bold border border-slate-200">&</span>
                          <div className="h-px bg-slate-200 flex-1"></div>
                      </div>
                      <PlayerSelector 
                        label="JUGADOR 2" 
                        selectedId={selectedP2} 
                        onSelect={setSelectedP2} 
                        otherSelectedId={selectedP1}
                        players={availablePlayers.concat(selectedP2 ? [state.players.find(p=>p.id===selectedP2)!].filter(Boolean) : [])}
                        onAddPlayer={addPlayerToDB}
                        formatName={formatPlayerName}
                      />
                      
                      <div className="flex gap-3 mt-8 pb-8 sm:pb-0">
                          <button onClick={closePairModal} className="flex-1 py-4 bg-slate-100 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors">Cancelar</button>
                          <button onClick={handleSavePair} style={{ backgroundColor: THEME.cta }} className="flex-1 py-4 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-colors active:scale-95 hover:opacity-90"><Save size={20} /> Guardar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
      
      {/* SOLO MATCH MODAL */}
      {showSoloMatchModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Emparejar Jugador</h3>
                  <p className="text-sm text-slate-500 mb-4">Elige un compañero. Puedes buscar en el club o seleccionar a otro jugador suelto.</p>
                  
                  <div className="mb-4">
                      <PlayerSelector 
                        label="COMPAÑERO" 
                        selectedId={selectedSoloPartner} 
                        onSelect={setSelectedSoloPartner} 
                        otherSelectedId={state.pairs.find(p=>p.id===showSoloMatchModal)?.player1Id!}
                        players={availablePlayers}
                        onAddPlayer={addPlayerToDB}
                        formatName={formatPlayerName}
                      />
                  </div>

                  <div className="flex gap-3">
                      <button onClick={() => setShowSoloMatchModal(null)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-600">Cancelar</button>
                      <button 
                        onClick={handleConfirmSoloMatch} 
                        disabled={!selectedSoloPartner}
                        style={{ backgroundColor: THEME.cta }} 
                        className="flex-1 py-3 text-white rounded-xl font-bold disabled:opacity-50"
                      >
                          Confirmar
                      </button>
                  </div>
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
                  <p className="text-slate-500 mb-6 text-sm">
                      Se borrará la inscripción de esta pareja. <br/>
                      <span className="font-bold text-slate-700">Los jugadores NO se borrarán</span> de la base de datos del club.
                  </p>
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
    </div>
  );
};

export default Registration;
