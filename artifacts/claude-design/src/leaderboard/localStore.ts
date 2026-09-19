import {
  SCORE_BOARD_LIMIT,
  SCORE_STORE_CAP,
  type LeaderboardStore,
  type NewScore,
  type ScoreRecord,
  type SubmitResult,
} from './types';

export const SCORES_KEY = 'bitdrop-scores';
export const BEST_KEY = 'bitdrop-best';

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function rankSort(a: ScoreRecord, b: ScoreRecord): number {
  if (b.score !== a.score) return b.score - a.score;
  return b.playedAt - a.playedAt;
}

function parseRows(raw: string | null): ScoreRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is ScoreRecord => {
      return !!row && typeof row === 'object' && typeof (row as ScoreRecord).score === 'number';
    });
  } catch {
    return [];
  }
}

/** Personal high-score list backed by Web Storage (localStorage in the browser). */
export class LocalLeaderboardStore implements LeaderboardStore {
  readonly kind = 'local' as const;
  private readonly storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
    this.migrateLegacyBest();
  }

  private read(): ScoreRecord[] {
    return parseRows(this.storage.getItem(SCORES_KEY));
  }

  private write(rows: ScoreRecord[]): void {
    const trimmed = [...rows].sort(rankSort).slice(0, SCORE_STORE_CAP);
    this.storage.setItem(SCORES_KEY, JSON.stringify(trimmed));
    const top = trimmed[0]?.score ?? 0;
    this.storage.setItem(BEST_KEY, String(top));
  }

  /** Seed the board from the pre-Phase-1 single `bitdrop-best` value. */
  private migrateLegacyBest(): void {
    if (this.read().length > 0) return;
    const best = Number(this.storage.getItem(BEST_KEY) || 0);
    if (!Number.isFinite(best) || best <= 0) return;
    this.write([{
      id: 'migrated-best',
      score: best,
      won: false,
      width: Number(this.storage.getItem('bitdrop-w') || 19) || 19,
      viruses: Number(this.storage.getItem('bitdrop-v') || 4) || 4,
      speed: Number(this.storage.getItem('bitdrop-s') || 3) || 3,
      playedAt: Date.now(),
      player: 'You',
      mode: 'solo',
    }]);
  }

  async list(limit = SCORE_BOARD_LIMIT): Promise<ScoreRecord[]> {
    return this.read().sort(rankSort).slice(0, limit);
  }

  async submit(entry: NewScore): Promise<SubmitResult> {
    const record: ScoreRecord = { ...entry, id: newId() };
    const rows = this.read();
    rows.push(record);
    this.write(rows);
    const ranked = this.read().sort(rankSort);
    const rank = ranked.findIndex((row) => row.id === record.id) + 1;
    const top = ranked[0]?.score ?? record.score;
    return {
      record,
      rank: rank > 0 ? rank : ranked.length,
      personalBest: record.score >= top,
    };
  }

  async best(): Promise<number> {
    const top = await this.list(1);
    return top[0]?.score ?? 0;
  }
}
