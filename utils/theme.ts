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

/**
 * Design system tokens — fuente única de verdad para la app de jugador.
 * Extraídos del prototipo de diseño (ParaPadel.html).
 */
export const PP = {
    primary:      '#575AF9',
    primaryDark:  '#4447D4',
    primaryTint:  '#EEF0FF',
    bg:           '#F8FAFC',
    card:         '#FFFFFF',
    ink:          '#0B0D17',
    ink2:         '#2B2F3A',
    mute:         '#6B7280',
    muteSoft:     '#9AA0AA',
    hair:         '#EEF0F3',
    hairStrong:   '#E3E6EC',
    ok:           '#10B981',
    okTint:       '#E7F8F1',
    warn:         '#F59E0B',
    warnTint:     '#FFF4CC',
    error:        '#EF4444',
    errorTint:    '#FCECEC',
    shadow:       '0 1px 2px rgba(11,13,23,0.04), 0 6px 18px rgba(11,13,23,0.05)',
    shadowLg:     '0 2px 4px rgba(11,13,23,0.04), 0 14px 32px rgba(11,13,23,0.08)',
    font:         '"DM Sans", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
} as const;

export const getFormatColor = (format: TournamentFormat) => {
    switch (format) {
        case '16_mini': return COLORS.primaryVeryDark; // #171852
        case '12_mini': return COLORS.primaryDark;     // #14169C
        case '10_mini': return COLORS.primary;         // #2B2DBF
        case '8_mini': return COLORS.mini8Tone;        // #3F42E0
        default: return COLORS.primary;
    }
};