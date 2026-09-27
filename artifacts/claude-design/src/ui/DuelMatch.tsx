import type { CSSProperties } from 'react';
import { botSkillLabel } from '../duel/pcMatch';
import type { MatchView } from '../duel/types';
import { DuelResult } from './DuelResult';

const BODY = 'ui-monospace,Menlo,Consolas,monospace';

export function DuelMatch({
  match,
  error,
  busy,
  vsPc = false,
  botSkill = 0,
  onReady,
  onForfeit,
  onMenu,
  onPlayAgain,
  onFind,
  onRetry,
}: {
  match: MatchView;
  error: string | null;
  busy: boolean;
  vsPc?: boolean;
  /** Rolled once for this bot match. 0 hides the label. */
  botSkill?: number;
  onReady: () => void;
  onForfeit: () => void;
  onMenu: () => void;
  onPlayAgain: () => void;
  onFind: () => void;
  onRetry?: () => void;
}) {
  if (match.phase === 'complete') {
    return (
      <DuelResult
        match={match}
        vsPc={vsPc}
        botSkill={botSkill}
        onPlayAgain={onPlayAgain}
        onFind={onFind}
        onMenu={onMenu}
      />
    );
  }

  const youWonRound = match.roundWinner != null && match.roundWinner.toLowerCase() === match.you.toLowerCase();

  const title =
    error && match.phase === 'playing'
      ? 'RESULT NOT SAVED'
      : youWonRound ? 'ROUND WON' : match.roundWinner ? 'ROUND LOST' : 'SENDING RESULT…';
  const titleColor = title === 'ROUND WON' ? '#2ea043' : title === 'SENDING RESULT…' ? '#d9cf4a' : '#c23a3a';

  return (
    <div className="bitdrop-duel-overlay" data-testid="bitdrop-duel-match">
      <div className="bitdrop-duel-panel">
        <div style={{ fontSize: 16, lineHeight: 1.45, color: titleColor }}>{title}</div>
        <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 16, color: '#fff' }}>
          {match.p1} {match.wins[0]} — {match.wins[1]} {match.p2}
        </div>
        {vsPc && botSkill > 0 && (
          <div data-testid="bot-skill" style={{ fontSize: 13, color: '#d9cf4a', letterSpacing: 0.6 }}>{botSkillLabel(botSkill)}</div>
        )}
        <div style={{ fontFamily: BODY, fontSize: 13, color: '#9a9aa0', lineHeight: 1.5 }}>
          First to 3 · round {match.round}
          {match.phase === 'between' && !match.youReady && ' · tap next when you are ready'}
          {match.phase === 'between' && match.youReady && !match.opponentReady && ' · waiting for your opponent'}
          {match.phase === 'playing' && !error && ' · next round is starting'}
        </div>
        {error && (
          <div style={{ fontFamily: BODY, fontSize: 12, color: '#e07070', lineHeight: 1.4 }}>{error}</div>
        )}
        {match.phase === 'between' && !match.youReady && (
          <button type="button" disabled={busy} onClick={onReady} style={goBtn}>NEXT ROUND</button>
        )}
        {onRetry && error && match.phase === 'playing' && (
          <button type="button" disabled={busy} onClick={onRetry} style={goBtn}>RETRY RESULT</button>
        )}
        {!vsPc && (
          <button type="button" disabled={busy} onClick={onForfeit} style={ghostBtn}>FORFEIT</button>
        )}
        {vsPc && (
          <button type="button" onClick={onMenu} style={ghostBtn}>QUIT</button>
        )}
      </div>
    </div>
  );
}

const goBtn: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 12,
  background: '#2ea043',
  color: '#fff',
  border: '4px solid #fff',
  padding: 14,
  cursor: 'pointer',
};

const ghostBtn: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 12,
  background: '#3a3a3e',
  color: '#fff',
  border: '3px solid #6e6e72',
  padding: 12,
  cursor: 'pointer',
};
