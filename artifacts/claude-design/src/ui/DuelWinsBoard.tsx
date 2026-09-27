import React from 'react';
import type { WinsRow } from '../duel/types';

const BODY = 'ui-monospace,Menlo,Consolas,monospace';

export function DuelWinsBoard({
  month,
  rows,
  you,
  onBack,
  compact = false,
}: {
  month: string;
  rows: WinsRow[];
  you?: string;
  onBack?: () => void;
  compact?: boolean;
}) {
  const shown = compact ? rows.slice(0, 5) : rows;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 8 : 12, width: '100%', minHeight: 0, flex: compact ? undefined : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: compact ? 10 : 13, color: '#d9cf4a' }}>DUEL WINS</div>
          <div style={{ fontFamily: BODY, fontSize: 11, color: '#8e8e94', marginTop: 4 }}>{month} UTC</div>
        </div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            style={{ fontFamily: 'inherit', fontSize: 10, background: '#3a3a3e', color: '#fff', border: '2px solid #6e6e72', padding: '8px 12px', cursor: 'pointer' }}
          >
            ◀ BACK
          </button>
        )}
      </div>
      {shown.length === 0 ? (
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 14, color: '#9a9aa0', textAlign: 'center', lineHeight: 1.6 }}>
          no duel wins this month
        </div>
      ) : (
        <div className={compact ? undefined : 'bitdrop-scores-list'} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shown.map((row) => {
            const mine = you != null && row.player.toLowerCase() === you.toLowerCase();
            return (
              <div
                key={row.player}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '36px 1fr auto',
                  gap: 8,
                  alignItems: 'center',
                  padding: '8px 10px',
                  background: mine ? 'rgba(217,207,74,0.14)' : '#232326',
                  border: mine ? '2px solid #d9cf4a' : '2px solid #3a3a3e',
                }}
              >
                <div style={{ fontSize: 10, color: row.rank === 1 ? '#d9cf4a' : '#9a9aa0' }}>#{row.rank}</div>
                <div style={{ fontFamily: BODY, fontSize: 13, fontWeight: 700, color: '#fff' }}>{row.player}</div>
                <div style={{ fontSize: 12, color: '#2ea043' }}>{row.wins}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
