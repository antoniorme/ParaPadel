
import { Player, Pair, Match } from '../types';

// CONFIGURACIÓN ELO
// Escala x5 respecto a la anterior (aprox).
// K_FACTOR BASE: 50 (Duro para pares).
const BASE_K_FACTOR = 50;
// Aumentamos el límite para permitir el "Factor de Corrección" en sorpresas grandes
const MAX_POINTS_CAP = 300;

// ── ANTI-FRAUDE CONFIG (no documentar públicamente) ───────────────────────────

// Máximo ELO que se puede ganar en un día fuera de torneo oficial
const DAILY_ELO_CAP_FRIENDLY = 80;
// Máximo partidos por día que computan ELO (fuera de torneo oficial)
const MAX_DAILY_FRIENDLY_MATCHES = 2;
// Multiplicador para partidos amistosos vs torneos oficiales
const FRIENDLY_MATCH_MULTIPLIER = 0.6;
// Multiplicador por repetir rivales: primer reencuentro x0.5, segundo x0.25, etc.
const REPEAT_OPPONENT_BASE_MULTIPLIER = 0.5;

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

// ── ANTI-FRAUDE: REGLAS DE APLICACIÓN ────────────────────────────────────────

/**
 * Cuántas veces han jugado estos dos pares entre sí en el historial dado.
 * Se usa para aplicar el multiplicador de repetición de rivales.
 */
export const countPreviousMatchups = (
    myPairId: string,
    opponentPairId: string,
    matchHistory: Match[]
): number => {
    return matchHistory.filter(m =>
        m.isFinished &&
        ((m.pairAId === myPairId && m.pairBId === opponentPairId) ||
         (m.pairAId === opponentPairId && m.pairBId === myPairId))
    ).length;
};

/**
 * Multiplicador por repetición de rivales.
 * 0 veces jugados → x1.0 (sin penalización)
 * 1 vez → x0.5
 * 2 veces → x0.25
 * 3+ veces → x0.125 (piso)
 */
export const getRepeatOpponentMultiplier = (timesPreviouslyPlayed: number): number => {
    if (timesPreviouslyPlayed <= 0) return 1.0;
    const multiplier = Math.pow(REPEAT_OPPONENT_BASE_MULTIPLIER, timesPreviouslyPlayed);
    return Math.max(multiplier, 0.125); // piso de 12.5%
};

/**
 * Cuántos partidos amistosos (no en torneo oficial) ha jugado un jugador hoy.
 * Si llega al límite, el delta de ELO será 0.
 */
export const getFriendlyMatchCountToday = (
    playerId: string,
    matchHistory: Match[],
    pairs: Pair[]
): number => {
    const today = new Date().toDateString();
    const myPairIds = pairs
        .filter(p => p.player1Id === playerId || p.player2Id === playerId)
        .map(p => p.id);

    return matchHistory.filter(m => {
        if (!m.isFinished) return false;
        if (m.bracket === 'main' || m.bracket === 'consolation') return false; // torneo oficial
        const involvedInMatch = myPairIds.includes(m.pairAId) || myPairIds.includes(m.pairBId);
        if (!involvedInMatch) return false;
        // Sin timestamp en Match, usamos heurística: si el modelo tuviese created_at lo usaríamos
        // Por ahora contamos todos los del historial reciente (se refinará con timestamps)
        return true;
    }).length;
};

/**
 * Aplica todas las reglas anti-fraude a un delta de ELO calculado.
 *
 * @param rawDelta       - Delta calculado por calculateMatchDelta
 * @param isTournament   - Si el partido es dentro de un torneo oficial
 * @param repeatTimes    - Veces que estos rivales se han enfrentado antes
 * @param eloGainedToday - ELO ya ganado hoy en partidos amistosos
 * @param friendlyMatchesToday - Partidos amistosos jugados hoy
 */
export const applyAntiFraudRules = (
    rawDelta: number,
    isTournament: boolean,
    repeatTimes: number,
    eloGainedToday: number = 0,
    friendlyMatchesToday: number = 0
): number => {
    // Los partidos de torneo oficial no tienen límite diario ni multiplicador amistoso,
    // pero sí tienen la penalización por repetir rivales (por si acaso)
    const repeatMultiplier = getRepeatOpponentMultiplier(repeatTimes);
    let delta = Math.round(rawDelta * repeatMultiplier);

    if (isTournament) {
        // En torneo: solo aplicamos la penalización por repetir rivales
        return delta;
    }

    // Partido amistoso: aplicar multiplicador de amistoso
    delta = Math.round(delta * FRIENDLY_MATCH_MULTIPLIER);

    // Límite de partidos por día
    if (friendlyMatchesToday >= MAX_DAILY_FRIENDLY_MATCHES) {
        return 0;
    }

    // Cap de ELO diario (solo cuenta ELO positivo)
    if (delta > 0 && eloGainedToday >= DAILY_ELO_CAP_FRIENDLY) {
        return 0;
    }
    if (delta > 0 && eloGainedToday + delta > DAILY_ELO_CAP_FRIENDLY) {
        delta = DAILY_ELO_CAP_FRIENDLY - eloGainedToday;
    }

    return delta;
};

// ── HELPERS ───────────────────────────────────────────────────────────────────

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
