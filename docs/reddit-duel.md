# BIT·DROP — Reddit 1v1 duels

Reddit duels run on the Devvit server. They do **not** use the live website’s text-message / challenge-link WebRTC flow (`Send this link by text`). That path stays on the website. The GitHub web build still hides compete unless `ENABLE_MULTIPLAYER=true`, and then it only shows the old disabled stub.

The Reddit playtest build (`artifacts/devvit-bit-drop`) bakes `PLATFORM=reddit` and `ENABLE_MULTIPLAYER=true`.

## How a match works

1. The menu action is **Find a challenger**. Width, targets, and speed are that player’s menu sliders (same ranges as solo: 8–24, 4–40, 1–9). There is no username box and no text-message invite.
2. The server puts them on the install’s open-seat queue (`bitdrop:duel:queue`) and the lobby shows a running wait timer.
3. When a second player is waiting, the server pairs them. The player who queued first is the host: their board settings are the match. Both clients see the match on the next `GET /api/duel/state` (about every 1s in the lobby, then `GET /api/duel/match/:id` about every 800ms). Realtime on the post is best-effort.
4. Each round is a normal clear-the-targets board. Clearing every target reports a round **win**. Topping out (or garbage with nowhere to land) reports a **loss**. First decisive report wins the round: a win awards that player, a loss awards the opponent. First to **3** round wins takes the match (best of 5).
5. Garbage matches the live `type:"attack"` payload as closely as the shared scanner allows: each colored match-4+ line sends that line’s color (`0–3`). The server queues it for the opponent. Between falling blocks, garbage cells fall in as non-target cells (shuffled columns, stacked from the bottom). A full ceiling loses the round.
6. After a round that does not end the match, both players tap **NEXT ROUND**. Forfeit gives the match to the opponent.
7. First to 3 opens a match-over screen: **YOU WIN** or **YOU LOSE**, the set score with your rounds first (3–1), and who you faced (their username, or **BOT · SKILL N**). **PLAY AGAIN** starts another bot match (new skill) or returns a human match to the queue. **FIND A CHALLENGER** opens the waiting room. **MENU** leaves. A single round does not use this screen.

Solo high scores (`bitdrop:board` / `HighScoreBoard`) are unchanged. Duel rounds are not written there.

## Waiting room

This replaces the live site’s friend lobby (room code or “send this link by text”) and the earlier username challenge screen.

1. **Find a challenger** joins the Redis queue for this subreddit install.
2. The lobby shows the elapsed wait (`m:ss`) and the board the player brought in.
3. **START NOW** is on that same screen the whole time, with the line **Don’t wait — play now against a bot.** Tapping it leaves the human queue and starts a first-to-3 bot duel immediately. If a human was paired at that moment, the human match starts instead.
4. ◀ MENU also leaves the queue. A seat that stops polling expires after 3 minutes so a closed app does not sit in the queue forever.

## Play vs a bot

**START NOW** is the bot path. It is not a second menu item and it does not stay in the human queue.

The PC is a local heuristic (`src/duel/botBoard.ts`). **START NOW** rolls one skill, uniformly from **1** (super easy) to **10** (hard to beat). That number lasts for the whole first-to-3. It is not rolled again on the next round. The play header and the between-rounds screen show it as **BOT · SKILL 7**.

| Skill | What the player feels |
| --- | --- |
| 1 | Slow blocks, bad placements most of the time, garbage only now and then, and a narrow search (two rotations, every other column). A new player can win. |
| 10 | Fast blocks, the best placement almost every time, every colored clear sent as garbage, and a full search of columns and rotations. |

What scales with skill: reaction delay, mistake rate, how often a clear becomes garbage, and how wide the placement search is. Board speed only nudges the delay. Skill 1 waits about 1.8s between blocks. Skill 10 waits about a quarter of a second.

The bot board stores wins only. It does not store the skill that was faced.

A win against the PC calls `POST /api/duel/bot-win` once, with a `bot-<uuid>` match id. That increments **only** `bitdrop:duel:botwins:YYYY-MM`. It does not call the human round route and it does not touch `bitdrop:duel:wins:YYYY-MM`. A loss to the PC increments neither board. Quitting back to the menu does not credit anyone. The match-over screen says the win is on the bot board only.

## What we did not use

| Idea | What happened |
| --- | --- |
| SMS / `tel:` / text-message invite | Not used on Reddit. Web live site still has “send this link by text”; this repo’s web app does not gain that path. |
| `reddit.sendPrivateMessage` | Deprecated in Devvit and documented as no longer reliable. No DMs. |
| Post comment ping | Skipped. Matchmaking is the in-app queue, not a comment. |
| Username challenge as the main invite | Not the lobby. Pairing is the open-seat queue. |
| Opponent mini-map | Not ported. Garbage and the win count are the shared state. |
| Devvit realtime as the only transport | `realtime.send(postId, { kind: "duel", matchId })` is best-effort. If it throws, play continues on the poll. The web bundle never imports `@devvit/web/client`; `game.tsx` installs `window.__bitdropConnectRealtime`. |

## Redis keys

Per subreddit install. Usernames are the Reddit username, same as solo score submit.

| Key | Type | Meaning |
| --- | --- | --- |
| `bitdrop:duel:queue` | sorted set, member = user key, score = joinedAt | Open seats waiting for a human |
| `bitdrop:duel:seat:{username}` | string JSON | That waiter’s board settings and post id. Expires in 3 minutes unless the lobby refreshes it |
| `bitdrop:duel:pairlock` | hash, field = user key | Short lock so two polls cannot pair the same seat twice |
| `bitdrop:duel:challenge:{id}` | string JSON | Legacy direct challenge record. Not used by the lobby |
| `bitdrop:duel:inbox:{username}` | hash, field = challenge id | Pending challenges for that player |
| `bitdrop:duel:outbox:{username}` | hash | Pending challenges they sent |
| `bitdrop:duel:active:{username}` | string | Current match id |
| `bitdrop:duel:match:{id}` | string JSON | Players, settings, forfeit, post id |
| `bitdrop:duel:rounds:{id}` | hash, field = round number | Round winner. `HSETNX` so the first report sticks |
| `bitdrop:duel:ready:{id}:{round}` | hash | Who tapped next round |
| `bitdrop:duel:atk:{id}` | hash, field = attack id | Garbage waiting for the opponent |
| `bitdrop:duel:atkseq:{id}` | int | Order for garbage drops |
| `bitdrop:duel:credited` | hash, field = match id | Human winner already counted. Stops double credit |
| `bitdrop:duel:botcredited` | hash, field = `bot-<uuid>` | Bot-match win already counted. Not the human credit hash |
| `bitdrop:duel:post:{postId}` | hash | Ids to drop if that post is deleted |
| `bitdrop:duel:wins:YYYY-MM` | sorted set, member = username, score = wins | Monthly **human** duel-wins board |
| `bitdrop:duel:wins:meta:YYYY-MM` | hash | `{ lastWinAt }` per human winner |
| `bitdrop:duel:botwins:YYYY-MM` | sorted set, member = username, score = wins | Monthly **bot** wins. Same UTC month, different key |
| `bitdrop:duel:botwins:meta:YYYY-MM` | hash | `{ lastWinAt }` per bot-board winner |

`YYYY-MM` is the UTC calendar month (`utcMonth` in `src/shared/duel.ts`). October is a new key, so the board resets with no cron. Rank is win count descending; equal wins break alphabetically by username.

### TTL

- Challenge, match, inbox, attacks: **7 days** after the last write.
- Monthly `bitdrop:duel:wins:*`, `bitdrop:duel:botwins:*`, and both credit hashes: **40 days** after the last write. That is longer than the solo 30-day score window so a board opened on day 1 of a 31-day month is still there at month end. Usernames drop when that month key expires. A new UTC month is a new key for both boards, so both reset with no cron.
- `onPostDelete` removes challenge and match records indexed for that post (and the usernames on those rows). The monthly wins sorted set is not per-post; those usernames stay until the `YYYY-MM` key expires.

## HTTP

All routes are under `/api/duel` and take the player from `reddit.getCurrentUsername()`. The client does not get to pick the stored name.

- `GET /state` — username, active match, and `queue: { joinedAt, waitedMs }` while waiting
- `POST /queue` — `{ width, viruses, speed }` joins the open-seat queue (or returns a match if one is already active or pairing succeeds)
- `POST /queue/leave` — drop the seat. Returns a match if a human was paired before the leave landed
- `POST /challenge` — `{ opponent, width, viruses, speed }` legacy direct challenge, not shown in the lobby
- `POST /challenge/:id/accept|decline|cancel`
- `GET /match/:id`
- `POST /match/:id/attack` — `{ attackId, round, colors }`
- `POST /match/:id/round` — `{ round, outcome: "win" \| "lose" }`
- `POST /match/:id/ready`
- `POST /match/:id/forfeit`
- `POST /match/:id/ack` — `{ ids }`
- `GET /wins` — monthly human board `{ month, rows: [{ player, wins, rank }] }`
- `GET /bot-wins` — monthly bot board, same shape, different Redis key
- `POST /bot-win` — `{ matchId: "bot-<uuid>" }` counts one win for the signed-in user on the bot board only. A repeat id does not count again

## Code map

| Piece | Where |
| --- | --- |
| Rules, keys, match view | `artifacts/devvit-bit-drop/src/shared/duel.ts` |
| Redis + routes | `src/server/core/duel.ts`, `src/server/routes/duel.ts` |
| Client API | `artifacts/claude-design/src/duel/` |
| Lobby, between-rounds, match over, wins | `src/ui/DuelLobby.tsx`, `DuelMatch.tsx`, `DuelResult.tsx`, `DuelWinsBoard.tsx` |
| Boards and garbage | `App.tsx` (`duelLive`, `noteClearRun`, `planGarbage`) |
| Play vs PC | `src/duel/botBoard.ts`, `src/duel/pcMatch.ts` — local play. A match win is `POST /bot-win` onto the monthly bot board |
