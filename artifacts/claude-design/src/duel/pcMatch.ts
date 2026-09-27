import type { DuelPhase, DuelSettings, MatchView } from './types';

/** Local opponent. A match win is recorded on the monthly bot board, not the human board. */
export const PC_NAME = 'PC';
export const PC_MATCH_ID = 'pc-local';
export const PC_YOU = 'You';

/** Same shape the server accepts in `isBotCreditId`. */
export function newBotMatchId(): string {
  const id = globalThis.crypto?.randomUUID?.() ?? '00000000-0000-4000-8000-000000000000';
  return `bot-${id}`;
}

export function isBotCreditId(id: string): boolean {
  return /^bot-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/** Uniform 1 (easy) through 10 (hard). One roll per bot match. `rand` is in [0, 1]. */
export function rollBotSkill(rand: () => number = Math.random): number {
  const n = 1 + Math.floor(rand() * 10);
  return Math.max(1, Math.min(10, n));
}

export function botSkillLabel(skill: number): string {
  const n = Math.max(1, Math.min(10, Math.round(skill)));
  return `BOT · SKILL ${n}`;
}

/** How long P1 waits in the challenge room before we nudge Play vs PC. */
export const PC_WAIT_MS = 45_000;

export const PC_WINS_TO_TAKE = 3;

export function pcWaitNudge(waitedMs: number): boolean {
  return waitedMs >= PC_WAIT_MS;
}

/** Elapsed lobby wait, `m:ss`. */
export function formatWait(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
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
  id?: string;
}): MatchView {
  return {
    id: args.id && isBotCreditId(args.id) ? args.id : PC_MATCH_ID,
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
  return !!match && (match.id === PC_MATCH_ID || isBotCreditId(match.id ?? ''));
}
