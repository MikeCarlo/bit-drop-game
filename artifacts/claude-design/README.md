# Bit Drop (`@workspace/claude-design`)

Puzzle game. Portrait is full-bleed; landscape centers the play column and fills the side gutters with block brand art.

## Scripts

```bash
# Replit / local preview (PORT required by the artifact, default 24722)
PORT=24722 pnpm --filter @workspace/claude-design run dev

PORT=24722 pnpm --filter @workspace/claude-design run build
pnpm --filter @workspace/claude-design run typecheck
```

## Feature flags

Set `PLATFORM`, `ENABLE_MULTIPLAYER`, and `ENABLE_LEADERBOARD` (or the `VITE_*` forms). See [docs/reddit-phase1.md](../../docs/reddit-phase1.md) and `.env.example`.

Phase 1 defaults: `web`, multiplayer **off**, leaderboard **on**.

`PLATFORM=reddit` uses `RemoteLeaderboardStore` (`/api/scores`). For a working board, playtest the Devvit app — see [../devvit-bit-drop/README.md](../devvit-bit-drop/README.md).
