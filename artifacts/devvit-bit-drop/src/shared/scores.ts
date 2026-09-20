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
  /** Reddit post the score was submitted from (server fills this). */
  postId?: string;
};

export type SubmitResult = {
  record: ScoreRecord;
  rank: number;
  personalBest: boolean;
};

export type NewScore = Omit<ScoreRecord, 'id'>;

export const SCORE_BOARD_LIMIT = 10;
export const SCORE_STORE_CAP = 20;
