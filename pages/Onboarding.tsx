
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHistory } from '../store/HistoryContext';
import { THEME } from '../utils/theme';
import { Building, Check, UserCog, Users, Trophy, History, ArrowRight, LayoutGrid, Clock } from 'lucide-react';

const Onboarding: React.FC = () => {
    const navigate = useNavigate();
    const { updateClubData } = useHistory();
    
    // Phases: 'config' | 'tour'
    const [phase, setPhase] = useState<'config' | 'tour'>('config');
    const [tourStep, setTourStep] = useState(0);
    const [form, setForm] = useState({ name: '', courtCount: 6, address: '', phone: '' });

    const handleConfigSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateClubData(form);
        setPhase('tour');
    };

    const handleTourFinish = () => {
        navigate('/dashboard');
    };

    const tourSlides = [
        {
            title: "Configuración Inicial",
            text: "Acabas de configurar las pistas de tu club. El sistema usará este dato para saber si debe hacer turnos con descansos (menos de 8 pistas) o simultáneos.",
            icon: Building,
            color: "text-slate-800 bg-slate-100"
        },
        {
            title: "Jugadores vs Parejas",
            text: "Concepto Clave: Un 'Jugador' es permanente en tu club (con historial y ELO). Una 'Pareja' es temporal y solo existe para el torneo actual.",
            icon: Users,
            color: "text-blue-600 bg-blue-100"
        },
        {
            title: "Gestiona Torneos",
            text: "Crea eventos Mini 8, 10, 12 o 16. La app gestiona inscripciones, genera cruces automáticos (por Nivel o Mix) y controla los tiempos.",
            icon: Trophy,
            color: "text-amber-600 bg-amber-100"
        },
        {
            title: "Resultados en Vivo",
            text: "Durante el torneo, asigna pistas, introduce resultados y avanza rondas. Los jugadores podrán ver su clasificación y el cuadro en tiempo real.",
            icon: Clock,
            color: "text-emerald-600 bg-emerald-100"
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
            
            {phase === 'config' && (
                <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl animate-scale-in">
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4" style={{ color: THEME.cta }}>
                            <Building size={40} />
                        </div>
                        <h1 className="text-2xl font-black text-slate-900">Configura tu Club</h1>
                        <p className="text-slate-500 mt-2">Para organizar los torneos correctamente, necesitamos algunos datos básicos.</p>
                    </div>

                    <form onSubmit={handleConfigSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nombre del Club</label>
                            <input 
                                required
                                value={form.name}
                                onChange={e => setForm({...form, name: e.target.value})}
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#575AF9] font-bold text-lg"
                                placeholder="Ej. Padel Center"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Número de Pistas</label>
                            <input 
                                type="number"
                                min="1"
                                max="50"
                                required
                                value={form.courtCount}
                                onChange={e => setForm({...form, courtCount: parseInt(e.target.value) || 0})}
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#575AF9] font-bold text-lg text-center"
                            />
                            <p className="text-[10px] text-slate-400 mt-2 text-center">
                                Si tienes 8 o más pistas, los torneos de 16 parejas se jugarán sin descansos.
                            </p>
                        </div>

                        <button type="submit" style={{ backgroundColor: THEME.cta }} className="w-full py-4 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                            <Check size={20} /> Guardar y Continuar
                        </button>
                    </form>
                </div>
            )}

            {phase === 'tour' && (
                <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl animate-slide-left relative overflow-hidden min-h-[500px] flex flex-col justify-between text-center">
                    
                    <div className="pt-4">
                        {tourSlides.map((slide, idx) => {
                             if (idx !== tourStep) return null;
                             const Icon = slide.icon;
                             return (
                                 <div key={idx} className="animate-fade-in flex flex-col items-center">
                                     <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-8 shadow-sm ${slide.color}`}>
                                         <Icon size={48} />
                                     </div>
                                     <h2 className="text-2xl font-black text-slate-900 mb-4">{slide.title}</h2>
                                     <p className="text-slate-500 leading-relaxed text-lg max-w-xs mx-auto">
                                         {slide.text}
                                     </p>
                                 </div>
                             )
                        })}
                    </div>

                    <div className="flex flex-col gap-8 items-center mt-8">
                        <div className="flex gap-2">
                            {tourSlides.map((_, idx) => (
                                <div 
                                    key={idx} 
                                    className={`h-1.5 rounded-full transition-all duration-300 ${idx === tourStep ? 'bg-[#575AF9] w-8' : 'bg-slate-200 w-2'}`}
                                />
                            ))}
                        </div>

                        <button 
                            onClick={() => {
                                if (tourStep < tourSlides.length - 1) setTourStep(prev => prev + 1);
                                else handleTourFinish();
                            }}
                            style={{ backgroundColor: THEME.cta }}
                            className="w-full py-4 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                        >
                            {tourStep < tourSlides.length - 1 ? (
                                <>Siguiente <ArrowRight size={20} /></>
                            ) : (
                                <>¡Entendido, vamos!</>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Onboarding;
