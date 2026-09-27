import { Hono } from 'hono';
import type { ErrorResponse } from '../../shared/api';
import { DuelError } from '../core/duel';
import {
  acceptChallenge,
  ackAttacks,
  attack,
  cancelChallenge,
  createChallenge,
  declineChallenge,
  duelState,
  forfeit,
  getMatch,
  joinQueue,
  leaveQueue,
  listWins,
  readyNext,
  reportRound,
} from '../core/duel';

export const duel = new Hono();

function fail(error: unknown) {
  if (error instanceof DuelError) {
    return { status: error.status as 400 | 401 | 403 | 404 | 409, body: { status: 'error' as const, message: error.message } };
  }
  const message = error instanceof Error ? error.message : 'Duel request failed';
  return { status: 400 as const, body: { status: 'error' as const, message } };
}

duel.get('/state', async (c) => {
  try {
    return c.json(await duelState());
  } catch (error) {
    const f = fail(error);
    return c.json<ErrorResponse>(f.body, f.status);
  }
});

duel.get('/wins', async (c) => {
  try {
    const raw = c.req.query('limit');
    const parsed = raw ? Number(raw) : 10;
    return c.json(await listWins(Number.isFinite(parsed) ? parsed : 10));
  } catch (error) {
    const f = fail(error);
    return c.json<ErrorResponse>(f.body, f.status);
  }
});

duel.post('/queue', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    return c.json(await joinQueue(body as Record<string, unknown>));
  } catch (error) {
    const f = fail(error);
    return c.json<ErrorResponse>(f.body, f.status);
  }
});

duel.post('/queue/leave', async (c) => {
  try {
    return c.json(await leaveQueue());
  } catch (error) {
    const f = fail(error);
    return c.json<ErrorResponse>(f.body, f.status);
  }
});

duel.post('/challenge', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    return c.json(await createChallenge(body as Record<string, unknown>));
  } catch (error) {
    const f = fail(error);
    return c.json<ErrorResponse>(f.body, f.status);
  }
});

duel.post('/challenge/:id/accept', async (c) => {
  try {
    return c.json(await acceptChallenge(c.req.param('id')));
  } catch (error) {
    const f = fail(error);
    return c.json<ErrorResponse>(f.body, f.status);
  }
});

duel.post('/challenge/:id/decline', async (c) => {
  try {
    await declineChallenge(c.req.param('id'));
    return c.json({ ok: true as const });
  } catch (error) {
    const f = fail(error);
    return c.json<ErrorResponse>(f.body, f.status);
  }
});

duel.post('/challenge/:id/cancel', async (c) => {
  try {
    await cancelChallenge(c.req.param('id'));
    return c.json({ ok: true as const });
  } catch (error) {
    const f = fail(error);
    return c.json<ErrorResponse>(f.body, f.status);
  }
});

duel.get('/match/:id', async (c) => {
  try {
    return c.json(await getMatch(c.req.param('id')));
  } catch (error) {
    const f = fail(error);
    return c.json<ErrorResponse>(f.body, f.status);
  }
});

duel.post('/match/:id/attack', async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    await attack(c.req.param('id'), body);
    return c.json({ ok: true as const });
  } catch (error) {
    const f = fail(error);
    return c.json<ErrorResponse>(f.body, f.status);
  }
});

duel.post('/match/:id/round', async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    return c.json(await reportRound(c.req.param('id'), body));
  } catch (error) {
    const f = fail(error);
    return c.json<ErrorResponse>(f.body, f.status);
  }
});

duel.post('/match/:id/ready', async (c) => {
  try {
    return c.json(await readyNext(c.req.param('id')));
  } catch (error) {
    const f = fail(error);
    return c.json<ErrorResponse>(f.body, f.status);
  }
});

duel.post('/match/:id/forfeit', async (c) => {
  try {
    return c.json(await forfeit(c.req.param('id')));
  } catch (error) {
    const f = fail(error);
    return c.json<ErrorResponse>(f.body, f.status);
  }
});

duel.post('/match/:id/ack', async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as { ids?: unknown };
    await ackAttacks(c.req.param('id'), body.ids);
    return c.json({ ok: true as const });
  } catch (error) {
    const f = fail(error);
    return c.json<ErrorResponse>(f.body, f.status);
  }
});
