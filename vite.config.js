import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: 'public',
  publicDir: 'public',
  server: {
    host: true,
    port: 5173,
    fs: {
      allow: ['..']
    }
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'public/index.html')
    }
  },
  resolve: {
    alias: {
      '/src': path.resolve(__dirname, 'src')
    }
  }
});
