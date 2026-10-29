import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname, 'demo'),
  base: './',
  build: {
    outDir: resolve(__dirname),
    emptyOutDir: false,
    assetsDir: 'assets',
  },
});
