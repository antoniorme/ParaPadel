
export interface Player {
  id: string; // UUID from DB
  user_id?: string;
  name: string;
  nickname?: string;
  email?: string;
  phone?: string;
  categories?: string[]; 
  created_at?: string;
}

export interface Pair {
  id: string; // UUID from DB
  tournament_id?: string;
  player1Id: string; // References Player ID
  player2Id: string; // References Player ID
  name: string; 
  waterReceived: boolean;
  paidP1: boolean;
  paidP2: boolean;
  // Computed stats on frontend
  stats: {
    played: number;
    won: number;
    gameDiff: number; 
  };
  groupId?: string; 
  isReserve?: boolean; 
}

export interface Match {
  id: string; // UUID from DB
  tournament_id?: string;
  round: number; 
  phase: 'group' | 'qf' | 'sf' | 'final'; 
  bracket: 'main' | 'consolation' | null;
  courtId: number;
  pairAId: string;
  pairBId: string;
  scoreA: number | null;
  scoreB: number | null;
  isFinished: boolean;
}

export interface Group {
  id: string; 
  pairIds: string[];
}

export interface TournamentState {
  id?: string; // Database ID of the tournament
  status: 'setup' | 'checkin' | 'active' | 'finished';
  currentRound: number; 
  players: Player[]; // Loaded from DB
  pairs: Pair[]; // Loaded from DB
  matches: Match[]; // Loaded from DB
  groups: Group[]; // Computed
  courts: { id: number; ballsGiven: boolean }[];
  startDate?: string;
  loading: boolean; // UI loading state
}

export interface ClubData {
    name: string;
    courtCount: number;
    address?: string;
    phone?: string;
}

export interface PastTournament {
    id: string;
    date: string;
    winnerMain?: string; 
    winnerConsolation?: string; 
    playerCount: number;
    data?: TournamentState;
}

export type TournamentAction =
  | { type: 'SET_STATE'; payload: Partial<TournamentState> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'RESET_LOCAL'; }
  | { type: 'RESET_TOURNAMENT'; }
  | { type: 'LOAD_DEMO_DATA'; }
  | { type: 'TOGGLE_BALLS'; payload: number }
  | { type: 'TOGGLE_WATER'; payload: string }
  | { type: 'TOGGLE_PAID'; payload: string };
