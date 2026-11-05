import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export default defineConfig({
    testDir: '.', testMatch: 'flow.spec.ts', workers: 1, reporter: 'list',
    outputDir: process.env.GK_FUNDRAISING_QA_DIR ?? join(tmpdir(), 'gk-fundraising-qa'),
    use: { baseURL: 'http://127.0.0.1:5198', browserName: 'chromium', channel: 'msedge' },
});
