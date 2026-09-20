import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { brandGutterSvg, BRAND_FILL } from './brandArt.ts';

const here = dirname(fileURLToPath(import.meta.url));

test('inline splash does not trap Reddit feed scroll', () => {
  const splashDir = join(here, '../../devvit-bit-drop/src/client');
  const css = readFileSync(join(splashDir, 'splash.css'), 'utf8');
  const tsx = readFileSync(join(splashDir, 'splash.tsx'), 'utf8');
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');

  assert.match(rules, /touch-action:\s*pan-y/);
  assert.doesNotMatch(rules, /overscroll-behavior:\s*none/);
  assert.doesNotMatch(rules, /touch-action:\s*none/);
  assert.doesNotMatch(tsx, /preventDefault/);
  assert.doesNotMatch(tsx, /touchmove/);
  assert.doesNotMatch(tsx, /addEventListener\(\s*['"]wheel/);
  assert.doesNotMatch(tsx, /overflow:\s*['"]hidden['"]/);
});

test('shared App no longer ships a rotate-device blocker', () => {
  const app = readFileSync(join(here, 'App.tsx'), 'utf8');
  assert.doesNotMatch(app, /ROTATE YOUR DEVICE/);
  assert.doesNotMatch(app, /portrait only/);
  assert.match(app, /BrandGutter/);
  assert.match(app, /shouldCapturePlayGestures/);
});

test('brand gutters are blocks-only (no pills, no copy)', () => {
  const svg = brandGutterSvg();
  for (const color of BRAND_FILL) assert.match(svg, new RegExp(color, 'i'));
  assert.doesNotMatch(svg, /<text/i);
  assert.doesNotMatch(svg, /BIT|DROP|pill/i);
  assert.doesNotMatch(svg, /rx=|ry=|circle|ellipse/i);
});
