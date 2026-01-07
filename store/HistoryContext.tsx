
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
        // Wait for auth to be fully ready
        if (!isOfflineMode && authLoading) return;

        setLoadingClub(true);
        try {
            if (isOfflineMode) {
                const saved = localStorage.getItem(CLUB_KEY);
                if (saved) setClubData(JSON.parse(saved));
                else {
                    // Initialize offline default with a fake ID to prevent onboarding loop if desired, 
                    // BUT for offline we might want onboarding. 
                    // Let's keep default (no ID) so onboarding triggers if no saved data.
                }
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
                        mapsUrl: data.maps_url
                    };
                    setClubData(mapped);
                    // Update local cache
                    localStorage.setItem(CLUB_KEY, JSON.stringify(mapped));
                } else if (!error) {
                    // User logged in but no club found? 
                    // If auth says admin but db says no club, it's a sync issue.
                    // We don't set data, so it remains default (no ID).
                    console.warn("User is authenticated but no Club record found.");
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
    }, [fetchClubData]);

    const updateClubData = async (data: ClubData) => {
        // Optimistic Update
        setClubData(data);
        localStorage.setItem(CLUB_KEY, JSON.stringify(data));

        if (!isOfflineMode && user) {
            try {
                // Upsert logic: if we have an ID use it, otherwise match by owner_id
                const payload = {
                    owner_id: user.id,
                    name: data.name,
                    court_count: data.courtCount,
                    address: data.address,
                    phone: data.phone,
                    logo_url: data.logoUrl,
                    maps_url: data.mapsUrl
                };

                // Determine if we are updating existing or creating new
                let query = supabase.from('clubs');
                
                // If we already have a club ID in state, use it to update specifically
                // (Though RLS usually restricts to owner_id anyway)
                if (clubData.id) {
                    await query.update(payload).eq('id', clubData.id);
                } else {
                    // If no ID, it might be first setup. Try update first by owner_id, then insert if not found?
                    // Safe approach: Upsert on owner_id if unique constraint exists, or check existence.
                    // We'll try update first.
                    const { data: existing } = await supabase.from('clubs').select('id').eq('owner_id', user.id).maybeSingle();
                    if (existing) {
                        await query.update(payload).eq('id', existing.id);
                        // Update local state with the found ID to prevent future issues
                        setClubData({ ...data, id: existing.id });
                    } else {
                        // Insert
                        const { data: newClub } = await query.insert([payload]).select().single();
                        if (newClub) setClubData({ ...data, id: newClub.id });
                    }
                }
            } catch (e) {
                console.error("Error syncing club data", e);
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
