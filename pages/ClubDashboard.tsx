
import React, { useEffect, useState } from 'react';
import { useTournament } from '../store/TournamentContext';
import { useHistory } from '../store/HistoryContext';
import { THEME, getFormatColor } from '../utils/theme';
import { Calendar, Users, Plus, ChevronRight, Swords, LayoutGrid } from 'lucide-react';
import { EmptyState, StatCard } from '../components';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const ClubDashboard: React.FC = () => {
    const { state, fetchTournamentList, selectTournament } = useTournament();
    const { clubData } = useHistory();
    const navigate = useNavigate();

    const [openMatchCount, setOpenMatchCount] = useState<number | null>(null);
    const [courtsStats, setCourtsStats] = useState<{ occupied: number; total: number } | null>(null);

    useEffect(() => {
        fetchTournamentList();
    }, [fetchTournamentList]);

    // Cargar stats de partidos abiertos y pistas de hoy
    useEffect(() => {
        if (!clubData.id) return;
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // Partidos abiertos
        supabase
            .from('free_matches')
            .select('id', { count: 'exact', head: true })
            .eq('club_id', clubData.id)
            .eq('status', 'open')
            .gte('scheduled_at', todayStart.toISOString())
            .then(({ count }) => setOpenMatchCount(count ?? 0));

        // Pistas ocupadas hoy (reservas activas)
        if (clubData.courts_enabled) {
            supabase
                .from('court_reservations')
                .select('court_number')
                .eq('club_id', clubData.id)
                .not('status', 'in', '("rejected","cancelled")')
                .gte('start_at', todayStart.toISOString())
                .lte('start_at', todayEnd.toISOString())
                .then(({ data }) => {
                    const uniqueCourts = new Set((data || []).map((r: any) => r.court_number));
                    setCourtsStats({ occupied: uniqueCourts.size, total: clubData.courtCount || 0 });
                });
        }
    }, [clubData.id, clubData.courts_enabled, clubData.courtCount]);

    const handleSelect = async (id: string) => {
        await selectTournament(id);
        navigate('/active');
    };

    const activeTournaments = state.tournamentList.filter(t => t.status !== 'finished');

    return (
        <div className="space-y-6 pb-20 animate-fade-in">
            {/* Quick stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                    value={openMatchCount ?? '—'}
                    label="Partidos abiertos"
                    icon={<Swords size={18} />}
                    onClick={() => navigate('/partidos')}
                />
                {clubData.courts_enabled && courtsStats !== null ? (
                    <StatCard
                        value={`${courtsStats.occupied}/${courtsStats.total}`}
                        label="Pistas ocupadas hoy"
                        icon={<LayoutGrid size={18} />}
                        onClick={() => navigate('/courts')}
                    />
                ) : (
                    <StatCard
                        value={activeTournaments.length}
                        label="Torneos activos"
                        icon={<Calendar size={18} />}
                        onClick={() => navigate('/minis')}
                    />
                )}
            </div>

            {/* Torneos */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-black text-white">Mis Torneos</h2>
                    <button
                        onClick={() => navigate('/setup')}
                        style={{ backgroundColor: THEME.cta }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-sm shadow-lg active:scale-95 transition-transform hover:opacity-90"
                    >
                        <Plus size={20}/> NUEVO
                    </button>
                </div>

                {activeTournaments.length === 0 ? (
                    <EmptyState
                        icon={<Calendar size={32}/>}
                        title="No hay torneos activos"
                        body="Crea un torneo para empezar a gestionar inscripciones y el directo."
                        action={{ label: 'CREAR PRIMER TORNEO', onClick: () => navigate('/setup') }}
                        dark
                    />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeTournaments.map(t => {
                            const formatColor = getFormatColor(t.format);
                            const isSetup = t.status === 'setup';
                            return (
                                <div
                                    key={t.id}
                                    onClick={() => handleSelect(t.id)}
                                    className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden cursor-pointer hover:border-[#575AF9]/50 transition-all group relative"
                                >
                                    <div className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="w-3/4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className={`w-2.5 h-2.5 rounded-full ${isSetup ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]' : 'bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`}></span>
                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${isSetup ? 'text-orange-400' : 'text-rose-400'}`}>
                                                        {isSetup ? 'Inscripción Abierta' : 'Torneo en Directo'}
                                                    </span>
                                                </div>
                                                <h3 className="font-black text-white text-xl leading-tight group-hover:text-[#575AF9] transition-colors truncate">{t.title}</h3>
                                                <div className="flex items-center gap-1.5 mt-2 text-slate-400 text-xs font-bold">
                                                    <Calendar size={14} className="text-slate-500"/>
                                                    {new Date(t.date).toLocaleDateString('es-ES', {weekday: 'long', day: 'numeric', month: 'short'}).toUpperCase()}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-center justify-center bg-slate-800 rounded-2xl p-3 min-w-[70px] border border-slate-700 shadow-inner">
                                                <span className="text-2xl font-black text-white leading-none">{t.playerCount || 0}</span>
                                                <span className="text-[9px] font-black uppercase text-slate-400 mt-1">Parejas</span>
                                            </div>
                                        </div>
                                        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                                            <span style={{
                                                color: '#fff',
                                                backgroundColor: isSetup ? '#334155' : '#1e293b',
                                                borderColor: formatColor
                                            }} className="text-[10px] font-black px-3 py-1.5 rounded-xl border-2 uppercase tracking-wider shadow-sm">
                                                {t.format.replace('_mini', '').toUpperCase()} PAREJAS
                                            </span>
                                            {isSetup ? (
                                                <span className="text-xs font-black text-slate-400 flex items-center gap-1 group-hover:text-[#575AF9] transition-colors">
                                                    GESTIONAR <ChevronRight size={16}/>
                                                </span>
                                            ) : (
                                                <span className="text-xs font-black text-rose-400 flex items-center gap-1 group-hover:underline">
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
            </div>
        </div>
    );
};

export default ClubDashboard;
