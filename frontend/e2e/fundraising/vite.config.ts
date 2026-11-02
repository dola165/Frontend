import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
    root: fileURLToPath(new URL('../..', import.meta.url)),
    plugins: [react()],
    optimizeDeps: { entries: ['e2e/fundraising/index.html'] },
    resolve: { alias: [{ find: /.*context\/AuthContext$/, replacement: fileURLToPath(new URL('./auth.tsx', import.meta.url)) }] },
    server: { host: '127.0.0.1', port: 5198, strictPort: true },
});
