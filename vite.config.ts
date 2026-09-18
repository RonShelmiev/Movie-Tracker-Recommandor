import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative, so the same build works at a domain root or under /repo-name/
  // on GitHub Pages without a rebuild.
  base: './',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173 },
});
