
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { TournamentState, TournamentAction, Player, Pair, Match, Group, TournamentFormat, GenerationMethod } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useHistory } from './HistoryContext'; // Import HistoryContext to access Club Data
import { calculateDisplayRanking } from '../utils/Elo';

const GROUP_NAMES_16 = ['A', 'B', 'C', 'D'];
const GROUP_NAMES_10 = ['A', 'B'];
const STORAGE_KEY = 'padelpro_local_db_v3'; 
export const TOURNAMENT_CATEGORIES = ['Iniciación', '5ª CAT', '4ª CAT', '3ª CAT', '2ª CAT', '1ª CAT'];

// --- HELPERS ---

export const getPairElo = (pair: Pair, players: Player[]): number => {
    const p1 = players.find(p => p.id === pair.player1Id);
    const p2 = players.find(p => p.id === pair.player2Id);
    const score1 = p1 ? calculateDisplayRanking(p1) : 1200;
    const score2 = p2 ? calculateDisplayRanking(p2) : 1200;
    return score1 + score2;
};

const sortPairsByMethod = (pairs: Pair[], players: Player[], method: GenerationMethod): Pair[] => {
    let activePairs = pairs; 
    
    if (method === 'arrival') {
        return [...activePairs].sort((a, b) => (a.id > b.id ? 1 : -1)); 
    } 
    
    if (method === 'elo-balanced') {
        return [...activePairs].sort((a, b) => {
            const eloA = getPairElo(a, players);
            const eloB = getPairElo(b, players);
            return eloB - eloA;
        });
    } 
    
    if (method === 'elo-mixed') {
        return [...activePairs].sort((a, b) => {
            const eloA = getPairElo(a, players);
            const eloB = getPairElo(b, players);
            return eloB - eloA;
        });
    }

    return activePairs; 
};

// --- GROUP GENERATOR ---
const generateGroupsHelper = (pairs: Pair[], players: Player[], method: GenerationMethod = 'manual', format: TournamentFormat = '16_mini'): Group[] => {
  const limit = format === '10_mini' ? 10 : 16;
  
  let sortedPairs = sortPairsByMethod(pairs, players, method);
  const titularPairs = sortedPairs.slice(0, limit);

  const groups: Group[] = [];
  
  if (format === '16_mini') {
      if (method === 'elo-mixed') {
        const pot1 = titularPairs.slice(0, 4);   
        const pot2 = titularPairs.slice(4, 8);   
        const pot3 = titularPairs.slice(8, 12);  
        const pot4 = titularPairs.slice(12, 16); 
        // Snake / Pot distribution: One from each strength tier to each group
        groups.push({ id: 'A', pairIds: [pot1[0], pot2[0], pot3[0], pot4[0]].filter(Boolean).map(p=>p.id) });
        groups.push({ id: 'B', pairIds: [pot1[1], pot2[1], pot3[1], pot4[1]].filter(Boolean).map(p=>p.id) });
        groups.push({ id: 'C', pairIds: [pot1[2], pot2[2], pot3[2], pot4[2]].filter(Boolean).map(p=>p.id) });
        groups.push({ id: 'D', pairIds: [pot1[3], pot2[3], pot3[3], pot4[3]].filter(Boolean).map(p=>p.id) });
      } else {
        // Balanced / Arrival / Manual: Sequential fill
        // A gets best 4, B gets next 4...
        for (let i = 0; i < 4; i++) {
            groups.push({
                id: GROUP_NAMES_16[i],
                pairIds: titularPairs.slice(i * 4, (i + 1) * 4).map(p => p.id)
            });
        }
      }
  } else if (format === '10_mini') {
      if (method === 'elo-mixed') {
          // Cremallera: 1->A, 2->B, 3->A, 4->B...
          const groupA: Pair[] = [];
          const groupB: Pair[] = [];
          titularPairs.forEach((p, idx) => {
              if (idx % 2 === 0) groupA.push(p); 
              else groupB.push(p); 
          });
          groups.push({ id: 'A', pairIds: groupA.map(p => p.id) });
          groups.push({ id: 'B', pairIds: groupB.map(p => p.id) });
      } else {
          // Balanced: Top 5 to A, Bottom 5 to B
          groups.push({ id: 'A', pairIds: titularPairs.slice(0, 5).map(p => p.id) });
          groups.push({ id: 'B', pairIds: titularPairs.slice(5, 10).map(p => p.id) });
      }
  }

  return groups;
};

// --- MATCH GENERATORS ---

const generateMatches16 = (groups: Group[], courtCount: number): Partial<Match>[] => {
  const matches: Partial<Match>[] = [];
  const createMatches = (groupId: string, round: number, idxs: number[][], court: number) => {
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

  // LOGIC FORK: 8+ COURTS = SIMULTANEOUS (No Breaks)
  if (courtCount >= 8) {
      // Round 1 (All groups play internal matches)
      // A on 1-2, B on 3-4, C on 5-6, D on 7-8
      matches.push(...createMatches('A', 1, [[0,1], [2,3]], 1));
      matches.push(...createMatches('B', 1, [[0,1], [2,3]], 3));
      matches.push(...createMatches('C', 1, [[0,1], [2,3]], 5));
      matches.push(...createMatches('D', 1, [[0,1], [2,3]], 7));

      // Round 2
      matches.push(...createMatches('A', 2, [[0,2], [1,3]], 1));
      matches.push(...createMatches('B', 2, [[0,2], [1,3]], 3));
      matches.push(...createMatches('C', 2, [[0,2], [1,3]], 5));
      matches.push(...createMatches('D', 2, [[0,2], [1,3]], 7));

      // Round 3
      matches.push(...createMatches('A', 3, [[0,3], [1,2]], 1));
      matches.push(...createMatches('B', 3, [[0,3], [1,2]], 3));
      matches.push(...createMatches('C', 3, [[0,3], [1,2]], 5));
      matches.push(...createMatches('D', 3, [[0,3], [1,2]], 7));

      return matches;
  }
  
  // LOGIC FALLBACK: < 8 COURTS = ROTATING (With Breaks)
  // Hardcoded Americano 16 Logic for 6 courts
  matches.push(...createMatches('A', 1, [[0,1], [2,3]], 1));
  matches.push(...createMatches('B', 1, [[0,1], [2,3]], 3));
  matches.push(...createMatches('C', 1, [[0,1], [2,3]], 5));
  
  matches.push(...createMatches('A', 2, [[0,2], [1,3]], 1));
  matches.push(...createMatches('B', 2, [[0,2], [1,3]], 3));
  matches.push(...createMatches('D', 2, [[0,1], [2,3]], 5));
  
  matches.push(...createMatches('A', 3, [[0,3], [1,2]], 1));
  matches.push(...createMatches('C', 3, [[0,2], [1,3]], 3));
  matches.push(...createMatches('D', 3, [[0,2], [1,3]], 5));
  
  matches.push(...createMatches('B', 4, [[0,3], [1,2]], 1));
  matches.push(...createMatches('C', 4, [[0,3], [1,2]], 3));
  matches.push(...createMatches('D', 4, [[0,3], [1,2]], 5));

  return matches;
};

const generateMatches10 = (groups: Group[]): Partial<Match>[] => {
    const matches: Partial<Match>[] = [];
    const gA = groups.find(g => g.id === 'A')?.pairIds || [];
    const gB = groups.find(g => g.id === 'B')?.pairIds || [];

    if (gA.length !== 5 || gB.length !== 5) return [];

    const mk = (r: number, c: number, idA: string, idB: string) => ({
        round: r, phase: 'group' as const, bracket: null, courtId: c,
        pairAId: idA, pairBId: idB, scoreA: null, scoreB: null, isFinished: false
    });

    // ROUND 1
    matches.push(mk(1, 1, gA[0], gA[1])); 
    matches.push(mk(1, 2, gA[2], gA[3]));
    matches.push(mk(1, 3, gA[4], gB[0])); // Cross
    matches.push(mk(1, 4, gB[1], gB[2]));
    matches.push(mk(1, 5, gB[3], gB[4]));

    // ROUND 2
    matches.push(mk(2, 1, gA[0], gA[2])); 
    matches.push(mk(2, 2, gA[1], gA[4])); 
    matches.push(mk(2, 3, gA[3], gB[1])); // Cross
    matches.push(mk(2, 4, gB[0], gB[2])); 
    matches.push(mk(2, 5, gB[4], gB[3])); 

    // ROUND 3
    matches.push(mk(3, 1, gA[0], gA[3])); 
    matches.push(mk(3, 2, gA[1], gA[2])); 
    matches.push(mk(3, 3, gA[4], gB[2])); // Cross
    matches.push(mk(3, 4, gB[0], gB[4])); 
    matches.push(mk(3, 5, gB[1], gB[3])); 

    return matches;
};

// --- DATA RECONSTRUCTION ---

const reconstructGroupsFromMatches = (pairs: Pair[], matches: Match[], players: Player[], format: TournamentFormat): Group[] => {
    const groupMap: Record<string, Set<string>> = {
        'A': new Set(), 'B': new Set(), 'C': new Set(), 'D': new Set()
    };

    if (format === '10_mini') {
        // Try to infer from Round 1 Court IDs for persistence logic
        // Court 1,2 -> A. Court 4,5 -> B. Court 3 -> A(pairA) B(pairB)
        const round1 = matches.filter(m => m.round === 1);
        
        if (round1.length > 0) {
            round1.forEach(m => {
                if (m.courtId === 1 || m.courtId === 2) {
                    groupMap['A'].add(m.pairAId);
                    groupMap['A'].add(m.pairBId);
                } else if (m.courtId === 4 || m.courtId === 5) {
                    groupMap['B'].add(m.pairAId);
                    groupMap['B'].add(m.pairBId);
                } else if (m.courtId === 3) {
                    groupMap['A'].add(m.pairAId); // In generation, pairA is from group A
                    groupMap['B'].add(m.pairBId); // In generation, pairB is from group B
                }
            });
            return GROUP_NAMES_10.map(name => ({ id: name, pairIds: Array.from(groupMap[name]) }));
        }

        // Fallback if no matches found yet
        return generateGroupsHelper(pairs, players, 'elo-balanced', '10_mini');
    }

    // 16_mini Reconstruction
    matches.forEach(m => {
        if (m.phase !== 'group') return;
        let targetGroup = '';
        if (m.round === 1) {
            if (m.courtId === 1 || m.courtId === 2) targetGroup = 'A';
            else if (m.courtId === 3 || m.courtId === 4) targetGroup = 'B';
            else if (m.courtId === 5 || m.courtId === 6) targetGroup = 'C';
            else if (m.courtId === 7 || m.courtId === 8) targetGroup = 'D'; 
        } 
        if (targetGroup && groupMap[targetGroup]) {
            groupMap[targetGroup].add(m.pairAId);
            groupMap[targetGroup].add(m.pairBId);
        }
    });

    const groups: Group[] = GROUP_NAMES_16.map(name => ({
        id: name, pairIds: Array.from(groupMap[name])
    }));

    if (groups.reduce((acc, g) => acc + g.pairIds.length, 0) < 16 && matches.length === 0) {
        return generateGroupsHelper(pairs, players, 'elo-balanced', '16_mini');
    }
    return groups;
};

const recalculateStats = (pairs: Pair[], matches: Match[]) => {
    const statsMap: Record<string, { played: number, won: number, gameDiff: number }> = {};
    pairs.forEach(p => { statsMap[p.id] = { played: 0, won: 0, gameDiff: 0 }; });

    matches.forEach(m => {
        if (!m.isFinished || m.scoreA === null || m.scoreB === null) return;
        if (!statsMap[m.pairAId]) statsMap[m.pairAId] = { played: 0, won: 0, gameDiff: 0 };
        if (!statsMap[m.pairBId]) statsMap[m.pairBId] = { played: 0, won: 0, gameDiff: 0 };
        
        statsMap[m.pairAId].played += 1;
        statsMap[m.pairAId].gameDiff += (m.scoreA - m.scoreB);
        if (m.scoreA > m.scoreB) statsMap[m.pairAId].won += 1;
        
        statsMap[m.pairBId].played += 1;
        statsMap[m.pairBId].gameDiff += (m.scoreB - m.scoreA);
        if (m.scoreB > m.scoreA) statsMap[m.pairBId].won += 1;
    });
    return pairs.map(p => ({ ...p, stats: statsMap[p.id] || { played: 0, won: 0, gameDiff: 0 } }));
};

const getRankedPairsForGroup = (pairs: Pair[], groups: Group[], groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return [];
    const groupPairs = group.pairIds.map(pid => pairs.find(p => p.id === pid)).filter(Boolean) as Pair[];
    return groupPairs.sort((a, b) => {
        if (b.stats.won !== a.stats.won) return b.stats.won - a.stats.won;
        return b.stats.gameDiff - a.stats.gameDiff;
    });
};

const initialState: TournamentState = {
  status: 'setup',
  currentRound: 0,
  format: '16_mini',
  players: [],
  pairs: [],
  matches: [],
  groups: [],
  courts: [], 
  loading: true
};

// --- CONTEXT ---
interface TournamentContextType {
    state: TournamentState;
    dispatch: React.Dispatch<TournamentAction>;
    loadData: () => Promise<void>;
    addPlayerToDB: (p: Partial<Player>) => Promise<string | null>;
    updatePlayerInDB: (p: Partial<Player>) => Promise<void>;
    createPairInDB: (p1: string, p2: string) => Promise<void>;
    updatePairDB: (pairId: string, p1: string, p2: string) => Promise<void>;
    startTournamentDB: (method: GenerationMethod, customOrderedPairs?: Pair[]) => Promise<void>;
    updateScoreDB: (matchId: string, sA: number, sB: number) => Promise<void>;
    nextRoundDB: () => Promise<void>;
    deletePairDB: (pairId: string) => Promise<void>;
    archiveAndResetDB: () => Promise<void>;
    resetToSetupDB: () => Promise<void>; 
    regenerateMatchesDB: () => Promise<string>;
    hardResetDB: () => Promise<void>;
    formatPlayerName: (p?: Player) => string;
}

const TournamentContext = createContext<TournamentContextType>({
    state: initialState,
    dispatch: () => null,
    loadData: async () => {},
    addPlayerToDB: async () => null,
    updatePlayerInDB: async () => {},
    createPairInDB: async () => {},
    updatePairDB: async () => {},
    startTournamentDB: async () => {},
    updateScoreDB: async () => {},
    nextRoundDB: async () => {},
    deletePairDB: async () => {},
    archiveAndResetDB: async () => {},
    resetToSetupDB: async () => {},
    regenerateMatchesDB: async () => "",
    hardResetDB: async () => {},
    formatPlayerName: () => ''
});

const reducer = (state: TournamentState, action: TournamentAction): TournamentState => {
    switch (action.type) {
        case 'SET_STATE': return { ...state, ...action.payload };
        case 'SET_FORMAT': return { ...state, format: action.payload };
        case 'SET_LOADING': return { ...state, loading: action.payload };
        case 'RESET_LOCAL': return initialState;
        case 'TOGGLE_BALLS': return { ...state, courts: state.courts.map(c => c.id === action.payload ? { ...c, ballsGiven: !c.ballsGiven } : c) };
        case 'TOGGLE_WATER': return { ...state, pairs: state.pairs.map(p => p.id === action.payload ? { ...p, waterReceived: !p.waterReceived } : p) };
        case 'TOGGLE_PAID': return { ...state, pairs: state.pairs.map(p => { if (p.player1Id === action.payload) return { ...p, paidP1: !p.paidP1 }; if (p.player2Id === action.payload) return { ...p, paidP2: !p.paidP2 }; return p; }) };
        case 'LOAD_DEMO_DATA':
             const demoPlayers: Player[] = Array.from({ length: 32 }, (_, i) => ({ id: `demo-p-${i}`, name: `Jugador ${i+1}`, categories: ['4ª CAT'], user_id: 'dev' }));
             const demoPairs: Pair[] = [];
             for(let i=0; i<16; i++) { demoPairs.push({ id: `pair-${i}`, player1Id: demoPlayers[i*2].id, player2Id: demoPlayers[i*2+1].id, name: 'Pareja', waterReceived: false, paidP1: false, paidP2: false, stats: {played:0, won:0, gameDiff:0}, isReserve: false }); }
             return { ...state, players: demoPlayers, pairs: demoPairs, status: 'setup', format: '16_mini' };
        default: return state;
    }
};

export const TournamentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(reducer, initialState);
    const { user, isOfflineMode } = useAuth();
    const { clubData } = useHistory(); // Access club data to get court count

    const formatPlayerName = useCallback((p?: Player) => {
        if (!p) return 'Jugador';
        if (p.nickname) return p.nickname;
        
        const parts = p.name.trim().split(/\s+/);
        if (parts.length >= 2) {
            const firstName = parts[0];
            const lastName = parts[1];
            return `${firstName} ${lastName.substring(0, 3)}.`;
        }
        return parts[0];
    }, []);

    const loadData = useCallback(async () => {
        if (!user) return;
        dispatch({ type: 'SET_LOADING', payload: true });

        // Dynamic Courts based on Club Data
        const courts = Array.from({ length: clubData.courtCount }, (_, i) => ({ id: i + 1, ballsGiven: false }));

        if (isOfflineMode) {
            const localData = localStorage.getItem(STORAGE_KEY);
            if (localData) {
                const parsed = JSON.parse(localData);
                // Ensure courts are updated even if loaded from local state (to reflect club changes)
                dispatch({ type: 'SET_STATE', payload: { ...parsed, courts: courts } });
            } else {
                dispatch({ type: 'SET_STATE', payload: { players: [], pairs: [], status: 'setup', courts: courts } });
            }
            dispatch({ type: 'SET_LOADING', payload: false });
            return;
        }

        try {
            const { data: players } = await supabase.from('players').select('*').eq('user_id', user.id).order('name');
            const { data: tournaments } = await supabase.from('tournaments').select('*').eq('user_id', user.id).neq('status', 'finished').limit(1);
            const activeTournament = tournaments?.[0];

            if (!activeTournament) {
                dispatch({ type: 'SET_STATE', payload: { id: undefined, status: 'setup', players: players || [], pairs: [], matches: [], groups: [], courts } });
            } else {
                const { data: pairs } = await supabase.from('tournament_pairs').select('*').eq('tournament_id', activeTournament.id).order('created_at', { ascending: true });
                const { data: matches } = await supabase.from('matches').select('*').eq('tournament_id', activeTournament.id);
                
                const format: TournamentFormat = activeTournament.format || '16_mini';
                const limit = format === '10_mini' ? 10 : 16;

                let mappedPairs: Pair[] = (pairs || []).map(p => ({
                    id: p.id, tournament_id: p.tournament_id, player1Id: p.player1_id, player2Id: p.player2_id,
                    name: p.name || 'Pareja', waterReceived: p.water_received, paidP1: p.paid_p1, paidP2: p.paid_p2,
                    stats: { played: 0, won: 0, gameDiff: 0 }, 
                    isReserve: false 
                }));
                
                mappedPairs = mappedPairs.map((p, idx) => ({ ...p, isReserve: idx >= limit }));

                const mappedMatches: Match[] = (matches || []).map(m => ({
                    id: m.id, round: m.round, 
                    phase: m.phase || (m.round <= 4 ? 'group' : m.round === 5 ? 'qf' : m.round === 6 ? 'sf' : 'final'), 
                    bracket: m.bracket as any,
                    courtId: m.court_id, pairAId: m.pair_a_id, pairBId: m.pair_b_id,
                    scoreA: m.score_a, scoreB: m.score_b, isFinished: m.is_finished
                }));

                mappedPairs = recalculateStats(mappedPairs, mappedMatches);
                
                let groups: Group[] = [];
                if (mappedMatches.length > 0) {
                    groups = reconstructGroupsFromMatches(mappedPairs, mappedMatches, players || [], format);
                } else {
                    const isSetup = activeTournament.status === 'setup';
                    // NOTE: This fallback generates default Balanced/Manual groups if no matches exist yet.
                    groups = generateGroupsHelper(mappedPairs, players || [], isSetup ? 'manual' : 'elo-balanced', format);
                }

                dispatch({ type: 'SET_STATE', payload: {
                    id: activeTournament.id, status: activeTournament.status as any, currentRound: activeTournament.current_round || 0,
                    players: players || [], pairs: mappedPairs, matches: mappedMatches, groups: groups, format, courts
                }});
            }
        } catch (e) {
            console.warn("Supabase load error:", e);
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    }, [user, isOfflineMode, clubData.courtCount]); // Re-load if court count changes

    useEffect(() => { loadData(); }, [loadData]);

    const saveLocal = (newState: TournamentState) => {
        if (isOfflineMode) localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    };

    // --- DB ACTIONS ---
    const addPlayerToDB = async (p: Partial<Player>) => {
        if (isOfflineMode) {
             const newPlayer = { ...p, id: `local-${Date.now()}`, created_at: new Date().toISOString() } as Player;
             const newState = { ...state, players: [...state.players, newPlayer] };
             dispatch({ type: 'SET_STATE', payload: newState });
             saveLocal(newState);
             return newPlayer.id;
        }
        const { data, error } = await supabase.from('players').insert([{ ...p, user_id: user?.id }]).select().single();
        if (error) { alert(error.message); return null; }
        await loadData();
        return data.id;
    };

    const updatePlayerInDB = async (p: Partial<Player>) => {
        if (isOfflineMode) {
            const newState = { ...state, players: state.players.map(x => x.id === p.id ? { ...x, ...p } as Player : x) };
            dispatch({ type: 'SET_STATE', payload: newState });
            saveLocal(newState);
            return;
        }
        await supabase.from('players').update(p).eq('id', p.id);
        await loadData();
    };

    const createPairInDB = async (p1: string, p2: string) => {
        if (isOfflineMode) {
            const newPair: Pair = { id: `pair-${Date.now()}`, player1Id: p1, player2Id: p2, name: 'Pareja', waterReceived: false, paidP1: false, paidP2: false, stats: {played:0, won:0, gameDiff:0}, isReserve: false };
            const limit = state.format === '10_mini' ? 10 : 16;
            newPair.isReserve = state.pairs.length >= limit;
            const newState = { ...state, pairs: [...state.pairs, newPair] };
            dispatch({ type: 'SET_STATE', payload: newState });
            saveLocal(newState);
            return;
        }
        
        let tournamentId = state.id;
        if (!tournamentId) {
             const { data: t } = await supabase.from('tournaments').insert([{ user_id: user?.id, status: 'setup', format: state.format }]).select().single();
             tournamentId = t.id;
        }
        await supabase.from('tournament_pairs').insert([{ tournament_id: tournamentId, player1_id: p1, player2_id: p2 }]);
        await loadData();
    };

    const updatePairDB = async (pairId: string, p1: string, p2: string) => {
        if (isOfflineMode) {
             const newState = { ...state, pairs: state.pairs.map(p => p.id === pairId ? { ...p, player1Id: p1, player2Id: p2 } : p) };
             dispatch({ type: 'SET_STATE', payload: newState });
             saveLocal(newState);
             return;
        }
        await supabase.from('tournament_pairs').update({ player1_id: p1, player2_id: p2 }).eq('id', pairId);
        await loadData();
    };

    const deletePairDB = async (pairId: string) => {
        if (isOfflineMode) {
            const remaining = state.pairs.filter(p => p.id !== pairId);
            const limit = state.format === '10_mini' ? 10 : 16;
            const reindexed = remaining.map((p, idx) => ({ ...p, isReserve: idx >= limit }));
            const newState = { ...state, pairs: reindexed };
            dispatch({ type: 'SET_STATE', payload: newState });
            saveLocal(newState);
            return;
        }
        await supabase.from('tournament_pairs').delete().eq('id', pairId);
        await loadData();
    };

    const startTournamentDB = async (method: GenerationMethod, customOrderedPairs?: Pair[]) => {
        const limit = state.format === '10_mini' ? 10 : 16;
        const allPairs = state.pairs; 
        
        if (allPairs.length < limit) throw new Error(`Se necesitan al menos ${limit} parejas para este formato.`);

        let orderedPairs = customOrderedPairs || allPairs;
        if (method !== 'manual' && !customOrderedPairs) {
             orderedPairs = sortPairsByMethod(allPairs, state.players, method);
        }

        // FIX: Pass the actual method here, not 'manual' hardcoded, 
        // to trigger the correct Pot distribution for 'elo-mixed'
        const groups = generateGroupsHelper(orderedPairs, state.players, method, state.format);
        
        const matches = state.format === '10_mini' ? generateMatches10(groups) : generateMatches16(groups, clubData.courtCount);

        const reindexedPairs = orderedPairs.map((p, idx) => ({ ...p, isReserve: idx >= limit }));

        if (isOfflineMode) {
            const newState: TournamentState = { ...state, status: 'active', currentRound: 1, groups, matches: matches as Match[], pairs: reindexedPairs };
            dispatch({ type: 'SET_STATE', payload: newState });
            saveLocal(newState);
            return;
        }

        if (!state.id) throw new Error("ID de torneo perdido. Recarga.");
        
        await supabase.from('tournaments').update({ status: 'active', current_round: 1, format: state.format }).eq('id', state.id);
        
        const { error } = await supabase.from('matches').insert(matches.map(m => ({ tournament_id: state.id, ...m })));
        if (error && error.message.includes('phase')) {
             await supabase.from('matches').insert(matches.map(m => { const { phase, ...rest } = m; return { tournament_id: state.id, ...rest }; }));
        } else if (error) { throw error; }

        await loadData();
    };

    const updateScoreDB = async (matchId: string, sA: number, sB: number) => {
        if (isOfflineMode) {
             const newMatches = state.matches.map(m => m.id === matchId ? { ...m, scoreA: sA, scoreB: sB, isFinished: true } : m);
             const newPairs = recalculateStats(state.pairs, newMatches);
             const newState = { ...state, matches: newMatches, pairs: newPairs };
             dispatch({ type: 'SET_STATE', payload: newState });
             saveLocal(newState);
             return;
        }
        await supabase.from('matches').update({ score_a: sA, score_b: sB, is_finished: true }).eq('id', matchId);
        await loadData();
    };

    const nextRoundDB = async () => {
        if (state.format === '10_mini') {
            await nextRound10();
        } else {
            await nextRound16();
        }
        await loadData();
    };

    const nextRound16 = async () => {
        const nextRound = state.currentRound + 1;
        const isSimultaneous = clubData.courtCount >= 8;
        const qfStartRound = isSimultaneous ? 4 : 5; 

        if (state.currentRound < qfStartRound - 1) {
            if (isOfflineMode) {
                const newState = { ...state, currentRound: nextRound };
                dispatch({ type: 'SET_STATE', payload: newState });
                saveLocal(newState);
                return;
            }
            await supabase.from('tournaments').update({ current_round: nextRound }).eq('id', state.id);
            return;
        }

        let newMatches: any[] = [];
        
        if (state.currentRound === qfStartRound - 1) { 
            const sortedA = getRankedPairsForGroup(state.pairs, state.groups, 'A');
            const sortedB = getRankedPairsForGroup(state.pairs, state.groups, 'B');
            const sortedC = getRankedPairsForGroup(state.pairs, state.groups, 'C');
            const sortedD = getRankedPairsForGroup(state.pairs, state.groups, 'D');

            const mk = (c: number, p1: string, p2: string, b: string) => ({
                tournament_id: state.id, round: nextRound, phase: 'qf', bracket: b, court_id: c, pair_a_id: p1, pair_b_id: p2, is_finished: false
            });

            newMatches.push(mk(1, sortedA[0].id, sortedC[1].id, 'main'));
            newMatches.push(mk(2, sortedC[0].id, sortedA[1].id, 'main'));
            newMatches.push(mk(3, sortedB[0].id, sortedD[1].id, 'main'));
            newMatches.push(mk(4, sortedD[0].id, sortedB[1].id, 'main'));

            newMatches.push(mk(5, sortedA[2].id, sortedC[3].id, 'consolation'));
            newMatches.push(mk(6, sortedC[2].id, sortedA[3].id, 'consolation'));
            newMatches.push(mk(0, sortedB[2].id, sortedD[3].id, 'consolation')); 
            newMatches.push(mk(0, sortedD[2].id, sortedB[3].id, 'consolation')); 
        } 
        else if (state.currentRound === qfStartRound) { 
             const qfMain = state.matches.filter(m => m.round === state.currentRound && m.bracket === 'main');
             const getW = (court: number) => { const m = qfMain.find(x => x.courtId === court); return m ? (m.scoreA! > m.scoreB! ? m.pairAId : m.pairBId) : null; };
             
             newMatches.push({ tournament_id: state.id, round: nextRound, phase: 'sf', bracket: 'main', court_id: 1, pair_a_id: getW(1), pair_b_id: getW(3), is_finished: false });
             newMatches.push({ tournament_id: state.id, round: nextRound, phase: 'sf', bracket: 'main', court_id: 2, pair_a_id: getW(2), pair_b_id: getW(4), is_finished: false });

             const waitingMatches = state.matches.filter(m => m.round === state.currentRound && m.courtId === 0);
             waitingMatches.forEach((m, idx) => {
                 newMatches.push({
                     tournament_id: state.id, round: nextRound, phase: 'qf', bracket: 'consolation',
                     court_id: 3 + idx, pair_a_id: m.pairAId, pair_b_id: m.pairBId, is_finished: false
                 });
             });
        }
        else if (state.currentRound === qfStartRound + 1) { 
             const sfMain = state.matches.filter(m => m.round === state.currentRound && m.bracket === 'main');
             const getW = (court: number) => { const m = sfMain.find(x => x.courtId === court); return m ? (m.scoreA! > m.scoreB! ? m.pairAId : m.pairBId) : null; };
             newMatches.push({ tournament_id: state.id, round: nextRound, phase: 'final', bracket: 'main', court_id: 1, pair_a_id: getW(1), pair_b_id: getW(2), is_finished: false });

             const getW_Prev = (court: number) => { const m = state.matches.find(x => x.round === state.currentRound - 1 && x.courtId === court); return m ? (m.scoreA! > m.scoreB! ? m.pairAId : m.pairBId) : null; };
             const getW_Curr = (court: number) => { const m = state.matches.find(x => x.round === state.currentRound && x.courtId === court); return m ? (m.scoreA! > m.scoreB! ? m.pairAId : m.pairBId) : null; };

             newMatches.push({ tournament_id: state.id, round: nextRound, phase: 'sf', bracket: 'consolation', court_id: 2, pair_a_id: getW_Prev(5), pair_b_id: getW_Curr(3), is_finished: false });
             newMatches.push({ tournament_id: state.id, round: nextRound, phase: 'sf', bracket: 'consolation', court_id: 3, pair_a_id: getW_Prev(6), pair_b_id: getW_Curr(4), is_finished: false });
        }
        else if (state.currentRound === qfStartRound + 2) { 
             const sfCons = state.matches.filter(m => m.round === state.currentRound && m.bracket === 'consolation');
             const getW = (court: number) => { const m = sfCons.find(x => x.courtId === court); return m ? (m.scoreA! > m.scoreB! ? m.pairAId : m.pairBId) : null; };
             newMatches.push({ tournament_id: state.id, round: nextRound, phase: 'final', bracket: 'consolation', court_id: 1, pair_a_id: getW(2), pair_b_id: getW(3), is_finished: false });
        }

        if (newMatches.length > 0 && !isOfflineMode) {
            await supabase.from('matches').insert(newMatches);
        }
        if (!isOfflineMode) {
            await supabase.from('tournaments').update({ current_round: nextRound }).eq('id', state.id);
        }
    };

    const nextRound10 = async () => {
        const nextRound = state.currentRound + 1;
        if (state.currentRound < 3) {
             if (!isOfflineMode) await supabase.from('tournaments').update({ current_round: nextRound }).eq('id', state.id);
             return;
        }

        let newMatches: any[] = [];

        if (state.currentRound === 3) { // R3 -> R4 (QF + Cons Final)
            const sortedA = getRankedPairsForGroup(state.pairs, state.groups, 'A');
            const sortedB = getRankedPairsForGroup(state.pairs, state.groups, 'B');

            const mk = (c: number, p1: string, p2: string, b: string) => ({
                tournament_id: state.id, round: 4, phase: b === 'main' ? 'qf' : 'final', bracket: b, court_id: c,
                pair_a_id: p1, pair_b_id: p2, is_finished: false
            });

            newMatches.push(mk(1, sortedA[0].id, sortedB[3].id, 'main')); // 1A vs 4B
            newMatches.push(mk(2, sortedB[0].id, sortedA[3].id, 'main')); // 1B vs 4A
            newMatches.push(mk(3, sortedA[1].id, sortedB[2].id, 'main')); // 2A vs 3B
            newMatches.push(mk(4, sortedB[1].id, sortedA[2].id, 'main')); // 2B vs 3A

            // Consolation Final (Direct 5th vs 5th)
            newMatches.push(mk(5, sortedA[4].id, sortedB[4].id, 'consolation'));
        }
        else if (state.currentRound === 4) { // QF -> SF
             const qfMatches = state.matches.filter(m => m.round === 4 && m.bracket === 'main');
             const getW = (court: number) => { const m = qfMatches.find(x => x.courtId === court); return m ? (m.scoreA! > m.scoreB! ? m.pairAId : m.pairBId) : null; };

             newMatches.push({ tournament_id: state.id, round: 5, phase: 'sf', bracket: 'main', court_id: 1, pair_a_id: getW(1), pair_b_id: getW(3), is_finished: false });
             newMatches.push({ tournament_id: state.id, round: 5, phase: 'sf', bracket: 'main', court_id: 2, pair_a_id: getW(2), pair_b_id: getW(4), is_finished: false });
        }
        else if (state.currentRound === 5) { // SF -> Final
             const sfMatches = state.matches.filter(m => m.round === 5 && m.bracket === 'main');
             const getW = (court: number) => { const m = sfMatches.find(x => x.courtId === court); return m ? (m.scoreA! > m.scoreB! ? m.pairAId : m.pairBId) : null; };
             
             newMatches.push({ tournament_id: state.id, round: 6, phase: 'final', bracket: 'main', court_id: 1, pair_a_id: getW(1), pair_b_id: getW(2), is_finished: false });
        }

        if (newMatches.length > 0 && !isOfflineMode) {
            await supabase.from('matches').insert(newMatches);
        }
        if (!isOfflineMode) {
            await supabase.from('tournaments').update({ current_round: nextRound }).eq('id', state.id);
        }
    };

    const archiveAndResetDB = async () => {
        let wMain = 'Desconocido';
        let wCons = 'Desconocido';

        const getLastWinner = (round: number, bracket: string) => {
             const m = state.matches.find(x => x.round === round && x.bracket === bracket);
             if (m && m.isFinished) {
                 const wid = m.scoreA! > m.scoreB! ? m.pairAId : m.pairBId;
                 const pair = state.pairs.find(p => p.id === wid);
                 if (pair) {
                     const p1 = state.players.find(p => p.id === pair.player1Id);
                     const p2 = state.players.find(p => p.id === pair.player2Id);
                     return `${formatPlayerName(p1)} & ${formatPlayerName(p2)}`;
                 }
             }
             return null;
        };

        if (state.format === '16_mini') {
            wMain = getLastWinner(7, 'main') || getLastWinner(6, 'main') || wMain;
            wCons = getLastWinner(8, 'consolation') || getLastWinner(7, 'consolation') || wCons;
        } else {
            wMain = getLastWinner(6, 'main') || wMain;
            wCons = getLastWinner(4, 'consolation') || wCons;
        }

        if (!isOfflineMode) {
            await supabase.from('tournaments').update({ status: 'finished', winner_main: wMain, winner_consolation: wCons }).eq('id', state.id);
        }
        dispatch({ type: 'RESET_LOCAL' });
    };

    const resetToSetupDB = async () => {
        if (isOfflineMode) {
             const newState: TournamentState = { ...state, status: 'setup', currentRound: 0, matches: [], groups: [] };
             dispatch({ type: 'SET_STATE', payload: newState });
             saveLocal(newState);
             return;
        }

        if (!state.id) return;

        // 1. Reset tournament status
        await supabase.from('tournaments').update({ status: 'setup', current_round: 0 }).eq('id', state.id);
        // 2. Delete matches
        await supabase.from('matches').delete().eq('tournament_id', state.id);
        
        await loadData();
    };

    const regenerateMatchesDB = async () => { return "Not implemented"; };
    const hardResetDB = async () => { dispatch({ type: 'RESET_LOCAL' }); };

    return (
        <TournamentContext.Provider value={{
            state, dispatch, loadData,
            addPlayerToDB, updatePlayerInDB, createPairInDB, updatePairDB, startTournamentDB,
            updateScoreDB, nextRoundDB, deletePairDB, archiveAndResetDB, resetToSetupDB, regenerateMatchesDB, hardResetDB,
            formatPlayerName
        }}>
            {children}
        </TournamentContext.Provider>
    );
};

export const useTournament = () => useContext(TournamentContext);
