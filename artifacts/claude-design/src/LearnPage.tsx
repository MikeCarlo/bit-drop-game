import React, { useEffect, useState } from 'react';

// ── shared palette (mirrors App.tsx) ────────────────────────────────────────
const COLORS = ['#c23a3a', '#2f4bc9', '#d9cf4a', '#2ea043'];
const LIGHT  = ['#e07070', '#6f83e8', '#efe88e', '#6cc97c'];
// Readable body font — the pixel font stays for headings only
const BODY = 'ui-monospace,Menlo,Consolas,monospace';

// A demo cell: color index, target?, visual state
interface DCell { c: number; t?: boolean; }
type DGrid = (DCell | null)[][];

// ── tiny animated demo board ────────────────────────────────────────────────
// Runs a scripted sequence of frames on a loop. Each frame: grid + highlighted
// cells (flashing) + a floating score label.
interface Frame { grid: DGrid; flash?: [number, number][]; label?: string; labelColor?: string; ms: number; }

function DemoBoard({ frames, cols, rows, cell = 22 }: { frames: Frame[]; cols: number; rows: number; cell?: number }) {
  const [i, setI] = useState(0);
  const [blink, setBlink] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setI((i + 1) % frames.length), frames[i].ms);
    return () => clearTimeout(t);
  }, [i, frames]);
  useEffect(() => {
    const t = setInterval(() => setBlink(b => !b), 130);
    return () => clearInterval(t);
  }, []);
  const f = frames[i];
  const flashSet = new Set((f.flash || []).map(p => p[0] + ',' + p[1]));
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${cols}, ${cell}px)`,
        gridTemplateRows: `repeat(${rows}, ${cell}px)`,
        background: '#141416', border: '3px solid #3a3a3e', imageRendering: 'pixelated',
      }}>
        {Array.from({ length: rows }).map((_, y) =>
          Array.from({ length: cols }).map((_, x) => {
            const c = f.grid[y]?.[x];
            const flashing = flashSet.has(x + ',' + y);
            if (!c) return <div key={x + '-' + y} style={{ boxShadow: 'inset 0 0 0 1px #232326' }} />;
            const bg = flashing && blink ? '#ffffff' : c.c < 0 ? '#3a3a3e' : COLORS[c.c];
            return (
              <div key={x + '-' + y} style={{ background: bg, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.35)', position: 'relative' }}>
                {/* highlight pixel */}
                {!flashing && c.c >= 0 && <div style={{ position: 'absolute', top: 2, left: 2, width: Math.max(3, cell * 0.2), height: Math.max(3, cell * 0.2), background: LIGHT[c.c] }} />}
                {/* target squares get a dot marker */}
                {c.t && !flashing && <div style={{ position: 'absolute', inset: '30%', background: '#141416' }} />}
              </div>
            );
          })
        )}
      </div>
      {f.label && (
        <div style={{
          position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
          fontSize: 10, color: f.labelColor || '#d9cf4a', whiteSpace: 'nowrap',
          textShadow: '0 0 6px rgba(0,0,0,0.9)', animation: 'learnPop 0.5s ease-out',
        }}>{f.label}</div>
      )}
    </div>
  );
}

// ── frame builders ──────────────────────────────────────────────────────────
const row = (cols: number, cells: { [x: number]: DCell }): DGrid[number] =>
  Array.from({ length: cols }, (_, x) => cells[x] ?? null);
const empty = (cols: number, rows: number): DGrid => Array.from({ length: rows }, () => Array(cols).fill(null));
const withRow = (cols: number, rows: number, y: number, cells: { [x: number]: DCell }): DGrid => {
  const g = empty(cols, rows); g[y] = row(cols, cells); return g;
};

// 1) MATCH 4: a pill drops in to complete a line of 4 reds
const match4Frames: Frame[] = (() => {
  const C = 6, R = 4;
  const base = { 1: { c: 0 }, 2: { c: 0 }, 3: { c: 0 } };
  const g1 = withRow(C, R, 3, base); g1[1][4] = { c: 0 }; g1[0][4] = { c: 1 };
  const g2 = withRow(C, R, 3, base); g2[2][4] = { c: 0 }; g2[1][4] = { c: 1 };
  const g3 = withRow(C, R, 3, { ...base, 4: { c: 0 } }); g3[2][4] = { c: 1 };
  const g4 = withRow(C, R, 3, {}); g4[3][4] = { c: 1 };
  return [
    { grid: g1, ms: 450 },
    { grid: g2, ms: 450 },
    { grid: g3, ms: 500 },
    { grid: g3, flash: [[1, 3], [2, 3], [3, 3], [4, 3]], label: 'CLEAR · 0 pts', ms: 700 },
    { grid: g4, label: 'no target in this drop', ms: 900 },
  ];
})();

// 2) TARGETS: clearing a line containing 2 targets
const targetFrames: Frame[] = (() => {
  const C = 6, R = 3;
  const g = withRow(C, R, 2, { 1: { c: 3, t: true }, 2: { c: 3 }, 3: { c: 3 }, 4: { c: 3, t: true } });
  const gEmpty = empty(C, R);
  return [
    { grid: g, ms: 900 },
    { grid: g, flash: [[1, 2], [2, 2], [3, 2], [4, 2]], label: '50+10+10+50', ms: 950 },
    { grid: gEmpty, label: '+120', labelColor: '#2ea043', ms: 1000 },
  ];
})();

// 3) LONG LINES: 5..8 in a row with multipliers
const longLineFrames: Frame[] = (() => {
  const C = 8, R = 2;
  const mk = (n: number) => withRow(C, R, 1, Object.fromEntries(Array.from({ length: n }, (_, i) => [i, { c: 1 }])));
  const fl = (n: number): [number, number][] => Array.from({ length: n }, (_, i) => [i, 1]);
  const seq: Frame[] = [];
  const bonus = [[5, 'x2'], [6, 'x3'], [7, 'x4'], [8, 'x5']] as const;
  for (const [n, b] of bonus) {
    seq.push({ grid: mk(n), ms: 700 });
    seq.push({ grid: mk(n), flash: fl(n), label: `${n} IN A ROW = ${b}!`, ms: 1100 });
  }
  return seq;
})();

// 4) CHAIN: clear causes pieces to fall into a second clear
const chainFrames: Frame[] = (() => {
  const C = 6, R = 5;
  // Bottom row: 3 yellows + gap. Above the gap: stacked yellow. A red line clears, yellow falls, completes yellow line.
  const g1 = empty(C, R);
  g1[4] = row(C, { 0: { c: 2 }, 1: { c: 2 }, 2: { c: 2 } });
  g1[3] = row(C, { 0: { c: 0 }, 1: { c: 0 }, 2: { c: 0 }, 3: { c: 0 } });
  g1[2] = row(C, { 3: { c: 2 } });
  const g2 = empty(C, R); // red cleared, yellow floating
  g2[4] = row(C, { 0: { c: 2 }, 1: { c: 2 }, 2: { c: 2 } });
  g2[2] = row(C, { 3: { c: 2 } });
  const g3 = empty(C, R); // yellow fell
  g3[4] = row(C, { 0: { c: 2 }, 1: { c: 2 }, 2: { c: 2 }, 3: { c: 2 } });
  const g4 = empty(C, R);
  return [
    { grid: g1, ms: 800 },
    { grid: g1, flash: [[0, 3], [1, 3], [2, 3], [3, 3]], label: '+40', ms: 800 },
    { grid: g2, ms: 400 },
    { grid: g3, ms: 500 },
    { grid: g3, flash: [[0, 4], [1, 4], [2, 4], [3, 4]], label: 'CHAIN x2 = +80!', labelColor: '#2ea043', ms: 1100 },
    { grid: g4, ms: 900 },
  ];
})();

// ── animated gesture demos ──────────────────────────────────────────────────
// A finger dot + optional second tap dot animated over a mini play area.
function Finger({ anim, delay = 0, second = false }: { anim: string; delay?: number; second?: boolean }) {
  return (
    <div style={{
      position: 'absolute', width: 22, height: 22, borderRadius: '50%',
      background: second ? 'rgba(217,207,74,0.85)' : 'rgba(255,255,255,0.85)',
      border: '2px solid ' + (second ? '#d9cf4a' : '#ffffff'),
      boxShadow: '0 0 10px rgba(255,255,255,0.4)',
      animation: `${anim} 2.4s ease-in-out ${delay}s infinite`,
    }} />
  );
}

function GesturePanel({ children, caption }: { children: React.ReactNode; caption: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
      <div style={{ position: 'relative', width: 120, height: 90, background: '#141416', border: '3px solid #3a3a3e', overflow: 'hidden' }}>
        {/* mini pill in the middle */}
        <div style={{ position: 'absolute', top: 18, left: 44, width: 32, height: 16, display: 'flex' }}>
          <div style={{ flex: 1, background: COLORS[0] }} />
          <div style={{ flex: 1, background: COLORS[1] }} />
        </div>
        {children}
      </div>
      <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 12, color: '#b4b4ba', lineHeight: 1.5, textAlign: 'center', maxWidth: 140 }}>{caption}</div>
    </div>
  );
}

// ── section wrapper ─────────────────────────────────────────────────────────
function Section({ title, children, demo }: { title: string; children: React.ReactNode; demo: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, borderTop: '2px solid #3a3a3e', paddingTop: 22 }}>
      <div style={{ fontSize: 12, color: '#d9cf4a' }}>{title}</div>
      <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 15, color: '#c8c8ce', lineHeight: 1.7 }}>{children}</div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 4px' }}>{demo}</div>
    </div>
  );
}

// ── page ────────────────────────────────────────────────────────────────────
export default function LearnPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="bitdrop-learn-overlay">
      <div className="bitdrop-learn-scroll">

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16 }}>SCORING</div>
          <button onClick={onBack} style={{ fontFamily: 'inherit', fontSize: 10, background: '#3a3a3e', color: '#fff', border: '2px solid #6e6e72', padding: '8px 12px', cursor: 'pointer' }}>
            ◀ BACK
          </button>
        </div>

        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 15, color: '#b4b4ba', lineHeight: 1.7 }}>
          line up 4 or more of the same color — across or down — to clear them and score.
        </div>

        <Section title="FINGER CONTROLS" demo={
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
            <GesturePanel caption="DRAG ◀▶ — slide left or right to move the pill">
              <Finger anim="gestDrag" />
            </GesturePanel>
            <GesturePanel caption="TAP — tap anywhere to rotate. each tap = one rotate">
              <Finger anim="gestSingle" />
            </GesturePanel>
            <GesturePanel caption="HOLD + TAP — hold with one finger, tap with a second. each tap = one rotate">
              <Finger anim="gestHold" />
              <Finger anim="gestTap" second />
            </GesturePanel>
            <GesturePanel caption="SWIPE ▼ — flick down fast to hard drop the pill instantly">
              <Finger anim="gestSwipe" />
            </GesturePanel>
          </div>
        }>
          move, rotate and drop with simple gestures — anywhere on the board.<br />
          keyboard also works: ◀▶ move · ▲/space rotate · ▼ hard drop · P pause.
        </Section>

        <Section title="MATCH 4" demo={<DemoBoard frames={match4Frames} cols={6} rows={4} />}>
          each cleared piece is worth <span style={{ color: '#fff' }}>10 pts</span> of base
          (targets 50) — but a drop only <span style={{ color: '#fff' }}>adds those points</span> if
          a target was in that clear sequence. 4 regulars with no target still clear, and score 0.
        </Section>

        <Section title="TARGET SQUARES" demo={<DemoBoard frames={targetFrames} cols={6} rows={3} />}>
          target squares (marked with a dot) are worth <span style={{ color: '#fff' }}>50 pts</span> each.<br />
          clear every target to win the level!<br />
          if any target is removed in a drop&apos;s cascade, every piece from every clear in that
          drop counts.
        </Section>

        <Section title="BIG LINES = BIG BONUS" demo={<DemoBoard frames={longLineFrames} cols={8} rows={2} />}>
          longer lines multiply every piece in them:<br />
          5 in a row <span style={{ color: '#d9cf4a' }}>x2</span> · 6 <span style={{ color: '#d9cf4a' }}>x3</span> · 7 <span style={{ color: '#d9cf4a' }}>x4</span> · 8+ <span style={{ color: '#d9cf4a' }}>x5</span><br />
          a piece where two lines cross counts its <span style={{ color: '#fff' }}>longer</span> line.
        </Section>

        <Section title="CHAIN REACTIONS" demo={<DemoBoard frames={chainFrames} cols={6} rows={5} />}>
          all match-4+ lines in one drop (the first clear plus any cascades) are counted, then the
          drop&apos;s base is multiplied by that line count — 2 lines = <span style={{ color: '#2ea043' }}>x2</span>, 3 = x3...<br />
          the sequence resets when your next pill lands.<br />
          line-count stacks WITH length bonuses — plan your drops!
        </Section>

        <div style={{ borderTop: '2px solid #3a3a3e', paddingTop: 22, fontFamily: BODY, fontWeight: 600, fontSize: 14, color: '#b4b4ba', lineHeight: 1.9, textAlign: 'center' }}>
          example: 6-in-a-row with 2 targets, 2 lines in the drop<br />
          = (50+50+10+10+10+10) x3 x2 = <span style={{ color: '#d9cf4a' }}>840 pts</span> — only because a target was in the sequence
        </div>

        <button onClick={onBack} style={{ fontFamily: 'inherit', fontSize: 12, background: '#2ea043', color: '#fff', border: '4px solid #fff', padding: 14, cursor: 'pointer' }}>
          GOT IT!
        </button>
      </div>
    </div>
  );
}
