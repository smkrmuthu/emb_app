import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// @testing-library/react's own auto-cleanup only registers itself when it
// finds a GLOBAL `afterEach` — vitest.config.ts deliberately sets
// `globals: false` (explicit imports over ambient test globals), so without
// this it silently never fires: a component rendered in one test stays
// mounted in document.body for every test after it in the same file, and
// `screen` queries (which search document.body) start matching stale
// elements from a previous test's leftover DOM.
afterEach(() => cleanup());
