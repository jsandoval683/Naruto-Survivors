import { defineConfig } from 'vite';

// In development the game (Vite, :5173) talks to the API/co-op server (:8787) through this proxy.
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
});
