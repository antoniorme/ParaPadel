export interface Player {
  id: string; // UUID
  user_id?: string; // ID del Club (Admin)
  profile_user_id?: string; // NEW: ID del Usuario Jugador (App Jugadores)
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
  player2Id: string | null; // UPDATED: Can be null for solo players
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
  status?: 'confirmed' | 'pending' | 'rejected'; 
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

// NEW: Lightweight summary for the Club Dashboard list
export interface TournamentSummary {
    id: string;
    title: string;
    date: string;
    status: 'setup' | 'active' | 'finished';
    format: TournamentFormat;
    playerCount: number; // or pairCount
}

export interface TournamentState {
  id?: string; 
  status: 'setup' | 'checkin' | 'active' | 'finished';
  currentRound: number; 
  format: TournamentFormat; 
  players: Player[]; 
  pairs: Pair[]; 
  matches: Match[]; 
  groups: Group[]; 
  courts: { id: number; ballsGiven: boolean }[];
  loading: boolean; 
  
  // List of active tournaments for the dashboard
  tournamentList: TournamentSummary[];

  // METADATA FOR PUBLIC LISTING
  title?: string;
  description?: string;
  price?: number;
  levelRange?: string; // e.g. "Nivel 4.0 - 5.0"
  prizes?: string[];
  includedItems?: string[]; // e.g. ["Agua", "Bolas", "Fruta"]
  startDate?: string;
}

export interface ClubData {
    name: string;
    courtCount: number;
    address?: string;
    mapsUrl?: string; // NEW: Google Maps Link
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
    data?: TournamentState; 
}

// NEW: For the Public Browser
export interface PublicTournament {
    id: string;
    clubId: string;
    clubName: string;
    clubLogo?: string; // Emoji or URL
    address?: string; // NEW
    mapsUrl?: string; // NEW
    name: string;
    description?: string; // NEW
    date: string; // ISO
    format: TournamentFormat;
    status: 'open' | 'full' | 'active';
    spotsTaken: number;
    spotsTotal: number;
    level: string; // e.g. "Nivel Medio-Alto"
    price: number;
    prizes?: string[]; // NEW: List of prizes
}

// --- NOTIFICATIONS ---
export type NotificationType = 'invite' | 'match_start' | 'result' | 'system' | 'alert';

export interface AppNotification {
    id: string;
    userId: string; // Recipient ID (Player ID or User ID)
    type: NotificationType;
    title: string;
    message: string;
    link?: string; // Internal route to navigate to
    read: boolean;
    createdAt: string;
    meta?: any; // Extra data (e.g., matchId, tournamentId)
}

export interface NotificationSettings {
    invites: boolean;
    matchStart: boolean;
    results: boolean;
    system: boolean;
}

export type TournamentAction =
  | { type: 'SET_STATE'; payload: Partial<TournamentState> }
  | { type: 'SET_TOURNAMENT_LIST'; payload: TournamentSummary[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'RESET_LOCAL'; }
  | { type: 'TOGGLE_BALLS'; payload: number }
  | { type: 'TOGGLE_WATER'; payload: string }
  | { type: 'TOGGLE_PAID'; payload: string }
  | { type: 'LOAD_DEMO_DATA'; }
  | { type: 'SET_FORMAT'; payload: TournamentFormat }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<TournamentState> };