# Bit Drop — Reddit Phase 1

Website vs Reddit inventory, scoring rules, and gap list: [website-vs-reddit-parity.md](./website-vs-reddit-parity.md).

Prepare the existing Vite game (`artifacts/claude-design`) for Reddit. Phase 1 gameplay ships as a Devvit Web app in `artifacts/devvit-bit-drop` (playtest only — not published).

Reddit **1v1 duels** and the monthly duel-wins board are documented in [reddit-duel.md](./reddit-duel.md). **Find a challenger** joins a Devvit Redis queue. **START NOW** on that lobby plays a local bot at a random skill from 1 (easy) to 10 (hard), shown as **BOT · SKILL N**. A win there counts on the monthly **bot board** only, not the human duel board. The web app’s text-link friend duel stays on the live site. There is no SMS.

## What already existed

- Single-player Dr. Mario–style puzzle in `artifacts/claude-design`.
- Screens: menu, play, win/lose, scoring (`LearnPage`), tutorial.
- One personal best in `localStorage` key `bitdrop-best`.
- Tutorial gate: `bitdrop-tut`. Settings: `bitdrop-w` / `bitdrop-v` / `bitdrop-s` / `bitdrop-snd` (SFX). No music — no `bitdrop-music`, no MUSIC toggle, no autoplay loop.
- Portrait and landscape. Landscape centers the play column and fills side gutters with block brand art. No rotate-device blocker.
- **No** multiplayer, lobby, or high-score *board* (only a single best number).

## Feature flags

Flags are build-time / env values, read in `src/flags.ts`. `vite.config.ts` hoists bare names into the `VITE_*` keys Vite exposes to the client.

| Flag | Values | Phase 1 default | Meaning |
| --- | --- | --- | --- |
| `PLATFORM` / `VITE_PLATFORM` | `web` \| `reddit` | `web` | Host surface. `web` is Replit/Vite. `reddit` is the future Devvit target. |
| `ENABLE_MULTIPLAYER` / `VITE_ENABLE_MULTIPLAYER` | bool | `false` on web, **`true` on the Devvit build** | Web: off hides compete; on shows the disabled stub. Reddit: on opens 1v1 duels ([reddit-duel.md](./reddit-duel.md)). |
| `ENABLE_LEADERBOARD` / `VITE_ENABLE_LEADERBOARD` | bool | `true` | Personal high-score board after game over and from the menu. |

Booleans accept `1/true/yes/on` and `0/false/no/off`.

### How to flip them

```bash
# Web / Replit (defaults)
PORT=24722 pnpm --filter @workspace/claude-design run dev

# Explicit Phase 1
PLATFORM=web ENABLE_MULTIPLAYER=false ENABLE_LEADERBOARD=true \
  PORT=24722 pnpm --filter @workspace/claude-design run dev

# Reddit / Devvit playtest (Redis scores — must run on Reddit, not localhost)
cd artifacts/devvit-bit-drop && pnpm run login && pnpm run dev

# Reddit-shaped Vite build of the web app (uses RemoteLeaderboardStore → /api/scores).
# The Devvit package bakes ENABLE_MULTIPLAYER=true itself; this command is the web artifact.
PLATFORM=reddit ENABLE_MULTIPLAYER=true ENABLE_LEADERBOARD=true \
  PORT=24722 pnpm --filter @workspace/claude-design run build

# Web preview of the disabled compete stub (no match, no SMS)
ENABLE_MULTIPLAYER=true PORT=24722 pnpm --filter @workspace/claude-design run dev
```

Or copy `artifacts/claude-design/.env.example` to `.env`.

## High-score board

UI: `src/ui/HighScoreBoard.tsx` — menu **HIGH SCORES** screen and a compact list on win/lose.

Storage talks only to `LeaderboardStore` (`src/leaderboard/types.ts`):

- `list(limit)` — ranked rows
- `submit(entry)` — persist a finished solo game, return rank + personal-best
- `best()` — top score

Phase 1 implementation: `LocalLeaderboardStore` (`localStorage` key `bitdrop-scores`). It migrates the old `bitdrop-best` number into the first row and keeps that key in sync.

### Reddit / Devvit Redis

Do **not** rewrite the board UI. `createLeaderboardStore()` returns `RemoteLeaderboardStore` when `FLAGS.platform === 'reddit'`. That client calls `/api/scores` on the Devvit server (`artifacts/devvit-bit-drop`).

Devvit pattern (per subreddit install, not global):

- Sorted set `bitdrop:board`: `zAdd` / `zRange` (by rank) / `zRank`
- Hash `bitdrop:rows` for row metadata (`won`, settings, timestamp, username, `postId`)
- Hash `bitdrop:best` for per-user personal best
- 30-day Redis `expire` on those keys, plus prune-by-`playedAt` and a daily scheduler
- `onPostDelete` drops rows submitted from the deleted post (usernames go with them)
- Do not rely on `localStorage` for scores that must survive app updates

`ScoreRecord.player` is `"You"` on web; the Devvit submit path overwrites it with `reddit.getCurrentUsername()`.

## Multiplayer

`ENABLE_MULTIPLAYER=false` on the web artifact hides every compete control. Play stays solo. Tutorial UX is unchanged. Portrait and landscape both play.

On **web**, `ENABLE_MULTIPLAYER=true` still shows `CompeteStub` (disabled). It does not start a match and it does not send texts.

On **Reddit**, the Devvit build turns the flag on and replaces that stub with **FIND A CHALLENGER**. See [reddit-duel.md](./reddit-duel.md). `resolvePlayMode('compete')` is `compete` only in that Reddit case. `startCompete()` stays null — 2–4 player rooms are not a mode. The monthly board is `GET /api/duel/wins`, not `HighScoreBoard`. Bot games are not on that board.

Out of scope: 4-player competition, YouTube Playables, and `devvit publish` (Mike publishes after playtest).
