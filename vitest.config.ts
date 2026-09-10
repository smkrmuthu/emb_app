import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Separate from vite.config.ts deliberately — that one loads the Cloudflare
// plugin (for the worker dev/build pipeline), which component tests don't
// need and would only slow down.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false
  }
});
