
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LeagueState, LeagueCategory, LeagueGroup, LeagueMatch, Pair, LeaguePhase } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useHistory } from './HistoryContext';

interface LeagueContextType {
    league: LeagueState;
    leaguesList: any[];
    fetchLeagues: () => Promise<void>;
    selectLeague: (id: string) => Promise<void>;
    updateLeagueScore: (matchId: string, setsA: number, setsB: number, scoreText: string) => Promise<void>;
    // Updated signature: createLeague now receives prizes directly, simplified
    createLeague: (data: Partial<LeagueState> & { prizeWinner?: string, prizeRunnerUp?: string }) => Promise<string | null>;
    generateLeagueGroups: (categoryId: string, groupsCount: number, method: 'elo-balanced' | 'elo-mixed', doubleRound: boolean) => Promise<void>;
    advanceToPlayoffs: (categoryId: string) => Promise<void>;
    addPairToLeague: (pair: Partial<Pair>) => Promise<void>;
    isLeagueModuleEnabled: boolean;
}

const initialLeagueState: LeagueState = {
    title: '',
    status: 'registration',
    startDate: '2024-01-12',
    endDate: '2024-04-15',
    playoffDate: '2024-04-17',
    categories: [], // Will contain exactly 1 category in new logic
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
                // Ensure mainCategoryId is set if missing
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
                supabase.from('league_categories').select('*').eq('league_id', id),
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
                round: m.round, // Now loading round number
                pairAId: m.pair_a_id,
                pairBId: m.pair_b_id,
                setsA: m.sets_a,
                setsB: m.sets_b,
                score_text: m.score_text,
                isFinished: m.is_finished,
                winnerId: m.winner_id
            }));

            // Logic: Pick the first category as the main one (Single Category Mode)
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
            console.error("Error loading league:", e);
            setLeague(prev => ({ ...prev, loading: false }));
        }
    };

    const createLeague = async (data: Partial<LeagueState> & { prizeWinner?: string, prizeRunnerUp?: string }) => {
        const newId = isOfflineMode ? `league-${Date.now()}` : undefined;
        
        if (isOfflineMode) {
            // Local mode: create implicit category
            const implicitCatId = `cat-local-${Date.now()}`;
            const newCategory: LeagueCategory = {
                id: implicitCatId,
                name: data.title || 'General', // Category name mirrors League Title
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

            // Create Single Implicit Category
            const { data: catData } = await supabase.from('league_categories').insert([{
                league_id: lData.id,
                name: data.title, // Name implies the league level
                prize_winner: data.prizeWinner,
                prize_runnerup: data.prizeRunnerUp
            }]).select().single();

            await fetchLeagues(); 
            // Select immediately to populate state with category ID
            await selectLeague(lData.id);
            return lData.id;
        } catch (e) {
            console.error(e);
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

    // --- GENERATION ALGORITHM (BERGER TABLES) ---
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
                    // Round 1..N (Ida)
                    matches.push({
                        round: round + 1,
                        pairAId: p1,
                        pairBId: p2
                    });
                    
                    // (Vuelta)
                    if (doubleRound) {
                        matches.push({
                            round: round + 1 + numRounds,
                            pairAId: p2,
                            pairBId: p1
                        });
                    }
                }
            }
            // Rotate Array for next round (keep first, rotate rest)
            teamIds.splice(1, 0, teamIds.pop()!);
        }
        
        return matches;
    };

    const generateLeagueGroups = async (categoryId: string, groupsCount: number, method: 'elo-balanced' | 'elo-mixed', doubleRound: boolean) => {
        const categoryPairs = league.pairs.filter(p => p.category_id === categoryId);
        if (categoryPairs.length < 4) throw new Error("Mínimo 4 parejas por categoría");

        // Simple Random Sort for now (Improve later with ELO logic)
        const sortedPairs = [...categoryPairs].sort(() => Math.random() - 0.5);
        
        if (isOfflineMode) {
            const newGroups: LeagueGroup[] = [];
            const newMatches: LeagueMatch[] = [];
            
            for (let i = 0; i < groupsCount; i++) {
                const gId = `group-${categoryId}-${i}`;
                const groupPairs = sortedPairs.filter((_, idx) => idx % groupsCount === i);
                newGroups.push({ id: gId, category_id: categoryId, name: `Grupo ${String.fromCharCode(65 + i)}`, pairIds: groupPairs.map(p => p.id) });
                
                // Use Round Robin Generator
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

        // ONLINE GENERATION
        try {
            for (let i = 0; i < groupsCount; i++) {
                const { data: groupData } = await supabase.from('league_groups').insert([{
                    league_id: league.id,
                    category_id: categoryId,
                    name: `Grupo ${String.fromCharCode(65 + i)}`
                }]).select().single();

                if (groupData) {
                    const groupPairs = sortedPairs.filter((_, idx) => idx % groupsCount === i);
                    
                    // Update Pairs Group
                    for (const p of groupPairs) {
                        await supabase.from('league_pairs').update({ group_id: groupData.id }).eq('id', p.id);
                    }

                    // Generate Matches
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
            console.error("Error generating groups:", e);
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
                // 3 Pts Win, 1 Pt Loss (Played), 0 WO (implied if not played but marked?)
                pts += won ? 3 : 1; 
            });
            return { id: pId, pts };
        });

        return standings.sort((a, b) => b.pts - a.pts);
    };

    const advanceToPlayoffs = async (categoryId: string) => {
        const catGroups = league.groups.filter(g => g.category_id === categoryId);
        const newPlayoffMatches: any[] = []; 
        
        if (catGroups.length === 2) {
            const stA = calculateStandings(categoryId, catGroups[0].id);
            const stB = calculateStandings(categoryId, catGroups[1].id);

            if (stA[0] && stB[3]) newPlayoffMatches.push({ id_stub: `qf-1-${categoryId}`, league_id: league.id, category_id: categoryId, phase: 'playoff', pair_a_id: stA[0].id, pair_b_id: stB[3].id });
            if (stB[1] && stA[2]) newPlayoffMatches.push({ id_stub: `qf-2-${categoryId}`, league_id: league.id, category_id: categoryId, phase: 'playoff', pair_a_id: stB[1].id, pair_b_id: stA[2].id });
            if (stB[0] && stA[3]) newPlayoffMatches.push({ id_stub: `qf-3-${categoryId}`, league_id: league.id, category_id: categoryId, phase: 'playoff', pair_a_id: stB[0].id, pair_b_id: stA[3].id });
            if (stA[1] && stB[2]) newPlayoffMatches.push({ id_stub: `qf-4-${categoryId}`, league_id: league.id, category_id: categoryId, phase: 'playoff', pair_a_id: stA[1].id, pair_b_id: stB[2].id });
        } else {
            const st = calculateStandings(categoryId, catGroups[0]?.id);
            const pairings = [[0,7], [3,4], [1,6], [2,5]];
            pairings.forEach((p, idx) => {
                if (st[p[0]] && st[p[1]]) {
                    newPlayoffMatches.push({ id_stub: `qf-${idx+1}-${categoryId}`, league_id: league.id, category_id: categoryId, phase: 'playoff', pair_a_id: st[p[0]].id, pair_b_id: st[p[1]].id });
                }
            });
        }

        if (isOfflineMode) {
            const offlineMatches = newPlayoffMatches.map(m => ({
                id: m.id_stub, ...m, setsA: null, setsB: null, isFinished: false, pairAId: m.pair_a_id, pairBId: m.pair_b_id
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
            round_label: m.id_stub.split('-')[0].toUpperCase() + m.id_stub.split('-')[1] 
        }));

        await supabase.from('league_matches').insert(dbMatches);
        await supabase.from('leagues').update({ status: 'playoffs' }).eq('id', league.id);
        
        if (league.id) selectLeague(league.id);
    };

    return (
        <LeagueContext.Provider value={{
            league, leaguesList, fetchLeagues, selectLeague, updateLeagueScore, createLeague,
            generateLeagueGroups, advanceToPlayoffs, addPairToLeague, isLeagueModuleEnabled
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