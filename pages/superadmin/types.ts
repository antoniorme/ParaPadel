export interface Club {
    id: string;
    owner_id: string;
    name: string;
    email?: string;
    is_active: boolean;
    league_enabled?: boolean;
    minis_lite_enabled?: boolean;
    minis_full_enabled?: boolean;
    show_players?: boolean;
    show_history?: boolean;
    courts_enabled?: boolean;
    created_at: string;
}

export interface ClubWithStats extends Club {
    playerCount: number;
    activeTourneys: number;
    activeLeagues: number;
    finishedTourneys: number;
    ownerEmail?: string;
}

export interface UserResult {
    id: string;
    name: string;
    email: string;
}

export interface InspectionStats {
    players: number;
    minis: { total: number; setup: number; active: number; finished: number };
    leagues: { total: number; setup: number; active: number; finished: number };
}
