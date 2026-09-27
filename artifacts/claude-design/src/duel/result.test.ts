import assert from 'node:assert/strict';
import { test } from 'node:test';
import { facedLabel, formatSetScore, outcomeTitle, yourSetScore } from './result.ts';

test('set score is your rounds first', () => {
  assert.deepEqual(yourSetScore(0, [3, 1]), [3, 1]);
  assert.deepEqual(yourSetScore(1, [1, 3]), [3, 1]);
  assert.equal(formatSetScore(3, 1), '3–1');
  assert.equal(formatSetScore(1, 3), '1–3');
});

test('match outcome is YOU WIN or YOU LOSE', () => {
  assert.equal(outcomeTitle(true), 'YOU WIN');
  assert.equal(outcomeTitle(false), 'YOU LOSE');
});

test('faced label is a username or the bot skill', () => {
  assert.equal(facedLabel(false, 'ada_reddit', 0), 'ada_reddit');
  assert.equal(facedLabel(true, 'PC', 7), 'BOT · SKILL 7');
  assert.equal(facedLabel(true, 'PC', 0), 'BOT');
});
