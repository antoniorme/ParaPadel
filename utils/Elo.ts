import { Player } from '../types';
import { TOURNAMENT_CATEGORIES } from '../store/TournamentContext';

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
// Promedio ponderado: 50% Global + 30% Principal + 20% Mejor Adyacente
export const calculateDisplayRanking = (player: Player): number => {
    const global = player.global_rating || 1200;
    
    // Si no tiene categoría principal definida, usa la primera de su lista o Iniciación
    const mainCat = player.main_category || player.categories?.[0] || 'Iniciación';
    const ratingMain = player.category_ratings?.[mainCat] || global; // Fallback al global si no tiene específico

    // Buscar mejor adyacente (simple: buscamos el rating más alto que no sea el principal)
    let bestAdjacent = 0;
    if (player.category_ratings) {
        const ratings = Object.values(player.category_ratings);
        bestAdjacent = Math.max(...ratings, ratingMain); // Si no tiene otros, usa el main
    } else {
        bestAdjacent = ratingMain;
    }

    // Fórmula
    const ranking = (0.5 * global) + (0.3 * ratingMain) + (0.2 * bestAdjacent);
    return Math.round(ranking);
};

// --- Helper: Obtener categoría adyacente (opcional para lógica futura) ---
const getAdjacentCategories = (cat: string): string[] => {
    const idx = TOURNAMENT_CATEGORIES.indexOf(cat);
    if (idx === -1) return [];
    const adj = [];
    if (idx > 0) adj.push(TOURNAMENT_CATEGORIES[idx - 1]);
    if (idx < TOURNAMENT_CATEGORIES.length - 1) adj.push(TOURNAMENT_CATEGORIES[idx + 1]);
    return adj;
}