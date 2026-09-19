/** Build / platform feature flags for Bit Drop. */

export type Platform = 'web' | 'reddit';

export interface FeatureFlags {
  /** Host surface. `web` is the Replit/Vite default; `reddit` is the Devvit target. */
  platform: Platform;
  /**
   * Phase 2 hook. When false (Phase 1 default) the game is solo-only and any
   * compete UI is hidden. Flip to true to surface the compete stub; it does
   * not start a real 4-player match yet.
   */
  enableMultiplayer: boolean;
  /** Personal / platform high-score board. */
  enableLeaderboard: boolean;
}

function readEnv(name: string): string | undefined {
  const viteKey = `VITE_${name}`;
  const env = import.meta.env as ImportMetaEnv & Record<string, string | undefined>;
  const raw = env[viteKey] ?? env[name];
  return typeof raw === 'string' ? raw : undefined;
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null || raw.trim() === '') return fallback;
  const v = raw.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return fallback;
}

function parsePlatform(raw: string | undefined): Platform {
  return raw?.trim().toLowerCase() === 'reddit' ? 'reddit' : 'web';
}

export const FLAGS: FeatureFlags = {
  platform: parsePlatform(readEnv('PLATFORM')),
  enableMultiplayer: parseBool(readEnv('ENABLE_MULTIPLAYER'), false),
  enableLeaderboard: parseBool(readEnv('ENABLE_LEADERBOARD'), true),
};

export function playModeLabel(): string {
  return FLAGS.enableMultiplayer ? 'compete-ready' : 'solo';
}
