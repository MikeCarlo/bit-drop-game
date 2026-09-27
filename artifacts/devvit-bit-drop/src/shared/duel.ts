/**
 * Reddit 1v1 duel rules and Redis key scheme.
 *
 * Monthly wins live in their own keys, separate from solo `bitdrop:board`.
 * The month is the UTC calendar month (`YYYY-MM`). A new month uses a new
 * key, so the board resets without a cron wipe. Keys expire 40 days after
 * the last write so a board stays readable through the month.
 *
 * Match / challenge keys expire after 7 days. Usernames are the Reddit
 * username from `reddit.getCurrentUsername()` (same pattern as solo scores).
 */

export const WINS_TO_TAKE_MATCH = 3;
export const MAX_DUEL_ROUNDS = 5;
export const DUEL_TTL_SECONDS = 7 * 24 * 60 * 60;
export const DUEL_WINS_TTL_SECONDS = 40 * 24 * 60 * 60;
export const MAX_ATTACK_COLORS = 8;

export const DUEL_REALTIME_KIND = 'duel';

export function utcMonth(now = Date.now()): string {
  const d = new Date(now);
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${d.getUTCFullYear()}-${month}`;
}

export function userKey(username: string): string {
  return username.trim().toLowerCase();
}

export function sameUser(a: string, b: string): boolean {
  return userKey(a) === userKey(b);
}

/** Accept `name`, `u/name`, or `/u/name`. Reddit names are 3–20 chars. */
export function normalizeRedditUsername(raw: string): string | null {
  let s = raw.trim();
  if (/^\/?u\//i.test(s)) s = s.replace(/^\/?u\//i, '');
  s = s.trim();
  if (!/^[A-Za-z0-9_-]{3,20}$/.test(s)) return null;
  return s;
}

export function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function clampDuelSettings(input: { width: number; viruses: number; speed: number }): {
  width: number;
  viruses: number;
  speed: number;
} {
  return {
    width: clampInt(input.width, 8, 24),
    viruses: clampInt(input.viruses, 4, 40),
    speed: clampInt(input.speed, 1, 9),
  };
}

export function duelWinsKey(month: string): string {
  return `bitdrop:duel:wins:${month}`;
}

export function duelWinsMetaKey(month: string): string {
  return `bitdrop:duel:wins:meta:${month}`;
}

/** Monthly wins against the PC. Never the human `bitdrop:duel:wins:*` set. */
export function duelBotWinsKey(month: string): string {
  return `bitdrop:duel:botwins:${month}`;
}

export function duelBotWinsMetaKey(month: string): string {
  return `bitdrop:duel:botwins:meta:${month}`;
}

/** One credit per local bot match. Separate from `bitdrop:duel:credited`. */
export function duelBotCreditKey(): string {
  return 'bitdrop:duel:botcredited';
}

/** Client id for one Play-vs-PC match. Human match ids are plain UUIDs. */
export function isBotCreditId(id: string): boolean {
  return /^bot-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export function duelInboxKey(username: string): string {
  return `bitdrop:duel:inbox:${userKey(username)}`;
}

export function duelOutboxKey(username: string): string {
  return `bitdrop:duel:outbox:${userKey(username)}`;
}

export function duelActiveKey(username: string): string {
  return `bitdrop:duel:active:${userKey(username)}`;
}

export function duelChallengeKey(id: string): string {
  return `bitdrop:duel:challenge:${id}`;
}

export function duelMatchKey(id: string): string {
  return `bitdrop:duel:match:${id}`;
}

export function duelRoundsKey(id: string): string {
  return `bitdrop:duel:rounds:${id}`;
}

export function duelReadyKey(id: string, round: number): string {
  return `bitdrop:duel:ready:${id}:${round}`;
}

export function duelAttackKey(id: string): string {
  return `bitdrop:duel:atk:${id}`;
}

/** Hash: field = match id, value = winner username. One credit per match. */
export function duelCreditKey(): string {
  return 'bitdrop:duel:credited';
}

export function duelPostIndexKey(postId: string): string {
  return `bitdrop:duel:post:${postId}`;
}

/** Sorted set of user keys waiting for a human. Score is `joinedAt` (ms). */
export function duelQueueKey(): string {
  return 'bitdrop:duel:queue';
}

export function duelSeatKey(username: string): string {
  return `bitdrop:duel:seat:${userKey(username)}`;
}

/** Hash field = user key, value = `{token}:{claimedAt}`. Pairing lock. */
export function duelPairLockKey(): string {
  return 'bitdrop:duel:pairlock';
}

/** Drop a seat if the client stops polling. The lobby refreshes this while open. */
export const QUEUE_SEAT_TTL_SECONDS = 180;
export const QUEUE_STALE_MS = QUEUE_SEAT_TTL_SECONDS * 1000;

export type QueueSeat = {
  username: string;
  width: number;
  viruses: number;
  speed: number;
  postId: string;
  joinedAt: number;
};

/** First player into the queue is the host. Their board settings are the match. */
export function earlierHost(a: QueueSeat, b: QueueSeat): { host: QueueSeat; guest: QueueSeat } {
  if (a.joinedAt !== b.joinedAt) {
    return a.joinedAt < b.joinedAt ? { host: a, guest: b } : { host: b, guest: a };
  }
  return userKey(a.username) <= userKey(b.username) ? { host: a, guest: b } : { host: b, guest: a };
}

export type DuelPhase = 'playing' | 'between' | 'complete';

export type StoredMatch = {
  id: string;
  p1: string;
  p2: string;
  width: number;
  viruses: number;
  speed: number;
  status: 'active' | 'complete';
  winner: string | null;
  forfeitWinner: string | null;
  postId: string;
  challengeId: string;
  createdAt: number;
};

export type AttackRow = {
  id: string;
  to: string;
  colors: number[];
  seq: number;
  round: number;
};

export type MatchView = {
  id: string;
  you: string;
  opponent: string;
  seat: 0 | 1;
  p1: string;
  p2: string;
  width: number;
  viruses: number;
  speed: number;
  round: number;
  wins: [number, number];
  phase: DuelPhase;
  winner: string | null;
  roundWinner: string | null;
  youReady: boolean;
  opponentReady: boolean;
  garbage: number[];
  attackIds: string[];
  /** Pending attacks still on the server, newest colors only for the open round. */
  attacks: { id: string; colors: number[] }[];
  postId: string;
};

export type ChallengeStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export type StoredChallenge = {
  id: string;
  challenger: string;
  opponent: string;
  width: number;
  viruses: number;
  speed: number;
  createdAt: number;
  postId: string;
  status: ChallengeStatus;
  matchId?: string;
  link: string;
};

export type Tally = {
  wins: [number, number];
  decided: number;
  complete: boolean;
  winner: string | null;
};

/** Consecutive round winners from round 1. Stops at the first hole. Caps at 3 wins. */
export function tallyRounds(p1: string, p2: string, roundWinners: readonly (string | null)[]): Tally {
  const wins: [number, number] = [0, 0];
  let decided = 0;
  for (const w of roundWinners) {
    if (!w) break;
    decided += 1;
    if (sameUser(w, p1)) wins[0] += 1;
    else if (sameUser(w, p2)) wins[1] += 1;
    if (wins[0] >= WINS_TO_TAKE_MATCH || wins[1] >= WINS_TO_TAKE_MATCH) break;
  }
  const winner = wins[0] >= WINS_TO_TAKE_MATCH ? p1 : wins[1] >= WINS_TO_TAKE_MATCH ? p2 : null;
  return { wins, decided, complete: winner != null, winner };
}

export function matchPhase(opts: {
  decided: number;
  complete: boolean;
  bothReady: boolean;
  forfeited: boolean;
}): DuelPhase {
  if (opts.complete || opts.forfeited) return 'complete';
  if (opts.decided === 0 || opts.bothReady) return 'playing';
  return 'between';
}

export function roundWinnerName(outcome: 'win' | 'lose', you: string, opponent: string): string {
  return outcome === 'win' ? you : opponent;
}

/** Live `type:"attack"` sends one color (0–3) per colored match-4+ line. */
export function filterAttackColors(colors: unknown): number[] {
  if (!Array.isArray(colors)) return [];
  const out: number[] = [];
  for (const c of colors) {
    if (typeof c !== 'number' || !Number.isInteger(c) || c < 0 || c > 3) continue;
    out.push(c);
    if (out.length >= MAX_ATTACK_COLORS) break;
  }
  return out;
}

export function postDeepLink(subreddit: string, postId: string, challengeId: string): string {
  const bare = postId.startsWith('t3_') ? postId.slice(3) : postId;
  const sub = subreddit.replace(/^\/?r\//i, '');
  return `https://www.reddit.com/r/${sub}/comments/${bare}/?duel=${encodeURIComponent(challengeId)}`;
}

export function rankWins(entries: { player: string; wins: number }[]): {
  player: string;
  wins: number;
  rank: number;
}[] {
  const sorted = [...entries]
    .filter((e) => e.player && Number.isFinite(e.wins) && e.wins > 0)
    .sort((a, b) => b.wins - a.wins || a.player.localeCompare(b.player));
  return sorted.map((e, i) => ({ player: e.player, wins: e.wins, rank: i + 1 }));
}

export function assembleMatchView(args: {
  match: StoredMatch;
  you: string;
  roundWinners: readonly (string | null)[];
  readyNames: readonly string[];
  attacks: readonly AttackRow[];
}): MatchView {
  const { match, you } = args;
  const seat: 0 | 1 = sameUser(you, match.p1) ? 0 : 1;
  const opponent = seat === 0 ? match.p2 : match.p1;
  const tally = tallyRounds(match.p1, match.p2, args.roundWinners);
  const forfeited = !!match.forfeitWinner;
  const complete = forfeited || tally.complete || match.status === 'complete';
  const winner = forfeited ? match.forfeitWinner : (tally.winner ?? match.winner);
  const p1Ready = args.readyNames.some((n) => sameUser(n, match.p1));
  const p2Ready = args.readyNames.some((n) => sameUser(n, match.p2));
  const phase = matchPhase({
    decided: tally.decided,
    complete,
    bothReady: p1Ready && p2Ready,
    forfeited,
  });
  const nextRound = tally.decided + 1;
  const round =
    phase === 'complete'
      ? Math.max(1, tally.decided)
      : phase === 'between'
        ? Math.max(1, tally.decided)
        : tally.decided === 0
          ? 1
          : nextRound;
  const roundWinner =
    phase === 'playing' || tally.decided === 0 ? null : (args.roundWinners[tally.decided - 1] ?? null);

  const openRound = phase === 'playing' ? round : -1;
  const pending = args.attacks
    .filter((a) => sameUser(a.to, you) && a.round === openRound)
    .slice()
    .sort((a, b) => a.seq - b.seq);
  const attacks = pending.map((a) => ({ id: a.id, colors: filterAttackColors(a.colors) }));
  const garbage = attacks.flatMap((a) => a.colors);

  return {
    id: match.id,
    you,
    opponent,
    seat,
    p1: match.p1,
    p2: match.p2,
    width: match.width,
    viruses: match.viruses,
    speed: match.speed,
    round,
    wins: tally.wins,
    phase,
    winner,
    roundWinner,
    youReady: seat === 0 ? p1Ready : p2Ready,
    opponentReady: seat === 0 ? p2Ready : p1Ready,
    garbage,
    attackIds: attacks.map((a) => a.id),
    attacks,
    postId: match.postId,
  };
}
