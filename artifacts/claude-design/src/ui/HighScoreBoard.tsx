import React from 'react';
import type { ScoreRecord } from '../leaderboard';

const BODY = 'ui-monospace,Menlo,Consolas,monospace';

function formatWhen(ts: number): string {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function settingsLabel(row: ScoreRecord): string {
  return `${row.width}w · ${row.viruses}t · s${row.speed}`;
}

export function HighScoreBoard({
  scores,
  highlightId,
  compact = false,
  onBack,
}: {
  scores: ScoreRecord[];
  highlightId?: string | null;
  compact?: boolean;
  onBack?: () => void;
}) {
  const rows = compact ? scores.slice(0, 3) : scores;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: compact ? 10 : 16,
      width: '100%',
      textAlign: 'left',
      minHeight: 0,
      flex: compact ? undefined : 1,
    }}>
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 14, color: '#d9cf4a' }}>HIGH SCORES</div>
          {onBack && (
            <button
              onClick={onBack}
              style={{ fontFamily: 'inherit', fontSize: 10, background: '#3a3a3e', color: '#fff', border: '2px solid #6e6e72', padding: '8px 12px', cursor: 'pointer' }}
            >
              ◀ BACK
            </button>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 14, color: '#9a9aa0', textAlign: 'center', lineHeight: 1.6, padding: '8px 0' }}>
          no scores yet
        </div>
      ) : (
        <div className={compact ? undefined : 'bitdrop-scores-list'} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((row, i) => {
            const hi = highlightId != null && row.id === highlightId;
            return (
              <div
                key={row.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 1fr auto',
                  gap: 8,
                  alignItems: 'center',
                  padding: compact ? '6px 8px' : '8px 10px',
                  background: hi ? 'rgba(217,207,74,0.14)' : '#232326',
                  border: hi ? '2px solid #d9cf4a' : '2px solid #3a3a3e',
                }}
              >
                <div style={{ fontSize: 10, color: i === 0 ? '#d9cf4a' : '#9a9aa0' }}>#{i + 1}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: compact ? 10 : 11, color: '#fff', lineHeight: 1.4 }}>
                    {row.score}
                    {row.won ? <span style={{ color: '#2ea043', fontSize: 8 }}> W</span> : <span style={{ color: '#c23a3a', fontSize: 8 }}> L</span>}
                  </div>
                  {!compact && (
                    <div style={{ fontFamily: BODY, fontSize: 11, color: '#8e8e94', marginTop: 3 }}>
                      {row.player} · {settingsLabel(row)}
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: BODY, fontSize: 11, color: '#8e8e94', textAlign: 'right' }}>
                  {formatWhen(row.playedAt)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
