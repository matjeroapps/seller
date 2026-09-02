import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Test configuration for the storefront.
 *
 * The tests exercise this application's own modules — the API client, tenant
 * resolution, the theme registry, the view models and the theme components — against
 * fixtures of the public storefront contract. They do not start a Next.js server and
 * do not reach the network.
 *
 * JSX is transformed by Vite's built-in esbuild pass using the automatic runtime from
 * `tsconfig.json`. No React plugin is installed: its only additional feature is Fast
 * Refresh, which a test run has no use for, and the version that would be required
 * pulls in a second major version of Vite alongside the one Vitest already uses.
 *
 * `server-only` is aliased to a local no-op so a server module can be imported by a
 * test; the package itself throws on import by design. Enabling the `react-server`
 * condition instead would put React into server-component mode and make DOM rendering
 * impossible, so the alias is scoped to that one marker package. The guard is unaffected
 * in a real build, where this alias does not exist.
 */
export default defineConfig({
  esbuild: {
    jsx: 'automatic'
  },
  resolve: {
    alias: [
      {
        find: /^server-only$/,
        replacement: fileURLToPath(new URL('./tests/support/server-only-stub.ts', import.meta.url))
      }
    ]
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    clearMocks: true
  }
});
