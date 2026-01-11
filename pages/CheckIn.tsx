
import React, { useMemo, useState } from 'react';
import { useTournament } from '../store/TournamentContext';
import { getFormatColor, THEME } from '../utils/theme';
import { DollarSign, Droplets, Circle, Users, Check, RefreshCw, X, AlertTriangle, ArrowRight, UserPlus, Save, User } from 'lucide-react';
import { Pair, Player } from '../types';
import { PlayerSelector } from '../components/PlayerSelector';

const CheckIn: React.FC = () => {
  const { state, dispatch, formatPlayerName, substitutePairDB, toggleBallsDB, toggleWaterDB, togglePaymentDB, createPairInDB, addPlayerToDB } = useTournament(); 
  
  // States for Substitution Modal
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [activePairToSub, setActivePairToSub] = useState<string | null>(null);
  
  // Tab State: 'reserve' (existing) or 'new' (create fresh)
  const [subTab, setSubTab] = useState<'reserve' | 'new'>('reserve');
  
  // Reserve Selection State
  const [confirmingReserve, setConfirmingReserve] = useState<Pair | null>(null);

  // New Pair Creation State
  const [newP1, setNewP1] = useState('');
  const [newP2, setNewP2] = useState('');

  const getPlayer = (id: string) => state.players.find(p => p.id === id);

  // Dynamic Theme Color
  const themeColor = getFormatColor(state.format);

  // Helper: Simulate R1 matches
  const firstRoundSchedule = useMemo(() => {
      if (state.status === 'active' || state.groups.length > 0) {
          return {
              matches: state.matches.filter(m => m.round === 1),
              groups: state.groups
          };
      }
      return null;
  }, [state.pairs, state.status, state.matches, state.groups]);

  // Identify Reserves
  const reservePairs = state.pairs.filter(p => p.isReserve);
  // Identify Active Pairs (Non-reserves)
  const activePairsList = state.pairs.filter(p => !p.isReserve);

  const getPairsForCourt = (courtId: number) => {
      if (state.status !== 'setup' && firstRoundSchedule) {
         const match = firstRoundSchedule.matches.find(m => m.courtId === courtId);
         if (!match) return [];
         return [activePairsList.find(p => p.id === match.pairAId), activePairsList.find(p => p.id === match.pairBId)].filter(Boolean) as Pair[];
      }
      const idxStart = (courtId - 1) * 2;
      return activePairsList.slice(idxStart, idxStart + 2);
  };
  
  const restingPairs = state.status === 'setup' 
      ? activePairsList.slice(12, 16) 
      : (firstRoundSchedule?.groups.find(g => g.id === 'D')?.pairIds.map(pid => activePairsList.find(p => p.id === pid)!).filter(Boolean) || []);

  const openSubModal = (pairId: string) => {
      setActivePairToSub(pairId);
      setConfirmingReserve(null);
      setSubTab('reserve');
      setNewP1('');
      setNewP2('');
      setSubModalOpen(true);
  };

  const handleSubstitution = async () => {
      if (!activePairToSub) return;
      
      let finalReserveId = confirmingReserve?.id;

      // Handle New Pair Creation
      if (subTab === 'new') {
          if (!newP1 || !newP2) return;
          try {
              // Create the pair in DB. It will likely be created as 'confirmed'.
              // Since the tournament is full, Logic would mark it as reserve upon reload, 
              // but we need the ID immediately.
              const createdId = await createPairInDB(newP1, newP2, 'confirmed');
              if (createdId) {
                  finalReserveId = createdId;
              } else {
                  throw new Error("No se pudo crear la pareja");
              }
          } catch (e) {
              console.error(e);
              return;
          }
      }

      if (!finalReserveId) return;

      try {
          await substitutePairDB(activePairToSub, finalReserveId);
          setSubModalOpen(false);
          setActivePairToSub(null);
          setConfirmingReserve(null);
          setNewP1('');
          setNewP2('');
      } catch (e: any) {
          console.error(e);
      }
  };

  const PairCard: React.FC<{ pair: Pair; idx: number | string }> = ({ pair, idx }) => {
        const p1 = getPlayer(pair.player1Id);
        const p2 = getPlayer(pair.player2Id);
        const allPaid = pair.paidP1 && pair.paidP2;
        
        return (
            <div className={`bg-white rounded-xl p-4 shadow-sm border-2 relative transition-all ${allPaid ? 'border-emerald-500/50 bg-emerald-50' : 'border-slate-200 hover:border-blue-500/50'}`}>
                {/* Swap Button (Absolute) */}
                <button 
                    onClick={() => openSubModal(pair.id)}
                    className="absolute top-2 right-2 p-2 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-full border border-slate-200 hover:border-blue-500/50 shadow-sm transition-all active:scale-95"
                    title="Sustituir Pareja"
                >
                    <RefreshCw size={14} />
                </button>

                {/* Top Row: ID & Water */}
                <div className="flex justify-between items-start mb-4 pr-8">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pareja {idx}</span>
                    <button 
                    onClick={() => toggleWaterDB(pair.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-sm active:scale-95 ${pair.waterReceived ? 'bg-blue-500/20 text-blue-600 border border-blue-500/50' : 'bg-slate-50 border border-slate-200 text-slate-400 hover:border-blue-500/50 hover:text-blue-600'}`}
                    >
                        <Droplets size={14} fill={pair.waterReceived ? "currentColor" : "none"}/> 
                        {pair.waterReceived ? 'OK' : 'AGUA'}
                    </button>
                </div>

                {/* Players & Payment Buttons */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className={`text-sm font-bold truncate pr-2 ${pair.paidP1 ? 'text-slate-800' : 'text-rose-500'}`}>{formatPlayerName(p1)}</span>
                        <button 
                        onClick={() => p1 && togglePaymentDB(p1.id, pair.id, true)} 
                        className={`w-9 h-9 flex items-center justify-center rounded-lg shadow-sm transition-all border shrink-0 active:scale-95 ${pair.paidP1 ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white text-slate-400 border-slate-200 hover:border-emerald-500/50 hover:text-emerald-500'}`}
                        >
                            {pair.paidP1 ? <Check size={18} strokeWidth={4} /> : <DollarSign size={18}/>}
                        </button>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className={`text-sm font-bold truncate pr-2 ${pair.paidP2 ? 'text-slate-800' : 'text-rose-500'}`}>{formatPlayerName(p2)}</span>
                        <button 
                        onClick={() => p2 && togglePaymentDB(p2.id, pair.id, false)} 
                        className={`w-9 h-9 flex items-center justify-center rounded-lg shadow-sm transition-all border shrink-0 active:scale-95 ${pair.paidP2 ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white text-slate-400 border-slate-200 hover:border-emerald-500/50 hover:text-emerald-500'}`}
                        >
                            {pair.paidP2 ? <Check size={18} strokeWidth={4} /> : <DollarSign size={18}/>}
                        </button>
                    </div>
                </div>
            </div>
        )
  };

  return (
    <div className="space-y-8 pb-32 text-white">
      <h2 className="text-2xl font-bold">Control y Pistas</h2>

      {/* Courts List (Grid for Desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {state.courts.map(court => {
            const pairsOnCourt = getPairsForCourt(court.id);
            
            return (
                <div key={court.id} className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200 p-2">
                    {/* Clean Header with Dynamic Color */}
                    <div style={{ backgroundColor: themeColor }} className="flex items-center justify-between mb-4 text-white p-4 rounded-xl shadow-md transition-colors duration-300 border border-white/10">
                        <span className="text-xl font-black tracking-tight">PISTA {court.id}</span>
                        <button 
                            onClick={() => toggleBallsDB(court.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors border active:scale-95 ${court.ballsGiven ? 'bg-white text-slate-900 border-white' : 'bg-white/20 text-white border-white/20 hover:bg-white/30'}`}
                        >
                            <Circle size={16} fill={court.ballsGiven ? "currentColor" : "none"} />
                            {court.ballsGiven ? 'Bolas OK' : 'Dar Bolas'}
                        </button>
                    </div>

                    {/* Cards Container */}
                    <div className="flex flex-col gap-3">
                        {pairsOnCourt.length > 0 ? pairsOnCourt.map((pair, idx) => (
                            <PairCard key={pair.id} pair={pair} idx={pair.id.split('-')[1] || idx+1} />
                        )) : (
                            <div className="text-center py-6 text-slate-400 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">Sin partidos asignados</div>
                        )}
                    </div>
                </div>
            );
        })}
      </div>

      {/* Resting Section */}
      {restingPairs.length > 0 && (
          <div className="mt-12 bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10">
              <h3 className="text-white font-bold mb-6 uppercase flex items-center gap-2">
                  <Users size={20}/> Descansan Turno 1 (Grupo D)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {restingPairs.map((pair, idx) => (
                      <PairCard key={pair.id} pair={pair} idx={pair.id.split('-')[1] || idx+1} />
                  ))}
              </div>
          </div>
      )}

      {/* RESERVES SECTION */}
      {reservePairs.length > 0 && (
          <div className="mt-12">
               <div className="flex items-center gap-2 mb-4 px-2">
                   <div className="bg-amber-100 p-2 rounded-lg text-amber-600"><Users size={20}/></div>
                   <h3 className="text-lg font-bold text-white">Banquillo / Reservas</h3>
                   <span className="bg-slate-700 text-slate-300 text-xs font-bold px-2 py-0.5 rounded-full">{reservePairs.length}</span>
               </div>
               <div className="bg-white/5 p-4 rounded-2xl border border-white/10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                   {reservePairs.map((pair, idx) => {
                       const p1 = getPlayer(pair.player1Id);
                       const p2 = getPlayer(pair.player2Id);
                       return (
                           <div key={pair.id} className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex items-center justify-between">
                               <div>
                                   <div className="text-[10px] font-bold text-amber-500 uppercase mb-1">Reserva #{idx+1}</div>
                                   <div className="font-bold text-slate-800 text-sm">{formatPlayerName(p1)}</div>
                                   <div className="font-bold text-slate-800 text-sm">& {formatPlayerName(p2)}</div>
                               </div>
                           </div>
                       )
                   })}
               </div>
          </div>
      )}

      {/* SUBSTITUTION MODAL */}
      {subModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center sm:p-4">
              <div className="bg-white w-full h-[90vh] sm:h-auto sm:max-h-[85vh] sm:rounded-3xl sm:max-w-lg shadow-2xl animate-slide-up flex flex-col text-slate-900">
                  {/* HEADER */}
                  <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 shrink-0">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                          <RefreshCw className="text-blue-600"/> Sustituir Pareja
                      </h3>
                      <button onClick={() => setSubModalOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200">
                          <X size={20}/>
                      </button>
                  </div>
                  
                  {/* TABS */}
                  <div className="flex p-2 gap-2 bg-slate-50 border-b border-slate-100 shrink-0">
                      <button onClick={() => setSubTab('reserve')} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${subTab === 'reserve' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>Banquillo ({reservePairs.length})</button>
                      <button onClick={() => setSubTab('new')} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${subTab === 'new' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>Nueva Pareja</button>
                  </div>

                  {/* BODY (USES WHITE BACKGROUND FOR MODAL CONTENT) */}
                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                      {subTab === 'reserve' ? (
                          <>
                              {reservePairs.length === 0 ? (
                                  <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl mb-4 border border-dashed border-slate-200">
                                      No hay reservas disponibles.
                                      <br/>
                                      <button onClick={() => setSubTab('new')} className="text-blue-500 font-bold text-sm mt-2 hover:underline">Crear Nueva Pareja</button>
                                  </div>
                              ) : (
                                  <div className="space-y-2">
                                      {reservePairs.map((rp, idx) => {
                                          const p1 = getPlayer(rp.player1Id);
                                          const p2 = getPlayer(rp.player2Id);
                                          const isSelected = confirmingReserve?.id === rp.id;
                                          return (
                                              <button 
                                                  key={rp.id}
                                                  onClick={() => setConfirmingReserve(rp)}
                                                  className={`w-full text-left p-3 rounded-xl border flex justify-between items-center transition-all ${isSelected ? 'border-blue-500 bg-blue-50 shadow-md ring-1 ring-blue-500' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'}`}
                                              >
                                                  <div className="flex items-center gap-3">
                                                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                          <UserPlus size={18}/>
                                                      </div>
                                                      <div>
                                                          <div className={`text-[10px] font-bold uppercase ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>Reserva #{idx+1}</div>
                                                          <div className="font-bold text-slate-800 text-sm leading-tight">{formatPlayerName(p1)}<br/>{formatPlayerName(p2)}</div>
                                                      </div>
                                                  </div>
                                                  {isSelected && <Check size={20} className="text-blue-500"/>}
                                              </button>
                                          )
                                      })}
                                  </div>
                              )}
                          </>
                      ) : (
                          <div className="space-y-6">
                              <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-800 border border-blue-100">
                                  Crea una pareja rápida para sustituir a la titular. Esta nueva pareja <strong>heredará</strong> los puntos y la posición.
                              </div>
                              <PlayerSelector 
                                label="JUGADOR 1 (Entrante)" 
                                selectedId={newP1} 
                                onSelect={setNewP1} 
                                otherSelectedId={newP2}
                                players={state.players}
                                onAddPlayer={addPlayerToDB}
                                formatName={formatPlayerName}
                              />
                              <div className="flex justify-center -my-3 relative z-10"><span className="bg-slate-100 text-slate-400 text-xs px-2 py-1 rounded-full font-bold border border-slate-200">&</span></div>
                              <PlayerSelector 
                                label="JUGADOR 2 (Entrante)" 
                                selectedId={newP2} 
                                onSelect={setNewP2} 
                                otherSelectedId={newP1}
                                players={state.players}
                                onAddPlayer={addPlayerToDB}
                                formatName={formatPlayerName}
                              />
                          </div>
                      )}
                  </div>

                  {/* FOOTER ACTIONS */}
                  <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-3xl">
                      {subTab === 'reserve' ? (
                          <button 
                            onClick={handleSubstitution} 
                            disabled={!confirmingReserve}
                            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 ${confirmingReserve ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-300 cursor-not-allowed'}`}
                          >
                              Confirmar Sustitución
                          </button>
                      ) : (
                          <button 
                            onClick={handleSubstitution} 
                            disabled={!newP1 || !newP2}
                            style={{ backgroundColor: THEME.cta }}
                            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${(newP1 && newP2) ? 'hover:opacity-90' : 'opacity-50 cursor-not-allowed'}`}
                          >
                              <Save size={18}/> Crear y Sustituir
                          </button>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default CheckIn;
