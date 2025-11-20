
export interface Player {
  id: string;
  name: string;
  nickname?: string;
  email?: string;
  phone?: string;
  categories?: string[]; // Changed to array for multiple categories
  saveRecord?: boolean; // If true, keep in DB for future tournaments
  paid: boolean;
}

export interface Pair {
  id: string;
  player1Id: string;
  player2Id: string;
  name: string; // "Player 1 & Player 2" or custom
  waterReceived: boolean;
  stats: {
    played: number;
    won: number;
    gameDiff: number; // Positive or negative
  };
  groupId?: string; // 'A', 'B', 'C', 'D'
  isReserve?: boolean; // New field for reserve pairs
}

export interface Match {
  id: string;
  round: number; // 1-4 for groups, 5+ for playoffs
  phase: 'group' | 'qf' | 'sf' | 'final'; // qf = quarterfinals (first playoff round)
  bracket: 'main' | 'consolation' | null;
  courtId: number;
  pairAId: string;
  pairBId: string;
  scoreA: number | null;
  scoreB: number | null;
  isFinished: boolean;
  startTime?: number;
}

export interface Group {
  id: string; // A, B, C, D
  pairIds: string[];
}

export interface TournamentState {
  status: 'setup' | 'checkin' | 'active' | 'finished';
  currentRound: number; // 0 = not started, 1-4 groups, 5 QF, 6 SF, 7 Final
  players: Player[];
  pairs: Pair[];
  matches: Match[];
  groups: Group[];
  courts: { id: number; ballsGiven: boolean }[];
  startDate?: string;
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
    winnerMain?: string; // Pair Name
    winnerConsolation?: string; // Pair Name
    playerCount: number;
    data: TournamentState; // Full Snapshot
}

export type TournamentAction =
  | { type: 'LOAD_FROM_STORAGE'; payload: TournamentState }
  | { type: 'ADD_PLAYER'; payload: Player }
  | { type: 'UPDATE_PLAYER'; payload: Player }
  | { type: 'CREATE_PAIR'; payload: { player1Id: string; player2Id: string; name?: string } }
  | { type: 'UPDATE_PAIR'; payload: { pairId: string; player1Id: string; player2Id: string } }
  | { type: 'DELETE_PAIR'; payload: string }
  | { type: 'TOGGLE_PAID'; payload: string }
  | { type: 'TOGGLE_WATER'; payload: string }
  | { type: 'TOGGLE_BALLS'; payload: number }
  | { type: 'START_TOURNAMENT'; }
  | { type: 'UPDATE_SCORE'; payload: { matchId: string; scoreA: number; scoreB: number } }
  | { type: 'NEXT_ROUND'; }
  | { type: 'RESET_TOURNAMENT'; }
  | { type: 'LOAD_DEMO_DATA'; };
