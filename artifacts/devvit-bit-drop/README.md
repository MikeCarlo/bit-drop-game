# BIT·DROP — Reddit Devvit playtest

Phase 1 solo puzzle + high-score board, packaged as a [Devvit Web](https://developers.reddit.com/docs/introduction/intro-games) React app.

The game UI is reused from `artifacts/claude-design`. Scores persist in **Devvit Redis** (per subreddit install) through the existing `LeaderboardStore` interface.

Feature flags baked into this package:

| Flag | Value |
| --- | --- |
| `PLATFORM` | `reddit` |
| `ENABLE_MULTIPLAYER` | `false` (Phase 2 compete is a stub only) |
| `ENABLE_LEADERBOARD` | `true` |

## How Mike playtests

The Devvit **server (Redis, Reddit username) does not run on bare localhost**. You must playtest on Reddit.

### 1. Reddit developer login

From this folder (or any machine with Node 24+):

```bash
cd artifacts/devvit-bit-drop
pnpm install   # first time only — this folder is its own install (not the repo workspace)
pnpm run login # same as: npx devvit login
```

`devvit login` opens a browser. Sign in with the Reddit account that will own the app, then return to the terminal. The CLI stores a token under `~/.devvit/token`.

You need a Reddit account connected at [developers.reddit.com](https://developers.reddit.com).

### 2. Start playtest

```bash
pnpm run dev
# same as: npx devvit playtest
```

`devvit playtest` uploads the app, creates (or reuses) a **test subreddit** you moderate, and watches `vite build`. When it is ready you will see:

```
✓ Playtest ready
➜ URL: https://www.reddit.com/r/<something>_dev/?playtest=bit-drop
➜ Version: v0.0.0.x
```

**Open that URL in a browser (or the Reddit app) and refresh.** That is the playtest URL.

To pin a subreddit you already moderate (< 200 subscribers):

```bash
npx devvit playtest r/YOUR_TEST_SUB
```

or set `DEVVIT_SUBREDDIT=YOUR_TEST_SUB`.

### 3. Play

1. The feed post shows the **BIT·DROP splash** (inline first screen).
2. Tap **PLAY** — Devvit expands into the game (`requestExpandedMode` → `game` entry).
3. Use **START** / tutorial / **HIGH SCORES** as in Phase 1.
4. After a game, scores save to Redis under your Reddit username.

Moderators can also use the subreddit menu item **Create a BIT·DROP post**.

### 4. Portrait testing

BIT·DROP is **portrait-only**. Landscape shows the rotate blocker on purpose.

- Phone: Reddit iOS/Android app, or mobile Safari/Chrome.
- Desktop: DevTools device mode, portrait (e.g. 390×844). A wide window will show “ROTATE YOUR DEVICE”.

Do not publish from this PR. When you are ready later: `npx devvit upload` / `npx devvit publish` (out of scope here).

## Scripts

```bash
pnpm --filter @workspace/devvit-bit-drop run typecheck
pnpm --filter @workspace/devvit-bit-drop run build
pnpm --filter @workspace/devvit-bit-drop run login
pnpm --filter @workspace/devvit-bit-drop run dev
```

## Layout

- `src/client/splash.*` — inline first screen (tap **PLAY**)
- `src/client/game.tsx` — expanded view; mounts the Phase 1 React game
- `src/server` — Hono + `@devvit/web/server` (`redis`, `reddit`, `context`)
- `src/server/core/leaderboard.ts` — Redis sorted set + hash metadata
