import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'renderer',
  base: './',
  build: {
    outDir: '../dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'renderer/index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'renderer'),
      '@shared': resolve(__dirname, 'shared'),
    },
  },
  server: {
    port: 5173,
  },
});

// 允许 CSS 导入
