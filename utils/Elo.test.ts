import { describe, it, expect } from 'vitest';
import {
    manualToElo,
    calculateInitialElo,
    calculateMatchDelta,
    calculateDisplayRanking,
    getPairTeamElo,
    CATEGORY_ANCHORS,
} from './Elo';
import type { Player } from '../types';

// --- manualToElo ---
describe('manualToElo', () => {
    it('devuelve 0 para rating 5 (neutro)', () => {
        expect(manualToElo(5)).toBe(0);
    });

    it('devuelve positivo para rating > 5', () => {
        expect(manualToElo(10)).toBe(400);
        expect(manualToElo(7)).toBe(160);
    });

    it('devuelve negativo para rating < 5', () => {
        expect(manualToElo(1)).toBe(-320);
        expect(manualToElo(3)).toBe(-160);
    });
});

// --- calculateInitialElo ---
describe('calculateInitialElo', () => {
    it('sin categoría y manual 5 → 1500 (base)', () => {
        expect(calculateInitialElo([], 5)).toBe(1500);
    });

    it('con categoría válida usa el ancla correcta', () => {
        expect(calculateInitialElo(['4ª CAT'], 5)).toBe(CATEGORY_ANCHORS['4ª CAT']);
        expect(calculateInitialElo(['1ª CAT'], 5)).toBe(CATEGORY_ANCHORS['1ª CAT']);
    });

    it('con múltiples categorías usa el promedio de anclas', () => {
        // 5ª CAT (1500) + 4ª CAT (2500) → promedio = 2000
        expect(calculateInitialElo(['5ª CAT', '4ª CAT'], 5)).toBe(2000);
    });

    it('aplica el ajuste manual correctamente', () => {
        // 4ª CAT (2500) + manualRating 7 → 2500 + 160 = 2660
        expect(calculateInitialElo(['4ª CAT'], 7)).toBe(2660);
    });

    it('ajuste negativo con rating bajo', () => {
        // 5ª CAT (1500) + manualRating 3 → 1500 - 160 = 1340
        expect(calculateInitialElo(['5ª CAT'], 3)).toBe(1340);
    });

    it('categoría desconocida cae al base de 1500', () => {
        // Categoría que no existe en CATEGORY_ANCHORS
        expect(calculateInitialElo(['Categoría Fantasma'], 5)).toBe(1500);
    });
});

// --- calculateMatchDelta ---
describe('calculateMatchDelta', () => {
    it('partido igualado (mismo ELO): ganador suma ~25, perdedor pierde ~25', () => {
        const delta = calculateMatchDelta(1500, 1500, 6, 4);
        expect(delta).toBeGreaterThan(0);
        expect(delta).toBeLessThanOrEqual(60);
    });

    it('el favorito que gana sube menos que el underdog', () => {
        const deltaFavorite = calculateMatchDelta(2500, 1500, 6, 4);
        const deltaUnderdog = calculateMatchDelta(1500, 2500, 6, 4);
        expect(deltaUnderdog).toBeGreaterThan(deltaFavorite);
    });

    it('el underdog que gana tiene delta positivo (upset)', () => {
        const delta = calculateMatchDelta(1000, 2000, 6, 4);
        expect(delta).toBeGreaterThan(0);
    });

    it('el favorito que pierde tiene delta negativo', () => {
        const delta = calculateMatchDelta(2000, 1000, 4, 6);
        expect(delta).toBeLessThan(0);
    });

    it('respeta el cap de MAX_POINTS_CAP (300)', () => {
        // Diferencia extrema: underdog 500 gana a 5500 (diferencia 5000)
        const delta = calculateMatchDelta(500, 5500, 6, 0);
        expect(Math.abs(delta)).toBeLessThanOrEqual(300);
    });

    it('margen de victoria grande (≥5 games) multiplica el delta', () => {
        const deltaTight = calculateMatchDelta(1500, 1500, 5, 4); // diff = 1 → mult 1.0
        const deltaBlowout = calculateMatchDelta(1500, 1500, 6, 1); // diff = 5 → mult 1.2
        expect(deltaBlowout).toBeGreaterThan(deltaTight);
    });

    it('partido muy corto (total < 4 juegos) aplica penalización x0.5', () => {
        const deltaNormal = calculateMatchDelta(1500, 1500, 2, 1); // total=3, mult=0.5
        const deltaFull = calculateMatchDelta(1500, 1500, 6, 4);   // total>4, mult=1.0
        expect(Math.abs(deltaNormal)).toBeLessThan(Math.abs(deltaFull));
    });
});

// --- calculateDisplayRanking ---
describe('calculateDisplayRanking', () => {
    it('usa global_rating si está definido', () => {
        const player: Player = { id: '1', name: 'Test', global_rating: 2345 };
        expect(calculateDisplayRanking(player)).toBe(2345);
    });

    it('calcula desde categorías si global_rating es undefined', () => {
        const player: Player = {
            id: '1',
            name: 'Test',
            categories: ['4ª CAT'],
            manual_rating: 5,
        };
        expect(calculateDisplayRanking(player)).toBe(2500);
    });

    it('usa defaults (1500, manual 5) si no hay datos', () => {
        const player: Player = { id: '1', name: 'Sin datos' };
        expect(calculateDisplayRanking(player)).toBe(1500);
    });
});

// --- getPairTeamElo ---
describe('getPairTeamElo', () => {
    it('calcula el promedio ELO de la pareja', () => {
        const p1: Player = { id: '1', name: 'A', global_rating: 2000 };
        const p2: Player = { id: '2', name: 'B', global_rating: 3000 };
        expect(getPairTeamElo(p1, p2)).toBe(2500);
    });

    it('redondea correctamente cuando el promedio no es entero', () => {
        const p1: Player = { id: '1', name: 'A', global_rating: 1000 };
        const p2: Player = { id: '2', name: 'B', global_rating: 1001 };
        expect(getPairTeamElo(p1, p2)).toBe(1001); // Math.round(1000.5)
    });
});
