import { FLAGS } from '../flags';
import { LocalLeaderboardStore } from './localStore';
import { RemoteLeaderboardStore } from './remoteStore';
import type { LeaderboardStore } from './types';

export type { LeaderboardStore, NewScore, ScoreRecord, SubmitResult } from './types';
export { SCORE_BOARD_LIMIT } from './types';
export { BEST_KEY, LocalLeaderboardStore, SCORES_KEY } from './localStore';
export { RemoteLeaderboardStore } from './remoteStore';

/**
 * Pick a store implementation.
 *
 * `web` → localStorage. `reddit` → HTTP client for the Devvit Redis board
 * (`/api/scores`). The board UI stays on `LeaderboardStore`.
 */
export function createLeaderboardStore(storage?: Storage): LeaderboardStore {
  if (FLAGS.platform === 'reddit') {
    return new RemoteLeaderboardStore();
  }
  return new LocalLeaderboardStore(storage ?? localStorage);
}
