import React from 'react';
import { Shield, Building, Plus, LayoutDashboard, Smartphone, Activity, Trophy, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface GlobalStats {
    totalClubs: number;
    totalPlayers: number;
    activeTourneys: number;
    finishedTourneys: number;
}

interface SuperAdminHeaderProps {
    globalStats: GlobalStats;
    onNewClub: () => void;
}

const SuperAdminHeader: React.FC<SuperAdminHeaderProps> = ({ globalStats, onNewClub }) => {
    const navigate = useNavigate();

    return (
        <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
                <Shield size={120} />
            </div>
            <div className="relative z-10">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="bg-[#575AF9] p-2 rounded-lg shrink-0">
                            <Shield size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Super Admin</h1>
                            <p className="text-slate-400 text-sm">Control global de ParaPadel</p>
                        </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 px-3 py-2 sm:px-5 sm:py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs sm:text-sm font-bold transition-all border border-white/10">
                            <LayoutDashboard size={16}/> Mi Club
                        </button>
                        <button onClick={() => navigate('/p/dashboard')} className="flex items-center gap-2 px-3 py-2 sm:px-5 sm:py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs sm:text-sm font-bold transition-all border border-white/10">
                            <Smartphone size={16}/> <span className="hidden sm:inline">App </span>Jugador
                        </button>
                    </div>
                </div>

                <div className="mb-8">
                    <button onClick={onNewClub} className="flex items-center gap-2 px-5 py-3 sm:px-6 sm:py-4 bg-[#575AF9] hover:bg-[#484bf0] text-white rounded-2xl font-black shadow-lg transition-all active:scale-95 text-sm sm:text-base">
                        <Plus size={18}/> ALTA NUEVO CLUB
                    </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { icon: <Building size={12} className="text-blue-400"/>, label: 'Clubs', value: globalStats.totalClubs, color: '' },
                        { icon: <Activity size={12} className="text-emerald-400"/>, label: 'En Juego', value: globalStats.activeTourneys, color: 'text-emerald-400' },
                        { icon: <Trophy size={12} className="text-amber-400"/>, label: 'Finalizados', value: globalStats.finishedTourneys, color: '' },
                        { icon: <Users size={12} className="text-emerald-400"/>, label: 'Jugadores', value: globalStats.totalPlayers, color: 'text-emerald-400' },
                    ].map(({ icon, label, value, color }) => (
                        <div key={label} className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2 whitespace-nowrap">
                                {icon} {label}
                            </div>
                            <div className={`text-3xl font-black ${color}`}>{value}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SuperAdminHeader;
