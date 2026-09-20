import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));

function walk(root: string, pred: (name: string) => boolean): string[] {
  const out: string[] = [];
  for (const name of readdirSync(root, { withFileTypes: true })) {
    const p = join(root, name.name);
    if (name.isDirectory()) out.push(...walk(p, pred));
    else if (pred(name.name)) out.push(p);
  }
  return out;
}

test('Press Start 2P is self-hosted; no Google Fonts CDN', () => {
  const css = readFileSync(join(here, 'pixel-font.css'), 'utf8');
  assert.match(css, /@font-face/);
  assert.match(css, /Press Start 2P/);
  assert.match(css, /PressStart2P-Regular\.woff2/);

  const mainTs = readFileSync(join(here, 'main.tsx'), 'utf8');
  assert.match(mainTs, /pixel-font\.css/);

  const splashCss = readFileSync(
    join(here, '../../devvit-bit-drop/src/client/splash.css'),
    'utf8',
  );
  const gameCss = readFileSync(
    join(here, '../../devvit-bit-drop/src/client/game-entry.css'),
    'utf8',
  );
  assert.match(splashCss, /PressStart2P-Regular\.woff2/);
  assert.match(gameCss, /PressStart2P-Regular\.woff2/);

  const webHtml = readFileSync(join(here, '../index.html'), 'utf8');
  assert.doesNotMatch(webHtml, /fonts\.googleapis\.com/);
  assert.doesNotMatch(webHtml, /fonts\.gstatic\.com/);

  const splashDir = join(here, '../../devvit-bit-drop/src/client');
  const sources = [
    join(here, '../index.html'),
    ...walk(here, (n) => /\.(html|css|tsx|ts)$/.test(n) && !n.endsWith('.test.ts')),
    ...walk(splashDir, (n) => /\.(html|css|tsx|ts)$/.test(n)),
  ];
  for (const file of sources) {
    const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(text, /fonts\.googleapis\.com/, file);
    assert.doesNotMatch(text, /fonts\.gstatic\.com/, file);
  }
});
