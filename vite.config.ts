import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Absolute, NOT relative. With a relative base ("./assets/..."), any URL that
// loses its trailing slash — /Movie-Tracker-Recommandor?v=1 — resolves assets
// against the domain root instead of the project folder, and every script and
// stylesheet 404s into a blank page. An absolute base always resolves the same
// way regardless of trailing slash, query string or hash route.
// Change this if the repository is ever renamed or moved to a custom domain.
const BASE = '/Movie-Tracker-Recommandor/';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? BASE : '/',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173 },
}));
