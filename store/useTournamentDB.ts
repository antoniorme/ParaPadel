import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useHistory } from './HistoryContext';
import { useNotifications } from './NotificationContext';
import * as Logic from '../utils/TournamentLogic';
import {
    TournamentState, TournamentAction, Player, Pair, Match,
    Group, TournamentFormat, GenerationMethod, TournamentSummary
} from '../types';
import { calculateInitialElo } from '../utils/Elo';

const STORAGE_KEY = 'padelpro_local_db_v3';
const PENDING_SCORES_KEY = 'padelpro_pending_scores';

interface PendingScore {
    matchId: string;
    scoreA: number;
    scoreB: number;
    timestamp: number;
}

interface UseTournamentDBParams {
    state: TournamentState;
    dispatch: React.Dispatch<TournamentAction>;
    formatPlayerName: (p?: Player) => string;
    initialState: TournamentState;
}

export function useTournamentDB({ state, dispatch, formatPlayerName, initialState }: UseTournamentDBParams) {
    const { user, isOfflineMode, isOnline } = useAuth();
    const { clubData } = useHistory();
    const { addNotification } = useNotifications();
    const [pendingSyncCount, setPendingSyncCount] = useState(0);

    const checkOnline = () => {
        if (!isOnline && !isOfflineMode) throw new Error("Sin conexión a internet. No se pueden guardar cambios (excepto resultados).");
    };

    const saveLocal = (newState: TournamentState) => {
        if (isOfflineMode) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
            window.dispatchEvent(new Event('local-db-update'));
        }
    };

    // ── LOAD ──────────────────────────────────────────────────────────────────

    const loadPlayers = useCallback(async () => {
        if (!user && !isOfflineMode) return [];
        if (isOfflineMode) {
            const localData = localStorage.getItem(STORAGE_KEY);
            return localData ? JSON.parse(localData).players || [] : [];
        }
        const { data: players } = await supabase.from('players').select('*').eq('user_id', user!.id).order('name');
        return players || [];
    }, [user, isOfflineMode]);

    const fetchTournamentList = useCallback(async () => {
        if (!user && !isOfflineMode) return;
        if (isOfflineMode) {
            const localData = localStorage.getItem(STORAGE_KEY);
            if (localData) {
                const parsed = JSON.parse(localData);
                if (parsed.status !== 'finished' || parsed.id) {
                    dispatch({ type: 'SET_TOURNAMENT_LIST', payload: [{
                        id: parsed.id || 'local-active',
                        title: parsed.title || 'Torneo Local',
                        date: parsed.startDate || new Date().toISOString(),
                        status: parsed.status,
                        format: parsed.format,
                        playerCount: (parsed.pairs || []).length
                    }]});
                }
            }
            return;
        }
        if (!isOnline) return;

        const { data: tournaments } = await supabase
            .from('tournaments')
            .select('*')
            .eq('user_id', user!.id)
            .neq('status', 'finished')
            .order('date', { ascending: true });

        if (tournaments) {
            const tIds = tournaments.map(t => t.id);
            const { data: allPairs } = await supabase
                .from('tournament_pairs')
                .select('tournament_id, status, player2_id')
                .in('tournament_id', tIds);

            const summaries: TournamentSummary[] = tournaments.map(t => {
                const count = allPairs
                    ? allPairs.filter(p => p.tournament_id === t.id && p.status !== 'rejected').length
                    : 0;
                return { id: t.id, title: t.title || 'Sin Título', date: t.date, status: t.status as any, format: t.format, playerCount: count };
            });
            dispatch({ type: 'SET_TOURNAMENT_LIST', payload: summaries });
        }
    }, [user, isOfflineMode, isOnline, dispatch]);

    const selectTournament = useCallback(async (tournamentId: string) => {
        dispatch({ type: 'SET_LOADING', payload: true });

        const courts = Array.from({ length: clubData.courtCount }, (_, i) => ({ id: i + 1, ballsGiven: false }));
        const players = await loadPlayers();

        if (isOfflineMode) {
            const localData = localStorage.getItem(STORAGE_KEY);
            if (localData) {
                const parsed = JSON.parse(localData);
                dispatch({ type: 'SET_STATE', payload: { ...parsed, players, courts } });
            }
            dispatch({ type: 'SET_LOADING', payload: false });
            return;
        }

        if (!isOnline) {
            dispatch({ type: 'SET_LOADING', payload: false });
            return;
        }

        try {
            const { data: tournament } = await supabase.from('tournaments').select('*').eq('id', tournamentId).single();
            if (!tournament) throw new Error("Torneo no encontrado");

            const { data: pairs } = await supabase.from('tournament_pairs').select('*').eq('tournament_id', tournamentId).order('created_at', { ascending: true });
            const { data: matches } = await supabase.from('matches').select('*').eq('tournament_id', tournamentId);

            const format: TournamentFormat = tournament.format || '16_mini';
            let limit = 16;
            if (format === '10_mini') limit = 10;
            if (format === '12_mini') limit = 12;
            if (format === '8_mini') limit = 8;

            let mappedPairs: Pair[] = (pairs || []).map(p => ({
                id: p.id, tournament_id: p.tournament_id, player1Id: p.player1_id, player2Id: p.player2_id,
                name: p.name || 'Pareja', waterReceived: p.water_received, paidP1: p.paid_p1, paidP2: p.paid_p2,
                stats: { played: 0, won: 0, gameDiff: 0 }, isReserve: false, status: p.status || 'confirmed'
            }));

            const mappedMatches: Match[] = (matches || []).map(m => {
                const isGroupStage = (format === '16_mini' && m.round <= 4) || (format !== '16_mini' && m.round <= 3);
                return {
                    id: m.id, round: m.round,
                    phase: m.phase || (isGroupStage ? 'group' : 'qf'),
                    bracket: m.bracket as any,
                    courtId: m.court_id, pairAId: m.pair_a_id, pairBId: m.pair_b_id,
                    scoreA: m.score_a, scoreB: m.score_b, isFinished: m.is_finished
                };
            });

            // Apply pending scores from queue for UI consistency
            const pendingStr = localStorage.getItem(PENDING_SCORES_KEY);
            if (pendingStr) {
                const pending: PendingScore[] = JSON.parse(pendingStr);
                pending.forEach(p => {
                    const matchIdx = mappedMatches.findIndex(m => m.id === p.matchId);
                    if (matchIdx >= 0) {
                        mappedMatches[matchIdx] = { ...mappedMatches[matchIdx], scoreA: p.scoreA, scoreB: p.scoreB, isFinished: true };
                    }
                });
            }

            mappedPairs = Logic.recalculateStats(mappedPairs, mappedMatches);

            let groups: Group[] = [];
            if (mappedMatches.length > 0) {
                groups = Logic.reconstructGroupsFromMatches(mappedPairs, mappedMatches, players, format);
            } else {
                const isSetup = tournament.status === 'setup';
                if (!isSetup) groups = Logic.generateGroupsHelper(mappedPairs, players, 'elo-balanced', format);
            }

            if (groups.length > 0) {
                const activeIds = new Set(groups.flatMap(g => g.pairIds));
                mappedPairs = mappedPairs.map(p => ({ ...p, isReserve: !activeIds.has(p.id) }));
            } else {
                const completeConfirmed = mappedPairs.filter(p => p.player2Id && p.status === 'confirmed');
                const others = mappedPairs.filter(p => !p.player2Id || p.status !== 'confirmed');
                const completeConfirmedWithReserves = completeConfirmed.map((p, idx) => ({ ...p, isReserve: idx >= limit }));
                mappedPairs = [...completeConfirmedWithReserves, ...others.map(p => ({ ...p, isReserve: true }))];
            }

            const tempKey = `padelpro_courts_${tournament.id}`;
            const savedCourts = localStorage.getItem(tempKey);
            const finalCourts = savedCourts ? JSON.parse(savedCourts) : courts;

            dispatch({ type: 'SET_STATE', payload: {
                id: tournament.id, status: tournament.status as any,
                currentRound: tournament.current_round || 0, players,
                pairs: mappedPairs, matches: mappedMatches, groups, format, courts: finalCourts,
                title: tournament.title, price: tournament.price, prizes: tournament.prizes,
                description: tournament.description, startDate: tournament.date,
                levelRange: tournament.level_range, includedItems: tournament.included_items
            }});
        } catch (e) {
            // tournament load failed
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    }, [user, isOfflineMode, isOnline, clubData.courtCount, loadPlayers, dispatch]);

    // ── CHECK-IN TOGGLES ──────────────────────────────────────────────────────

    const togglePaymentDB = async (playerId: string, pairId: string, isP1: boolean) => {
        dispatch({ type: 'TOGGLE_PAID', payload: playerId });
        if (isOfflineMode) return;
        checkOnline();
        const pair = state.pairs.find(p => p.id === pairId);
        if (!pair) return;
        const newVal = isP1 ? !pair.paidP1 : !pair.paidP2;
        await supabase.from('tournament_pairs').update({ [isP1 ? 'paid_p1' : 'paid_p2']: newVal }).eq('id', pairId);
    };

    const toggleWaterDB = async (pairId: string) => {
        dispatch({ type: 'TOGGLE_WATER', payload: pairId });
        if (isOfflineMode) return;
        checkOnline();
        const pair = state.pairs.find(p => p.id === pairId);
        if (!pair) return;
        await supabase.from('tournament_pairs').update({ water_received: !pair.waterReceived }).eq('id', pairId);
    };

    const toggleBallsDB = async (courtId: number) => {
        dispatch({ type: 'TOGGLE_BALLS', payload: courtId });
        if (!isOfflineMode && state.id) {
            const updatedCourts = state.courts.map(c => c.id === courtId ? { ...c, ballsGiven: !c.ballsGiven } : c);
            localStorage.setItem(`padelpro_courts_${state.id}`, JSON.stringify(updatedCourts));
        }
    };

    // ── SETTINGS ──────────────────────────────────────────────────────────────

    const setTournamentFormat = async (format: TournamentFormat) => {
        dispatch({ type: 'SET_FORMAT', payload: format });
        if (!isOfflineMode && state.id) {
            checkOnline();
            await supabase.from('tournaments').update({ format }).eq('id', state.id);
        }
    };

    const updateTournamentSettings = async (settings: Partial<TournamentState>) => {
        dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
        if (isOfflineMode) { saveLocal({ ...state, ...settings }); return; }
        if (state.id) {
            checkOnline();
            await supabase.from('tournaments').update({
                title: settings.title, price: settings.price, prizes: settings.prizes,
                description: settings.description, level_range: settings.levelRange,
                included_items: settings.includedItems, format: settings.format
            }).eq('id', state.id);
        }
    };

    const createNewTournament = async (metadata: Partial<TournamentState>, overrideUserId?: string) => {
        if (isOfflineMode) {
            const newId = `local-tournament-${Date.now()}`;
            const newTournament: TournamentState = {
                ...initialState, id: newId, status: 'setup',
                format: metadata.format || '16_mini', title: metadata.title || 'Torneo Local',
                price: metadata.price || 0, prizes: metadata.prizes || [],
                description: metadata.description || '', levelRange: metadata.levelRange || 'Abierto',
                includedItems: metadata.includedItems || [],
                startDate: metadata.startDate || new Date().toISOString(),
                players: [], pairs: [], matches: [], groups: [], courts: []
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newTournament));
            dispatch({ type: 'SET_STATE', payload: newTournament });
            dispatch({ type: 'SET_TOURNAMENT_LIST', payload: [{
                id: newId, title: newTournament.title, date: newTournament.startDate,
                status: 'setup', format: newTournament.format, playerCount: 0
            }]});
            return newId;
        }
        checkOnline();
        const currentUser = overrideUserId ? { id: overrideUserId } : (user || (await supabase.auth.getUser()).data.user);
        if (currentUser) {
            const { data, error } = await supabase.from('tournaments').insert([{
                user_id: currentUser.id, status: 'setup', format: metadata.format || '16_mini',
                title: metadata.title, price: metadata.price, prizes: metadata.prizes,
                description: metadata.description, level_range: metadata.levelRange,
                included_items: metadata.includedItems, date: metadata.startDate
            }]).select().single();
            if (error) throw error;
            await selectTournament(data.id);
            return data.id;
        }
        return null;
    };

    // ── PLAYERS ───────────────────────────────────────────────────────────────

    const addPlayerToDB = async (p: Partial<Player>, ownerId?: string) => {
        if (isOfflineMode) {
            const localData = localStorage.getItem(STORAGE_KEY);
            const currentData = localData ? JSON.parse(localData) : initialState;
            const currentPlayers = currentData.players || [];
            const existing = currentPlayers.find((cp: Player) => cp.name.toLowerCase() === (p.name || '').trim().toLowerCase());
            if (existing) return existing.id;
            const newPlayer: Player = {
                id: `local-player-${Date.now()}-${Math.random()}`,
                name: p.name || 'Jugador', email: p.email, phone: p.phone,
                level: p.level || 3, matchesPlayed: 0, matchesWon: 0, elo: 1200, ...p
            } as Player;
            const newPlayers = [...currentPlayers, newPlayer];
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...currentData, players: newPlayers }));
            dispatch({ type: 'SET_STATE', payload: { players: newPlayers } });
            return newPlayer.id;
        }
        checkOnline();
        const targetUserId = ownerId || user?.id;
        if (p.name) {
            const { data: existing } = await supabase.from('players').select('id').eq('user_id', targetUserId).ilike('name', p.name.trim()).maybeSingle();
            if (existing) return existing.id;
        }
        const { data, error } = await supabase.from('players').insert([{ ...p, user_id: targetUserId }]).select().single();
        if (error) return null;
        dispatch({ type: 'SET_STATE', payload: { players: [...state.players, data] } });
        return data.id;
    };

    const updatePlayerInDB = async (p: Partial<Player>) => {
        if (isOfflineMode) return;
        checkOnline();
        await supabase.from('players').update(p).eq('id', p.id);
        dispatch({ type: 'SET_STATE', payload: { players: state.players.map(x => x.id === p.id ? { ...x, ...p } as Player : x) } });
    };

    const deletePlayerDB = async (id: string) => {
        if (isOfflineMode) return;
        checkOnline();
        const { error } = await supabase.from('players').delete().eq('id', id);
        if (error) throw error;
        dispatch({ type: 'SET_STATE', payload: { players: state.players.filter(p => p.id !== id) } });
    };

    // ── PAIRS ─────────────────────────────────────────────────────────────────

    const createPairInDB = async (p1: string, p2: string | null, status: 'confirmed' | 'pending' = 'confirmed', tournamentIdOverride?: string) => {
        if (isOfflineMode) {
            const localData = localStorage.getItem(STORAGE_KEY);
            const currentData = localData ? JSON.parse(localData) : initialState;
            const currentPairs = currentData.pairs || [];
            const newPair: Pair = {
                id: `local-pair-${Date.now()}-${Math.random()}`,
                tournament_id: tournamentIdOverride || state.id || 'local',
                player1Id: p1, player2Id: p2, name: 'Pareja Local', status,
                stats: { played: 0, won: 0, gameDiff: 0 }, isReserve: false,
                waterReceived: false, paidP1: false, paidP2: false
            };
            const newPairs = [...currentPairs, newPair];
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...currentData, pairs: newPairs }));
            dispatch({ type: 'SET_STATE', payload: { pairs: newPairs } });
            return newPair.id;
        }
        checkOnline();
        const tournamentId = tournamentIdOverride || state.id;
        if (!tournamentId) return null;
        const { data } = await supabase.from('tournament_pairs').insert([{ tournament_id: tournamentId, player1_id: p1, player2_id: p2, status }]).select().single();
        if (p2 && status === 'pending') {
            const inviter = state.players.find(p => p.id === p1)?.name || 'Un jugador';
            addNotification(p2, 'invite', 'Invitación a Torneo', `${inviter} te ha invitado a formar pareja.`, '/p/tournaments');
        }
        if (state.id === tournamentId) await selectTournament(tournamentId);
        return data?.id || null;
    };

    const updatePairDB = async (pairId: string, p1: string, p2: string) => {
        if (isOfflineMode) return;
        checkOnline();
        await supabase.from('tournament_pairs').update({ player1_id: p1, player2_id: p2 }).eq('id', pairId);
        if (state.id) await selectTournament(state.id);
    };

    const deletePairDB = async (pairId: string) => {
        if (isOfflineMode) return;
        checkOnline();
        await supabase.from('tournament_pairs').delete().eq('id', pairId);
        if (state.id) await selectTournament(state.id);
    };

    const assignPartnerDB = async (pairId: string, partnerId: string, mergeWithPairId?: string) => {
        if (isOfflineMode) return;
        checkOnline();
        await supabase.from('tournament_pairs').update({ player2_id: partnerId }).eq('id', pairId);
        if (mergeWithPairId) await supabase.from('tournament_pairs').delete().eq('id', mergeWithPairId);
        if (state.id) await selectTournament(state.id);
    };

    const respondToInviteDB = async (pairId: string, action: 'accept' | 'reject') => {
        if (isOfflineMode) return;
        checkOnline();
        await supabase.from('tournament_pairs').update({ status: action === 'accept' ? 'confirmed' : 'rejected' }).eq('id', pairId);
        if (state.id) await selectTournament(state.id);
    };

    const substitutePairDB = async (activePairId: string, reservePairId: string) => {
        if (isOfflineMode) return;
        checkOnline();
        const activePair = state.pairs.find(p => p.id === activePairId);
        const reservePair = state.pairs.find(p => p.id === reservePairId);
        if (!activePair || !reservePair) throw new Error("No se encontraron las parejas.");
        if (!reservePair.player2Id) throw new Error("La reserva debe ser una pareja completa.");
        await supabase.from('tournament_pairs').update({ player1_id: reservePair.player1Id, player2_id: reservePair.player2Id, paid_p1: reservePair.paidP1, paid_p2: reservePair.paidP2, water_received: false }).eq('id', activePairId);
        await supabase.from('tournament_pairs').update({ player1_id: activePair.player1Id, player2_id: activePair.player2Id, paid_p1: activePair.paidP1, paid_p2: activePair.paidP2, water_received: activePair.waterReceived }).eq('id', reservePairId);
        if (state.id) await selectTournament(state.id);
    };

    // ── TOURNAMENT LIFECYCLE ──────────────────────────────────────────────────

    const startTournamentDB = async (method: GenerationMethod, customOrderedPairs?: Pair[]) => {
        if (isOfflineMode) return;
        checkOnline();

        let limit = 16;
        if (state.format === '10_mini') limit = 10;
        if (state.format === '12_mini') limit = 12;
        if (state.format === '8_mini') limit = 8;

        const allPairs = state.pairs.filter(p => p.status === 'confirmed' && p.player2Id !== null);
        if (allPairs.length < limit) throw new Error(`Se necesitan al menos ${limit} parejas confirmadas y completas.`);

        const orderedPairs: Pair[] = method === 'manual' && customOrderedPairs
            ? customOrderedPairs
            : Logic.sortPairsByMethod(allPairs, state.players, method);

        const groups = Logic.generateGroupsHelper(orderedPairs, state.players, method, state.format);

        let matches: Partial<Match>[] = [];
        if (state.format === '10_mini') matches = Logic.generateMatches10(groups);
        else if (state.format === '8_mini') matches = Logic.generateMatches8(groups);
        else if (state.format === '12_mini') matches = Logic.generateMatches12(groups, clubData.courtCount);
        else matches = Logic.generateMatches16(groups, clubData.courtCount);

        if (!state.id) throw new Error("ID de torneo perdido.");
        await supabase.from('matches').delete().eq('tournament_id', state.id);
        await supabase.from('tournaments').update({ status: 'active', current_round: 1, format: state.format }).eq('id', state.id);

        const matchesDB = matches.map(m => ({ tournament_id: state.id, round: m.round, phase: m.phase, bracket: m.bracket, court_id: m.courtId, pair_a_id: m.pairAId, pair_b_id: m.pairBId, score_a: m.scoreA, score_b: m.scoreB, is_finished: m.isFinished }));
        const { error } = await supabase.from('matches').insert(matchesDB);
        if (error) {
            if (error.message.includes('phase')) {
                const matchesNoPhase = matchesDB.map(({ phase, ...rest }) => rest);
                const { error: retryError } = await supabase.from('matches').insert(matchesNoPhase);
                if (retryError) throw retryError;
            } else {
                throw error;
            }
        }

        const activeIds = new Set(groups.flatMap(g => g.pairIds));
        activeIds.forEach(pairId => {
            const pair = state.pairs.find(p => p.id === pairId);
            if (pair) {
                addNotification(pair.player1Id, 'match_start', 'Torneo Iniciado', 'El torneo ha comenzado. Revisa tu pista.', '/p/tournaments');
                if (pair.player2Id) addNotification(pair.player2Id, 'match_start', 'Torneo Iniciado', 'El torneo ha comenzado. Revisa tu pista.', '/p/tournaments');
            }
        });

        await selectTournament(state.id);
    };

    const nextRoundDB = async () => {
        checkOnline();
        const nextRound = state.currentRound + 1;
        const newMatches = Logic.generateNextRoundMatches(state, clubData.courtCount);
        if (newMatches.length > 0) {
            const matchesDB = newMatches.map(m => ({ tournament_id: state.id, round: m.round, phase: m.phase, bracket: m.bracket, court_id: m.courtId, pair_a_id: m.pairAId, pair_b_id: m.pairBId, score_a: m.scoreA, score_b: m.scoreB, is_finished: m.isFinished }));
            await supabase.from('matches').insert(matchesDB);
        }
        await supabase.from('tournaments').update({ current_round: nextRound }).eq('id', state.id);
        if (state.id) await selectTournament(state.id);
    };

    const updateScoreDB = async (matchId: string, sA: number, sB: number) => {
        if (!isOnline && !isOfflineMode) {
            const pendingStr = localStorage.getItem(PENDING_SCORES_KEY);
            const pendingQueue: PendingScore[] = pendingStr ? JSON.parse(pendingStr) : [];
            const filteredQueue = pendingQueue.filter(p => p.matchId !== matchId);
            filteredQueue.push({ matchId, scoreA: sA, scoreB: sB, timestamp: Date.now() });
            localStorage.setItem(PENDING_SCORES_KEY, JSON.stringify(filteredQueue));
            setPendingSyncCount(filteredQueue.length);
            const newMatches = state.matches.map(m => m.id === matchId ? { ...m, scoreA: sA, scoreB: sB, isFinished: true } : m);
            const newPairs = Logic.recalculateStats(state.pairs, newMatches);
            dispatch({ type: 'SET_STATE', payload: { ...state, matches: newMatches, pairs: newPairs } });
            return;
        }
        if (isOfflineMode) {
            const newMatches = state.matches.map(m => m.id === matchId ? { ...m, scoreA: sA, scoreB: sB, isFinished: true } : m);
            const newPairs = Logic.recalculateStats(state.pairs, newMatches);
            dispatch({ type: 'SET_STATE', payload: { ...state, matches: newMatches, pairs: newPairs } });
            saveLocal({ ...state, matches: newMatches, pairs: newPairs });
            return;
        }
        await supabase.from('matches').update({ score_a: sA, score_b: sB, is_finished: true }).eq('id', matchId);
        const match = state.matches.find(m => m.id === matchId);
        if (match) {
            const title = "Partido Finalizado";
            const msg = `Resultado: ${sA} - ${sB}. Revisa tu nuevo ELO.`;
            [match.pairAId, match.pairBId].forEach(pairId => {
                const pair = state.pairs.find(p => p.id === pairId);
                if (pair) {
                    addNotification(pair.player1Id, 'result', title, msg, '/p/profile');
                    if (pair.player2Id) addNotification(pair.player2Id, 'result', title, msg, '/p/profile');
                }
            });
        }
        if (state.id) await selectTournament(state.id);
    };

    const finishTournamentDB = async () => {
        checkOnline();
        const { wMain, wCons } = Logic.calculateChampions(state, (id, p, pair) => {
            const pp = pair.find(x => x.id === id);
            if (!pp) return 'Desc.';
            const p1 = p.find(x => x.id === pp.player1Id);
            const p2 = pp.player2Id ? p.find(x => x.id === pp.player2Id) : null;
            return `${formatPlayerName(p1)} & ${formatPlayerName(p2)}`;
        });
        if (state.id) await supabase.from('tournaments').update({ status: 'finished', winner_main: wMain, winner_consolation: wCons }).eq('id', state.id);
        dispatch({ type: 'SET_STATE', payload: { ...state, status: 'finished' as const } });
    };

    const archiveAndResetDB = async () => {
        checkOnline();
        const { wMain, wCons } = Logic.calculateChampions(state, (id, p, pair) => {
            const pp = pair.find(x => x.id === id);
            if (!pp) return 'Desconocido';
            const p1 = p.find(x => x.id === pp.player1Id);
            const p2 = pp.player2Id ? p.find(x => x.id === pp.player2Id) : null;
            return `${formatPlayerName(p1)} & ${formatPlayerName(p2)}`;
        });
        await supabase.from('tournaments').update({ status: 'finished', winner_main: wMain, winner_consolation: wCons }).eq('id', state.id);
    };

    const resetToSetupDB = async () => {
        if (isOfflineMode) return;
        checkOnline();
        if (!state.id) return;
        await supabase.from('tournaments').update({ status: 'setup', current_round: 0 }).eq('id', state.id);
        await supabase.from('matches').delete().eq('tournament_id', state.id);
        if (state.id) await selectTournament(state.id);
    };

    const regenerateMatchesDB = async () => "Not implemented";
    const hardResetDB = async () => { dispatch({ type: 'RESET_LOCAL' }); };

    return {
        loadPlayers,
        fetchTournamentList,
        selectTournament,
        togglePaymentDB,
        toggleWaterDB,
        toggleBallsDB,
        setTournamentFormat,
        updateTournamentSettings,
        createNewTournament,
        addPlayerToDB,
        updatePlayerInDB,
        deletePlayerDB,
        createPairInDB,
        updatePairDB,
        deletePairDB,
        assignPartnerDB,
        respondToInviteDB,
        substitutePairDB,
        startTournamentDB,
        nextRoundDB,
        updateScoreDB,
        finishTournamentDB,
        archiveAndResetDB,
        resetToSetupDB,
        regenerateMatchesDB,
        hardResetDB,
        pendingSyncCount,
        setPendingSyncCount,
    };
}
