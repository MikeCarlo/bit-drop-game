import { FLAGS } from '../flags';
import { LocalLeaderboardStore } from './localStore';
import type { LeaderboardStore } from './types';

export type { LeaderboardStore, NewScore, ScoreRecord, SubmitResult } from './types';
export { SCORE_BOARD_LIMIT } from './types';
export { BEST_KEY, LocalLeaderboardStore, SCORES_KEY } from './localStore';

/**
 * Pick a store implementation.
 *
 * Phase 1 always returns localStorage — including `PLATFORM=reddit` — so the
 * existing Vite app keeps working. When a Devvit server is added, swap the
 * reddit branch for a Redis adapter that implements `LeaderboardStore`
 * (sorted set: ZADD / ZREVRANGE / ZREVRANK, namespaced per subreddit install).
 */
export function createLeaderboardStore(storage?: Storage): LeaderboardStore {
  if (FLAGS.platform === 'reddit') {
    // Phase 2: return new DevvitRedisStore();
    return new LocalLeaderboardStore(storage ?? localStorage);
  }
  return new LocalLeaderboardStore(storage ?? localStorage);
}
