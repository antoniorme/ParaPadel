
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeague } from '../store/LeagueContext';
import { THEME } from '../utils/theme';
import { 
    Calendar, Trophy, Plus, X, ArrowLeft, Save, 
    Gift, ChevronRight, Info, AlertCircle, Settings2,
    CalendarDays
} from 'lucide-react';

const LeagueSetup: React.FC = () => {
    const navigate = useNavigate();
    const { createLeague } = useLeague();
    
    const [title, setTitle] = useState('');
    const [startDate, setStartDate] = useState('2024-01-12');
    const [endDate, setEndDate] = useState('2024-04-15');
    const [playoffDate, setPlayoffDate] = useState('2024-04-17');
    
    // Single Category Prizes
    const [prizeWinner, setPrizeWinner] = useState('');
    const [prizeRunnerUp, setPrizeRunnerUp] = useState('');

    const handleSave = async () => {
        if (!title) return alert("Ponle un nombre a la liga");
        
        await createLeague({
            title,
            startDate,
            endDate,
            playoffDate,
            prizeWinner,
            prizeRunnerUp
        });
        
        navigate('/league');
    };

    return (
        <div className="space-y-8 pb-32 animate-fade-in">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/league')} className="p-2 bg-white/20 text-white rounded-full hover:bg-white/30 transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-black text-white">Configurar Nueva Liga</h2>
            </div>

            {/* Ficha Principal */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-indigo-200 space-y-8">
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre de la Competición (Ej. 1ª División)</label>
                    <input 
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Ej. Liga 2ª Categoría Invierno"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 mt-1.5 text-slate-900 font-bold text-xl outline-none focus:border-indigo-400 transition-all"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Calendar size={14} className="text-indigo-400"/> Inicio Liga
                        </label>
                        <input 
                            type="date" 
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-700 outline-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Calendar size={14} className="text-rose-400"/> Fin Liga
                        </label>
                        <input 
                            type="date" 
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-700 outline-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
                            <Trophy size={14} /> Fase Final
                        </label>
                        <input 
                            type="date" 
                            value={playoffDate}
                            onChange={e => setPlayoffDate(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-700 outline-none"
                        />
                    </div>
                </div>

                <div className="bg-indigo-50 rounded-2xl p-4 flex gap-3 items-start border border-indigo-100">
                    <Info className="text-indigo-500 shrink-0" size={20}/>
                    <p className="text-xs text-indigo-700 leading-relaxed font-medium">
                        La fase regular se jugará entre el <strong>{new Date(startDate).toLocaleDateString()}</strong> y el <strong>{new Date(endDate).toLocaleDateString()}</strong>.
                    </p>
                </div>
            </div>

            {/* Premios Directos */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-indigo-200 animate-slide-up">
                <div className="flex items-center gap-2 mb-6">
                    <Gift className="text-amber-500" size={24}/>
                    <h3 className="text-lg font-black text-slate-900">Premios</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100">
                        <label className="text-[9px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1 mb-2">
                            Premio Campeones
                        </label>
                        <input 
                            value={prizeWinner}
                            onChange={e => setPrizeWinner(e.target.value)}
                            placeholder="Ej. Pala Bullpadel Hack"
                            className="w-full bg-white border border-amber-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none"
                        />
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-2">
                            Premio Subcampeones
                        </label>
                        <input 
                            value={prizeRunnerUp}
                            onChange={e => setPrizeRunnerUp(e.target.value)}
                            placeholder="Ej. Equipación Técnica"
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Guardar */}
            <div className="pt-6">
                <button 
                    onClick={handleSave}
                    className="w-full py-6 bg-white text-indigo-500 rounded-[1.5rem] font-black text-lg shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                    <Save size={24}/> CREAR LIGA Y CONTINUAR
                </button>
            </div>
        </div>
    );
};

export default LeagueSetup;
