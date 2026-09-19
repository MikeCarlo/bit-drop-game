/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PLATFORM?: string;
  readonly VITE_ENABLE_MULTIPLAYER?: string;
  readonly VITE_ENABLE_LEADERBOARD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
