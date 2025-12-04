import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { TournamentState, TournamentAction, Player, Pair, Match, Group, TournamentFormat, GenerationMethod } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useHistory } from './HistoryContext'; 
import * as Logic from '../utils/TournamentLogic';

const STORAGE_KEY = 'padelpro_local_db_v3'; 
export const TOURNAMENT_CATEGORIES = ['Iniciación', '5ª CAT', '4ª CAT', '3ª CAT', '2ª CAT', '1ª CAT'];

const initialState: TournamentState = {
  status: 'setup', currentRound: 0, format: '16_mini', players: [], pairs: [], matches: [], groups: [], courts: [], loading: true
};

interface TournamentContextType {
    state: TournamentState; dispatch: React.Dispatch<TournamentAction>; loadData: () => Promise<void>;
    addPlayerToDB: (p: Partial<Player>) => Promise<string | null>; updatePlayerInDB: (p: Partial<Player>) => Promise<void>;
    createPairInDB: (p1: string, p2: string) => Promise<void>; updatePairDB: (pairId: string, p1: string, p2: string) => Promise<void>;
    startTournamentDB: (method: GenerationMethod, customOrderedPairs?: Pair[]) => Promise<void>;
    updateScoreDB: (matchId: string, sA: number, sB: number) => Promise<void>; nextRoundDB: () => Promise<void>;
    deletePairDB: (pairId: string) => Promise<void>; archiveAndResetDB: () => Promise<void>; resetToSetupDB: () => Promise<void>; 
    regenerateMatchesDB: () => Promise<string>; hardResetDB: () => Promise<void>; formatPlayerName: (p?: Player) => string;
    setTournamentFormat: (fmt: TournamentFormat) => Promise<void>;
    getPairElo: (pair: Pair, players: Player[]) => number;
}

const TournamentContext = createContext<TournamentContextType>({
    state: initialState, dispatch: () => null, loadData: async () => {}, addPlayerToDB: async () => null, updatePlayerInDB: async () => {},
    createPairInDB: async () => {}, updatePairDB: async () => {}, startTournamentDB: async () => {}, updateScoreDB: async () => {}, nextRoundDB: async () => {},
    deletePairDB: async () => {}, archiveAndResetDB: async () => {}, resetToSetupDB: async () => {}, regenerateMatchesDB: async () => "", hardResetDB: async () => {},
    formatPlayerName: () => '', setTournamentFormat: async () => {}, getPairElo: () => 1200
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
        case 'LOAD_DEMO_DATA': return { ...state, status: 'setup', format: '16_mini' };
        default: return state;
    }
};

export const TournamentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(reducer, initialState);
    const { user, isOfflineMode } = useAuth();
    const { clubData } = useHistory(); 

    const formatPlayerName = useCallback((p?: Player) => {
        if (!p) return 'Jugador';
        if (p.nickname) return p.nickname;
        const parts = p.name.trim().split(/\s+/);
        if (parts.length >= 2) return `${parts[0]} ${parts[1].substring(0, 3)}.`;
        return parts[0];
    }, []);

    const loadData = useCallback(async () => {
        if (!user) return;
        dispatch({ type: 'SET_LOADING', payload: true });
        const courts = Array.from({ length: clubData.courtCount }, (_, i) => ({ id: i + 1, ballsGiven: false }));

        if (isOfflineMode) {
            const localData = localStorage.getItem(STORAGE_KEY);
            if (localData) { dispatch({ type: 'SET_STATE', payload: { ...JSON.parse(localData), courts: courts } }); } 
            else { dispatch({ type: 'SET_STATE', payload: { players: [], pairs: [], status: 'setup', courts: courts } }); }
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
                let limit = 16;
                if(format === '10_mini') limit = 10;
                if(format === '12_mini') limit = 12;
                if(format === '8_mini') limit = 8;

                let mappedPairs: Pair[] = (pairs || []).map(p => ({
                    id: p.id, tournament_id: p.tournament_id, player1Id: p.player1_id, player2Id: p.player2_id,
                    name: p.name || 'Pareja', waterReceived: p.water_received, paidP1: p.paid_p1, paidP2: p.paid_p2,
                    stats: { played: 0, won: 0, gameDiff: 0 }, isReserve: false 
                }));
                mappedPairs = mappedPairs.map((p, idx) => ({ ...p, isReserve: idx >= limit }));

                const mappedMatches: Match[] = (matches || []).map(m => ({
                    id: m.id, round: m.round, 
                    phase: m.phase || (m.round <= 4 ? 'group' : 'playoff'), bracket: m.bracket as any,
                    courtId: m.court_id, pairAId: m.pair_a_id, pairBId: m.pair_b_id,
                    scoreA: m.score_a, scoreB: m.score_b, isFinished: m.is_finished
                }));

                mappedPairs = Logic.recalculateStats(mappedPairs, mappedMatches);
                let groups: Group[] = [];
                if (mappedMatches.length > 0) groups = Logic.reconstructGroupsFromMatches(mappedPairs, mappedMatches, players || [], format);
                else {
                    const isSetup = activeTournament.status === 'setup';
                    groups = Logic.generateGroupsHelper(mappedPairs, players || [], isSetup ? 'manual' : 'elo-balanced', format);
                }

                dispatch({ type: 'SET_STATE', payload: {
                    id: activeTournament.id, status: activeTournament.status as any, currentRound: activeTournament.current_round || 0,
                    players: players || [], pairs: mappedPairs, matches: mappedMatches, groups: groups, format, courts
                }});
            }
        } catch (e) { console.warn("Supabase load error:", e); } finally { dispatch({ type: 'SET_LOADING', payload: false }); }
    }, [user, isOfflineMode, clubData.courtCount]);

    useEffect(() => { loadData(); }, [loadData]);
    const saveLocal = (newState: TournamentState) => { if (isOfflineMode) localStorage.setItem(STORAGE_KEY, JSON.stringify(newState)); };

    const setTournamentFormat = async (format: TournamentFormat) => {
        dispatch({ type: 'SET_FORMAT', payload: format });
        if (!isOfflineMode && state.id) {
            await supabase.from('tournaments').update({ format }).eq('id', state.id);
        }
        if (isOfflineMode) { const newState = { ...state, format }; saveLocal(newState); }
    };

    // DB ACTIONS
    const addPlayerToDB = async (p: Partial<Player>) => {
        if (isOfflineMode) { const newPlayer = { ...p, id: `local-${Date.now()}`, created_at: new Date().toISOString() } as Player; const newState = { ...state, players: [...state.players, newPlayer] }; dispatch({ type: 'SET_STATE', payload: newState }); saveLocal(newState); return newPlayer.id; }
        const { data, error } = await supabase.from('players').insert([{ ...p, user_id: user?.id }]).select().single();
        if (error) { alert(error.message); return null; } await loadData(); return data.id;
    };
    const updatePlayerInDB = async (p: Partial<Player>) => {
        if (isOfflineMode) { const newState = { ...state, players: state.players.map(x => x.id === p.id ? { ...x, ...p } as Player : x) }; dispatch({ type: 'SET_STATE', payload: newState }); saveLocal(newState); return; }
        await supabase.from('players').update(p).eq('id', p.id); await loadData();
    };
    const createPairInDB = async (p1: string, p2: string) => {
        if (isOfflineMode) { const newPair: Pair = { id: `pair-${Date.now()}`, player1Id: p1, player2Id: p2, name: 'Pareja', waterReceived: false, paidP1: false, paidP2: false, stats: {played:0, won:0, gameDiff:0}, isReserve: false }; let limit = 16; if(state.format === '10_mini') limit = 10; if(state.format === '12_mini') limit = 12; if(state.format === '8_mini') limit = 8; newPair.isReserve = state.pairs.length >= limit; const newState = { ...state, pairs: [...state.pairs, newPair] }; dispatch({ type: 'SET_STATE', payload: newState }); saveLocal(newState); return; }
        let tournamentId = state.id; if (!tournamentId) { const { data: t } = await supabase.from('tournaments').insert([{ user_id: user?.id, status: 'setup', format: state.format }]).select().single(); tournamentId = t.id; }
        await supabase.from('tournament_pairs').insert([{ tournament_id: tournamentId, player1_id: p1, player2_id: p2 }]); await loadData();
    };
    const updatePairDB = async (pairId: string, p1: string, p2: string) => { if (isOfflineMode) { const newState = { ...state, pairs: state.pairs.map(p => p.id === pairId ? { ...p, player1Id: p1, player2Id: p2 } : p) }; dispatch({ type: 'SET_STATE', payload: newState }); saveLocal(newState); return; } await supabase.from('tournament_pairs').update({ player1_id: p1, player2_id: p2 }).eq('id', pairId); await loadData(); };
    const deletePairDB = async (pairId: string) => { if (isOfflineMode) { const remaining = state.pairs.filter(p => p.id !== pairId); let limit = 16; if(state.format === '10_mini') limit = 10; if(state.format === '12_mini') limit = 12; if(state.format === '8_mini') limit = 8; const reindexed = remaining.map((p, idx) => ({ ...p, isReserve: idx >= limit })); const newState = { ...state, pairs: reindexed }; dispatch({ type: 'SET_STATE', payload: newState }); saveLocal(newState); return; } await supabase.from('tournament_pairs').delete().eq('id', pairId); await loadData(); };
    const updateScoreDB = async (matchId: string, sA: number, sB: number) => { if (isOfflineMode) { const newMatches = state.matches.map(m => m.id === matchId ? { ...m, scoreA: sA, scoreB: sB, isFinished: true } : m); const newPairs = Logic.recalculateStats(state.pairs, newMatches); const newState = { ...state, matches: newMatches, pairs: newPairs }; dispatch({ type: 'SET_STATE', payload: newState }); saveLocal(newState); return; } await supabase.from('matches').update({ score_a: sA, score_b: sB, is_finished: true }).eq('id', matchId); await loadData(); };

    const startTournamentDB = async (method: GenerationMethod, customOrderedPairs?: Pair[]) => {
        let limit = 16;
        if(state.format === '10_mini') limit = 10;
        if(state.format === '12_mini') limit = 12;
        if(state.format === '8_mini') limit = 8;
        
        const allPairs = state.pairs; 
        if (allPairs.length < limit) throw new Error(`Se necesitan al menos ${limit} parejas.`);

        let orderedPairs = customOrderedPairs || allPairs;
        if (method !== 'manual' && !customOrderedPairs) orderedPairs = Logic.sortPairsByMethod(allPairs, state.players, method);

        const groups = Logic.generateGroupsHelper(orderedPairs, state.players, method, state.format);
        
        let matches: Partial<Match>[] = [];
        if (state.format === '10_mini') matches = Logic.generateMatches10(groups);
        else if (state.format === '8_mini') matches = Logic.generateMatches8(groups);
        else if (state.format === '12_mini') matches = Logic.generateMatches12(groups, clubData.courtCount);
        else matches = Logic.generateMatches16(groups, clubData.courtCount);

        const reindexedPairs = orderedPairs.map((p, idx) => ({ ...p, isReserve: idx >= limit }));

        if (isOfflineMode) {
            const newState: TournamentState = { ...state, status: 'active', currentRound: 1, groups, matches: matches as Match[], pairs: reindexedPairs };
            dispatch({ type: 'SET_STATE', payload: newState }); saveLocal(newState); return;
        }
        if (!state.id) throw new Error("ID de torneo perdido.");
        await supabase.from('tournaments').update({ status: 'active', current_round: 1, format: state.format }).eq('id', state.id);
        
        // --- FIX: MAPPING JS camelCase -> SQL snake_case ---
        const matchesDB = matches.map(m => ({
            tournament_id: state.id,
            round: m.round,
            phase: m.phase,
            bracket: m.bracket,
            court_id: m.courtId, // Fixed mapping
            pair_a_id: m.pairAId,
            pair_b_id: m.pairBId,
            score_a: m.scoreA,
            score_b: m.scoreB,
            is_finished: m.isFinished
        }));

        const { error } = await supabase.from('matches').insert(matchesDB);
        if (error) {
             if (error.message.includes('phase')) {
                 const matchesNoPhase = matchesDB.map(({ phase, ...rest }) => rest);
                 const { error: retryError } = await supabase.from('matches').insert(matchesNoPhase);
                 if (retryError) throw retryError;
             } else { throw error; }
        }
        await loadData();
    };

    const nextRoundDB = async () => {
        const nextRound = state.currentRound + 1;
        const newMatches = Logic.generateNextRoundMatches(state, clubData.courtCount);
        
        if (newMatches.length > 0) {
             if (!isOfflineMode) {
                 const matchesDB = newMatches.map(m => ({
                    tournament_id: state.id,
                    round: m.round,
                    phase: m.phase,
                    bracket: m.bracket,
                    court_id: m.courtId,
                    pair_a_id: m.pairAId,
                    pair_b_id: m.pairBId,
                    score_a: m.scoreA,
                    score_b: m.scoreB,
                    is_finished: m.isFinished
                }));
                await supabase.from('matches').insert(matchesDB);
             } 
        }

        if (!isOfflineMode) {
            await supabase.from('tournaments').update({ current_round: nextRound }).eq('id', state.id);
        } else {
            const updatedMatches = [...state.matches, ...newMatches as Match[]];
            const newState = { ...state, currentRound: nextRound, matches: updatedMatches };
            dispatch({ type: 'SET_STATE', payload: newState }); saveLocal(newState); return;
        }
        await loadData();
    };

    const archiveAndResetDB = async () => {
        const { wMain, wCons } = Logic.calculateChampions(state, (id, p, pair) => {
             const pp = pair.find(x => x.id === id); if(!pp) return 'Desc.';
             const p1 = p.find(x => x.id === pp.player1Id); const p2 = p.find(x => x.id === pp.player2Id);
             return `${formatPlayerName(p1)} & ${formatPlayerName(p2)}`;
        });
        if (!isOfflineMode) await supabase.from('tournaments').update({ status: 'finished', winner_main: wMain, winner_consolation: wCons }).eq('id', state.id);
        dispatch({ type: 'RESET_LOCAL' });
    };

    const resetToSetupDB = async () => {
        if (isOfflineMode) { const newState: TournamentState = { ...state, status: 'setup', currentRound: 0, matches: [], groups: [] }; dispatch({ type: 'SET_STATE', payload: newState }); saveLocal(newState); return; }
        if (!state.id) return;
        await supabase.from('tournaments').update({ status: 'setup', current_round: 0 }).eq('id', state.id);
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
            formatPlayerName, setTournamentFormat, getPairElo: Logic.getPairElo
        }}>
            {children}
        </TournamentContext.Provider>
    );
};

export const useTournament = () => useContext(TournamentContext);