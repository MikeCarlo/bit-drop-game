/** Bit Drop brand tiles: square beveled blocks only (no pills, no text). */

export const BRAND_FILL = ['#c23a3a', '#2f4bc9', '#d9cf4a', '#2ea043'] as const;
export const BRAND_LIGHT = ['#e07070', '#6f83e8', '#efe88e', '#6cc97c'] as const;
export const BRAND_DARK = ['#7e2222', '#1d2f85', '#9a922c', '#1c6b2c'] as const;

type Block = { x: number; y: number; s: number; c: 0 | 1 | 2 | 3 };

/** Tile layout: the four-color icon motif plus scattered singles. Gaps keep squares from reading as pills. */
const TILE_BLOCKS: Block[] = [
  { x: 10, y: 14, s: 28, c: 0 },
  { x: 46, y: 14, s: 28, c: 1 },
  { x: 22, y: 72, s: 28, c: 2 },
  { x: 58, y: 72, s: 28, c: 3 },
  { x: 14, y: 124, s: 20, c: 1 },
  { x: 52, y: 148, s: 24, c: 0 },
  { x: 18, y: 184, s: 22, c: 3 },
  { x: 56, y: 206, s: 18, c: 2 },
];

function beveledSquare(b: Block): string {
  const fill = BRAND_FILL[b.c];
  const light = BRAND_LIGHT[b.c];
  const dark = BRAND_DARK[b.c];
  const edge = Math.max(2, Math.round(b.s * 0.1));
  return [
    `<rect x="${b.x}" y="${b.y}" width="${b.s}" height="${b.s}" fill="${fill}"/>`,
    `<rect x="${b.x}" y="${b.y}" width="${b.s}" height="${edge}" fill="${light}"/>`,
    `<rect x="${b.x}" y="${b.y}" width="${edge}" height="${b.s}" fill="${light}"/>`,
    `<rect x="${b.x}" y="${b.y + b.s - edge}" width="${b.s}" height="${edge}" fill="${dark}"/>`,
    `<rect x="${b.x + b.s - edge}" y="${b.y}" width="${edge}" height="${b.s}" fill="${dark}"/>`,
  ].join('');
}

export function brandGutterSvg(): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 240" width="96" height="240">',
    '<rect width="96" height="240" fill="#020209"/>',
    ...TILE_BLOCKS.map(beveledSquare),
    '</svg>',
  ].join('');
}

export function brandGutterDataUri(): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(brandGutterSvg())}`;
}
