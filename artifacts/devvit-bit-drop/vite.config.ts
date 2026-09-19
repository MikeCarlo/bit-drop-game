import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { devvit } from '@devvit/start/vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const bitdropSrc = path.resolve(here, '../claude-design/src');

const FLAG_KEYS = ['PLATFORM', 'ENABLE_MULTIPLAYER', 'ENABLE_LEADERBOARD'] as const;

/** Reddit playtest defaults. Bare names hoist into VITE_* like the web app. */
function hoistRedditFlags(env: Record<string, string>) {
  const defaults: Record<(typeof FLAG_KEYS)[number], string> = {
    PLATFORM: 'reddit',
    ENABLE_MULTIPLAYER: 'false',
    ENABLE_LEADERBOARD: 'true',
  };
  for (const key of FLAG_KEYS) {
    const viteKey = `VITE_${key}`;
    if (process.env[viteKey] != null) continue;
    const raw = process.env[key] ?? env[key] ?? env[viteKey] ?? defaults[key];
    process.env[viteKey] = raw;
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, here, '');
  hoistRedditFlags(env);

  return {
    resolve: {
      alias: {
        '@bitdrop': bitdropSrc,
      },
    },
    plugins: [
      react(),
      // Devvit plugin last — official Vite plugin requirement
      devvit({
        client: {
          define: {
            'import.meta.env.VITE_PLATFORM': JSON.stringify(process.env.VITE_PLATFORM ?? 'reddit'),
            'import.meta.env.VITE_ENABLE_MULTIPLAYER': JSON.stringify(
              process.env.VITE_ENABLE_MULTIPLAYER ?? 'false',
            ),
            'import.meta.env.VITE_ENABLE_LEADERBOARD': JSON.stringify(
              process.env.VITE_ENABLE_LEADERBOARD ?? 'true',
            ),
          },
        },
      }),
    ],
  };
});
