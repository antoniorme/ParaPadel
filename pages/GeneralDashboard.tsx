
import React, { useEffect } from 'react';
import { useTournament } from '../store/TournamentContext';
import { useLeague } from '../store/LeagueContext';
import { useHistory } from '../store/HistoryContext';
import { THEME } from '../utils/theme';
import {
    ChevronRight, Trophy, CalendarRange, Activity, Users,
    FileText, Smartphone, CalendarDays, Lock, Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ── CTA card shown when a module is not enabled ───────────────────────────────
interface LockedCardProps {
    title: string;
    subtitle: string;
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    description: string;
    features: string[];
    accentColor: string;
}

const LockedModuleCard: React.FC<LockedCardProps> = ({
    title, subtitle, icon: Icon, iconBg, iconColor, description, features, accentColor
}) => {
    const handleContact = () => {
        const msg = encodeURIComponent(
            `Hola, me interesa activar el módulo *${title}* en mi club de ParaPádel. ¿Me podéis dar más info?`
        );
        window.open(`https://wa.me/34600000000?text=${msg}`, '_blank');
    };

    return (
        <div className="bg-white p-6 rounded-[2rem] border-2 border-dashed border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between opacity-90 hover:opacity-100 transition-opacity">
            {/* lock badge */}
            <div className="absolute top-4 right-4 flex items-center gap-1 bg-slate-100 text-slate-400 text-[9px] font-black uppercase px-2 py-1 rounded-full border border-slate-200">
                <Lock size={10}/> No activado
            </div>

            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-5">
                    <div className={`w-14 h-14 ${iconBg} rounded-2xl flex items-center justify-center`}>
                        <Icon size={28} className={iconColor}/>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-400">{title}</h3>
                        <p className="text-xs text-slate-300 font-bold uppercase tracking-wider">{subtitle}</p>
                    </div>
                </div>

                <p className="text-slate-400 text-sm mb-4">{description}</p>

                <ul className="space-y-1.5 mb-6">
                    {features.map(f => (
                        <li key={f} className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                            <span className={`w-4 h-4 rounded-full ${accentColor} flex items-center justify-center shrink-0`}>
                                <Check size={10} className="text-white" strokeWidth={3}/>
                            </span>
                            {f}
                        </li>
                    ))}
                </ul>
            </div>

            <button
                onClick={handleContact}
                className="w-full py-4 bg-slate-100 text-slate-500 rounded-xl font-bold text-sm border-2 border-dashed border-slate-200 hover:bg-slate-200 hover:text-slate-700 transition-all flex items-center justify-center gap-2 mt-auto"
            >
                <Lock size={16}/> SOLICITAR ACTIVACIÓN
            </button>
        </div>
    );
};

// ── Main dashboard ────────────────────────────────────────────────────────────
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
    const setupMinis  = allMinis.filter(t => t.status === 'setup');

    // LEAGUE STATS
    const activeLeagues  = leaguesList.filter(l => l.status === 'groups' || l.status === 'playoffs');
    const totalLeaguePairs = leaguesList.reduce((acc, l) => acc + (l.pairsCount || 0), 0);

    const showMinisFull  = clubData.minis_full_enabled !== false;
    const showMinisLite  = clubData.minis_lite_enabled === true;
    const showLeague     = clubData.league_enabled === true;
    const showCourts     = clubData.courts_enabled === true;

    return (
        <div className="space-y-8 pb-20 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-900">Panel de Control</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* ── MINIS FULL ───────────────────────────────────────────── */}
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
                                Gestiona torneos rápidos de 8, 10, 12 o 16 parejas. Sorteos automáticos y directo en vivo.
                            </p>
                        </div>
                        <div className="mt-auto relative z-10">
                            <button className="w-full py-4 bg-[#575AF9] text-white rounded-xl font-bold text-sm shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                                GESTIONAR MINIS <ChevronRight size={16}/>
                            </button>
                        </div>
                    </div>
                )}

                {/* ── MINIS LITE ───────────────────────────────────────────── */}
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
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-2xl font-black text-slate-900">Minis</h3>
                                        <span className="text-[9px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">LITE</span>
                                    </div>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Gestión Simplificada</p>
                                </div>
                            </div>
                            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-6">
                                <p className="text-emerald-800 text-sm font-medium">
                                    Versión optimizada para gestión rápida desde móvil. Crea torneos y comparte resultados al instante.
                                </p>
                            </div>
                        </div>
                        <div className="mt-auto relative z-10">
                            <button className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2">
                                ACCEDER A LITE <ChevronRight size={16}/>
                            </button>
                        </div>
                    </div>
                )}

                {/* ── LIGAS — activa ───────────────────────────────────────── */}
                {showLeague && (
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
                            <button className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                                GESTIONAR LIGAS <ChevronRight size={16}/>
                            </button>
                        </div>
                    </div>
                )}

                {/* ── LIGAS — bloqueada ─────────────────────────────────────── */}
                {!showLeague && (
                    <LockedModuleCard
                        title="Ligas"
                        subtitle="Larga Duración"
                        icon={CalendarRange}
                        iconBg="bg-emerald-50"
                        iconColor="text-emerald-300"
                        description="Gestiona competiciones de varios meses con jornadas, grupos y playoffs."
                        features={[
                            'Clasificaciones automáticas',
                            'Sistema de grupos + playoffs',
                            'Jornadas y calendario',
                            'Seguimiento de ELO por liga',
                        ]}
                        accentColor="bg-emerald-400"
                    />
                )}

                {/* ── PISTAS — activa ───────────────────────────────────────── */}
                {showCourts && (
                    <div
                        onClick={() => navigate('/courts')}
                        className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-lg relative overflow-hidden group hover:border-violet-500/50 transition-all cursor-pointer flex flex-col justify-between"
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-500">
                            <CalendarDays size={140} className="text-violet-500"/>
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-14 h-14 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center">
                                    <CalendarDays size={28}/>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900">Pistas</h3>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Calendario de Reservas</p>
                                </div>
                            </div>
                            <div className="bg-violet-50 p-4 rounded-xl border border-violet-100 mb-6">
                                <p className="text-violet-800 text-sm font-medium">
                                    Gestiona la disponibilidad de tus pistas, acepta reservas y coordina por WhatsApp.
                                </p>
                            </div>
                        </div>
                        <div className="mt-auto relative z-10">
                            <button className="w-full py-4 bg-violet-600 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-violet-700 transition-colors flex items-center justify-center gap-2">
                                GESTIONAR PISTAS <ChevronRight size={16}/>
                            </button>
                        </div>
                    </div>
                )}

                {/* ── PISTAS — bloqueada ────────────────────────────────────── */}
                {!showCourts && (
                    <LockedModuleCard
                        title="Pistas"
                        subtitle="Calendario de Reservas"
                        icon={CalendarDays}
                        iconBg="bg-violet-50"
                        iconColor="text-violet-300"
                        description="Calendario de reservas estilo Playtomic. Tus jugadores reservan, tú confirmas."
                        features={[
                            'Slots de 60 y 90 minutos',
                            'Hasta 12 pistas simultáneas',
                            'Integración con WhatsApp',
                            'Confirmación por el admin',
                        ]}
                        accentColor="bg-violet-400"
                    />
                )}

            </div>
        </div>
    );
};

export default GeneralDashboard;
