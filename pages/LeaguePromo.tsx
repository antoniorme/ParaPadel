
import React from 'react';
import { CalendarRange, CheckCircle, Trophy, Users, ShieldCheck, Zap, ArrowRight, MessageCircle } from 'lucide-react';
import { THEME } from '../utils/theme';

const LeaguePromo: React.FC = () => {
    const features = [
        { title: "Fases Dinámicas", desc: "Gestión automática de Fase de Grupos y Cuadros Finales.", icon: Zap },
        { title: "Puntuación 3-1-0", desc: "Sistema profesional que premia la competitividad en cada set.", icon: Zap },
        { title: "Gestión de Categorías", desc: "Crea desde 1ª hasta Iniciación con premios independientes.", icon: Zap },
        { title: "Directorio de Capitanes", desc: "Acceso rápido a teléfonos y WhatsApp para coordinar partidos.", icon: Zap },
    ];

    const openWhatsApp = () => {
        window.open('https://wa.me/34600000000?text=Hola!%20Me%20gustaria%20activar%20el%20modulo%20de%20Ligas%20para%20mi%20club.', '_blank');
    };

    return (
        <div className="space-y-8 pb-20 animate-fade-in">
            {/* Hero Section */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-indigo-200 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 text-indigo-50/50">
                    <CalendarRange size={240} />
                </div>
                
                <div className="relative z-10">
                    <span className="inline-block bg-indigo-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest mb-4">
                        Módulo Profesional
                    </span>
                    <h2 className="text-4xl font-black text-slate-900 leading-none mb-4">
                        Eleva tu club con <br/>
                        <span className="text-indigo-500">Ligas Premium</span>
                    </h2>
                    <p className="text-slate-500 font-medium text-lg max-w-sm mb-8">
                        Organiza competiciones de larga duración con la misma facilidad que tus minis. Control total, cero caos.
                    </p>
                    
                    <button 
                        onClick={openWhatsApp}
                        className="flex items-center gap-3 px-8 py-4 bg-indigo-500 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 active:scale-95 transition-all hover:bg-indigo-600"
                    >
                        SOLICITAR ACTIVACIÓN <ArrowRight size={20}/>
                    </button>
                </div>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {features.map((f, i) => (
                    <div key={i} className="bg-white/20 backdrop-blur-md border border-white/30 p-6 rounded-3xl flex gap-4 items-start shadow-sm">
                        <div className="bg-white p-2 rounded-xl text-indigo-500 shadow-sm">
                            <f.icon size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white drop-shadow-sm">{f.title}</h4>
                            <p className="text-indigo-50 text-sm mt-1 leading-relaxed">{f.desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Summary */}
            <div className="bg-white rounded-[2rem] p-6 shadow-lg border border-slate-100">
                <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                    <ShieldCheck className="text-emerald-500" size={24}/> ¿Por qué profesionalizar tu liga?
                </h3>
                <div className="space-y-4">
                    {[
                        "Desempates automáticos por enfrentamiento directo.",
                        "Seguimiento de meses con histórico detallado.",
                        "Generación de Brackets finales en un click.",
                        "Exportación de resultados lista para Instagram."
                    ].map((text, i) => (
                        <div key={i} className="flex gap-3 items-center text-slate-600 font-medium">
                            <CheckCircle size={18} className="text-emerald-500 shrink-0"/>
                            <span>{text}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Secondary CTA */}
            <div className="text-center py-6">
                <button 
                    onClick={openWhatsApp}
                    className="inline-flex items-center gap-2 text-white font-bold hover:underline drop-shadow-sm"
                >
                    <MessageCircle size={20}/> Hablar con un asesor ahora
                </button>
            </div>
        </div>
    );
};

export default LeaguePromo;
