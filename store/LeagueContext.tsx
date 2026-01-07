
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
    createLeague: (data: Partial<LeagueState>) => Promise<string | null>;
    generateLeagueGroups: (categoryId: string, groupsCount: number, method: 'elo-balanced' | 'elo-mixed') => Promise<void>;
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
    categories: [
        { id: 'cat-1', name: '2ª Categoría', prize_winner: 'Pala Gama Alta', prize_runnerup: 'Paletero Pro', pairs_count: 0 },
        { id: 'cat-2', name: '3ª Categoría', prize_winner: 'Pala Gama Media', prize_runnerup: 'Mochila Técnica', pairs_count: 0 }
    ],
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
            // Mock local data for offline testing
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
            if (saved) setLeague(JSON.parse(saved));
            else setLeague(prev => ({ ...prev, id, loading: false }));
            return;
        }

        try {
            // Parallel Fetching for performance
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

            // Map DB structure to App State
            // IMPORTANT: 'groups' in state needs 'pairIds' array which isn't in DB table directly (it's in pairs table)
            const mappedGroups: LeagueGroup[] = (groups || []).map(g => ({
                id: g.id,
                category_id: g.category_id,
                name: g.name,
                pairIds: (pairs || []).filter(p => p.group_id === g.id).map(p => p.id)
            }));

            const mappedPairs: Pair[] = (pairs || []).map(p => ({
                id: p.id,
                tournament_id: p.league_id, // Reuse field
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
                pairAId: m.pair_a_id,
                pairBId: m.pair_b_id,
                setsA: m.sets_a,
                setsB: m.sets_b,
                score_text: m.score_text,
                isFinished: m.is_finished,
                winnerId: m.winner_id
            }));

            setLeague({
                id: leagueData.id,
                title: leagueData.title,
                status: leagueData.status as LeaguePhase,
                startDate: leagueData.start_date,
                endDate: leagueData.end_date,
                playoffDate: leagueData.playoff_date,
                categories: (categories || []).map(c => ({...c, pairs_count: 0})), // Count is derived
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

    // 3. CREATE LEAGUE
    const createLeague = async (data: Partial<LeagueState>) => {
        const newId = isOfflineMode ? `league-${Date.now()}` : undefined;
        
        if (isOfflineMode) {
            const newLeague = { ...initialLeagueState, ...data, id: newId, status: 'registration' as LeaguePhase };
            setLeague(newLeague);
            setLeaguesList(prev => [newLeague, ...prev]);
            localStorage.setItem(`league_data_${newId}`, JSON.stringify(newLeague));
            return newId!;
        }

        try {
            // Insert Header
            const { data: lData, error } = await supabase.from('leagues').insert([{
                club_id: user?.id,
                title: data.title,
                start_date: data.startDate,
                end_date: data.endDate,
                playoff_date: data.playoffDate,
                status: 'registration'
            }]).select().single();

            if (error) throw error;

            // Insert Categories
            if (data.categories && data.categories.length > 0) {
                const catsToInsert = data.categories.map(c => ({
                    league_id: lData.id,
                    name: c.name,
                    prize_winner: c.prize_winner,
                    prize_runnerup: c.prize_runnerup
                }));
                await supabase.from('league_categories').insert(catsToInsert);
            }

            await fetchLeagues(); // Refresh list
            return lData.id;
        } catch (e) {
            console.error(e);
            return null;
        }
    };

    // 4. ADD PAIR
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

        // Online Insert
        await supabase.from('league_pairs').insert([{
            league_id: league.id,
            category_id: pairData.category_id,
            player1_id: pairData.player1Id,
            player2_id: pairData.player2Id,
            name: pairData.name
        }]);
        
        if (league.id) selectLeague(league.id); // Refresh
    };

    // 5. GENERATE GROUPS (LOGIC + DB)
    const generateLeagueGroups = async (categoryId: string, groupsCount: number, method: 'elo-balanced' | 'elo-mixed') => {
        const categoryPairs = league.pairs.filter(p => p.category_id === categoryId);
        if (categoryPairs.length < 4) throw new Error("Mínimo 4 parejas por categoría");

        const sortedPairs = [...categoryPairs].sort(() => Math.random() - 0.5); // Random for now, implement ELO logic if needed
        
        // Prepare Batch Inserts
        const groupsToInsert: any[] = [];
        const matchesToInsert: any[] = [];
        const pairUpdates: any[] = []; // To update group_id on pairs

        // Helper to generate UUIDs locally would be better, but we rely on sequential DB calls or simple logic
        // For simplicity in this demo, we'll iterate. In production, use RPC or bulk insert carefully.
        
        if (isOfflineMode) {
            // ... (keep existing offline logic) ...
            const newGroups: LeagueGroup[] = [];
            const newMatches: LeagueMatch[] = [];
            for (let i = 0; i < groupsCount; i++) {
                const gId = `group-${categoryId}-${i}`;
                const groupPairs = sortedPairs.filter((_, idx) => idx % groupsCount === i);
                newGroups.push({ id: gId, category_id: categoryId, name: `Grupo ${String.fromCharCode(65 + i)}`, pairIds: groupPairs.map(p => p.id) });
                for (let j = 0; j < groupPairs.length; j++) {
                    for (let k = j + 1; k < groupPairs.length; k++) {
                        newMatches.push({ id: `lm-${Date.now()}-${Math.random()}`, league_id: league.id!, category_id: categoryId, group_id: gId, phase: 'group', pairAId: groupPairs[j].id, pairBId: groupPairs[k].id, setsA: null, setsB: null, isFinished: false });
                    }
                }
            }
            const updatedLeague = { ...league, status: 'groups' as LeaguePhase, groups: [...league.groups, ...newGroups], matches: [...league.matches, ...newMatches] };
            setLeague(updatedLeague);
            localStorage.setItem(`league_data_${league.id}`, JSON.stringify(updatedLeague));
            return;
        }

        // ONLINE GENERATION
        try {
            // 1. Create Groups
            for (let i = 0; i < groupsCount; i++) {
                const { data: groupData } = await supabase.from('league_groups').insert([{
                    league_id: league.id,
                    category_id: categoryId,
                    name: `Grupo ${String.fromCharCode(65 + i)}`
                }]).select().single();

                if (groupData) {
                    const groupPairs = sortedPairs.filter((_, idx) => idx % groupsCount === i);
                    
                    // 2. Update Pairs with Group ID
                    for (const p of groupPairs) {
                        await supabase.from('league_pairs').update({ group_id: groupData.id }).eq('id', p.id);
                    }

                    // 3. Generate Matches (Round Robin)
                    const matchesBatch = [];
                    for (let j = 0; j < groupPairs.length; j++) {
                        for (let k = j + 1; k < groupPairs.length; k++) {
                            matchesBatch.push({
                                league_id: league.id,
                                category_id: categoryId,
                                group_id: groupData.id,
                                phase: 'group',
                                pair_a_id: groupPairs[j].id,
                                pair_b_id: groupPairs[k].id,
                                is_finished: false
                            });
                        }
                    }
                    if (matchesBatch.length > 0) {
                        await supabase.from('league_matches').insert(matchesBatch);
                    }
                }
            }

            // Update League Status
            await supabase.from('leagues').update({ status: 'groups' }).eq('id', league.id);
            if (league.id) selectLeague(league.id);

        } catch (e) {
            console.error("Error generating groups:", e);
        }
    };

    // 6. UPDATE SCORE
    const updateLeagueScore = async (matchId: string, setsA: number, setsB: number, scoreText: string) => {
        let winnerId = '';
        
        // Find match locally to determine winner ID logic
        const match = league.matches.find(m => m.id === matchId);
        if (match) {
            winnerId = setsA > setsB ? match.pairAId : match.pairBId;
        }

        if (isOfflineMode) {
            // ... (keep existing offline logic) ...
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

        // Online Update
        await supabase.from('league_matches').update({
            sets_a: setsA,
            sets_b: setsB,
            score_text: scoreText,
            is_finished: true,
            winner_id: winnerId
        }).eq('id', matchId);

        // Propagate to Playoffs (If needed)
        // Note: The original logic had local propagation. 
        // For online, we should ideally have triggers or re-fetch logic.
        // For now, we rely on `selectLeague` refreshing the state, but we need to implement the playoff logic in DB or JS.
        // Re-implementing JS logic for next match update:
        
        if (matchId.startsWith('qf-') || matchId.startsWith('sf-')) {
             // Handle DB updates for next rounds if they exist
             // This part is complex to do fully robustly without backend logic, 
             // but we can fetch the state, calc next match, and update it.
             // For simplicity in this step, we just save the result. 
             // The User might need to manually trigger next round generation or we handle it in `selectLeague`.
        }

        if (league.id) selectLeague(league.id);
    };

    // 7. ADVANCE TO PLAYOFFS
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

    const advanceToPlayoffs = async (categoryId: string) => {
        const catGroups = league.groups.filter(g => g.category_id === categoryId);
        const newPlayoffMatches: any[] = []; // Partial match objects for DB
        
        // Logic for generating matchups (Same as offline, but targeting DB insert)
        if (catGroups.length === 2) {
            const stA = calculateStandings(categoryId, catGroups[0].id);
            const stB = calculateStandings(categoryId, catGroups[1].id);

            // QF 1: 1ºA vs 4ºB
            if (stA[0] && stB[3]) newPlayoffMatches.push({ id_stub: `qf-1-${categoryId}`, league_id: league.id, category_id: categoryId, phase: 'playoff', pair_a_id: stA[0].id, pair_b_id: stB[3].id });
            // QF 2: 2ºB vs 3ºA
            if (stB[1] && stA[2]) newPlayoffMatches.push({ id_stub: `qf-2-${categoryId}`, league_id: league.id, category_id: categoryId, phase: 'playoff', pair_a_id: stB[1].id, pair_b_id: stA[2].id });
            // QF 3: 1ºB vs 4ºA
            if (stB[0] && stA[3]) newPlayoffMatches.push({ id_stub: `qf-3-${categoryId}`, league_id: league.id, category_id: categoryId, phase: 'playoff', pair_a_id: stB[0].id, pair_b_id: stA[3].id });
            // QF 4: 2ºA vs 3ºB
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
            // ... (keep existing offline logic) ...
            const offlineMatches = newPlayoffMatches.map(m => ({
                id: m.id_stub, ...m, setsA: null, setsB: null, isFinished: false, pairAId: m.pair_a_id, pairBId: m.pair_b_id
            }));
            const updatedLeague = { ...league, status: 'playoffs' as LeaguePhase, matches: [...league.matches, ...offlineMatches] };
            setLeague(updatedLeague);
            localStorage.setItem(`league_data_${league.id}`, JSON.stringify(updatedLeague));
            return;
        }

        // Online Insert
        // IMPORTANT: We use 'id_stub' as the explicit ID to track playoff progression logic (qf-1, sf-1)
        // If DB doesn't allow custom IDs easily, we might need a meta column. 
        // For now, assuming standard UUIDs, we will insert and let DB generate IDs, 
        // BUT we need to label them to know which is QF1 vs QF2. 
        // We added `round_label` to the SQL schema for this!
        
        const dbMatches = newPlayoffMatches.map(m => ({
            league_id: m.league_id,
            category_id: m.category_id,
            phase: 'playoff',
            pair_a_id: m.pair_a_id,
            pair_b_id: m.pair_b_id,
            is_finished: false,
            // Extract label from stub: qf-1 -> QF1
            round_label: m.id_stub.split('-')[0].toUpperCase() + m.id_stub.split('-')[1] // QF1
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
