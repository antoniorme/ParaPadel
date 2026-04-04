
import React from 'react';
import { THEME } from '../utils/theme';
import { ArrowUpCircle, ArrowDownCircle, Activity } from 'lucide-react';

interface LevelProgressBarProps {
    elo: number;
    rangeMin?: number;
    rangeMax?: number;
    showLabel?: boolean;
}

export const LevelProgressBar: React.FC<LevelProgressBarProps> = ({ elo, rangeMin, rangeMax, showLabel = true }) => {
    // If range is not provided, dynamic 1000 point block
    const effectiveMin = rangeMin !== undefined ? rangeMin : Math.floor(elo / 1000) * 1000;
    const effectiveMax = rangeMax !== undefined ? rangeMax : effectiveMin + 1000;

    let progressPercent = 0;
    let barColor = THEME.cta;
    let statusLabel = null;

    if (elo > effectiveMax) {
        progressPercent = 100;
        barColor = '#F59E0B'; // Amber/Gold for "Over"
        statusLabel = (
            <div className="text-[9px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                <ArrowUpCircle size={10}/> SUPERIOR
            </div>
        );
    } else if (elo < effectiveMin) {
        progressPercent = 5; // Minimal bar
        barColor = '#EF4444'; // Red for "Under"
        statusLabel = (
            <div className="text-[9px] font-black text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                <ArrowDownCircle size={10}/> INFERIOR
            </div>
        );
    } else {
        progressPercent = Math.max(5, Math.min(100, ((elo - effectiveMin) / (effectiveMax - effectiveMin)) * 100));
    }

    return (
        <div className="w-full">
            {showLabel && (
                <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <Activity size={10} className="text-slate-400"/> Media {elo}
                    </div>
                    {statusLabel}
                </div>
            )}
            
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden flex relative">
                <div 
                    className="h-full rounded-full transition-all duration-500" 
                    style={{ 
                        width: `${progressPercent}%`, 
                        backgroundColor: barColor 
                    }}
                ></div>
            </div>
            
            <div className="flex justify-between mt-1 text-[9px] text-slate-400 font-mono">
                <span>{effectiveMin}</span>
                <span>{effectiveMax}</span>
            </div>
        </div>
    );
};
