import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));

test('reddit duel UI does not invite by SMS', () => {
  const lobby = readFileSync(join(here, '../ui/DuelLobby.tsx'), 'utf8');
  const match = readFileSync(join(here, '../ui/DuelMatch.tsx'), 'utf8');
  const result = readFileSync(join(here, '../ui/DuelResult.tsx'), 'utf8');
  const outcome = readFileSync(join(here, '../duel/result.ts'), 'utf8');
  const app = readFileSync(join(here, '../App.tsx'), 'utf8');
  for (const src of [lobby, match, result, app]) {
    assert.doesNotMatch(src, /\bsms\b/i);
    assert.doesNotMatch(src, /twilio/i);
    assert.doesNotMatch(src, /tel:/i);
  }
  assert.match(lobby, /START NOW/);
  assert.match(lobby, /Don’t wait — play now against a bot\./);
  assert.match(lobby, /duel-wait-timer/);
  assert.doesNotMatch(lobby, /opponent username/);
  assert.doesNotMatch(lobby, /COPY LINK/);
  assert.match(app, /FIND A CHALLENGER/);
  assert.match(lobby, /BOT BOARD/);
  assert.match(lobby, /MONTHLY DUEL WINS/);
  assert.match(result, /bot board only/);
  assert.match(outcome, /YOU WIN/);
  assert.match(outcome, /YOU LOSE/);
  assert.match(result, /outcomeTitle/);
  assert.match(result, /PLAY AGAIN/);
  assert.match(result, /FIND A CHALLENGER/);
  assert.match(result, /data-testid="duel-result"/);
  assert.match(result, /data-testid="duel-set-score"/);
  assert.match(match, /phase === 'complete'/);
  assert.match(match, /ROUND WON/);
  assert.doesNotMatch(match, /YOU WIN/);
  assert.match(app, /recordBotWin|botWins/);
  assert.match(app, /rollBotSkill\(\)/);
  assert.match(app, /data-testid="bot-skill"/);
  assert.match(match, /data-testid="bot-skill"/);
  assert.doesNotMatch(app, /duelApi\.wins\([\s\S]{0,40}pcMode/);
  assert.match(app, /redditDuelEnabled\(\)/);
  assert.match(app, /pcMode/);
  assert.doesNotMatch(app, /duelApi\.round\([\s\S]{0,80}pcMode/);
});

test('devvit build turns multiplayer on', () => {
  const vite = readFileSync(join(here, '../../../devvit-bit-drop/vite.config.ts'), 'utf8');
  assert.match(vite, /ENABLE_MULTIPLAYER:\s*'true'/);
});
