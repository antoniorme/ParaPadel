
import React, { useState } from 'react';
import { Trophy, Share2, X, Download, Instagram, Camera, Star, Award } from 'lucide-react';
import { useHistory } from '../store/HistoryContext';

interface PosterProps {
    isOpen: boolean;
    onClose: () => void;
    data: {
        title: string;
        winnerNames: string;
        category?: string;
        clubName?: string;
        type: 'champions' | 'podium' | 'promo';
    };
}

export const PosterGenerator: React.FC<PosterProps> = ({ isOpen, onClose, data }) => {
    const { clubData } = useHistory();
    const [theme, setTheme] = useState<'dark' | 'blue' | 'gold'>('gold');

    if (!isOpen) return null;

    const themes = {
        gold: 'from-amber-500 via-yellow-600 to-amber-900',
        dark: 'from-slate-800 via-slate-900 to-black',
        blue: 'from-indigo-600 via-blue-700 to-slate-900'
    };

    return (
        <div className="fixed inset-0 z-[300] bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in overflow-y-auto">
            <div className="w-full max-w-md flex justify-between items-center mb-6">
                <div className="flex gap-2">
                    <button onClick={() => setTheme('gold')} className={`w-8 h-8 rounded-full bg-amber-500 border-2 ${theme === 'gold' ? 'border-white' : 'border-transparent'}`}></button>
                    <button onClick={() => setTheme('dark')} className={`w-8 h-8 rounded-full bg-slate-800 border-2 ${theme === 'dark' ? 'border-white' : 'border-transparent'}`}></button>
                    <button onClick={() => setTheme('blue')} className={`w-8 h-8 rounded-full bg-blue-600 border-2 ${theme === 'blue' ? 'border-white' : 'border-transparent'}`}></button>
                </div>
                <button onClick={onClose} className="p-2 bg-white/10 text-white rounded-full"><X size={24}/></button>
            </div>

            {/* Canvas - Screenshot Target */}
            <div id="poster-canvas" className={`w-full max-w-[360px] aspect-[9/16] bg-gradient-to-b ${themes[theme]} rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col p-8 text-white border-8 border-white/5`}>
                
                {/* Background Decor */}
                <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-white rounded-full blur-[80px]"></div>
                    <div className="absolute bottom-40 -left-20 w-48 h-48 bg-amber-400 rounded-full blur-[60px]"></div>
                </div>

                {/* Club Identity */}
                <div className="relative z-10 flex flex-col items-center mt-12">
                    {clubData.logoUrl ? (
                        <img src={clubData.logoUrl} className="w-20 h-20 object-contain mb-4 rounded-2xl bg-white/10 p-2" />
                    ) : (
                        <Trophy size={48} className="text-white/50 mb-4" />
                    )}
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">{clubData.name}</span>
                </div>

                {/* Main Content */}
                <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="space-y-1">
                        <span className="bg-white/20 backdrop-blur-md px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20">
                            {data.category || 'Categoría Única'}
                        </span>
                        <h2 className="text-4xl font-black italic tracking-tighter leading-none pt-4">
                            {data.type === 'champions' ? 'GRANDES' : 'FINAL'} <br/>
                            <span className="text-amber-300 drop-shadow-lg">CAMPEONES</span>
                        </h2>
                    </div>

                    <div className="w-full h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>

                    <div className="space-y-4">
                        <Award size={64} className="mx-auto text-amber-300 animate-bounce" />
                        <div className="text-2xl font-black px-4 leading-tight">
                            {data.winnerNames.split('&').map((name, i) => (
                                <div key={i} className="drop-shadow-md">{name.trim()}</div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="relative z-10 text-center pb-8">
                    <div className="text-[10px] font-bold opacity-60 uppercase mb-1">{data.title}</div>
                    <div className="text-[12px] font-black tracking-widest italic">#PADELPRO #TOUR</div>
                </div>

                {/* Glassmorphism Watermark */}
                <div className="absolute bottom-4 right-4 bg-white/10 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 text-[8px] font-black tracking-tighter opacity-50">
                    POWERED BY PADELPRO
                </div>
            </div>

            {/* Actions */}
            <div className="mt-8 grid grid-cols-1 gap-4 w-full max-w-[360px]">
                <div className="bg-white/10 p-4 rounded-2xl border border-white/10 flex items-start gap-3">
                    <Camera size={20} className="text-amber-400 shrink-0"/>
                    <p className="text-xs text-white/70">Haz una <b>captura de pantalla</b> para compartirlo directamente en tus Stories de Instagram.</p>
                </div>
                <button className="flex items-center justify-center gap-2 py-4 bg-indigo-500 text-white rounded-2xl font-bold shadow-xl active:scale-95 transition-all">
                    <Share2 size={20}/> COMPARTIR SOCIAL KIT
                </button>
            </div>
        </div>
    );
};
