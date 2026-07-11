import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@chikumiku/validation': path.resolve(__dirname, '../../shared/validation/src/index.ts'),
      '@chikumiku/types': path.resolve(__dirname, '../../shared/types/src/index.ts'),
    },
  },
  optimizeDeps: {
    include: ['@chikumiku/validation'],
  },
  build: {
    commonjsOptions: {
      include: [/shared\/validation/, /node_modules/],
      transformMixedEsModules: true,
    },
  },
  server: {
    port: 3000,
  },
});
