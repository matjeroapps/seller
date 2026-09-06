import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Same-origin proxy for the Seller API in dev/E2E: avoids CORS entirely
    // and mirrors how production serves the dashboard behind one origin.
    proxy: {
      '/v1': {
        target: process.env.SELLER_API_PROXY_TARGET || 'http://127.0.0.1:18081',
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    clearMocks: true
  }
});
