import React from 'react';
import { Check, Lock, Mail, Eye, Users, Trophy, CalendarRange, Smartphone, History, Edit2, Send, Power, CalendarDays } from 'lucide-react';
import { ClubWithStats } from './types';

interface ClubCardProps {
    club: ClubWithStats;
    onInspect: (club: ClubWithStats) => void;
    onToggleStatus: (club: ClubWithStats) => void;
    onToggleModule: (clubId: string, field: string, current: boolean) => void;
    onEdit: (club: ClubWithStats) => void;
    onResendEmail: (club: ClubWithStats) => void;
}

const ClubCard: React.FC<ClubCardProps> = ({
    club, onInspect, onToggleStatus, onToggleModule, onEdit, onResendEmail
}) => {
    const ModuleToggle = ({
        field, value, color, icon: Icon, label
    }: { field: string; value: boolean; color: string; icon: React.FC<any>; label: string }) => (
        <button
            onClick={() => onToggleModule(club.id, field, value)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border shadow-sm transition-all flex-1 ${value ? `bg-${color}-50 border-${color}-200` : 'bg-white border-slate-200 grayscale opacity-60 hover:opacity-100 hover:grayscale-0'}`}
        >
            <Icon size={14} className={value ? `text-${color}-600` : 'text-slate-400'}/>
            <span className={`text-xs font-bold flex-1 text-left ${value ? `text-${color}-700` : 'text-slate-500'}`}>{label}</span>
            <div className={`w-3 h-3 rounded-full border ${value ? `bg-${color}-500 border-${color}-600` : 'bg-slate-200 border-slate-300'}`}/>
        </button>
    );

    return (
        <div className={`bg-white rounded-3xl shadow-sm border-2 overflow-hidden transition-all relative ${club.is_active ? 'border-slate-100' : 'border-rose-100 opacity-80'}`}>
            <div className={`h-2 w-full ${club.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`}/>

            <div className="p-6">
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            {club.is_active ? (
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 flex items-center gap-1">
                                    <Check size={10} strokeWidth={4}/> Activo
                                </span>
                            ) : (
                                <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100 flex items-center gap-1">
                                    <Lock size={10} strokeWidth={4}/> Bloqueado
                                </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-mono">ID: {club.id.substring(0, 6)}...</span>
                        </div>
                        <h2 className="text-xl font-black text-slate-900 leading-tight">{club.name}</h2>
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-1 font-medium truncate">
                            <Mail size={12}/> {club.ownerEmail || 'Sin email'}
                        </div>
                    </div>
                    <button onClick={() => onInspect(club)} className="p-3 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" title="Ver Detalles">
                        <Eye size={20}/>
                    </button>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-2 mb-6">
                    <div className="flex flex-col items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <Users size={16} className="text-slate-400 mb-1"/>
                        <div className="text-lg font-black text-slate-800">{club.playerCount}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase">Jugadores</div>
                    </div>
                    <div className="flex flex-col items-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <Trophy size={16} className="text-emerald-500 mb-1"/>
                        <div className="text-lg font-black text-emerald-700">{club.activeTourneys}</div>
                        <div className="text-[9px] font-bold text-emerald-600 uppercase">Minis Act.</div>
                    </div>
                    <div className="flex flex-col items-center p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                        <CalendarRange size={16} className="text-indigo-500 mb-1"/>
                        <div className="text-lg font-black text-indigo-700">{club.activeLeagues}</div>
                        <div className="text-[9px] font-bold text-indigo-600 uppercase">Ligas Act.</div>
                    </div>
                </div>

                {/* Modules */}
                <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Módulos Contratados</span>
                    <div className="flex gap-2 flex-wrap">
                        <ModuleToggle field="minis_full_enabled" value={club.minis_full_enabled !== false} color="blue" icon={Trophy} label="Minis"/>
                        <ModuleToggle field="minis_lite_enabled" value={!!club.minis_lite_enabled} color="emerald" icon={Smartphone} label="Lite"/>
                        <ModuleToggle field="league_enabled" value={!!club.league_enabled} color="indigo" icon={CalendarRange} label="Ligas"/>
                        <ModuleToggle field="courts_enabled" value={!!club.courts_enabled} color="violet" icon={CalendarDays} label="Pistas"/>
                    </div>
                </div>

                {/* Visibility */}
                <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Visibilidad Menú</span>
                    <div className="flex gap-2">
                        <ModuleToggle field="show_players" value={club.show_players !== false} color="emerald" icon={Users} label="Jugadores"/>
                        <ModuleToggle field="show_history" value={club.show_history !== false} color="amber" icon={History} label="Historial"/>
                    </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                    <button onClick={() => onEdit(club)} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white border-2 border-slate-100 text-slate-600 font-bold text-xs hover:border-slate-300 transition-colors">
                        <Edit2 size={14}/> Editar Datos
                    </button>
                    <div className="flex gap-2">
                        <button onClick={() => onResendEmail(club)} className="flex-1 flex items-center justify-center py-3 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold transition-colors" title="Reenviar Acceso">
                            <Send size={16}/>
                        </button>
                        <button onClick={() => onToggleStatus(club)} className={`flex-1 flex items-center justify-center py-3 rounded-xl font-bold transition-colors ${club.is_active ? 'bg-rose-50 text-rose-500 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`} title={club.is_active ? "Bloquear" : "Reactivar"}>
                            <Power size={16}/>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClubCard;
