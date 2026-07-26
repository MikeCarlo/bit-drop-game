import React from 'react';
import LearnPage from './LearnPage';

// ── types ──────────────────────────────────────────────────────────────────
// dx/dy: relative offset to this cell's linked pill partner (undefined = single segment)
interface Cell { c: number; t: boolean; dx?: number; dy?: number; }
type Grid = (Cell | null)[][];
interface Pill { x: number; y: number; dir: number; a: number; b: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; c: number; }
// Trail left by a hard-drop: two column indices + row range + fade timer
interface DropFlash { cols: number[]; yTop: number; yBot: number; life: number; }

// A tutorial step: prompt text, a goal that completes it, optional board setup
// and a scripted pill. Clear-type goals retry (board resets) until achieved.
interface TutStep {
  title: string;
  text: string;
  goal: 'move' | 'rotate' | 'drop' | 'clear' | 'clearTarget' | 'clearBig' | 'chain';
  need?: number;                                  // action count for move/rotate/drop
  pill?: [number, number];                        // scripted pill colors
  setup?: (g: Grid, cols: number, rows: number) => number; // builds board, returns target count
}

interface State {
  screen: 'menu' | 'play' | 'win' | 'lose' | 'learn';
  tutStep: number; // -1 = not in tutorial; TUT.length = completed overlay
  score: number;
  left: number;
  paused: boolean;
  newBest: boolean;
  best: number;
  width: number;
  viruses: number;
  speed: number;
  sound: boolean;
  landscape: boolean;
}

// ── game component ─────────────────────────────────────────────────────────
export default class App extends React.Component<{}, State> {
  state: State = {
    screen: 'menu', tutStep: -1, score: 0, left: 0, paused: false, newBest: false,
    best: +(localStorage.getItem('bitdrop-best') || 0),
    width: +(localStorage.getItem('bitdrop-w') || 10),
    viruses: +(localStorage.getItem('bitdrop-v') || 12),
    speed: +(localStorage.getItem('bitdrop-s') || 4),
    sound: localStorage.getItem('bitdrop-snd') !== '0',
    landscape: false,
  };

  canvasRef = React.createRef<HTMLCanvasElement>();

  COLORS = ['#c23a3a', '#2f4bc9', '#d9cf4a', '#2ea043'];
  LIGHT  = ['#e07070', '#6f83e8', '#efe88e', '#6cc97c'];
  DARK   = ['#7e2222', '#1d2f85', '#9a922c', '#1c6b2c'];
  // color index 4 = rainbow wildcard (matches any color in a run)
  RAINBOW = 4;
  rainbowPhase = 0; // updated each draw frame

  // game internals
  grid: Grid = [];
  rows = 16;
  cols = 10;
  pill: Pill | null = null;
  phase: 'idle' | 'fall' | 'flash' | 'grav' = 'idle';
  particles: Particle[] = [];
  dropFlashes: DropFlash[] = [];
  flash: [number, number][] = [];
  lastFall = 0;
  gravT = 0;
  phaseUntil = 0;
  fastDrop = false;
  chain = 1;
  runLenAt = new Map<string, number>();
  winPending = false;
  // tutorial internals
  tutCount = 0;       // actions performed toward the current step's `need`
  tutAdvance = false; // set when a clear-goal step is achieved; consumed on settle
  TUT: TutStep[] = [
    { title: 'MOVE', text: 'drag ◀▶ anywhere to slide the pill left and right. move it 3 times!', goal: 'move', need: 3, pill: [0, 1] },
    { title: 'ROTATE', text: 'hold with one finger, tap with a second — each tap rotates. (double-tap works too, or ▲/space). rotate twice!', goal: 'rotate', need: 2, pill: [2, 3] },
    { title: 'HARD DROP', text: 'swipe ▼ fast to slam the pill straight down.', goal: 'drop', need: 1, pill: [1, 2] },
    {
      title: 'MATCH 4', text: 'line up 4 of a color to clear it. each piece = 10 pts. drop the red pill next to the 3 reds!', goal: 'clear', pill: [0, 0],
      setup: (g, _c, r) => { g[r - 1][0] = { c: 0, t: false }; g[r - 1][1] = { c: 0, t: false }; g[r - 1][2] = { c: 0, t: false }; return 0; },
    },
    {
      title: 'TARGET SQUARES', text: 'squares with a face are TARGETS — 50 pts each. clear them all to win a level. match the greens!', goal: 'clearTarget', pill: [3, 3],
      setup: (g, _c, r) => { g[r - 1][0] = { c: 3, t: true }; g[r - 1][1] = { c: 3, t: false }; return 1; },
    },
    {
      title: 'BIG LINES', text: 'longer lines multiply the points: 5 = x2, 6 = x3, 7 = x4, 8+ = x5. make a line of SIX blues!', goal: 'clearBig', pill: [1, 1],
      setup: (g, _c, r) => { for (let x = 0; x < 4; x++) g[r - 1][x] = { c: 1, t: false }; return 0; },
    },
    {
      title: 'CHAIN REACTIONS', text: 'when a clear drops pieces into another match, the next clear scores x2, x3... complete the red line and watch the yellow fall!', goal: 'chain', pill: [0, 0],
      setup: (g, _c, r) => {
        g[r - 1][0] = { c: 2, t: false }; g[r - 1][1] = { c: 2, t: false }; g[r - 1][2] = { c: 2, t: false };
        g[r - 1][3] = { c: 0, t: false }; g[r - 1][4] = { c: 0, t: false }; g[r - 1][5] = { c: 0, t: false };
        g[r - 2][3] = { c: 2, t: false };
        return 0;
      },
    },
  ];
  // lock delay: hold the piece at the floor briefly so double-taps can rotate it
  grounded = false;
  lockAt = 0;
  LOCK_DELAY = 500; // ms
  raf = 0;
  off: HTMLCanvasElement = document.createElement('canvas');
  cellPx = 30;

  // audio
  ac: AudioContext | null = null;

  // input
  mq: MediaQueryList | null = null;
  onOri: (() => void) | null = null;
  onKey: ((e: KeyboardEvent) => void) | null = null;
  onKeyUp: ((e: KeyboardEvent) => void) | null = null;
  tstate: { active: boolean; sx: number; sy: number; rx: number; moved: boolean; t0: number; holdDir: number; holdNext: number; dropped: boolean } = { active: false, sx: 0, sy: 0, rx: 0, moved: false, t0: 0, holdDir: 0, holdNext: 0, dropped: false };
  lastTap = 0;
  tapX = 0;
  tapY = 0;
  touchHandlers: { ts: (e: TouchEvent) => void; tm: (e: TouchEvent) => void; te: (e: TouchEvent) => void } | null = null;

  // ── lifecycle ──────────────────────────────────────────────────────────
  componentDidMount() {
    this.mq = window.matchMedia('(orientation: landscape)');
    this.onOri = () => {
      const lnd = this.mq!.matches;
      this.setState({ landscape: lnd, paused: lnd ? true : this.state.paused });
    };
    this.mq.addEventListener('change', this.onOri);
    this.setState({ landscape: this.mq.matches });

    this.grid = [];
    this.cols = this.state.width;

    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);

    this.onKey = this.handleKey.bind(this);
    window.addEventListener('keydown', this.onKey);

    this.onKeyUp = (e: KeyboardEvent) => { if (e.key === 'ArrowDown') this.fastDrop = false; };
    window.addEventListener('keyup', this.onKeyUp);

    const cv = this.canvasRef.current!;
    this.touchHandlers = {
      ts: (e: TouchEvent) => this.touchStart(e),
      tm: (e: TouchEvent) => this.touchMove(e),
      te: (e: TouchEvent) => this.touchEnd(e),
    };
    cv.addEventListener('touchstart', this.touchHandlers.ts, { passive: false });
    cv.addEventListener('touchmove', this.touchHandlers.tm, { passive: false });
    cv.addEventListener('touchend', this.touchHandlers.te, { passive: false });
  }

  componentWillUnmount() {
    cancelAnimationFrame(this.raf);
    if (this.mq && this.onOri) this.mq.removeEventListener('change', this.onOri);
    if (this.onKey) window.removeEventListener('keydown', this.onKey);
    if (this.onKeyUp) window.removeEventListener('keyup', this.onKeyUp);
    const cv = this.canvasRef.current;
    if (cv && this.touchHandlers) {
      cv.removeEventListener('touchstart', this.touchHandlers.ts);
      cv.removeEventListener('touchmove', this.touchHandlers.tm);
      cv.removeEventListener('touchend', this.touchHandlers.te);
    }
  }

  // ── audio ──────────────────────────────────────────────────────────────
  beep(f: number, d: number, type: OscillatorType = 'square', vol = 0.12) {
    if (!this.state.sound) return;
    try {
      if (!this.ac) this.ac = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (this.ac.state === 'suspended') this.ac.resume();
      const o = this.ac.createOscillator(), g = this.ac.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(vol, this.ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ac.currentTime + d);
      o.connect(g); g.connect(this.ac.destination);
      o.start(); o.stop(this.ac.currentTime + d + 0.02);
    } catch (e) {}
  }
  arp(freqs: number[], step: number, d?: number) {
    freqs.forEach((f, i) => setTimeout(() => this.beep(f, d || 0.1), i * step));
  }
  dropSound() {
    if (!this.state.sound) return;
    try {
      if (!this.ac) this.ac = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (this.ac.state === 'suspended') this.ac.resume();
      const now = this.ac.currentTime;
      // Descending zip: sawtooth sweep from 900 → 90 Hz
      const o1 = this.ac.createOscillator(), g1 = this.ac.createGain();
      o1.type = 'sawtooth';
      o1.frequency.setValueAtTime(900, now);
      o1.frequency.exponentialRampToValueAtTime(90, now + 0.1);
      g1.gain.setValueAtTime(0.22, now);
      g1.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      o1.connect(g1); g1.connect(this.ac.destination);
      o1.start(now); o1.stop(now + 0.15);
      // Impact thud
      const o2 = this.ac.createOscillator(), g2 = this.ac.createGain();
      o2.type = 'triangle';
      o2.frequency.setValueAtTime(160, now + 0.1);
      o2.frequency.exponentialRampToValueAtTime(60, now + 0.2);
      g2.gain.setValueAtTime(0.28, now + 0.1);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      o2.connect(g2); g2.connect(this.ac.destination);
      o2.start(now + 0.1); o2.stop(now + 0.25);
    } catch (e) {}
  }

  // ── game setup ──────────────────────────────────────────────────────────
  startGame() {
    const cv = this.canvasRef.current!;
    const box = cv.parentElement!;
    this.cols = this.state.width;
    const cw = box.clientWidth, ch = box.clientHeight;
    this.rows = Math.max(12, Math.min(30, Math.floor(ch / (cw / this.cols))));
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));

    let placed = 0, guard = 0, want = this.state.viruses;
    const top = Math.floor(this.rows / 4) + 1;
    while (placed < want && guard++ < 4000) {
      const x = (Math.random() * this.cols) | 0;
      const y = top + ((Math.random() * (this.rows - top - 1)) | 0);
      if (this.grid[y][x]) continue;
      const c = (Math.random() * 4) | 0;
      if (this.runLen(x, y, 1, 0, c) + this.runLen(x, y, -1, 0, c) >= 2) continue;
      if (this.runLen(x, y, 0, 1, c) + this.runLen(x, y, 0, -1, c) >= 2) continue;
      this.grid[y][x] = { c, t: true }; placed++;
    }
    this.particles = []; this.flash = []; this.chain = 1; this.fastDrop = false; this.winPending = false; this.grounded = false;
    this.setState({ screen: 'play', score: 0, left: placed, paused: false, newBest: false });
    this.spawn();
    this.lastFall = performance.now();
    this.beep(523, 0.06);
  }

  // ── tutorial ────────────────────────────────────────────────────────────
  isTut() { return this.state.tutStep >= 0 && this.state.tutStep < this.TUT.length; }

  startTutorial() {
    const cv = this.canvasRef.current!;
    const box = cv.parentElement!;
    this.cols = 8;
    const cw = box.clientWidth, ch = box.clientHeight;
    this.rows = Math.max(12, Math.min(30, Math.floor(ch / (cw / this.cols))));
    this.particles = []; this.flash = []; this.dropFlashes = []; this.chain = 1;
    this.fastDrop = false; this.winPending = false; this.grounded = false; this.tutAdvance = false;
    this.setState({ screen: 'play', score: 0, paused: false, newBest: false, tutStep: 0 }, () => this.setupTutStep(0));
    this.beep(523, 0.06);
  }

  setupTutStep(i: number) {
    if (i >= this.TUT.length) { // finished!
      localStorage.setItem('bitdrop-tut', '1');
      this.phase = 'idle'; this.pill = null;
      this.setState({ tutStep: this.TUT.length });
      this.arp([523, 659, 784, 1047, 784, 1047], 90, 0.14);
      return;
    }
    const step = this.TUT[i];
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
    const targets = step.setup ? step.setup(this.grid, this.cols, this.rows) : 0;
    this.tutCount = 0; this.tutAdvance = false;
    this.particles = []; this.flash = []; this.chain = 1; this.winPending = false; this.grounded = false;
    this.setState({ tutStep: i, left: targets });
    const [a, b] = step.pill || [(Math.random() * 4) | 0, (Math.random() * 4) | 0];
    this.pill = { x: (this.cols >> 1) - 1, y: 0, dir: 0, a, b };
    this.fastDrop = false;
    this.phase = 'fall'; this.lastFall = performance.now();
  }

  // Called when the player performs a counted action (move/rotate/drop)
  tutHit(goal: TutStep['goal']) {
    if (!this.isTut()) return;
    const step = this.TUT[this.state.tutStep];
    if (step.goal !== goal) return;
    this.tutCount++;
    this.forceUpdate(); // progress counter lives outside React state
    if (this.tutCount >= (step.need || 1)) {
      // move/rotate advance in place (pill keeps falling); drop advances on next spawn
      if (goal === 'move' || goal === 'rotate') {
        this.setState({ tutStep: this.state.tutStep + 1 });
        this.tutCount = 0;
        this.arp([659, 880], 70, 0.1);
      } else {
        this.tutAdvance = true;
      }
    }
  }

  // Called from doClear with details of what was cleared
  tutClear(targets: number, maxRun: number, chainAtClear: number) {
    if (!this.isTut() || this.tutAdvance) return;
    const g = this.TUT[this.state.tutStep].goal;
    if ((g === 'clear') ||
        (g === 'clearTarget' && targets > 0) ||
        (g === 'clearBig' && maxRun >= 6) ||
        (g === 'chain' && chainAtClear >= 2)) {
      this.tutAdvance = true;
      this.arp([659, 880], 70, 0.1);
    }
  }

  skipTutorial() {
    localStorage.setItem('bitdrop-tut', '1');
    this.setState({ tutStep: -1 });
    this.startGame();
  }

  runLen(x: number, y: number, dx: number, dy: number, c: number): number {
    let n = 0;
    for (let i = 1; i < 4; i++) {
      const cell = (this.grid[y + dy * i] || [])[x + dx * i];
      if (cell && cell.c === c) n++; else break;
    }
    return n;
  }

  randColor(forceNormal = false) {
    if (forceNormal) return (Math.random() * 4) | 0;
    return Math.random() < 0.15 ? this.RAINBOW : (Math.random() * 4) | 0;
  }

  spawn() {
    if (this.isTut()) {
      const i = this.state.tutStep;
      if (this.tutAdvance) { this.setupTutStep(i + 1); return; }  // step achieved → next
      if (this.TUT[i].setup) { this.setupTutStep(i); return; }     // clear-goal missed → retry
      // control steps: respawn the scripted pill
      const [a, b] = this.TUT[i].pill!;
      this.pill = { x: (this.cols >> 1) - 1, y: 0, dir: 0, a, b };
      this.fastDrop = false; this.grounded = false;
      const [t1, t2] = this.pillCells();
      if (this.at(t1.x, t1.y) || this.at(t2.x, t2.y)) { this.setupTutStep(i); return; } // board jammed → reset step
      this.phase = 'fall'; this.lastFall = performance.now();
      return;
    }
    const x = (this.cols >> 1) - 1;
    const a = this.randColor();
    const b = this.randColor(a === this.RAINBOW); // never both rainbow
    this.pill = { x, y: 0, dir: 0, a, b };
    this.fastDrop = false; this.grounded = false;
    const [c1, c2] = this.pillCells();
    if (this.at(c1.x, c1.y) || this.at(c2.x, c2.y)) { this.pill = null; this.gameOver(false); return; }
    this.phase = 'fall'; this.lastFall = performance.now();
  }

  at(x: number, y: number): Cell | { wall: true } | null {
    if (x < 0 || x >= this.cols || y >= this.rows) return { wall: true };
    if (y < 0) return null;
    return this.grid[y][x];
  }

  pillCells(p?: Pill): { x: number; y: number; c: number }[] {
    p = p || this.pill!;
    const swap = p.dir >= 2, dx = p.dir % 2 === 0 ? 1 : 0, dy = p.dir % 2 === 0 ? 0 : -1;
    return [{ x: p.x, y: p.y, c: swap ? p.b : p.a }, { x: p.x + dx, y: p.y + dy, c: swap ? p.a : p.b }];
  }

  fits(p: Pill): boolean {
    return this.pillCells(p).every(c => !this.at(c.x, c.y));
  }

  move(dx: number): boolean {
    if (this.phase !== 'fall' || !this.pill || this.state.paused) return false;
    const p = { ...this.pill, x: this.pill.x + dx };
    if (this.fits(p)) { this.pill = p; this.beep(200, 0.03, 'square', 0.05); this.tutHit('move'); return true; }
    return false;
  }

  rotate() {
    if (this.phase !== 'fall' || !this.pill || this.state.paused) return;
    for (const kick of [0, -1, 1]) {
      const p = { ...this.pill, dir: (this.pill.dir + 1) % 4, x: this.pill.x + kick };
      if (this.fits(p)) {
        this.pill = p;
        this.beep(660, 0.05);
        this.tutHit('rotate');
        // If grounded, each rotation resets the lock timer so the player
        // can keep double-tapping to find the right orientation
        if (this.grounded) this.lockAt = performance.now() + this.LOCK_DELAY;
        return;
      }
    }
  }

  hardDrop() {
    if (this.phase !== 'fall' || !this.pill || this.state.paused) return;
    const startY = this.pill.y;
    let p = this.pill;
    while (true) {
      const n = { ...p, y: p.y + 1 };
      if (this.fits(n)) p = n; else break;
    }
    // Only trigger effects when the piece actually travelled some distance
    if (p.y > startY) {
      const cells = this.pillCells(p);
      this.dropFlashes.push({
        cols: cells.map(c => c.x),
        yTop: Math.max(0, startY),
        yBot: Math.max(...cells.map(c => c.y)),
        life: 14,
      });
      this.dropSound();
    }
    this.tutHit('drop');
    this.pill = p; this.lock();
  }

  lock() {
    const [a, b] = this.pillCells();
    const bothOn = a.y >= 0 && b.y >= 0;
    if (a.y >= 0) this.grid[a.y][a.x] = { c: a.c, t: false, ...(bothOn ? { dx: b.x - a.x, dy: b.y - a.y } : {}) };
    if (b.y >= 0) this.grid[b.y][b.x] = { c: b.c, t: false, ...(bothOn ? { dx: a.x - b.x, dy: a.y - b.y } : {}) };
    this.pill = null; this.chain = 1;
    this.beep(150, 0.07, 'triangle', 0.18);
    if (!this.checkClears()) this.spawn();
  }

  checkClears(): boolean {
    // Track the longest run each cell belongs to, for length bonuses.
    // Rainbow (c===RAINBOW) acts as a wildcard — it adopts the run's color.
    // A run of only rainbows has no color anchor and does NOT clear.
    const marks = new Map<string, number>();
    const R = this.RAINBOW;
    const scan = (sx: number, sy: number, dx: number, dy: number) => {
      let run: [number, number][] = [], runColor = -1;
      const flush = () => {
        if (run.length >= 4 && runColor !== -1) run.forEach(p => {
          const k = p[0] + ',' + p[1];
          marks.set(k, Math.max(marks.get(k) || 0, run.length));
        });
      };
      let x = sx, y = sy;
      while (x < this.cols && y < this.rows) {
        const cell = this.grid[y][x];
        if (!cell) {
          flush(); run = []; runColor = -1;
        } else if (cell.c === R || runColor === -1 || cell.c === runColor) {
          // Rainbow always joins; non-rainbow sets / confirms the run color
          if (cell.c !== R) runColor = cell.c;
          run.push([x, y]);
        } else {
          flush(); run = [[x, y]]; runColor = cell.c;
        }
        x += dx; y += dy;
      }
      flush();
    };
    for (let y = 0; y < this.rows; y++) scan(0, y, 1, 0);
    for (let x = 0; x < this.cols; x++) scan(x, 0, 0, 1);
    if (!marks.size) return false;
    this.runLenAt = marks;
    this.flash = [...marks.keys()].map(s => s.split(',').map(Number) as [number, number]);
    this.phase = 'flash'; this.phaseUntil = performance.now() + 260;
    return true;
  }

  // Length bonus: 4 in a row = x1, 5 = x2, 6 = x3, 7 = x4, 8+ = x5
  lenBonus(len: number) { return Math.min(len - 3, 5); }

  doClear() {
    let pts = 0, targets = 0, maxRun = 0;
    for (const [x, y] of this.flash) {
      const cell = this.grid[y][x];
      if (!cell) continue;
      const runLen = this.runLenAt.get(x + ',' + y) || 4;
      maxRun = Math.max(maxRun, runLen);
      pts += (cell.t ? 50 : 10) * this.chain * this.lenBonus(runLen);
      if (cell.t) targets++;
      this.burst(x, y, cell.c);
      // Unlink the partner half so it becomes a free single segment
      if (cell.dx !== undefined && cell.dy !== undefined) {
        const partner = (this.grid[y + cell.dy] || [])[x + cell.dx];
        if (partner) { delete partner.dx; delete partner.dy; }
      }
      this.grid[y][x] = null;
    }
    this.flash = [];
    const left = this.state.left - targets;
    this.setState({ score: this.state.score + pts, left });
    this.arp(this.chain > 1 ? [659, 784, 988] : [523, 659, 784], 55, 0.09);
    this.tutClear(targets, maxRun, this.chain);
    this.chain++;
    this.phase = 'grav'; this.gravT = performance.now() + 120;
    if (left <= 0 && !this.isTut()) this.winPending = true;
  }

  gravStep(): boolean {
    // Which cells may fall one row this tick? A cell can fall only if:
    //  - it isn't a fixed target square,
    //  - the space below is empty OR also falling,
    //  - AND its linked pill partner (if any) can fall too.
    const can: boolean[][] = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
    for (let y = this.rows - 2; y >= 0; y--) {
      for (let x = 0; x < this.cols; x++) {
        const cell = this.grid[y][x];
        if (!cell || cell.t) continue;
        const below = this.grid[y + 1][x];
        can[y][x] = !below || can[y + 1][x];
      }
    }
    // Fixpoint: linked halves must fall together; losing support cascades upward
    let changed = true;
    while (changed) {
      changed = false;
      for (let y = 0; y < this.rows - 1; y++) {
        for (let x = 0; x < this.cols; x++) {
          if (!can[y][x]) continue;
          const cell = this.grid[y][x]!;
          const below = this.grid[y + 1][x];
          if (below && !can[y + 1][x]) { can[y][x] = false; changed = true; continue; }
          if (cell.dx !== undefined && cell.dy !== undefined) {
            const py = y + cell.dy, px = x + cell.dx;
            const partner = (this.grid[py] || [])[px];
            if (partner && !can[py][px]) { can[y][x] = false; changed = true; }
          }
        }
      }
    }
    // Move all falling cells down one row (bottom-up keeps pairs intact)
    let moved = false;
    for (let y = this.rows - 2; y >= 0; y--) {
      for (let x = 0; x < this.cols; x++) {
        if (can[y][x]) {
          this.grid[y + 1][x] = this.grid[y][x]; this.grid[y][x] = null; moved = true;
        }
      }
    }
    return moved;
  }

  gameOver(won: boolean) {
    this.phase = 'idle'; this.pill = null;
    let best = this.state.best, nb = false;
    if (this.state.score > best) { best = this.state.score; nb = true; localStorage.setItem('bitdrop-best', String(best)); }
    this.setState({ screen: won ? 'win' : 'lose', best, newBest: nb });
    if (won) this.arp([523, 659, 784, 1047, 784, 1047], 90, 0.14);
    else this.arp([392, 330, 262, 196], 130, 0.16);
  }

  // ── loop ──────────────────────────────────────────────────────────────
  loop(ts: number) {
    this.raf = requestAnimationFrame(this.loop);
    const playing = this.state.screen === 'play' && !this.state.paused;
    if (playing) {
      if (this.phase === 'fall' && this.pill) {
        // If grounded, wait for lock delay to expire before locking
        if (this.grounded) {
          if (ts > this.lockAt) { this.grounded = false; this.lock(); }
        } else {
          // tutorial falls slowly so players can read prompts and think
          const iv = this.fastDrop ? 45 : this.isTut() ? 1400 : 1000 - this.state.speed * 90;
          if (ts - this.lastFall > iv) {
            this.lastFall = ts;
            const p = { ...this.pill, y: this.pill.y + 1 };
            if (this.fits(p)) {
              this.pill = p;
            } else {
              // Piece hit the floor — start lock delay
              this.grounded = true;
              this.lockAt = ts + this.LOCK_DELAY;
            }
          }
        }
      } else if (this.phase === 'flash') {
        if (ts > this.phaseUntil) this.doClear();
      } else if (this.phase === 'grav') {
        if (ts > this.gravT) {
          this.gravT = ts + 60;
          if (!this.gravStep()) {
            if (!this.checkClears()) {
              if (this.winPending) { this.winPending = false; this.gameOver(true); }
              else this.spawn();
            }
          }
        }
      }
    }
    this.particles = this.particles.filter(p => (p.life -= 1) > 0);
    for (const p of this.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.05; }
    this.dropFlashes = this.dropFlashes.filter(f => (f.life -= 1) > 0);
    this.draw(ts);
  }

  burst(x: number, y: number, c: number) {
    // Rainbow cell: spray all four colors
    const colors = c === this.RAINBOW ? [0, 1, 2, 3] : [c];
    for (const col of colors) {
      const n = c === this.RAINBOW ? 4 : 7;
      for (let i = 0; i < n; i++) this.particles.push({
        x: x * 8 + 4, y: y * 8 + 4,
        vx: (Math.random() - 0.5) * 2.8, vy: -Math.random() * 2.2 - 0.4,
        life: 26 + Math.random() * 14, c: col,
      });
    }
  }

  // ── render (canvas) ────────────────────────────────────────────────────
  draw(ts: number) {
    const cv = this.canvasRef.current; if (!cv) return;
    const box = cv.parentElement!, cw = box.clientWidth, ch = box.clientHeight;
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    // ── animated dark gradient background ─────────────────────────────
    const t  = ts * 0.00016;            // drives very slow movement
    const ang = t * 0.35;               // slowly rotating gradient axis
    const r  = Math.max(cw, ch) * 0.9;
    const mx = cw * 0.5, my = ch * 0.5;
    const bgGrad = ctx.createLinearGradient(
      mx + Math.cos(ang) * r, my + Math.sin(ang) * r,
      mx - Math.cos(ang) * r, my - Math.sin(ang) * r,
    );
    const mix = Math.sin(t * 0.4) * 0.5 + 0.5; // 0–1, slow pulse
    bgGrad.addColorStop(0,   '#020209');
    bgGrad.addColorStop(mix, '#071330');
    bgGrad.addColorStop(1,   '#030310');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cw, ch);

    if (this.state.screen === 'menu' || !this.grid.length) return;

    const bw = this.cols * 8, bh = this.rows * 8;
    if (this.off.width !== bw || this.off.height !== bh) { this.off.width = bw; this.off.height = bh; }
    const o = this.off.getContext('2d')!;

    // Game board background — same gradient mapped to board space
    const boardGrad = o.createLinearGradient(0, 0, bw, bh);
    boardGrad.addColorStop(0,   '#020209');
    boardGrad.addColorStop(mix, '#071330');
    boardGrad.addColorStop(1,   '#030310');
    o.fillStyle = boardGrad;
    o.fillRect(0, 0, bw, bh);

    // Advance rainbow stripe phase (~8 color-steps per second)
    this.rainbowPhase = (ts * 0.008) | 0;
    const flashOn = ((ts / 70) | 0) % 2 === 0;
    const flashSet = new Set(this.flash.map(f => f[0] + ',' + f[1]));
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const cell = this.grid[y][x]; if (!cell) continue;
        if (flashSet.has(x + ',' + y)) {
          if (flashOn) { o.fillStyle = '#ffffff'; o.fillRect(x * 8, y * 8, 8, 8); }
          continue;
        }
        this.sprite(o, x * 8, y * 8, cell.c, cell.t);
      }
    }
    if (this.pill) {
      for (const c of this.pillCells()) if (c.y >= 0) this.sprite(o, c.x * 8, c.y * 8, c.c, false);
    }
    for (const p of this.particles) {
      o.fillStyle = this.LIGHT[p.c]; o.fillRect(p.x | 0, p.y | 0, 2, 2);
    }

    const scale = Math.min(cw / bw, ch / bh);
    const dw = bw * scale, dh = bh * scale, boardX = (cw - dw) / 2;
    const cellW = dw / this.cols;
    const cellH = dh / this.rows;
    ctx.drawImage(this.off, boardX, 0, dw, dh);

    // ── drop-flash streaks ─────────────────────────────────────────────
    for (const f of this.dropFlashes) {
      const alpha = (f.life / 14) * 0.9;
      const y1 = f.yTop * cellH;
      const y2 = (f.yBot + 1) * cellH;
      for (const col of f.cols) {
        const x1 = boardX + col * cellW;
        const streak = ctx.createLinearGradient(0, y1, 0, y2);
        streak.addColorStop(0,   `rgba(200,230,255,0)`);
        streak.addColorStop(0.5, `rgba(180,210,255,${alpha * 0.5})`);
        streak.addColorStop(1,   `rgba(255,255,255,${alpha})`);
        ctx.fillStyle = streak;
        ctx.fillRect(x1, y1, cellW, y2 - y1);
      }
    }

    // ── grid lines drawn on main canvas for crisp 1px lines ──────────
    ctx.strokeStyle = 'rgba(110, 140, 220, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= this.cols; x++) {
      const px = boardX + x * cellW;
      ctx.moveTo(px, 0); ctx.lineTo(px, dh);
    }
    for (let y = 0; y <= this.rows; y++) {
      const py = y * cellH;
      ctx.moveTo(boardX, py); ctx.lineTo(boardX + dw, py);
    }
    ctx.stroke();

    this.cellPx = scale * 8;
  }

  sprite(o: CanvasRenderingContext2D, px: number, py: number, c: number, target: boolean) {
    if (c === this.RAINBOW) {
      // 45° diagonal wave: each pixel's color determined by (x+y) + time phase
      // Draw pixel-by-pixel at the offscreen canvas scale (8×8 at 1px each)
      for (let dy = 0; dy < 8; dy++) {
        for (let dx = 0; dx < 8; dx++) {
          const diag = (dx + dy + this.rainbowPhase) & 3;
          o.fillStyle = this.COLORS[diag];
          o.fillRect(px + dx, py + dy, 1, 1);
        }
      }
      // White shimmer on top edge
      o.fillStyle = 'rgba(255,255,255,0.55)';
      o.fillRect(px, py, 8, 1);
      o.fillRect(px, py, 1, 7);
      // Dark bottom edge
      o.fillStyle = 'rgba(0,0,0,0.45)';
      o.fillRect(px, py + 7, 8, 1);
      o.fillRect(px + 7, py, 1, 8);
      return;
    }
    o.fillStyle = this.COLORS[c]; o.fillRect(px, py, 8, 8);
    o.fillStyle = this.LIGHT[c]; o.fillRect(px, py, 8, 1); o.fillRect(px, py, 1, 8);
    o.fillStyle = this.DARK[c]; o.fillRect(px, py + 7, 8, 1); o.fillRect(px + 7, py, 1, 8);
    if (target) {
      o.fillStyle = '#141416';
      o.fillRect(px + 2, py + 3, 1, 1); o.fillRect(px + 5, py + 3, 1, 1);
      o.fillRect(px + 3, py + 5, 2, 1);
    }
  }

  // ── input ──────────────────────────────────────────────────────────────
  handleKey(e: KeyboardEvent) {
    if (this.state.screen !== 'play') return;
    if (e.key === 'ArrowLeft') this.move(-1);
    else if (e.key === 'ArrowRight') this.move(1);
    else if (e.key === 'ArrowUp' || e.key === ' ') { e.preventDefault(); this.rotate(); }
    else if (e.key === 'ArrowDown') this.fastDrop = true;
    else if (e.key === 'p') this.setState({ paused: !this.state.paused });
  }

  touchStart(e: TouchEvent) {
    e.preventDefault();
    // hold with one finger, tap a second finger to rotate (each tap = one rotate)
    if (e.touches.length > 1) { this.lastTap = 0; this.rotate(); return; }
    const t = e.touches[0], now = performance.now();
    if (this.lastTap && now - this.lastTap < 320 && Math.hypot(t.clientX - this.tapX, t.clientY - this.tapY) < 50) {
      this.lastTap = 0; this.rotate();
    } else { this.lastTap = now; this.tapX = t.clientX; this.tapY = t.clientY; }
    this.tstate = { active: true, sx: t.clientX, sy: t.clientY, rx: t.clientX, moved: false, t0: now, holdDir: 0, holdNext: 0, dropped: false };
  }

  touchMove(e: TouchEvent) {
    e.preventDefault();
    if (!this.tstate.active) return;
    const t = e.touches[0], st = this.tstate, cell = this.cellPx || 30;
    const totY = t.clientY - st.sy, totX = t.clientX - st.sx;
    // vertical hard-drop: strong downward swipe snaps piece to bottom and locks
    if (!st.dropped && totY > cell * 1.6 && Math.abs(totX) < Math.abs(totY)) {
      st.dropped = true; this.hardDrop(); return;
    }
    while (Math.abs(t.clientX - st.rx) >= cell * 0.75) {
      const dir = t.clientX > st.rx ? 1 : -1;
      this.move(dir);
      st.rx += dir * cell * 0.75;
      st.moved = true;
    }
    const off = t.clientX - st.rx;
    if (Math.abs(off) > cell * 1.2) {
      const now = performance.now();
      if (now > st.holdNext) { this.move(off > 0 ? 1 : -1); st.holdNext = now + 110; }
    }
    if (Math.abs(totX) > 12 || Math.abs(totY) > 12) this.lastTap = 0;
  }

  touchEnd(e: TouchEvent) {
    e.preventDefault();
    // ignore the second (rotate) finger lifting — only stop when all fingers are off
    if (e.touches.length > 0) return;
    this.tstate.active = false; this.fastDrop = false;
  }

  // ── react render ───────────────────────────────────────────────────────
  render() {
    const s = this.state;
    const set = (k: keyof State, sk: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = +e.target.value;
      this.setState({ [k]: v } as any);
      localStorage.setItem(sk, String(v));
    };

    const isMenu    = s.screen === 'menu';
    const isPaused  = s.paused && s.screen === 'play' && !s.landscape;
    const isOver    = s.screen === 'win' || s.screen === 'lose';
    const isPlaying = s.screen === 'play';
    const overTitle = s.screen === 'win' ? 'LEVEL CLEAR!' : 'GAME OVER';
    const overColor = s.screen === 'win' ? '#2ea043' : '#c23a3a';
    const sndTrack  = s.sound ? '#2ea043' : '#3a3a3e';
    const sndKnobL  = s.sound ? 'auto' : '0';
    const sndKnobR  = s.sound ? '0' : 'auto';
    const sndLabel  = s.sound ? 'ON' : 'OFF';

    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#1c1c1e', fontFamily: "'Press Start 2P', monospace", color: '#ffffff', position: 'relative', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 14px 10px', borderBottom: '4px solid #ffffff', flex: 'none' }}>
          <div style={{ fontSize: 13, lineHeight: 1 }}>score: {s.score}</div>
          <div style={{ fontSize: 9, color: '#d9cf4a', lineHeight: 1 }}>targets {s.left}</div>
          {isPlaying && (
            <button onClick={() => this.setState({ paused: !s.paused })} style={{ fontFamily: 'inherit', fontSize: 10, background: '#3a3a3e', color: '#ffffff', border: '2px solid #6e6e72', padding: '7px 11px', cursor: 'pointer' }}>
              PAUSE
            </button>
          )}
        </div>

        {/* Game area */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0, background: '#6e6e6e', touchAction: 'none' }}>
          <canvas ref={this.canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', imageRendering: 'pixelated' }} />

          {/* Menu overlay */}
          {isMenu && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,20,22,0.94)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflow: 'auto' }}>
              <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 34 }}>

                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 26, lineHeight: 1.3, color: '#ffffff' }}>
                    BIT<span style={{ color: '#c23a3a' }}>·</span>DROP
                  </div>
                  <div style={{ fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontWeight: 600, fontSize: 15, color: '#9a9aa0', lineHeight: 1.7 }}>
                    match 4 in a row to clear<br />wipe out every target square
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
                    <span style={{ color: '#9a9aa0' }}>BOARD WIDTH</span>
                    <span style={{ color: '#d9cf4a' }}>{s.width}</span>
                  </div>
                  <input type="range" min={8} max={24} step={1} value={s.width} onChange={set('width', 'bitdrop-w')} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
                    <span style={{ color: '#9a9aa0' }}>TARGET SQUARES</span>
                    <span style={{ color: '#d9cf4a' }}>{s.viruses}</span>
                  </div>
                  <input type="range" min={4} max={40} step={1} value={s.viruses} onChange={set('viruses', 'bitdrop-v')} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
                    <span style={{ color: '#9a9aa0' }}>SPEED</span>
                    <span style={{ color: '#d9cf4a' }}>{s.speed}</span>
                  </div>
                  <input type="range" min={1} max={9} step={1} value={s.speed} onChange={set('speed', 'bitdrop-s')} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: '#9a9aa0' }}>SOUND</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 9, color: s.sound ? '#2ea043' : '#9a9aa0', minWidth: 30, textAlign: 'right' }}>{sndLabel}</span>
                    <button onClick={() => { const v = !s.sound; this.setState({ sound: v }); localStorage.setItem('bitdrop-snd', v ? '1' : '0'); }}
                      style={{ fontFamily: 'inherit', width: 56, height: 26, padding: 0, background: sndTrack, border: '3px solid #141416', cursor: 'pointer', position: 'relative' }}>
                      <span style={{ position: 'absolute', top: 0, bottom: 0, width: 24, background: '#d9cf4a', left: sndKnobL, right: sndKnobR }} />
                    </button>
                  </div>
                </div>

                <button onClick={() => localStorage.getItem('bitdrop-tut') ? this.startGame() : this.startTutorial()} style={{ fontFamily: 'inherit', fontSize: 14, background: '#2ea043', color: '#ffffff', border: '4px solid #ffffff', padding: 16, cursor: 'pointer', marginTop: 4 }}>
                  START
                </button>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => this.startTutorial()} style={{ flex: 1, fontFamily: 'inherit', fontSize: 10, background: '#d9cf4a', color: '#141416', border: '4px solid #ffffff', padding: 13, cursor: 'pointer' }}>
                    TUTORIAL
                  </button>
                  <button onClick={() => this.setState({ screen: 'learn' })} style={{ flex: 1, fontFamily: 'inherit', fontSize: 10, background: '#2f4bc9', color: '#ffffff', border: '4px solid #ffffff', padding: 13, cursor: 'pointer' }}>
                    SCORING
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: '#ffffff' }}>best: {s.best}</div>
                  <div style={{ textAlign: 'center', fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: 15, fontWeight: 600, color: '#c8c8ce', lineHeight: 1.9 }}>
                    drag ◀▶ to move · hold + tap 2nd finger to rotate<br />swipe ▼ to hard drop
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Learn / scoring page */}
          {s.screen === 'learn' && <LearnPage onBack={() => this.setState({ screen: 'menu' })} />}

          {/* Tutorial prompt banner */}
          {isPlaying && s.tutStep >= 0 && s.tutStep < this.TUT.length && (
            <div style={{ position: 'absolute', top: 10, left: 10, right: 10, background: 'rgba(20,20,22,0.92)', border: '3px solid #d9cf4a', padding: '12px 12px 10px', display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 10, color: '#d9cf4a' }}>
                  {s.tutStep + 1}/{this.TUT.length} · {this.TUT[s.tutStep].title}
                </div>
                <button onClick={() => this.skipTutorial()} style={{ fontFamily: 'inherit', fontSize: 8, background: '#3a3a3e', color: '#fff', border: '2px solid #6e6e72', padding: '6px 10px', cursor: 'pointer', pointerEvents: 'auto' }}>
                  SKIP ▶
                </button>
              </div>
              <div style={{ fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontWeight: 600, fontSize: 15, color: '#e8e8ec', lineHeight: 1.55 }}>{this.TUT[s.tutStep].text}</div>
              {(this.TUT[s.tutStep].need || 1) > 1 && (
                <div style={{ fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontWeight: 700, fontSize: 14, color: '#2ea043' }}>{Math.min(this.tutCount, this.TUT[s.tutStep].need!)} / {this.TUT[s.tutStep].need}</div>
              )}
            </div>
          )}

          {/* Tutorial complete overlay */}
          {isPlaying && s.tutStep === this.TUT.length && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,20,22,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: '100%', maxWidth: 300, textAlign: 'center' }}>
                <div style={{ fontSize: 18, lineHeight: 1.5, color: '#2ea043' }}>TUTORIAL<br />COMPLETE!</div>
                <div style={{ fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontWeight: 600, fontSize: 15, color: '#c8c8ce', lineHeight: 1.7 }}>you know everything.<br />now go clear some targets!</div>
                <button onClick={() => { this.setState({ tutStep: -1 }); this.startGame(); }} style={{ fontFamily: 'inherit', fontSize: 12, background: '#2ea043', color: '#ffffff', border: '4px solid #ffffff', padding: 14, cursor: 'pointer' }}>
                  PLAY NOW
                </button>
                <button onClick={() => { this.phase = 'idle'; this.pill = null; this.setState({ screen: 'menu', tutStep: -1, paused: false }); }}
                  style={{ fontFamily: 'inherit', fontSize: 12, background: '#3a3a3e', color: '#ffffff', border: '4px solid #6e6e72', padding: 14, cursor: 'pointer' }}>
                  MENU
                </button>
              </div>
            </div>
          )}

          {/* Paused overlay */}
          {isPaused && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,20,22,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 300, textAlign: 'center' }}>
                <div style={{ fontSize: 20 }}>PAUSED</div>
                <button onClick={() => this.setState({ paused: false })} style={{ fontFamily: 'inherit', fontSize: 12, background: '#2ea043', color: '#ffffff', border: '4px solid #ffffff', padding: 14, cursor: 'pointer' }}>
                  RESUME
                </button>
                <button onClick={() => { this.phase = 'idle'; this.pill = null; this.setState({ screen: 'menu', paused: false, tutStep: -1 }); }}
                  style={{ fontFamily: 'inherit', fontSize: 12, background: '#3a3a3e', color: '#ffffff', border: '4px solid #6e6e72', padding: 14, cursor: 'pointer' }}>
                  QUIT
                </button>
              </div>
            </div>
          )}

          {/* Win / Lose overlay */}
          {isOver && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,20,22,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: '100%', maxWidth: 300, textAlign: 'center' }}>
                <div style={{ fontSize: 22, lineHeight: 1.4, color: overColor }}>{overTitle}</div>
                <div style={{ fontSize: 11, lineHeight: 2 }}>score: {s.score}<br />best: {s.best}</div>
                {s.newBest && (
                  <div style={{ fontSize: 10, color: '#d9cf4a', animation: 'blink 1s steps(1) infinite' }}>NEW BEST!</div>
                )}
                <button onClick={() => this.startGame()} style={{ fontFamily: 'inherit', fontSize: 12, background: '#2ea043', color: '#ffffff', border: '4px solid #ffffff', padding: 14, cursor: 'pointer' }}>
                  PLAY AGAIN
                </button>
                <button onClick={() => { this.phase = 'idle'; this.pill = null; this.setState({ screen: 'menu', paused: false }); }}
                  style={{ fontFamily: 'inherit', fontSize: 12, background: '#3a3a3e', color: '#ffffff', border: '4px solid #6e6e72', padding: 14, cursor: 'pointer' }}>
                  SETTINGS
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer hint bar */}
        <div style={{ flex: 'none', textAlign: 'center', fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: 14, fontWeight: 600, color: '#b4b4ba', padding: '12px 10px', lineHeight: 1.6 }}>
          drag ◀▶ move · hold + tap rotate · swipe ▼ drop
        </div>

        {/* Landscape warning */}
        {s.landscape && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: '#141416', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, textAlign: 'center', alignItems: 'center' }}>
              <div style={{ fontSize: 34, animation: 'blink 1.2s steps(1) infinite' }}>↻</div>
              <div style={{ fontSize: 13, lineHeight: 2 }}>ROTATE YOUR<br />DEVICE</div>
              <div style={{ fontSize: 8, color: '#9a9aa0', lineHeight: 1.8 }}>BIT·DROP plays in<br />portrait only</div>
            </div>
          </div>
        )}

      </div>
    );
  }
}
