import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { TournamentState, TournamentAction, Player, Pair, Match, Group } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
// FIX: Use relative path instead of alias
import { getMatchRating, calculateEloDelta, calculateDisplayRanking, BASE_ELO_BY_CATEGORY } from '../utils/Elo'; 

const GROUP_NAMES = ['A', 'B', 'C', 'D'];
const STORAGE_KEY = 'padelpro_local_db_v3'; 
export const TOURNAMENT_CATEGORIES = ['Iniciación', '5ª CAT', '4ª CAT', '3ª CAT', '2ª CAT', '1ª CAT'];

// ... (rest of the file content remains exactly the same)

// --- Logic Helpers ---

const generateGroupsHelper = (pairs: Pair[], isNewTournament: boolean = false): Group[] => {
  let activePairs = pairs.filter(p => !p.isReserve);
  
  if (isNewTournament) {
      activePairs = [...activePairs].sort(() => 0.5 - Math.random());
  }
  
  activePairs = activePairs.slice(0, 16);

  const groups: Group[] = [];
  for (let i = 0; i < 4; i++) {
    groups.push({
      id: GROUP_NAMES[i],
      pairIds: activePairs.slice(i * 4, (i + 1) * 4).map(p => p.id)
    });
  }
  return groups;
};

const generateGroupMatchesHelper = (groups: Group[]): Partial<Match>[] => {
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

const inferMatchCategory = (players: Player[]): string => {
    const p = players[0];
    return p?.main_category || p?.categories?.[0] || '4ª CAT';
};

const initialState: TournamentState = {
  status: 'setup',
  currentRound: 0,
  players: [],
  pairs: [],
  matches: [],
  groups: [],
  courts: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, ballsGiven: false })),
  loading: true
};

interface TournamentContextType {
    state: TournamentState;
    dispatch: React.Dispatch<TournamentAction>;
    loadData: () => Promise<void>;
    addPlayerToDB: (p: Partial<Player>) => Promise<string | null>;
    updatePlayerInDB: (p: Partial<Player>) => Promise<void>;
    createPairInDB: (p1: string, p2: string) => Promise<void>;
    updatePairDB: (pairId: string, p1: string, p2: string) => Promise<void>;
    startTournamentDB: () => Promise<void>;
    updateScoreDB: (matchId: string, sA: number, sB: number) => Promise<void>;
    nextRoundDB: () => Promise<void>;
    deletePairDB: (pairId: string) => Promise<void>;
    archiveAndResetDB: () => Promise<void>;
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
    formatPlayerName: () => ''
});

const reducer = (state: TournamentState, action: TournamentAction): TournamentState => {
    switch (action.type) {
        case 'SET_STATE': return { ...state, ...action.payload };
        case 'SET_LOADING': return { ...state, loading: action.payload };
        case 'RESET_LOCAL': return initialState;
        case 'TOGGLE_BALLS': return { ...state, courts: state.courts.map(c => c.id === action.payload ? { ...c, ballsGiven: !c.ballsGiven } : c) };
        case 'TOGGLE_WATER': return { ...state, pairs: state.pairs.map(p => p.id === action.payload ? { ...p, waterReceived: !p.waterReceived } : p) };
        case 'TOGGLE_PAID': return { ...state, pairs: state.pairs.map(p => { if (p.player1Id === action.payload) return { ...p, paidP1: !p.paidP1 }; if (p.player2Id === action.payload) return { ...p, paidP2: !p.paidP2 }; return p; }) };
        case 'LOAD_DEMO_DATA':
             const demoPlayers: Player[] = Array.from({ length: 32 }, (_, i) => ({ id: `demo-p-${i}`, name: `Jugador ${i+1}`, categories: ['4ª CAT'], user_id: 'dev', global_rating: 1200, main_category: '4ª CAT', category_ratings: { '4ª CAT': 1200 } }));
             const demoPairs: Pair[] = [];
             for(let i=0; i<16; i++) { demoPairs.push({ id: `pair-${i}`, player1Id: demoPlayers[i*2].id, player2Id: demoPlayers[i*2+1].id, name: 'Pareja', waterReceived: false, paidP1: false, paidP2: false, stats: {played:0, won:0, gameDiff:0}, isReserve: false }); }
             return { ...state, players: demoPlayers, pairs: demoPairs, status: 'setup' };
        default: return state;
    }
};

export const TournamentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(reducer, initialState);
    const { user, isOfflineMode } = useAuth();

    const loadData = useCallback(async () => {
        if (!user) return;
        dispatch({ type: 'SET_LOADING', payload: true });

        if (isOfflineMode) {
            const localData = localStorage.getItem(STORAGE_KEY);
            if (localData) {
                dispatch({ type: 'SET_STATE', payload: JSON.parse(localData) });
            } else {
                dispatch({ type: 'SET_STATE', payload: { players: [], pairs: [], status: 'setup' } });
            }
            dispatch({ type: 'SET_LOADING', payload: false });
            return;
        }

        try {
            const { data: players } = await supabase.from('players').select('*').eq('user_id', user.id).order('name');
            const { data: tournaments } = await supabase.from('tournaments').select('*').eq('user_id', user.id).neq('status', 'finished').limit(1);
            const activeTournament = tournaments?.[0];

            if (!activeTournament) {
                dispatch({ type: 'SET_STATE', payload: { id: undefined, status: 'setup', players: players || [], pairs: [], matches: [], groups: [] } });
            } else {
                const { data: pairs } = await supabase.from('tournament_pairs').select('*').eq('tournament_id', activeTournament.id).order('created_at', { ascending: true });
                const { data: matches } = await supabase.from('matches').select('*').eq('tournament_id', activeTournament.id);
                
                let mappedPairs: Pair[] = (pairs || []).map(p => ({
                    id: p.id, tournament_id: p.tournament_id, player1Id: p.player1_id, player2Id: p.player2_id,
                    name: p.name || 'Pareja', waterReceived: p.water_received, paidP1: p.paid_p1, paidP2: p.paid_p2,
                    stats: { played: 0, won: 0, gameDiff: 0 }, isReserve: false 
                }));

                const mappedMatches: Match[] = (matches || []).map(m => ({
                    id: m.id, round: m.round, phase: 'group', bracket: m.bracket as any,
                    courtId: m.court_id, pairAId: m.pair_a_id, pairBId: m.pair_b_id,
                    scoreA: m.score_a, scoreB: m.score_b, isFinished: m.is_finished,
                    elo_processed: (m as any).elo_processed
                }));

                mappedPairs = recalculateStats(mappedPairs, mappedMatches);
                const groups = generateGroupsHelper(mappedPairs, false);

                dispatch({ type: 'SET_STATE', payload: {
                    id: activeTournament.id, status: activeTournament.status as any, currentRound: activeTournament.current_round || 0,
                    players: players || [], pairs: mappedPairs, matches: mappedMatches, groups: groups
                }});
            }
        } catch (e) {
            console.warn("Supabase load error:", e);
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    }, [user, isOfflineMode]);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        if(isOfflineMode && state.players.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        }
    }, [state, isOfflineMode]);

    const addPlayerToDB = async (p: Partial<Player>): Promise<string | null> => {
        const newP = { 
            ...p, 
            global_rating: 1200, 
            category_ratings: {}, 
            main_category: p.categories?.[0] || 'Iniciación', 
            matches_played: 0 
        };

        if (isOfflineMode) {
            const newId = `local-${Date.now()}`;
            dispatch({ type: 'SET_STATE', payload: { players: [...state.players, { ...newP, id: newId } as Player] } });
            return newId;
        }
        
        const { data, error } = await supabase.from('players').insert({ 
            user_id: user!.id, 
            name: p.name, nickname: p.nickname, email: p.email, phone: p.phone, categories: p.categories,
            global_rating: 1200,
            main_category: newP.main_category,
            category_ratings: {}
        }).select().single();
        
        if(error || !data) return null;
        loadData();
        return data.id;
    };

    const updatePlayerInDB = async (p: Partial<Player>) => {
        if (isOfflineMode) {
             const updated = state.players.map(pl => pl.id === p.id ? { ...pl, ...p } as Player : pl);
             dispatch({ type: 'SET_STATE', payload: { players: updated } });
             return;
        }
        if(!p.id) return;
        await supabase.from('players').update({ 
            name: p.name, nickname: p.nickname, email: p.email, phone: p.phone, categories: p.categories,
            manual_rating: p.manual_rating 
        }).eq('id', p.id);
        loadData();
    }

    const createPairInDB = async (p1: string, p2: string) => {
        if (isOfflineMode) {
            const newPair = { id: `pair-${Date.now()}`, player1Id: p1, player2Id: p2, name: 'Pareja', waterReceived: false, paidP1: false, paidP2: false, stats: { played: 0, won: 0, gameDiff: 0 }, isReserve: false };
            dispatch({ type: 'SET_STATE', payload: { pairs: [...state.pairs, newPair] } });
            return;
        }
        let tId = state.id;
        if (!tId) {
            const { data } = await supabase.from('tournaments').insert({ user_id: user!.id, status: 'setup', current_round: 0 }).select().single();
            if(data) tId = data.id;
        }
        if(tId) {
            await supabase.from('tournament_pairs').insert({ tournament_id: tId, player1_id: p1, player2_id: p2, name: `Pareja` });
            loadData();
        }
    };

    const updatePairDB = async (pairId: string, p1: string, p2: string) => {
        if (isOfflineMode) {
            const updatedPairs = state.pairs.map(p => p.id === pairId ? { ...p, player1Id: p1, player2Id: p2 } : p);
            dispatch({ type: 'SET_STATE', payload: { pairs: updatedPairs } });
            return;
        }
        await supabase.from('tournament_pairs').update({ player1_id: p1, player2_id: p2 }).eq('id', pairId);
        loadData();
    };

    const deletePairDB = async (pairId: string) => {
        if (isOfflineMode) {
            dispatch({ type: 'SET_STATE', payload: { pairs: state.pairs.filter(p => p.id !== pairId) } });
            return;
        }
        await supabase.from('tournament_pairs').delete().eq('id', pairId);
        loadData();
    }

    const startTournamentDB = async () => {
        const activePairs = state.pairs.filter(p => !p.isReserve);
        if (activePairs.length !== 16) {
            alert(`Se necesitan 16 parejas titulares. Tienes ${activePairs.length}.`);
            return;
        }
        const groups = generateGroupsHelper(state.pairs, true);
        const matches = generateGroupMatchesHelper(groups);

        if (isOfflineMode) {
            const localMatches = matches.map((m, i) => ({ ...m, id: `match-${i}`, scoreA: null, scoreB: null, isFinished: false } as Match));
            dispatch({ type: 'SET_STATE', payload: { status: 'active', currentRound: 1, groups, matches: localMatches } });
            return;
        }
        if (!state.id) return;
        
        const dbMatches = matches.map(m => ({
            tournament_id: state.id, round: m.round, court_id: m.courtId,
            pair_a_id: m.pairAId, pair_b_id: m.pairBId, is_finished: false
        }));
        const { error } = await supabase.from('matches').insert(dbMatches);
        if (!error) {
            await supabase.from('tournaments').update({ status: 'active', current_round: 1 }).eq('id', state.id);
            loadData();
        }
    };

    const updateScoreDB = async (matchId: string, sA: number, sB: number) => {
        if (isOfflineMode) {
            const newMatches = state.matches.map(m => m.id === matchId ? { ...m, scoreA: sA, scoreB: sB, isFinished: true } : m);
            const newPairs = recalculateStats(state.pairs, newMatches);
            dispatch({ type: 'SET_STATE', payload: { matches: newMatches, pairs: newPairs } });
            return;
        }

        // 1. Update Match
        await supabase.from('matches').update({ score_a: sA, score_b: sB, is_finished: true }).eq('id', matchId);
        
        // 2. Optimistic UI
        const newMatches = state.matches.map(m => m.id === matchId ? { ...m, scoreA: sA, scoreB: sB, isFinished: true } : m);
        const newPairs = recalculateStats(state.pairs, newMatches);
        dispatch({ type: 'SET_STATE', payload: { matches: newMatches, pairs: newPairs } });

        // 3. ELO Calculation
        const match = state.matches.find(m => m.id === matchId);
        if (match && !match.elo_processed) {
            const pairA = state.pairs.find(p => p.id === match.pairAId);
            const pairB = state.pairs.find(p => p.id === match.pairBId);
            if (pairA && pairB) {
                const p1 = state.players.find(p => p.id === pairA.player1Id);
                const p2 = state.players.find(p => p.id === pairA.player2Id);
                const p3 = state.players.find(p => p.id === pairB.player1Id);
                const p4 = state.players.find(p => p.id === pairB.player2Id);

                if (p1 && p2 && p3 && p4) {
                    const matchCategory = inferMatchCategory([p1, p2, p3, p4]);
                    
                    const r1 = getMatchRating(p1, matchCategory);
                    const r2 = getMatchRating(p2, matchCategory);
                    const r3 = getMatchRating(p3, matchCategory);
                    const r4 = getMatchRating(p4, matchCategory);

                    const avgEloA = (r1 + r2) / 2;
                    const avgEloB = (r3 + r4) / 2;

                    const delta = calculateEloDelta(avgEloA, avgEloB, sA, sB);

                    const applyUpdate = async (p: Player, d: number) => {
                        const newRatings = { ...p.category_ratings } || {};
                        const currentCatRating = newRatings[matchCategory] || (p.global_rating || 1200);
                        newRatings[matchCategory] = Math.round(currentCatRating + d);
                        
                        const newGlobal = Math.round((p.global_rating || 1200) + (d * 0.25)); 
                        
                        await supabase.from('players').update({
                            global_rating: newGlobal,
                            category_ratings: newRatings,
                            matches_played: (p.matches_played || 0) + 1
                        }).eq('id', p.id);
                    };

                    await Promise.all([
                        applyUpdate(p1, delta),
                        applyUpdate(p2, delta),
                        applyUpdate(p3, -delta),
                        applyUpdate(p4, -delta)
                    ]);

                    await supabase.from('matches').update({ elo_processed: true } as any).eq('id', matchId);
                }
            }
        }
    };

    const nextRoundDB = async () => {
        const nextR = state.currentRound + 1;
        let playoffMatches: Partial<Match>[] = [];

        if (state.currentRound === 4) {
            const pairsWithStats = recalculateStats(state.pairs, state.matches);
            const rankingsA = getRankedPairsForGroup(pairsWithStats, state.groups, 'A');
            const rankingsB = getRankedPairsForGroup(pairsWithStats, state.groups, 'B');
            const rankingsC = getRankedPairsForGroup(pairsWithStats, state.groups, 'C');
            const rankingsD = getRankedPairsForGroup(pairsWithStats, state.groups, 'D');
            const safeGet = (arr: Pair[], idx: number) => arr[idx] || arr[0] || state.pairs[0];

            playoffMatches.push({ round: 5, bracket: 'main', phase: 'qf', courtId: 1, pairAId: safeGet(rankingsA, 0).id, pairBId: safeGet(rankingsC, 1).id });
            playoffMatches.push({ round: 5, bracket: 'main', phase: 'qf', courtId: 2, pairAId: safeGet(rankingsC, 0).id, pairBId: safeGet(rankingsA, 1).id });
            playoffMatches.push({ round: 5, bracket: 'main', phase: 'qf', courtId: 3, pairAId: safeGet(rankingsB, 0).id, pairBId: safeGet(rankingsD, 1).id });
            playoffMatches.push({ round: 5, bracket: 'main', phase: 'qf', courtId: 4, pairAId: safeGet(rankingsD, 0).id, pairBId: safeGet(rankingsB, 1).id });

            playoffMatches.push({ round: 5, bracket: 'consolation', phase: 'qf', courtId: 5, pairAId: safeGet(rankingsA, 2).id, pairBId: safeGet(rankingsC, 3).id });
            playoffMatches.push({ round: 5, bracket: 'consolation', phase: 'qf', courtId: 6, pairAId: safeGet(rankingsC, 2).id, pairBId: safeGet(rankingsA, 3).id });
            playoffMatches.push({ round: 5, bracket: 'consolation', phase: 'qf', courtId: 1, pairAId: safeGet(rankingsB, 2).id, pairBId: safeGet(rankingsD, 3).id });
            playoffMatches.push({ round: 5, bracket: 'consolation', phase: 'qf', courtId: 2, pairAId: safeGet(rankingsD, 2).id, pairBId: safeGet(rankingsB, 3).id });
        }

        if (isOfflineMode) {
            let newMatches = [...state.matches];
            if (playoffMatches.length > 0) {
                const localPlayoffs = playoffMatches.map((m, i) => ({ 
                    ...m, id: `qf-${Date.now()}-${i}`, scoreA: null, scoreB: null, isFinished: false 
                } as Match));
                newMatches = [...newMatches, ...localPlayoffs];
            }
            dispatch({ type: 'SET_STATE', payload: { currentRound: nextR, matches: newMatches } });
            return;
        }

        if (state.id) {
            if (playoffMatches.length > 0) {
                const dbMatches = playoffMatches.map(m => ({
                    tournament_id: state.id!, round: m.round, phase: m.phase, bracket: m.bracket,
                    court_id: m.courtId, pair_a_id: m.pairAId, pair_b_id: m.pairBId, is_finished: false
                }));
                await supabase.from('matches').insert(dbMatches);
            }
            await supabase.from('tournaments').update({ current_round: nextR }).eq('id', state.id);
            dispatch({ type: 'SET_STATE', payload: { currentRound: nextR } });
            setTimeout(() => loadData(), 500); 
        }
    };

    const archiveAndResetDB = async () => {
        if (isOfflineMode) { dispatch({ type: 'RESET_LOCAL' }); return; }
        if (state.id) { await supabase.from('tournaments').update({ status: 'finished' }).eq('id', state.id); dispatch({ type: 'RESET_LOCAL' }); loadData(); }
    };

    const formatPlayerName = (p?: Player): string => {
        if (!p) return '...';
        if (p.nickname) return p.nickname;
        const parts = p.name.split(' ');
        const first = parts[0];
        const lastInitial = parts.length > 1 ? parts[1].substring(0, 3) + '.' : '';
        return `${first} ${lastInitial}`;
    };

    return (
        <TournamentContext.Provider value={{ 
            state, dispatch, loadData, addPlayerToDB, updatePlayerInDB, 
            createPairInDB, updatePairDB, startTournamentDB, updateScoreDB, 
            nextRoundDB, deletePairDB, archiveAndResetDB, formatPlayerName 
        }}>
            {children}
        </TournamentContext.Provider>
    );
};

export const useTournament = () => useContext(TournamentContext);