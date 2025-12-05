
import React, { useMemo, useState } from 'react';
import { useTournament } from '../store/TournamentContext';
import { DollarSign, Droplets, Circle, Users, Check, RefreshCw, X, AlertTriangle, ArrowRight, UserPlus } from 'lucide-react';
import { Pair, Player } from '../types';

const CheckIn: React.FC = () => {
  const { state, dispatch, formatPlayerName, substitutePairDB } = useTournament(); 
  
  // States for Substitution Modal
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [activePairToSub, setActivePairToSub] = useState<string | null>(null);
  const [confirmingReserve, setConfirmingReserve] = useState<Pair | null>(null);

  const getPlayer = (id: string) => state.players.find(p => p.id === id);

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
      setSubModalOpen(true);
  };

  const handleSubstitution = async () => {
      if (!activePairToSub || !confirmingReserve) return;
      try {
          await substitutePairDB(activePairToSub, confirmingReserve.id);
          setSubModalOpen(false);
          setActivePairToSub(null);
          setConfirmingReserve(null);
      } catch (e: any) {
          // Fallback error, though we try to avoid system alerts
          console.error(e);
      }
  };

  const PairCard = ({ pair, idx }: { pair: Pair, idx: number | string }) => {
        const p1 = getPlayer(pair.player1Id);
        const p2 = getPlayer(pair.player2Id);
        const allPaid = pair.paidP1 && pair.paidP2;
        
        return (
            <div className={`bg-white rounded-xl p-4 shadow-sm border-2 relative transition-all ${allPaid ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-100 hover:border-blue-200'}`}>
                {/* Swap Button (Absolute) */}
                <button 
                    onClick={() => openSubModal(pair.id)}
                    className="absolute top-2 right-2 p-2 bg-white text-slate-400 hover:text-blue-600 rounded-full border border-slate-100 hover:border-blue-200 shadow-sm transition-all active:scale-95"
                    title="Sustituir Pareja"
                >
                    <RefreshCw size={14} />
                </button>

                {/* Top Row: ID & Water */}
                <div className="flex justify-between items-start mb-4 pr-8">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pareja {idx}</span>
                    <button 
                    onClick={() => dispatch({ type: 'TOGGLE_WATER', payload: pair.id })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-sm active:scale-95 ${pair.waterReceived ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-white border border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-500'}`}
                    >
                        <Droplets size={14} fill={pair.waterReceived ? "currentColor" : "none"}/> 
                        {pair.waterReceived ? 'OK' : 'AGUA'}
                    </button>
                </div>

                {/* Players & Payment Buttons */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                        <span className={`text-sm font-bold truncate pr-2 ${pair.paidP1 ? 'text-slate-800' : 'text-rose-500'}`}>{formatPlayerName(p1)}</span>
                        <button 
                        onClick={() => p1 && dispatch({type: 'TOGGLE_PAID', payload: p1.id})} 
                        className={`w-9 h-9 flex items-center justify-center rounded-lg shadow-sm transition-all border shrink-0 active:scale-95 ${pair.paidP1 ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white text-slate-300 border-slate-200 hover:border-emerald-400 hover:text-emerald-400'}`}
                        >
                            {pair.paidP1 ? <Check size={18} strokeWidth={4} /> : <DollarSign size={18}/>}
                        </button>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                        <span className={`text-sm font-bold truncate pr-2 ${pair.paidP2 ? 'text-slate-800' : 'text-rose-500'}`}>{formatPlayerName(p2)}</span>
                        <button 
                        onClick={() => p2 && dispatch({type: 'TOGGLE_PAID', payload: p2.id})} 
                        className={`w-9 h-9 flex items-center justify-center rounded-lg shadow-sm transition-all border shrink-0 active:scale-95 ${pair.paidP2 ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white text-slate-300 border-slate-200 hover:border-emerald-400 hover:text-emerald-400'}`}
                        >
                            {pair.paidP2 ? <Check size={18} strokeWidth={4} /> : <DollarSign size={18}/>}
                        </button>
                    </div>
                </div>
            </div>
        )
  };

  return (
    <div className="space-y-8 pb-32">
      <h2 className="text-3xl font-bold text-slate-900">Control y Pistas</h2>

      {/* Courts List */}
      <div className="space-y-10">
        {state.courts.map(court => {
            const pairsOnCourt = getPairsForCourt(court.id);
            
            return (
                <div key={court.id} className="relative">
                    {/* Clean Header */}
                    <div className="flex items-center justify-between mb-4 bg-slate-800 text-white p-4 rounded-xl shadow-md">
                        <span className="text-xl font-black tracking-tight">PISTA {court.id}</span>
                        <button 
                            onClick={() => dispatch({ type: 'TOGGLE_BALLS', payload: court.id })}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors border active:scale-95 ${court.ballsGiven ? 'bg-white text-emerald-700 border-white' : 'bg-slate-700 text-slate-300 border-slate-600'}`}
                        >
                            <Circle size={16} fill={court.ballsGiven ? "currentColor" : "none"} />
                            {court.ballsGiven ? 'Bolas OK' : 'Dar Bolas'}
                        </button>
                    </div>

                    {/* Cards Container */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-2 border-l-4 border-slate-200">
                        {pairsOnCourt.length > 0 ? pairsOnCourt.map((pair, idx) => (
                            <PairCard key={pair.id} pair={pair} idx={pair.id.split('-')[1] || idx+1} />
                        )) : (
                            <div className="text-center py-6 text-slate-400 text-sm bg-slate-50 rounded-xl">Sin partidos asignados</div>
                        )}
                    </div>
                </div>
            );
        })}
      </div>

      {/* Resting Section */}
      {restingPairs.length > 0 && (
          <div className="mt-12 bg-slate-100 p-6 rounded-2xl border border-slate-200">
              <h3 className="text-slate-500 font-bold mb-6 uppercase flex items-center gap-2">
                  <Users size={20}/> Descansan Turno 1 (Grupo D)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                   <h3 className="text-lg font-bold text-slate-800">Banquillo / Reservas</h3>
                   <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">{reservePairs.length}</span>
               </div>
               <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                   {reservePairs.map((pair, idx) => {
                       const p1 = getPlayer(pair.player1Id);
                       const p2 = getPlayer(pair.player2Id);
                       return (
                           <div key={pair.id} className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm flex items-center justify-between">
                               <div>
                                   <div className="text-[10px] font-bold text-amber-500 uppercase mb-1">Reserva #{idx+1}</div>
                                   <div className="font-bold text-slate-700 text-sm">{formatPlayerName(p1)}</div>
                                   <div className="font-bold text-slate-700 text-sm">& {formatPlayerName(p2)}</div>
                               </div>
                           </div>
                       )
                   })}
               </div>
          </div>
      )}

      {/* SUBSTITUTION MODAL */}
      {subModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in">
                  <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                          <RefreshCw className="text-blue-600"/> Sustituir Pareja
                      </h3>
                      <button onClick={() => setSubModalOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200">
                          <X size={20}/>
                      </button>
                  </div>
                  
                  {!confirmingReserve ? (
                        /* STEP 1: SELECT RESERVE */
                        <>
                            {reservePairs.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl mb-4">
                                    No hay reservas disponibles.
                                </div>
                            ) : (
                                <>
                                    <p className="text-sm text-slate-500 mb-4 font-medium">Selecciona la pareja reserva:</p>
                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                        {reservePairs.map((rp, idx) => {
                                            const p1 = getPlayer(rp.player1Id);
                                            const p2 = getPlayer(rp.player2Id);
                                            return (
                                                <button 
                                                    key={rp.id}
                                                    onClick={() => setConfirmingReserve(rp)}
                                                    className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all flex justify-between items-center group active:scale-95"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-slate-100 text-slate-400 p-2 rounded-lg group-hover:bg-blue-100 group-hover:text-blue-600">
                                                            <UserPlus size={18}/>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase group-hover:text-blue-500">Reserva #{idx+1}</div>
                                                            <div className="font-bold text-slate-800 text-sm leading-tight">{formatPlayerName(p1)}<br/>{formatPlayerName(p2)}</div>
                                                        </div>
                                                    </div>
                                                    <ArrowRight size={16} className="text-slate-300 group-hover:text-blue-500"/>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </>
                            )}
                            <div className="mt-4 p-3 bg-blue-50 text-blue-800 text-xs rounded-lg border border-blue-100 flex items-start gap-2 leading-relaxed">
                                <AlertTriangle size={14} className="shrink-0 mt-0.5"/>
                                <span>La reserva heredará la posición, los partidos y las estadísticas de la pareja sustituida.</span>
                            </div>
                        </>
                  ) : (
                      /* STEP 2: CONFIRMATION */
                      <div className="text-center animate-fade-in">
                          <h4 className="text-lg font-black text-slate-900 mb-6">¿Confirmar Cambio?</h4>
                          
                          <div className="space-y-2 mb-8 relative">
                               {/* OUT */}
                              <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 flex items-center gap-3 text-left">
                                  <div className="bg-white p-2 rounded-lg text-rose-500 border border-rose-100 font-bold text-xs uppercase shrink-0 w-12 text-center">Sale</div>
                                  <div className="font-bold text-slate-800 text-sm">
                                      {activePairToSub && getPlayer(state.pairs.find(p=>p.id===activePairToSub)?.player1Id!)?.name} <span className="text-slate-400">&</span> {' '}
                                      {activePairToSub && getPlayer(state.pairs.find(p=>p.id===activePairToSub)?.player2Id!)?.name}
                                  </div>
                              </div>
                              
                              <div className="absolute left-6 top-1/2 -translate-y-1/2 z-10 bg-white border border-slate-200 rounded-full p-1 text-slate-400 shadow-sm">
                                <RefreshCw size={14} />
                              </div>

                              {/* IN */}
                              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex items-center gap-3 text-left">
                                  <div className="bg-white p-2 rounded-lg text-emerald-600 border border-emerald-100 font-bold text-xs uppercase shrink-0 w-12 text-center">Entra</div>
                                  <div className="font-bold text-slate-800 text-sm">
                                      {getPlayer(confirmingReserve.player1Id)?.name} <span className="text-slate-400">&</span> {getPlayer(confirmingReserve.player2Id)?.name}
                                  </div>
                              </div>
                          </div>

                          <div className="flex gap-3">
                              <button onClick={() => setConfirmingReserve(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">Atrás</button>
                              <button onClick={handleSubstitution} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-transform">Confirmar</button>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default CheckIn;
