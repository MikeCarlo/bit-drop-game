import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  beginPointerTrack,
  isHardDropKey,
  isTapRelease,
  shouldCapturePlayGestures,
  shouldDebounceRotate,
  shouldIgnoreCompatClick,
  TAP_SLOP_PX,
} from './input.ts';

test('unmoved release is a tap', () => {
  const t = beginPointerTrack(100, 200, 0);
  assert.equal(isTapRelease(t, 100, 200), true);
  assert.equal(isTapRelease(t, 105, 208), true);
});

test('travel past slop is not a tap', () => {
  const t = beginPointerTrack(100, 200, 0);
  assert.equal(isTapRelease(t, 100 + TAP_SLOP_PX + 1, 200), false);
});

test('a drag or hard-drop swipe is not a tap', () => {
  const moved = { ...beginPointerTrack(100, 200, 0), moved: true };
  const dropped = { ...beginPointerTrack(100, 200, 0), dropped: true };
  assert.equal(isTapRelease(moved, 100, 200), false);
  assert.equal(isTapRelease(dropped, 100, 200), false);
});

test('compat click is ignored after a handled pointer gesture', () => {
  assert.equal(shouldIgnoreCompatClick(400, 100), true);
  assert.equal(shouldIgnoreCompatClick(800, 100), false);
  assert.equal(shouldIgnoreCompatClick(100, 0), false);
});

test('duplicate pointer+touch rotates debounce', () => {
  assert.equal(shouldDebounceRotate(120, 100), true);
  assert.equal(shouldDebounceRotate(200, 100), false);
});

test('ArrowDown is a hard-drop key, not a soft-drop hold', () => {
  assert.equal(isHardDropKey('ArrowDown'), true);
  assert.equal(isHardDropKey('Down'), true);
  assert.equal(isHardDropKey('ArrowUp'), false);
  assert.equal(isHardDropKey(' '), false);
  assert.equal(isHardDropKey('s'), false);
});

test('shared App maps ArrowDown to hardDrop, not fastDrop', () => {
  const app = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'App.tsx'), 'utf8');
  const handle = app.slice(app.indexOf('handleKey'), app.indexOf('beginPrimary'));
  assert.match(handle, /isHardDropKey\(e\.key\)/);
  assert.match(handle, /this\.hardDrop\(\)/);
  assert.doesNotMatch(handle, /fastDrop\s*=\s*true/);
});

test('gesture capture is play-only so splash/menu do not trap scroll', () => {
  assert.equal(shouldCapturePlayGestures('play'), true);
  assert.equal(shouldCapturePlayGestures('menu'), false);
  assert.equal(shouldCapturePlayGestures('learn'), false);
  assert.equal(shouldCapturePlayGestures('scores'), false);
  assert.equal(shouldCapturePlayGestures('win'), false);
  assert.equal(shouldCapturePlayGestures('lose'), false);
});
