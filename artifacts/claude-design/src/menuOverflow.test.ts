import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(here, 'App.tsx'), 'utf8');
const css = readFileSync(join(here, 'index.css'), 'utf8');

function block(src: string, selector: string): string {
  const re = new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]+)\\}`);
  const m = src.match(re);
  assert.ok(m, `missing ${selector} rule`);
  return m[1];
}

test('menu overlay is overflow:hidden and never overflow:auto', () => {
  assert.match(app, /className="bitdrop-menu-overlay"/);
  assert.match(app, /data-testid="bitdrop-menu-overlay"/);

  const menuJsx = app.slice(app.indexOf('Menu overlay'), app.indexOf('Learn / scoring'));
  assert.doesNotMatch(menuJsx, /overflow:\s*['"]auto['"]/);
  assert.doesNotMatch(menuJsx, /overflow:\s*['"]scroll['"]/);

  const rule = block(css, '.bitdrop-menu-overlay');
  assert.match(rule, /overflow:\s*hidden/);
  assert.doesNotMatch(rule, /overflow:\s*auto/);
  assert.doesNotMatch(rule, /overflow:\s*scroll/);
});

test('short viewports compact chrome instead of scrolling the menu', () => {
  assert.match(css, /container-name:\s*bitdrop-board/);
  assert.match(css, /@container bitdrop-board \(max-height:\s*560px\)/);
  assert.match(css, /@container bitdrop-board \(min-width:\s*400px\)/);
  assert.match(css, /clamp\(/);
});

test('high-score and end overlays do not page-scroll', () => {
  const scores = block(css, '.bitdrop-scores-overlay');
  assert.match(scores, /overflow:\s*hidden/);
  assert.doesNotMatch(app, /bitdrop-scores-overlay[\s\S]{0,200}overflow:\s*['"]auto['"]/);

  const end = block(css, '.bitdrop-end-overlay');
  assert.match(end, /overflow:\s*hidden/);
});

test('splash still must not lock Reddit feed scroll', () => {
  const splashDir = join(here, '../../devvit-bit-drop/src/client');
  const splashCss = readFileSync(join(splashDir, 'splash.css'), 'utf8');
  const splashTsx = readFileSync(join(splashDir, 'splash.tsx'), 'utf8');
  const rules = splashCss.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(rules, /touch-action:\s*pan-y/);
  assert.doesNotMatch(rules, /overscroll-behavior:\s*none/);
  assert.doesNotMatch(splashTsx, /overflow:\s*['"]hidden['"]/);
});
