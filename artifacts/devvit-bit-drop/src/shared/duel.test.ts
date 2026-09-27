import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assembleMatchView,
  clampDuelSettings,
  duelWinsKey,
  filterAttackColors,
  matchPhase,
  normalizeRedditUsername,
  postDeepLink,
  rankWins,
  roundWinnerName,
  sameUser,
  tallyRounds,
  utcMonth,
  WINS_TO_TAKE_MATCH,
  type StoredMatch,
} from './duel.ts';

const baseMatch = (): StoredMatch => ({
  id: 'm1',
  p1: 'Alpha',
  p2: 'Beta',
  width: 10,
  viruses: 8,
  speed: 4,
  status: 'active',
  winner: null,
  forfeitWinner: null,
  postId: 't3_abc',
  challengeId: 'c1',
  createdAt: 1,
});

test('UTC month key rolls on the UTC boundary', () => {
  assert.equal(utcMonth(Date.UTC(2026, 8, 30, 23, 59)), '2026-09');
  assert.equal(utcMonth(Date.UTC(2026, 9, 1, 0, 0)), '2026-10');
  assert.equal(duelWinsKey('2026-09'), 'bitdrop:duel:wins:2026-09');
  assert.notEqual(duelWinsKey('2026-09'), 'bitdrop:board');
});

test('username normalize strips u/ and rejects junk', () => {
  assert.equal(normalizeRedditUsername('  u/Mike_Carlo '), 'Mike_Carlo');
  assert.equal(normalizeRedditUsername('/u/abc'), 'abc');
  assert.equal(normalizeRedditUsername('no'), null);
  assert.equal(normalizeRedditUsername('has space'), null);
  assert.equal(sameUser('Alpha', 'alpha'), true);
});

test('settings clamp to the solo slider ranges', () => {
  assert.deepEqual(clampDuelSettings({ width: 99, viruses: 1, speed: 0 }), {
    width: 24,
    viruses: 4,
    speed: 1,
  });
});

test('first to 3 round wins ends the match', () => {
  const early = tallyRounds('Alpha', 'Beta', ['Alpha', 'Beta', 'Alpha']);
  assert.equal(early.complete, false);
  assert.deepEqual(early.wins, [2, 1]);
  const done = tallyRounds('Alpha', 'Beta', ['Alpha', 'Alpha', 'Beta', 'Alpha']);
  assert.equal(done.complete, true);
  assert.equal(done.winner, 'Alpha');
  assert.equal(done.wins[0], WINS_TO_TAKE_MATCH);
  assert.equal(done.decided, 4);
});

test('round report maps a loss onto the opponent', () => {
  assert.equal(roundWinnerName('win', 'Alpha', 'Beta'), 'Alpha');
  assert.equal(roundWinnerName('lose', 'Alpha', 'Beta'), 'Beta');
});

test('attack colors keep live 0–3 garbage and drop rainbow ids', () => {
  assert.deepEqual(filterAttackColors([0, 1, 4, 2, -1, 1.5, 3]), [0, 1, 2, 3]);
  assert.deepEqual(filterAttackColors('nope'), []);
});

test('phase: round 1 plays, then wait, then both ready', () => {
  assert.equal(matchPhase({ decided: 0, complete: false, bothReady: false, forfeited: false }), 'playing');
  assert.equal(matchPhase({ decided: 1, complete: false, bothReady: false, forfeited: false }), 'between');
  assert.equal(matchPhase({ decided: 1, complete: false, bothReady: true, forfeited: false }), 'playing');
  assert.equal(matchPhase({ decided: 1, complete: false, bothReady: false, forfeited: true }), 'complete');
});

test('assemble view seats, garbage, and forfeit', () => {
  const playing = assembleMatchView({
    match: baseMatch(),
    you: 'beta',
    roundWinners: [],
    readyNames: [],
    attacks: [
      { id: 'a2', to: 'Beta', colors: [1, 9], seq: 2, round: 1 },
      { id: 'a1', to: 'Beta', colors: [0], seq: 1, round: 1 },
      { id: 'old', to: 'Beta', colors: [3], seq: 0, round: 2 },
      { id: 'them', to: 'Alpha', colors: [2], seq: 3, round: 1 },
    ],
  });
  assert.equal(playing.seat, 1);
  assert.equal(playing.opponent, 'Alpha');
  assert.equal(playing.phase, 'playing');
  assert.equal(playing.round, 1);
  assert.deepEqual(playing.garbage, [0, 1]);
  assert.deepEqual(playing.attackIds, ['a1', 'a2']);

  const between = assembleMatchView({
    match: baseMatch(),
    you: 'Alpha',
    roundWinners: ['Beta'],
    readyNames: ['Alpha'],
    attacks: [],
  });
  assert.equal(between.phase, 'between');
  assert.equal(between.roundWinner, 'Beta');
  assert.deepEqual(between.wins, [0, 1]);
  assert.equal(between.youReady, true);
  assert.equal(between.opponentReady, false);
  assert.deepEqual(between.garbage, []);

  const next = assembleMatchView({
    match: baseMatch(),
    you: 'Alpha',
    roundWinners: ['Beta'],
    readyNames: ['Alpha', 'Beta'],
    attacks: [],
  });
  assert.equal(next.phase, 'playing');
  assert.equal(next.round, 2);
  assert.equal(next.roundWinner, null);

  const quit = assembleMatchView({
    match: { ...baseMatch(), status: 'complete', forfeitWinner: 'Alpha', winner: 'Alpha' },
    you: 'Beta',
    roundWinners: [],
    readyNames: [],
    attacks: [],
  });
  assert.equal(quit.phase, 'complete');
  assert.equal(quit.winner, 'Alpha');
});

test('monthly board ranks by wins then username', () => {
  assert.deepEqual(
    rankWins([
      { player: 'cara', wins: 1 },
      { player: 'amy', wins: 4 },
      { player: 'bob', wins: 4 },
      { player: 'zero', wins: 0 },
    ]),
    [
      { player: 'amy', wins: 4, rank: 1 },
      { player: 'bob', wins: 4, rank: 2 },
      { player: 'cara', wins: 1, rank: 3 },
    ],
  );
});

test('deep link points at the same post', () => {
  assert.equal(
    postDeepLink('BitDropGame', 't3_xyz', 'ch_1'),
    'https://www.reddit.com/r/BitDropGame/comments/xyz/?duel=ch_1',
  );
});
