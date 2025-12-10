
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournament } from '../../store/TournamentContext';
import { useHistory } from '../../store/HistoryContext';
import { useNotifications } from '../../store/NotificationContext'; // IMPORT
import { THEME } from '../../utils/theme';
import { Activity, TrendingUp, Award, Calendar, ChevronRight, LogOut, UserCircle, Bell } from 'lucide-react';
import { calculateDisplayRanking } from '../../utils/Elo';

const PlayerDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { state, formatPlayerName } = useTournament();
    const { pastTournaments } = useHistory();
    const { unreadCount } = useNotifications(); // USE NOTIFICATIONS

    // --- IDENTITY SIMULATOR ---
    const [myPlayerId, setMyPlayerId] = useState<string>(() => {
        return localStorage.getItem('padel_sim_player_id') || '';
    });

    useEffect(() => {
        if (myPlayerId) {
            localStorage.setItem('padel_sim_player_id', myPlayerId);
        }
    }, [myPlayerId]);

    const currentPlayer = state.players.find(p => p.id === myPlayerId);

    // --- REAL STATS ENGINE ---
    const stats = useMemo(() => {
        if (!currentPlayer) return null;
        
        const result = { matches: 0, wins: 0, winRate: 0 };
        
        const processData = (tData: any) => {
            const myPairs = tData.pairs.filter((p: any) => p.player1Id === myPlayerId || p.player2Id === myPlayerId);
            myPairs.forEach((pair: any) => {
                const matches = tData.matches.filter((m: any) => m.isFinished && (m.pairAId === pair.id || m.pairBId === pair.id));
                matches.forEach((m: any) => {
                    result.matches++;
                    const isPairA = m.pairAId === pair.id;
                    const won = (isPairA && (m.scoreA || 0) > (m.scoreB || 0)) || (!isPairA && (m.scoreB || 0) > (m.scoreA || 0));
                    if (won) result.wins++;
                });
            });
        };

        pastTournaments.forEach(pt => { if (pt.data) processData(pt.data); });
        if (state.status !== 'setup') processData(state);

        result.winRate = result.matches > 0 ? Math.round((result.wins / result.matches) * 100) : 0;
        return result;

    }, [currentPlayer, pastTournaments, state]);

    const handleExit = () => {
        navigate('/dashboard');
    };

    if (!currentPlayer) {
        return (
            <div className="p-8 min-h-screen flex flex-col justify-center items-center text-center">
                <UserCircle size={64} className="text-slate-300 mb-4"/>
                <h2 className="text-2xl font-black text-slate-900 mb-2">Simulador de Identidad</h2>
                <p className="text-slate-500 mb-8">Para probar la App de Jugadores, selecciona quién eres.</p>
                <select 
                    className="w-full p-4 bg-white border border-slate-300 rounded-xl font-bold text-slate-700 outline-none focus:border-[#575AF9]"
                    onChange={(e) => setMyPlayerId(e.target.value)}
                    value=""
                >
                    <option value="" disabled>Seleccionar Jugador...</option>
                    {state.players.map(p => (
                        <option key={p.id} value={p.id}>{formatPlayerName(p)} ({p.categories?.[0] || 'Sin Nivel'})</option>
                    ))}
                </select>
                <button onClick={handleExit} className="mt-8 text-slate-400 font-bold text-sm">Volver al Admin</button>
            </div>
        );
    }

    const currentElo = calculateDisplayRanking(currentPlayer);
    const categoryLabel = currentPlayer.categories?.[0] || 'Sin Categoría';

    return (
        <div className="p-6 space-y-8 relative pb-24">
            
            {/* Identity Switcher */}
            <div className="bg-slate-100 p-2 rounded-lg flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-slate-500 uppercase px-2">Viendo como:</span>
                <select 
                    value={myPlayerId} 
                    onChange={(e) => setMyPlayerId(e.target.value)}
                    className="bg-white border border-slate-200 rounded px-2 py-1 font-bold text-slate-700 outline-none"
                >
                    {state.players.map(p => <option key={p.id} value={p.id}>{formatPlayerName(p)}</option>)}
                </select>
            </div>

            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Hola de nuevo,</h1>
                    <h2 className="text-3xl font-black text-slate-900">{currentPlayer.nickname || currentPlayer.name.split(' ')[0]}</h2>
                </div>
                <div className="flex flex-col items-end gap-2">
                     <button 
                        onClick={handleExit}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold uppercase tracking-wide hover:bg-slate-200 transition-colors"
                    >
                        <LogOut size={12} /> Salir
                    </button>
                    <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-white shadow-md flex items-center justify-center text-lg font-black text-slate-400 overflow-hidden">
                        {currentPlayer.name[0]}
                    </div>
                </div>
            </div>

            {/* NOTIFICATION BANNER (If Unread) */}
            {unreadCount > 0 && (
                <div 
                    onClick={() => navigate('/notifications')}
                    className="bg-white border-l-4 border-rose-500 rounded-xl p-4 shadow-sm flex items-center justify-between animate-fade-in cursor-pointer"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-rose-100 p-2 rounded-full text-rose-600">
                            <Bell size={20} />
                        </div>
                        <div>
                            <div className="font-bold text-slate-800 text-sm">Tienes novedades</div>
                            <div className="text-xs text-slate-500">{unreadCount} notificaciones sin leer</div>
                        </div>
                    </div>
                    <ChevronRight size={20} className="text-slate-300"/>
                </div>
            )}

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
                        {currentElo}
                    </div>
                    <div className="inline-block bg-white/20 backdrop-blur-md px-3 py-1 rounded-lg text-xs font-bold border border-white/10">
                        {categoryLabel}
                    </div>
                </div>

                <div className="relative z-10 mt-8 grid grid-cols-2 gap-4 pt-6 border-t border-white/10">
                    <div>
                        <div className="text-2xl font-black">{stats?.winRate}%</div>
                        <div className="text-[10px] text-indigo-200 uppercase font-bold">Victorias</div>
                    </div>
                    <div>
                        <div className="text-2xl font-black">{stats?.matches}</div>
                        <div className="text-[10px] text-indigo-200 uppercase font-bold">Partidos</div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-4">
                <button 
                    onClick={() => navigate('/p/tournaments')}
                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                    <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Calendar size={20} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Ver Torneos</span>
                </button>
                <button 
                    onClick={() => navigate('/p/profile')}
                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                    <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Award size={20} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Mi Historial</span>
                </button>
            </div>

            {/* Recent Activity */}
            <div>
                <h3 className="text-lg font-bold text-slate-900 mb-4">Última Actividad</h3>
                {stats && stats.matches > 0 ? (
                    <div onClick={() => navigate('/p/profile')} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex justify-between items-center cursor-pointer hover:border-slate-300">
                        <div>
                            <div className="text-xs font-bold text-slate-400 uppercase">Resumen Global</div>
                            <div className="text-sm font-bold text-slate-800">{stats.matches} Partidos jugados</div>
                        </div>
                        <ChevronRight size={20} className="text-slate-300"/>
                    </div>
                ) : (
                    <div className="bg-slate-50 rounded-2xl p-6 text-center border border-slate-200 border-dashed">
                        <p className="text-slate-400 text-sm italic">No hay partidos recientes</p>
                        <button onClick={() => navigate('/p/explore')} style={{ color: THEME.cta }} className="mt-2 text-sm font-bold flex items-center justify-center gap-1 mx-auto">
                            Apuntarse a un Mini <ChevronRight size={16}/>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlayerDashboard;
