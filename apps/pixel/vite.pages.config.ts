import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'cloudflare',
  publicDir: '../public',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(process.cwd()),
    },
  },
  build: {
    emptyOutDir: true,
    outDir: '../dist/pages',
  },
});
