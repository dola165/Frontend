import { defineConfig, mergeConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import base from './vite.config';

// Explicit local QA only; production builds never load this configuration.
export default mergeConfig(base, defineConfig({
  resolve: { alias: [{ find: /^(?:\.\.\/)+context\/AuthContext$/, replacement: fileURLToPath(new URL('./e2e/fixtures/match-history-auth.tsx', import.meta.url)) }] },
  server: { port: 5177, strictPort: true, host: '127.0.0.1' },
}));
