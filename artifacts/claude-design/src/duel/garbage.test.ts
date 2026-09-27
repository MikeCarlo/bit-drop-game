import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planGarbage, shuffleColumns } from './garbage.ts';

function empty(rows: number, cols: number): boolean[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(false));
}

test('garbage stacks from the bottom in column order', () => {
  const plan = planGarbage(empty(6, 4), [1, 2, 1], [0, 1, 2, 3]);
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.deepEqual(
    plan.drops.map((d) => ({ c: d.c, x: d.x, targetY: d.targetY })),
    [
      { c: 1, x: 0, targetY: 5 },
      { c: 2, x: 1, targetY: 5 },
      { c: 1, x: 2, targetY: 5 },
    ],
  );
  assert.equal(plan.drops[0]!.y, -2);
});

test('a second block in a column sits above the first', () => {
  const plan = planGarbage(empty(4, 2), [0, 1, 2], [0, 0]);
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.equal(plan.drops[0]!.targetY, 3);
  assert.equal(plan.drops[1]!.x, 0);
  assert.equal(plan.drops[1]!.targetY, 2);
  assert.equal(plan.drops[2]!.targetY, 1);
});

test('no room at the top loses the round', () => {
  const grid = empty(2, 1);
  grid[0]![0] = true;
  grid[1]![0] = true;
  const plan = planGarbage(grid, [3], [0]);
  assert.deepEqual(plan, { ok: false });
});

test('occupied cells are not overwritten', () => {
  const grid = empty(4, 1);
  grid[3]![0] = true;
  const plan = planGarbage(grid, [2], [0]);
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.equal(plan.drops[0]!.targetY, 2);
});

test('shuffleColumns is a permutation', () => {
  const order = shuffleColumns(8, () => 0.1);
  assert.deepEqual([...order].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7]);
});
