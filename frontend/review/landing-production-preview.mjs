import { preview } from 'vite';
await preview({ build: { outDir: 'dist/landing-redesign' }, preview: { host: '127.0.0.1', port: 5188, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:8080', changeOrigin: true, headers: { origin: 'https://app.grasskickz.com' } } } } });
console.log('Landing production check: http://127.0.0.1:5188');
