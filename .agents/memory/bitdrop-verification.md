---
name: BIT-DROP verification quirks
description: How to (and not to) visually verify the portrait-only BIT-DROP game
---

- The game is portrait-only; a landscape orientation shows a full-screen "ROTATE YOUR DEVICE" blocker.
- **Why:** the Screenshot tool renders landscape, so app screenshots always show the rotate blocker — this is correct behavior, not a bug. Don't burn rounds trying to screenshot gameplay.
- **How to apply:** verify via HMR logs + `npx tsc --noEmit` in `artifacts/claude-design`, and delegate gameplay checks to code review/reasoning. `appPreview` screenshots via localhost:80 proxy refuse connections; use `externalUrl` with `https://$REPLIT_DEV_DOMAIN/` (curl-probe 200 first) if a screenshot is truly needed.
- First-run tutorial gating uses localStorage key `bitdrop-tut`; clearing it re-triggers tutorial on START.
