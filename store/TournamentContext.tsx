import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { TournamentState, TournamentAction, Player, Pair, Match, Group } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { getMatchRating, calculateEloDelta, calculateDisplayRanking, manualToElo } from '../utils/Elo';

const GROUP_NAMES = ['A', 'B', 'C', 'D'];
const STORAGE_KEY = 'padelpro_local_db_v3'; 
export const TOURNAMENT_CATEGORIES = ['Iniciación', '5ª CAT', '4ª CAT', '3ª CAT', '2ª CAT', '1ª CAT'];

export type GenerationMethod = 'elo-balanced' | 'elo-mixed' | 'manual' | 'arrival';

// --- Logic Helpers ---

export const getPairElo = (pair: Pair, players: Player[]): number => {
    const p1 = players.find(p => p.id === pair.player1Id);
    const p2 = players.find(p => p.id === pair.player2Id);
    const score1 = p1 ? calculateDisplayRanking(p1) : 1200;
    const score2 = p2 ? calculateDisplayRanking(p2) : 1200;
    return score1 + score2;
};

const generateGroupsHelper = (pairs: Pair[], players: Player[], method: GenerationMethod = 'manual'): Group[] => {
  let activePairs = pairs.filter(p => !p.isReserve);
  
  if (method === 'arrival') {
      activePairs = [...activePairs].sort((a, b) => (a.id > b.id ? 1 : -1));
  } else if (method === 'elo-balanced') {
      activePairs = [...activePairs].sort((a, b) => {
          const eloA = getPairElo(a, players);
          const eloB = getPairElo(b, players);
          return eloB - eloA;
      });
  } else if (method === 'elo-mixed') {
      const rankedPairs = [...activePairs].sort((a, b) => {
          const eloA = getPairElo(a, players);
          const eloB = getPairElo(b, players);
          return eloB - eloA;
      });

      const pot1 = rankedPairs.slice(0, 4);   
      const pot2 = rankedPairs.slice(4, 8);   
      const pot3 = rankedPairs.slice(8, 12);  
      const pot4 = rankedPairs.slice(12, 16); 

      const groupA_Pairs = [pot1[0], pot2[0], pot3[0], pot4[0]];
      const groupB_Pairs = [pot1[1], pot2[1], pot3[1], pot4[1]];
      const groupC_Pairs = [pot1[2], pot2[2], pot3[2], pot4[2]];
      const groupD_Pairs = [pot1[3], pot2[3], pot3[3], pot4[3]];

      activePairs = [...groupA_Pairs, ...groupB_Pairs, ...groupC_Pairs, ...groupD_Pairs];
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

const reconstructGroupsFromMatches = (pairs: Pair[], matches: Match[], players: Player[]): Group[] => {
    const groupMap: Record<string, Set<string>> = {
        'A': new Set(), 'B': new Set(), 'C': new Set(), 'D': new Set()
    };

    matches.forEach(m => {
        if (m.phase !== 'group') return;
        
        let targetGroup = '';
        if (m.round === 1) {
            if (m.courtId === 1 || m.courtId === 2) targetGroup = 'A';
            else if (m.courtId === 3 || m.courtId === 4) targetGroup = 'B';
            else if (m.courtId === 5 || m.courtId === 6) targetGroup = 'C';
        } else if (m.round === 2) {
             if (m.courtId === 5 || m.courtId === 6) targetGroup = 'D';
        }

        if (targetGroup && groupMap[targetGroup]) {
            groupMap[targetGroup].add(m.pairAId);
            groupMap[targetGroup].add(m.pairBId);
        }
    });

    const groups: Group[] = GROUP_NAMES.map(name => ({
        id: name,
        pairIds: Array.from(groupMap[name])
    }));

    const totalAssigned = groups.reduce((acc, g) => acc + g.pairIds.length, 0);
    if (totalAssigned < 16 && matches.length === 0) {
        return generateGroupsHelper(pairs, players, 'elo-balanced');
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
    startTournamentDB: (method: GenerationMethod, customOrderedPairs?: Pair[]) => Promise<void>;
    updateScoreDB: (matchId: string, sA: number, sB: number) => Promise<void>;
    nextRoundDB: () => Promise<void>;
    deletePairDB: (pairId: string) => Promise<void>;
    archiveAndResetDB: () => Promise<void>;
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
    regenerateMatchesDB: async () => "",
    hardResetDB: async () => {},
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
             const demoPlayers: Player[] = Array.from({ length: 32 }, (_, i) => ({ id: `demo-p-${i}`, name: `Jugador ${i+1}`, categories: ['4ª CAT'], user_id: 'dev', global_rating: 1200 - (i * 20), main_category: '4ª CAT', category_ratings: { '4ª CAT': 1200 } }));
             const demoPairs: Pair[] = [];
             for(let i=0; i<16; i++) { demoPairs.push({ id: `pair-${i}`, player1Id: demoPlayers[i*2].id, player2Id: demoPlayers[i*2+1].id, name: 'Pareja', waterReceived: false, paidP1: false, paidP2: false, stats: {played:0, won:0, gameDiff:0}, isReserve: false }); }
             return { ...state, players: demoPlayers, pairs: demoPairs, status: 'setup' };
        default: return state;
    }
};

export const TournamentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(reducer, initialState);
    const { user, isOfflineMode } = useAuth();

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
                    stats: { played: 0, won: 0, gameDiff: 0 }, 
                    isReserve: false 
                }));

                mappedPairs = mappedPairs.map((p, idx) => ({ ...p, isReserve: idx >= 16 }));

                const mappedMatches: Match[] = (matches || []).map(m => ({
                    id: m.id, round: m.round, 
                    phase: m.phase || (m.round <= 4 ? 'group' : m.round === 5 ? 'qf' : m.round === 6 ? 'sf' : 'final'), 
                    bracket: m.bracket as any,
                    courtId: m.court_id, pairAId: m.pair_a_id, pairBId: m.pair_b_id,
                    scoreA: m.score_a, scoreB: m.score_b, isFinished: m.is_finished,
                    elo_processed: (m as any).elo_processed
                }));

                mappedPairs = recalculateStats(mappedPairs, mappedMatches);
                
                let groups: Group[] = [];
                if (mappedMatches.length > 0) {
                    groups = reconstructGroupsFromMatches(mappedPairs, mappedMatches, players || []);
                } else {
                    const isSetup = activeTournament.status === 'setup';
                    groups = generateGroupsHelper(mappedPairs, players || [], isSetup ? 'manual' : 'elo-balanced');
                }

                if (activeTournament.current_round > 0 && mappedMatches.length === 0) {
                     console.warn("CORRUPTED STATE DETECTED. Resetting tournament to setup.");
                     await supabase.from('matches').delete().eq('tournament_id', activeTournament.id);
                     await supabase.from('tournaments').update({ status: 'setup', current_round: 0 }).eq('id', activeTournament.id);
                     dispatch({ type: 'SET_STATE', payload: { 
                        id: activeTournament.id, status: 'setup', currentRound: 0, players: players || [], pairs: mappedPairs, matches: [], groups: groups 
                     }});
                } else {
                    dispatch({ type: 'SET_STATE', payload: {
                        id: activeTournament.id, status: activeTournament.status as any, currentRound: activeTournament.current_round || 0,
                        players: players || [], pairs: mappedPairs, matches: mappedMatches, groups: groups
                    }});
                }
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

    // --- ACTIONS ---

    const addPlayerToDB = async (p: Partial<Player>): Promise<string | null> => {
        const initialElo = p.manual_rating ? manualToElo(p.manual_rating) : 1200;

        const newP = { 
            ...p, 
            global_rating: initialElo, 
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
            user_id: user!.id, name: p.name, nickname: p.nickname, email: p.email, phone: p.phone, categories: p.categories,
            global_rating: initialElo, main_category: newP.main_category, category_ratings: {}, manual_rating: p.manual_rating
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
        await supabase.from('players').update({ name: p.name, nickname: p.nickname, email: p.email, phone: p.phone, categories: p.categories, manual_rating: p.manual_rating }).eq('id', p.id);
        loadData();
    }

    const createPairInDB = async (p1: string, p2: string) => {
        const activePairCount = state.pairs.length;
        const isReserve = activePairCount >= 16;

        if (isOfflineMode) {
            const newPair = { 
                id: `pair-${Date.now()}`, player1Id: p1, player2Id: p2, name: 'Pareja', 
                waterReceived: false, paidP1: false, paidP2: false, 
                stats: { played: 0, won: 0, gameDiff: 0 }, 
                isReserve 
            };
            dispatch({ type: 'SET_STATE', payload: { pairs: [...state.pairs, newPair] } });
            return;
        }
        let tId = state.id;
        if (!tId) {
            const { data } = await supabase.from('tournaments').insert({ user_id: user!.id, status: 'setup', current_round: 0 }).select().single();
            if(data) tId = data.id;
        }
        if(tId) {
            await supabase.from('tournament_pairs').insert({ 
                tournament_id: tId, player1_id: p1, player2_id: p2, name: `Pareja`
            });
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
            const filtered = state.pairs.filter(p => p.id !== pairId);
            const reindexed = filtered.map((p, idx) => ({ ...p, isReserve: idx >= 16 }));
            dispatch({ type: 'SET_STATE', payload: { pairs: reindexed } });
            return;
        }
        await supabase.from('tournament_pairs').delete().eq('id', pairId);
        
        const filtered = state.pairs.filter(p => p.id !== pairId);
        const reindexed = filtered.map((p, idx) => ({ ...p, isReserve: idx >= 16 }));
        dispatch({ type: 'SET_STATE', payload: { pairs: reindexed } });

        loadData();
    }

    const regenerateMatchesDB = async (): Promise<string> => {
        if (isOfflineMode || !state.id) return "Offline";
        const groups = generateGroupsHelper(state.pairs, state.players, 'manual'); 
        const matches = generateGroupMatchesHelper(groups);
        const { data: existingMatches } = await supabase.from('matches').select('round, pair_a_id, pair_b_id').eq('tournament_id', state.id);
        const matchesToInsert = matches.filter(m => {
            const exists = existingMatches?.some(ex => ex.round === m.round && ((ex.pair_a_id === m.pairAId && ex.pair_b_id === m.pairBId) || (ex.pair_a_id === m.pairBId && ex.pair_b_id === m.pairAId)));
            return !exists;
        });
        if (matchesToInsert.length > 0) {
            const dbMatches = matchesToInsert.map(m => ({
                tournament_id: state.id!, round: m.round, court_id: m.courtId, pair_a_id: m.pairAId, pair_b_id: m.pairBId, is_finished: false, phase: m.phase
            }));
            
            const { error } = await supabase.from('matches').insert(dbMatches);
            if (error) {
                 if (error.message.includes('phase') || error.code === 'PGRST204') {
                     const dbMatchesLegacy = dbMatches.map(({ phase, ...rest }) => rest);
                     await supabase.from('matches').insert(dbMatchesLegacy);
                 } else {
                     return `Error: ${error.message}`;
                 }
            }

            loadData();
            return `Regenerados ${matchesToInsert.length} partidos.`;
        } else {
            return "No se detectaron partidos faltantes.";
        }
    };

    const startTournamentDB = async (method: GenerationMethod, customOrderedPairs?: Pair[]) => {
        let activePairs = state.pairs.filter(p => !p.isReserve);
        if (activePairs.length !== 16) {
            throw new Error(`Se necesitan 16 parejas titulares. Tienes ${activePairs.length}.`);
        }

        if (method === 'manual' && customOrderedPairs) {
            activePairs = customOrderedPairs;
        }
        
        const groups = generateGroupsHelper(activePairs, state.players, method);
        const matches = generateGroupMatchesHelper(groups);

        if (isOfflineMode) {
            const localMatches = matches.map((m, i) => ({ ...m, id: `match-${i}`, scoreA: null, scoreB: null, isFinished: false } as Match));
            dispatch({ type: 'SET_STATE', payload: { status: 'active', currentRound: 1, groups, matches: localMatches } });
            return;
        }
        
        if (!state.id) {
            throw new Error("No se encontró ID del torneo. Por favor, recarga la página.");
        }
        
        const { error: deleteError } = await supabase.from('matches').delete().eq('tournament_id', state.id);
        if (deleteError) {
             throw new Error(`Error limpiando partidos anteriores: ${deleteError.message}`);
        }

        const dbMatches = matches.map(m => ({
            tournament_id: state.id!, round: m.round, court_id: m.courtId,
            pair_a_id: m.pairAId, pair_b_id: m.pairBId, is_finished: false,
            phase: m.phase 
        }));
        
        const { error: insertError } = await supabase.from('matches').insert(dbMatches);
        if (insertError) {
            if (insertError.message.includes('phase') || insertError.code === 'PGRST204') {
                console.warn("Schema mismatch detected (phase column missing). Retrying with legacy schema...");
                const dbMatchesLegacy = dbMatches.map(({ phase, ...rest }) => rest);
                const { error: retryError } = await supabase.from('matches').insert(dbMatchesLegacy);
                if (retryError) throw new Error(`Error guardando partidos (Legacy): ${retryError.message}`);
            } else {
                throw new Error(`Error guardando partidos: ${insertError.message}`);
            }
        }

        const { error: updateError } = await supabase.from('tournaments').update({ status: 'active', current_round: 1 }).eq('id', state.id);
        if (updateError) {
             throw new Error(`Error actualizando estado del torneo: ${updateError.message}`);
        }

        loadData();
    };

    const updateScoreDB = async (matchId: string, sA: number, sB: number) => {
        if (isOfflineMode) {
            const newMatches = state.matches.map(m => m.id === matchId ? { ...m, scoreA: sA, scoreB: sB, isFinished: true } : m);
            const newPairs = recalculateStats(state.pairs, newMatches);
            dispatch({ type: 'SET_STATE', payload: { matches: newMatches, pairs: newPairs } });
            return;
        }

        await supabase.from('matches').update({ score_a: sA, score_b: sB, is_finished: true }).eq('id', matchId);
        
        const newMatches = state.matches.map(m => m.id === matchId ? { ...m, scoreA: sA, scoreB: sB, isFinished: true } : m);
        const newPairs = recalculateStats(state.pairs, newMatches);
        dispatch({ type: 'SET_STATE', payload: { matches: newMatches, pairs: newPairs } });

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
                        await supabase.from('players').update({ global_rating: newGlobal, category_ratings: newRatings, matches_played: (p.matches_played || 0) + 1 }).eq('id', p.id);
                    };

                    await Promise.all([applyUpdate(p1, delta), applyUpdate(p2, delta), applyUpdate(p3, -delta), applyUpdate(p4, -delta)]);
                    await supabase.from('matches').update({ elo_processed: true } as any).eq('id', matchId);
                }
            }
        }
    };

    const nextRoundDB = async () => {
        const nextR = state.currentRound + 1;
        let playoffMatches: Partial<Match>[] = [];

        if (state.currentRound < 4) {
             if (isOfflineMode) {
                 dispatch({ type: 'SET_STATE', payload: { currentRound: nextR } });
                 return;
             }
             const { error } = await supabase.from('tournaments').update({ current_round: nextR }).eq('id', state.id);
             if (error) throw new Error(`Error actualizando ronda: ${error.message}`);
             loadData();
             return;
        }

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
            playoffMatches.push({ round: 5, bracket: 'consolation', phase: 'qf', courtId: 0, pairAId: safeGet(rankingsB, 2).id, pairBId: safeGet(rankingsD, 3).id }); 
            playoffMatches.push({ round: 5, bracket: 'consolation', phase: 'qf', courtId: 0, pairAId: safeGet(rankingsD, 2).id, pairBId: safeGet(rankingsB, 3).id }); 
        }

        else if (state.currentRound === 5) {
            // ROBUST FIX: Find any unfinished consolation match from R5, regardless of court ID
            const waitingMatches = state.matches.filter(m => m.round === 5 && m.bracket === 'consolation' && !m.isFinished);
            
            if (waitingMatches.length > 0 && !isOfflineMode) {
                const updates = [
                    supabase.from('matches').update({ round: 6, court_id: 3 }).eq('id', waitingMatches[0].id),
                    waitingMatches[1] ? supabase.from('matches').update({ round: 6, court_id: 4 }).eq('id', waitingMatches[1].id) : Promise.resolve()
                ];
                await Promise.all(updates);
            }

            const qfMatches = state.matches.filter(m => m.round === 5 && m.isFinished && m.bracket === 'main');
            
            const getWinner = (court: number) => {
                const m = qfMatches.find(m => m.courtId === court);
                return m ? ((m.scoreA||0)>(m.scoreB||0)?m.pairAId:m.pairBId) : null;
            };

            const wMain1 = getWinner(1);
            const wMain2 = getWinner(2);
            const wMain3 = getWinner(3);
            const wMain4 = getWinner(4);

            if (wMain1 && wMain3) playoffMatches.push({ round: 6, bracket: 'main', phase: 'sf', courtId: 1, pairAId: wMain1, pairBId: wMain3 });
            if (wMain2 && wMain4) playoffMatches.push({ round: 6, bracket: 'main', phase: 'sf', courtId: 2, pairAId: wMain2, pairBId: wMain4 });
            
            if (isOfflineMode) {
                 waitingMatches.forEach((m, idx) => {
                     playoffMatches.push({ ...m, round: 6, courtId: 3 + idx, id: `moved-${m.id}` });
                 });
            }
        }

        else if (state.currentRound === 6) {
             const sfMatches = state.matches.filter(m => m.round === 6 && m.bracket === 'main');
             const getWinnerSF = (court: number) => {
                 const m = sfMatches.find(m => m.courtId === court);
                 return m ? ((m.scoreA || 0) > (m.scoreB || 0) ? m.pairAId : m.pairBId) : null;
             };
             const wSF1 = getWinnerSF(1);
             const wSF2 = getWinnerSF(2);
             if (wSF1 && wSF2) playoffMatches.push({ round: 7, bracket: 'main', phase: 'final', courtId: 1, pairAId: wSF1, pairBId: wSF2 });

             const consQF_R5 = state.matches.filter(m => m.round === 5 && m.bracket === 'consolation' && m.isFinished);
             const consQF_R6 = state.matches.filter(m => m.round === 6 && m.bracket === 'consolation' && m.isFinished); 
             
             const getConsWinner = (matches: Match[], court: number) => {
                  const m = matches.find(m => m.courtId === court);
                  return m ? ((m.scoreA || 0) > (m.scoreB || 0) ? m.pairAId : m.pairBId) : null;
             };

             const wC1 = getConsWinner(consQF_R5, 5); 
             const wC2 = getConsWinner(consQF_R5, 6); 
             const wC3 = getConsWinner(consQF_R6, 3); 
             const wC4 = getConsWinner(consQF_R6, 4); 

             if (wC1 && wC3) playoffMatches.push({ round: 7, bracket: 'consolation', phase: 'sf', courtId: 2, pairAId: wC1, pairBId: wC3 });
             if (wC2 && wC4) playoffMatches.push({ round: 7, bracket: 'consolation', phase: 'sf', courtId: 3, pairAId: wC2, pairBId: wC4 });
        }

        else if (state.currentRound === 7) {
            const sfCons = state.matches.filter(m => m.round === 7 && m.bracket === 'consolation');
            const getWinner = (court: number) => {
                 const m = sfCons.find(m => m.courtId === court);
                 return m ? ((m.scoreA || 0) > (m.scoreB || 0) ? m.pairAId : m.pairBId) : null;
             };
             const wSFC1 = getWinner(2);
             const wSFC2 = getWinner(3);

             if (wSFC1 && wSFC2) playoffMatches.push({ round: 8, bracket: 'consolation', phase: 'final', courtId: 1, pairAId: wSFC1, pairBId: wSFC2 });
        }

        if (playoffMatches.length > 0) {
             const dbMatches = playoffMatches.map(m => ({
                tournament_id: state.id!, round: m.round, court_id: m.courtId,
                pair_a_id: m.pairAId, pair_b_id: m.pairBId, is_finished: false, bracket: m.bracket,
                phase: m.phase 
             }));
             
             if (isOfflineMode) {
                 const keptMatches = state.matches.filter(m => !(m.round === 5 && m.courtId === 0)); 
                 const newMatches = [...keptMatches, ...playoffMatches.map((m, i) => ({ ...m, id: `po-${Date.now()}-${i}`, scoreA: null, scoreB: null, isFinished: false } as Match))];
                 dispatch({ type: 'SET_STATE', payload: { currentRound: nextR, matches: newMatches } });
             } else {
                 const { error } = await supabase.from('matches').insert(dbMatches);
                 if (error) {
                     if (error.message.includes('phase') || error.code === 'PGRST204') {
                        const dbMatchesLegacy = dbMatches.map(({ phase, ...rest }) => rest);
                        const { error: retryError } = await supabase.from('matches').insert(dbMatchesLegacy);
                        if (retryError) throw new Error(`Error: ${retryError.message}`);
                     } else {
                        throw new Error(`Error: ${error.message}`);
                     }
                 }

                 await supabase.from('tournaments').update({ current_round: nextR }).eq('id', state.id);
                 loadData();
             }
        } else {
             if (state.currentRound >= 8) {
                 if(isOfflineMode) {
                     dispatch({ type: 'SET_STATE', payload: { status: 'finished' } });
                 } else {
                    await supabase.from('tournaments').update({ status: 'finished' }).eq('id', state.id);
                    loadData();
                 }
             }
        }
    };

    const archiveAndResetDB = async () => {
         if (isOfflineMode) {
             dispatch({ type: 'RESET_LOCAL' });
             return;
         }
         if (state.id) {
             // 1. Calculate Winners
             let winnerMainName = 'Desconocido';
             let winnerConsName = 'Desconocido';

             // Main Final (R7, Court 1)
             const mainFinal = state.matches.find(m => m.round === 7 && m.courtId === 1 && m.bracket === 'main');
             if (mainFinal && mainFinal.isFinished) {
                 const wId = (mainFinal.scoreA || 0) > (mainFinal.scoreB || 0) ? mainFinal.pairAId : mainFinal.pairBId;
                 const p = state.pairs.find(pair => pair.id === wId);
                 if(p) {
                      const p1 = state.players.find(pl => pl.id === p.player1Id);
                      const p2 = state.players.find(pl => pl.id === p.player2Id);
                      winnerMainName = `${formatPlayerName(p1)} & ${formatPlayerName(p2)}`;
                 }
             }

             // Consolation Final (R8, Court 1)
             const consFinal = state.matches.find(m => m.round === 8 && m.courtId === 1 && m.bracket === 'consolation');
             if (consFinal && consFinal.isFinished) {
                 const wId = (consFinal.scoreA || 0) > (consFinal.scoreB || 0) ? consFinal.pairAId : consFinal.pairBId;
                  const p = state.pairs.find(pair => pair.id === wId);
                 if(p) {
                      const p1 = state.players.find(pl => pl.id === p.player1Id);
                      const p2 = state.players.find(pl => pl.id === p.player2Id);
                      winnerConsName = `${formatPlayerName(p1)} & ${formatPlayerName(p2)}`;
                 }
             }

             // 2. Update DB with Winners
             await supabase.from('tournaments').update({ 
                 status: 'finished',
                 winner_main: winnerMainName,
                 winner_consolation: winnerConsName
             }).eq('id', state.id);

             dispatch({ type: 'RESET_LOCAL' });
         }
    };

    const hardResetDB = async () => { 
        if(isOfflineMode) {
            localStorage.removeItem(STORAGE_KEY);
            window.location.reload();
            return;
        }
        if(state.id) {
             await supabase.from('matches').delete().eq('tournament_id', state.id);
             await supabase.from('tournament_pairs').delete().eq('tournament_id', state.id);
             await supabase.from('tournaments').delete().eq('id', state.id);
             loadData();
        }
    };

    return (
        <TournamentContext.Provider value={{
            state, dispatch, loadData, addPlayerToDB, updatePlayerInDB, createPairInDB, updatePairDB,
            startTournamentDB, updateScoreDB, nextRoundDB, deletePairDB, archiveAndResetDB, regenerateMatchesDB,
            hardResetDB, formatPlayerName
        }}>
            {children}
        </TournamentContext.Provider>
    );
};

export const useTournament = () => useContext(TournamentContext);