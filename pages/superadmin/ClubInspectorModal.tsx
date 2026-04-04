import React from 'react';
import { Building, X, RefreshCw, Users, CalendarRange, Trophy, Activity, FilePlus, CheckCircle } from 'lucide-react';
import { ClubWithStats, InspectionStats } from './types';

interface ClubInspectorModalProps {
    club: ClubWithStats | null;
    inspectionStats: InspectionStats | null;
    loadingDetails: boolean;
    onClose: () => void;
}

const ClubInspectorModal: React.FC<ClubInspectorModalProps> = ({ club, inspectionStats, loadingDetails, onClose }) => {
    if (!club) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-5xl shadow-2xl flex flex-col animate-scale-in overflow-hidden">
                {/* Header */}
                <div className="bg-slate-900 p-8 text-white flex justify-between items-center shrink-0">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <Building size={24} className="text-emerald-400"/>
                            <h2 className="text-2xl font-black">{club.name}</h2>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <p className="text-slate-400 text-xs font-mono">Owner ID: {club.owner_id}</p>
                            <p className="text-emerald-400 text-xs font-bold">{club.ownerEmail}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                        <X size={24}/>
                    </button>
                </div>

                {/* Content */}
                <div className="p-10 bg-slate-50">
                    {loadingDetails || !inspectionStats ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <RefreshCw size={40} className="animate-spin text-emerald-500"/>
                            <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">Calculando Estadísticas...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* Players */}
                            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 flex flex-col items-center text-center relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-2 bg-blue-500"/>
                                <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6">
                                    <Users size={40}/>
                                </div>
                                <div className="text-6xl font-black text-slate-800 mb-2">{inspectionStats.players}</div>
                                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Jugadores Totales</div>
                                <p className="mt-6 text-xs text-slate-400 px-4">Base de datos acumulada de jugadores registrados en el club.</p>
                            </div>

                            {/* Leagues */}
                            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 flex flex-col relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-2 bg-indigo-500"/>
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                                        <CalendarRange size={28}/>
                                    </div>
                                    <div>
                                        <div className="text-3xl font-black text-slate-800">{inspectionStats.leagues.total}</div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ligas Totales</div>
                                    </div>
                                </div>
                                <div className="space-y-3 flex-1">
                                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600"><FilePlus size={14} className="text-slate-400"/> En Registro</div>
                                        <span className="font-black text-slate-800">{inspectionStats.leagues.setup}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-700"><Activity size={14}/> Activas</div>
                                        <span className="font-black text-indigo-700">{inspectionStats.leagues.active}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600"><CheckCircle size={14} className="text-slate-400"/> Finalizadas</div>
                                        <span className="font-black text-slate-800">{inspectionStats.leagues.finished}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Minis */}
                            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 flex flex-col relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-2 bg-amber-500"/>
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                                        <Trophy size={28}/>
                                    </div>
                                    <div>
                                        <div className="text-3xl font-black text-slate-800">{inspectionStats.minis.total}</div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Minis Totales</div>
                                    </div>
                                </div>
                                <div className="space-y-3 flex-1">
                                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600"><FilePlus size={14} className="text-slate-400"/> En Preparación</div>
                                        <span className="font-black text-slate-800">{inspectionStats.minis.setup}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-amber-50 rounded-xl border border-amber-100">
                                        <div className="flex items-center gap-2 text-xs font-bold text-amber-700"><Activity size={14}/> En Juego</div>
                                        <span className="font-black text-amber-700">{inspectionStats.minis.active}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600"><CheckCircle size={14} className="text-slate-400"/> Finalizados</div>
                                        <span className="font-black text-slate-800">{inspectionStats.minis.finished}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-white border-t border-slate-200 flex justify-end">
                    <button onClick={onClose} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black shadow-lg hover:bg-slate-800 transition-colors">CERRAR INFORME</button>
                </div>
            </div>
        </div>
    );
};

export default ClubInspectorModal;
