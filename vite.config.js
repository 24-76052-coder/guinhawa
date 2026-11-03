import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The React app is built into dist/ and served by Apache from
// C:\xampp2\htdocs\guinhawa. Vite only builds the front end: the API is PHP
// under `backend/api`, proxied to the local XAMPP Apache during development.
//
// Two deployment targets need two different base paths:
//   - Local XAMPP: http://localhost/guinhawa/  -> base '/guinhawa/'
//   - Vercel:      https://guinhawa.vercel.app/ -> base '/'
// `npm run build` keeps the XAMPP path; `npm run build:vercel` (used by
// vercel.json) and Vercel's own build environment use the domain root.
// VITE_BASE_PATH still overrides both when set explicitly.
const XAMPP_BASE = '/guinhawa/';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const isVercel = Boolean(process.env.VERCEL) || mode === 'vercel';
  const base = env.VITE_BASE_PATH || (isVercel ? '/' : XAMPP_BASE);

  return {
    root: 'app',
    base,
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
        // Used when the dev server runs with a root base (VITE_BASE_PATH=/).
        '/api': {
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
  };
});
