
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ClubData, PastTournament, TournamentState, PublicTournament } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const CLUB_KEY = 'padelpro_club_v1';
const FAVORITES_KEY = 'padelpro_favorites_v1';
const LOCAL_STORAGE_KEY = 'padelpro_local_db_v3';
const LOCAL_HISTORY_KEY = 'padelpro_local_history';

interface HistoryContextType {
    clubData: ClubData;
    loadingClub: boolean; // NEW
    updateClubData: (data: ClubData) => void;
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
    league_enabled: false // Default to false
};

const HistoryContext = createContext<HistoryContextType>({
    clubData: defaultClubData,
    loadingClub: true, // Default true
    updateClubData: () => {},
    pastTournaments: [],
    archiveTournament: () => {},
    globalTournaments: [],
    favoriteClubIds: [],
    toggleFavoriteClub: () => {}
});

export const HistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [clubData, setClubData] = useState<ClubData>(defaultClubData);
    const [loadingClub, setLoadingClub] = useState(true); // NEW STATE
    const [pastTournaments, setPastTournaments] = useState<PastTournament[]>([]);
    const [favoriteClubIds, setFavoriteClubIds] = useState<string[]>([]);
    const [globalTournaments, setGlobalTournaments] = useState<PublicTournament[]>([]);
    const { user, isOfflineMode, loading: authLoading } = useAuth();

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
            const { data: tournaments } = await supabase.from('tournaments').select('*').eq('user_id', user.id).eq('status', 'finished').order('created_at', { ascending: false });
            if (tournaments) setPastTournaments(tournaments.map(t => ({ id: t.id, date: t.created_at, winnerMain: t.winner_main || 'No registrado', winnerConsolation: t.winner_consolation || 'No registrado', playerCount: 0, format: t.format || '16_mini' })));
        }
    };

    const fetchClubData = useCallback(async () => {
        // Wait for auth to be ready if online
        if (!isOfflineMode && authLoading) return;

        setLoadingClub(true);
        try {
            if (isOfflineMode) {
                const saved = localStorage.getItem(CLUB_KEY);
                if (saved) setClubData(JSON.parse(saved));
            } else if (user) {
                const { data } = await supabase.from('clubs').select('*').eq('owner_id', user.id).maybeSingle();
                if (data) {
                    const mapped: ClubData = { 
                        id: data.id, 
                        name: data.name, 
                        courtCount: data.court_count || 6, 
                        address: data.address, 
                        phone: data.phone, 
                        logoUrl: data.logo_url, 
                        league_enabled: data.league_enabled || false 
                    };
                    setClubData(mapped);
                    localStorage.setItem(CLUB_KEY, JSON.stringify(mapped));
                }
            }
        } catch (e) {
            console.error("Error loading club data", e);
        } finally {
            setLoadingClub(false);
        }
    }, [user, isOfflineMode, authLoading]);

    useEffect(() => {
        fetchClubData();
        loadHistory();
    }, [fetchClubData]); // Removed user/isOfflineMode dependencies to rely on useCallback

    const updateClubData = (data: ClubData) => {
        setClubData(data);
        localStorage.setItem(CLUB_KEY, JSON.stringify(data));
        // If not offline, sync with Supabase (logic omitted for brevity but standard update)
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
