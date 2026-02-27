import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        popup: '/src/popup/index.html',
        background: '/src/background.ts',
        content: '/src/content.ts'
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash][extname]'
      }
    },
    outDir: 'dist'
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
