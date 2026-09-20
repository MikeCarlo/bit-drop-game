import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  accumulateClear,
  cellClearPoints,
  countFlashRuns,
  flushDrop,
  idleDropScore,
  lenBonus,
} from './scoring.ts';

test('lenBonus: 4=x1 … 8+=x5', () => {
  assert.equal(lenBonus(4), 1);
  assert.equal(lenBonus(5), 2);
  assert.equal(lenBonus(6), 3);
  assert.equal(lenBonus(7), 4);
  assert.equal(lenBonus(8), 5);
  assert.equal(lenBonus(12), 5);
});

test('countFlashRuns: one horizontal line of 4 is one run', () => {
  const flash: [number, number][] = [[0, 5], [1, 5], [2, 5], [3, 5]];
  assert.equal(countFlashRuns(flash), 1);
});

test('countFlashRuns: two adjacent vertical 4s are two runs, not six', () => {
  // Live JS would count 2 vertical + 4 two-cell horizontal neighbor pairs.
  const flash: [number, number][] = [];
  for (let y = 0; y < 4; y++) {
    flash.push([0, y], [1, y]);
  }
  assert.equal(countFlashRuns(flash), 2);
});

test('countFlashRuns: a plus/cross counts two runs', () => {
  // 4-wide row through (2,2) and 4-tall column through (2,2)
  const flash: [number, number][] = [
    [0, 2], [1, 2], [2, 2], [3, 2],
    [2, 0], [2, 1], [2, 3],
  ];
  assert.equal(countFlashRuns(flash), 2);
});

test('no target in the sequence → flush is 0 (Mike / live website)', () => {
  const acc = accumulateClear(idleDropScore(), [
    { t: false, runLen: 4 },
    { t: false, runLen: 4 },
    { t: false, runLen: 4 },
    { t: false, runLen: 4 },
  ], 1);
  const flushed = flushDrop(acc);
  assert.equal(flushed.pts, 0);
  assert.equal(flushed.next.dropBasePoints, 40);
  assert.equal(flushed.next.dropRunCount, 1);
});

test('target in the sequence → award base × run count', () => {
  const acc = accumulateClear(idleDropScore(), [
    { t: true, runLen: 4 },
    { t: false, runLen: 4 },
    { t: false, runLen: 4 },
    { t: false, runLen: 4 },
  ], 1);
  const flushed = flushDrop(acc);
  assert.equal(acc.dropBasePoints, 80);
  assert.equal(flushed.pts, 80);
  assert.equal(flushed.mult, 1);
  assert.equal(flushed.next.dropBasePoints, 0);
});

test('cascade: first clear no target, second has target — both count', () => {
  let acc = accumulateClear(idleDropScore(), [
    { t: false, runLen: 4 },
    { t: false, runLen: 4 },
    { t: false, runLen: 4 },
    { t: false, runLen: 4 },
  ], 1);
  acc = accumulateClear(acc, [
    { t: true, runLen: 4 },
    { t: false, runLen: 4 },
    { t: false, runLen: 4 },
    { t: false, runLen: 4 },
  ], 1);
  const flushed = flushDrop(acc);
  // bases 40 + 80 = 120, runCount 2 → 240
  assert.equal(acc.dropBasePoints, 120);
  assert.equal(acc.dropRunCount, 2);
  assert.equal(flushed.pts, 240);
  assert.equal(flushed.mult, 2);
});

test('LearnPage example: 6-in-a-row, 2 targets, 2 runs = 840', () => {
  const cells = [
    { t: true, runLen: 6 },
    { t: true, runLen: 6 },
    { t: false, runLen: 6 },
    { t: false, runLen: 6 },
    { t: false, runLen: 6 },
    { t: false, runLen: 6 },
  ];
  const acc = accumulateClear(idleDropScore(), cells, 2);
  const flushed = flushDrop(acc);
  // (50+50+10+10+10+10) × 3 = 420 base; × 2 runs = 840
  assert.equal(acc.dropBasePoints, 420);
  assert.equal(flushed.pts, 840);
});

test('ghost mul 0.65 (live default) rounds per cell', () => {
  assert.equal(cellClearPoints(false, 4, 0.65), 7);
  assert.equal(cellClearPoints(true, 4, 0.65), 33);
});

test('this.chain is not part of the point formula', () => {
  const acc = accumulateClear(idleDropScore(), [
    { t: true, runLen: 4 },
    { t: false, runLen: 4 },
    { t: false, runLen: 4 },
    { t: false, runLen: 4 },
  ], 1);
  // Would have been 80 * chain if the Phase 1 GitHub formula were used.
  assert.equal(flushDrop(acc).pts, 80);
});
