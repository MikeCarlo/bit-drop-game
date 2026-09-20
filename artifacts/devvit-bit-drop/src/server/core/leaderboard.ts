import { context, redis, reddit } from '@devvit/web/server';
import {
  SCORE_BOARD_LIMIT,
  SCORE_STORE_CAP,
  type NewScore,
  type ScoreRecord,
  type SubmitResult,
} from '../../shared/scores';
import {
  anonymizeRecord,
  BEST_KEY,
  BOARD_KEY,
  planBoardHygiene,
  ROWS_KEY,
  SCORE_TTL_SECONDS,
  type StoredScore,
} from '../../shared/retention';

function parseRow(raw: string | undefined): StoredScore | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredScore;
    if (!parsed || typeof parsed.score !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

async function loadRows(): Promise<Record<string, StoredScore>> {
  const raw = await redis.hGetAll(ROWS_KEY);
  const out: Record<string, StoredScore> = {};
  for (const [id, value] of Object.entries(raw)) {
    const row = parseRow(value);
    if (row) out[id] = row;
  }
  return out;
}

async function refreshTtl(): Promise<void> {
  await Promise.all([
    redis.expire(BOARD_KEY, SCORE_TTL_SECONDS),
    redis.expire(ROWS_KEY, SCORE_TTL_SECONDS),
    redis.expire(BEST_KEY, SCORE_TTL_SECONDS),
  ]);
}

async function removeMembers(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await redis.zRem(BOARD_KEY, ids);
  await redis.hDel(ROWS_KEY, ids);
}

async function applyHygiene(opts: { postId?: string; author?: string | null } = {}): Promise<{
  dropped: number;
  anonymized: number;
}> {
  const rows = await loadRows();
  const plan = planBoardHygiene(rows, opts);
  await removeMembers(plan.dropIds);
  for (const id of plan.anonymizeIds) {
    const current = rows[id];
    if (!current) continue;
    await redis.hSet(ROWS_KEY, { [id]: JSON.stringify(anonymizeRecord(current)) });
  }
  if (plan.dropBest.length > 0) {
    await redis.hDel(BEST_KEY, plan.dropBest);
  }
  if (plan.dropIds.length > 0 || plan.anonymizeIds.length > 0 || plan.dropBest.length > 0) {
    await refreshTtl();
  }
  return { dropped: plan.dropIds.length, anonymized: plan.anonymizeIds.length };
}

/** Drop rows older than 30 days and refresh key TTL. */
export async function pruneExpiredScores(): Promise<{ dropped: number; anonymized: number }> {
  return applyHygiene();
}

/** PostDelete: remove scores submitted from that post. */
export async function scrubDeletedPost(postId: string | undefined): Promise<{ dropped: number; anonymized: number }> {
  if (!postId) return { dropped: 0, anonymized: 0 };
  return applyHygiene({ postId });
}

/**
 * Account-identifying scrub: strip username from remaining rows and `bitdrop:best`.
 * Devvit has no account-delete trigger; call this when an event includes the author.
 */
export async function scrubAuthor(author: string | undefined | null): Promise<{ dropped: number; anonymized: number }> {
  return applyHygiene({ author });
}

export async function listScores(limit = SCORE_BOARD_LIMIT): Promise<ScoreRecord[]> {
  await pruneExpiredScores();
  const cap = Math.max(1, Math.min(limit, SCORE_STORE_CAP));
  const card = await redis.zCard(BOARD_KEY);
  if (!card) return [];

  // reverse + by rank: index 0 is the highest score (ZRangeOptions in @devvit/redis).
  const ranked = await redis.zRange(BOARD_KEY, 0, cap - 1, { reverse: true, by: 'rank' });
  const rows = await redis.hGetAll(ROWS_KEY);

  const out: ScoreRecord[] = [];
  for (const entry of ranked) {
    const row = parseRow(rows[entry.member]);
    if (row) out.push(row);
    if (out.length >= cap) break;
  }
  return out;
}

export async function bestScore(): Promise<number> {
  await pruneExpiredScores();
  const card = await redis.zCard(BOARD_KEY);
  if (!card) return 0;
  const top = await redis.zRange(BOARD_KEY, 0, 0, { reverse: true, by: 'rank' });
  return top[0]?.score ?? 0;
}

export async function submitScore(entry: NewScore): Promise<SubmitResult> {
  await pruneExpiredScores();
  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  const postId = context.postId;
  const record: StoredScore = {
    id: crypto.randomUUID(),
    score: entry.score,
    won: entry.won,
    width: entry.width,
    viruses: entry.viruses,
    speed: entry.speed,
    playedAt: entry.playedAt,
    player: username,
    mode: 'solo',
    postId,
  };

  await redis.hSet(ROWS_KEY, { [record.id]: JSON.stringify(record) });
  await redis.zAdd(BOARD_KEY, { member: record.id, score: record.score });

  const card = await redis.zCard(BOARD_KEY);
  if (card > SCORE_STORE_CAP) {
    const extra = card - SCORE_STORE_CAP;
    const doomed = await redis.zRange(BOARD_KEY, 0, extra - 1, { by: 'rank' });
    await redis.zRemRangeByRank(BOARD_KEY, 0, extra - 1);
    const fields = doomed.map((row) => row.member);
    if (fields.length > 0) {
      await redis.hDel(ROWS_KEY, fields);
    }
  }

  const lowRank = await redis.zRank(BOARD_KEY, record.id);
  const size = await redis.zCard(BOARD_KEY);
  const rank = lowRank == null ? size : size - lowRank;

  const prevBestRaw = await redis.hGet(BEST_KEY, username);
  const prevBest = prevBestRaw ? Number(prevBestRaw) : 0;
  const personalBest = !Number.isFinite(prevBest) || record.score >= prevBest;
  if (personalBest) {
    await redis.hSet(BEST_KEY, { [username]: String(record.score) });
  }

  await refreshTtl();

  return { record, rank, personalBest };
}
