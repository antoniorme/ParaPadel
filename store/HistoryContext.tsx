
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ClubData, PastTournament, TournamentState, PublicTournament, Player, Pair, Match, TournamentFormat } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const CLUB_KEY = 'padelpro_club_v1';
const FAVORITES_KEY = 'padelpro_favorites_v1';
const LOCAL_STORAGE_KEY = 'padelpro_local_db_v3';
const LOCAL_HISTORY_KEY = 'padelpro_local_history';

interface HistoryContextType {
    clubData: ClubData;
    loadingClub: boolean; 
    updateClubData: (data: ClubData) => Promise<void>;
    pastTournaments: PastTournament[];
    archiveTournament: (finalState: TournamentState) => void;
    globalTournaments: PublicTournament[];
    favoriteClubIds: string[];
    toggleFavoriteClub: (clubId: string) => void;
}

const defaultClubData: ClubData = {
    name: 'Mi Club de Padel',
    courtCount: 6,
    address: '',
    phone: '',
    league_enabled: false 
};

const HistoryContext = createContext<HistoryContextType>({
    clubData: defaultClubData,
    loadingClub: true,
    updateClubData: async () => {},
    pastTournaments: [],
    archiveTournament: () => {},
    globalTournaments: [],
    favoriteClubIds: [],
    toggleFavoriteClub: () => {}
});

export const HistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [clubData, setClubData] = useState<ClubData>(defaultClubData);
    const [loadingClub, setLoadingClub] = useState(true);
    const [pastTournaments, setPastTournaments] = useState<PastTournament[]>([]);
    const [favoriteClubIds, setFavoriteClubIds] = useState<string[]>([]);
    const [globalTournaments, setGlobalTournaments] = useState<PublicTournament[]>([]);
    const { user, isOfflineMode, loading: authLoading, role } = useAuth();

    const loadHistory = async () => {
        if (isOfflineMode) {
            const rawHistory = localStorage.getItem(LOCAL_HISTORY_KEY);
            if (rawHistory) {
                const parsed: any[] = JSON.parse(rawHistory);
                setPastTournaments(parsed.map(t => ({ id: t.id, date: t.archivedAt || t.startDate || new Date().toISOString(), winnerMain: t.winnerMain || 'Desconocido', winnerConsolation: t.winnerConsolation || 'Desconocido', playerCount: (t.pairs || []).length * 2, format: t.format, data: t })));
            }
            return;
        }
        if (user) {
            // Admin: fetch own finished tournaments (basic info, no full data needed for admin History page)
            const { data: tournaments } = await supabase.from('tournaments').select('*').eq('user_id', user.id).eq('status', 'finished').order('created_at', { ascending: false });
            if (tournaments) setPastTournaments(tournaments.map(t => ({ id: t.id, date: t.created_at, winnerMain: t.winner_main || 'No registrado', winnerConsolation: t.winner_consolation || 'No registrado', playerCount: 0, format: t.format || '16_mini' })));
        }
    };

    // ── PLAYER HISTORY (with full match data) ─────────────────────────────────
    const loadPlayerHistory = useCallback(async () => {
        if (!user || isOfflineMode) return;
        try {
            // 1. Find player record linked to this auth user
            const { data: playerData } = await supabase.from('players').select('id').eq('profile_user_id', user.id).maybeSingle();
            if (!playerData) return;
            const playerId = playerData.id;

            // 2. Find all tournament_pairs this player is in
            const { data: myPairs } = await supabase.from('tournament_pairs').select('tournament_id').or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);
            if (!myPairs || myPairs.length === 0) return;
            const tournamentIds = [...new Set(myPairs.map((p: any) => p.tournament_id))];

            // 3. Fetch those finished tournaments
            const { data: tournaments } = await supabase.from('tournaments').select('*').in('id', tournamentIds).eq('status', 'finished').order('created_at', { ascending: false }).limit(20);
            if (!tournaments || tournaments.length === 0) return;
            const finishedIds = tournaments.map((t: any) => t.id);

            // 4. Fetch pairs and matches in parallel
            const [pairsRes, matchesRes] = await Promise.all([
                supabase.from('tournament_pairs').select('*').in('tournament_id', finishedIds),
                supabase.from('matches').select('*').in('tournament_id', finishedIds)
            ]);
            const allPairs = pairsRes.data || [];
            const allMatches = matchesRes.data || [];

            // 5. Collect all player IDs and fetch player details
            const playerIds = [...new Set(allPairs.flatMap((p: any) => [p.player1_id, p.player2_id].filter(Boolean)))];
            const { data: allPlayers } = await supabase.from('players').select('*').in('id', playerIds);

            // 6. Build PastTournament[] with full TournamentState data for each
            const pastData: PastTournament[] = tournaments.map((t: any) => {
                const tPairs = allPairs.filter((p: any) => p.tournament_id === t.id);
                const tMatches = allMatches.filter((m: any) => m.tournament_id === t.id);

                const mappedPairs: Pair[] = tPairs.map((p: any) => ({
                    id: p.id, tournament_id: p.tournament_id, player1Id: p.player1_id, player2Id: p.player2_id,
                    name: p.name || 'Pareja', waterReceived: p.water_received || false,
                    paidP1: p.paid_p1 || false, paidP2: p.paid_p2 || false,
                    stats: { played: 0, won: 0, gameDiff: 0 }, isReserve: false, status: p.status || 'confirmed'
                }));

                const mappedMatches: Match[] = tMatches.map((m: any) => ({
                    id: m.id, round: m.round, phase: m.phase || 'group', bracket: m.bracket,
                    courtId: m.court_id, pairAId: m.pair_a_id, pairBId: m.pair_b_id,
                    scoreA: m.score_a, scoreB: m.score_b, isFinished: m.is_finished
                }));

                const data: TournamentState = {
                    id: t.id, status: 'finished', currentRound: t.current_round || 0,
                    format: (t.format || '16_mini') as TournamentFormat,
                    title: t.title, price: t.price, prizes: t.prizes || [],
                    players: (allPlayers || []) as Player[],
                    pairs: mappedPairs, matches: mappedMatches,
                    groups: [], courts: [], loading: false, tournamentList: [],
                    levelRange: t.level_range, includedItems: t.included_items || [],
                    description: t.description
                };

                return {
                    id: t.id, date: t.created_at,
                    winnerMain: t.winner_main || 'No registrado',
                    winnerConsolation: t.winner_consolation || 'No registrado',
                    playerCount: tPairs.length, format: t.format || '16_mini', data
                };
            });

            setPastTournaments(pastData);
        } catch {
            // silent fail — history won't show but app continues
        }
    }, [user, isOfflineMode]);

    // ── GLOBAL TOURNAMENTS (for player TournamentBrowser) ────────────────────
    const fetchGlobalTournaments = useCallback(async () => {
        if (isOfflineMode || !user) return;
        try {
            const [clubsRes, tournamentsRes] = await Promise.all([
                supabase.from('clubs').select('id, name, owner_id, logo_url, address, maps_url'),
                supabase.from('tournaments').select('*').in('status', ['setup', 'active']).order('date', { ascending: true })
            ]);
            const clubs = clubsRes.data || [];
            const tournaments = tournamentsRes.data || [];
            if (tournaments.length === 0) return;

            const tIds = tournaments.map((t: any) => t.id);
            const { data: allPairs } = await supabase.from('tournament_pairs').select('tournament_id, status').in('tournament_id', tIds).neq('status', 'rejected');

            const result: PublicTournament[] = tournaments.map((t: any) => {
                const club = clubs.find((c: any) => c.owner_id === t.user_id);
                const spotsTaken = (allPairs || []).filter((p: any) => p.tournament_id === t.id).length;
                const spotsTotal = t.format === '8_mini' ? 8 : t.format === '10_mini' ? 10 : t.format === '12_mini' ? 12 : 16;
                const status: PublicTournament['status'] = t.status === 'active' ? 'active' : spotsTaken >= spotsTotal ? 'full' : 'open';
                return {
                    id: t.id,
                    clubId: club?.id || t.user_id,
                    clubName: club?.name || 'Club de Pádel',
                    clubLogo: club?.logo_url,
                    address: club?.address,
                    mapsUrl: club?.maps_url,
                    name: t.title || 'Mini Torneo',
                    description: t.description,
                    date: t.date || t.created_at,
                    format: t.format || '16_mini',
                    status,
                    spotsTaken,
                    spotsTotal,
                    level: t.level_range || 'Abierto',
                    price: t.price || 15,
                    prizes: t.prizes || []
                };
            });
            setGlobalTournaments(result);
        } catch {
            // silent fail
        }
    }, [user, isOfflineMode]);

    const fetchClubData = useCallback(async () => {
        if (!isOfflineMode && authLoading) return;

        setLoadingClub(true);
        
        // Safety timeout for Club Data
        const timeoutId = setTimeout(() => {
            setLoadingClub(() => false);
        }, 4000);

        try {
            if (isOfflineMode) {
                const saved = localStorage.getItem(CLUB_KEY);
                if (saved) setClubData(JSON.parse(saved));
            } else if (user) {
                // Fetch latest data from DB
                const { data, error } = await supabase.from('clubs').select('*').eq('owner_id', user.id).maybeSingle();
                
                if (data) {
                    const mapped: ClubData = { 
                        id: data.id, 
                        name: data.name, 
                        courtCount: data.court_count || 6, 
                        address: data.address, 
                        phone: data.phone, 
                        logoUrl: data.logo_url, 
                        league_enabled: data.league_enabled || false,
                        minis_lite_enabled: data.minis_lite_enabled, // NEW
                        minis_full_enabled: data.minis_full_enabled, // NEW
                        show_players: data.show_players !== false, // Default true
                        show_history: data.show_history !== false, // Default true
                        mapsUrl: data.maps_url
                    };
                    setClubData(mapped);
                    localStorage.setItem(CLUB_KEY, JSON.stringify(mapped));
                }
            }
        } catch (e) {
            // club data fetch failed silently
        } finally {
            clearTimeout(timeoutId);
            setLoadingClub(false);
        }
    }, [user, isOfflineMode, authLoading]);

    useEffect(() => {
        fetchClubData();
        fetchGlobalTournaments();
        if (role === 'player') {
            loadPlayerHistory();
        } else {
            loadHistory();
        }
    }, [fetchClubData, fetchGlobalTournaments, loadPlayerHistory, role]);

    const updateClubData = async (data: ClubData) => {
        if (isOfflineMode) {
            const offlineData = { ...data, id: data.id || 'local-club' };
            setClubData(offlineData);
            localStorage.setItem(CLUB_KEY, JSON.stringify(offlineData));
            return;
        }
        setClubData(data);
        localStorage.setItem(CLUB_KEY, JSON.stringify(data));

        if (!isOfflineMode && user) {
            try {
                const payload = {
                    owner_id: user.id,
                    name: data.name,
                    court_count: data.courtCount,
                    address: data.address,
                    phone: data.phone,
                    logo_url: data.logoUrl,
                    maps_url: data.mapsUrl
                };

                let query = supabase.from('clubs');
                if (clubData.id) {
                    await query.update(payload).eq('id', clubData.id);
                } else {
                    const { data: existing } = await supabase.from('clubs').select('id').eq('owner_id', user.id).maybeSingle();
                    if (existing) {
                        await query.update(payload).eq('id', existing.id);
                        setClubData({ ...data, id: existing.id });
                    } else {
                        const { data: newClub } = await query.insert([payload]).select().single();
                        if (newClub) setClubData({ ...data, id: newClub.id });
                    }
                }
            } catch (e) {
                // club data sync failed silently
            }
        }
    };

    const toggleFavoriteClub = (clubId: string) => {
        setFavoriteClubIds(prev => {
            const newFavs = prev.includes(clubId) ? prev.filter(id => id !== clubId) : [...prev, clubId];
            localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavs));
            return newFavs;
        });
    };

    return (
        <HistoryContext.Provider value={{ clubData, loadingClub, updateClubData, pastTournaments, archiveTournament: () => {}, globalTournaments, favoriteClubIds, toggleFavoriteClub }}>
            {children}
        </HistoryContext.Provider>
    );
};

export const useHistory = () => useContext(HistoryContext);
