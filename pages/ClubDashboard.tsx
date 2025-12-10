import React, { useEffect } from 'react';
import { useTournament } from '../store/TournamentContext';
import { THEME, getFormatColor } from '../utils/theme';
import { Calendar, Users, Plus, ChevronRight, Play, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ClubDashboard: React.FC = () => {
    const { state, fetchTournamentList, selectTournament } = useTournament();
    const navigate = useNavigate();

    useEffect(() => {
        fetchTournamentList();
    }, [fetchTournamentList]);

    const handleSelect = async (id: string) => {
        await selectTournament(id);
        // After selection, the app state will have an ID, triggering Layout to show tournament nav
        // We navigate to the "Inner Dashboard" (which we renamed conceptually to TournamentDashboard)
        navigate('/active'); // Or /dashboard (tournament view)
    };

    const activeTournaments = state.tournamentList.filter(t => t.status !== 'finished');

    return (
        <div className="space-y-8 pb-20 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-900">Mis Torneos</h2>
                <button 
                    onClick={() => navigate('/setup')} 
                    style={{ backgroundColor: THEME.cta }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-bold text-sm shadow-md active:scale-95 transition-transform"
                >
                    <Plus size={18}/> Nuevo
                </button>
            </div>

            {activeTournaments.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                    <Calendar size={48} className="mx-auto text-slate-300 mb-4"/>
                    <h3 className="text-lg font-bold text-slate-700">No hay torneos activos</h3>
                    <p className="text-slate-400 text-sm mb-6">Crea uno nuevo para empezar a jugar.</p>
                    <button 
                        onClick={() => navigate('/setup')}
                        className="text-[#575AF9] font-bold text-sm hover:underline"
                    >
                        Crear Primer Torneo
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeTournaments.map(t => {
                        const color = getFormatColor(t.format);
                        const isSetup = t.status === 'setup';
                        
                        return (
                            <div 
                                key={t.id} 
                                onClick={() => handleSelect(t.id)}
                                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-all group"
                            >
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`w-2 h-2 rounded-full ${isSetup ? 'bg-slate-400' : 'bg-rose-500 animate-pulse'}`}></span>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                    {isSetup ? 'Inscripción' : 'En Juego'}
                                                </span>
                                            </div>
                                            <h3 className="font-black text-slate-900 text-lg leading-tight group-hover:text-[#575AF9] transition-colors">{t.title}</h3>
                                        </div>
                                        <div className="bg-slate-50 p-2 rounded-xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-[#575AF9] transition-colors">
                                            <ChevronRight size={20}/>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                                        <div className="flex items-center gap-1">
                                            <Calendar size={14}/>
                                            {new Date(t.date).toLocaleDateString('es-ES', {weekday: 'short', day: 'numeric', month: 'short'})}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Users size={14}/>
                                            {t.playerCount || 0} Parejas
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                                        <span style={{ color }} className="text-[10px] font-bold px-2 py-1 rounded bg-slate-100 border border-slate-200">
                                            {t.format.replace('_mini', '').toUpperCase()}
                                        </span>
                                        {isSetup ? (
                                            <span className="text-xs font-bold text-slate-400 flex items-center gap-1"><Settings size={14}/> Gestionar</span>
                                        ) : (
                                            <span className="text-xs font-bold text-rose-500 flex items-center gap-1"><Play size={14}/> Directo</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ClubDashboard;