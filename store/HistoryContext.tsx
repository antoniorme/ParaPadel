
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
                        
                        // Reconstruct State for this tournament
                        const historicalState: TournamentState = {
                            id: t.id,
                            status: 'finished',
                            currentRound: t.current_round,
                            format: t.format || '16_mini',
                            players: allPlayers || [], // Needed for name resolution
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
                            data: historicalState // Store full data for stats calculation
                        };
                    });
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
