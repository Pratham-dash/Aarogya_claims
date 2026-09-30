import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } } },
  build: {
    target: 'es2020',
    minify: 'esbuild', // JS minification
    cssMinify: true, // CSS minification
    cssCodeSplit: true, // per-route CSS chunks
    sourcemap: false,
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        // Long-lived vendor chunks cache independently of app code.
        manualChunks: { react: ['react', 'react-dom'], router: ['react-router-dom'] },
      },
    },
  },
});
