import { mergeConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import base from '../../vite.config';
export default mergeConfig(base, {
    optimizeDeps: { entries: ['e2e/publishing/index.html'] },
    resolve: { alias: [
        { find: /.*context\/AuthContext$/, replacement: fileURLToPath(new URL('./auth.tsx', import.meta.url)) },
        { find: /.*(?:WelcomeHost|WaitingOnYou|HomeHelperDetails)$/, replacement: fileURLToPath(new URL('./ancillary.tsx', import.meta.url)) },
    ] },
    server: { host: '127.0.0.1', port: 5207, strictPort: true },
});
