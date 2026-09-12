import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        css: true,
    },
});
