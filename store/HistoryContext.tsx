
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ClubData, PastTournament, TournamentState, PublicTournament } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const CLUB_KEY = 'padelpro_club_v1';
const FAVORITES_KEY = 'padelpro_favorites_v1';
const LOCAL_STORAGE_KEY = 'padelpro_local_db_v3';
// NEW: Key to retrieve completed tournaments in offline/local mode
const LOCAL_HISTORY_KEY = 'padelpro_local_history';

interface HistoryContextType {
    clubData: ClubData;
    updateClubData: (data: ClubData) => void;
    pastTournaments: PastTournament[];
    archiveTournament: (finalState: TournamentState) => void;
    
    // NEW: Global Discovery Features
    globalTournaments: PublicTournament[];
    favoriteClubIds: string[];
    toggleFavoriteClub: (clubId: string) => void;
}

const defaultClubData: ClubData = {
    name: 'Mi Club de Padel',
    courtCount: 6,
    address: '',
    phone: ''
};

// MOCK DATA FOR DEMO PURPOSES
const MOCK_GLOBAL_TOURNAMENTS: PublicTournament[] = [
    { 
        id: 'mock-t1', clubId: 'mock-c1', clubName: 'Padel Indoor Norte', clubLogo: '🎾', name: 'Pozo Viernes Noche', 
        date: new Date(Date.now() + 86400000).toISOString(), format: '16_mini', status: 'open', 
        spotsTaken: 12, spotsTotal: 16, level: 'Nivel 4.0 - 5.0', price: 15,
        prizes: ['🥇 Palas Nox AT10', '🥈 Mochilas Siux', '🥉 Calcetines Técnicos'],
        address: 'Calle Falsa 123, Madrid', mapsUrl: 'https://maps.google.com',
        description: 'El mejor torneo de los viernes. Ambiente increíble y música en directo.'
    },
    { 
        id: 'mock-t2', clubId: 'mock-c2', clubName: 'Club de Campo', clubLogo: '🌳', name: 'Americano Mañanero', 
        date: new Date(Date.now() + 172800000).toISOString(), format: '12_mini', status: 'open', 
        spotsTaken: 4, spotsTotal: 12, level: 'Todos los niveles', price: 12,
        prizes: ['🥇 Cena para 2 personas', '🥈 Material Deportivo', '🍺 Caña + Tapa para todos'],
        address: 'Av. de los Deportes 55', mapsUrl: '',
        description: 'Torneo rápido para empezar el día con energía.'
    }
];

const HistoryContext = createContext<HistoryContextType>({
    clubData: defaultClubData,
    updateClubData: () => {},
    pastTournaments: [],
    archiveTournament: () => {},
    globalTournaments: [],
    favoriteClubIds: [],
    toggleFavoriteClub: () => {}
});

export const HistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [clubData, setClubData] = useState<ClubData>(defaultClubData);
    const [pastTournaments, setPastTournaments] = useState<PastTournament[]>([]);
    const [favoriteClubIds, setFavoriteClubIds] = useState<string[]>([]);
    const [globalTournaments, setGlobalTournaments] = useState<PublicTournament[]>(MOCK_GLOBAL_TOURNAMENTS);
    const { user, isOfflineMode } = useAuth();

    // LISTEN FOR LOCAL DB UPDATES TO RELOAD HISTORY
    useEffect(() => {
        const handleLocalUpdate = () => {
            if (isOfflineMode) loadHistory();
        };
        window.addEventListener('local-db-update', handleLocalUpdate);
        return () => window.removeEventListener('local-db-update', handleLocalUpdate);
    }, [isOfflineMode]);

    const loadHistory = async () => {
        // OFFLINE MODE
        if (isOfflineMode) {
            const rawHistory = localStorage.getItem(LOCAL_HISTORY_KEY);
            if (rawHistory) {
                const parsed: any[] = JSON.parse(rawHistory);
                const mappedHistory: PastTournament[] = parsed.map(t => ({
                    id: t.id,
                    date: t.archivedAt || t.startDate || new Date().toISOString(),
                    winnerMain: t.winnerMain || 'Desconocido',
                    winnerConsolation: t.winnerConsolation || 'Desconocido',
                    playerCount: (t.pairs || []).length * 2,
                    format: t.format,
                    data: t // The full state object
                }));
                setPastTournaments(mappedHistory);
            } else {
                setPastTournaments([]);
            }
            return;
        }

        // ONLINE MODE
        if (user) {
            // 1. Fetch finished tournaments
            const { data: tournaments } = await supabase
                .from('tournaments')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'finished')
                .order('created_at', { ascending: false });
            
            if (tournaments && tournaments.length > 0) {
                const tIds = tournaments.map(t => t.id);

                // 2. Fetch Deep Data (Pairs & Matches) for Stats
                const { data: allPairs } = await supabase.from('tournament_pairs').select('*').in('tournament_id', tIds);
                const { data: allMatches } = await supabase.from('matches').select('*').in('tournament_id', tIds);
                const { data: allPlayers } = await supabase.from('players').select('*').eq('user_id', user.id);

                const history: PastTournament[] = tournaments.map(t => {
                    const tPairs = allPairs?.filter(p => p.tournament_id === t.id) || [];
                    const tMatches = allMatches?.filter(m => m.tournament_id === t.id) || [];
                    
                    const historicalState: TournamentState = {
                        id: t.id,
                        status: 'finished',
                        currentRound: t.current_round,
                        format: t.format || '16_mini',
                        players: allPlayers || [],
                        pairs: tPairs.map(p => ({
                            id: p.id, tournament_id: p.tournament_id, player1Id: p.player1_id, player2Id: p.player2_id,
                            name: p.name, waterReceived: p.water_received, paidP1: p.paid_p1, paidP2: p.paid_p2,
                            stats: {played:0, won:0, gameDiff:0}, isReserve: false
                        })),
                        matches: tMatches.map(m => ({
                            id: m.id, round: m.round, 
                            phase: m.phase || (m.round <= 4 ? 'group' : 'playoff'), 
                            bracket: m.bracket as any,
                            courtId: m.court_id, pairAId: m.pair_a_id, pairBId: m.pair_b_id,
                            scoreA: m.score_a, scoreB: m.score_b, isFinished: m.is_finished
                        })),
                        groups: [], courts: [], loading: false
                    };

                    return {
                        id: t.id,
                        date: t.created_at,
                        winnerMain: t.winner_main || 'No registrado',
                        winnerConsolation: t.winner_consolation || 'No registrado',
                        playerCount: tPairs.length * 2,
                        format: t.format || '16_mini',
                        data: historicalState
                    };
                });
                setPastTournaments(history);
            }
        }
    };

    useEffect(() => {
        const savedClub = localStorage.getItem(CLUB_KEY);
        if (savedClub) try { setClubData(JSON.parse(savedClub)); } catch (e) {}

        const savedFavs = localStorage.getItem(FAVORITES_KEY);
        if (savedFavs) try { setFavoriteClubIds(JSON.parse(savedFavs)); } catch (e) {}

        loadHistory();
    }, [user, isOfflineMode]);

    const fetchGlobalTournaments = useCallback(async () => {
        let activeTournaments: any[] = [];
        let activePairs: any[] = [];

        if (isOfflineMode) {
            // Read from LocalStorage if in Dev Mode
            const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (localData) {
                const parsed = JSON.parse(localData);
                if (parsed.status !== 'finished') {
                    activeTournaments = [{
                        id: parsed.id || 'local-active',
                        user_id: 'local-admin',
                        title: parsed.title,
                        status: parsed.status,
                        format: parsed.format,
                        date: parsed.startDate || new Date().toISOString(),
                        level_range: parsed.levelRange,
                        price: parsed.price,
                        prizes: parsed.prizes,
                        description: parsed.description // Ensure description is mapped
                    }];
                    activePairs = parsed.pairs || [];
                }
            }
        } else {
            // Fetch REAL tournaments from Supabase (from ALL users)
            const { data: tData } = await supabase
                .from('tournaments')
                .select('*')
                .neq('status', 'finished');
            
            if (tData) {
                    activeTournaments = tData;
                    const tIds = tData.map(t => t.id);
                    const { data: pData } = await supabase.from('tournament_pairs').select('tournament_id, status').in('tournament_id', tIds);
                    activePairs = pData || [];
            }
        }

        // Map DB/Local data to PublicTournament format
        const realPublicTournaments: PublicTournament[] = activeTournaments.map(t => {
            const taken = activePairs.filter(p => (p.tournament_id === t.id || (isOfflineMode && t.id === 'local-active')) && p.status !== 'rejected').length;
            let total = 16;
            if(t.format === '10_mini') total = 10;
            if(t.format === '12_mini') total = 12;
            if(t.format === '8_mini') total = 8;
            
            const isLocal = t.id === 'local-active' || t.user_id === user?.id;

            return {
                id: t.id,
                clubId: t.user_id, // Owner ID is Club ID
                clubName: isLocal ? clubData.name : 'Club Registrado',
                clubLogo: '🎾',
                address: isLocal ? clubData.address : '',
                mapsUrl: isLocal ? clubData.mapsUrl : '',
                name: t.title || 'Mini Torneo',
                date: t.date || t.created_at,
                format: t.format,
                status: taken >= total ? 'full' : 'open',
                spotsTaken: taken,
                spotsTotal: total,
                level: t.level_range || 'Abierto',
                price: t.price || 0,
                prizes: t.prizes || [],
                description: t.description || ''
            };
        });

        // Combine Real + Mock
        setGlobalTournaments([...realPublicTournaments, ...MOCK_GLOBAL_TOURNAMENTS]);
    }, [isOfflineMode, user, clubData]);

    // FETCH GLOBAL TOURNAMENTS (Browser)
    useEffect(() => {
        fetchGlobalTournaments();
        
        // Listen to Local Updates (Dispatched by TournamentContext)
        const handleLocalUpdate = () => fetchGlobalTournaments();
        window.addEventListener('local-db-update', handleLocalUpdate);

        // Set up real-time listener if online
        let channel: any;
        if (!isOfflineMode) {
             channel = supabase.channel('public_browser')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, () => fetchGlobalTournaments())
                .subscribe();
        }
        return () => { 
            window.removeEventListener('local-db-update', handleLocalUpdate);
            if (channel) supabase.removeChannel(channel); 
        };
    }, [isOfflineMode, fetchGlobalTournaments]);


    const updateClubData = (data: ClubData) => {
        setClubData(data);
        localStorage.setItem(CLUB_KEY, JSON.stringify(data));
    };

    const toggleFavoriteClub = (clubId: string) => {
        setFavoriteClubIds(prev => {
            const newFavs = prev.includes(clubId) 
                ? prev.filter(id => id !== clubId) 
                : [...prev, clubId];
            localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavs));
            return newFavs;
        });
    };

    const archiveTournament = () => {}; 

    return (
        <HistoryContext.Provider value={{ 
            clubData, updateClubData, pastTournaments, archiveTournament,
            globalTournaments,
            favoriteClubIds,
            toggleFavoriteClub
        }}>
            {children}
        </HistoryContext.Provider>
    );
};

export const useHistory = () => useContext(HistoryContext);
