import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Absolute, NOT relative. With a relative base ("./assets/..."), any URL that
// loses its trailing slash — /Movie-Tracker-Recommandor?v=1 — resolves assets
// against the domain root instead of the project folder, and every script and
// stylesheet 404s into a blank page. An absolute base always resolves the same
// way regardless of trailing slash, query string or hash route.
// Change this if the repository is ever renamed or moved to a custom domain.
const BASE = '/Movie-Tracker-Recommandor/';

/**
 * A placeholder, not the id itself. `scripts/inline.mjs` stamps the real one
 * into the page and into sw.js in the same pass, so the two can never
 * disagree about which build is running — and the worker file's own bytes
 * change every build, which is what lets an open app notice a new one.
 */
const BUILD_ID = '__FLICK_BUILD__';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? BASE : '/',
  plugins: [react()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID), __BASE_PATH__: JSON.stringify(BASE) },
  server: { host: '127.0.0.1', port: 5173 },
}));
