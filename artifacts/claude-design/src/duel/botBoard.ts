/**
 * Headless opponent for Play vs PC.
 * Same clear / garbage idea as a duel round: match-4+ sends that line's color,
 * targets don't fall, no room at the top loses the round. Placement is a
 * greedy search (clear targets, then send attacks, then stay low).
 */

import { noteClearRun } from './attack.ts';
import { planGarbage, shuffleColumns } from './garbage.ts';

const RAINBOW = 4;

export type BotCell = { c: number; t: boolean } | null;
export type BotGrid = BotCell[][];

export type BotEvent =
  | { type: 'attack'; colors: number[] }
  | { type: 'round'; outcome: 'win' | 'lose' };

type Pill = { x: number; y: number; dir: number; a: number; b: number };

export type BotHooks = {
  cols: number;
  rows: number;
  viruses: number;
  rand?: () => number;
};

function cloneGrid(grid: BotGrid): BotGrid {
  return grid.map((row) => row.map((cell) => (cell ? { c: cell.c, t: cell.t } : null)));
}

function pillCells(p: Pill): { x: number; y: number; c: number }[] {
  const swap = p.dir >= 2;
  const dx = p.dir % 2 === 0 ? 1 : 0;
  const dy = p.dir % 2 === 0 ? 0 : -1;
  return [
    { x: p.x, y: p.y, c: swap ? p.b : p.a },
    { x: p.x + dx, y: p.y + dy, c: swap ? p.a : p.b },
  ];
}

function occupied(grid: BotGrid, x: number, y: number): boolean {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (x < 0 || x >= cols || y >= rows) return true;
  if (y < 0) return false;
  return grid[y]![x] != null;
}

function fits(grid: BotGrid, p: Pill): boolean {
  return pillCells(p).every((c) => !occupied(grid, c.x, c.y));
}

function lockPill(grid: BotGrid, p: Pill): void {
  for (const cell of pillCells(p)) {
    if (cell.y >= 0 && cell.y < grid.length && cell.x >= 0 && cell.x < (grid[0]?.length ?? 0)) {
      grid[cell.y]![cell.x] = { c: cell.c, t: false };
    }
  }
}

/** One colored match-4+ pass. Mutates the grid. Targets removed are counted. */
export function clearOnce(grid: BotGrid): { colors: number[]; targets: number } | null {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const marks = new Map<string, number>();
  const colors: number[] = [];
  const scan = (sx: number, sy: number, dx: number, dy: number) => {
    let run: [number, number][] = [];
    let runColor = -1;
    const flush = () => {
      if (run.length >= 4 && runColor !== -1) {
        noteClearRun(colors, run.length, runColor);
        for (const p of run) marks.set(p[0] + ',' + p[1], run.length);
      }
    };
    let x = sx;
    let y = sy;
    while (x < cols && y < rows) {
      const cell = grid[y]![x];
      if (!cell) {
        flush();
        run = [];
        runColor = -1;
      } else if (cell.c === RAINBOW || runColor === -1 || cell.c === runColor) {
        if (cell.c !== RAINBOW) runColor = cell.c;
        run.push([x, y]);
      } else {
        flush();
        run = [[x, y]];
        runColor = cell.c;
      }
      x += dx;
      y += dy;
    }
    flush();
  };
  for (let y = 0; y < rows; y++) scan(0, y, 1, 0);
  for (let x = 0; x < cols; x++) scan(x, 0, 0, 1);
  if (!marks.size) return null;
  let targets = 0;
  for (const key of marks.keys()) {
    const [xs, ys] = key.split(',');
    const x = Number(xs);
    const y = Number(ys);
    const cell = grid[y]![x];
    if (cell?.t) targets += 1;
    grid[y]![x] = null;
  }
  return { colors, targets };
}

function gravitate(grid: BotGrid): boolean {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  let moved = false;
  for (let y = rows - 2; y >= 0; y--) {
    for (let x = 0; x < cols; x++) {
      const cell = grid[y]![x];
      if (!cell || cell.t) continue;
      if (!grid[y + 1]![x]) {
        grid[y + 1]![x] = cell;
        grid[y]![x] = null;
        moved = true;
      }
    }
  }
  return moved;
}

export function resolveBoard(grid: BotGrid): { colors: number[]; targetsCleared: number; won: boolean } {
  const colors: number[] = [];
  let targetsCleared = 0;
  for (let guard = 0; guard < 24; guard++) {
    const clear = clearOnce(grid);
    if (!clear) break;
    colors.push(...clear.colors);
    targetsCleared += clear.targets;
    while (gravitate(grid)) {
      /* fall */
    }
  }
  let left = 0;
  for (const row of grid) {
    for (const cell of row) if (cell?.t) left += 1;
  }
  return { colors, targetsCleared, won: left === 0 && targetsCleared > 0 };
}

function pileStats(grid: BotGrid): { holes: number; height: number } {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  let holes = 0;
  let height = 0;
  for (let x = 0; x < cols; x++) {
    let seen = false;
    for (let y = 0; y < rows; y++) {
      if (grid[y]![x]) {
        seen = true;
        height = Math.max(height, rows - y);
      } else if (seen && !grid[y]![x]) {
        holes += 1;
      }
    }
  }
  return { holes, height };
}

export function scoreBotPlacement(stats: {
  targetsCleared: number;
  attacks: number;
  holes: number;
  height: number;
}): number {
  return stats.targetsCleared * 200 + stats.attacks * 40 - stats.holes * 12 - stats.height * 3;
}

function dropPill(grid: BotGrid, dir: number, x: number, a: number, b: number): Pill | null {
  const start: Pill = { x, y: 0, dir, a, b };
  if (!fits(grid, start)) return null;
  let y = 0;
  while (fits(grid, { x, y: y + 1, dir, a, b })) y += 1;
  return { x, y, dir, a, b };
}

export class BotBoard {
  readonly cols: number;
  readonly rows: number;
  grid: BotGrid;
  targetsLeft: number;
  alive = true;
  private garbage: number[] = [];
  private readonly rand: () => number;

  constructor(opts: BotHooks) {
    this.cols = opts.cols;
    this.rows = opts.rows;
    this.rand = opts.rand ?? Math.random;
    this.grid = Array.from({ length: opts.rows }, () => Array(opts.cols).fill(null));
    this.targetsLeft = this.placeTargets(opts.viruses);
  }

  queueGarbage(colors: number[]): void {
    for (const c of colors) {
      if (Number.isInteger(c) && c >= 0 && c <= 3) this.garbage.push(c);
    }
  }

  /** One decision: apply queued garbage, then hard-drop the best pill. */
  playPill(): BotEvent[] {
    if (!this.alive) return [];
    const events: BotEvent[] = [];
    if (this.garbage.length) {
      const colors = this.garbage.splice(0, this.garbage.length);
      const occ = this.grid.map((row) => row.map((cell) => cell != null));
      const plan = planGarbage(occ, colors, shuffleColumns(this.cols, this.rand));
      if (!plan.ok) {
        this.alive = false;
        return [{ type: 'round', outcome: 'lose' }];
      }
      for (const drop of plan.drops) this.grid[drop.targetY]![drop.x] = { c: drop.c, t: false };
      events.push(...this.finishResolve());
      if (!this.alive) return events;
    }

    const a = this.rollColor(false);
    const b = this.rollColor(a === RAINBOW);
    const move = this.bestMove(a, b);
    if (!move) {
      this.alive = false;
      events.push({ type: 'round', outcome: 'lose' });
      return events;
    }
    lockPill(this.grid, move);
    events.push(...this.finishResolve());
    return events;
  }

  private finishResolve(): BotEvent[] {
    const events: BotEvent[] = [];
    const resolved = resolveBoard(this.grid);
    if (resolved.colors.length) events.push({ type: 'attack', colors: resolved.colors });
    this.targetsLeft = Math.max(0, this.targetsLeft - resolved.targetsCleared);
    if (this.targetsLeft <= 0) {
      this.alive = false;
      events.push({ type: 'round', outcome: 'win' });
    }
    return events;
  }

  private rollColor(forceNormal: boolean): number {
    if (forceNormal) return (this.rand() * 4) | 0;
    return this.rand() < 0.15 ? RAINBOW : (this.rand() * 4) | 0;
  }

  private bestMove(a: number, b: number): Pill | null {
    let best: Pill | null = null;
    let bestScore = -Infinity;
    for (let dir = 0; dir < 4; dir++) {
      for (let x = 0; x < this.cols; x++) {
        const dropped = dropPill(this.grid, dir, x, a, b);
        if (!dropped) continue;
        const copy = cloneGrid(this.grid);
        lockPill(copy, dropped);
        const resolved = resolveBoard(copy);
        const pile = pileStats(copy);
        const score = scoreBotPlacement({
          targetsCleared: resolved.targetsCleared,
          attacks: resolved.colors.length,
          holes: pile.holes,
          height: pile.height,
        });
        if (score > bestScore) {
          bestScore = score;
          best = dropped;
        }
      }
    }
    return best;
  }

  private placeTargets(want: number): number {
    let placed = 0;
    let guard = 0;
    const top = Math.floor(this.rows / 4) + 1;
    while (placed < want && guard++ < 4000) {
      const x = (this.rand() * this.cols) | 0;
      const y = top + ((this.rand() * Math.max(1, this.rows - top - 1)) | 0);
      if (y < 0 || y >= this.rows || this.grid[y]![x]) continue;
      const c = (this.rand() * 4) | 0;
      this.grid[y]![x] = { c, t: true };
      placed += 1;
    }
    return placed;
  }
}
