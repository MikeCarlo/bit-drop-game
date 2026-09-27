/**
 * Incoming garbage placement, matching the live site's `receiveIncoming` /
 * `applyIncomingBlocks` rules: one non-target block per attack color, columns
 * in a shuffled order, stacked from the bottom. No room at the top ends the round.
 */

export type GarbageDrop = { c: number; x: number; y: number; targetY: number };

export function shuffleColumns(cols: number, rand: () => number = Math.random): number[] {
  const order = Array.from({ length: cols }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const k = Math.floor(rand() * (i + 1));
    const swap = order[i]!;
    order[i] = order[k]!;
    order[k] = swap;
  }
  return order;
}

export function planGarbage(
  occupied: boolean[][],
  colors: number[],
  columnOrder: number[],
): { ok: true; drops: GarbageDrop[] } | { ok: false } {
  const rows = occupied.length;
  const cols = occupied[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return { ok: false };
  const occ = occupied.map((row) => row.slice());
  const order = columnOrder.length >= cols ? columnOrder : Array.from({ length: cols }, (_, i) => i);
  const nextStart = new Map<number, number>();
  const drops: GarbageDrop[] = [];

  for (let i = 0; i < colors.length; i++) {
    const c = colors[i];
    if (typeof c !== 'number' || !Number.isInteger(c) || c < 0 || c > 3) continue;
    const x = order[i % order.length]!;
    if (x < 0 || x >= cols) return { ok: false };
    let y = 0;
    while (y < rows && !occ[y]![x]) y += 1;
    const targetY = y - 1;
    if (targetY < 0) return { ok: false };
    occ[targetY]![x] = true;
    const start = nextStart.get(x) ?? -2;
    nextStart.set(x, start + 1);
    drops.push({ c, x, y: start, targetY });
  }

  return { ok: true, drops };
}
