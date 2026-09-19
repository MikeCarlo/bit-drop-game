import { FLAGS } from './flags';

/** Phase 1 is solo. `compete` is reserved for Phase 2 (up to 4 players). */
export type PlayMode = 'solo' | 'compete';

/**
 * Phase 2 hook: open a compete lobby (2–4 seats) when the flag is on.
 * Phase 1 never starts a match — see `startCompete`.
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
 * Phase 2 plug-in: replace this no-op with Devvit realtime / post-thread
 * matchmaking. Safe to call anytime — returns null until that lands.
 */
export async function startCompete(_seats: 2 | 3 | 4): Promise<CompeteSession | null> {
  return null;
}

/** Force solo while compete is unimplemented (even if the flag is on). */
export function resolvePlayMode(_requested: PlayMode): PlayMode {
  return 'solo';
}
