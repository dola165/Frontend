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
        // Half the machine's threads. One worker per thread starves jsdom's style work, and timing-sensitive tests then
        // fail at random (seen on the mini's release pipeline at 15 workers). The full suite passes at 4 and 6 workers.
        maxWorkers: '50%',
    },
});
