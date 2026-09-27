import assert from 'node:assert/strict';
import { test } from 'node:test';
import { noteClearRun } from './attack.ts';

test('only colored lines of 4+ become garbage', () => {
  const colors: number[] = [];
  noteClearRun(colors, 4, 0);
  noteClearRun(colors, 3, 1);
  noteClearRun(colors, 6, 2);
  noteClearRun(colors, 8, 4);
  noteClearRun(colors, 5, -1);
  assert.deepEqual(colors, [0, 2]);
});
