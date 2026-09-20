import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

/** Live Sep-2 Replit identifiers. Must not appear in shared or Reddit source. */
const MUSIC_PATHS = ['musicOn', 'bitdrop-music', 'ensureMusic'];

function walkTs(root: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(root, { withFileTypes: true })) {
    const p = join(root, name.name);
    if (name.isDirectory()) out.push(...walkTs(p));
    else if (/\.(ts|tsx)$/.test(name.name) && !name.name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

function hits(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  return MUSIC_PATHS.filter((id) => src.includes(id));
}

test('shared App and Reddit client have no music playback paths', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const files = [
    ...walkTs(here),
    ...walkTs(join(here, '../../../artifacts/devvit-bit-drop/src')),
  ];
  const found = files.flatMap((file) => hits(file).map((id) => `${file}: ${id}`));
  assert.deepEqual(found, []);
});
