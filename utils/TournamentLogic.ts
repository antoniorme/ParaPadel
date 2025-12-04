import { Pair, Player, Match, Group, TournamentFormat, GenerationMethod, TournamentState } from '../types';
import { calculateDisplayRanking } from './Elo';

export const GROUP_NAMES_16 = ['A', 'B', 'C', 'D'];
export const GROUP_NAMES_12 = ['A', 'B', 'C'];
export const GROUP_NAMES_10 = ['A', 'B'];
export const GROUP_NAMES_8 = ['A', 'B'];

export const getPairElo = (pair: Pair, players: Player[]): number => {
    const p1 = players.find(p => p.id === pair.player1Id);
    const p2 = players.find(p => p.id === pair.player2Id);
    const score1 = p1 ? calculateDisplayRanking(p1) : 1200;
    const score2 = p2 ? calculateDisplayRanking(p2) : 1200;
    return score1 + score2;
};

export const sortPairsByMethod = (pairs: Pair[], players: Player[], method: GenerationMethod): Pair[] => {
    let activePairs = [...pairs]; 
    if (method === 'arrival') return activePairs.sort((a, b) => (a.id > b.id ? 1 : -1)); 
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

export const recalculateStats = (pairs: Pair[], matches: Match[]) => {
    const statsMap: Record<string, { played: number, won: number, gameDiff: number }> = {};
    pairs.forEach(p => { statsMap[p.id] = { played: 0, won: 0, gameDiff: 0 }; });
    matches.forEach(m => {
        if (!m.isFinished || m.scoreA === null || m.scoreB === null) return;
        if (!statsMap[m.pairAId]) statsMap[m.pairAId] = { played: 0, won: 0, gameDiff: 0 };
        if (!statsMap[m.pairBId]) statsMap[m.pairBId] = { played: 0, won: 0, gameDiff: 0 };
        statsMap[m.pairAId].played++; statsMap[m.pairAId].gameDiff += (m.scoreA - m.scoreB);
        if (m.scoreA > m.scoreB) statsMap[m.pairAId].won++;
        statsMap[m.pairBId].played++; statsMap[m.pairBId].gameDiff += (m.scoreB - m.scoreA);
        if (m.scoreB > m.scoreA) statsMap[m.pairBId].won++;
    });
    return pairs.map(p => ({ ...p, stats: statsMap[p.id] || { played: 0, won: 0, gameDiff: 0 } }));
};

export const generateGroupsHelper = (pairs: Pair[], players: Player[], method: GenerationMethod = 'manual', format: TournamentFormat = '16_mini'): Group[] => {
  let limit = 16;
  if (format === '10_mini') limit = 10;
  if (format === '8_mini') limit = 8;
  if (format === '12_mini') limit = 12;

  let sortedPairs = sortPairsByMethod(pairs, players, method);
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

const createMatches = (groups: Group[], groupId: string, round: number, idxs: number[][], court: number) => {
      const g = groups.find(x => x.id === groupId);
      if(!g) return [];
      return idxs.map((pairIdx, i) => {
          if (!g.pairIds[pairIdx[0]] || !g.pairIds[pairIdx[1]]) return null;
          return { round, phase: 'group' as const, bracket: null, courtId: court + i, pairAId: g.pairIds[pairIdx[0]], pairBId: g.pairIds[pairIdx[1]], scoreA: null, scoreB: null, isFinished: false };
      }).filter(Boolean) as Partial<Match>[];
};

export const generateMatches16 = (groups: Group[], courtCount: number): Partial<Match>[] => {
  const matches: Partial<Match>[] = [];
  const sim = courtCount >= 8;
  matches.push(...createMatches(groups, 'A', 1, [[0,1], [2,3]], 1));
  matches.push(...createMatches(groups, 'B', 1, [[0,1], [2,3]], 3));
  matches.push(...createMatches(groups, 'C', 1, [[0,1], [2,3]], 5));
  if(sim) matches.push(...createMatches(groups, 'D', 1, [[0,1], [2,3]], 7));
  matches.push(...createMatches(groups, 'A', 2, [[0,2], [1,3]], 1));
  matches.push(...createMatches(groups, 'B', 2, [[0,2], [1,3]], 3));
  if(sim) matches.push(...createMatches(groups, 'C', 2, [[0,2], [1,3]], 5)); else matches.push(...createMatches(groups, 'D', 2, [[0,1], [2,3]], 5)); 
  if(sim) matches.push(...createMatches(groups, 'D', 2, [[0,2], [1,3]], 7));
  matches.push(...createMatches(groups, 'A', 3, [[0,3], [1,2]], 1));
  if(sim) matches.push(...createMatches(groups, 'B', 3, [[0,3], [1,2]], 3)); else matches.push(...createMatches(groups, 'C', 3, [[0,2], [1,3]], 3)); 
  if(sim) matches.push(...createMatches(groups, 'C', 3, [[0,3], [1,2]], 5)); else matches.push(...createMatches(groups, 'D', 3, [[0,2], [1,3]], 5)); 
  if(sim) matches.push(...createMatches(groups, 'D', 3, [[0,3], [1,2]], 7));
  if (!sim) { matches.push(...createMatches(groups, 'B', 4, [[0,3], [1,2]], 1)); matches.push(...createMatches(groups, 'C', 4, [[0,3], [1,2]], 3)); matches.push(...createMatches(groups, 'D', 4, [[0,3], [1,2]], 5)); }
  return matches;
};

export const generateMatches12 = (groups: Group[], courtCount: number): Partial<Match>[] => {
    const matches: Partial<Match>[] = [];
    const cA = 1; const cB = 3; const cC = courtCount >= 6 ? 5 : 0; 
    const mk = (gId: string, r: number, p1I: number, p2I: number, c: number) => {
        const g = groups.find(x => x.id === gId); if(!g) return null;
        return { round: r, phase: 'group' as const, bracket: null, courtId: c === 0 ? 0 : c, pairAId: g.pairIds[p1I], pairBId: g.pairIds[p2I], scoreA: null, scoreB: null, isFinished: false };
    };
    [1, 2, 3].forEach(r => {
        const p1 = r===1?[0,2]:r===2?[0,1]:[0,1]; const p2 = r===1?[1,3]:r===2?[2,3]:[3,2]; 
        matches.push(mk('A', r, p1[0], p2[0], cA)!, mk('A', r, p1[1], p2[1], cA+1)!);
        matches.push(mk('B', r, p1[0], p2[0], cB)!, mk('B', r, p1[1], p2[1], cB+1)!);
        matches.push(mk('C', r, p1[0], p2[0], cC)!, mk('C', r, p1[1], p2[1], cC===0?0:cC+1)!);
    });
    return matches;
};

export const generateMatches8 = (groups: Group[]): Partial<Match>[] => {
    const matches: Partial<Match>[] = [];
    [1,2,3].forEach(r => {
        const p1 = r===1?[[0,1],[2,3]]:r===2?[[0,2],[1,3]]:[[0,3],[1,2]];
        matches.push(...createMatches(groups, 'A', r, p1, 1));
        matches.push(...createMatches(groups, 'B', r, p1, 3));
    });
    return matches;
};

export const generateMatches10 = (groups: Group[]): Partial<Match>[] => {
    const matches: Partial<Match>[] = [];
    const gA = groups.find(g => g.id === 'A')?.pairIds || [];
    const gB = groups.find(g => g.id === 'B')?.pairIds || [];
    if (gA.length !== 5 || gB.length !== 5) return [];
    const mk = (r: number, c: number, idA: string, idB: string) => ({ round: r, phase: 'group' as const, bracket: null, courtId: c, pairAId: idA, pairBId: idB, scoreA: null, scoreB: null, isFinished: false });
    matches.push(mk(1, 1, gA[0], gA[1]), mk(1, 2, gA[2], gA[3]), mk(1, 3, gA[4], gB[0]), mk(1, 4, gB[1], gB[2]), mk(1, 5, gB[3], gB[4]));
    matches.push(mk(2, 1, gA[0], gA[2]), mk(2, 2, gA[1], gA[4]), mk(2, 3, gA[3], gB[1]), mk(2, 4, gB[0], gB[2]), mk(2, 5, gB[4], gB[3])); 
    matches.push(mk(3, 1, gA[0], gA[3]), mk(3, 2, gA[1], gA[2]), mk(3, 3, gA[4], gB[2]), mk(3, 4, gB[0], gB[4]), mk(3, 5, gB[1], gB[3])); 
    return matches;
};

export const generateNextRoundMatches = (state: TournamentState, courtCount: number): Partial<Match>[] => {
    const nextRound = state.currentRound + 1;
    const format = state.format;
    const matches: Partial<Match>[] = [];
    const sA = getRankedPairsForGroup(state.pairs, state.groups, 'A'); const sB = getRankedPairsForGroup(state.pairs, state.groups, 'B');
    const sC = getRankedPairsForGroup(state.pairs, state.groups, 'C'); const sD = getRankedPairsForGroup(state.pairs, state.groups, 'D');

    const getW = (round: number, bracket: string, court: number) => { 
        const m = state.matches.find(x => x.round === round && x.bracket === bracket && x.courtId === court); 
        return m ? (m.scoreA! > m.scoreB! ? m.pairAId : m.pairBId) : 'TBD'; 
    };
    const getL = (round: number, bracket: string, court: number) => { 
        const m = state.matches.find(x => x.round === round && x.bracket === bracket && x.courtId === court); 
        return m ? (m.scoreA! > m.scoreB! ? m.pairBId : m.pairAId) : 'TBD'; 
    };

    if (format === '16_mini') {
        const isSimultaneous = courtCount >= 8;
        const qfStart = isSimultaneous ? 4 : 5;
        if (state.currentRound === qfStart - 1) { // Groups -> QF
            const mk = (c: number, p1: string, p2: string, b: string) => ({ round: nextRound, phase: 'qf' as const, bracket: b as any, courtId: c, pairAId: p1, pairBId: p2, isFinished: false });
            matches.push(mk(1, sA[0].id, sC[1].id, 'main'), mk(2, sC[0].id, sA[1].id, 'main'), mk(3, sB[0].id, sD[1].id, 'main'), mk(4, sD[0].id, sB[1].id, 'main'));
            matches.push(mk(5, sA[2].id, sC[3].id, 'consolation'), mk(6, sC[2].id, sA[3].id, 'consolation'), mk(0, sB[2].id, sD[3].id, 'consolation'), mk(0, sD[2].id, sB[3].id, 'consolation'));
        } else if (state.currentRound === qfStart) { // QF -> SF
            matches.push({ round: nextRound, phase: 'sf', bracket: 'main', courtId: 1, pairAId: getW(qfStart, 'main', 1), pairBId: getW(qfStart, 'main', 3), isFinished: false });
            matches.push({ round: nextRound, phase: 'sf', bracket: 'main', courtId: 2, pairAId: getW(qfStart, 'main', 2), pairBId: getW(qfStart, 'main', 4), isFinished: false });
            const waiting = state.matches.filter(m => m.round === state.currentRound && m.courtId === 0);
            waiting.forEach((m, i) => matches.push({ round: nextRound, phase: 'qf', bracket: 'consolation', courtId: 3 + i, pairAId: m.pairAId, pairBId: m.pairBId, isFinished: false }));
        } else if (state.currentRound === qfStart + 1) { // SF -> Final
            matches.push({ round: nextRound, phase: 'final', bracket: 'main', courtId: 1, pairAId: getW(qfStart+1, 'main', 1), pairBId: getW(qfStart+1, 'main', 2), isFinished: false });
            matches.push({ round: nextRound, phase: 'sf', bracket: 'consolation', courtId: 2, pairAId: getW(qfStart, 'consolation', 5), pairBId: getW(qfStart+1, 'consolation', 3), isFinished: false });
            matches.push({ round: nextRound, phase: 'sf', bracket: 'consolation', courtId: 3, pairAId: getW(qfStart, 'consolation', 6), pairBId: getW(qfStart+1, 'consolation', 4), isFinished: false });
        } else if (state.currentRound === qfStart + 2) { // Cons Final
            matches.push({ round: nextRound, phase: 'final', bracket: 'consolation', courtId: 1, pairAId: getW(qfStart+2, 'consolation', 2), pairBId: getW(qfStart+2, 'consolation', 3), isFinished: false });
        }
    } else if (format === '10_mini') {
        if (state.currentRound === 3) {
            const mk = (c: number, p1: string, p2: string, b: string) => ({ round: 4, phase: b === 'main' ? 'qf' as const : 'final' as const, bracket: b as any, courtId: c, pairAId: p1, pairBId: p2, isFinished: false });
            matches.push(mk(1, sA[0].id, sB[3].id, 'main'), mk(2, sB[0].id, sA[3].id, 'main'), mk(3, sA[1].id, sB[2].id, 'main'), mk(4, sB[1].id, sA[2].id, 'main'), mk(5, sA[4].id, sB[4].id, 'consolation'));
        } else if (state.currentRound === 4) {
            matches.push({ round: 5, phase: 'sf', bracket: 'main', courtId: 1, pairAId: getW(4, 'main', 1), pairBId: getW(4, 'main', 3), isFinished: false });
            matches.push({ round: 5, phase: 'sf', bracket: 'main', courtId: 2, pairAId: getW(4, 'main', 2), pairBId: getW(4, 'main', 4), isFinished: false });
        } else if (state.currentRound === 5) {
            matches.push({ round: 6, phase: 'final', bracket: 'main', courtId: 1, pairAId: getW(5, 'main', 1), pairBId: getW(5, 'main', 2), isFinished: false });
        }
    } else if (format === '8_mini') {
        if (state.currentRound === 3) {
            const mk = (c: number, p1: string, p2: string) => ({ round: 4, phase: 'qf' as const, bracket: 'main' as any, courtId: c, pairAId: p1, pairBId: p2, isFinished: false });
            matches.push(mk(1, sA[0].id, sB[3].id), mk(2, sB[0].id, sA[3].id), mk(3, sA[1].id, sB[2].id), mk(4, sB[1].id, sA[2].id));
        } else if (state.currentRound === 4) {
            matches.push({ round: 5, phase: 'sf', bracket: 'main', courtId: 1, pairAId: getW(4, 'main', 1), pairBId: getW(4, 'main', 3), isFinished: false });
            matches.push({ round: 5, phase: 'sf', bracket: 'main', courtId: 2, pairAId: getW(4, 'main', 2), pairBId: getW(4, 'main', 4), isFinished: false });
            matches.push({ round: 5, phase: 'sf', bracket: 'consolation', courtId: 3, pairAId: getL(4, 'main', 1), pairBId: getL(4, 'main', 3), isFinished: false });
            matches.push({ round: 5, phase: 'sf', bracket: 'consolation', courtId: 4, pairAId: getL(4, 'main', 2), pairBId: getL(4, 'main', 4), isFinished: false });
        } else if (state.currentRound === 5) {
            matches.push({ round: 6, phase: 'final', bracket: 'main', courtId: 1, pairAId: getW(5, 'main', 1), pairBId: getW(5, 'main', 2), isFinished: false });
            matches.push({ round: 6, phase: 'final', bracket: 'consolation', courtId: 2, pairAId: getW(5, 'consolation', 3), pairBId: getW(5, 'consolation', 4), isFinished: false });
        }
    } else if (format === '12_mini') {
        if (state.currentRound === 3) {
            const thirds = [sA[2], sB[2], sC[2]].sort((a,b) => { if(b.stats.won !== a.stats.won) return b.stats.won - a.stats.won; return b.stats.gameDiff - a.stats.gameDiff; });
            const best3rds = [thirds[0].id, thirds[1].id]; const worst3rd = thirds[2].id;
            const consPool = [worst3rd, sA[3].id, sB[3].id, sC[3].id];
            const mkM = (c: number, p1: string, p2: string) => ({ round: 4, phase: 'qf' as const, bracket: 'main' as any, courtId: c, pairAId: p1, pairBId: p2, isFinished: false });
            const mkC = (c: number, p1: string, p2: string) => ({ round: 4, phase: 'sf' as const, bracket: 'consolation' as any, courtId: c, pairAId: p1, pairBId: p2, isFinished: false });
            matches.push(mkM(1, sA[0].id, best3rds[1]), mkM(2, sB[0].id, best3rds[0]), mkM(3, sC[0].id, sA[1].id), mkM(4, sB[1].id, sC[1].id));
            matches.push(mkC(5, consPool[0], consPool[1]), mkC(6, consPool[2], consPool[3]));
        } else if (state.currentRound === 4) {
            matches.push({ round: 5, phase: 'sf', bracket: 'main', courtId: 1, pairAId: getW(4, 'main', 1), pairBId: getW(4, 'main', 3), isFinished: false });
            matches.push({ round: 5, phase: 'sf', bracket: 'main', courtId: 2, pairAId: getW(4, 'main', 2), pairBId: getW(4, 'main', 4), isFinished: false });
            matches.push({ round: 5, phase: 'final', bracket: 'consolation', courtId: 3, pairAId: getW(4, 'consolation', 5), pairBId: getW(4, 'consolation', 6), isFinished: false });
        } else if (state.currentRound === 5) {
            matches.push({ round: 6, phase: 'final', bracket: 'main', courtId: 1, pairAId: getW(5, 'main', 1), pairBId: getW(5, 'main', 2), isFinished: false });
        }
    }
    return matches;
};

export const reconstructGroupsFromMatches = (pairs: Pair[], matches: Match[], players: Player[], format: TournamentFormat): Group[] => {
    const groupMap: Record<string, Set<string>> = { 'A': new Set(), 'B': new Set(), 'C': new Set(), 'D': new Set() };
    const round1 = matches.filter(m => m.round === 1);
    
    if (format === '10_mini') {
        if (round1.length > 0) {
            round1.forEach(m => {
                if ([1,2].includes(m.courtId)) { groupMap['A'].add(m.pairAId); groupMap['A'].add(m.pairBId); }
                if ([4,5].includes(m.courtId)) { groupMap['B'].add(m.pairAId); groupMap['B'].add(m.pairBId); }
                if (m.courtId === 3) { groupMap['A'].add(m.pairAId); groupMap['B'].add(m.pairBId); }
            });
            return GROUP_NAMES_10.map(id => ({ id, pairIds: Array.from(groupMap[id]) }));
        }
        return generateGroupsHelper(pairs, players, 'elo-balanced', '10_mini');
    }
    if (format === '12_mini') {
        if(round1.length > 0) {
             round1.forEach(m => {
                 if([1,2].includes(m.courtId)) { groupMap['A'].add(m.pairAId); groupMap['A'].add(m.pairBId); }
                 if([3,4].includes(m.courtId)) { groupMap['B'].add(m.pairAId); groupMap['B'].add(m.pairBId); }
                 if([5,6,0].includes(m.courtId)) { groupMap['C'].add(m.pairAId); groupMap['C'].add(m.pairBId); }
             });
             return GROUP_NAMES_12.map(id => ({ id, pairIds: Array.from(groupMap[id]) }));
        }
        return generateGroupsHelper(pairs, players, 'elo-balanced', '12_mini');
    }
    if (format === '8_mini') {
         if(round1.length > 0) {
             round1.forEach(m => {
                 if([1,2].includes(m.courtId)) { groupMap['A'].add(m.pairAId); groupMap['A'].add(m.pairBId); }
                 if([3,4].includes(m.courtId)) { groupMap['B'].add(m.pairAId); groupMap['B'].add(m.pairBId); }
             });
             return GROUP_NAMES_8.map(id => ({ id, pairIds: Array.from(groupMap[id]) }));
         }
         return generateGroupsHelper(pairs, players, 'elo-balanced', '8_mini');
    }
    round1.forEach(m => {
        if ([1,2].includes(m.courtId)) { groupMap['A'].add(m.pairAId); groupMap['A'].add(m.pairBId); }
        if ([3,4].includes(m.courtId)) { groupMap['B'].add(m.pairAId); groupMap['B'].add(m.pairBId); }
        if ([5,6].includes(m.courtId)) { groupMap['C'].add(m.pairAId); groupMap['C'].add(m.pairBId); }
        if ([7,8].includes(m.courtId)) { groupMap['D'].add(m.pairAId); groupMap['D'].add(m.pairBId); }
    });
    const groups = GROUP_NAMES_16.map(id => ({ id, pairIds: Array.from(groupMap[id]) }));
    if(groups[0].pairIds.length < 4) return generateGroupsHelper(pairs, players, 'elo-balanced', '16_mini');
    return groups;
};

export const calculateChampions = (state: TournamentState, getPairName: (id: string, players: Player[], pairs: Pair[]) => string) => {
    let wMain = 'Desconocido', wCons = 'Desconocido';
    const getLastWinner = (round: number, bracket: string) => {
         const m = state.matches.find(x => x.round === round && x.bracket === bracket);
         if (m && m.isFinished) {
             const wid = m.scoreA! > m.scoreB! ? m.pairAId : m.pairBId;
             return getPairName(wid, state.players, state.pairs);
         }
         return null;
    };
    const format = state.format;
    if (format === '16_mini') { wMain = getLastWinner(7, 'main') || wMain; wCons = getLastWinner(8, 'consolation') || wCons; }
    else if (format === '10_mini') { wMain = getLastWinner(6, 'main') || wMain; wCons = getLastWinner(4, 'consolation') || wCons; }
    else if (format === '8_mini') { wMain = getLastWinner(6, 'main') || wMain; wCons = getLastWinner(6, 'consolation') || wCons; }
    else if (format === '12_mini') { wMain = getLastWinner(6, 'main') || wMain; wCons = getLastWinner(5, 'consolation') || wCons; }
    return { wMain, wCons };
};