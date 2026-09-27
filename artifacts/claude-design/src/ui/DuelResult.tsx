import React from 'react';
import { duelApi, DuelRequestError } from '../duel/api';
import { isBotCreditId } from '../duel/pcMatch';
import { facedLabel, formatSetScore, outcomeTitle, yourSetScore } from '../duel/result';
import type { MatchView, WinsBoard } from '../duel/types';
import { DuelWinsBoard } from './DuelWinsBoard';

const BODY = 'ui-monospace,Menlo,Consolas,monospace';

/** Match-over scene. Shown only after first-to-3, for a human or a bot. */
export function DuelResult({
  match,
  vsPc = false,
  botSkill = 0,
  onPlayAgain,
  onFind,
  onMenu,
}: {
  match: MatchView;
  vsPc?: boolean;
  botSkill?: number;
  onPlayAgain: () => void;
  onFind: () => void;
  onMenu: () => void;
}) {
  const [wins, setWins] = React.useState<WinsBoard | null>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const youWon = match.winner != null && match.winner.toLowerCase() === match.you.toLowerCase();
  const title = outcomeTitle(youWon);
  const [mine, theirs] = yourSetScore(match.seat, match.wins);
  const faced = facedLabel(vsPc, match.opponent, botSkill);

  React.useEffect(() => {
    let stop = false;
    const load = async () => {
      if (vsPc) {
        if (youWon && isBotCreditId(match.id)) {
          try {
            const board = await duelApi.recordBotWin(match.id);
            if (!stop) setWins(board);
            return;
          } catch (err) {
            if (!stop) {
              setLocalError(err instanceof DuelRequestError ? err.message : 'Could not save the bot win');
            }
          }
        }
        const board = await duelApi.botWins();
        if (!stop) setWins(board);
        return;
      }
      const board = await duelApi.wins();
      if (!stop) setWins(board);
    };
    void load().catch(() => {
      if (!stop) setWins(null);
    });
    return () => {
      stop = true;
    };
  }, [vsPc, match.id, match.winner, youWon]);

  return (
    <div className="bitdrop-duel-overlay" data-testid="bitdrop-duel-match">
      <div className="bitdrop-duel-panel bitdrop-duel-result" data-testid="duel-result">
        <div
          data-testid="duel-outcome"
          className={youWon ? 'bitdrop-duel-outcome bitdrop-duel-outcome-win' : 'bitdrop-duel-outcome bitdrop-duel-outcome-lose'}
        >
          {title}
        </div>
        <div data-testid="duel-set-score" style={{ fontFamily: BODY, fontWeight: 800, fontSize: 32, color: '#fff', letterSpacing: 1, lineHeight: 1 }}>
          {formatSetScore(mine, theirs)}
        </div>
        <div data-testid="duel-faced" style={{ fontFamily: BODY, fontWeight: 700, fontSize: 14, color: '#d9cf4a', lineHeight: 1.4, overflowWrap: 'anywhere' }}>
          vs {faced}
        </div>
        <div style={{ fontFamily: BODY, fontSize: 12, color: '#9a9aa0' }}>First to 3 · match over</div>
        <button type="button" data-testid="duel-play-again" onClick={onPlayAgain} style={goBtn}>PLAY AGAIN</button>
        <button type="button" data-testid="duel-find" onClick={onFind} style={findBtn}>FIND A CHALLENGER</button>
        <button type="button" data-testid="duel-menu" onClick={onMenu} style={ghostBtn}>MENU</button>
        <div className="bitdrop-duel-scroll">
          {localError && (
            <div style={{ fontFamily: BODY, fontSize: 12, color: '#e07070', lineHeight: 1.4 }}>{localError}</div>
          )}
          {vsPc && (
            <div style={{ fontFamily: BODY, fontSize: 12, color: '#9a9aa0', lineHeight: 1.45 }}>
              {youWon
                ? 'This win is on the bot board only.'
                : 'A loss to the PC is not added to either board.'}
            </div>
          )}
          {vsPc && wins && (
            <DuelWinsBoard
              month={wins.month}
              rows={wins.rows}
              you={match.you}
              compact
              title="BOT BOARD"
              hint="wins vs the PC"
              empty="no bot wins this month"
            />
          )}
          {!vsPc && wins && (
            <DuelWinsBoard month={wins.month} rows={wins.rows} you={match.you} compact />
          )}
        </div>
      </div>
    </div>
  );
}

const goBtn: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 11,
  background: '#2ea043',
  color: '#fff',
  border: '3px solid #fff',
  padding: '8px 10px',
  cursor: 'pointer',
  flex: 'none',
};

const findBtn: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 10,
  background: '#c23a3a',
  color: '#fff',
  border: '3px solid #fff',
  padding: '8px 10px',
  cursor: 'pointer',
  flex: 'none',
};

const ghostBtn: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 10,
  background: '#3a3a3e',
  color: '#fff',
  border: '3px solid #6e6e72',
  padding: '8px 10px',
  cursor: 'pointer',
  flex: 'none',
};
