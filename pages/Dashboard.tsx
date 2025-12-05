
import React, { useState } from 'react';
import { useTournament } from '../store/TournamentContext';
import { useHistory } from '../store/HistoryContext';
import { Users, PlayCircle, CheckCircle, Clock, Archive, Play, Trophy, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { state } = useTournament();
  const { archiveTournament } = useHistory();
  const navigate = useNavigate();

  // MODAL STATE
  const [modalConfig, setModalConfig] = useState<{
      type: 'archive' | null;
      isOpen: boolean;
  }>({ type: null, isOpen: false });

  // Calculate stats based on computed isReserve flag
  const activePairsCount = state.pairs.filter(p => !p.isReserve).length;
  const reservePairsCount = state.pairs.filter(p => p.isReserve).length;
  
  // Format Label (e.g., "12", "16")
  const formatLabel = state.format ? state.format.replace('_mini', '') : '16';

  const StatCard = ({ title, value, subValue, icon: Icon, color, onClick }: any) => (
    <div 
      onClick={onClick}
      className="bg-white p-5 rounded-2xl border border-slate-200 cursor-pointer hover:border-emerald-300 transition-all hover:shadow-md shadow-sm h-full flex flex-col justify-between relative overflow-hidden group"
    >
      <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform ${color.replace('text-', 'text-')}`}>
          <Icon size={64} />
      </div>
      
      <div className="flex items-start justify-between mb-3 relative z-10">
        <div className={`p-2.5 rounded-xl ${color.replace('text-', 'bg-').replace('400', '50')} ${color.replace('400', '600')}`}>
          <Icon size={24} />
        </div>
        {subValue && (
            <span className="text-[10px] font-black bg-slate-100 px-2 py-1 rounded-full text-slate-500 border border-slate-200">
                {subValue}
            </span>
        )}
      </div>
      <div className="relative z-10">
          <div className="text-3xl font-black text-slate-800 tracking-tight">{value}</div>
          <h3 className="text-slate-400 font-bold uppercase text-[10px] tracking-wider mt-1">{title}</h3>
      </div>
    </div>
  );

  const performAction = () => {
      if (modalConfig.type === 'archive') {
          archiveTournament(state);
      }
      setModalConfig({ type: null, isOpen: false });
  };
  
  const openModal = (type: 'archive') => {
      setModalConfig({ type, isOpen: true });
  }

  const ActivityIcon = (status: string) => {
    switch(status) {
      case 'active': return PlayCircle;
      case 'finished': return CheckCircle;
      default: return Clock;
    }
  }

  const getRoundLabel = (r: number) => {
      if (r === 0) return '-';
      if (r <= 4) return r;
      if (r === 5) return 'QF';
      if (r === 6) return 'SF';
      if (r >= 7) return 'Final';
      return r;
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header with Format Badge */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Panel de Control</h2>
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-black px-3 py-1 bg-slate-800 text-white rounded-lg tracking-wider border border-slate-800 shadow-sm">
                MINI {formatLabel.toUpperCase()}
            </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          title="Jugadores" 
          value={state.players.length} 
          icon={Users} 
          color="text-blue-400" 
          onClick={() => navigate('/players')} 
        />
        <StatCard 
          title="Parejas" 
          value={activePairsCount}
          subValue={reservePairsCount > 0 ? `+${reservePairsCount} Res.` : null}
          icon={Trophy} 
          color={activePairsCount > 0 ? "text-emerald-400" : "text-slate-400"}
          onClick={() => navigate('/registration')}
        />
        <StatCard 
          title="Estado" 
          value={state.status === 'active' ? 'EN JUEGO' : state.status === 'setup' ? 'REGISTRO' : 'FIN'} 
          icon={ActivityIcon(state.status)} 
          color={state.status === 'active' ? "text-rose-400" : state.status === 'finished' ? "text-purple-400" : "text-orange-400"} 
          onClick={() => navigate('/active')}
        />
        <StatCard 
          title="Ronda Actual" 
          value={getRoundLabel(state.currentRound)} 
          icon={Clock} 
          color="text-pink-400" 
          onClick={() => navigate('/active')}
        />
      </div>
      
      {/* Main Actions Area */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">Acciones Principales</h3>
        
        <div className="grid grid-cols-1 gap-4">
          {/* Context-Aware Primary Button */}
          {state.status === 'setup' && (
             <button 
             onClick={() => navigate('/active')}
             className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-md shadow-emerald-200 text-lg flex items-center justify-center gap-3 active:scale-[0.98]"
           >
             <div className="bg-white/20 p-1.5 rounded-full"><Play size={20} fill="currentColor"/></div>
             CONFIGURAR Y EMPEZAR
           </button>
          )}

           {state.status === 'active' && (
             <button 
             onClick={() => navigate('/active')}
             className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all animate-pulse shadow-md shadow-rose-200 text-lg flex items-center justify-center gap-3 active:scale-[0.98]"
           >
             <div className="bg-white/20 p-1.5 rounded-full"><PlayCircle size={20}/></div>
             IR AL TORNEO EN VIVO
           </button>
          )}

          {/* Secondary Actions */}
          <div className="grid grid-cols-2 gap-4">
               <button 
                onClick={() => navigate('/registration')}
                className="w-full py-4 bg-white border-2 border-slate-100 hover:border-blue-200 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-xl font-bold transition-all text-sm flex flex-col items-center justify-center gap-2"
              >
                <Users size={24} className="opacity-50"/>
                Inscripciones
              </button>
              <button 
                onClick={() => navigate('/checkin')}
                className="w-full py-4 bg-white border-2 border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-xl font-bold transition-all text-sm flex flex-col items-center justify-center gap-2"
              >
                <Clock size={24} className="opacity-50"/>
                Control y Pagos
              </button>
          </div>

          {/* Archive Action (Only when finished) */}
          {state.status === 'finished' && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                    <button 
                    onClick={() => openModal('archive')}
                    className="w-full py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-all shadow-lg text-lg flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                        <Archive size={24} />
                        ARCHIVAR Y CERRAR TORNEO
                    </button>
                    <p className="text-center text-xs text-slate-400 mt-2">Guardará resultados en historial y preparará un nuevo torneo.</p>
                </div>
           )}
        </div>
      </div>

      {/* GLOBAL CONFIRMATION MODAL */}
      {modalConfig.isOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl animate-scale-in text-center">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 bg-blue-100 text-blue-600`}>
                      <Archive size={32}/>
                  </div>
                  
                  <h3 className="text-xl font-black text-slate-900 mb-2">
                      ¿Archivar Torneo?
                  </h3>
                  
                  <p className="text-slate-500 mb-8 leading-relaxed">
                      El torneo se guardará en el historial y se preparará la app para uno nuevo.
                  </p>

                  <div className="grid grid-cols-1 gap-3">
                      <button 
                        onClick={performAction}
                        className={`w-full py-4 rounded-xl font-bold text-white shadow-lg bg-blue-600 hover:bg-blue-700 active:scale-95 transition-transform`}
                      >
                          Confirmar Acción
                      </button>
                      <button 
                        onClick={() => setModalConfig({ type: null, isOpen: false })}
                        className="w-full py-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200"
                      >
                          Cancelar
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Dashboard;
