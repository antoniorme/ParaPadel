
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LeagueState, LeagueCategory, LeagueGroup, LeagueMatch, Pair, LeaguePhase } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useHistory } from './HistoryContext';

interface PlayoffConfig {
    qualifiersPerGroup: number;
    crossType: 'internal' | 'crossed';
    mode: 'single' | 'double';
}

interface LeagueContextType {
    league: LeagueState;
    leaguesList: any[];
    fetchLeagues: () => Promise<void>;
    selectLeague: (id: string) => Promise<void>;
    updateLeagueScore: (matchId: string, setsA: number, setsB: number, scoreText: string) => Promise<void>;
    createLeague: (data: Partial<LeagueState> & { prizeWinner?: string, prizeRunnerUp?: string }) => Promise<string | null>;
    updateLeague: (id: string, data: Partial<LeagueState>) => Promise<void>;
    addLeagueCategory: (name: string) => Promise<void>;
    updateLeagueCategory: (id: string, name: string) => Promise<void>; // NEW
    generateLeagueGroups: (categoryId: string, groupsCount: number, method: 'elo-balanced' | 'elo-mixed', doubleRound: boolean) => Promise<void>;
    advanceToPlayoffs: (categoryId: string, config: PlayoffConfig) => Promise<void>;
    addPairToLeague: (pair: Partial<Pair>) => Promise<void>;
    deletePairFromLeague: (pairId: string) => Promise<void>;
    updateLeaguePair: (pairId: string, p1: string, p2: string) => Promise<void>; 
    isLeagueModuleEnabled: boolean;
}

const initialLeagueState: LeagueState = {
    title: '',
    status: 'registration',
    startDate: '2024-01-12',
    endDate: '2024-04-15',
    playoffDate: '2024-04-17',
    categories: [], 
    groups: [],
    matches: [],
    pairs: [],
    loading: false
};

const LeagueContext = createContext<LeagueContextType | undefined>(undefined);

export const LeagueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, isOfflineMode } = useAuth();
    const { clubData } = useHistory();
    const [league, setLeague] = useState<LeagueState>(initialLeagueState);
    const [leaguesList, setLeaguesList] = useState<any[]>([]);

    const isLeagueModuleEnabled = clubData.league_enabled || false;

    // 1. FETCH LEAGUES LIST
    const fetchLeagues = useCallback(async () => {
        if (!user && !isOfflineMode) return;
        if (isOfflineMode) {
            setLeaguesList([{ 
                id: 'local-league-1', 
                title: 'Liga Local (Demo)', 
                status: 'registration',
                startDate: new Date().toISOString(),
                endDate: new Date().toISOString(),
                pairsCount: 0
            }]);
            return;
        }
        
        const { data } = await supabase.from('leagues')
            .select('*')
            .eq('club_id', user?.id)
            .order('created_at', { ascending: false });
            
        setLeaguesList(data || []);
    }, [user, isOfflineMode]);

    // 2. SELECT & LOAD FULL LEAGUE DATA
    const selectLeague = async (id: string) => {
        setLeague(prev => ({ ...prev, loading: true }));
        
        if (isOfflineMode) {
            const saved = localStorage.getItem(`league_data_${id}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.categories?.length > 0 && !parsed.mainCategoryId) {
                    parsed.mainCategoryId = parsed.categories[0].id;
                }
                setLeague(parsed);
            }
            else setLeague(prev => ({ ...prev, id, loading: false }));
            return;
        }

        try {
            const [
                { data: leagueData },
                { data: categories },
                { data: groups },
                { data: pairs },
                { data: matches }
            ] = await Promise.all([
                supabase.from('leagues').select('*').eq('id', id).single(),
                supabase.from('league_categories').select('*').eq('league_id', id).order('created_at', { ascending: true }),
                supabase.from('league_groups').select('*').eq('league_id', id),
                supabase.from('league_pairs').select('*').eq('league_id', id),
                supabase.from('league_matches').select('*').eq('league_id', id)
            ]);

            if (!leagueData) throw new Error("Liga no encontrada");

            const mappedGroups: LeagueGroup[] = (groups || []).map(g => ({
                id: g.id,
                category_id: g.category_id,
                name: g.name,
                pairIds: (pairs || []).filter(p => p.group_id === g.id).map(p => p.id)
            }));

            const mappedPairs: Pair[] = (pairs || []).map(p => ({
                id: p.id,
                tournament_id: p.league_id, 
                league_id: p.league_id,
                category_id: p.category_id,
                groupId: p.group_id,
                player1Id: p.player1_id,
                player2Id: p.player2_id,
                name: p.name || 'Pareja',
                stats: p.stats || { played: 0, won: 0, gameDiff: 0 },
                paidP1: false, paidP2: false, waterReceived: false
            }));

            const mappedMatches: LeagueMatch[] = (matches || []).map(m => ({
                id: m.id,
                league_id: m.league_id,
                category_id: m.category_id,
                group_id: m.group_id,
                phase: m.phase as any,
                round: m.round, 
                pairAId: m.pair_a_id,
                pairBId: m.pair_b_id,
                setsA: m.sets_a,
                setsB: m.sets_b,
                score_text: m.score_text,
                isFinished: m.is_finished,
                winnerId: m.winner_id
            }));

            const loadedCats = (categories || []).map(c => ({...c, pairs_count: 0}));
            const mainCatId = loadedCats.length > 0 ? loadedCats[0].id : undefined;

            setLeague({
                id: leagueData.id,
                title: leagueData.title,
                status: leagueData.status as LeaguePhase,
                startDate: leagueData.start_date,
                endDate: leagueData.end_date,
                playoffDate: leagueData.playoff_date,
                categories: loadedCats,
                mainCategoryId: mainCatId,
                groups: mappedGroups,
                matches: mappedMatches,
                pairs: mappedPairs,
                loading: false
            });

        } catch (e) {
            setLeague(prev => ({ ...prev, loading: false }));
        }
    };

    const updateLeague = async (id: string, data: Partial<LeagueState>) => {
        if (isOfflineMode) {
            // Local update logic would go here
            return;
        }
        try {
            await supabase.from('leagues').update({
                title: data.title,
                start_date: data.startDate,
                end_date: data.endDate,
                playoff_date: data.playoffDate
            }).eq('id', id);
            
            setLeague(prev => prev.id === id ? { ...prev, ...data } : prev);
            fetchLeagues();
        } catch (e) {
        }
    };

    const addLeagueCategory = async (name: string) => {
        if (!league.id) return;

        if (isOfflineMode) {
            const newCat: LeagueCategory = {
                id: `cat-${Date.now()}`,
                name,
                prize_winner: '',
                prize_runnerup: '',
                pairs_count: 0
            };
            const updatedLeague = { ...league, categories: [...league.categories, newCat] };
            setLeague(updatedLeague);
            localStorage.setItem(`league_data_${league.id}`, JSON.stringify(updatedLeague));
            return;
        }

        try {
            await supabase.from('league_categories').insert([{
                league_id: league.id,
                name: name,
                prize_winner: '',
                prize_runnerup: ''
            }]);
            await selectLeague(league.id);
        } catch (e) {
        }
    };

    const updateLeagueCategory = async (id: string, name: string) => {
        if (isOfflineMode) {
            const updatedCategories = league.categories.map(c => c.id === id ? { ...c, name } : c);
            const updatedLeague = { ...league, categories: updatedCategories };
            setLeague(updatedLeague);
            localStorage.setItem(`league_data_${league.id}`, JSON.stringify(updatedLeague));
            return;
        }

        try {
            await supabase.from('league_categories').update({ name }).eq('id', id);
            // Optimistic update
            setLeague(prev => ({
                ...prev,
                categories: prev.categories.map(c => c.id === id ? { ...c, name } : c)
            }));
        } catch (e) {
        }
    };

    const createLeague = async (data: Partial<LeagueState> & { prizeWinner?: string, prizeRunnerUp?: string }) => {
        const newId = isOfflineMode ? `league-${Date.now()}` : undefined;
        
        if (isOfflineMode) {
            const implicitCatId = `cat-local-${Date.now()}`;
            const newCategory: LeagueCategory = {
                id: implicitCatId,
                name: data.title || 'General',
                prize_winner: data.prizeWinner || '',
                prize_runnerup: data.prizeRunnerUp || '',
                pairs_count: 0
            };

            const newLeague = { 
                ...initialLeagueState, 
                ...data, 
                id: newId, 
                status: 'registration' as LeaguePhase,
                categories: [newCategory],
                mainCategoryId: implicitCatId 
            };
            
            setLeague(newLeague);
            setLeaguesList(prev => [newLeague, ...prev]);
            localStorage.setItem(`league_data_${newId}`, JSON.stringify(newLeague));
            return newId!;
        }

        try {
            const { data: lData, error } = await supabase.from('leagues').insert([{
                club_id: user?.id,
                title: data.title,
                start_date: data.startDate,
                end_date: data.endDate,
                playoff_date: data.playoffDate,
                status: 'registration'
            }]).select().single();

            if (error) throw error;

            const { data: catData } = await supabase.from('league_categories').insert([{
                league_id: lData.id,
                name: data.title,
                prize_winner: data.prizeWinner,
                prize_runnerup: data.prizeRunnerUp
            }]).select().single();

            await fetchLeagues(); 
            await selectLeague(lData.id);
            return lData.id;
        } catch (e) {
            return null;
        }
    };

    const addPairToLeague = async (pairData: Partial<Pair>) => {
        if (isOfflineMode) {
            const newPair: Pair = {
                id: `lp-${Date.now()}`, ...pairData, stats: { played: 0, won: 0, gameDiff: 0 },
                paidP1: false, paidP2: false, waterReceived: false
            } as Pair;
            const updatedLeague = { ...league, pairs: [...league.pairs, newPair] };
            setLeague(updatedLeague);
            localStorage.setItem(`league_data_${league.id}`, JSON.stringify(updatedLeague));
            return;
        }

        await supabase.from('league_pairs').insert([{
            league_id: league.id,
            category_id: pairData.category_id,
            player1_id: pairData.player1Id,
            player2_id: pairData.player2Id,
            name: pairData.name
        }]);
        
        if (league.id) selectLeague(league.id);
    };

    const updateLeaguePair = async (pairId: string, p1: string, p2: string) => {
        if (isOfflineMode) {
            const updatedPairs = league.pairs.map(p => p.id === pairId ? { ...p, player1Id: p1, player2Id: p2 } : p);
            const updatedLeague = { ...league, pairs: updatedPairs };
            setLeague(updatedLeague);
            localStorage.setItem(`league_data_${league.id}`, JSON.stringify(updatedLeague));
            return;
        }

        try {
            await supabase.from('league_pairs').update({ player1_id: p1, player2_id: p2 }).eq('id', pairId);
            if (league.id) selectLeague(league.id);
        } catch (e) {
        }
    };

    const deletePairFromLeague = async (pairId: string) => {
        if (isOfflineMode) {
            const updatedPairs = league.pairs.filter(p => p.id !== pairId);
            const updatedLeague = { ...league, pairs: updatedPairs };
            setLeague(updatedLeague);
            localStorage.setItem(`league_data_${league.id}`, JSON.stringify(updatedLeague));
            return;
        }

        try {
            await supabase.from('league_pairs').delete().eq('id', pairId);
            if (league.id) selectLeague(league.id);
        } catch (e) {
        }
    };

    const generateRoundRobinMatches = (pairs: Pair[], doubleRound: boolean) => {
        const matches = [];
        const n = pairs.length;
        const ghost = n % 2 !== 0;
        const players = ghost ? [...pairs, { id: 'BYE' }] : [...pairs];
        const numTeams = players.length;
        const numRounds = numTeams - 1;
        const half = numTeams / 2;

        const teamIds = players.map(p => (p as any).id);

        for (let round = 0; round < numRounds; round++) {
            for (let i = 0; i < half; i++) {
                const p1 = teamIds[i];
                const p2 = teamIds[numTeams - 1 - i];
                
                if (p1 !== 'BYE' && p2 !== 'BYE') {
                    matches.push({ round: round + 1, pairAId: p1, pairBId: p2 });
                    if (doubleRound) {
                        matches.push({ round: round + 1 + numRounds, pairAId: p2, pairBId: p1 });
                    }
                }
            }
            teamIds.splice(1, 0, teamIds.pop()!);
        }
        return matches;
    };

    const generateLeagueGroups = async (categoryId: string, groupsCount: number, method: 'elo-balanced' | 'elo-mixed', doubleRound: boolean) => {
        const categoryPairs = league.pairs.filter(p => p.category_id === categoryId);
        if (categoryPairs.length < 4) throw new Error("Mínimo 4 parejas por categoría");

        const sortedPairs = [...categoryPairs].sort(() => Math.random() - 0.5);
        
        if (isOfflineMode) {
            const newGroups: LeagueGroup[] = [];
            const newMatches: LeagueMatch[] = [];
            for (let i = 0; i < groupsCount; i++) {
                const gId = `group-${categoryId}-${i}`;
                const groupPairs = sortedPairs.filter((_, idx) => idx % groupsCount === i);
                newGroups.push({ id: gId, category_id: categoryId, name: `Grupo ${String.fromCharCode(65 + i)}`, pairIds: groupPairs.map(p => p.id) });
                const rounds = generateRoundRobinMatches(groupPairs, doubleRound);
                rounds.forEach(r => {
                    newMatches.push({
                        id: `lm-${Date.now()}-${Math.random()}`,
                        league_id: league.id!,
                        category_id: categoryId,
                        group_id: gId,
                        phase: 'group',
                        round: r.round,
                        pairAId: r.pairAId,
                        pairBId: r.pairBId,
                        setsA: null, setsB: null, isFinished: false
                    });
                });
            }
            const updatedLeague = { ...league, status: 'groups' as LeaguePhase, groups: [...league.groups, ...newGroups], matches: [...league.matches, ...newMatches] };
            setLeague(updatedLeague);
            localStorage.setItem(`league_data_${league.id}`, JSON.stringify(updatedLeague));
            return;
        }

        try {
            for (let i = 0; i < groupsCount; i++) {
                const { data: groupData } = await supabase.from('league_groups').insert([{
                    league_id: league.id,
                    category_id: categoryId,
                    name: `Grupo ${String.fromCharCode(65 + i)}`
                }]).select().single();

                if (groupData) {
                    const groupPairs = sortedPairs.filter((_, idx) => idx % groupsCount === i);
                    for (const p of groupPairs) {
                        await supabase.from('league_pairs').update({ group_id: groupData.id }).eq('id', p.id);
                    }
                    const rounds = generateRoundRobinMatches(groupPairs, doubleRound);
                    const matchesBatch = rounds.map(r => ({
                        league_id: league.id,
                        category_id: categoryId,
                        group_id: groupData.id,
                        phase: 'group',
                        round: r.round,
                        pair_a_id: r.pairAId,
                        pair_b_id: r.pairBId,
                        is_finished: false
                    }));
                    if (matchesBatch.length > 0) {
                        await supabase.from('league_matches').insert(matchesBatch);
                    }
                }
            }
            await supabase.from('leagues').update({ status: 'groups' }).eq('id', league.id);
            if (league.id) selectLeague(league.id);
        } catch (e) {
        }
    };

    const updateLeagueScore = async (matchId: string, setsA: number, setsB: number, scoreText: string) => {
        let winnerId = '';
        const match = league.matches.find(m => m.id === matchId);
        if (match) {
            winnerId = setsA > setsB ? match.pairAId : match.pairBId;
        }

        if (isOfflineMode) {
            const updatedMatches = league.matches.map(m => {
                if (m.id === matchId) {
                    return { ...m, setsA, setsB, score_text: scoreText, isFinished: true, winnerId };
                }
                return m;
            });
            const updatedLeague = { ...league, matches: updatedMatches };
            setLeague(updatedLeague);
            localStorage.setItem(`league_data_${league.id}`, JSON.stringify(updatedLeague));
            return;
        }

        await supabase.from('league_matches').update({
            sets_a: setsA,
            sets_b: setsB,
            score_text: scoreText,
            is_finished: true,
            winner_id: winnerId
        }).eq('id', matchId);

        if (league.id) selectLeague(league.id);
    };

    const calculateStandings = (catId: string, groupId: string) => {
        const group = league.groups.find(g => g.id === groupId);
        if (!group) return [];
        const standings = group.pairIds.map(pId => {
            const pairMatches = league.matches.filter(m => m.category_id === catId && m.group_id === groupId && m.isFinished && (m.pairAId === pId || m.pairBId === pId));
            let pts = 0;
            pairMatches.forEach(m => {
                const isA = m.pairAId === pId;
                const won = isA ? (m.setsA! > m.setsB!) : (m.setsB! > m.setsA!);
                pts += won ? 3 : 1; 
            });
            return { id: pId, pts };
        });
        return standings.sort((a, b) => b.pts - a.pts);
    };

    const advanceToPlayoffs = async (categoryId: string, config: PlayoffConfig) => {
        const catGroups = league.groups.filter(g => g.category_id === categoryId);
        const newPlayoffMatches: any[] = [];
        const { qualifiersPerGroup, crossType, mode } = config;
        
        const queueMatch = (idStub: string, pairA: string, pairB: string) => {
            if (!pairA || !pairB) return;
            newPlayoffMatches.push({ 
                id_stub: `${idStub}-L1`, league_id: league.id, category_id: categoryId, phase: 'playoff', 
                pair_a_id: pairA, pair_b_id: pairB, round_label: mode === 'double' ? 'Ida' : 'Eliminatoria'
            });
            if (mode === 'double') {
                newPlayoffMatches.push({ 
                    id_stub: `${idStub}-L2`, league_id: league.id, category_id: categoryId, phase: 'playoff', 
                    pair_a_id: pairB, pair_b_id: pairA, round_label: 'Vuelta'
                });
            }
        };

        if (catGroups.length === 1) {
            const standings = calculateStandings(categoryId, catGroups[0].id);
            const qualified = standings.slice(0, qualifiersPerGroup);
            for (let i = 0; i < qualifiersPerGroup / 2; i++) {
                const p1 = qualified[i];
                const p2 = qualified[qualified.length - 1 - i];
                if (p1 && p2) queueMatch(`qf-${i+1}`, p1.id, p2.id);
            }
        } else if (catGroups.length === 2) {
            const stA = calculateStandings(categoryId, catGroups[0].id);
            const stB = calculateStandings(categoryId, catGroups[1].id);
            const qA = stA.slice(0, qualifiersPerGroup);
            const qB = stB.slice(0, qualifiersPerGroup);

            if (crossType === 'crossed') {
                for (let i = 0; i < qualifiersPerGroup; i++) {
                    const pA = qA[i];
                    const pB = qB[qualifiersPerGroup - 1 - i];
                    if (pA && pB) queueMatch(`cross-${i+1}`, pA.id, pB.id);
                }
            } else {
                for (let i = 0; i < qualifiersPerGroup / 2; i++) {
                    const topA = qA[i]; const botA = qA[qualifiersPerGroup - 1 - i];
                    if (topA && botA) queueMatch(`internal-A-${i+1}`, topA.id, botA.id);
                    const topB = qB[i]; const botB = qB[qualifiersPerGroup - 1 - i];
                    if (topB && botB) queueMatch(`internal-B-${i+1}`, topB.id, botB.id);
                }
            }
        }

        if (isOfflineMode) {
            const offlineMatches = newPlayoffMatches.map(m => ({
                id: `local-${m.id_stub}-${Date.now()}`, ...m, setsA: null, setsB: null, isFinished: false, pairAId: m.pair_a_id, pairBId: m.pair_b_id
            }));
            const updatedLeague = { ...league, status: 'playoffs' as LeaguePhase, matches: [...league.matches, ...offlineMatches] };
            setLeague(updatedLeague);
            localStorage.setItem(`league_data_${league.id}`, JSON.stringify(updatedLeague));
            return;
        }

        const dbMatches = newPlayoffMatches.map(m => ({
            league_id: m.league_id,
            category_id: m.category_id,
            phase: 'playoff',
            pair_a_id: m.pair_a_id,
            pair_b_id: m.pair_b_id,
            is_finished: false,
            round_label: m.round_label
        }));

        if (dbMatches.length > 0) {
            await supabase.from('league_matches').insert(dbMatches);
            await supabase.from('leagues').update({ status: 'playoffs' }).eq('id', league.id);
            if (league.id) selectLeague(league.id);
        }
    };

    return (
        <LeagueContext.Provider value={{
            league, leaguesList, fetchLeagues, selectLeague, updateLeagueScore, createLeague, updateLeague,
            addLeagueCategory, updateLeagueCategory, generateLeagueGroups, advanceToPlayoffs, addPairToLeague, deletePairFromLeague, updateLeaguePair,
            isLeagueModuleEnabled
        }}>
            {children}
        </LeagueContext.Provider>
    );
};

export const useLeague = () => {
    const context = useContext(LeagueContext);
    if (!context) throw new Error('useLeague must be used within a LeagueProvider');
    return context;
};
