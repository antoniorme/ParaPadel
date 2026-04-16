
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournament } from '../../store/TournamentContext';
import { useHistory } from '../../store/HistoryContext';
import { useNotifications } from '../../store/NotificationContext';
import { useAuth } from '../../store/AuthContext';
import { supabase } from '../../lib/supabase';
import { THEME } from '../../utils/theme';
import { Activity, TrendingUp, Award, Calendar, UserCircle, ArrowLeft, Clock, MapPin, ChevronRight } from 'lucide-react';
import { calculateDisplayRanking } from '../../utils/Elo';
import { Match } from '../../types';

const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const PlayerDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { state } = useTournament();
    const { pastTournaments } = useHistory();
    const { role, signOut, user } = useAuth();

    // ID del jugador simulado o real
    const [myPlayerId, setMyPlayerId] = useState<string>(() => {
        return localStorage.getItem('padel_sim_player_id') || '';
    });

    // REDIRECCIÓN AUTOMÁTICA PARA ADMINS
    // Excepto si están en modo preview desde SuperAdmin
    const isPreviewMode = sessionStorage.getItem('superadmin_preview') === 'player';
    useEffect(() => {
        if (!isPreviewMode && (role === 'admin' || role === 'superadmin')) {
            navigate('/dashboard', { replace: true });
        }
    }, [role, navigate, isPreviewMode]);

    useEffect(() => {
        if (myPlayerId) {
            localStorage.setItem('padel_sim_player_id', myPlayerId);
        }
    }, [myPlayerId]);

    const currentPlayer = state.players.find(p => p.id === myPlayerId);

    // Búsqueda automática de perfil de jugador vinculado al usuario de Supabase
    useEffect(() => {
        if (!myPlayerId && state.players.length > 0) {
            const autoPlayer = state.players.find(p => p.profile_user_id === user?.id || p.email === user?.email);
            if (autoPlayer) {
                setMyPlayerId(autoPlayer.id);
            }
        }
    }, [myPlayerId, state.players, user]);

    // Próximos partidos libres
    const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
    useEffect(() => {
        if (!myPlayerId) return;
        supabase
            .from('match_participants')
            .select('match_id, match:match_id(id, scheduled_at, status, court, level, share_token, max_players, title)')
            .eq('player_id', myPlayerId)
            .in('attendance_status', ['joined', 'confirmed'])
            .then(({ data }) => {
                if (!data) return;
                const now = new Date().toISOString();
                const upcoming = data
                    .map((row: any) => row.match)
                    .filter((m: any) => m && m.scheduled_at >= now && m.status !== 'cancelled')
                    .sort((a: any, b: any) => a.scheduled_at.localeCompare(b.scheduled_at))
                    .slice(0, 3) as Match[];
                setUpcomingMatches(upcoming);
            });
    }, [myPlayerId]);

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
    }, [currentPlayer, pastTournaments, state, myPlayerId]);

    // Si aún estamos determinando el rol o redirigiendo, mostramos loading invisible
    // Excepción: superadmin en modo preview
    if ((role === 'admin' || role === 'superadmin') && !isPreviewMode) return null;

    // Si el usuario llega aquí y no tiene perfil de jugador creado aún
    if (!currentPlayer) {
        return (
            <div className="p-8 min-h-screen flex flex-col justify-center items-center text-center bg-slate-50">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-indigo-500 mb-6">
                    <UserCircle size={32}/>
                </div>
                <h2 className="text-xl font-black text-slate-900 mb-2">Vinculando Perfil</h2>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed max-w-xs">
                    Estamos buscando tu ficha de jugador en el club. Si es tu primera vez, el administrador debe registrarte con tu email: <br/>
                    <span className="font-bold text-slate-800">{user?.email}</span>
                </p>
                <div className="w-full max-w-xs space-y-3">
                    <button onClick={() => window.location.reload()} className="w-full py-3 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-600">REINTENTAR</button>
                    <button onClick={() => signOut()} className="w-full py-3 text-rose-500 font-bold text-xs">CERRAR SESIÓN</button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-8 relative pb-24">
            {/* Banner modo preview superadmin */}
            {isPreviewMode && (
                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                    <span className="text-xs font-bold text-amber-700">👁 Modo preview — Vista jugador</span>
                    <button
                        onClick={() => { sessionStorage.removeItem('superadmin_preview'); navigate('/superadmin'); }}
                        className="flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-900"
                    >
                        <ArrowLeft size={14}/> Volver
                    </button>
                </div>
            )}

            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Hola de nuevo,</h1>
                    <h2 className="text-3xl font-black text-slate-900">{currentPlayer.nickname || currentPlayer.name.split(' ')[0]}</h2>
                </div>
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-lg font-black text-indigo-600 border-2 border-white shadow-sm">
                    {currentPlayer.name[0]}
                </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-xl bg-gradient-to-br from-[#2B2DBF] to-[#575AF9]">
                <div className="absolute top-0 right-0 p-6 opacity-20"><TrendingUp size={120} /></div>
                <div className="relative z-10">
                    <div className="text-emerald-300 font-bold text-xs uppercase tracking-widest mb-1 flex items-center gap-1"><Activity size={14}/> Ranking PadelPro</div>
                    <div className="text-6xl font-black tracking-tighter mb-2">{calculateDisplayRanking(currentPlayer)}</div>
                    <div className="inline-block bg-white/20 backdrop-blur-md px-3 py-1 rounded-lg text-xs font-bold border border-white/10">{currentPlayer.categories?.[0] || 'Iniciación'}</div>
                </div>
                <div className="relative z-10 mt-8 grid grid-cols-2 gap-4 pt-6 border-t border-white/10">
                    <div><div className="text-2xl font-black">{stats?.winRate}%</div><div className="text-[10px] text-indigo-200 uppercase font-bold">Victorias</div></div>
                    <div><div className="text-2xl font-black">{stats?.matches}</div><div className="text-[10px] text-indigo-200 uppercase font-bold">Partidos</div></div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => navigate('/p/tournaments')} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center gap-3 active:scale-95 transition-all"><div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Calendar size={24} /></div><span className="text-xs font-black text-slate-700 uppercase tracking-wider">Torneos</span></button>
                <button onClick={() => navigate('/p/profile')} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center gap-3 active:scale-95 transition-all"><div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center"><Award size={24} /></div><span className="text-xs font-black text-slate-700 uppercase tracking-wider">Historial</span></button>
            </div>

            {/* Próximos partidos */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Mis Próximos Partidos</h3>
                    <button
                        onClick={() => navigate('/p/matches/create')}
                        className="text-xs font-bold px-3 py-1.5 rounded-full text-white"
                        style={{ background: THEME.cta }}
                    >
                        + Crear
                    </button>
                </div>

                {upcomingMatches.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
                        <div className="text-3xl mb-2">🎾</div>
                        <p className="text-sm font-bold text-slate-500 mb-1">Sin partidos próximos</p>
                        <p className="text-xs text-slate-400">Crea uno y compártelo por WhatsApp</p>
                        <button
                            onClick={() => navigate('/p/matches/create')}
                            className="mt-4 px-5 py-2 rounded-full text-xs font-black text-white"
                            style={{ background: THEME.cta }}
                        >
                            Crear partido
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {upcomingMatches.map((m) => {
                            const d = new Date(m.scheduled_at);
                            const timeStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                            const dateStr = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
                            return (
                                <button
                                    key={m.id}
                                    onClick={() => navigate(`/m/${m.share_token}`)}
                                    className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3 active:scale-98 transition-all text-left"
                                >
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0"
                                        style={{ background: THEME.cta }}
                                    >
                                        {timeStr.slice(0, 5)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-slate-900 capitalize">{dateStr}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {m.court && <span className="text-xs text-slate-400 truncate flex items-center gap-1"><MapPin size={10}/>{m.court}</span>}
                                            {m.level && <span className="text-xs text-slate-400 truncate">{m.level}</span>}
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-300 shrink-0" />
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlayerDashboard;
