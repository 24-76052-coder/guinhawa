import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The React app is built into dist/ and served by Apache from
// C:\xampp2\htdocs\guinhawa. Vite only builds the front end: the API is PHP
// under `backend/api`, proxied to the local XAMPP Apache during development.
export default defineConfig({
  root: 'app',
  base: '/guinhawa/',
  plugins: [react()],
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  server: {
    port: 5173,
    fs: {
      allow: [fileURLToPath(new URL('.', import.meta.url))],
    },
    // `npm run dev` forwards API calls to XAMPP Apache + PHP.
    proxy: {
      '/guinhawa/api': {
        target: 'http://localhost',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5001,
  },
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
  },
});
