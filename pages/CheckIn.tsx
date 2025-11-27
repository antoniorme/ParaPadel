
import React, { useMemo } from 'react';
import { useTournament } from '../store/TournamentContext';
import { DollarSign, Droplets, Circle, Users, Check } from 'lucide-react';
import { Pair } from '../types';

const CheckIn: React.FC = () => {
  const { state, dispatch } = useTournament();

  const getPlayer = (id: string) => state.players.find(p => p.id === id);

  // Helper: Simulate R1 matches
  const firstRoundSchedule = useMemo(() => {
      const activePairs = state.pairs.filter(p => !p.isReserve);
      if (state.status === 'active' || state.groups.length > 0) {
          return {
              matches: state.matches.filter(m => m.round === 1),
              groups: state.groups
          };
      }
      return null;
  }, [state.pairs, state.status, state.matches, state.groups]);

  const getPairsForCourt = (courtId: number) => {
      const activePairs = state.pairs.filter(p => !p.isReserve);
      if (state.status !== 'setup' && firstRoundSchedule) {
         const match = firstRoundSchedule.matches.find(m => m.courtId === courtId);
         if (!match) return [];
         return [activePairs.find(p => p.id === match.pairAId), activePairs.find(p => p.id === match.pairBId)].filter(Boolean) as Pair[];
      }
      const idxStart = (courtId - 1) * 2;
      if (idxStart >= 12) return [];
      return activePairs.slice(idxStart, idxStart + 2);
  };
  
  const restingPairs = state.status === 'setup' 
      ? state.pairs.filter(p => !p.isReserve).slice(12, 16) 
      : (firstRoundSchedule?.groups.find(g => g.id === 'D')?.pairIds.map(pid => state.pairs.find(p => p.id === pid)!).filter(Boolean) || []);

  return (
    <div className="space-y-8 pb-20">
      <h2 className="text-3xl font-bold text-slate-900">Control y Pistas</h2>

      {/* Courts List */}
      <div className="space-y-10">
        {state.courts.map(court => {
            const pairsOnCourt = getPairsForCourt(court.id);
            
            return (
                <div key={court.id} className="relative">
                    {/* Clean Header */}
                    <div className="flex items-center justify-between mb-4 bg-slate-800 text-white p-4 rounded-xl shadow-md">
                        <span className="text-2xl font-black tracking-tight">PISTA {court.id}</span>
                        <button 
                            onClick={() => dispatch({ type: 'TOGGLE_BALLS', payload: court.id })}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors border ${court.ballsGiven ? 'bg-white text-emerald-700 border-white' : 'bg-slate-700 text-slate-300 border-slate-600'}`}
                        >
                            <Circle size={18} fill={court.ballsGiven ? "currentColor" : "none"} />
                            {court.ballsGiven ? 'Bolas Entregadas' : 'Dar Bolas'}
                        </button>
                    </div>

                    {/* Cards Container */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-2 border-l-4 border-slate-200">
                        {pairsOnCourt.length > 0 ? pairsOnCourt.map((pair, idx) => {
                            const p1 = getPlayer(pair.player1Id);
                            const p2 = getPlayer(pair.player2Id);
                            const allPaid = pair.paidP1 && pair.paidP2;
                            
                            return (
                                <div key={pair.id} className={`bg-white rounded-xl p-5 shadow-sm border-2 ${allPaid ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-100'}`}>
                                     {/* Top Row: ID & Water */}
                                     <div className="flex justify-between items-start mb-4">
                                         <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pareja {pair.id.split('-')[1] || idx+1}</span>
                                         <button 
                                            onClick={() => dispatch({ type: 'TOGGLE_WATER', payload: pair.id })}
                                            className={`px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-sm ${pair.waterReceived ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-white border border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-500'}`}
                                         >
                                             <Droplets size={20} fill={pair.waterReceived ? "currentColor" : "none"}/> 
                                             {pair.waterReceived ? 'AGUA OK' : 'AGUA'}
                                         </button>
                                     </div>

                                     {/* Players & Payment Buttons */}
                                     <div className="space-y-4">
                                         <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                                             <span className={`text-lg font-bold ${pair.paidP1 ? 'text-slate-800' : 'text-rose-500'}`}>{p1?.name}</span>
                                             <button 
                                                onClick={() => p1 && dispatch({type: 'TOGGLE_PAID', payload: p1.id})} 
                                                className={`w-12 h-12 flex items-center justify-center rounded-lg shadow-sm transition-all border ${pair.paidP1 ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white text-slate-300 border-slate-200 hover:border-emerald-400 hover:text-emerald-400'}`}
                                             >
                                                 {pair.paidP1 ? <Check size={24} strokeWidth={4} /> : <DollarSign size={24}/>}
                                             </button>
                                         </div>
                                         <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                                             <span className={`text-lg font-bold ${pair.paidP2 ? 'text-slate-800' : 'text-rose-500'}`}>{p2?.name}</span>
                                             <button 
                                                onClick={() => p2 && dispatch({type: 'TOGGLE_PAID', payload: p2.id})} 
                                                className={`w-12 h-12 flex items-center justify-center rounded-lg shadow-sm transition-all border ${pair.paidP2 ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white text-slate-300 border-slate-200 hover:border-emerald-400 hover:text-emerald-400'}`}
                                             >
                                                 {pair.paidP2 ? <Check size={24} strokeWidth={4} /> : <DollarSign size={24}/>}
                                             </button>
                                         </div>
                                     </div>
                                </div>
                            )
                        }) : (
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
                  {restingPairs.map(pair => {
                      const p1 = getPlayer(pair.player1Id);
                      const p2 = getPlayer(pair.player2Id);
                      return (
                          <div key={pair.id} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm">
                               <div>
                                   <div className="text-lg font-bold text-slate-700">{p1?.name}</div>
                                   <div className="text-lg font-bold text-slate-700">& {p2?.name}</div>
                               </div>
                               <button 
                                    onClick={() => dispatch({ type: 'TOGGLE_WATER', payload: pair.id })}
                                    className={`p-3 rounded-lg ${pair.waterReceived ? 'bg-blue-100 text-blue-600' : 'bg-slate-50 text-slate-300'}`}
                                ><Droplets size={24}/></button>
                          </div>
                      )
                  })}
              </div>
          </div>
      )}
    </div>
  );
};

export default CheckIn;
