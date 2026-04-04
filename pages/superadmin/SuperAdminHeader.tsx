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
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-500 p-2 rounded-lg">
                            <Shield size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight">Super Admin</h1>
                            <p className="text-slate-400 text-sm">Control global de ParaPadel</p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-all border border-white/10">
                            <LayoutDashboard size={16}/> Mi Club
                        </button>
                        <button onClick={() => navigate('/p/dashboard')} className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-all border border-white/10">
                            <Smartphone size={16}/> App Jugador
                        </button>
                    </div>
                </div>

                <div className="mb-8">
                    <button onClick={onNewClub} className="flex items-center gap-2 px-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black shadow-lg transition-all active:scale-95">
                        <Plus size={20}/> ALTA NUEVO CLUB
                    </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                            <Building size={12} className="text-blue-400"/> Clubs
                        </div>
                        <div className="text-3xl font-black">{globalStats.totalClubs}</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                            <Activity size={12} className="text-rose-400"/> Minis En Juego
                        </div>
                        <div className="text-3xl font-black text-rose-400">{globalStats.activeTourneys}</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                            <Trophy size={12} className="text-amber-400"/> Minis Finalizados
                        </div>
                        <div className="text-3xl font-black">{globalStats.finishedTourneys}</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                            <Users size={12} className="text-emerald-400"/> Jugadores
                        </div>
                        <div className="text-3xl font-black text-emerald-400">{globalStats.totalPlayers}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SuperAdminHeader;
