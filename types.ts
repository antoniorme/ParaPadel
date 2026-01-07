
export interface Player {
  id: string; // UUID
  user_id?: string; // ID del Club (Admin)
  profile_user_id?: string; // NEW: ID del Usuario Jugador (App Jugadores)
  name: string;
  nickname?: string;
  email?: string;
  phone?: string;
  categories?: string[]; // Categorías declaradas
  preferred_position?: 'right' | 'backhand';
  play_both_sides?: boolean;
  global_rating?: number;
  category_ratings?: Record<string, number>;
  main_category?: string;
  matches_played?: number;
  manual_rating?: number; 
  rankingPoints?: number;
  created_at?: string;
}

export interface Pair {
  id: string; 
  tournament_id?: string;
  league_id?: string; 
  player1Id: string; 
  player2Id: string | null;
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
  category_id?: string; // NEW: Explicit category link
  isReserve?: boolean; 
  status?: 'confirmed' | 'pending' | 'rejected'; 
}

// --- LEAGUE MODULE TYPES ---

export type LeaguePhase = 'registration' | 'groups' | 'playoffs' | 'finished';

export interface LeagueCategory {
    id: string;
    name: string; 
    prize_winner: string;
    prize_runnerup: string;
    pairs_count: number;
}

export interface LeagueGroup {
    id: string;
    category_id: string;
    name: string; // Grupo A, B...
    pairIds: string[];
}

export interface LeagueMatch {
    id: string;
    league_id: string;
    category_id: string;
    group_id?: string; 
    phase: 'group' | 'playoff';
    round?: number; // NEW: Jornada Number
    pairAId: string;
    pairBId: string;
    setsA: number | null;
    setsB: number | null;
    // gamesDetail: { set: number; a: number; b: number }[]; // Simplificado para esta versión
    score_text?: string; // Ej: "6/4 6/2"
    isFinished: boolean;
    date_scheduled?: string;
    winnerId?: string;
}

export interface LeagueState {
    id?: string;
    title: string;
    status: LeaguePhase;
    startDate: string;
    endDate: string;
    playoffDate: string;
    categories: LeagueCategory[]; // Kept for DB compatibility, but UI will use [0]
    mainCategoryId?: string; // NEW: Shortcut to the single active category
    groups: LeagueGroup[];
    matches: LeagueMatch[];
    pairs: Pair[];
    loading: boolean;
    is_module_active?: boolean;
    config?: {
        double_round: boolean; // Ida y Vuelta
    };
}

// REST OF TYPES...
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

export interface TournamentSummary {
    id: string;
    title: string;
    date: string;
    status: 'setup' | 'active' | 'finished';
    format: TournamentFormat;
    playerCount: number;
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
  tournamentList: TournamentSummary[];
  title?: string;
  description?: string;
  price?: number;
  levelRange?: string;
  prizes?: string[];
  includedItems?: string[];
  startDate?: string;
}

export interface ClubData {
    id?: string;
    name: string;
    courtCount: number;
    address?: string;
    mapsUrl?: string;
    phone?: string;
    logoUrl?: string;
    league_enabled?: boolean; 
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

export interface PublicTournament {
    id: string;
    clubId: string;
    clubName: string;
    clubLogo?: string;
    address?: string;
    mapsUrl?: string;
    name: string;
    description?: string;
    date: string;
    format: TournamentFormat;
    status: 'open' | 'full' | 'active';
    spotsTaken: number;
    spotsTotal: number;
    level: string;
    price: number;
    prizes?: string[];
}

export type NotificationType = 'invite' | 'match_start' | 'result' | 'system' | 'alert';

export interface AppNotification {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
    read: boolean;
    createdAt: string;
    meta?: any;
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