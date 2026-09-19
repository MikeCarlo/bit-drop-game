import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const FLAG_KEYS = ['PLATFORM', 'ENABLE_MULTIPLAYER', 'ENABLE_LEADERBOARD'] as const;

/** Accept both `PLATFORM` and `VITE_PLATFORM` (same for ENABLE_*). */
function hoistFlags(env: Record<string, string>) {
  for (const key of FLAG_KEYS) {
    const viteKey = `VITE_${key}`;
    if (process.env[viteKey] != null) continue;
    const raw = process.env[key] ?? env[key] ?? env[viteKey];
    if (raw != null) process.env[viteKey] = raw;
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '');
  hoistFlags(env);

  const port = Number(process.env.PORT || '24722');
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
  }

  return {
    base: process.env.BASE_PATH || '/',
    plugins: [react()],
    root: import.meta.dirname,
    server: { port, strictPort: true, host: '0.0.0.0', allowedHosts: true },
    preview: { port, host: '0.0.0.0', allowedHosts: true },
    build: { outDir: 'dist/public', emptyOutDir: true },
  };
});
