# BIT·DROP

Puzzle game (match 4, clear target squares). Plays in portrait and landscape.

- **Web / Replit:** `artifacts/claude-design`
- **Reddit playtest (Devvit Web):** `artifacts/devvit-bit-drop`

Phase 1 is solo + a high-score board. Phase 2 multiplayer is flags/stubs only.

## Reddit playtest (Mike)

The Devvit backend (Redis scores, Reddit username) **does not work on localhost**. Play on Reddit.

```bash
cd artifacts/devvit-bit-drop
pnpm install          # first time (isolated from the repo workspace)
pnpm run login        # `devvit login` — browser OAuth, token → ~/.devvit/token
pnpm run dev          # `devvit playtest`
```

When the CLI prints **Playtest ready**, open the URL it gives you:

`https://www.reddit.com/r/<test_sub>/?playtest=bit-drop`

Refresh that page. Tap **PLAY** on the splash, then play in portrait or landscape. The inline splash must not trap Reddit feed scroll.

Full notes: [artifacts/devvit-bit-drop/README.md](artifacts/devvit-bit-drop/README.md). Publishing (`devvit publish`) is Mike’s step after playtest.

## Web preview

```bash
PORT=24722 pnpm --filter @workspace/claude-design run dev
```

Flags and the `LeaderboardStore` swap path: [docs/reddit-phase1.md](docs/reddit-phase1.md).
