import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PC_NAME,
  PC_WAIT_MS,
  PC_WINS_TO_TAKE,
  botSkillLabel,
  buildPcView,
  formatWait,
  isPcMatch,
  pcWaitNudge,
  rollBotSkill,
  settlePcRound,
} from './pcMatch.ts';

test('bot skill is a uniform roll from 1 to 10', () => {
  assert.equal(rollBotSkill(() => 0), 1);
  assert.equal(rollBotSkill(() => 0.999), 10);
  assert.equal(rollBotSkill(() => 1), 10);
  const seen = new Set<number>();
  for (let i = 0; i < 10; i++) seen.add(rollBotSkill(() => i / 10));
  assert.deepEqual([...seen].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(botSkillLabel(7), 'BOT · SKILL 7');
  assert.equal(botSkillLabel(0), 'BOT · SKILL 1');
  assert.equal(botSkillLabel(12), 'BOT · SKILL 10');
});

test('lobby timer prints elapsed minutes and seconds', () => {
  assert.equal(formatWait(0), '0:00');
  assert.equal(formatWait(12_400), '0:12');
  assert.equal(formatWait(75_000), '1:15');
});

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
  assert.equal(isPcMatch({ id: 'bot-3f1c2a90-7b14-4c2e-9a11-0c5d6e7f8091' }), true);
  assert.equal(view.postId, '');
  assert.equal(view.opponentReady, true);
  assert.deepEqual(view.attacks, []);
});
