import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotBoard, resolveBoard, scoreBotPlacement } from './botBoard.ts';

test('placement score prefers clearing a target over a tall pile', () => {
  const clear = scoreBotPlacement({ targetsCleared: 1, attacks: 1, holes: 0, height: 4 });
  const pile = scoreBotPlacement({ targetsCleared: 0, attacks: 0, holes: 2, height: 10 });
  assert.ok(clear > pile);
});

test('a color-2 line with a target sends garbage and wins the round', () => {
  const bot = new BotBoard({ cols: 8, rows: 12, viruses: 0, rand: () => 0.5 });
  bot.grid[11]![0] = { c: 2, t: true };
  bot.grid[11]![1] = { c: 2, t: false };
  bot.grid[11]![2] = { c: 2, t: false };
  bot.targetsLeft = 1;
  const events = bot.playPill();
  const attack = events.find((e) => e.type === 'attack');
  const round = events.find((e) => e.type === 'round');
  assert.ok(attack && attack.type === 'attack' && attack.colors.includes(2));
  assert.deepEqual(round, { type: 'round', outcome: 'win' });
  assert.equal(bot.alive, false);
});

test('garbage with no landing cell loses the round', () => {
  const bot = new BotBoard({ cols: 4, rows: 4, viruses: 0, rand: () => 0.5 });
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) bot.grid[y]![x] = { c: 1, t: false };
  }
  bot.queueGarbage([0]);
  const events = bot.playPill();
  assert.deepEqual(events, [{ type: 'round', outcome: 'lose' }]);
});

test('resolveBoard clears a horizontal 4 and reports the color', () => {
  const grid = Array.from({ length: 6 }, () => Array(6).fill(null));
  for (let x = 0; x < 4; x++) grid[5]![x] = { c: 0, t: x === 0 };
  const result = resolveBoard(grid);
  assert.deepEqual(result.colors, [0]);
  assert.equal(result.targetsCleared, 1);
  assert.equal(grid[5]![0], null);
});
