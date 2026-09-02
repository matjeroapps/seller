import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

/**
 * Testing Library registers its own cleanup only when Vitest globals are enabled. Globals
 * are off here — every test imports what it uses — so cleanup is registered explicitly.
 * Without it, renders accumulate in one document and a query that should match once
 * matches every earlier test's output as well.
 */
afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('lang');
  document.documentElement.removeAttribute('dir');
});
