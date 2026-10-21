import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  server: { host: '127.0.0.1', port: 5198, strictPort: true, open: false },
  build: { outDir: 'dist-map-workspace-demo', rollupOptions: { input: resolve(import.meta.dirname, 'map-workspace-demo.html') } },
});
