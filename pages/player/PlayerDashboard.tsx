import React from 'react';
import { THEME } from '../../utils/theme';
import { Activity, TrendingUp, Award, Calendar, ChevronRight } from 'lucide-react';

const PlayerDashboard: React.FC = () => {
    // MOCK DATA for Phase 1 Visualization
    const playerStats = {
        name: "Ernesto",
        elo: 1450,
        ranking: "3ª Categoría",
        matches: 42,
        winRate: 68,
        nextMatch: null
    };

    return (
        <div className="p-6 space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center pt-2">
                <div>
                    <h1 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Hola de nuevo,</h1>
                    <h2 className="text-3xl font-black text-slate-900">{playerStats.name}</h2>
                </div>
                <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-white shadow-md flex items-center justify-center text-lg font-black text-slate-400">
                    {playerStats.name[0]}
                </div>
            </div>

            {/* ELO Card */}
            <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-xl bg-gradient-to-br from-[#2B2DBF] to-[#575AF9]">
                <div className="absolute top-0 right-0 p-6 opacity-20">
                    <TrendingUp size={120} />
                </div>
                
                <div className="relative z-10">
                    <div className="text-emerald-300 font-bold text-xs uppercase tracking-widest mb-1 flex items-center gap-1">
                        <Activity size={14}/> Ranking Actual
                    </div>
                    <div className="text-6xl font-black tracking-tighter mb-2">
                        {playerStats.elo}
                    </div>
                    <div className="inline-block bg-white/20 backdrop-blur-md px-3 py-1 rounded-lg text-xs font-bold border border-white/10">
                        {playerStats.ranking}
                    </div>
                </div>

                {/* Mini Stats Row */}
                <div className="relative z-10 mt-8 grid grid-cols-2 gap-4 pt-6 border-t border-white/10">
                    <div>
                        <div className="text-2xl font-black">{playerStats.winRate}%</div>
                        <div className="text-[10px] text-indigo-200 uppercase font-bold">Victorias</div>
                    </div>
                    <div>
                        <div className="text-2xl font-black">{playerStats.matches}</div>
                        <div className="text-[10px] text-indigo-200 uppercase font-bold">Partidos</div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-4">
                <button className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Calendar size={20} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Ver Torneos</span>
                </button>
                <button className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform">
                    <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Award size={20} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Mi Historial</span>
                </button>
            </div>

            {/* Recent Activity Placeholder */}
            <div>
                <h3 className="text-lg font-bold text-slate-900 mb-4">Última Actividad</h3>
                <div className="bg-slate-50 rounded-2xl p-6 text-center border border-slate-200 border-dashed">
                    <p className="text-slate-400 text-sm italic">No hay partidos recientes</p>
                    <button style={{ color: THEME.cta }} className="mt-2 text-sm font-bold flex items-center justify-center gap-1 mx-auto">
                        Apuntarse a un Mini <ChevronRight size={16}/>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PlayerDashboard;
