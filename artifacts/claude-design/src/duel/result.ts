import { botSkillLabel } from './pcMatch.ts';

/** Your rounds first, then the opponent. Seat 1 stores wins in the other order. */
export function yourSetScore(seat: 0 | 1, wins: readonly [number, number]): [number, number] {
  if (seat === 1) return [wins[1], wins[0]];
  return [wins[0], wins[1]];
}

/** Final set, your rounds first. Example: 3–1. */
export function formatSetScore(yours: number, theirs: number): string {
  return `${yours}–${theirs}`;
}

export function outcomeTitle(youWon: boolean): 'YOU WIN' | 'YOU LOSE' {
  return youWon ? 'YOU WIN' : 'YOU LOSE';
}

/** Human username, or BOT · SKILL N for a bot match. */
export function facedLabel(vsBot: boolean, opponent: string, skill: number): string {
  if (vsBot) return skill > 0 ? botSkillLabel(skill) : 'BOT';
  const name = opponent.trim();
  return name.length ? name : 'opponent';
}
