import { defineConfig } from 'vite';

// base: './' makes the build work from any folder or sub-path
// (Netlify, Vercel, GitHub Pages, S3, etc.)
export default defineConfig({
  base: './',
  server: { port: 5173 },
  build: { chunkSizeWarningLimit: 1200 },
});
