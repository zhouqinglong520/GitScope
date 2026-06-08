import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    exclude: [
      'node_modules/**',
      '**/*.e2e.ts',
      '**/__tests__/**',
    ],
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './renderer'),
      'shared': path.resolve(__dirname, './shared'),
    },
  },
});
