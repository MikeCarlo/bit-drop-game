import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PC_NAME,
  PC_WAIT_MS,
  PC_WINS_TO_TAKE,
  buildPcView,
  isPcMatch,
  pcWaitNudge,
  settlePcRound,
} from './pcMatch.ts';

test('waiting-room nudge starts at 45s', () => {
  assert.equal(PC_WAIT_MS, 45_000);
  assert.equal(pcWaitNudge(44_999), false);
  assert.equal(pcWaitNudge(45_000), true);
});

test('PC rounds use first to 3 and never name a human winner but PC', () => {
  const mid = settlePcRound([2, 2], true);
  assert.equal(mid.phase, 'complete');
  assert.equal(mid.winner, 'You');
  assert.equal(mid.wins[0], PC_WINS_TO_TAKE);

  const pc = settlePcRound([0, 2], false);
  assert.equal(pc.phase, 'complete');
  assert.equal(pc.winner, PC_NAME);
  assert.equal(pc.roundWinner, PC_NAME);
  assert.notEqual(pc.winner, 'some_redditor');
});

test('PC view is not a server match', () => {
  const view = buildPcView({
    settings: { width: 10, viruses: 4, speed: 3 },
    wins: [1, 0],
    round: 2,
    phase: 'between',
    roundWinner: 'You',
    winner: null,
  });
  assert.equal(isPcMatch(view), true);
  assert.equal(isPcMatch({ id: 'abc', opponent: 'PC' }), false);
  assert.equal(view.postId, '');
  assert.equal(view.opponentReady, true);
  assert.deepEqual(view.attacks, []);
});
