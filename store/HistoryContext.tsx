import React, { createContext, useContext, useState, useEffect } from 'react';
import { ClubData, PastTournament, TournamentState } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const CLUB_KEY = 'padelpro_club_v1';

interface HistoryContextType {
    clubData: ClubData;
    updateClubData: (data: ClubData) => void;
    pastTournaments: PastTournament[];
    archiveTournament: (finalState: TournamentState) => void; 
}

const defaultClubData: ClubData = {
    name: 'Mi Club de Padel',
    courtCount: 6,
    address: '',
    phone: ''
};

const HistoryContext = createContext<HistoryContextType>({
    clubData: defaultClubData,
    updateClubData: () => {},
    pastTournaments: [],
    archiveTournament: () => {}
});

export const HistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [clubData, setClubData] = useState<ClubData>(defaultClubData);
    const [pastTournaments, setPastTournaments] = useState<PastTournament[]>([]);
    const { user } = useAuth();

    useEffect(() => {
        const savedClub = localStorage.getItem(CLUB_KEY);
        if (savedClub) try { setClubData(JSON.parse(savedClub)); } catch (e) {}

        const loadHistory = async () => {
            if (user) {
                // Fetch finished tournaments from DB
                const { data } = await supabase
                    .from('tournaments')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('status', 'finished')
                    .order('created_at', { ascending: false });
                
                if (data) {
                    const history: PastTournament[] = data.map(t => ({
                        id: t.id,
                        date: t.created_at,
                        winnerMain: 'Consultar', // Requiere lógica adicional
                        winnerConsolation: 'Consultar',
                        playerCount: 32 // Placeholder
                    }));
                    setPastTournaments(history);
                }
            }
        };
        loadHistory();
    }, [user]);

    const updateClubData = (data: ClubData) => {
        setClubData(data);
        localStorage.setItem(CLUB_KEY, JSON.stringify(data));
    };

    const archiveTournament = () => {}; 

    return (
        <HistoryContext.Provider value={{ clubData, updateClubData, pastTournaments, archiveTournament }}>
            {children}
        </HistoryContext.Provider>
    );
};

export const useHistory = () => useContext(HistoryContext);