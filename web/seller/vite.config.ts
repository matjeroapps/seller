import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [path.resolve(__dirname, '../..')]
    },
    proxy: {
      '/v1': {
        target: process.env.SELLER_API_PROXY_TARGET || 'http://127.0.0.1:18081',
        changeOrigin: false,
      },
    },
  },
  resolve: {
    alias: [
      { find: 'react/jsx-dev-runtime', replacement: path.resolve(__dirname, '../../node_modules/react/jsx-dev-runtime.js') },
      { find: 'react/jsx-runtime', replacement: path.resolve(__dirname, '../../node_modules/react/jsx-runtime.js') },
      { find: /^react$/, replacement: path.resolve(__dirname, '../../node_modules/react') },
      { find: /^react-dom$/, replacement: path.resolve(__dirname, '../../node_modules/react-dom') },
      { find: '@matjerhub/ui/styles.css', replacement: path.resolve(__dirname, '../../packages/ui/src/styles/tokens.css') },
      { find: '@matjerhub/ui', replacement: path.resolve(__dirname, '../../packages/ui/src/index.ts') }
    ]
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
