
import React, { createContext, useContext, useState, useEffect } from 'react';
import { ClubData, PastTournament, TournamentState } from '../types';

const HISTORY_KEY = 'padelpro_history_v1';
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

    // Load on Mount
    useEffect(() => {
        const savedClub = localStorage.getItem(CLUB_KEY);
        if (savedClub) {
            try {
                setClubData(JSON.parse(savedClub));
            } catch (e) {
                console.error(e);
            }
        }
        
        const savedHistory = localStorage.getItem(HISTORY_KEY);
        if (savedHistory) {
            try {
                setPastTournaments(JSON.parse(savedHistory));
            } catch (e) {
                 console.error(e);
            }
        }
    }, []);

    const updateClubData = (data: ClubData) => {
        setClubData(data);
        localStorage.setItem(CLUB_KEY, JSON.stringify(data));
    };

    const archiveTournament = (finalState: TournamentState) => {
        // Find Winner
        const finalMain = finalState.matches.find(m => m.id === 'final-m');
        const finalConsolation = finalState.matches.find(m => m.id === 'final-c');
        
        let winnerMainName = 'Desconocido';
        if (finalMain && finalMain.scoreA !== null && finalMain.scoreB !== null) {
            const winnerId = finalMain.scoreA > finalMain.scoreB ? finalMain.pairAId : finalMain.pairBId;
            winnerMainName = finalState.pairs.find(p => p.id === winnerId)?.name || 'Desconocido';
        }

        let winnerConsolationName = 'Desconocido';
        if (finalConsolation && finalConsolation.scoreA !== null && finalConsolation.scoreB !== null) {
            const winnerId = finalConsolation.scoreA > finalConsolation.scoreB ? finalConsolation.pairAId : finalConsolation.pairBId;
            winnerConsolationName = finalState.pairs.find(p => p.id === winnerId)?.name || 'Desconocido';
        }

        const record: PastTournament = {
            id: `hist-${Date.now()}`,
            date: finalState.startDate || new Date().toISOString(),
            winnerMain: winnerMainName,
            winnerConsolation: winnerConsolationName,
            playerCount: finalState.players.length,
            data: finalState
        };

        const updatedHistory = [record, ...pastTournaments];
        setPastTournaments(updatedHistory);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
    };

    return (
        <HistoryContext.Provider value={{ clubData, updateClubData, pastTournaments, archiveTournament }}>
            {children}
        </HistoryContext.Provider>
    );
};

export const useHistory = () => useContext(HistoryContext);
