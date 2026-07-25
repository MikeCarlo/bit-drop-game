import React from 'react';

// ── types ──────────────────────────────────────────────────────────────────
interface Cell { c: number; t: boolean; }
type Grid = (Cell | null)[][];
interface Pill { x: number; y: number; dir: number; a: number; b: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; c: number; }

interface State {
  screen: 'menu' | 'play' | 'win' | 'lose';
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
    screen: 'menu', score: 0, left: 0, paused: false, newBest: false,
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

  // game internals
  grid: Grid = [];
  rows = 16;
  cols = 10;
  pill: Pill | null = null;
  phase: 'idle' | 'fall' | 'flash' | 'grav' = 'idle';
  particles: Particle[] = [];
  flash: [number, number][] = [];
  lastFall = 0;
  gravT = 0;
  phaseUntil = 0;
  fastDrop = false;
  chain = 1;
  winPending = false;
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
    this.particles = []; this.flash = []; this.chain = 1; this.fastDrop = false; this.winPending = false;
    this.setState({ screen: 'play', score: 0, left: placed, paused: false, newBest: false });
    this.spawn();
    this.lastFall = performance.now();
    this.beep(523, 0.06);
  }

  runLen(x: number, y: number, dx: number, dy: number, c: number): number {
    let n = 0;
    for (let i = 1; i < 4; i++) {
      const cell = (this.grid[y + dy * i] || [])[x + dx * i];
      if (cell && cell.c === c) n++; else break;
    }
    return n;
  }

  spawn() {
    const x = (this.cols >> 1) - 1;
    this.pill = { x, y: 0, dir: 0, a: (Math.random() * 4) | 0, b: (Math.random() * 4) | 0 };
    this.fastDrop = false;
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
    if (this.fits(p)) { this.pill = p; this.beep(200, 0.03, 'square', 0.05); return true; }
    return false;
  }

  rotate() {
    if (this.phase !== 'fall' || !this.pill || this.state.paused) return;
    for (const kick of [0, -1, 1]) {
      const p = { ...this.pill, dir: (this.pill.dir + 1) % 4, x: this.pill.x + kick };
      if (this.fits(p)) { this.pill = p; this.beep(660, 0.05); return; }
    }
  }

  hardDrop() {
    if (this.phase !== 'fall' || !this.pill || this.state.paused) return;
    let p = this.pill;
    while (true) {
      const n = { ...p, y: p.y + 1 };
      if (this.fits(n)) p = n; else break;
    }
    this.pill = p; this.lock();
  }

  lock() {
    for (const c of this.pillCells()) if (c.y >= 0) this.grid[c.y][c.x] = { c: c.c, t: false };
    this.pill = null; this.chain = 1;
    this.beep(150, 0.07, 'triangle', 0.18);
    if (!this.checkClears()) this.spawn();
  }

  checkClears(): boolean {
    const marks = new Set<string>();
    const scan = (sx: number, sy: number, dx: number, dy: number) => {
      let run: [number, number][] = [], last = -1;
      let x = sx, y = sy;
      while (x < this.cols && y < this.rows) {
        const cell = this.grid[y][x];
        if (cell && cell.c === last) run.push([x, y]);
        else {
          if (run.length >= 4) run.forEach(p => marks.add(p[0] + ',' + p[1]));
          run = cell ? [[x, y]] : []; last = cell ? cell.c : -1;
        }
        x += dx; y += dy;
      }
      if (run.length >= 4) run.forEach(p => marks.add(p[0] + ',' + p[1]));
    };
    for (let y = 0; y < this.rows; y++) scan(0, y, 1, 0);
    for (let x = 0; x < this.cols; x++) scan(x, 0, 0, 1);
    if (!marks.size) return false;
    this.flash = [...marks].map(s => s.split(',').map(Number) as [number, number]);
    this.phase = 'flash'; this.phaseUntil = performance.now() + 260;
    return true;
  }

  doClear() {
    let pts = 0, targets = 0;
    for (const [x, y] of this.flash) {
      const cell = this.grid[y][x];
      if (!cell) continue;
      pts += (cell.t ? 50 : 10) * this.chain;
      if (cell.t) targets++;
      this.burst(x, y, cell.c);
      this.grid[y][x] = null;
    }
    this.flash = [];
    const left = this.state.left - targets;
    this.setState({ score: this.state.score + pts, left });
    this.arp(this.chain > 1 ? [659, 784, 988] : [523, 659, 784], 55, 0.09);
    this.chain++;
    this.phase = 'grav'; this.gravT = performance.now() + 120;
    if (left <= 0) this.winPending = true;
  }

  gravStep(): boolean {
    let moved = false;
    for (let y = this.rows - 2; y >= 0; y--) {
      for (let x = 0; x < this.cols; x++) {
        const cell = this.grid[y][x];
        if (cell && !cell.t && !this.grid[y + 1][x]) {
          this.grid[y + 1][x] = cell; this.grid[y][x] = null; moved = true;
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
        const iv = this.fastDrop ? 45 : 1000 - this.state.speed * 90;
        if (ts - this.lastFall > iv) {
          this.lastFall = ts;
          const p = { ...this.pill, y: this.pill.y + 1 };
          if (this.fits(p)) this.pill = p; else this.lock();
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
    this.draw(ts);
  }

  burst(x: number, y: number, c: number) {
    for (let i = 0; i < 7; i++) this.particles.push({
      x: x * 8 + 4, y: y * 8 + 4,
      vx: (Math.random() - 0.5) * 2.4, vy: -Math.random() * 2 - 0.4,
      life: 26 + Math.random() * 14, c,
    });
  }

  // ── render (canvas) ────────────────────────────────────────────────────
  draw(ts: number) {
    const cv = this.canvasRef.current; if (!cv) return;
    const box = cv.parentElement!, cw = box.clientWidth, ch = box.clientHeight;
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#6e6e6e'; ctx.fillRect(0, 0, cw, ch);
    if (this.state.screen === 'menu' || !this.grid.length) return;
    const bw = this.cols * 8, bh = this.rows * 8;
    if (this.off.width !== bw || this.off.height !== bh) { this.off.width = bw; this.off.height = bh; }
    const o = this.off.getContext('2d')!;
    o.fillStyle = '#6e6e6e'; o.fillRect(0, 0, bw, bh);
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
    const dw = bw * scale, dh = bh * scale, ox = (cw - dw) / 2;
    ctx.fillStyle = '#57575a'; ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(this.off, ox, 0, dw, dh);
    this.cellPx = scale * 8;
  }

  sprite(o: CanvasRenderingContext2D, px: number, py: number, c: number, target: boolean) {
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
    const t = e.touches[0], now = performance.now();
    if (this.lastTap && now - this.lastTap < 300 && Math.hypot(t.clientX - this.tapX, t.clientY - this.tapY) < 40) {
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

  touchEnd(e: TouchEvent) { e.preventDefault(); this.tstate.active = false; this.fastDrop = false; }

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
                  <div style={{ fontSize: 8, color: '#9a9aa0', lineHeight: 1.8 }}>
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
                  <button onClick={() => { const v = !s.sound; this.setState({ sound: v }); localStorage.setItem('bitdrop-snd', v ? '1' : '0'); }}
                    style={{ fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 0, width: 64, height: 26, padding: 0, background: sndTrack, border: '3px solid #141416', cursor: 'pointer', position: 'relative' }}>
                    <span style={{ position: 'absolute', top: 0, bottom: 0, width: 26, background: '#d9cf4a', left: sndKnobL, right: sndKnobR }} />
                    <span style={{ flex: 1, textAlign: 'center', fontSize: 8, color: '#ffffff' }}>{sndLabel}</span>
                  </button>
                </div>

                <button onClick={() => this.startGame()} style={{ fontFamily: 'inherit', fontSize: 14, background: '#2ea043', color: '#ffffff', border: '4px solid #ffffff', padding: 16, cursor: 'pointer', marginTop: 4 }}>
                  START
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: '#ffffff' }}>best: {s.best}</div>
                  <div style={{ textAlign: 'center', fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: 15, fontWeight: 600, color: '#c8c8ce', lineHeight: 1.9 }}>
                    drag ◀▶ to move · double-tap to rotate<br />swipe ▼ to hard drop
                  </div>
                </div>

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
                <button onClick={() => { this.phase = 'idle'; this.pill = null; this.setState({ screen: 'menu', paused: false }); }}
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
          drag ◀▶ move · double-tap rotate · swipe ▼ drop
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
