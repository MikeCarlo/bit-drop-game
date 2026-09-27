import type { DuelPhase, DuelSettings, MatchView } from './types';

/** Local opponent. Wins against this name are not written to the monthly board. */
export const PC_NAME = 'PC';
export const PC_MATCH_ID = 'pc-local';
export const PC_YOU = 'You';

/** How long P1 waits in the challenge room before we nudge Play vs PC. */
export const PC_WAIT_MS = 45_000;

export const PC_WINS_TO_TAKE = 3;

export function pcWaitNudge(waitedMs: number): boolean {
  return waitedMs >= PC_WAIT_MS;
}

export function settlePcRound(
  wins: readonly [number, number],
  playerWon: boolean,
): {
  wins: [number, number];
  phase: 'between' | 'complete';
  winner: string | null;
  roundWinner: string;
} {
  const next: [number, number] = [wins[0], wins[1]];
  if (playerWon) next[0] += 1;
  else next[1] += 1;
  const youWonMatch = next[0] >= PC_WINS_TO_TAKE;
  const pcWonMatch = next[1] >= PC_WINS_TO_TAKE;
  return {
    wins: next,
    phase: youWonMatch || pcWonMatch ? 'complete' : 'between',
    winner: youWonMatch ? PC_YOU : pcWonMatch ? PC_NAME : null,
    roundWinner: playerWon ? PC_YOU : PC_NAME,
  };
}

export function buildPcView(args: {
  settings: DuelSettings;
  wins: readonly [number, number];
  round: number;
  phase: DuelPhase;
  roundWinner: string | null;
  winner: string | null;
}): MatchView {
  return {
    id: PC_MATCH_ID,
    you: PC_YOU,
    opponent: PC_NAME,
    seat: 0,
    p1: PC_YOU,
    p2: PC_NAME,
    width: args.settings.width,
    viruses: args.settings.viruses,
    speed: args.settings.speed,
    round: args.round,
    wins: [args.wins[0], args.wins[1]],
    phase: args.phase,
    winner: args.winner,
    roundWinner: args.roundWinner,
    youReady: false,
    opponentReady: true,
    garbage: [],
    attackIds: [],
    attacks: [],
    postId: '',
  };
}

export function isPcMatch(match: { id?: string } | null | undefined): boolean {
  return match?.id === PC_MATCH_ID;
}
