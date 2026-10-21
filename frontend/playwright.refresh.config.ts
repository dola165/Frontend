import { defineConfig } from '@playwright/test';

// Isolated browser contract tests: all API calls are intercepted; no demo accounts.
export default defineConfig({
    testDir: './e2e',
    testMatch: 'refresh-concurrency.spec.ts',
    use: { baseURL: 'http://127.0.0.1:5175', browserName: 'chromium' },
    webServer: {
        command: 'npm run dev -- --host 127.0.0.1 --port 5175 --strictPort',
        url: 'http://127.0.0.1:5175',
        env: { VITE_API_BASE_URL: '/api' },
        reuseExistingServer: false,
    },
});
