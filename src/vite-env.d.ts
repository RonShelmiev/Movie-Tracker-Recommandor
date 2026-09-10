/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional build-time TMDB key. A key entered in Settings overrides it. */
  readonly VITE_TMDB_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
