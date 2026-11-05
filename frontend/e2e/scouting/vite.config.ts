import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
    root: __dirname, envDir: path.join(__dirname, 'empty-env'), plugins: [react()],
    define: { __BUILD_ID__: JSON.stringify('synthetic-scouting') },
    resolve: { alias: [{ find: /^(?:\.\.\/)+context\/AuthContext$/, replacement: path.join(__dirname, 'auth.tsx') }] },
    server: { host: '127.0.0.1', port: 4588, strictPort: true, fs: { allow: [path.resolve(__dirname, '../..')] } },
});
