# BIT·DROP — Reddit 1v1 duels

Reddit duels run on the Devvit server. They do **not** use the live website’s text-message / challenge-link WebRTC flow (`Send this link by text`). That path stays on the website. The GitHub web build still hides compete unless `ENABLE_MULTIPLAYER=true`, and then it only shows the old disabled stub.

The Reddit playtest build (`artifacts/devvit-bit-drop`) bakes `PLATFORM=reddit` and `ENABLE_MULTIPLAYER=true`.

## How a match works

1. Challenger opens **1v1 DUEL**, types an opponent’s Reddit username, and sends. Board width, target squares, and speed are the challenger’s menu sliders (same ranges as solo: 8–24, 4–40, 1–9).
2. The server checks the name with `reddit.getCurrentUsername` / `getUserByUsername` and stores a pending challenge. The opponent sees it in **CHALLENGES FOR YOU** the next time they open the app on that post. A copyable post link (`?duel=<id>`) is optional; the in-app list is the real invite.
3. Accept starts a match. Challenger is P1. Both clients poll `GET /api/duel/match/:id` about every 800ms. If the Devvit realtime socket is up, a message on the post channel triggers the same refresh.
4. Each round is a normal clear-the-targets board. Clearing every target reports a round **win**. Topping out (or garbage with nowhere to land) reports a **loss**. First decisive report wins the round: a win awards that player, a loss awards the opponent. First to **3** round wins takes the match (best of 5).
5. Garbage matches the live `type:"attack"` payload as closely as the shared scanner allows: each colored match-4+ line sends that line’s color (`0–3`). The server queues it for the opponent. Between pills, those blocks fall in as non-target cells (shuffled columns, stacked from the bottom). A full ceiling loses the round.
6. After a round, both players tap **NEXT ROUND**. Forfeit gives the match to the opponent.

Solo high scores (`bitdrop:board` / `HighScoreBoard`) are unchanged. Duel rounds are not written there.

## What we did not use

| Idea | What happened |
| --- | --- |
| SMS / `tel:` / text-message invite | Not used on Reddit. Web live site still has “send this link by text”; this repo’s web app does not gain that path. |
| `reddit.sendPrivateMessage` | Deprecated in Devvit and documented as no longer reliable. No DMs. |
| Post comment ping | Skipped so challenges do not spam the game post. Pending list + optional copy link instead. |
| Opponent mini-map | Not ported. Garbage and the win count are the shared state. |
| Devvit realtime as the only transport | `realtime.send(postId, { kind: "duel", matchId })` is best-effort. If it throws, play continues on the poll. The web bundle never imports `@devvit/web/client`; `game.tsx` installs `window.__bitdropConnectRealtime`. |

## Redis keys

Per subreddit install. Usernames are the Reddit username, same as solo score submit.

| Key | Type | Meaning |
| --- | --- | --- |
| `bitdrop:duel:challenge:{id}` | string JSON | Challenge record |
| `bitdrop:duel:inbox:{username}` | hash, field = challenge id | Pending challenges for that player |
| `bitdrop:duel:outbox:{username}` | hash | Pending challenges they sent |
| `bitdrop:duel:active:{username}` | string | Current match id |
| `bitdrop:duel:match:{id}` | string JSON | Players, settings, forfeit, post id |
| `bitdrop:duel:rounds:{id}` | hash, field = round number | Round winner. `HSETNX` so the first report sticks |
| `bitdrop:duel:ready:{id}:{round}` | hash | Who tapped next round |
| `bitdrop:duel:atk:{id}` | hash, field = attack id | Garbage waiting for the opponent |
| `bitdrop:duel:atkseq:{id}` | int | Order for garbage drops |
| `bitdrop:duel:credited` | hash, field = match id | Winner already counted. Stops double credit |
| `bitdrop:duel:post:{postId}` | hash | Ids to drop if that post is deleted |
| `bitdrop:duel:wins:YYYY-MM` | sorted set, member = username, score = wins | Monthly duel-wins board |
| `bitdrop:duel:wins:meta:YYYY-MM` | hash | `{ lastWinAt }` per winner |

`YYYY-MM` is the UTC calendar month (`utcMonth` in `src/shared/duel.ts`). October is a new key, so the board resets with no cron. Rank is win count descending; equal wins break alphabetically by username.

### TTL

- Challenge, match, inbox, attacks: **7 days** after the last write.
- Monthly `bitdrop:duel:wins:*` and the credit hash: **40 days** after the last write. That is longer than the solo 30-day score window so a board opened on day 1 of a 31-day month is still there at month end. Usernames on the wins board drop when that key expires.
- `onPostDelete` removes challenge and match records indexed for that post (and the usernames on those rows). The monthly wins sorted set is not per-post; those usernames stay until the `YYYY-MM` key expires.

## HTTP

All routes are under `/api/duel` and take the player from `reddit.getCurrentUsername()`. The client does not get to pick the stored name.

- `GET /state` — username, inbox, outbox, active match
- `POST /challenge` — `{ opponent, width, viruses, speed }`
- `POST /challenge/:id/accept|decline|cancel`
- `GET /match/:id`
- `POST /match/:id/attack` — `{ attackId, round, colors }`
- `POST /match/:id/round` — `{ round, outcome: "win" \| "lose" }`
- `POST /match/:id/ready`
- `POST /match/:id/forfeit`
- `POST /match/:id/ack` — `{ ids }`
- `GET /wins` — `{ month, rows: [{ player, wins, rank }] }`

## Code map

| Piece | Where |
| --- | --- |
| Rules, keys, match view | `artifacts/devvit-bit-drop/src/shared/duel.ts` |
| Redis + routes | `src/server/core/duel.ts`, `src/server/routes/duel.ts` |
| Client API | `artifacts/claude-design/src/duel/` |
| Lobby, between-rounds, wins | `src/ui/DuelLobby.tsx`, `DuelMatch.tsx`, `DuelWinsBoard.tsx` |
| Boards and garbage | `App.tsx` (`duelLive`, `noteClearRun`, `planGarbage`) |
