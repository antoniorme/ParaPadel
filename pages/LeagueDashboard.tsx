
import React, { useEffect } from 'react';
import { useLeague } from '../store/LeagueContext';
import { useTournament } from '../store/TournamentContext';
import { useAuth } from '../store/AuthContext';
import { THEME } from '../utils/theme';
import { Plus, ChevronRight, Calendar, Users, Trophy, Activity, Info, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LeaguePromo from './LeaguePromo';

const LeagueDashboard: React.FC = () => {
    const { leaguesList, fetchLeagues, selectLeague, isLeagueModuleEnabled } = useLeague();
    const { formatPlayerName } = useTournament();
    const { role } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        // We allow fetch if enabled OR if superadmin
        if (isLeagueModuleEnabled || role === 'superadmin') {
            fetchLeagues();
        }
    }, [fetchLeagues, isLeagueModuleEnabled, role]);

    // IF NOT ENABLED AND NOT SUPERADMIN -> SHOW PROMO
    if (!isLeagueModuleEnabled && role !== 'superadmin') {
        return <LeaguePromo />;
    }

    return (
        <div className="space-y-8 pb-20 animate-fade-in">
            {/* BACK BUTTON & HEADER */}
            <div>
                <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-indigo-100 font-bold text-sm hover:text-white transition-colors mb-4 px-1">
                    <ArrowLeft size={18}/> Volver al Club
                </button>
                <div className="flex justify-between items-center px-1">
                    <div className="flex flex-col">
                        <h2 className="text-2xl font-black text-white drop-shadow-sm">Mis Ligas</h2>
                        {role === 'superadmin' && !isLeagueModuleEnabled && (
                            <span className="text-[10px] font-bold text-amber-300 uppercase tracking-tighter">Acceso SuperAdmin (Módulo desactivado)</span>
                        )}
                    </div>
                    <button 
                        onClick={() => navigate('/league/setup')} 
                        className="flex items-center gap-2 px-5 py-2.5 bg-white text-indigo-500 rounded-xl font-bold text-sm shadow-xl shadow-indigo-600/20 active:scale-95 transition-transform hover:bg-indigo-50"
                    >
                        <Plus size={20}/> NUEVA LIGA
                    </button>
                </div>
            </div>

            {leaguesList.length === 0 ? (
                <div className="text-center py-20 bg-white/10 backdrop-blur-md rounded-[2.5rem] border-2 border-dashed border-white/20">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6 text-white">
                        <Trophy size={40}/>
                    </div>
                    <h3 className="text-xl font-bold text-white">No hay ligas creadas</h3>
                    <p className="text-indigo-100 text-sm mb-8 max-w-xs mx-auto">Configura tu primera liga profesional para empezar a gestionar grupos y resultados.</p>
                    <button 
                        onClick={() => navigate('/league/setup')}
                        className="px-8 py-3 bg-white text-indigo-500 font-black rounded-xl text-sm hover:bg-indigo-50 transition-colors shadow-lg"
                    >
                        CONFIGURAR LIGA
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {leaguesList.map(l => (
                        <div 
                            key={l.id}
                            onClick={() => { selectLeague(l.id); navigate('/league/active?tab=management'); }} // Default to management view
                            className="bg-white rounded-[2rem] border border-transparent shadow-xl overflow-hidden cursor-pointer hover:translate-y-[-4px] transition-all group relative"
                        >
                            <div className="p-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            {l.status === 'registration' && (
                                                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>
                                            )}
                                            {l.status === 'groups' && (
                                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                            )}
                                            {l.status === 'finished' && (
                                                <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                                            )}
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                {l.status === 'registration' ? 'Fase Inscripción' : l.status === 'groups' ? 'Fase Grupos' : l.status === 'playoffs' ? 'Playoffs' : 'Finalizada'}
                                            </span>
                                        </div>
                                        <h3 className="font-black text-slate-900 text-2xl leading-tight group-hover:text-indigo-500 transition-colors">{l.title}</h3>
                                        <div className="flex items-center gap-4 mt-3">
                                            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase">
                                                <Calendar size={14} className="text-indigo-400"/>
                                                {new Date(l.start_date).toLocaleDateString()}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase">
                                                <Users size={14} className="text-indigo-400"/>
                                                {l.pairsCount || 0} Parejas
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-indigo-50 text-indigo-500 rounded-2xl group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                        <ChevronRight size={24} />
                                    </div>
                                </div>
                                
                                <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                                    <div className="flex -space-x-2 overflow-hidden">
                                        {/* Fake Avatars */}
                                        <div className="inline-block h-6 w-6 rounded-full bg-slate-100 ring-2 ring-white border border-slate-200"></div>
                                        <div className="inline-block h-6 w-6 rounded-full bg-slate-100 ring-2 ring-white border border-slate-200"></div>
                                        <div className="inline-block h-6 w-6 rounded-full bg-slate-100 ring-2 ring-white border border-slate-200"></div>
                                    </div>
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                                        GESTIONAR LIGA <ChevronRight size={12}/>
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LeagueDashboard;
