import type { PlayMode } from '../modes';

export interface ScoreRecord {
  id: string;
  score: number;
  won: boolean;
  width: number;
  viruses: number;
  speed: number;
  playedAt: number;
  /** Display name. Phase 1 web uses "You"; Reddit can fill the username later. */
  player: string;
  mode: PlayMode;
}

export interface SubmitResult {
  record: ScoreRecord;
  rank: number;
  personalBest: boolean;
}

export type NewScore = Omit<ScoreRecord, 'id'>;

/**
 * Storage port for the high-score board.
 *
 * Phase 1: `LocalLeaderboardStore` (localStorage).
 * Later: a Devvit Redis adapter (`ZADD` / `ZREVRANGE` / `ZREVRANK`) can
 * implement this same interface — the board UI does not change.
 */
export interface LeaderboardStore {
  readonly kind: 'local' | 'remote';
  list(limit?: number): Promise<ScoreRecord[]>;
  submit(entry: NewScore): Promise<SubmitResult>;
  best(): Promise<number>;
}

export const SCORE_BOARD_LIMIT = 10;
export const SCORE_STORE_CAP = 20;
