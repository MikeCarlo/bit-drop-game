---
name: BIT-DROP verification quirks
description: How to visually verify BIT-DROP after landscape play shipped
---

- The game plays in portrait **and** landscape. There is no “ROTATE YOUR DEVICE” overlay.
- **Landscape:** play column is centered (phone-ish aspect); left/right gutters show square-block brand art.
- **Portrait:** full-bleed as before.
- **Inline Reddit splash** must stay feed-scroll-friendly (`splash.css`: `touch-action: pan-y`, no `preventDefault` on wheel/touchmove). Capture listeners attach only after START in expanded/web play.
- First-run tutorial gating uses localStorage key `bitdrop-tut`; clearing it re-triggers tutorial on START.
