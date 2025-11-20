
import React from 'react';
import { useTournament } from '../store/TournamentContext';
import { useHistory } from '../store/HistoryContext';
import { Users, PlayCircle, CheckCircle, Clock, Database, Trash2, Archive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { state, dispatch } = useTournament();
  const { archiveTournament } = useHistory();
  const navigate = useNavigate();

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

  const handleReset = () => {
      if (window.confirm('¿Estás seguro de que quieres borrar todos los datos del torneo actual? Esta acción no se puede deshacer.')) {
          dispatch({ type: 'RESET_TOURNAMENT' });
      }
  };
  
  const handleArchiveAndReset = () => {
      if (window.confirm('Esto guardará el torneo en el historial y reiniciará la aplicación para un nuevo torneo. ¿Continuar?')) {
          archiveTournament(state);
          dispatch({ type: 'RESET_TOURNAMENT' });
      }
  };

  const handleLoadDemo = () => {
      if (state.pairs.length > 0) {
          if (!window.confirm('Ya hay datos registrados. ¿Quieres borrarlos y cargar datos de prueba?')) return;
      }
      dispatch({ type: 'LOAD_DEMO_DATA' });
  };

  const ActivityIcon = (status: string) => {
    switch(status) {
      case 'active': return PlayCircle;
      case 'finished': return CheckCircle;
      default: return Clock;
    }
  }

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h2 className="text-3xl font-black text-slate-900 mb-2">Panel de Control</h2>
        <p className="text-slate-500 font-medium">Gestiona tu mini torneo.</p>
      </div>

      {/* 2x2 Grid for Mobile */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          title="Jugadores" 
          value={state.players.length} 
          icon={Users} 
          color="text-blue-400" 
          onClick={() => navigate('/players')} /* Changed to /players */
        />
        <StatCard 
          title="Parejas" 
          value={`${state.pairs.length} / 16`} 
          icon={Users} 
          color={state.pairs.length === 16 ? "text-emerald-400" : "text-orange-400"}
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
          value={state.currentRound || '-'} 
          icon={Clock} 
          color="text-pink-400" 
          onClick={() => navigate('/active')}
        />
      </div>
      
      {/* Actions (Registration, CheckIn, Active) - Same as before */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-6">Acciones Rápidas</h3>
        <div className="flex flex-col gap-4">
           <button 
            onClick={() => navigate('/registration')}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-md text-lg"
          >
            Registrar Jugadores
          </button>
          <button 
            onClick={() => navigate('/checkin')}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors shadow-md text-lg"
          >
            Control / Pagos
          </button>
          {state.status === 'active' && (
             <button 
             onClick={() => navigate('/active')}
             className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors animate-pulse flex items-center justify-center gap-2 shadow-md text-lg"
           >
             <PlayCircle size={24}/> IR AL TORNEO EN VIVO
           </button>
          )}
        </div>
      </div>

      {/* Config / Archive Zone */}
      <div className="bg-slate-100 rounded-2xl border border-slate-200 p-6 mt-8">
          <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-wide">Zona de Configuración</h3>
          <div className="flex flex-col gap-3">
               {state.status === 'finished' && (
                   <button 
                    onClick={handleArchiveAndReset}
                    className="flex items-center justify-center gap-2 px-4 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm shadow-lg font-bold animate-pulse"
                   >
                       <Archive size={18} />
                       FINALIZAR Y ARCHIVAR TORNEO
                   </button>
               )}

               {state.status === 'setup' && (
                   <button 
                    onClick={handleLoadDemo}
                    className="flex items-center justify-center gap-2 px-4 py-4 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm border border-slate-300 shadow-sm font-bold"
                   >
                       <Database size={18} />
                       Cargar Datos de Prueba
                   </button>
               )}
               
               <button 
                onClick={handleReset}
                className="flex items-center justify-center gap-2 px-4 py-4 bg-white hover:bg-red-50 text-red-600 rounded-xl text-sm border border-red-200 shadow-sm font-bold"
               >
                   <Trash2 size={18} />
                   Resetear Torneo Completo
               </button>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
