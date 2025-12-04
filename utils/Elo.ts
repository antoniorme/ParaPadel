import { Player } from '../types';

const K_BASE = 32; 
export const BASE_ELO_BY_CATEGORY: Record<string, number> = {
    'Iniciación': 1100, '5ª CAT': 1250, '4ª CAT': 1400,
    '3ª CAT': 1550, '2ª CAT': 1700, '1ª CAT': 1850
};

export const manualToElo = (rating: number = 5): number => 900 + (rating * 100);

export const getMatchRating = (player: Player, matchCategory: string): number => {
    if (player.category_ratings && player.category_ratings[matchCategory]) {
        return player.category_ratings[matchCategory];
    }
    const global = player.global_rating || 1200;
    const base = BASE_ELO_BY_CATEGORY[matchCategory] || 1200;
    return Math.round((0.7 * global) + (0.3 * base));
};

const getExpectedScore = (ratingA: number, ratingB: number): number => 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));

const getDynamicK = (scoreA: number, scoreB: number): number => {
    const diff = Math.abs(scoreA - scoreB);
    return Math.min(K_BASE * (1 + (diff / 3)), K_BASE * 2);
};

export const calculateEloDelta = (avgEloA: number, avgEloB: number, scoreA: number, scoreB: number): number => {
    const actualScoreA = scoreA > scoreB ? 1 : scoreA < scoreB ? 0 : 0.5;
    const expectedA = getExpectedScore(avgEloA, avgEloB);
    return getDynamicK(scoreA, scoreB) * (actualScoreA - expectedA);
};

export const calculateDisplayRanking = (player: Player): number => {
    const globalStatsElo = player.global_rating || 1200;
    const manualElo = manualToElo(player.manual_rating || 5);
    return Math.round((0.7 * globalStatsElo) + (0.3 * manualElo));
};