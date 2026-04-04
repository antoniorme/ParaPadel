import { TournamentFormat } from '../types';

export const COLORS = {
    primary: '#2B2DBF',         // Corporate Blue (Standard) - Mini 10
    primaryDark: '#14169C',     // Darker Blue - Mini 12
    primaryVeryDark: '#171852', // Very Dark Blue - Mini 16
    cta: '#575AF9',             // CTA / Action Blue (Bright) - Buttons & Accents
    mini8Tone: '#3F42E0',       // Specific tone for Mini 8 (Distinct from CTA)
    secondary: '#EEFF00',       // Yellow Accent
};

export const THEME = {
    ...COLORS,
    // Alias for backward compatibility or semantic naming
    primaryLight: COLORS.cta 
};

export const getFormatColor = (format: TournamentFormat) => {
    switch (format) {
        case '16_mini': return COLORS.primaryVeryDark; // #171852
        case '12_mini': return COLORS.primaryDark;     // #14169C
        case '10_mini': return COLORS.primary;         // #2B2DBF
        case '8_mini': return COLORS.mini8Tone;        // #3F42E0
        default: return COLORS.primary;
    }
};