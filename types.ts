
export interface Player {
  id: string; // UUID
  user_id?: string;
  name: string;
  nickname?: string;
  email?: string;
  phone?: string;
  categories?: string[]; // Categorías declaradas
  
  // ADVANCED ELO SYSTEM
  global_rating?: number; // Rating transversal (amortiguado)
  category_ratings?: Record<string, number>; // Mapa: { "3ª CAT": 1450, "4ª CAT": 1500 }
  main_category?: string; // Categoría "casa"
  matches_played?: number; // Added for tracking match count
  
  // Legacy / Visual
  manual_rating?: number; 
  rankingPoints?: number; // Valor visual final calculado
  
  created_at?: string;
}

export interface Pair {
  id: string; 
  tournament_id?: string;
  player1Id: string; 
  player2Id: string; 
  name: string; 
  waterReceived: boolean;
  paidP1: boolean;
  paidP2: boolean;
  stats: {
    played: number;
    won: number;
    gameDiff: number; 
  };
  groupId?: string; 
  isReserve?: boolean; 
}

export interface Match {
  id: string; 
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
  elo_processed?: boolean; 
}

export interface Group {
  id: string; 
  pairIds: string[];
}

export type TournamentFormat = '16_mini' | '10_mini' | '12_mini' | '8_mini';

export type GenerationMethod = 'elo-balanced' | 'elo-mixed' | 'manual' | 'arrival';

export interface TournamentState {
  id?: string; 
  status: 'setup' | 'checkin' | 'active' | 'finished';
  currentRound: number; 
  format: TournamentFormat; // NEW: Format definition
  players: Player[]; 
  pairs: Pair[]; 
  matches: Match[]; 
  groups: Group[]; 
  courts: { id: number; ballsGiven: boolean }[];
  startDate?: string;
  loading: boolean; 
}

export interface ClubData {
    name: string;
    courtCount: number;
    address?: string;
    phone?: string;
    logoUrl?: string;
}

export interface PastTournament {
    id: string;
    date: string;
    winnerMain?: string; 
    winnerConsolation?: string; 
    playerCount: number;
    format?: TournamentFormat;
    data?: TournamentState; // Made optional as history list often doesn't have full data
}

export type TournamentAction =
  | { type: 'SET_STATE'; payload: Partial<TournamentState> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'RESET_LOCAL'; }
  | { type: 'TOGGLE_BALLS'; payload: number }
  | { type: 'TOGGLE_WATER'; payload: string }
  | { type: 'TOGGLE_PAID'; payload: string }
  | { type: 'LOAD_DEMO_DATA'; }
  | { type: 'SET_FORMAT'; payload: TournamentFormat };