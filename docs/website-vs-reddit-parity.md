# BIT·DROP — Website vs Reddit parity

Audit of the **original website game** against the **Reddit Devvit playtest**. Scoring is called out first because Mike reported a Reddit bug. Website (live + its shipped JS) is the source of truth for gameplay.

Do not republish to Reddit from this work; Chief ships after merge.

---

## Sources (do not invent)

| Surface | What was read | Date / ref |
| --- | --- | --- |
| **Live website** | https://bit-drop-a-mobile-puzzle-game.replit.app | HTML `Last-Modified: Wed, 02 Sep 2026 16:49:07 GMT` |
| Live bundle | `/assets/index-CWLN84aj.js` (253 544 bytes) | Same deployment. Method names below (`_flushDrop`, `doClear`, `nextLevel`, …) are from that file. |
| **GitHub shared game** | `artifacts/claude-design/src/App.tsx` (+ `LearnPage`, `flags`, `leaderboard`, `input`) | `main` at audit (`5da6685`, includes PR #7 single-tap rotate) |
| **Reddit wrapper** | `artifacts/devvit-bit-drop/` | Mounts the shared `App` via `@bitdrop` alias. No gameplay fork. |
| Prior notes | `docs/reddit-phase1.md`, `artifacts/*/README.md` | Phase 1 flags / Redis board |

The live Replit app is **not** the same build as GitHub `artifacts/claude-design`. It is an older, fuller game (levels, friend duel, ghost, save, music) published 2026-09-02. Reddit plays the **Phase 1 GitHub `App`**, not that Sep-2 bundle.

Three columns matter:

1. **Live website** — original product Mike is comparing against.
2. **Shared `App` (GitHub)** — what both the Replit/Vite web target *in this repo* and Reddit actually run after this PR.
3. **Reddit wrapper** — splash, Redis, Devvit post. Does not reimplement the puzzle.

---

## Scoring verdict (Mike’s bug)

### What Mike said

On Reddit, points are added **every time a set/match is removed**. Correct behavior: score **only when, inside that clear sequence, a target square is removed**.

### What the live website actually does

Confirmed in `index-CWLN84aj.js` (`doClear`, `_flushDrop`, `lock`, `spawn`, `gameOver`):

1. **`doClear` does not add `state.score`.** It adds per-cell *base* into `dropBasePoints` and sets `chainHadTarget = true` if any cleared cell has `t === true`. Target count still decrements `left` (win condition).
2. Per-cell base: `Math.round((cell.t ? 50 : 10) * lenBonus(runLen) * ghostMul)`  
   - `lenBonus = min(len - 3, 5)` → 4=x1, 5=x2, 6=x3, 7=x4, 8+=x5  
   - `ghostMul` is `0.65` when **GHOST BLOCK** is on (live default), else `1`. Label in UI: “-35% score when on”.
3. Distinct H/V match-4+ runs in that flash increment `dropRunCount` (a cross / two lines in one clear adds 2). Cascades **add** to the same counters.
4. **`this.chain` is incremented for SFX + the tutorial “chain” goal only.** It is **not** multiplied into points on the live site.
5. When the sequence ends (`spawn` next pill, or `gameOver`):

   ```
   _flushDrop():
     if (!chainHadTarget || dropRunCount === 0) return 0
     pts = dropBasePoints * dropRunCount
   ```

   A drop that only clears regular pieces scores **0**. A cascade that later hits a target awards **the whole sequence** (earlier no-target clears included) × the total line count.
6. `lock()` of a new pill resets `chain = 1`, `chainHadTarget`, `dropBasePoints`, `dropRunCount`.

Worked example (same 840 as LearnPage, ghost **off**): 6-in-a-row, two targets, two lines in the drop:

`(50+50+10+10+10+10) × 3 × 2 = 840`.

### What Reddit / GitHub `App` did before this PR

One shared function, `artifacts/claude-design/src/App.tsx` `doClear`:

```ts
pts += (cell.t ? 50 : 10) * this.chain * this.lenBonus(runLen);
this.setState({ score: this.state.score + pts, left });
```

- Awarded on **every** match-4+ clear, target or not.
- Multiplied by `this.chain` (1, then 2, …) instead of `dropRunCount` at flush.
- No ghost multiplier (Phase 1 has no ghost).

Reddit does **not** have a second scorer. `game.tsx` is `import App from '@bitdrop/App'`. Mike was seeing the shared Phase 1 formula.

### Was this “intended design vs current website”?

No. The **live website already target-gates** and has done so since that Sep-2 bundle (`chainHadTarget` / `_flushDrop`). GitHub Phase 1 simplified the formula and scored every clear. Tutorial/Learn copy on both surfaces still talked about “each piece = 10 pts” without the gate — that copy was stale vs live JS.

### Fix in this PR (shared)

`artifacts/claude-design/src/scoring.ts` + `App.tsx` now follow the live flush rules (ghost mul = 1; Phase 1 has no ghost assist). Reddit picks it up automatically. Tests: `src/scoring.test.ts`.

---

## 1. Live website inventory (Sep 2 bundle)

### Screens / modes / menus

| Screen | How you get there | Notes |
| --- | --- | --- |
| Home / menu | Boot | Title **BIT·DROP**, tagline “match 4… wipe out every target square”. Collapsible **SETTINGS +/−**. **RESUME GAME** if `bitdrop-save` exists. **START**, **PLAY WITH A FRIEND**, **TUTORIAL**, **SCORING**. **BEST SCORE** / **BEST LEVEL**. Control hint: “drag ◀▶ to move · tap to rotate · swipe ▼ to hard drop”. |
| Settings (on home) | SETTINGS + | BOARD WIDTH 8–24, TARGET SQUARES 4–40, SPEED 1–9, SOUND, **GHOST BLOCK** (default on, −35% score). |
| Scoring / Learn | SCORING | Same `LearnPage` structure as GitHub (match 4, targets, big lines, chains, 840 example, finger demos). Live copy still omitted the target-gate. |
| Tutorial | TUTORIAL or first START if `bitdrop-tut` unset | 8 steps: MOVE, ROTATE, HARD DROP, MATCH 4, TARGET SQUARES, BIG LINES, CHAIN REACTIONS, RAINBOW BLOCK. Skip writes `bitdrop-tut=1`. Complete → PLAY NOW / MENU. |
| Play (solo) | START / NEXT LEVEL / RESUME | HUD: `score`, `targets {left}`, **LVL {n}**, PAUSE. Next-pill preview. Ghost landing outline if ghost on. Score popups on flush. |
| Pause | PAUSE or `p` | RESUME, SOUND FX, **MUSIC**, QUIT. (Home settings do not expose music; pause does.) |
| Round win | All targets cleared | **ROUND SUMMARY** (base pts, bonus pts, multipliers). **NEXT LEVEL ▶**. Score **carries**. Not “LEVEL CLEAR / PLAY AGAIN”. |
| Game over | Spawn blocked | LAST LEVEL, score, best, best level, PLAY AGAIN, share / challenge a friend. |
| Friend match | PLAY WITH A FRIEND | Lobby: create/join room, **DIRECT DUEL** (challenge + acceptance links), hide-opponent-minimap toggle, P1 sets width/viruses/speed, first to 3 in a 5-game set, incoming garbage (`type:"attack"`). |
| Landscape | Mobile + landscape | Full-screen **ROTATE YOUR DEVICE** (`isLandscapeBlocked = landscape && mobileGameplay`). **Desktop landscape is allowed** (`detectMobileGameplayContext`: UA / coarse pointer). Board draw goes black-bg in desktop landscape. |

No high-score *board*. One `bitdrop-best` number + `bitdrop-best-level`.

### Scoring (exact; live JS)

See [Scoring verdict](#scoring-verdict-mikes-bug). Additional live-only:

- Flush also drives `_accRound` / `_showDropPopups` (mult popup then score popup) and the win **ROUND SUMMARY**.
- URL query `?v=&s=&w=` writes settings (`w` clamped 6–14 in the query path; sliders are still 8–24).
- Share text: `BIT-DROP — I reached Level {n} ({viruses+(n-1)*2} targets!) with a score of {score}`.

### Controls (live)

| Input | Behavior |
| --- | --- |
| Touch drag ◀▶ | Move; step every `0.75 * cellPx`; hold-repeat 110 ms if offset `> 1.2` cells. Motion `> 10px` marks `moved`. |
| Unmoved tap | `touchend`: `active && !moved && !dropped && duration < 400ms` → **one rotate**. |
| 2nd finger | `touches.length > 1` → rotate. |
| Swipe ▼ | `dy > 2.6 * cellPx` and more vertical than horizontal → hard drop. |
| Keyboard | ◀▶ move, ▲ / Space rotate, ▼ soft/fast drop (45 ms), `p` pause. |
| Mouse | **No** pointer/click rotate on the canvas. Desktop play is keyboard (and touch if present). |
| Settings affecting control | None besides pause. Ghost is visual + score mul, not input. |

Fall interval: `fastDrop ? 45 : tutorial ? 1400 : 1000 - speed * 90`. Lock delay 500 ms.

### Win / lose / levels

- Win a **round** when `left <= 0` after a clear (`winPending`), then gravity finishes.
- `nextLevel()`: `level + 1`, target count = `viruses + (level - 1) * 2`, rebuild board, **keep score**, reset drop accumulators.
- Lose: next pill overlaps locked cells (`spawn` → `gameOver(false)`).
- No infinite “one board” — progression is the product loop.

### Persistence (live `localStorage`)

| Key | Default if unset | Purpose |
| --- | --- | --- |
| `bitdrop-w` | **10** | Board width |
| `bitdrop-v` | **12** | Target squares (level 1) |
| `bitdrop-s` | **4** | Speed |
| `bitdrop-snd` | on (`!== '0'`) | SFX |
| `bitdrop-music` | on | Music |
| `bitdrop-ghost` | on | Ghost + 0.65 score |
| `bitdrop-tut` | unset = first-run tutorial | Tutorial gate |
| `bitdrop-best` | 0 | Best score |
| `bitdrop-best-level` | 1 | Best level |
| `bitdrop-save` | — | Mid-run save (level, score, grid, pill, nextPill) |
| `bitdrop-hide-opponent-map` | hidden unless `'0'` | MP minimap |
| `bitdrop-mp-token` | generated `p_…` | P2P client id |
| `bitdrop-p2p-duel` | — | Direct-duel handshake |

### Feature flags (live)

None of the GitHub `PLATFORM` / `ENABLE_*` flags. Multiplayer is always in the menu.

### Other live systems

- Rainbow wildcard 15% on a pill half; never both halves rainbow. All-rainbow runs do not clear.
- Targets do not fall. Linked pill halves fall together.
- Bidirectional `checkClears` scan (L→R and R→L, T→B and B→T). Phase 1 GitHub scans only L→R and T→B; same result for ordinary runs.
- Music + SFX (WebAudio).
- `mobileGameplay` detection as above.

---

## 2. Shared GitHub `App` + Reddit wrapper

### Shared game (`artifacts/claude-design`)

Phase 1 solo puzzle. Screens: **menu, play, win, lose, learn, scores**. No levels, no save, no ghost, no music, no next-pill, no friend duel.

| Item | GitHub `App` (this repo) |
| --- | --- |
| Menu | Sliders always visible (not SETTINGS+). START, TUTORIAL, SCORING, **HIGH SCORES** if `ENABLE_LEADERBOARD`, **CompeteStub** only if `ENABLE_MULTIPLAYER`. Footer `{platform} · {solo\|compete-ready}`. |
| Defaults | width **19**, viruses **4**, speed **3** (PR #3). Sound on. |
| Tutorial | Same 8 goals as live. |
| Win / lose | **LEVEL CLEAR!** / **GAME OVER**. PLAY AGAIN (same settings, score resets), HIGH SCORES, SETTINGS. No next level. |
| Landscape | **Always** blocked (`matchMedia(orientation: landscape)`). No desktop-landscape exception. |
| Controls (PR #7) | Pointer + touch + click fallback. Single unmoved tap/click rotates (14 px slop). 2nd finger rotate. Hard-drop swipe `> 1.6` cells (live is `2.6`). Keyboard same. |
| Scoring (after this PR) | Live flush / target-gate. Ghost mul = 1. |
| Persistence | `bitdrop-w/v/s/snd/tut/best` + `bitdrop-scores` (web leaderboard). |
| Flags | `PLATFORM` web\|reddit, `ENABLE_MULTIPLAYER` default false, `ENABLE_LEADERBOARD` default true. `src/flags.ts`. |

### Reddit-only wrapper (`artifacts/devvit-bit-drop`)

| Piece | Role |
| --- | --- |
| `src/client/splash.tsx` | Inline post: “hey {username} — match 4…”, **PLAY** → `requestExpandedMode(..., 'game')`. |
| `src/client/game.tsx` | `createRoot` + shared `App`. No props, no patch. |
| `vite.config.ts` | Alias `@bitdrop` → `../claude-design/src`. Bakes `PLATFORM=reddit`, multiplayer off, leaderboard on. React 19 vs web React 18. |
| `src/server/core/leaderboard.ts` | Redis `bitdrop:board` (zset), `bitdrop:rows` (hash), `bitdrop:best` (per-username). Cap 20, list 10. |
| `src/server/routes/api.ts` | `GET /api/init` (unused by client), `GET/POST /api/scores`, `GET /api/scores/best`. Submit overwrites `player` with `reddit.getCurrentUsername()`. |
| `src/server/core/post.ts` | Custom post title `BIT·DROP — match 4, clear the targets`. |
| Menu / trigger | Mod: “Create a BIT·DROP post”. `onAppInstall` creates a post. |

Reddit webview still uses shared `localStorage` for settings + tutorial + legacy `bitdrop-best`. Scores go to Redis, not `bitdrop-scores`.

---

## 3. Gap list

Legend: **Parity** = same rule/UI in live *and* Reddit (shared App). **Missing on Reddit** = live has it, Reddit/GitHub does not. **Different** = both have a version, behavior/copy/defaults differ. **Website-only** = same as missing, called out as product surface. **Reddit-only** = wrapper / Phase 1 extras not on the Sep-2 site.

### Gameplay / scoring / progression

| Item | Status | Notes |
| --- | --- | --- |
| Match-4 H/V, rainbow wildcard, targets don’t fall, lock 500 ms, fall curve `1000-speed*90` | **Parity** | Shared `App` + live. |
| Target-gated flush scoring | **Parity after this PR** | Was **Different** (GitHub scored every clear). |
| `dropRunCount` sequence multiplier vs `this.chain` | **Parity after this PR** | |
| Ghost −35% score | **Website-only** | No ghost setting on Reddit. Equivalent to ghost **off** (mul 1). |
| Level loop (`nextLevel`, +2 targets/level, score carries) | **Website-only / Missing on Reddit** | Reddit win is a single board, PLAY AGAIN resets score. |
| Mid-run save / RESUME | **Website-only** | `bitdrop-save`. |
| Next-pill preview | **Website-only** | |
| Score popups / round summary | **Website-only** | |
| Best level | **Website-only** | `bitdrop-best-level`. |
| Friend match / P2P duel / garbage | **Website-only** | GitHub `CompeteStub` is a disabled Phase 2 hook, not this duel. |
| Bidirectional clear scan | **Different** (minor) | Live scans both ways; GitHub one way. Ordinary + rainbow-from-either-end runs still clear. |
| First-run tutorial gate | **Parity** | `bitdrop-tut`. |

### Controls

| Item | Status | Notes |
| --- | --- | --- |
| Drag move, 2nd-finger rotate, ▼ hard drop, keyboard | **Parity** | |
| Single-tap rotate | **Parity** (adapted) | Live: `touchend` &lt; 400 ms. GitHub/Reddit (PR #7): pointer/touch/click, 14 px slop, no 400 ms cap — Reddit webview swallows first tap / multitouch. |
| Mouse/click rotate | **Different** | Live: none. GitHub/Reddit: click/pointer rotate so desktop + Devvit work. |
| Hard-drop threshold | **Different** | Live `2.6 × cell`. GitHub `1.6 × cell` (`App.tsx` `movePrimary`). |
| Landscape | **Different** | Live: block **mobile** landscape only. Reddit/GitHub: block all landscape. |

### UI / copy / settings

| Item | Status | Notes |
| --- | --- | --- |
| Pixel HUD, Press Start 2P, pause, tutorial banners | **Parity** | |
| SETTINGS+ accordion, GHOST, MUSIC | **Website-only** | GitHub shows sliders always; SFX only. |
| Menu defaults | **Different** | Live 10 / 12 / 4. GitHub/Reddit 19 / 4 / 3 (`App.tsx` state + PR #3). |
| Win chrome | **Different** | Live NEXT LEVEL + summary. Reddit LEVEL CLEAR + leaderboard rank. |
| Learn page target-gate copy | **Parity after this PR** | Live Learn still omits the gate (stale vs its own JS). |
| HIGH SCORES board | **Reddit-only** (and GitHub web Phase 1) | Live: single best number. |
| Platform footer `reddit · solo` | **Reddit-only** | `FLAGS`. |
| Splash “hey {user} / PLAY” | **Reddit-only** | `splash.tsx`. Not the in-game menu. |
| Portrait-only rotate blocker on desktop | **Different** | See landscape row. |

### Persistence / flags / backend

| Item | Status | Notes |
| --- | --- | --- |
| Settings + tut keys | **Parity** (same key names) | Defaults differ (above). |
| Score store | **Different** | Live: `bitdrop-best` only. GitHub web: `LocalLeaderboardStore` / `bitdrop-scores`. Reddit: Redis via `RemoteLeaderboardStore`. |
| `best()` meaning | **Different** | Web local: top of *your* list. Reddit `bestScore()`: **subreddit** top. HUD `best:` can show the community top after `refreshScores`. |
| `personalBest` | **Different** | Local store: `score >= board top`. Redis: vs that username’s previous. |
| Submit `player` | **Different** | Client always sends `"You"` (`App.tsx` `recordScore`). Reddit server replaces with Reddit username. |
| `GET /api/init` | **Reddit-only** | Unused by `App`. |
| Feature flags | **Reddit / GitHub-only** | Live has none. |
| React version | **Different** | Web artifact React 18; Devvit React 19. Same `App` source. |

### Files (Reddit vs mounting `App`)

| Path | Gap |
| --- | --- |
| `artifacts/devvit-bit-drop/src/client/game.tsx` | Parity mount. |
| `artifacts/devvit-bit-drop/src/client/splash.tsx` | Reddit-only screen. |
| `artifacts/devvit-bit-drop/src/server/core/leaderboard.ts` | Reddit-only persistence. |
| `artifacts/devvit-bit-drop/vite.config.ts` | Reddit-only flag bake + alias. |
| `artifacts/claude-design/src/App.tsx` | Shared gameplay. Scoring aligned to live in this PR. |
| `artifacts/claude-design/src/scoring.ts` | Shared scoring extracted from live JS. |

---

## 4. What this PR changes vs what it does not

**Changed (shared, so Reddit matches live scoring):**

- `doClear` accumulates; HUD score updates on `spawn` / `gameOver` flush.
- Zero points unless a target was removed in that drop sequence.
- Sequence multiplier = line count (`dropRunCount`), not `this.chain`.
- Learn page copy + unit tests for the live formula.

**Not ported** (documented only; would be a product rebuild, not a scoring bugfix):

- Levels, save/resume, ghost, music, next pill, popups, friend duel, desktop-landscape play, live defaults 10/12/4, 2.6-cell hard-drop threshold.

If Mike wants those on Reddit, treat them as a Phase follow-up against the Sep-2 bundle, not as “Reddit scored wrong.”

---

## 5. How to re-verify

```bash
# scoring rules (no browser)
node --experimental-strip-types --test artifacts/claude-design/src/scoring.test.ts

pnpm --filter @workspace/claude-design run typecheck
pnpm --filter @workspace/claude-design run build

cd artifacts/devvit-bit-drop && pnpm run typecheck && pnpm run build
```

Manual: start a game, clear 4 with **no** target → HUD score stays 0; clear a line that includes a target → score jumps once when the sequence settles (next pill), not on the flash.

Live site (portrait): same — score popups only after a target-bearing drop.
