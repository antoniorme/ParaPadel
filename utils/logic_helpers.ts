
import { Pair, Player, Group, TournamentFormat, GenerationMethod } from '../types';
import { calculateDisplayRanking } from './Elo';

export const GROUP_NAMES_16 = ['A', 'B', 'C', 'D'];
export const GROUP_NAMES_12 = ['A', 'B', 'C'];
export const GROUP_NAMES_10 = ['A', 'B'];
export const GROUP_NAMES_8 = ['A', 'B'];

export const getPairElo = (pair: Pair, players: Player[]): number => {
    const p1 = players.find(p => p.id === pair.player1Id);
    const p2 = pair.player2Id ? players.find(p => p.id === pair.player2Id) : null;
    
    const p1Elo = p1 ? calculateDisplayRanking(p1) : 1200;
    const p2Elo = p2 ? calculateDisplayRanking(p2) : p1Elo; // If solo, use p1 twice for estimation or just p1
    
    return p1Elo + p2Elo;
};

export const sortPairsByMethod = (pairs: Pair[], players: Player[], method: GenerationMethod): Pair[] => {
    let activePairs = [...pairs]; 
    if (method === 'arrival') {
        return activePairs.sort((a, b) => (a.id > b.id ? 1 : -1)); 
    } 
    if (method === 'elo-balanced' || method === 'elo-mixed') {
        return activePairs.sort((a, b) => getPairElo(b, players) - getPairElo(a, players));
    }
    return activePairs; 
};

export const getRankedPairsForGroup = (pairs: Pair[], groups: Group[], groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return [];
    const groupPairs = group.pairIds.map(pid => pairs.find(p => p.id === pid)).filter(Boolean) as Pair[];
    return groupPairs.sort((a, b) => {
        if (b.stats.won !== a.stats.won) return b.stats.won - a.stats.won;
        return b.stats.gameDiff - a.stats.gameDiff;
    });
};

export const generateGroupsHelper = (pairs: Pair[], players: Player[], method: GenerationMethod, format: TournamentFormat): Group[] => {
  let limit = 16;
  if (format === '10_mini') limit = 10;
  if (format === '8_mini') limit = 8;
  if (format === '12_mini') limit = 12;

  // IMPORTANT: Filter out incomplete pairs (solos) before generating groups
  const completePairs = pairs.filter(p => p.player2Id !== null);

  let sortedPairs = sortPairsByMethod(completePairs, players, method);
  const titularPairs = sortedPairs.slice(0, limit);
  const groups: Group[] = [];
  
  const createGroups = (names: string[], sizePerGroup: number, isMixed: boolean) => {
      if (isMixed) {
          const buckets: Pair[][] = names.map(() => []);
          titularPairs.forEach((p, i) => buckets[i % names.length].push(p));
          names.forEach((id, i) => groups.push({ id, pairIds: buckets[i].map(p => p.id) }));
      } else {
          names.forEach((id, i) => {
              groups.push({ id, pairIds: titularPairs.slice(i * sizePerGroup, (i + 1) * sizePerGroup).map(p => p.id) });
          });
      }
  };

  if (format === '16_mini') createGroups(GROUP_NAMES_16, 4, method === 'elo-mixed');
  else if (format === '12_mini') createGroups(GROUP_NAMES_12, 4, method === 'elo-mixed');
  else if (format === '10_mini') createGroups(GROUP_NAMES_10, 5, method === 'elo-mixed');
  else if (format === '8_mini') createGroups(GROUP_NAMES_8, 4, method === 'elo-mixed');

  return groups;
};
