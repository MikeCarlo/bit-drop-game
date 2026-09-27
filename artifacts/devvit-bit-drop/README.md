# BIT·DROP

BIT·DROP is a short puzzle game for Reddit. You drop two-color pills, line up **four of the same color**, and wipe every **target square**. It is a casual solo high-score game — not a chat app and not a moderation tool.

**Who it is for:** anyone who wants a quick puzzle in the feed. The home community is [r/BitDropGame](https://www.reddit.com/r/BitDropGame).

## How to play

1. In the feed you will see the **BIT·DROP** splash. Tap **PLAY** to open the full game.
2. On the menu, optionally change board width, target count, and speed. Tap **START**. The first time, a short tutorial runs; you can skip it.
3. **Match 4.** Line up 4 or more of one color (row or column) to clear those pieces. Rainbow blocks match any color.
4. **Targets.** Squares with a face are targets. Clear every target to win the board.
5. **Scores.** Points count only when a drop also clears at least one target. After a solo game, your score is saved to this community’s high-score board under your Reddit username.
6. **1v1 duel (Reddit only).** From the menu, **FIND A CHALLENGER**. You wait in a lobby until another player on this community is waiting too. The timer shows how long you have waited. **START NOW** leaves the queue and plays a bot (first to 3, with garbage). Beating the bot counts on **BOT BOARD** (monthly). Beating a person counts on **MONTHLY DUEL WINS**. The two boards do not share wins. No text message and no username to type.

Controls: drag left or right to move, tap to rotate, swipe down to hard drop. You can also use the on-screen tutorial and the **SCORING** / **HIGH SCORES** buttons.

## For moderators

1. Install **bit-drop** on your subreddit.
2. A BIT·DROP post is created automatically on install. You can also use the subreddit overflow menu: **Create a BIT·DROP post**.
3. Community terms: [r/BitDropGame/wiki/terms](https://www.reddit.com/r/BitDropGame/wiki/terms)  
   Privacy: [r/BitDropGame/wiki/privacy](https://www.reddit.com/r/BitDropGame/wiki/privacy)
4. Players report problems from the splash (**REPORT / FEEDBACK**), the in-game menu, or the post menu item **Report / feedback**. That opens Reddit modmail to **r/BitDropGame** — please watch that inbox.

No extra settings are required.

## For Reddit reviewers

- **Feed scroll:** the inline splash does not trap the Reddit feed. Vertical scroll still works when your finger is over the post.
- **Portrait + landscape:** both orientations play. Landscape centers the board and fills the side gutters with block art. There is no “rotate your device” lock.

## Privacy and data

BIT·DROP stores high scores in **Devvit Redis** on this subreddit install: score, win/loss, board settings, play time, the post id, and the player’s **Reddit username**. Duels store the same username plus the opponent’s username, the challenge, and round results. It does not collect email, does not use off-platform accounts, does not send SMS, and does not load third-party fonts or analytics.

**Retention (30 days for solo scores).** Score keys `bitdrop:board`, `bitdrop:rows`, and `bitdrop:best` expire 30 days after the last write. Individual rows older than 30 days are pruned when the board is read or written, and again on a daily job. Duel challenges and live matches expire after **7 days**. The monthly duel-wins keys `bitdrop:duel:wins:YYYY-MM` expire **40 days** after the last win so the UTC month stays readable, then the usernames on that board drop. Reddit does not send an account-deletion event to apps. If a BIT·DROP post is deleted, the `PostDelete` trigger removes solo scores and duel records from that post. To ask for a faster removal, use **REPORT / FEEDBACK**. Key details: [docs/reddit-duel.md](../../docs/reddit-duel.md).

---

## Playtest notes (developers)

The Devvit server (Redis, Reddit username) does not run on bare localhost. Play on Reddit.

```bash
cd artifacts/devvit-bit-drop
pnpm install          # first time; this folder is not in the repo workspace
pnpm run login        # browser OAuth → ~/.devvit/token
pnpm run dev          # devvit playtest
```

Open the playtest URL the CLI prints and refresh. Do **not** republish from a PR; Chief publishes after merge.

```bash
pnpm run typecheck
pnpm run build
```
