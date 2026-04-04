
import React, { useEffect } from 'react';
import { useTournament } from '../store/TournamentContext';
import { useLeague } from '../store/LeagueContext';
import { useHistory } from '../store/HistoryContext';
import { THEME } from '../utils/theme';
import { ChevronRight, Trophy, CalendarRange, ArrowRight, Activity, Users, FileText, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const GeneralDashboard: React.FC = () => {
    const { state, fetchTournamentList } = useTournament();
    const { leaguesList, fetchLeagues } = useLeague();
    const { clubData } = useHistory();
    const navigate = useNavigate();

    useEffect(() => {
        fetchTournamentList();
        fetchLeagues();
    }, [fetchTournamentList, fetchLeagues]);

    // MINI STATS
    const allMinis = state.tournamentList || [];
    const activeMinis = allMinis.filter(t => t.status === 'active');
    const setupMinis = allMinis.filter(t => t.status === 'setup');
    const finishedMinis = allMinis.filter(t => t.status === 'finished');
    const totalMiniPlayers = allMinis.reduce((acc, t) => acc + (t.playerCount || 0), 0) * 2; // rough estimate if pair count

    // LEAGUE STATS
    const activeLeagues = leaguesList.filter(l => l.status === 'groups' || l.status === 'playoffs');
    const setupLeagues = leaguesList.filter(l => l.status === 'registration');
    const totalLeaguePairs = leaguesList.reduce((acc, l) => acc + (l.pairsCount || 0), 0);

    const showMinisFull = clubData.minis_full_enabled !== false;
    const showMinisLite = clubData.minis_lite_enabled === true;

    return (
        <div className="space-y-8 pb-20 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-900">Panel de Control</h2>
            </div>

            {/* QUICK ACTIONS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* CARD MINIS FULL */}
                {showMinisFull && (
                    <div 
                        onClick={() => navigate('/minis')}
                        className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-lg relative overflow-hidden group hover:border-[#575AF9]/50 transition-all cursor-pointer flex flex-col justify-between"
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-500">
                            <Trophy size={140} className="text-[#575AF9]"/>
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-14 h-14 bg-indigo-50 text-[#575AF9] rounded-2xl flex items-center justify-center">
                                    <Trophy size={28}/>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900">Minis</h3>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Torneos Express</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <div className="text-xs text-slate-400 font-bold uppercase mb-1 flex items-center gap-1"><Activity size={12}/> En Juego</div>
                                    <div className="text-2xl font-black text-slate-800">{activeMinis.length}</div>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <div className="text-xs text-slate-400 font-bold uppercase mb-1 flex items-center gap-1"><FileText size={12}/> Inscripción</div>
                                    <div className="text-2xl font-black text-slate-800">{setupMinis.length}</div>
                                </div>
                            </div>
                            
                            <p className="text-slate-500 text-sm mb-6 line-clamp-2">
                                Gestiona torneos rápidos de 8, 10, 12 o 16 parejas. Sorteos automáticos y directo.
                            </p>
                        </div>

                        <div className="mt-auto relative z-10">
                            <button className="w-full py-4 bg-[#575AF9] text-white rounded-xl font-bold text-sm shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                                GESTIONAR MINIS <ChevronRight size={16}/>
                            </button>
                        </div>
                    </div>
                )}

                {/* CARD MINIS LITE (Only if Full is disabled and Lite is enabled, OR if explicitly enabled) */}
                {/* Logic: If Full is hidden, show Lite. If both enabled, show both? For now, let's show both if both enabled. */}
                {showMinisLite && (
                    <div 
                        onClick={() => navigate('/lite/setup')}
                        className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-lg relative overflow-hidden group hover:border-emerald-500/50 transition-all cursor-pointer flex flex-col justify-between"
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-500">
                            <Smartphone size={140} className="text-emerald-500"/>
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                                    <Smartphone size={28}/>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900">Minis Lite</h3>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Gestión Simplificada</p>
                                </div>
                            </div>
                            
                            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-6">
                                <p className="text-emerald-800 text-sm font-medium">
                                    Versión optimizada para gestión rápida desde móvil. Crea torneos y comparte resultados al instante.
                                </p>
                            </div>
                            
                            <p className="text-slate-500 text-sm mb-6 line-clamp-2">
                                Ideal para mixins y torneos sociales sin gestión compleja de cuadros.
                            </p>
                        </div>

                        <div className="mt-auto relative z-10">
                            <button className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-emerald-600 transition-opacity flex items-center justify-center gap-2">
                                ACCEDER A LITE <ChevronRight size={16}/>
                            </button>
                        </div>
                    </div>
                )}

                {/* CARD LIGAS */}
                <div 
                    onClick={() => navigate('/league')}
                    className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-lg relative overflow-hidden group hover:border-emerald-500/50 transition-all cursor-pointer flex flex-col justify-between"
                >

                    <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-500">
                        <CalendarRange size={140} className="text-emerald-500"/>
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                                <CalendarRange size={28}/>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-900">Ligas</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Larga Duración</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div className="text-xs text-slate-400 font-bold uppercase mb-1 flex items-center gap-1"><Activity size={12}/> Activas</div>
                                <div className="text-2xl font-black text-slate-800">{activeLeagues.length}</div>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div className="text-xs text-slate-400 font-bold uppercase mb-1 flex items-center gap-1"><Users size={12}/> Parejas</div>
                                <div className="text-2xl font-black text-slate-800">{totalLeaguePairs}</div>
                            </div>
                        </div>

                        <p className="text-slate-500 text-sm mb-6 line-clamp-2">
                            Competición por jornadas, grupos y playoffs finales. Seguimiento mensual.
                        </p>
                    </div>

                    <div className="mt-auto relative z-10">
                        <button className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-slate-800 transition-opacity flex items-center justify-center gap-2">
                            GESTIONAR LIGAS <ChevronRight size={16}/>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default GeneralDashboard;
