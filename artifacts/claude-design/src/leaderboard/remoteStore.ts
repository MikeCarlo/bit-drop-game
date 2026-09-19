import {
  SCORE_BOARD_LIMIT,
  type LeaderboardStore,
  type NewScore,
  type ScoreRecord,
  type SubmitResult,
} from './types';

type ScoresResponse = { scores: ScoreRecord[] };
type BestResponse = { best: number };

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`leaderboard request failed: HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/**
 * Client adapter for the Devvit Redis board.
 * Talks to `/api/scores` on the Devvit server (see artifacts/devvit-bit-drop).
 */
export class RemoteLeaderboardStore implements LeaderboardStore {
  readonly kind = 'remote' as const;

  async list(limit = SCORE_BOARD_LIMIT): Promise<ScoreRecord[]> {
    try {
      const res = await fetch(`/api/scores?limit=${encodeURIComponent(String(limit))}`);
      const data = await readJson<ScoresResponse>(res);
      return Array.isArray(data.scores) ? data.scores : [];
    } catch (err) {
      console.error('RemoteLeaderboardStore.list failed', err);
      return [];
    }
  }

  async submit(entry: NewScore): Promise<SubmitResult> {
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    return readJson<SubmitResult>(res);
  }

  async best(): Promise<number> {
    try {
      const res = await fetch('/api/scores/best');
      const data = await readJson<BestResponse>(res);
      return typeof data.best === 'number' && Number.isFinite(data.best) ? data.best : 0;
    } catch (err) {
      console.error('RemoteLeaderboardStore.best failed', err);
      return 0;
    }
  }
}
