import React, { useState } from 'react';
import { useTournament } from '../store/TournamentContext';
import { useHistory } from '../store/HistoryContext';
import { Users, PlayCircle, CheckCircle, Clock, Database, Trash2, Archive, RefreshCw, AlertTriangle, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { state, dispatch, loadData } = useTournament();
  const { archiveTournament } = useHistory();
  const navigate = useNavigate();

  // MODAL STATE
  const [modalConfig, setModalConfig] = useState<{
      type: 'reset' | 'archive' | 'demo' | 'reload' | null;
      isOpen: boolean;
  }>({ type: null, isOpen: false });

  const StatCard = ({ title, value, icon: Icon, color, onClick }: any) => (
    <div 
      onClick={onClick}
      className="bg-white p-5 rounded-2xl border border-slate-200 cursor-pointer hover:border-emerald-300 transition-all hover:shadow-md shadow-sm h-full flex flex-col justify-between"
    >
      <div className="flex items-start justify-between mb-2">
        <div className={`p-2.5 rounded-xl ${color.replace('text-', 'bg-').replace('400', '100')} ${color.replace('400', '600')}`}>
          <Icon size={22} />
        </div>
      </div>
      <div>
          <div className="text-2xl font-black text-slate-800">{value}</div>
          <h3 className="text-slate-400 font-bold uppercase text-[10px] tracking-wider mt-1">{title}</h3>
      </div>
    </div>
  );

  const performAction = () => {
      if (modalConfig.type === 'reset') {
          dispatch({ type: 'RESET_LOCAL' });
      } else if (modalConfig.type === 'archive') {
          archiveTournament(state);
      } else if (modalConfig.type === 'demo') {
          dispatch({ type: 'LOAD_DEMO_DATA' });
      } else if (modalConfig.type === 'reload') {
          loadData();
      }
      setModalConfig({ type: null, isOpen: false });
  };
  
  const openModal = (type: 'reset' | 'archive' | 'demo' | 'reload') => {
      if (type === 'demo' && state.pairs.length > 0) {
          // Logic handled in modal render/text
      }
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
      if (r <= 4) return r;
      if (r === 5) return 'Cuartos';
      if (r === 6) return 'Semis';
      if (r === 7) return 'Final';
      return '-';
  };

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">Panel de Control</h2>
      </div>

      {/* 2x2 Grid for Mobile */}
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
          value={`${state.pairs.length}`} 
          icon={Users} 
          color={state.pairs.length >= 10 ? "text-emerald-400" : "text-orange-400"}
          onClick={() => navigate('/registration')}
        />
        <StatCard 
          title="Estado" 
          value={state.status === 'active' ? 'EN JUEGO' : state.status === 'setup' ? 'REGISTRO' : 'FINALIZADO'} 
          icon={ActivityIcon(state.status)} 
          color={state.status === 'active' ? "text-rose-400" : "text-purple-400"} 
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
      
      {/* Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-6">Acciones Rápidas</h3>
        <div className="flex flex-col gap-4">
           
          {state.status === 'setup' && (
             <button 
             onClick={() => navigate('/active')}
             className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors shadow-md text-lg flex items-center justify-center gap-2"
           >
             <Play size={24}/> CONFIGURAR Y EMPEZAR
           </button>
          )}

           {state.status === 'active' && (
             <button 
             onClick={() => navigate('/active')}
             className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors animate-pulse flex items-center justify-center gap-2 shadow-md text-lg"
           >
             <PlayCircle size={24}/> IR AL TORNEO EN VIVO
           </button>
          )}

           <button 
            onClick={() => navigate('/registration')}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-md text-lg"
          >
            Registrar Jugadores
          </button>
          <button 
            onClick={() => navigate('/checkin')}
            className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors shadow-sm text-lg"
          >
            Control / Pagos
          </button>
        </div>
      </div>

      {/* Config / Archive Zone */}
      <div className="bg-slate-100 rounded-2xl border border-slate-200 p-6 mt-8">
          <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-wide">Zona de Configuración</h3>
          <div className="flex flex-col gap-3">
               {state.status === 'finished' && (
                   <button 
                    onClick={() => openModal('archive')}
                    className="flex items-center justify-center gap-2 px-4 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm shadow-lg font-bold animate-pulse"
                   >
                       <Archive size={18} />
                       FINALIZAR Y ARCHIVAR TORNEO
                   </button>
               )}

               {state.status === 'setup' && (
                   <button 
                    onClick={() => openModal('demo')}
                    className="flex items-center justify-center gap-2 px-4 py-4 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm border border-slate-300 shadow-sm font-bold"
                   >
                       <Database size={18} />
                       Cargar Datos de Prueba
                   </button>
               )}
               
               <div className="flex gap-2">
                   <button 
                    onClick={() => openModal('reset')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-4 bg-white hover:bg-red-50 text-red-600 rounded-xl text-sm border border-red-200 shadow-sm font-bold"
                   >
                       <Trash2 size={18} />
                       Resetear Torneo
                   </button>
                   <button 
                    onClick={() => openModal('reload')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-4 bg-white hover:bg-blue-50 text-blue-600 rounded-xl text-sm border border-blue-200 shadow-sm font-bold"
                   >
                       <RefreshCw size={18} />
                       Recargar Datos
                   </button>
               </div>
          </div>
      </div>

      {/* GLOBAL CONFIRMATION MODAL */}
      {modalConfig.isOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl animate-scale-in text-center">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${modalConfig.type === 'archive' || modalConfig.type === 'reload' ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'}`}>
                      {modalConfig.type === 'archive' ? <Archive size={32}/> : 
                       modalConfig.type === 'reload' ? <RefreshCw size={32}/> :
                       <AlertTriangle size={32} />}
                  </div>
                  
                  <h3 className="text-xl font-black text-slate-900 mb-2">
                      {modalConfig.type === 'reset' && '¿Resetear Torneo?'}
                      {modalConfig.type === 'archive' && '¿Archivar Torneo?'}
                      {modalConfig.type === 'demo' && '¿Cargar Demo?'}
                      {modalConfig.type === 'reload' && '¿Recargar Datos?'}
                  </h3>
                  
                  <p className="text-slate-500 mb-8 leading-relaxed">
                      {modalConfig.type === 'reset' && 'Se borrarán todos los datos locales del torneo actual. Esta acción no se puede deshacer.'}
                      {modalConfig.type === 'archive' && 'El torneo se guardará en el historial y se preparará la app para uno nuevo.'}
                      {modalConfig.type === 'demo' && 'Se borrarán los datos actuales y se cargarán jugadores de prueba.'}
                      {modalConfig.type === 'reload' && 'Se forzará una recarga desde la base de datos de Supabase.'}
                  </p>

                  <div className="grid grid-cols-1 gap-3">
                      <button 
                        onClick={performAction}
                        className={`w-full py-4 rounded-xl font-bold text-white shadow-lg ${modalConfig.type === 'archive' || modalConfig.type === 'reload' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-rose-600 hover:bg-rose-700'}`}
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