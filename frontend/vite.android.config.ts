import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';

// A separate, reproducible artifact. Never consumes a live website deployment.
export default mergeConfig(base, defineConfig({
    envDir: false,
    define: {
        'import.meta.env.VITE_ANDROID_APP': JSON.stringify('true'),
        'import.meta.env.VITE_ENABLE_MOCKS': JSON.stringify('false'),
        'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api'),
        'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(''),
    },
    build: { outDir: 'dist-android', sourcemap: false },
}));
