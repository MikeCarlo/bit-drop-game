import React from 'react';
import { duelApi, DuelRequestError } from '../duel/api';
import type { DuelSettings, DuelState, MatchView } from '../duel/types';

const BODY = 'ui-monospace,Menlo,Consolas,monospace';

function focusChallengeId(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('duel');
  } catch {
    return null;
  }
}

export function DuelLobby({
  settings,
  onBack,
  onPlay,
  onWins,
}: {
  settings: DuelSettings;
  onBack: () => void;
  onPlay: (match: MatchView) => void;
  onWins: () => void;
}) {
  const [state, setState] = React.useState<DuelState | null>(null);
  const [opponent, setOpponent] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState<string | null>(null);
  const focus = React.useMemo(() => focusChallengeId(), []);

  const onPlayRef = React.useRef(onPlay);
  onPlayRef.current = onPlay;

  const refresh = React.useCallback(async () => {
    const next = await duelApi.state();
    setState(next);
    if (next.active && next.active.phase !== 'complete') onPlayRef.current(next.active);
    return next;
  }, []);

  React.useEffect(() => {
    let stop = false;
    const tick = () => {
      void refresh().catch((err: unknown) => {
        if (stop) return;
        setError(err instanceof DuelRequestError ? err.message : 'Could not reach the duel server');
      });
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [refresh]);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await duelApi.challenge(opponent, settings);
      setOpponent('');
      await refresh();
    } catch (err) {
      setError(err instanceof DuelRequestError ? err.message : 'Could not send the challenge');
    } finally {
      setBusy(false);
    }
  }

  async function accept(id: string) {
    setBusy(true);
    setError(null);
    try {
      const match = await duelApi.accept(id);
      onPlay(match);
    } catch (err) {
      setError(err instanceof DuelRequestError ? err.message : 'Could not accept');
      setBusy(false);
    }
  }

  async function pass(id: string, kind: 'decline' | 'cancel') {
    setBusy(true);
    setError(null);
    try {
      if (kind === 'decline') await duelApi.decline(id);
      else await duelApi.cancel(id);
      await refresh();
    } catch (err) {
      setError(err instanceof DuelRequestError ? err.message : 'Could not update the challenge');
    } finally {
      setBusy(false);
    }
  }

  async function copy(id: string, link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(id);
    } catch {
      setCopied(null);
      setError(link);
    }
  }

  const inbox = state?.inbox ?? [];
  const outbox = state?.outbox ?? [];

  return (
    <div className="bitdrop-duel-overlay" data-testid="bitdrop-duel-overlay">
      <div className="bitdrop-duel-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 14, color: '#d9cf4a' }}>1v1 DUEL</div>
          <button type="button" onClick={onBack} style={ghostBtn}>◀ MENU</button>
        </div>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 13, color: '#c8c8ce', lineHeight: 1.45 }}>
          First to 3 rounds. You set the board: {settings.width}w · {settings.viruses} targets · speed {settings.speed}.
          {state?.username ? ` Signed in as ${state.username}.` : ''}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="opponent username"
            aria-label="Opponent Reddit username"
            style={{
              flex: 1,
              fontFamily: BODY,
              fontSize: 14,
              fontWeight: 700,
              padding: '10px 8px',
              background: '#141416',
              color: '#fff',
              border: '3px solid #6e6e72',
            }}
          />
          <button type="button" disabled={busy || !opponent.trim()} onClick={() => void send()} style={goBtn}>
            SEND
          </button>
        </div>

        {error && (
          <div style={{ fontFamily: BODY, fontSize: 12, color: '#e07070', lineHeight: 1.4, wordBreak: 'break-all' }}>{error}</div>
        )}

        <div className="bitdrop-duel-scroll">
          <Section title="CHALLENGES FOR YOU">
            {inbox.length === 0 && <Empty>none right now — they show up here when someone challenges you</Empty>}
            {inbox.map((ch) => (
              <Card key={ch.id} hot={focus === ch.id}>
                <div style={nameStyle}>{ch.challenger}</div>
                <div style={metaStyle}>{ch.width}w · {ch.viruses}t · s{ch.speed}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" disabled={busy} onClick={() => void accept(ch.id)} style={goBtn}>ACCEPT</button>
                  <button type="button" disabled={busy} onClick={() => void pass(ch.id, 'decline')} style={ghostBtn}>NO</button>
                </div>
              </Card>
            ))}
          </Section>

          <Section title="WAITING ON THEM">
            {outbox.length === 0 && <Empty>no outgoing challenges</Empty>}
            {outbox.map((ch) => (
              <Card key={ch.id}>
                <div style={nameStyle}>{ch.opponent}</div>
                <div style={metaStyle}>same post · they accept in the app</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => void copy(ch.id, ch.link)} style={ghostBtn}>
                    {copied === ch.id ? 'COPIED' : 'COPY LINK'}
                  </button>
                  <button type="button" disabled={busy} onClick={() => void pass(ch.id, 'cancel')} style={ghostBtn}>CANCEL</button>
                </div>
              </Card>
            ))}
          </Section>
        </div>

        <button type="button" onClick={onWins} style={ghostBtn}>MONTHLY DUEL WINS</button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 9, color: '#9a9aa0' }}>{title}</div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: BODY, fontSize: 12, color: '#8e8e94', lineHeight: 1.45 }}>{children}</div>;
}

function Card({ children, hot }: { children: React.ReactNode; hot?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: 10,
      background: '#232326',
      border: hot ? '2px solid #d9cf4a' : '2px solid #3a3a3e',
    }}>
      {children}
    </div>
  );
}

const goBtn: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 10,
  background: '#2ea043',
  color: '#fff',
  border: '3px solid #fff',
  padding: '10px 12px',
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

const nameStyle: React.CSSProperties = { fontFamily: BODY, fontWeight: 700, fontSize: 14, color: '#fff' };
const metaStyle: React.CSSProperties = { fontFamily: BODY, fontSize: 12, color: '#8e8e94' };
