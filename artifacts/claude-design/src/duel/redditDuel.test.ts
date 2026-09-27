import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));

test('reddit duel UI does not invite by SMS', () => {
  const lobby = readFileSync(join(here, '../ui/DuelLobby.tsx'), 'utf8');
  const match = readFileSync(join(here, '../ui/DuelMatch.tsx'), 'utf8');
  const app = readFileSync(join(here, '../App.tsx'), 'utf8');
  for (const src of [lobby, match, app]) {
    assert.doesNotMatch(src, /\bsms\b/i);
    assert.doesNotMatch(src, /twilio/i);
    assert.doesNotMatch(src, /tel:/i);
  }
  assert.match(lobby, /opponent username/);
  assert.match(lobby, /PLAY VS PC/);
  assert.match(lobby, /PLAY VS PC INSTEAD/);
  assert.match(match, /PC games stay off the monthly wins board/);
  assert.match(app, /redditDuelEnabled\(\)/);
  assert.match(app, /pcMode/);
  assert.doesNotMatch(app, /duelApi\.round\([\s\S]{0,80}pcMode/);
});

test('devvit build turns multiplayer on', () => {
  const vite = readFileSync(join(here, '../../../devvit-bit-drop/vite.config.ts'), 'utf8');
  assert.match(vite, /ENABLE_MULTIPLAYER:\s*'true'/);
});
