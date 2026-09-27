import { FLAGS } from './flags';

/** Solo puzzle, or a Reddit 1v1 duel (`compete`). */
export type PlayMode = 'solo' | 'compete';

/** Reddit build with multiplayer on. Web keeps the text-link duel on the live site. */
export function redditDuelEnabled(): boolean {
  return FLAGS.platform === 'reddit' && FLAGS.enableMultiplayer;
}

/**
 * Web: flag surfaces the disabled compete stub.
 * Reddit: flag surfaces the 1v1 duel lobby (Devvit server, no SMS).
 */
export function canOpenCompeteLobby(): boolean {
  return FLAGS.enableMultiplayer;
}

export interface CompeteSession {
  id: string;
  seats: 2 | 3 | 4;
  players: string[];
}

/**
 * 3–4 player seats are not a mode. Reddit 1v1 is the duel lobby, not this call.
 * Returns null so older hook callers cannot start a phantom room.
 */
export async function startCompete(_seats: 2 | 3 | 4): Promise<CompeteSession | null> {
  return null;
}

/** `compete` only while a Reddit duel is actually requested and enabled. */
export function resolvePlayMode(requested: PlayMode): PlayMode {
  if (requested === 'compete' && redditDuelEnabled()) return 'compete';
  return 'solo';
}
