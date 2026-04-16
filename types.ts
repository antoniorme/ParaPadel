
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

// ── MATCHES (sistema unificado de partidos libres) ────────────────────────────
// Nota: la tabla en Supabase se llama `free_matches` (evita conflicto con la
// tabla `matches` del módulo de torneos que tiene tournament_id + pair_a_id)

export type MatchStatus = 'draft' | 'open' | 'full' | 'in_progress' | 'finished' | 'cancelled';
export type MatchResultStatus = 'not_submitted' | 'pending_confirmation' | 'disputed' | 'final';
export type ParticipantType = 'registered_player' | 'claimable_guest' | 'placeholder_guest';
export type AttendanceStatus = 'joined' | 'confirmed' | 'declined' | 'cancelled' | 'removed' | 'no_show';
export type JoinedVia = 'link' | 'manual' | 'invite';
export type RatingImpactMode = 'full' | 'partial' | 'none';

export interface Match {
  id: string;
  club_id: string;
  created_by_user_id?: string;
  host_user_id?: string;
  title?: string;
  sport: string;
  format: string;
  scheduled_at: string;          // ISO timestamptz
  duration_minutes?: number;
  court?: string;
  max_players: number;
  status: MatchStatus;
  visibility: string;
  share_token: string;
  result_status: MatchResultStatus;
  slots_are_equivalent: boolean;
  level?: string;
  notes?: string;
  elo_processed: boolean;
  created_at?: string;
  updated_at?: string;
  // Joins opcionales
  match_participants?: MatchParticipant[];
  match_results?: MatchResult[];
}

export interface MatchParticipant {
  id: string;
  match_id: string;
  participant_type: ParticipantType;
  user_id?: string;
  player_id?: string;
  guest_name?: string;
  guest_phone?: string;
  slot_index?: number;
  team?: 'A' | 'B';
  joined_via: JoinedVia;
  attendance_status: AttendanceStatus;
  claimed_user_id?: string;
  is_rating_eligible: boolean;
  created_at?: string;
  // Join opcional con tabla players
  player?: Player;
}

export interface MatchResult {
  id: string;
  match_id: string;
  submitted_by_user_id?: string;
  team_a_score: number;
  team_b_score: number;
  submitted_at?: string;
  status: 'pending_confirmation' | 'disputed' | 'final';
  rating_impact_mode: RatingImpactMode;
}

export interface MatchResultDispute {
  id: string;
  match_result_id: string;
  raised_by_user_id?: string;
  reason?: string;
  status: 'open' | 'resolved';
  resolved_by_user_id?: string;
  created_at?: string;
}

/** @deprecated Usar Match + MatchParticipant en su lugar */
export interface Partido {
  id: string;
  club_id: string;
  date: string;
  start_time?: string;
  court?: string;
  player1_a?: string;
  player2_a?: string;
  player1_b?: string;
  player2_b?: string;
  score_a: number;
  score_b: number;
  is_finished: boolean;
  elo_processed: boolean;
  notes?: string;
  created_at?: string;
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
    minis_lite_enabled?: boolean; // NEW
    minis_full_enabled?: boolean; // NEW
    show_players?: boolean; // NEW
    show_history?: boolean; // NEW
    courts_enabled?: boolean; // Módulo calendario de pistas
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

// ── CALENDARIO DE PISTAS ──────────────────────────────────────────────────────

export interface CourtConfig {
  id: string;
  club_id: string;
  court_number: number;
  court_name: string;
  slot_minutes: 60 | 90;
  open_time: string;   // "08:00"
  close_time: string;  // "22:00"
  active_days: number[]; // 0=Dom 1=Lun ... 6=Sáb
  is_active: boolean;
  sort_order: number;
}

export type BlockType = 'manual' | 'tournament' | 'maintenance' | 'private';

export interface CourtBlock {
  id: string;
  club_id: string;
  court_number: number;
  start_at: string;   // ISO timestamp
  end_at: string;     // ISO timestamp
  reason: string;
  block_type: BlockType;
  tournament_id?: string;
  created_by?: string;
  created_at: string;
}

export type ReservationStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled';
export type ReservationSource = 'app' | 'whatsapp' | 'admin' | 'join_link';

export interface CourtReservation {
  id: string;
  club_id: string;
  court_number: number;
  player_id?: string;
  player_name?: string;
  player_phone?: string;
  player_email?: string;
  partner_name?: string;
  start_at: string;
  end_at: string;
  status: ReservationStatus;
  source: ReservationSource;
  notes?: string;
  confirmed_by?: string;
  confirmed_at?: string;
  created_at: string;
}

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