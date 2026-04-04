
import { Player, Pair } from '../types';

// CONFIGURACIÓN ELO
// Escala x5 respecto a la anterior (aprox).
// K_FACTOR BASE: 50 (Duro para pares).
const BASE_K_FACTOR = 50; 
// Aumentamos el límite para permitir el "Factor de Corrección" en sorpresas grandes
const MAX_POINTS_CAP = 300; 

// 1. TABLA DE ANCLAS (Puntos Base por Categoría)
// Sistema 0-6000. Cada categoría son 1000 puntos.
// El ancla se sitúa en la MITAD de la franja.
export const CATEGORY_ANCHORS: Record<string, number> = {
    'Iniciación': 500,   // Rango 0 - 1000
    '5ª CAT': 1500,      // Rango 1000 - 2000
    '4ª CAT': 2500,      // Rango 2000 - 3000
    '3ª CAT': 3500,      // Rango 3000 - 4000
    '2ª CAT': 4500,      // Rango 4000 - 5000
    '1ª CAT': 5500       // Rango 5000 - 6000
};

// HELPER: Convert Manual Rating (1-10) to ELO Adjustment
export const manualToElo = (manualRating: number): number => {
    return (manualRating - 5) * 80;
};

// 2. CALCULAR ELO INICIAL
export const calculateInitialElo = (categories: string[], manualRating: number): number => {
    let basePoints = 1500; 
    
    if (categories && categories.length > 0) {
        let sum = 0;
        let count = 0;
        categories.forEach(cat => {
            if (CATEGORY_ANCHORS[cat]) {
                sum += CATEGORY_ANCHORS[cat];
                count++;
            }
        });
        if (count > 0) basePoints = sum / count;
    }

    const adjustment = manualToElo(manualRating);
    return Math.round(basePoints + adjustment);
};

// 3. CALCULAR EXPECTATIVA (0 a 1)
const getExpectedScore = (ratingA: number, ratingB: number): number => {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 1000)); 
};

// 4. FACTOR DE CONTUNDENCIA
const getMarginMultiplier = (scoreA: number, scoreB: number): number => {
    const diff = Math.abs(scoreA - scoreB);
    const total = scoreA + scoreB;
    if (total < 4) return 0.5;
    if (diff >= 5) return 1.2;  
    if (diff >= 3) return 1.1; 
    return 1.0;                 
};

// 5. CALCULAR DELTA CON FACTOR DE CORRECCIÓN
export const calculateMatchDelta = (
    pairAElo: number, 
    pairBElo: number, 
    scoreA: number, 
    scoreB: number
): number => {
    // Determinar ganador
    const actualScoreA = scoreA > scoreB ? 1 : 0;
    
    // Calcular expectativa normal
    const expectedA = getExpectedScore(pairAElo, pairBElo);
    
    // Multiplicador por margen de victoria
    const marginMult = getMarginMultiplier(scoreA, scoreB);

    // --- FACTOR DE CORRECCIÓN (UPSET BOOST) ---
    // Si el ganador tenía MENOS puntos que el perdedor, aceleramos el K.
    // Lógica: "Si gano a alguien muy superior, debo subir rápido a su nivel".
    let correctionFactor = 1;
    
    const winnerElo = actualScoreA === 1 ? pairAElo : pairBElo;
    const loserElo = actualScoreA === 1 ? pairBElo : pairAElo;

    // Solo aplicamos boost si el ganador era el "Underdog" (tenía menos ELO)
    if (winnerElo < loserElo) {
        const diff = loserElo - winnerElo;
        // Fórmula: Por cada 400 puntos de diferencia, sumamos +1 al multiplicador.
        // Ej: Diff 0 -> x1 (K=50)
        // Ej: Diff 400 -> x2 (K=100)
        // Ej: Diff 1000 (Categoría superior) -> x3.5 (K=175)
        correctionFactor = 1 + (diff / 400);
    }

    // K Efectivo dinámico
    const effectiveK = BASE_K_FACTOR * correctionFactor;

    // Fórmula Maestra
    let delta = effectiveK * marginMult * (actualScoreA - expectedA);

    // Hard Cap (Ahora 300 para permitir los saltos de corrección)
    if (delta > MAX_POINTS_CAP) delta = MAX_POINTS_CAP;
    if (delta < -MAX_POINTS_CAP) delta = -MAX_POINTS_CAP;

    return Math.round(delta);
};

// HELPER: Visual
export const calculateDisplayRanking = (player: Player): number => {
    if (player.global_rating) return Math.round(player.global_rating);
    return calculateInitialElo(player.categories || [], player.manual_rating || 5);
};

// HELPER: Promedio Pareja
export const getPairTeamElo = (p1: Player, p2: Player): number => {
    const elo1 = calculateDisplayRanking(p1);
    const elo2 = calculateDisplayRanking(p2);
    return Math.round((elo1 + elo2) / 2);
};
