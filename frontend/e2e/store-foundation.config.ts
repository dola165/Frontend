import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
    testDir: '.', testMatch: 'store-foundation.pw.ts', workers: 2, retries: 0,
    outputDir: join(tmpdir(), 'gk-store-foundation-browser'), reporter: 'list',
    use: { baseURL: `http://127.0.0.1:${process.env.STORE_TEST_PORT ?? '5187'}`, browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL },
});
