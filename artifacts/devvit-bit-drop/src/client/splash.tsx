import './splash.css';

import { context, requestExpandedMode } from '@devvit/web/client';
import { StrictMode, useState, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';

const PIXEL = "'Press Start 2P', monospace";
const BODY = 'ui-monospace, Menlo, Consolas, monospace';

export const Splash = () => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const username = context?.username ?? 'player';

  const play = async (event: MouseEvent<HTMLButtonElement>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await requestExpandedMode(event.nativeEvent, 'game');
    } catch (err) {
      console.error('Failed to enter expanded mode:', err);
      setError('Open this post on Reddit. Playtest needs a Reddit session — localhost has no backend.');
      setBusy(false);
    }
  };

  return (
    <div
      data-feed-scroll="ok"
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: '#1c1c1e',
        color: '#ffffff',
        fontFamily: PIXEL,
        touchAction: 'pan-y',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 340,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 22, lineHeight: 1.4 }}>
          BIT<span style={{ color: '#c23a3a' }}>·</span>DROP
        </div>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 14, color: '#9a9aa0', lineHeight: 1.5 }}>
          hey {username} — match 4 in a row, wipe every target
        </div>
        <button
          type="button"
          onClick={(e) => void play(e)}
          disabled={busy}
          style={{
            fontSize: 14,
            background: '#2ea043',
            color: '#ffffff',
            border: '4px solid #ffffff',
            padding: 14,
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? 'OPENING…' : 'PLAY'}
        </button>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 12, color: '#8e8e94', lineHeight: 1.5 }}>
          solo · high scores · any orientation
        </div>
        {error && (
          <div style={{ fontFamily: BODY, fontSize: 12, color: '#c23a3a', lineHeight: 1.4 }}>{error}</div>
        )}
      </div>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>,
);
