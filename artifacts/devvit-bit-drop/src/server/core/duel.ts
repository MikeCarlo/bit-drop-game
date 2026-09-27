import { context, realtime, redis, reddit } from '@devvit/web/server';
import {
  assembleMatchView,
  clampDuelSettings,
  earlierHost,
  DUEL_REALTIME_KIND,
  DUEL_TTL_SECONDS,
  DUEL_WINS_TTL_SECONDS,
  duelActiveKey,
  duelAttackKey,
  duelChallengeKey,
  duelCreditKey,
  duelInboxKey,
  duelMatchKey,
  duelOutboxKey,
  duelPairLockKey,
  duelPostIndexKey,
  duelQueueKey,
  duelSeatKey,
  duelReadyKey,
  duelRoundsKey,
  duelWinsKey,
  duelWinsMetaKey,
  filterAttackColors,
  MAX_DUEL_ROUNDS,
  normalizeRedditUsername,
  postDeepLink,
  QUEUE_SEAT_TTL_SECONDS,
  QUEUE_STALE_MS,
  rankWins,
  roundWinnerName,
  sameUser,
  tallyRounds,
  utcMonth,
  userKey,
  type AttackRow,
  type MatchView,
  type QueueSeat,
  type StoredChallenge,
  type StoredMatch,
} from '../../shared/duel';

export class DuelError extends Error {
  status: 400 | 401 | 403 | 404 | 409;
  constructor(message: string, status: 400 | 401 | 403 | 404 | 409 = 400) {
    super(message);
    this.name = 'DuelError';
    this.status = status;
  }
}

export type ChallengeView = StoredChallenge & { incoming: boolean };

export type QueueStatus = {
  joinedAt: number;
  waitedMs: number;
};

export type DuelStateResponse = {
  username: string;
  postId: string;
  inbox: ChallengeView[];
  outbox: ChallengeView[];
  active: MatchView | null;
  queue: QueueStatus | null;
};

export type QueueJoinResponse = {
  queue: QueueStatus | null;
  match: MatchView | null;
};

export type WinsResponse = {
  month: string;
  rows: { player: string; wins: number; rank: number }[];
};

function asRecord(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

async function claimField(key: string, field: string, value: string): Promise<boolean> {
  const result = (await redis.hSetNX(key, field, value)) as unknown;
  return result === true;
}

function parseChallenge(raw: string | undefined): StoredChallenge | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredChallenge;
    if (!parsed?.id || !parsed.challenger || !parsed.opponent) return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseMatch(raw: string | undefined): StoredMatch | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredMatch;
    if (!parsed?.id || !parsed.p1 || !parsed.p2) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function identity(): Promise<string> {
  const name = await reddit.getCurrentUsername();
  if (!name) throw new DuelError('Sign in to Reddit to duel', 401);
  return name;
}

async function touch(key: string, seconds = DUEL_TTL_SECONDS): Promise<void> {
  await redis.expire(key, seconds);
}

async function writeChallenge(ch: StoredChallenge): Promise<void> {
  const json = JSON.stringify(ch);
  await redis.set(duelChallengeKey(ch.id), json);
  await touch(duelChallengeKey(ch.id));
  await redis.hSet(duelInboxKey(ch.opponent), { [ch.id]: json });
  await redis.hSet(duelOutboxKey(ch.challenger), { [ch.id]: json });
  await touch(duelInboxKey(ch.opponent));
  await touch(duelOutboxKey(ch.challenger));
  if (ch.postId) {
    await redis.hSet(duelPostIndexKey(ch.postId), { [ch.id]: 'challenge' });
    await touch(duelPostIndexKey(ch.postId));
  }
}

async function removeChallengeBuckets(ch: StoredChallenge): Promise<void> {
  await redis.hDel(duelInboxKey(ch.opponent), [ch.id]);
  await redis.hDel(duelOutboxKey(ch.challenger), [ch.id]);
}

async function readChallenge(id: string): Promise<StoredChallenge | null> {
  const raw = await redis.get(duelChallengeKey(id));
  return parseChallenge(raw);
}

async function listPending(key: string): Promise<StoredChallenge[]> {
  const raw = asRecord(await redis.hGetAll(key));
  const out: StoredChallenge[] = [];
  for (const value of Object.values(raw)) {
    const ch = parseChallenge(value);
    if (ch?.status === 'pending') out.push(ch);
  }
  out.sort((a, b) => b.createdAt - a.createdAt);
  return out;
}

function toChallengeView(ch: StoredChallenge, you: string): ChallengeView {
  return { ...ch, incoming: sameUser(ch.opponent, you) };
}

async function readMatch(id: string): Promise<StoredMatch | null> {
  return parseMatch(await redis.get(duelMatchKey(id)));
}

async function writeMatch(match: StoredMatch): Promise<void> {
  await redis.set(duelMatchKey(match.id), JSON.stringify(match));
  await touch(duelMatchKey(match.id));
  if (match.postId) {
    await redis.hSet(duelPostIndexKey(match.postId), { [match.id]: 'match' });
    await touch(duelPostIndexKey(match.postId));
  }
}

async function activeMatch(username: string): Promise<StoredMatch | null> {
  const id = await redis.get(duelActiveKey(username));
  if (!id) return null;
  const match = await readMatch(id);
  if (!match || match.status !== 'active') {
    await redis.del(duelActiveKey(username));
    return null;
  }
  return match;
}

async function setActive(username: string, matchId: string): Promise<void> {
  await redis.set(duelActiveKey(username), matchId);
  await touch(duelActiveKey(username));
}

async function clearActive(match: StoredMatch): Promise<void> {
  const p1 = await redis.get(duelActiveKey(match.p1));
  const p2 = await redis.get(duelActiveKey(match.p2));
  if (p1 === match.id) await redis.del(duelActiveKey(match.p1));
  if (p2 === match.id) await redis.del(duelActiveKey(match.p2));
}

async function roundWinners(matchId: string): Promise<(string | null)[]> {
  const raw = asRecord(await redis.hGetAll(duelRoundsKey(matchId)));
  const winners: (string | null)[] = [];
  for (let round = 1; round <= MAX_DUEL_ROUNDS; round++) {
    const winner = raw[String(round)];
    if (!winner) break;
    winners.push(winner);
  }
  return winners;
}

async function readyNames(matchId: string, round: number): Promise<string[]> {
  const raw = asRecord(await redis.hGetAll(duelReadyKey(matchId, round)));
  return Object.keys(raw);
}

async function attackRows(matchId: string): Promise<AttackRow[]> {
  const raw = asRecord(await redis.hGetAll(duelAttackKey(matchId)));
  const rows: AttackRow[] = [];
  for (const [id, value] of Object.entries(raw)) {
    try {
      const parsed = JSON.parse(value) as Partial<AttackRow>;
      rows.push({
        id,
        to: typeof parsed.to === 'string' ? parsed.to : '',
        colors: filterAttackColors(parsed.colors),
        seq: typeof parsed.seq === 'number' ? parsed.seq : 0,
        round: typeof parsed.round === 'number' ? parsed.round : 0,
      });
    } catch {
      /* skip corrupt attack */
    }
  }
  return rows;
}

async function viewFor(match: StoredMatch, you: string): Promise<MatchView> {
  const winners = await roundWinners(match.id);
  const tally = tallyRounds(match.p1, match.p2, winners);
  const readyRound = tally.decided + 1;
  return assembleMatchView({
    match,
    you,
    roundWinners: winners,
    readyNames: await readyNames(match.id, readyRound),
    attacks: await attackRows(match.id),
  });
}

async function publish(match: StoredMatch): Promise<void> {
  if (!match.postId) return;
  try {
    await realtime.send(match.postId, { kind: DUEL_REALTIME_KIND, matchId: match.id });
  } catch (error) {
    console.error('duel realtime unavailable', error);
  }
}

async function creditWin(matchId: string, winner: string): Promise<void> {
  const fresh = await claimField(duelCreditKey(), matchId, winner);
  await touch(duelCreditKey(), DUEL_WINS_TTL_SECONDS);
  if (!fresh) return;
  const month = utcMonth();
  await redis.zIncrBy(duelWinsKey(month), winner, 1);
  await redis.expire(duelWinsKey(month), DUEL_WINS_TTL_SECONDS);
  await redis.hSet(duelWinsMetaKey(month), { [winner]: JSON.stringify({ lastWinAt: Date.now() }) });
  await redis.expire(duelWinsMetaKey(month), DUEL_WINS_TTL_SECONDS);
}

async function finishIfNeeded(match: StoredMatch, view: MatchView): Promise<StoredMatch> {
  if (match.status === 'complete') return match;
  if (view.phase !== 'complete' || !view.winner) return match;
  const next: StoredMatch = { ...match, status: 'complete', winner: view.winner };
  await writeMatch(next);
  await clearActive(next);
  await redis.del(duelAttackKey(next.id));
  await creditWin(next.id, view.winner);
  return next;
}

async function requireMatch(id: string, you: string): Promise<{ match: StoredMatch; view: MatchView }> {
  const match = await readMatch(id);
  if (!match) throw new DuelError('Duel not found', 404);
  if (!sameUser(match.p1, you) && !sameUser(match.p2, you)) {
    throw new DuelError('You are not in this duel', 403);
  }
  const view = await viewFor(match, you);
  return { match, view };
}

function postIdOrThrow(): string {
  const postId = context.postId;
  if (!postId) throw new DuelError('Open a BIT·DROP post to duel');
  return postId;
}

async function resolveOpponent(raw: string, me: string): Promise<string> {
  const normalized = normalizeRedditUsername(raw);
  if (!normalized) throw new DuelError('Enter a Reddit username (3–20 letters, numbers, _ or -)');
  if (sameUser(normalized, me)) throw new DuelError('You cannot duel yourself');
  let user: { username?: string } | undefined;
  try {
    user = await reddit.getUserByUsername(normalized);
  } catch {
    user = undefined;
  }
  if (!user?.username) throw new DuelError(`No Reddit user named ${normalized}`);
  if (sameUser(user.username, me)) throw new DuelError('You cannot duel yourself');
  return user.username;
}

function parseSeat(raw: string | undefined): QueueSeat | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as QueueSeat;
    if (!parsed?.username || !Number.isFinite(parsed.joinedAt)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function readSeat(username: string): Promise<QueueSeat | null> {
  return parseSeat(await redis.get(duelSeatKey(username)));
}

async function writeSeat(seat: QueueSeat): Promise<void> {
  const key = duelSeatKey(seat.username);
  await redis.set(key, JSON.stringify(seat));
  await redis.expire(key, QUEUE_SEAT_TTL_SECONDS);
}

async function dropSeat(username: string): Promise<void> {
  await redis.zRem(duelQueueKey(), [userKey(username)]);
  await redis.del(duelSeatKey(username));
}

function asZMembers(raw: unknown): { member: string; score: number }[] {
  if (!Array.isArray(raw)) return [];
  const out: { member: string; score: number }[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object' || !('member' in row)) continue;
    const member = String((row as { member: unknown }).member ?? '');
    const score = Number((row as { score: unknown }).score);
    if (!member) continue;
    out.push({ member, score: Number.isFinite(score) ? score : 0 });
  }
  return out;
}

async function claimSeat(user: string, token: string): Promise<boolean> {
  const field = userKey(user);
  const value = `${token}:${Date.now()}`;
  if (await claimField(duelPairLockKey(), field, value)) return true;
  const existing = await redis.hGet(duelPairLockKey(), field);
  const ts = Number(String(existing ?? '').split(':').pop());
  if (!Number.isFinite(ts) || Date.now() - ts < 15_000) return false;
  await redis.hDel(duelPairLockKey(), [field]);
  return claimField(duelPairLockKey(), field, `${token}:${Date.now()}`);
}

async function releaseClaims(token: string, users: string[]): Promise<void> {
  for (const user of users) {
    const field = userKey(user);
    const cur = await redis.hGet(duelPairLockKey(), field);
    if (typeof cur === 'string' && cur.startsWith(`${token}:`)) {
      await redis.hDel(duelPairLockKey(), [field]);
    }
  }
}

async function publishPosts(postIds: string[], matchId: string): Promise<void> {
  const seen = new Set<string>();
  for (const postId of postIds) {
    if (!postId || seen.has(postId)) continue;
    seen.add(postId);
    try {
      await realtime.send(postId, { kind: DUEL_REALTIME_KIND, matchId });
    } catch (error) {
      console.error('duel realtime unavailable', error);
    }
  }
}

function queueStatus(seat: QueueSeat, now = Date.now()): QueueStatus {
  return { joinedAt: seat.joinedAt, waitedMs: Math.max(0, now - seat.joinedAt) };
}

/** Pair `you` with the oldest other open seat. Host is whoever queued first. */
async function tryPair(you: string): Promise<StoredMatch | null> {
  const existing = await activeMatch(you);
  if (existing) {
    await dropSeat(you);
    return existing;
  }
  const mine = await readSeat(you);
  if (!mine) return null;

  const waiting = asZMembers(await redis.zRange(duelQueueKey(), 0, 24, { by: 'rank' }));
  const now = Date.now();
  for (const row of waiting) {
    if (row.member === userKey(you)) continue;
    if (now - row.score > QUEUE_STALE_MS) {
      await redis.zRem(duelQueueKey(), [row.member]);
      await redis.del(duelSeatKey(row.member));
      continue;
    }
    const other = await readSeat(row.member);
    if (!other) {
      await redis.zRem(duelQueueKey(), [row.member]);
      continue;
    }
    if (await activeMatch(other.username)) {
      await dropSeat(other.username);
      continue;
    }
    const token = crypto.randomUUID();
    const ordered = [userKey(you), userKey(other.username)].sort();
    const gotFirst = await claimSeat(ordered[0]!, token);
    if (!gotFirst) continue;
    const gotSecond = await claimSeat(ordered[1]!, token);
    if (!gotSecond) {
      await releaseClaims(token, [ordered[0]!]);
      continue;
    }
    const freshYou = await readSeat(you);
    const freshOther = await readSeat(other.username);
    if (!freshYou || !freshOther || (await activeMatch(you)) || (await activeMatch(other.username))) {
      await releaseClaims(token, [you, other.username]);
      continue;
    }
    const { host, guest } = earlierHost(freshYou, freshOther);
    const match: StoredMatch = {
      id: crypto.randomUUID(),
      p1: host.username,
      p2: guest.username,
      width: host.width,
      viruses: host.viruses,
      speed: host.speed,
      status: 'active',
      winner: null,
      forfeitWinner: null,
      postId: host.postId,
      challengeId: 'queue',
      createdAt: Date.now(),
    };
    await writeMatch(match);
    if (guest.postId && guest.postId !== host.postId) {
      await redis.hSet(duelPostIndexKey(guest.postId), { [match.id]: 'match' });
      await touch(duelPostIndexKey(guest.postId));
    }
    await dropSeat(host.username);
    await dropSeat(guest.username);
    await setActive(host.username, match.id);
    await setActive(guest.username, match.id);
    await releaseClaims(token, [host.username, guest.username]);
    await publishPosts([host.postId, guest.postId], match.id);
    return match;
  }
  return null;
}

async function loadActiveView(you: string): Promise<MatchView | null> {
  const activeId = await redis.get(duelActiveKey(you));
  if (!activeId) return null;
  const match = await readMatch(activeId);
  if (!match || match.status === 'complete') {
    await redis.del(duelActiveKey(you));
    return null;
  }
  return viewFor(match, you);
}

export async function duelState(): Promise<DuelStateResponse> {
  const you = await identity();
  const postId = context.postId ?? '';
  const inbox = (await listPending(duelInboxKey(you))).map((ch) => toChallengeView(ch, you));
  const outbox = (await listPending(duelOutboxKey(you))).map((ch) => toChallengeView(ch, you));
  let active = await loadActiveView(you);
  let queue: QueueStatus | null = null;
  if (!active) {
    const paired = await tryPair(you);
    if (paired) active = await viewFor(paired, you);
  }
  if (!active) {
    const seat = await readSeat(you);
    if (seat) {
      await redis.expire(duelSeatKey(you), QUEUE_SEAT_TTL_SECONDS);
      queue = queueStatus(seat);
    }
  }
  return { username: you, postId, inbox, outbox, active, queue };
}

export async function joinQueue(body: {
  width?: unknown;
  viruses?: unknown;
  speed?: unknown;
}): Promise<QueueJoinResponse> {
  const you = await identity();
  const postId = postIdOrThrow();
  const already = await activeMatch(you);
  if (already) {
    await dropSeat(you);
    return { queue: null, match: await viewFor(already, you) };
  }
  const settings = clampDuelSettings({
    width: Number(body.width),
    viruses: Number(body.viruses),
    speed: Number(body.speed),
  });
  const previous = await readSeat(you);
  const seat: QueueSeat = previous ?? {
    username: you,
    ...settings,
    postId,
    joinedAt: Date.now(),
  };
  await writeSeat(seat);
  await redis.zAdd(duelQueueKey(), { member: userKey(you), score: seat.joinedAt });
  const paired = await tryPair(you);
  if (paired) return { queue: null, match: await viewFor(paired, you) };
  const fresh = (await readSeat(you)) ?? seat;
  return { queue: queueStatus(fresh), match: null };
}

export async function leaveQueue(): Promise<QueueJoinResponse> {
  const you = await identity();
  const before = await activeMatch(you);
  if (before) return { queue: null, match: await viewFor(before, you) };
  await dropSeat(you);
  const after = await activeMatch(you);
  if (after) return { queue: null, match: await viewFor(after, you) };
  return { queue: null, match: null };
}

export async function createChallenge(body: {
  opponent?: unknown;
  width?: unknown;
  viruses?: unknown;
  speed?: unknown;
}): Promise<ChallengeView> {
  const you = await identity();
  const postId = postIdOrThrow();
  if (await activeMatch(you)) throw new DuelError('Finish your current duel first');
  const opponent = await resolveOpponent(typeof body.opponent === 'string' ? body.opponent : '', you);
  const settings = clampDuelSettings({
    width: Number(body.width),
    viruses: Number(body.viruses),
    speed: Number(body.speed),
  });
  const pending = await listPending(duelOutboxKey(you));
  const existing = pending.find((ch) => sameUser(ch.opponent, opponent));
  if (existing) return toChallengeView(existing, you);

  const subreddit = context.subredditName ?? 'BitDropGame';
  const id = crypto.randomUUID();
  const challenge: StoredChallenge = {
    id,
    challenger: you,
    opponent,
    ...settings,
    createdAt: Date.now(),
    postId,
    status: 'pending',
    link: postDeepLink(subreddit, postId, id),
  };
  await writeChallenge(challenge);
  return toChallengeView(challenge, you);
}

export async function acceptChallenge(id: string): Promise<MatchView> {
  const you = await identity();
  const challenge = await readChallenge(id);
  if (!challenge || challenge.status !== 'pending') throw new DuelError('That challenge is no longer open', 404);
  if (!sameUser(challenge.opponent, you)) throw new DuelError('This challenge is for someone else', 403);
  if ((await activeMatch(you)) || (await activeMatch(challenge.challenger))) {
    throw new DuelError('One of you is already in a duel');
  }

  const match: StoredMatch = {
    id: crypto.randomUUID(),
    p1: challenge.challenger,
    p2: you,
    width: challenge.width,
    viruses: challenge.viruses,
    speed: challenge.speed,
    status: 'active',
    winner: null,
    forfeitWinner: null,
    postId: challenge.postId,
    challengeId: challenge.id,
    createdAt: Date.now(),
  };
  const accepted: StoredChallenge = { ...challenge, status: 'accepted', matchId: match.id };
  await writeMatch(match);
  await writeChallenge(accepted);
  await removeChallengeBuckets(accepted);
  await setActive(match.p1, match.id);
  await setActive(match.p2, match.id);
  await publish(match);
  return viewFor(match, you);
}

export async function declineChallenge(id: string): Promise<void> {
  const you = await identity();
  const challenge = await readChallenge(id);
  if (!challenge || challenge.status !== 'pending') return;
  if (!sameUser(challenge.opponent, you)) throw new DuelError('This challenge is for someone else', 403);
  await writeChallenge({ ...challenge, status: 'declined' });
  await removeChallengeBuckets(challenge);
}

export async function cancelChallenge(id: string): Promise<void> {
  const you = await identity();
  const challenge = await readChallenge(id);
  if (!challenge || challenge.status !== 'pending') return;
  if (!sameUser(challenge.challenger, you)) throw new DuelError('Only the challenger can cancel', 403);
  await writeChallenge({ ...challenge, status: 'cancelled' });
  await removeChallengeBuckets(challenge);
}

export async function getMatch(id: string): Promise<MatchView> {
  const you = await identity();
  const { view } = await requireMatch(id, you);
  return view;
}

export async function attack(id: string, body: { attackId?: unknown; round?: unknown; colors?: unknown }): Promise<void> {
  const you = await identity();
  const { match, view } = await requireMatch(id, you);
  if (view.phase !== 'playing') return;
  const round = Number(body.round);
  if (round !== view.round) return;
  const colors = filterAttackColors(body.colors);
  if (!colors.length) return;
  const attackId = typeof body.attackId === 'string' ? body.attackId.trim() : '';
  if (!/^[A-Za-z0-9:_-]{8,80}$/.test(attackId)) throw new DuelError('Bad attack id');
  const seq = Number(await redis.incrBy(`bitdrop:duel:atkseq:${match.id}`, 1)) || Date.now();
  await touch(`bitdrop:duel:atkseq:${match.id}`);
  const to = sameUser(you, match.p1) ? match.p2 : match.p1;
  const claimed = await claimField(
    duelAttackKey(match.id),
    attackId,
    JSON.stringify({ to, colors, seq, round }),
  );
  await touch(duelAttackKey(match.id));
  if (claimed) await publish(match);
}

export async function reportRound(
  id: string,
  body: { round?: unknown; outcome?: unknown },
): Promise<MatchView> {
  const you = await identity();
  let { match, view } = await requireMatch(id, you);
  if (view.phase === 'complete') return view;
  if (view.phase !== 'playing') return view;
  const round = Number(body.round);
  if (round !== view.round) return view;
  const outcome = body.outcome === 'win' || body.outcome === 'lose' ? body.outcome : null;
  if (!outcome) throw new DuelError('outcome must be win or lose');
  const opponent = sameUser(you, match.p1) ? match.p2 : match.p1;
  const winner = roundWinnerName(outcome, you, opponent);
  await claimField(duelRoundsKey(match.id), String(round), winner);
  await touch(duelRoundsKey(match.id));
  await redis.del(duelAttackKey(match.id));
  view = await viewFor(match, you);
  match = await finishIfNeeded(match, view);
  if (match.status === 'complete') view = await viewFor(match, you);
  await publish(match);
  return view;
}

export async function readyNext(id: string): Promise<MatchView> {
  const you = await identity();
  const { match, view } = await requireMatch(id, you);
  if (view.phase !== 'between') return view;
  const nextRound = view.round + 1;
  await redis.hSet(duelReadyKey(match.id, nextRound), { [you]: '1' });
  await touch(duelReadyKey(match.id, nextRound));
  await publish(match);
  return viewFor(match, you);
}

export async function forfeit(id: string): Promise<MatchView> {
  const you = await identity();
  let { match, view } = await requireMatch(id, you);
  if (view.phase === 'complete') return view;
  const opponent = sameUser(you, match.p1) ? match.p2 : match.p1;
  match = { ...match, status: 'complete', winner: opponent, forfeitWinner: opponent };
  await writeMatch(match);
  await clearActive(match);
  await redis.del(duelAttackKey(match.id));
  await creditWin(match.id, opponent);
  await publish(match);
  return viewFor(match, you);
}

export async function ackAttacks(id: string, ids: unknown): Promise<void> {
  const you = await identity();
  await requireMatch(id, you);
  if (!Array.isArray(ids)) return;
  const fields = ids.filter((v): v is string => typeof v === 'string' && v.length > 0).slice(0, 40);
  if (!fields.length) return;
  await redis.hDel(duelAttackKey(id), fields);
}

export async function listWins(limit = 10): Promise<WinsResponse> {
  const month = utcMonth();
  const key = duelWinsKey(month);
  const cap = Math.max(1, Math.min(limit, 20));
  const ranked = (await redis.zRange(key, 0, 49, { reverse: true, by: 'rank' })) as unknown as {
    member: string;
    score: number;
  }[];
  const rows = rankWins(
    (Array.isArray(ranked) ? ranked : []).map((row) => ({
      player: row.member,
      wins: Number(row.score),
    })),
  );
  return { month, rows: rows.slice(0, cap) };
}

export async function scrubDuelPost(postId: string | undefined): Promise<number> {
  if (!postId) return 0;
  const index = asRecord(await redis.hGetAll(duelPostIndexKey(postId)));
  let n = 0;
  for (const [id, kind] of Object.entries(index)) {
    if (kind === 'match') {
      const match = await readMatch(id);
      if (match) await clearActive(match);
      await redis.del(duelMatchKey(id), duelRoundsKey(id), duelAttackKey(id));
      for (let round = 1; round <= MAX_DUEL_ROUNDS + 1; round++) {
        await redis.del(duelReadyKey(id, round));
      }
      n += 1;
    } else if (kind === 'challenge') {
      const challenge = await readChallenge(id);
      if (challenge) await removeChallengeBuckets(challenge);
      await redis.del(duelChallengeKey(id));
      n += 1;
    }
  }
  await redis.del(duelPostIndexKey(postId));
  const waiting = asZMembers(await redis.zRange(duelQueueKey(), 0, 200, { by: 'rank' }));
  for (const row of waiting) {
    const seat = await readSeat(row.member);
    if (seat?.postId === postId) {
      await dropSeat(seat.username);
      n += 1;
    }
  }
  return n;
}
