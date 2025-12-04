
import { Player } from '../types';

// --- CONSTANTES ---
const K_BASE = 32; 
export const BASE_ELO_BY_CATEGORY: Record<string, number> = {
    'Iniciación': 1100,
    '5ª CAT': 1250,
    '4ª CAT': 1400,
    '3ª CAT': 1550,
    '2ª CAT': 1700,
    '1ª CAT': 1850
};

// Convierte escala 1-10 a ELO aproximado (1000 - 1900)
export const manualToElo = (rating: number = 5): number => {
    // 1 -> 1000, 3 -> 1200, 5 -> 1400, 8 -> 1700, 10 -> 1900
    return 900 + (rating * 100);
};

// --- 1. OBTENER RATING EFECTIVO PARA UN PARTIDO ---
export const getMatchRating = (player: Player, matchCategory: string): number => {
    // A. Si ya tiene rating en esa categoría, úsalo
    if (player.category_ratings && player.category_ratings[matchCategory]) {
        return player.category_ratings[matchCategory];
    }

    // B. Si no, inicializa: 70% Global + 30% Base Categoría
    const global = player.global_rating || 1200;
    const base = BASE_ELO_BY_CATEGORY[matchCategory] || 1200;
    
    return Math.round((0.7 * global) + (0.3 * base));
};

// --- 2. ELO MATH CORE ---
const getExpectedScore = (ratingA: number, ratingB: number): number => {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
};

const getDynamicK = (scoreA: number, scoreB: number): number => {
    const diff = Math.abs(scoreA - scoreB);
    const marginFactor = 1 + (diff / 3);
    return Math.min(K_BASE * marginFactor, K_BASE * 2);
};

// --- 3. CÁLCULO DE DELTA (Cuánto cambia) ---
export const calculateEloDelta = (
    avgEloA: number, 
    avgEloB: number, 
    scoreA: number, 
    scoreB: number
): number => {
    const actualScoreA = scoreA > scoreB ? 1 : scoreA < scoreB ? 0 : 0.5;
    const expectedA = getExpectedScore(avgEloA, avgEloB);
    const kFactor = getDynamicK(scoreA, scoreB);
    return kFactor * (actualScoreA - expectedA);
};

// --- 4. RANKING "REAL" (La métrica maestra para el club) ---
// Ahora integra la Valoración Manual como factor de corrección.
// Fórmula: 70% Rendimiento Estadístico + 30% Valoración Manual
export const calculateDisplayRanking = (player: Player): number => {
    const globalStatsElo = player.global_rating || 1200;
    
    // Convertimos la valoración manual (1-10) a escala ELO
    const manualElo = manualToElo(player.manual_rating || 5);

    // Calculamos el ranking ponderado
    const ranking = (0.7 * globalStatsElo) + (0.3 * manualElo);
    
    return Math.round(ranking);
};
