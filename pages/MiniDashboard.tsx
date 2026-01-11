
import React, { useEffect } from 'react';
import { useTournament } from '../store/TournamentContext';
import { THEME, getFormatColor } from '../utils/theme';
import { Calendar, Plus, ChevronRight, ArrowLeft, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MiniDashboard: React.FC = () => {
    const { state, fetchTournamentList, selectTournament } = useTournament();
    const navigate = useNavigate();

    useEffect(() => {
        fetchTournamentList();
    }, [fetchTournamentList]);

    const handleSelect = async (id: string) => {
        await selectTournament(id);
        navigate('/tournament/manage');
    };

    const activeTournaments = state.tournamentList.filter(t => t.status !== 'finished');
    const finishedTournaments = state.tournamentList.filter(t => t.status === 'finished');

    return (
        <div className="space-y-8 pb-20 animate-fade-in text-white">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate('/dashboard')} className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h2 className="text-2xl font-black text-white">Mis Minis</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Gestión de Torneos Express</p>
                </div>
                <div className="ml-auto">
                    <button 
                        onClick={() => navigate('/setup')} 
                        style={{ backgroundColor: THEME.cta }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-sm shadow-lg active:scale-95 transition-transform hover:opacity-90"
                    >
                        <Plus size={20}/> NUEVO
                    </button>
                </div>
            </div>

            {activeTournaments.length === 0 && finishedTournaments.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400">
                        <Trophy size={40}/>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">No hay torneos</h3>
                    <p className="text-slate-500 text-sm mb-8 max-w-xs mx-auto">Crea un torneo para empezar a gestionar inscripciones y el directo.</p>
                    <button 
                        onClick={() => navigate('/setup')}
                        className="px-8 py-3 bg-slate-900 text-white font-black rounded-xl text-sm hover:bg-slate-800 transition-colors"
                    >
                        CREAR PRIMER TORNEO
                    </button>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* ACTIVE SECTION */}
                    {activeTournaments.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {activeTournaments.map(t => {
                                const formatColor = getFormatColor(t.format);
                                const isSetup = t.status === 'setup';
                                
                                return (
                                    <div 
                                        key={t.id} 
                                        onClick={() => handleSelect(t.id)}
                                        className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden cursor-pointer hover:scale-[1.02] transition-all group relative"
                                    >
                                        <div className="p-6">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="w-3/4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className={`w-2.5 h-2.5 rounded-full ${isSetup ? 'bg-orange-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                                                        <span className={`text-[10px] font-black uppercase tracking-widest ${isSetup ? 'text-orange-500' : 'text-emerald-500'}`}>
                                                            {isSetup ? 'Inscripción Abierta' : 'En Juego'}
                                                        </span>
                                                    </div>
                                                    <h3 className="font-black text-slate-900 text-xl leading-tight group-hover:text-[#575AF9] transition-colors truncate">{t.title}</h3>
                                                    <div className="flex items-center gap-1.5 mt-2 text-slate-500 text-xs font-bold">
                                                        <Calendar size={14} className="text-indigo-500"/>
                                                        {new Date(t.date).toLocaleDateString('es-ES', {weekday: 'long', day: 'numeric', month: 'short'}).toUpperCase()}
                                                    </div>
                                                </div>
                                                
                                                <div className="flex flex-col items-center justify-center bg-slate-50 rounded-2xl p-3 min-w-[70px] border border-slate-100 shadow-inner">
                                                    <span className="text-2xl font-black text-slate-800 leading-none">{t.playerCount || 0}</span>
                                                    <span className="text-[9px] font-black uppercase text-slate-400 mt-1">Parejas</span>
                                                </div>
                                            </div>
                                            
                                            <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                                                <span style={{ 
                                                    color: formatColor, 
                                                    backgroundColor: `${formatColor}15`,
                                                    borderColor: `${formatColor}30`
                                                }} className="text-[10px] font-black px-3 py-1.5 rounded-xl border-2 uppercase tracking-wider shadow-sm">
                                                    {t.format.replace('_mini', '').toUpperCase()} PAREJAS
                                                </span>

                                                {isSetup ? (
                                                    <span className="text-xs font-black text-slate-400 flex items-center gap-1 group-hover:text-[#575AF9] transition-colors">
                                                        GESTIONAR <ChevronRight size={16}/>
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-black text-emerald-500 flex items-center gap-1 group-hover:underline">
                                                        VER DIRECTO <ChevronRight size={16}/>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* FINISHED SECTION */}
                    {finishedTournaments.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">Finalizados Recientemente</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {finishedTournaments.map(t => (
                                    <div key={t.id} className="bg-white/10 border border-white/10 p-4 rounded-2xl flex justify-between items-center hover:bg-white/20 transition-colors cursor-pointer" onClick={() => handleSelect(t.id)}>
                                        <div>
                                            <div className="font-bold text-white">{t.title}</div>
                                            <div className="text-xs text-slate-300">{new Date(t.date).toLocaleDateString()}</div>
                                        </div>
                                        <span className="text-xs font-bold bg-white/10 px-3 py-1 rounded-lg text-slate-300">Finalizado</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MiniDashboard;
