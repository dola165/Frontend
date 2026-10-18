import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';

// Real Spring API only. No sandbox server, personas or in-memory fallback.
Object.assign(process.env, {
  VITE_API_BASE_URL: '/api',
  VITE_GOOGLE_CLIENT_ID: '',
  VITE_PAYMENT_PREVIEW: 'false',
});

const api = 'http://127.0.0.1:8088';

export default mergeConfig(base, defineConfig({
  cacheDir: '../../run/vite-cache',
  server: {
    host: '127.0.0.1',
    port: 5300,
    strictPort: true,
    allowedHosts: ['real.localhost'],
    proxy: {
      '/api': { target: api },
      '/uploads': { target: api },
      '/media': { target: api },
      '/ws-chat': { target: api, ws: true },
    },
  },
}));
