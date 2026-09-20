import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  anonymizeRecord,
  DELETED_PLAYER,
  isScoreExpired,
  normalizeAuthor,
  planBoardHygiene,
  SCORE_TTL_MS,
  shouldDropForPost,
} from './retention.ts';
import type { StoredScore } from './retention.ts';

function row(partial: Partial<StoredScore> & Pick<StoredScore, 'id' | 'player'>): StoredScore {
  return {
    score: 100,
    won: true,
    width: 10,
    viruses: 4,
    speed: 3,
    playedAt: Date.now(),
    mode: 'solo',
    ...partial,
  };
}

test('scores older than 30 days expire', () => {
  const now = 1_700_000_000_000;
  assert.equal(isScoreExpired(now, now), false);
  assert.equal(isScoreExpired(now - SCORE_TTL_MS + 1, now), false);
  assert.equal(isScoreExpired(now - SCORE_TTL_MS, now), true);
  assert.equal(isScoreExpired(0, now), true);
});

test('planBoardHygiene drops stale rows and post-scoped rows', () => {
  const now = 1_700_000_000_000;
  const rows = {
    fresh: row({ id: 'fresh', player: 'alice', playedAt: now - 1000 }),
    old: row({ id: 'old', player: 'bob', playedAt: now - SCORE_TTL_MS }),
    post: row({ id: 'post', player: 'carol', playedAt: now, postId: 't3_abc' }),
  };
  const plan = planBoardHygiene(rows, { now, postId: 't3_abc' });
  assert.deepEqual(plan.dropIds.sort(), ['old', 'post']);
  assert.deepEqual(plan.anonymizeIds, []);
  assert.ok(plan.dropBest.includes('bob'));
  assert.ok(plan.dropBest.includes('carol'));
});

test('planBoardHygiene scrubs author-identifying fields without dropping the score', () => {
  const now = 1_700_000_000_000;
  const rows = {
    a: row({ id: 'a', player: 'MikeCarlo', playedAt: now }),
    b: row({ id: 'b', player: 'other', playedAt: now }),
  };
  const plan = planBoardHygiene(rows, { now, author: 'mikecarlo' });
  assert.deepEqual(plan.dropIds, []);
  assert.deepEqual(plan.anonymizeIds, ['a']);
  assert.deepEqual(plan.dropBest, ['MikeCarlo']);
  assert.equal(anonymizeRecord(rows.a).player, DELETED_PLAYER);
  assert.equal(normalizeAuthor('[deleted]'), null);
  assert.equal(shouldDropForPost(rows.a, 't3_x'), false);
});
