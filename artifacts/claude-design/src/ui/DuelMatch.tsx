import React from 'react';
import { duelApi } from '../duel/api';
import type { MatchView, WinsBoard } from '../duel/types';
import { DuelWinsBoard } from './DuelWinsBoard';

const BODY = 'ui-monospace,Menlo,Consolas,monospace';

export function DuelMatch({
  match,
  error,
  busy,
  vsPc = false,
  onReady,
  onForfeit,
  onMenu,
  onRetry,
}: {
  match: MatchView;
  error: string | null;
  busy: boolean;
  vsPc?: boolean;
  onReady: () => void;
  onForfeit: () => void;
  onMenu: () => void;
  onRetry?: () => void;
}) {
  const [wins, setWins] = React.useState<WinsBoard | null>(null);
  const youWonRound = match.roundWinner != null && match.roundWinner.toLowerCase() === match.you.toLowerCase();
  const youWonMatch = match.winner != null && match.winner.toLowerCase() === match.you.toLowerCase();

  React.useEffect(() => {
    if (vsPc || match.phase !== 'complete') return;
    let stop = false;
    void duelApi.wins().then((board) => {
      if (!stop) setWins(board);
    }).catch(() => {
      if (!stop) setWins(null);
    });
    return () => {
      stop = true;
    };
  }, [vsPc, match.phase, match.id, match.winner]);

  const title =
    match.phase === 'complete'
      ? youWonMatch ? 'YOU WON THE MATCH' : 'MATCH LOST'
      : error && match.phase === 'playing'
        ? 'RESULT NOT SAVED'
        : youWonRound ? 'ROUND WON' : match.roundWinner ? 'ROUND LOST' : 'SENDING RESULT…';
  const titleColor = title.startsWith('YOU WON') || title === 'ROUND WON' ? '#2ea043' : title === 'SENDING RESULT…' ? '#d9cf4a' : '#c23a3a';

  return (
    <div className="bitdrop-duel-overlay" data-testid="bitdrop-duel-match">
      <div className="bitdrop-duel-panel">
        <div style={{ fontSize: 16, lineHeight: 1.45, color: titleColor }}>{title}</div>
        <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 16, color: '#fff' }}>
          {match.p1} {match.wins[0]} — {match.wins[1]} {match.p2}
        </div>
        <div style={{ fontFamily: BODY, fontSize: 13, color: '#9a9aa0', lineHeight: 1.5 }}>
          First to 3 · round {match.round}
          {match.phase === 'between' && !match.youReady && ' · tap next when you are ready'}
          {match.phase === 'between' && match.youReady && !match.opponentReady && ' · waiting for your opponent'}
          {match.phase === 'playing' && !error && ' · next round is starting'}
        </div>
        {error && <div style={{ fontFamily: BODY, fontSize: 12, color: '#e07070', lineHeight: 1.4 }}>{error}</div>}
        {match.phase === 'between' && !match.youReady && (
          <button type="button" disabled={busy} onClick={onReady} style={goBtn}>NEXT ROUND</button>
        )}
        {onRetry && error && match.phase === 'playing' && (
          <button type="button" disabled={busy} onClick={onRetry} style={goBtn}>RETRY RESULT</button>
        )}
        {match.phase === 'complete' && !vsPc && wins && (
          <DuelWinsBoard month={wins.month} rows={wins.rows} you={match.you} compact />
        )}
        {match.phase === 'complete' && vsPc && (
          <div style={{ fontFamily: BODY, fontSize: 12, color: '#9a9aa0', lineHeight: 1.45 }}>
            PC games stay off the monthly wins board.
          </div>
        )}
        {match.phase !== 'complete' && !vsPc && (
          <button type="button" disabled={busy} onClick={onForfeit} style={ghostBtn}>FORFEIT</button>
        )}
        {match.phase !== 'complete' && vsPc && (
          <button type="button" onClick={onMenu} style={ghostBtn}>QUIT</button>
        )}
        {match.phase === 'complete' && (
          <button type="button" onClick={onMenu} style={ghostBtn}>MENU</button>
        )}
      </div>
    </div>
  );
}

const goBtn: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 12,
  background: '#2ea043',
  color: '#fff',
  border: '4px solid #fff',
  padding: 14,
  cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 12,
  background: '#3a3a3e',
  color: '#fff',
  border: '3px solid #6e6e72',
  padding: 12,
  cursor: 'pointer',
};
