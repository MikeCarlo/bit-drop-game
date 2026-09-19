# Bit Drop — Reddit Phase 1

Prepare the existing Vite game (`artifacts/claude-design`) for a later Reddit Devvit Web publish. This phase does **not** ship a `devvit.json` app or realtime multiplayer.

## What already existed

- Single-player Dr. Mario–style puzzle in `artifacts/claude-design`.
- Screens: menu, play, win/lose, scoring (`LearnPage`), tutorial.
- One personal best in `localStorage` key `bitdrop-best`.
- Tutorial gate: `bitdrop-tut`. Settings: `bitdrop-w` / `bitdrop-v` / `bitdrop-s` / `bitdrop-snd`.
- Portrait-only; landscape shows the rotate blocker on purpose.
- **No** multiplayer, lobby, or high-score *board* (only a single best number).

## Feature flags

Flags are build-time / env values, read in `src/flags.ts`. `vite.config.ts` hoists bare names into the `VITE_*` keys Vite exposes to the client.

| Flag | Values | Phase 1 default | Meaning |
| --- | --- | --- | --- |
| `PLATFORM` / `VITE_PLATFORM` | `web` \| `reddit` | `web` | Host surface. `web` is Replit/Vite. `reddit` is the future Devvit target. |
| `ENABLE_MULTIPLAYER` / `VITE_ENABLE_MULTIPLAYER` | bool | `false` | When off, compete UI is hidden and play is solo-only. |
| `ENABLE_LEADERBOARD` / `VITE_ENABLE_LEADERBOARD` | bool | `true` | Personal high-score board after game over and from the menu. |

Booleans accept `1/true/yes/on` and `0/false/no/off`.

### How to flip them

```bash
# Web / Replit (defaults)
PORT=24722 pnpm --filter @workspace/claude-design run dev

# Explicit Phase 1
PLATFORM=web ENABLE_MULTIPLAYER=false ENABLE_LEADERBOARD=true \
  PORT=24722 pnpm --filter @workspace/claude-design run dev

# Reddit-shaped build (still the Vite app; storage stays local until a Devvit adapter lands)
PLATFORM=reddit ENABLE_MULTIPLAYER=false ENABLE_LEADERBOARD=true \
  PORT=24722 pnpm --filter @workspace/claude-design run build

# Preview the Phase 2 compete stub (no real match)
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

### Switching to Reddit / Devvit Redis later

Do **not** rewrite the board UI. Add a `DevvitRedisStore implements LeaderboardStore` and switch on it in `createLeaderboardStore()` when `FLAGS.platform === 'reddit'`.

Devvit pattern (per subreddit install, not global):

- Sorted set for ranks: `ZADD` / `ZREVRANGE` / `ZREVRANK`
- Hash (or JSON string) for row metadata (`won`, settings, timestamp, username)
- Do not rely on `localStorage` for scores that must survive app updates

`ScoreRecord.player` is `"You"` on web; fill the Reddit username on the remote submit path.

## Phase 2 multiplayer flag (hooks only)

`ENABLE_MULTIPLAYER=false` (default) hides every compete control. The game always starts solo. Tutorial and portrait UX are unchanged.

When the flag is **true**, `CompeteStub` appears on the menu. It does not start a match.

Plug-in points (already exported, still no-ops):

| Hook | File | Phase 2 job |
| --- | --- | --- |
| `canOpenCompeteLobby()` | `src/modes.ts` | Gate the lobby on flag + server readiness |
| `startCompete(seats)` | `src/modes.ts` | Devvit realtime / post-thread matchmaking, 2–4 players |
| `CompeteStub` | `src/ui/CompeteStub.tsx` | Replace the disabled button with a real lobby |
| `resolvePlayMode()` | `src/modes.ts` | Return `'compete'` once a session exists |
| `createLeaderboardStore()` | `src/leaderboard/index.ts` | Optional shared compete board on Redis |

Out of scope here: realtime 4-player competition, YouTube Playables, and a publishable `devvit.json` app.
