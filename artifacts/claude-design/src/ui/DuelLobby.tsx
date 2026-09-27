import React from 'react';
import { duelApi, DuelRequestError } from '../duel/api';
import { formatWait } from '../duel/pcMatch';
import type { DuelSettings, MatchView } from '../duel/types';

const BODY = 'ui-monospace,Menlo,Consolas,monospace';

export function DuelLobby({
  settings,
  onBack,
  onPlay,
  onVsPc,
  onWins,
}: {
  settings: DuelSettings;
  onBack: () => void;
  onPlay: (match: MatchView) => void;
  onVsPc: () => void;
  onWins: () => void;
}) {
  const [origin, setOrigin] = React.useState(() => Date.now());
  const [now, setNow] = React.useState(() => Date.now());
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const onPlayRef = React.useRef(onPlay);
  onPlayRef.current = onPlay;
  const alive = React.useRef(0);
  const leftOnPurpose = React.useRef(false);

  const { width, viruses, speed } = settings;

  React.useEffect(() => {
    const token = ++alive.current;
    let stop = false;

    const take = (match: MatchView | null | undefined, at: number | null | undefined) => {
      if (stop) return;
      if (at) setOrigin(at);
      if (match && match.phase !== 'complete') onPlayRef.current(match);
    };

    void duelApi.joinQueue({ width, viruses, speed }).then((joined) => {
      take(joined.match, joined.queue?.joinedAt ?? null);
    }).catch((err: unknown) => {
      if (stop) return;
      setError(err instanceof DuelRequestError ? err.message : 'Could not reach the duel server');
    });

    const poll = window.setInterval(() => {
      void duelApi.state().then((next) => {
        take(next.active, next.queue?.joinedAt ?? null);
      }).catch((err: unknown) => {
        if (stop) return;
        setError(err instanceof DuelRequestError ? err.message : 'Could not reach the duel server');
      });
    }, 1000);

    const clock = window.setInterval(() => setNow(Date.now()), 250);

    return () => {
      stop = true;
      window.clearInterval(poll);
      window.clearInterval(clock);
      window.setTimeout(() => {
        if (leftOnPurpose.current) return;
        if (alive.current !== token) return;
        void duelApi.leaveQueue().catch(() => undefined);
      }, 50);
    };
  }, [width, viruses, speed]);

  async function startNow() {
    leftOnPurpose.current = true;
    setBusy(true);
    setError(null);
    try {
      const left = await duelApi.leaveQueue();
      if (left.match && left.match.phase !== 'complete') {
        onPlay(left.match);
        return;
      }
    } catch {
      /* The bot still starts if the queue cannot be reached. */
    }
    onVsPc();
  }

  async function back() {
    leftOnPurpose.current = true;
    try {
      await duelApi.leaveQueue();
    } catch {
      /* Leaving the screen still drops the local lobby. */
    }
    onBack();
  }

  const waited = Math.max(0, now - origin);

  return (
    <div className="bitdrop-duel-overlay" data-testid="bitdrop-duel-overlay">
      <div className="bitdrop-duel-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 14, color: '#d9cf4a' }}>FINDING A CHALLENGER</div>
          <button type="button" onClick={() => void back()} style={ghostBtn}>◀ MENU</button>
        </div>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 13, color: '#c8c8ce', lineHeight: 1.45 }}>
          Looking for another player. First to 3. Garbage on.
          Your board: {width}w · {viruses} targets · speed {speed}.
          The first player in the queue sets the board.
        </div>

        <div
          data-testid="duel-wait-timer"
          style={{
            fontFamily: BODY,
            fontWeight: 700,
            fontSize: 36,
            letterSpacing: 2,
            color: '#d9cf4a',
            textAlign: 'center',
            lineHeight: 1.1,
          }}
        >
          {formatWait(waited)}
        </div>
        <div style={{ fontFamily: BODY, fontSize: 12, color: '#9a9aa0', textAlign: 'center' }}>
          waiting for a human
        </div>

        {error && (
          <div style={{ fontFamily: BODY, fontSize: 12, color: '#e07070', lineHeight: 1.4 }}>{error}</div>
        )}

        <button type="button" data-testid="start-now" disabled={busy} onClick={() => void startNow()} style={startBtn}>
          START NOW
        </button>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 13, color: '#c8c8ce', textAlign: 'center', lineHeight: 1.4 }}>
          Don’t wait — play now against a bot.
        </div>

        <button type="button" onClick={onWins} style={ghostBtn}>MONTHLY DUEL WINS</button>
      </div>
    </div>
  );
}

const startBtn: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 14,
  background: '#2ea043',
  color: '#fff',
  border: '4px solid #fff',
  padding: '14px 12px',
  cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 10,
  background: '#3a3a3e',
  color: '#fff',
  border: '2px solid #6e6e72',
  padding: '8px 12px',
  cursor: 'pointer',
};
