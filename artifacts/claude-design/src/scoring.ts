/**
 * Solo scoring — matches the live website bundle
 * (`https://bit-drop-a-mobile-puzzle-game.replit.app/assets/index-CWLN84aj.js`,
 * last-modified 2026-09-02).
 *
 * Points are accumulated per locked pill's clear/cascade sequence, then flushed
 * once when the next pill spawns or the game ends. A sequence that never
 * removes a target scores 0.
 */

export type DropScoreAcc = {
  /** True if any target square was removed in this drop sequence. */
  chainHadTarget: boolean;
  /** Sum of per-cell bases (value × length bonus × ghost mul) across clears. */
  dropBasePoints: number;
  /** Distinct H/V match-4+ runs across the whole sequence. */
  dropRunCount: number;
};

export type FlushResult = {
  pts: number;
  /** Sequence multiplier (= dropRunCount when points are awarded). */
  mult: number;
  basePts: number;
  next: DropScoreAcc;
};

export function idleDropScore(): DropScoreAcc {
  return { chainHadTarget: false, dropBasePoints: 0, dropRunCount: 0 };
}

/** 4 in a row = x1, 5 = x2, 6 = x3, 7 = x4, 8+ = x5. */
export function lenBonus(len: number): number {
  return Math.min(len - 3, 5);
}

export function cellBasePoints(isTarget: boolean): number {
  return isTarget ? 50 : 10;
}

function flashRunLen(
  set: Set<string>,
  x: number,
  y: number,
  dx: number,
  dy: number,
): number {
  let n = 1;
  let cx = x + dx;
  let cy = y + dy;
  while (set.has(`${cx},${cy}`)) {
    n++;
    cx += dx;
    cy += dy;
  }
  return n;
}

/**
 * Count match-4+ axis runs in one flash set.
 *
 * Live `doClear` increments on any flashed neighbor pair (no length check),
 * so two side-by-side vertical 4s also count as four 2-cell "horizontal runs"
 * and multiply by 6 instead of 2. We only count a start if the walk is 4+.
 * `checkClears` is the source of truth (colored 4+ scans); this helper matches
 * that for isolated lines and crosses.
 */
export function countFlashRuns(flash: ReadonlyArray<readonly [number, number]>): number {
  const set = new Set(flash.map(([x, y]) => `${x},${y}`));
  let runs = 0;
  for (const [x, y] of flash) {
    if (!set.has(`${x - 1},${y}`) && set.has(`${x + 1},${y}`) && flashRunLen(set, x, y, 1, 0) >= 4) {
      runs++;
    }
    if (!set.has(`${x},${y - 1}`) && set.has(`${x},${y + 1}`) && flashRunLen(set, x, y, 0, 1) >= 4) {
      runs++;
    }
  }
  return runs;
}

/**
 * Per-cell base for one clear. Live applies `Math.round` after
 * `(target?50:10) * lenBonus * ghostMul`. Ghost assist is website-only
 * (default on = 0.65); Phase 1 / Reddit have no ghost, so mul defaults to 1.
 */
export function cellClearPoints(isTarget: boolean, runLen: number, ghostMul = 1): number {
  return Math.round(cellBasePoints(isTarget) * lenBonus(runLen) * ghostMul);
}

export function accumulateClear(
  acc: DropScoreAcc,
  cells: ReadonlyArray<{ t: boolean; runLen: number }>,
  runCount: number,
  ghostMul = 1,
): DropScoreAcc {
  let base = 0;
  let hadTarget = acc.chainHadTarget;
  for (const cell of cells) {
    base += cellClearPoints(cell.t, cell.runLen, ghostMul);
    if (cell.t) hadTarget = true;
  }
  return {
    chainHadTarget: hadTarget,
    dropBasePoints: acc.dropBasePoints + base,
    dropRunCount: acc.dropRunCount + runCount,
  };
}

/**
 * Award the sequence. Live: `if (!chainHadTarget || dropRunCount===0) 0;
 * else pts = dropBasePoints * dropRunCount`. Failed flushes leave counters
 * unchanged; successful flushes zero base + run count only.
 */
export function flushDrop(acc: DropScoreAcc): FlushResult {
  if (!acc.chainHadTarget || acc.dropRunCount === 0) {
    return { pts: 0, mult: 1, basePts: 0, next: acc };
  }
  const mult = acc.dropRunCount;
  const basePts = acc.dropBasePoints;
  return {
    pts: basePts * mult,
    mult,
    basePts,
    next: { chainHadTarget: acc.chainHadTarget, dropBasePoints: 0, dropRunCount: 0 },
  };
}
