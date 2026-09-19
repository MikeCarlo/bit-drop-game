import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type {
  ErrorResponse,
  InitResponse,
  ScoreSubmitResponse,
  ScoresBestResponse,
  ScoresListResponse,
} from '../../shared/api';
import { SCORE_BOARD_LIMIT } from '../../shared/scores';
import { bestScore, listScores, submitScore } from '../core/leaderboard';

export const api = new Hono();

api.get('/init', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'postId is required but missing from context' },
      400,
    );
  }

  try {
    const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
    return c.json<InitResponse>({ type: 'init', postId, username });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during initialization';
    return c.json<ErrorResponse>({ status: 'error', message }, 400);
  }
});

api.get('/scores', async (c) => {
  const raw = c.req.query('limit');
  const parsed = raw ? Number(raw) : SCORE_BOARD_LIMIT;
  const limit = Number.isFinite(parsed) ? parsed : SCORE_BOARD_LIMIT;
  const scores = await listScores(limit);
  return c.json<ScoresListResponse>({ type: 'scores', scores });
});

api.get('/scores/best', async (c) => {
  const best = await bestScore();
  return c.json<ScoresBestResponse>({ type: 'best', best });
});

api.post('/scores', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json<ErrorResponse>({ status: 'error', message: 'Invalid JSON body' }, 400);
  }

  if (!body || typeof body !== 'object') {
    return c.json<ErrorResponse>({ status: 'error', message: 'Score payload required' }, 400);
  }

  const data = body as Record<string, unknown>;
  const score = Number(data.score);
  const width = Number(data.width);
  const viruses = Number(data.viruses);
  const speed = Number(data.speed);
  const playedAt = Number(data.playedAt);
  const won = data.won === true;

  if (!Number.isFinite(score) || score < 0) {
    return c.json<ErrorResponse>({ status: 'error', message: 'score must be a number' }, 400);
  }
  if (!Number.isFinite(width) || !Number.isFinite(viruses) || !Number.isFinite(speed)) {
    return c.json<ErrorResponse>({ status: 'error', message: 'settings must be numbers' }, 400);
  }

  try {
    const result = await submitScore({
      score,
      won,
      width,
      viruses,
      speed,
      playedAt: Number.isFinite(playedAt) ? playedAt : Date.now(),
      player: 'You',
      mode: 'solo',
    });
    return c.json<ScoreSubmitResponse>({ type: 'submit', ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save score';
    return c.json<ErrorResponse>({ status: 'error', message }, 400);
  }
});
