import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Libraries the first screen needs and that change far less often than the app. A file of their own stays
// cached across releases, so phones download only the app's own code again. Keep this to libraries the
// entry imports whole (not lucide-react or react-i18next, whose page-only parts would come along), or the first load grows.
const CORE_LIBRARIES = /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|axios|i18next|i18next-browser-languagedetector|sonner|use-sync-external-store|@react-oauth[\\/]google)[\\/]|commonjsHelpers/

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    manifest: true,
    rollupOptions: { output: { manualChunks: id => (CORE_LIBRARIES.test(id) ? 'vendor' : undefined) } },
  },
  resolve: {
    preserveSymlinks: true,
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: 'localhost',
    port: 5173,
      allowedHosts: ['app.grasskickz.com', 'grasskickz.com'],
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
