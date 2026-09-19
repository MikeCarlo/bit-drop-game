import { redis, reddit } from '@devvit/web/server';
import {
  SCORE_BOARD_LIMIT,
  SCORE_STORE_CAP,
  type NewScore,
  type ScoreRecord,
  type SubmitResult,
} from '../../shared/scores';

/** Sorted set: member = score id, score = game points. Per-install (subreddit). */
const BOARD_KEY = 'bitdrop:board';
/** Hash: field = score id, value = JSON ScoreRecord. */
const ROWS_KEY = 'bitdrop:rows';
/** Hash: field = username, value = personal-best points. */
const BEST_KEY = 'bitdrop:best';

function parseRow(raw: string | undefined): ScoreRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ScoreRecord;
    if (!parsed || typeof parsed.score !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function listScores(limit = SCORE_BOARD_LIMIT): Promise<ScoreRecord[]> {
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
  const card = await redis.zCard(BOARD_KEY);
  if (!card) return 0;
  const top = await redis.zRange(BOARD_KEY, 0, 0, { reverse: true, by: 'rank' });
  return top[0]?.score ?? 0;
}

export async function submitScore(entry: NewScore): Promise<SubmitResult> {
  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  const record: ScoreRecord = {
    id: crypto.randomUUID(),
    score: entry.score,
    won: entry.won,
    width: entry.width,
    viruses: entry.viruses,
    speed: entry.speed,
    playedAt: entry.playedAt,
    player: username,
    mode: 'solo',
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

  return { record, rank, personalBest };
}
