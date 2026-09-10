import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Separate from vite.config.ts deliberately — that one loads the Cloudflare
// plugin (for the worker dev/build pipeline), which component tests don't
// need and would only slow down.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    // Runs afterEach(cleanup) for every test file — required because
    // @testing-library/react's own auto-cleanup only self-registers when it
    // finds a global `afterEach`, which `globals: false` deliberately doesn't
    // expose. See vitest.setup.ts.
    setupFiles: ['./vitest.setup.ts']
  }
});
