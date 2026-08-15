import { defineConfig } from '@playwright/test';

const browserName = (process.env.PLAYWRIGHT_BROWSER as 'chromium' | 'firefox' | 'webkit' | undefined) ?? 'chromium';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

export default defineConfig({
    testDir: './e2e',
    globalSetup: './e2e/global-setup.ts',
    fullyParallel: false,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
    use: {
        baseURL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure'
    },
    projects: [
        {
            name: browserName,
            use: {
                browserName,
                viewport: { width: 1440, height: 960 }
            }
        }
    ]
});
