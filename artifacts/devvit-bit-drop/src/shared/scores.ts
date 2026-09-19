/** Mirrors artifacts/claude-design/src/leaderboard/types.ts — keep fields in sync. */

export type PlayMode = 'solo' | 'compete';

export type ScoreRecord = {
  id: string;
  score: number;
  won: boolean;
  width: number;
  viruses: number;
  speed: number;
  playedAt: number;
  player: string;
  mode: PlayMode;
};

export type SubmitResult = {
  record: ScoreRecord;
  rank: number;
  personalBest: boolean;
};

export type NewScore = Omit<ScoreRecord, 'id'>;

export const SCORE_BOARD_LIMIT = 10;
export const SCORE_STORE_CAP = 20;
