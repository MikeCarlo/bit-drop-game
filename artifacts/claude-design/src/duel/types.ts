/** JSON shapes from the Devvit duel routes. Keep in sync with `assembleMatchView`. */

export type DuelPhase = 'playing' | 'between' | 'complete';

export type MatchView = {
  id: string;
  you: string;
  opponent: string;
  seat: 0 | 1;
  p1: string;
  p2: string;
  width: number;
  viruses: number;
  speed: number;
  round: number;
  wins: [number, number];
  phase: DuelPhase;
  winner: string | null;
  roundWinner: string | null;
  youReady: boolean;
  opponentReady: boolean;
  garbage: number[];
  attackIds: string[];
  attacks: { id: string; colors: number[] }[];
  postId: string;
};

export type ChallengeView = {
  id: string;
  challenger: string;
  opponent: string;
  width: number;
  viruses: number;
  speed: number;
  createdAt: number;
  postId: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  matchId?: string;
  link: string;
  incoming: boolean;
};

export type DuelState = {
  username: string;
  postId: string;
  inbox: ChallengeView[];
  outbox: ChallengeView[];
  active: MatchView | null;
};

export type WinsRow = { player: string; wins: number; rank: number };

export type WinsBoard = { month: string; rows: WinsRow[] };

export type DuelSettings = { width: number; viruses: number; speed: number };
