import type { ScoreRecord } from './scores';

/** Devvit preference: drop stored user data within 30 days. */
export const SCORE_TTL_SECONDS = 30 * 24 * 60 * 60;
export const SCORE_TTL_MS = SCORE_TTL_SECONDS * 1000;
export const DELETED_PLAYER = '[deleted]';

export const BOARD_KEY = 'bitdrop:board';
export const ROWS_KEY = 'bitdrop:rows';
export const BEST_KEY = 'bitdrop:best';

export type StoredScore = ScoreRecord & {
  /** Post the score was submitted from (Devvit context.postId). */
  postId?: string;
};

export function isScoreExpired(playedAt: number, now = Date.now()): boolean {
  if (!Number.isFinite(playedAt) || playedAt <= 0) return true;
  return now - playedAt >= SCORE_TTL_MS;
}

export function normalizeAuthor(name: string | undefined | null): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower === '[deleted]' || lower === 'anonymous' || lower === 'auto-moderator') {
    return null;
  }
  return trimmed;
}

export function sameAuthor(player: string, author: string): boolean {
  return player.localeCompare(author, undefined, { sensitivity: 'accent' }) === 0;
}

export function anonymizeRecord<T extends { player: string }>(record: T): T {
  return { ...record, player: DELETED_PLAYER };
}

export function shouldDropForPost(row: StoredScore, postId: string): boolean {
  return !!row.postId && row.postId === postId;
}

export function planBoardHygiene(
  rows: Record<string, StoredScore>,
  opts: { now?: number; postId?: string; author?: string | null },
): { dropIds: string[]; anonymizeIds: string[]; dropBest: string[] } {
  const now = opts.now ?? Date.now();
  const author = normalizeAuthor(opts.author);
  const dropIds: string[] = [];
  const anonymizeIds: string[] = [];
  const dropBest = new Set<string>();

  for (const [id, row] of Object.entries(rows)) {
    if (isScoreExpired(row.playedAt, now) || (opts.postId && shouldDropForPost(row, opts.postId))) {
      dropIds.push(id);
      if (row.player && row.player !== DELETED_PLAYER) dropBest.add(row.player);
      continue;
    }
    if (author && sameAuthor(row.player, author)) {
      anonymizeIds.push(id);
      dropBest.add(row.player);
    }
  }

  return { dropIds, anonymizeIds, dropBest: [...dropBest] };
}
