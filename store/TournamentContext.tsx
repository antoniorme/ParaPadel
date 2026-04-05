
import React, { createContext, useContext, useReducer, useEffect, useCallback, useState } from 'react';
import { TournamentState, TournamentAction, Player, Pair, TournamentFormat, GenerationMethod } from '../types';
import { useAuth } from './AuthContext';
import { useTournamentDB } from './useTournamentDB';
import * as Logic from '../utils/TournamentLogic';

const STORAGE_KEY = 'padelpro_local_db_v3';
const PENDING_SCORES_KEY = 'padelpro_pending_scores';

export const TOURNAMENT_CATEGORIES = ['Iniciación', '5ª CAT', '4ª CAT', '3ª CAT', '2ª CAT', '1ª CAT'];

export const initialState: TournamentState = {
  status: 'finished',
  currentRound: 0, format: '16_mini', players: [], pairs: [], matches: [], groups: [], courts: [], loading: true,
  tournamentList: [],
  title: 'Mini Torneo', price: 15, prizes: [], includedItems: ['Bolas Nuevas', 'Agua'], levelRange: 'Abierto'
};

interface PendingScore {
    matchId: string;
    scoreA: number;
    scoreB: number;
    timestamp: number;
}

interface TournamentContextType {
    state: TournamentState; dispatch: React.Dispatch<TournamentAction>; loadData: () => Promise<void>;
    addPlayerToDB: (p: Partial<Player>, ownerId?: string) => Promise<string | null>; updatePlayerInDB: (p: Partial<Player>) => Promise<void>;
    deletePlayerDB: (id: string) => Promise<void>;
    createPairInDB: (p1: string, p2: string | null, status?: 'confirmed' | 'pending', tournamentIdOverride?: string) => Promise<string | null>;
    updatePairDB: (pairId: string, p1: string, p2: string) => Promise<void>;
    assignPartnerDB: (pairId: string, partnerId: string, mergeWithPairId?: string) => Promise<void>;
    startTournamentDB: (method: GenerationMethod, customOrderedPairs?: Pair[]) => Promise<void>;
    updateScoreDB: (matchId: string, sA: number, sB: number) => Promise<void>; nextRoundDB: () => Promise<void>;
    deletePairDB: (pairId: string) => Promise<void>; archiveAndResetDB: () => Promise<void>; resetToSetupDB: () => Promise<void>;
    regenerateMatchesDB: () => Promise<string>; hardResetDB: () => Promise<void>; formatPlayerName: (p?: Player) => string;
    setTournamentFormat: (fmt: TournamentFormat) => Promise<void>;
    getPairElo: (pair: Pair, players: Player[]) => number;
    substitutePairDB: (activePairId: string, reservePairId: string) => Promise<void>;
    finishTournamentDB: () => Promise<void>;
    respondToInviteDB: (pairId: string, action: 'accept' | 'reject') => Promise<void>;
    updateTournamentSettings: (settings: Partial<TournamentState>) => Promise<void>;
    createNewTournament: (metadata: Partial<TournamentState>, overrideUserId?: string) => Promise<string | null>;
    fetchTournamentList: () => Promise<void>;
    selectTournament: (tournamentId: string) => Promise<void>;
    closeTournament: () => void;
    togglePaymentDB: (playerId: string, pairId: string, isP1: boolean) => Promise<void>;
    toggleWaterDB: (pairId: string) => Promise<void>;
    toggleBallsDB: (courtId: number) => Promise<void>;
    pendingSyncCount: number;
    isOverlayOpen: boolean;
    setOverlayOpen: (isOpen: boolean) => void;
}

const TournamentContext = createContext<TournamentContextType>({
    state: initialState, dispatch: () => null, loadData: async () => {},
    addPlayerToDB: async () => null, updatePlayerInDB: async () => {}, deletePlayerDB: async () => {},
    createPairInDB: async () => null, updatePairDB: async () => {}, assignPartnerDB: async () => {}, startTournamentDB: async () => {}, updateScoreDB: async () => {}, nextRoundDB: async () => {},
    deletePairDB: async () => {}, archiveAndResetDB: async () => {}, resetToSetupDB: async () => {}, regenerateMatchesDB: async () => "", hardResetDB: async () => {},
    formatPlayerName: () => '', setTournamentFormat: async () => {}, getPairElo: () => 1200, substitutePairDB: async () => {},
    finishTournamentDB: async () => {}, respondToInviteDB: async () => {}, updateTournamentSettings: async () => {},
    createNewTournament: async () => null,
    fetchTournamentList: async () => {}, selectTournament: async () => {}, closeTournament: () => {},
    togglePaymentDB: async () => {}, toggleWaterDB: async () => {}, toggleBallsDB: async () => {},
    pendingSyncCount: 0,
    isOverlayOpen: false,
    setOverlayOpen: () => {}
});

const reducer = (state: TournamentState, action: TournamentAction): TournamentState => {
    switch (action.type) {
        case 'SET_STATE': return { ...state, ...action.payload };
        case 'SET_TOURNAMENT_LIST': return { ...state, tournamentList: action.payload };
        case 'SET_FORMAT': return { ...state, format: action.payload };
        case 'UPDATE_SETTINGS': return { ...state, ...action.payload };
        case 'SET_LOADING': return { ...state, loading: action.payload };
        case 'RESET_LOCAL': return { ...initialState, players: state.players };
        case 'TOGGLE_BALLS': return { ...state, courts: state.courts.map(c => c.id === action.payload ? { ...c, ballsGiven: !c.ballsGiven } : c) };
        case 'TOGGLE_WATER': return { ...state, pairs: state.pairs.map(p => p.id === action.payload ? { ...p, waterReceived: !p.waterReceived } : p) };
        case 'TOGGLE_PAID': return { ...state, pairs: state.pairs.map(p => { if (p.player1Id === action.payload) return { ...p, paidP1: !p.paidP1 }; if (p.player2Id === action.payload) return { ...p, paidP2: !p.paidP2 }; return p; }) };
        case 'LOAD_DEMO_DATA': return { ...state, status: 'setup', format: '16_mini' };
        default: return state;
    }
};

export const TournamentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(reducer, initialState);
    const { isOnline, user, isOfflineMode } = useAuth();
    const [isOverlayOpen, setOverlayOpen] = useState(false);

    const formatPlayerName = useCallback((p?: Player) => {
        if (!p) return 'Jugador';
        let nameToFormat = p.nickname || p.name;
        nameToFormat = nameToFormat.replace(/[\d#\*]\uFE0F?\u20E3/g, '');
        nameToFormat = nameToFormat.replace(/([\uD800-\uDBFF][\uDC00-\uDFFF])+/g, '');
        nameToFormat = nameToFormat.replace(/[\u2600-\u27BF\u2B00-\u2BFF\u2000-\u206F\uFE0F]+/g, '');
        nameToFormat = nameToFormat.replace(/^[^a-zA-Z0-9\u00C0-\u00FF]+/, '');
        nameToFormat = nameToFormat.trim();
        if (p.nickname) return nameToFormat;
        const parts = nameToFormat.split(/\s+/);
        if (parts.length >= 2) return `${parts[0]} ${parts[1].substring(0, 3)}.`;
        return parts[0];
    }, []);

    const db = useTournamentDB({ state, dispatch, formatPlayerName, initialState });

    // ── OFFLINE SCORE SYNC ────────────────────────────────────────────────────

    useEffect(() => {
        const pending = localStorage.getItem(PENDING_SCORES_KEY);
        if (pending) db.setPendingSyncCount(JSON.parse(pending).length);
    }, []);

    useEffect(() => {
        const processQueue = async () => {
            if (!isOnline) return;
            const pendingStr = localStorage.getItem(PENDING_SCORES_KEY);
            if (!pendingStr) return;
            const queue: PendingScore[] = JSON.parse(pendingStr);
            if (queue.length === 0) return;

            const { supabase } = await import('../lib/supabase');
            const failed: PendingScore[] = [];
            for (const item of queue) {
                try {
                    const { error } = await supabase.from('matches').update({
                        score_a: item.scoreA, score_b: item.scoreB, is_finished: true
                    }).eq('id', item.matchId);
                    if (error) throw error;
                } catch (e) {
                    failed.push(item);
                }
            }
            if (failed.length === 0) {
                localStorage.removeItem(PENDING_SCORES_KEY);
                db.setPendingSyncCount(0);
            } else {
                localStorage.setItem(PENDING_SCORES_KEY, JSON.stringify(failed));
                db.setPendingSyncCount(failed.length);
            }
        };
        if (isOnline) processQueue();
    }, [isOnline]);

    // ── INIT ──────────────────────────────────────────────────────────────────

    useEffect(() => {
        // Wait until auth resolves — if not offline mode, user must exist
        if (!isOfflineMode && !user) return;
        const init = async () => {
            const players = await db.loadPlayers();
            dispatch({ type: 'SET_STATE', payload: { players } });
            db.fetchTournamentList();
        };
        init();
    }, [user?.id, isOfflineMode]); // Re-run when user becomes available

    const loadData = async () => { await db.fetchTournamentList(); };

    const closeTournament = () => {
        dispatch({ type: 'SET_STATE', payload: { id: undefined, status: 'finished', pairs: [], matches: [], groups: [], currentRound: 0 } });
        db.fetchTournamentList();
    };

    return (
        <TournamentContext.Provider value={{
            state, dispatch, loadData,
            addPlayerToDB: db.addPlayerToDB,
            updatePlayerInDB: db.updatePlayerInDB,
            deletePlayerDB: db.deletePlayerDB,
            createPairInDB: db.createPairInDB,
            updatePairDB: db.updatePairDB,
            assignPartnerDB: db.assignPartnerDB,
            startTournamentDB: db.startTournamentDB,
            updateScoreDB: db.updateScoreDB,
            nextRoundDB: db.nextRoundDB,
            deletePairDB: db.deletePairDB,
            archiveAndResetDB: db.archiveAndResetDB,
            resetToSetupDB: db.resetToSetupDB,
            regenerateMatchesDB: db.regenerateMatchesDB,
            hardResetDB: db.hardResetDB,
            formatPlayerName,
            setTournamentFormat: db.setTournamentFormat,
            getPairElo: Logic.getPairElo,
            substitutePairDB: db.substitutePairDB,
            finishTournamentDB: db.finishTournamentDB,
            respondToInviteDB: db.respondToInviteDB,
            updateTournamentSettings: db.updateTournamentSettings,
            createNewTournament: db.createNewTournament,
            fetchTournamentList: db.fetchTournamentList,
            selectTournament: db.selectTournament,
            closeTournament,
            togglePaymentDB: db.togglePaymentDB,
            toggleWaterDB: db.toggleWaterDB,
            toggleBallsDB: db.toggleBallsDB,
            pendingSyncCount: db.pendingSyncCount,
            isOverlayOpen, setOverlayOpen
        }}>
            {children}
        </TournamentContext.Provider>
    );
};

export const useTournament = () => useContext(TournamentContext);
