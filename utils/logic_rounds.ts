
import { Match, Group, TournamentState, Pair, Player, TournamentFormat } from '../types';
import { GROUP_NAMES_16, GROUP_NAMES_12, GROUP_NAMES_10, GROUP_NAMES_8, getRankedPairsForGroup, generateGroupsHelper } from './logic_helpers';

export const recalculateStats = (pairs: Pair[], matches: Match[]) => {
    const statsMap: Record<string, { played: number, won: number, gameDiff: number }> = {};
    pairs.forEach(p => { statsMap[p.id] = { played: 0, won: 0, gameDiff: 0 }; });
    matches.forEach(m => {
        if (!m.isFinished || m.scoreA === null || m.scoreB === null) return;
        if (!statsMap[m.pairAId]) statsMap[m.pairAId] = { played: 0, won: 0, gameDiff: 0 };
        if (!statsMap[m.pairBId]) statsMap[m.pairBId] = { played: 0, won: 0, gameDiff: 0 };
        
        statsMap[m.pairAId].played++; 
        statsMap[m.pairAId].gameDiff += (m.scoreA - m.scoreB);
        if (m.scoreA > m.scoreB) statsMap[m.pairAId].won++;
        
        statsMap[m.pairBId].played++; 
        statsMap[m.pairBId].gameDiff += (m.scoreB - m.scoreA);
        if (m.scoreB > m.scoreA) statsMap[m.pairBId].won++;
    });
    return pairs.map(p => ({ ...p, stats: statsMap[p.id] || { played: 0, won: 0, gameDiff: 0 } }));
};

const createMatches = (groups: Group[], groupId: string, round: number, idxs: number[][], court: number) => {
      const g = groups.find(x => x.id === groupId);
      if(!g) return [];
      return idxs.map((pairIdx, i) => {
          if (!g.pairIds[pairIdx[0]] || !g.pairIds[pairIdx[1]]) return null;
          return {
              round, phase: 'group' as const, bracket: null, courtId: court + i,
              pairAId: g.pairIds[pairIdx[0]], pairBId: g.pairIds[pairIdx[1]],
              scoreA: null, scoreB: null, isFinished: false
          };
      }).filter(Boolean) as Partial<Match>[];
};

export const generateMatches16 = (groups: Group[], courtCount: number): Partial<Match>[] => {
  const matches: Partial<Match>[] = [];
  if (courtCount >= 8) {
      matches.push(...createMatches(groups, 'A', 1, [[0,1], [2,3]], 1));
      matches.push(...createMatches(groups, 'B', 1, [[0,1], [2,3]], 3));
      matches.push(...createMatches(groups, 'C', 1, [[0,1], [2,3]], 5));
      matches.push(...createMatches(groups, 'D', 1, [[0,1], [2,3]], 7));
      matches.push(...createMatches(groups, 'A', 2, [[0,2], [1,3]], 1));
      matches.push(...createMatches(groups, 'B', 2, [[0,2], [1,3]], 3));
      matches.push(...createMatches(groups, 'C', 2, [[0,2], [1,3]], 5));
      matches.push(...createMatches(groups, 'D', 2, [[0,2], [1,3]], 7));
      matches.push(...createMatches(groups, 'A', 3, [[0,3], [1,2]], 1));
      matches.push(...createMatches(groups, 'B', 3, [[0,3], [1,2]], 3));
      matches.push(...createMatches(groups, 'C', 3, [[0,3], [1,2]], 5));
      matches.push(...createMatches(groups, 'D', 3, [[0,3], [1,2]], 7));
      return matches;
  }
  matches.push(...createMatches(groups, 'A', 1, [[0,1], [2,3]], 1));
  matches.push(...createMatches(groups, 'B', 1, [[0,1], [2,3]], 3));
  matches.push(...createMatches(groups, 'C', 1, [[0,1], [2,3]], 5));
  matches.push(...createMatches(groups, 'A', 2, [[0,2], [1,3]], 1));
  matches.push(...createMatches(groups, 'B', 2, [[0,2], [1,3]], 3));
  matches.push(...createMatches(groups, 'D', 2, [[0,1], [2,3]], 5));
  matches.push(...createMatches(groups, 'A', 3, [[0,3], [1,2]], 1));
  matches.push(...createMatches(groups, 'C', 3, [[0,2], [1,3]], 3));
  matches.push(...createMatches(groups, 'D', 3, [[0,2], [1,3]], 5));
  matches.push(...createMatches(groups, 'B', 4, [[0,3], [1,2]], 1));
  matches.push(...createMatches(groups, 'C', 4, [[0,3], [1,2]], 3));
  matches.push(...createMatches(groups, 'D', 4, [[0,3], [1,2]], 5));
  return matches;
};

export const generateMatches12 = (groups: Group[], courtCount: number): Partial<Match>[] => {
    const matches: Partial<Match>[] = [];
    const cA = 1; const cB = 3; const cC = courtCount >= 6 ? 5 : 0; 
    const mk = (gId: string, r: number, p1I: number, p2I: number, c: number) => {
        const g = groups.find(x => x.id === gId);
        if(!g) return null;
        const finalCourt = c === 0 ? 0 : c; 
        return {
            round: r, phase: 'group' as const, bracket: null, courtId: finalCourt,
            pairAId: g.pairIds[p1I], pairBId: g.pairIds[p2I],
            scoreA: null, scoreB: null, isFinished: false
        };
    };
    matches.push(mk('A', 1, 0, 1, cA)!); matches.push(mk('A', 1, 2, 3, cA+1)!);
    matches.push(mk('B', 1, 0, 1, cB)!); matches.push(mk('B', 1, 2, 3, cB+1)!);
    matches.push(mk('C', 1, 0, 1, cC)!); matches.push(mk('C', 1, 2, 3, cC===0 ? 0 : cC+1)!);
    matches.push(mk('A', 2, 0, 2, cA)!); matches.push(mk('A', 2, 1, 3, cA+1)!);
    matches.push(mk('B', 2, 0, 2, cB)!); matches.push(mk('B', 2, 1, 3, cB+1)!);
    matches.push(mk('C', 2, 0, 2, cC)!); matches.push(mk('C', 2, 1, 3, cC===0 ? 0 : cC+1)!);
    matches.push(mk('A', 3, 0, 3, cA)!); matches.push(mk('A', 3, 1, 2, cA+1)!);
    matches.push(mk('B', 3, 0, 3, cB)!); matches.push(mk('B', 3, 1, 2, cB+1)!);
    matches.push(mk('C', 3, 0, 3, cC)!); matches.push(mk('C', 3, 1, 2, cC===0 ? 0 : cC+1)!);
    return matches;
};

export const generateMatches8 = (groups: Group[]): Partial<Match>[] => {
    const matches: Partial<Match>[] = [];
    matches.push(...createMatches(groups, 'A', 1, [[0,1], [2,3]], 1));
    matches.push(...createMatches(groups, 'B', 1, [[0,1], [2,3]], 3));
    matches.push(...createMatches(groups, 'A', 2, [[0,2], [1,3]], 1));
    matches.push(...createMatches(groups, 'B', 2, [[0,2], [1,3]], 3));
    matches.push(...createMatches(groups, 'A', 3, [[0,3], [1,2]], 1));
    matches.push(...createMatches(groups, 'B', 3, [[0,3], [1,2]], 3));
    return matches;
};

export const generateMatches10 = (groups: Group[]): Partial<Match>[] => {
    const matches: Partial<Match>[] = [];
    const gA = groups.find(g => g.id === 'A')?.pairIds || [];
    const gB = groups.find(g => g.id === 'B')?.pairIds || [];
    if (gA.length !== 5 || gB.length !== 5) return [];
    const mk = (r: number, c: number, idA: string, idB: string) => ({ round: r, phase: 'group' as const, bracket: null, courtId: c, pairAId: idA, pairBId: idB, scoreA: null, scoreB: null, isFinished: false });
    matches.push(mk(1, 1, gA[0], gA[1])); matches.push(mk(1, 2, gA[2], gA[3])); matches.push(mk(1, 3, gA[4], gB[0])); matches.push(mk(1, 4, gB[1], gB[2])); matches.push(mk(1, 5, gB[3], gB[4]));
    matches.push(mk(2, 1, gA[0], gA[2])); matches.push(mk(2, 2, gA[1], gA[4])); matches.push(mk(2, 3, gA[3], gB[1])); matches.push(mk(2, 4, gB[0], gB[2])); matches.push(mk(2, 5, gB[4], gB[3])); 
    matches.push(mk(3, 1, gA[0], gA[3])); matches.push(mk(3, 2, gA[1], gA[2])); matches.push(mk(3, 3, gA[4], gB[2])); matches.push(mk(3, 4, gB[0], gB[4])); matches.push(mk(3, 5, gB[1], gB[3])); 
    return matches;
};

export const generateNextRoundMatches = (state: TournamentState, courtCount: number): Partial<Match>[] => {
    const nextRound = state.currentRound + 1;
    const format = state.format;
    const matches: Partial<Match>[] = [];

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
        
        if (state.currentRound === qfStart - 1) { 
            const sA = getRankedPairsForGroup(state.pairs, state.groups, 'A'); const sB = getRankedPairsForGroup(state.pairs, state.groups, 'B');
            const sC = getRankedPairsForGroup(state.pairs, state.groups, 'C'); const sD = getRankedPairsForGroup(state.pairs, state.groups, 'D');
            const mk = (c: number, p1: string, p2: string, b: string) => ({ round: nextRound, phase: 'qf' as const, bracket: b as any, courtId: c, pairAId: p1, pairBId: p2, isFinished: false });
            matches.push(mk(1, sA[0].id, sC[1].id, 'main')); matches.push(mk(2, sC[0].id, sA[1].id, 'main')); matches.push(mk(3, sB[0].id, sD[1].id, 'main')); matches.push(mk(4, sD[0].id, sB[1].id, 'main'));
            matches.push(mk(5, sA[2].id, sC[3].id, 'consolation')); matches.push(mk(6, sC[2].id, sA[3].id, 'consolation')); matches.push(mk(0, sB[2].id, sD[3].id, 'consolation')); matches.push(mk(0, sD[2].id, sB[3].id, 'consolation'));
        } 
        else if (state.currentRound === qfStart) {
             matches.push({ round: nextRound, phase: 'sf', bracket: 'main', courtId: 1, pairAId: getW(qfStart, 'main', 1)!, pairBId: getW(qfStart, 'main', 3)!, isFinished: false });
             matches.push({ round: nextRound, phase: 'sf', bracket: 'main', courtId: 2, pairAId: getW(qfStart, 'main', 2)!, pairBId: getW(qfStart, 'main', 4)!, isFinished: false });
             const waitingMatches = state.matches.filter(m => m.round === state.currentRound && m.courtId === 0);
             waitingMatches.forEach((m, idx) => { matches.push({ round: nextRound, phase: 'qf', bracket: 'consolation', courtId: 3 + idx, pairAId: m.pairAId, pairBId: m.pairBId, isFinished: false }); });
        }
        else if (state.currentRound === qfStart + 1) {
             matches.push({ round: nextRound, phase: 'final', bracket: 'main', courtId: 1, pairAId: getW(qfStart+1, 'main', 1)!, pairBId: getW(qfStart+1, 'main', 2)!, isFinished: false });
             matches.push({ round: nextRound, phase: 'sf', bracket: 'consolation', courtId: 2, pairAId: getW(qfStart, 'consolation', 5)!, pairBId: getW(qfStart+1, 'consolation', 3)!, isFinished: false });
             matches.push({ round: nextRound, phase: 'sf', bracket: 'consolation', courtId: 3, pairAId: getW(qfStart, 'consolation', 6)!, pairBId: getW(qfStart+1, 'consolation', 4)!, isFinished: false });
        }
        else if (state.currentRound === qfStart + 2) {
             matches.push({ round: nextRound, phase: 'final', bracket: 'consolation', courtId: 1, pairAId: getW(qfStart+2, 'consolation', 2)!, pairBId: getW(qfStart+2, 'consolation', 3)!, isFinished: false });
        }
    }

    if (format === '10_mini') {
        if (state.currentRound === 3) { 
            const sA = getRankedPairsForGroup(state.pairs, state.groups, 'A'); const sB = getRankedPairsForGroup(state.pairs, state.groups, 'B');
            const mk = (c: number, p1: string, p2: string, b: string) => ({ round: 4, phase: b === 'main' ? 'qf' as const : 'final' as const, bracket: b as any, courtId: c, pairAId: p1, pairBId: p2, isFinished: false });
            matches.push(mk(1, sA[0].id, sB[3].id, 'main')); matches.push(mk(2, sB[0].id, sA[3].id, 'main')); matches.push(mk(3, sA[1].id, sB[2].id, 'main')); matches.push(mk(4, sB[1].id, sA[2].id, 'main'));
            matches.push(mk(5, sA[4].id, sB[4].id, 'consolation'));
        } else if (state.currentRound === 4) {
             matches.push({ round: 5, phase: 'sf', bracket: 'main', courtId: 1, pairAId: getW(4, 'main', 1)!, pairBId: getW(4, 'main', 3)!, isFinished: false });
             matches.push({ round: 5, phase: 'sf', bracket: 'main', courtId: 2, pairAId: getW(4, 'main', 2)!, pairBId: getW(4, 'main', 4)!, isFinished: false });
        } else if (state.currentRound === 5) {
             matches.push({ round: 6, phase: 'final', bracket: 'main', courtId: 1, pairAId: getW(5, 'main', 1)!, pairBId: getW(5, 'main', 2)!, isFinished: false });
        }
    }

    if (format === '8_mini') {
        if (state.currentRound === 3) {
             const sA = getRankedPairsForGroup(state.pairs, state.groups, 'A'); const sB = getRankedPairsForGroup(state.pairs, state.groups, 'B');
             const mk = (c: number, p1: string, p2: string) => ({ round: 4, phase: 'qf' as const, bracket: 'main' as any, courtId: c, pairAId: p1, pairBId: p2, isFinished: false });
             // Modified Logic for Mini 8: 1A vs 2B, 1B vs 2A, 3A vs 4B, 3B vs 4A
             matches.push(mk(1, sA[0].id, sB[1].id)); // 1A vs 2B
             matches.push(mk(2, sB[0].id, sA[1].id)); // 1B vs 2A
             matches.push(mk(3, sA[2].id, sB[3].id)); // 3A vs 4B
             matches.push(mk(4, sB[2].id, sA[3].id)); // 3B vs 4A
        } else if (state.currentRound === 4) {
             matches.push({ round: 5, phase: 'sf', bracket: 'main', courtId: 1, pairAId: getW(4, 'main', 1)!, pairBId: getW(4, 'main', 3)!, isFinished: false });
             matches.push({ round: 5, phase: 'sf', bracket: 'main', courtId: 2, pairAId: getW(4, 'main', 2)!, pairBId: getW(4, 'main', 4)!, isFinished: false });
             matches.push({ round: 5, phase: 'sf', bracket: 'consolation', courtId: 3, pairAId: getL(4, 'main', 1)!, pairBId: getL(4, 'main', 3)!, isFinished: false });
             matches.push({ round: 5, phase: 'sf', bracket: 'consolation', courtId: 4, pairAId: getL(4, 'main', 2)!, pairBId: getL(4, 'main', 4)!, isFinished: false });
        } else if (state.currentRound === 5) {
             matches.push({ round: 6, phase: 'final', bracket: 'main', courtId: 1, pairAId: getW(5, 'main', 1)!, pairBId: getW(5, 'main', 2)!, isFinished: false });
             matches.push({ round: 6, phase: 'final', bracket: 'consolation', courtId: 2, pairAId: getW(5, 'consolation', 3)!, pairBId: getW(5, 'consolation', 4)!, isFinished: false });
        }
    }

    if (format === '12_mini') {
        if (state.currentRound === 3) { 
             const sA = getRankedPairsForGroup(state.pairs, state.groups, 'A'); const sB = getRankedPairsForGroup(state.pairs, state.groups, 'B'); const sC = getRankedPairsForGroup(state.pairs, state.groups, 'C');
             const thirds = [sA[2], sB[2], sC[2]].sort((a,b) => { if(b.stats.won !== a.stats.won) return b.stats.won - a.stats.won; return b.stats.gameDiff - a.stats.gameDiff; });
             const best3rds = [thirds[0].id, thirds[1].id]; const worst3rd = thirds[2].id;
             const consPool = [worst3rd, sA[3].id, sB[3].id, sC[3].id];
             
             const mkM = (c: number, p1: string, p2: string) => ({ round: 4, phase: 'qf' as const, bracket: 'main' as any, courtId: c, pairAId: p1, pairBId: p2, isFinished: false });
             const mkC = (c: number, p1: string, p2: string) => ({ round: 4, phase: 'sf' as const, bracket: 'consolation' as any, courtId: c, pairAId: p1, pairBId: p2, isFinished: false });
             matches.push(mkM(1, sA[0].id, best3rds[1])); matches.push(mkM(2, sB[0].id, best3rds[0])); matches.push(mkM(3, sC[0].id, sA[1].id)); matches.push(mkM(4, sB[1].id, sC[1].id));
             matches.push(mkC(5, consPool[0], consPool[1])); matches.push(mkC(6, consPool[2], consPool[3]));
        } else if (state.currentRound === 4) { 
             matches.push({ round: 5, phase: 'sf', bracket: 'main', courtId: 1, pairAId: getW(4, 'main', 1)!, pairBId: getW(4, 'main', 3)!, isFinished: false });
             matches.push({ round: 5, phase: 'sf', bracket: 'main', courtId: 2, pairAId: getW(4, 'main', 2)!, pairBId: getW(4, 'main', 4)!, isFinished: false });
             matches.push({ round: 5, phase: 'final', bracket: 'consolation', courtId: 3, pairAId: getW(4, 'consolation', 5)!, pairBId: getW(4, 'consolation', 6)!, isFinished: false });
        } else if (state.currentRound === 5) { 
             matches.push({ round: 6, phase: 'final', bracket: 'main', courtId: 1, pairAId: getW(5, 'main', 1)!, pairBId: getW(5, 'main', 2)!, isFinished: false });
        }
    }

    return matches;
};

export const reconstructGroupsFromMatches = (pairs: Pair[], matches: Match[], players: Player[], format: TournamentFormat): Group[] => {
    const groupMap: Record<string, Set<string>> = { 'A': new Set(), 'B': new Set(), 'C': new Set(), 'D': new Set() };
    
    // Explicit 10 Pair Logic
    if (format === '10_mini') {
        matches.filter(m => m.round === 1).forEach(m => {
             if ([1,2].includes(m.courtId)) { groupMap['A'].add(m.pairAId); groupMap['A'].add(m.pairBId); }
             else if ([4,5].includes(m.courtId)) { groupMap['B'].add(m.pairAId); groupMap['B'].add(m.pairBId); }
             else if (m.courtId === 3) { groupMap['A'].add(m.pairAId); groupMap['B'].add(m.pairBId); }
        });
        if (groupMap['A'].size > 0) return GROUP_NAMES_10.map(id => ({ id, pairIds: Array.from(groupMap[id]) }));
        return generateGroupsHelper(pairs, players, 'elo-balanced', '10_mini');
    }

    // Explicit 12 Pair Logic
    if (format === '12_mini') {
         matches.filter(m => m.round === 1).forEach(m => {
             if([1,2].includes(m.courtId)) { groupMap['A'].add(m.pairAId); groupMap['A'].add(m.pairBId); }
             if([3,4].includes(m.courtId)) { groupMap['B'].add(m.pairAId); groupMap['B'].add(m.pairBId); }
             if([5,6,0].includes(m.courtId)) { groupMap['C'].add(m.pairAId); groupMap['C'].add(m.pairBId); }
         });
         if (groupMap['A'].size > 0) return GROUP_NAMES_12.map(id => ({ id, pairIds: Array.from(groupMap[id]) }));
         return generateGroupsHelper(pairs, players, 'elo-balanced', '12_mini');
    }

    // Explicit 8 Pair Logic
    if (format === '8_mini') {
         matches.filter(m => m.round === 1).forEach(m => {
             if([1,2].includes(m.courtId)) { groupMap['A'].add(m.pairAId); groupMap['A'].add(m.pairBId); }
             if([3,4].includes(m.courtId)) { groupMap['B'].add(m.pairAId); groupMap['B'].add(m.pairBId); }
         });
         if (groupMap['A'].size > 0) return GROUP_NAMES_8.map(id => ({ id, pairIds: Array.from(groupMap[id]) }));
         return generateGroupsHelper(pairs, players, 'elo-balanced', '8_mini');
    }
    
    // Default 16_mini logic (Simultaneous vs Rotativo)
    // IMPORTANT: In Rotativo, Group D plays in Round 2. We scan Round 1 AND Round 2.
    const hasCourt7or8 = matches.some(m => m.round === 1 && m.courtId >= 7);
    
    matches.forEach(m => {
        if (m.phase !== 'group') return;
        let targetGroup = '';
        
        if (hasCourt7or8) {
            // Simultaneous (>= 8 courts) - R1 is enough
            if (m.round === 1) {
                if ([1,2].includes(m.courtId)) targetGroup = 'A';
                else if ([3,4].includes(m.courtId)) targetGroup = 'B';
                else if ([5,6].includes(m.courtId)) targetGroup = 'C';
                else if ([7,8].includes(m.courtId)) targetGroup = 'D'; 
            }
        } else {
            // Rotativo (< 8 courts)
            // R1: A(1,2), B(3,4), C(5,6)
            if (m.round === 1) {
                if ([1,2].includes(m.courtId)) targetGroup = 'A';
                else if ([3,4].includes(m.courtId)) targetGroup = 'B';
                else if ([5,6].includes(m.courtId)) targetGroup = 'C';
            }
            // R2: A(1,2), B(3,4), D(5,6) - D starts here!
            else if (m.round === 2) {
                 if ([5,6].includes(m.courtId)) targetGroup = 'D';
            }
        }
        
        if (targetGroup && groupMap[targetGroup]) {
            groupMap[targetGroup].add(m.pairAId);
            groupMap[targetGroup].add(m.pairBId);
        }
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
