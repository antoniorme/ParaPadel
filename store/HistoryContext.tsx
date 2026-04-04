
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
        loadHistory();
    }, [fetchClubData]);

    const updateClubData = async (data: ClubData) => {
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
