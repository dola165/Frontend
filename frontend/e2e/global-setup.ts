import { chromium, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

/**
 * Global setup: logs in once per role and persists a storage state so the
 * smoke tests reuse the sessions (the backend login endpoint is rate-limited —
 * one login per role per run). Tests self-skip when their credentials are unset.
 */
export default async function globalSetup() {
    mkdirSync('playwright/.auth', { recursive: true });

    const roles: Array<{ name: string; email?: string; password?: string }> = [
        { name: 'leader', email: process.env.E2E_LEADER_EMAIL, password: process.env.E2E_LEADER_PASSWORD },
        { name: 'player', email: process.env.E2E_PLAYER_EMAIL, password: process.env.E2E_PLAYER_PASSWORD },
        { name: 'admin', email: process.env.E2E_SYSTEM_ADMIN_EMAIL, password: process.env.E2E_SYSTEM_ADMIN_PASSWORD },
    ];

    for (const role of roles) {
        if (!role.email || !role.password) continue;

        const browser = await chromium.launch();
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto(`${BASE_URL}/login`);
        await page.getByPlaceholder('player@talanti.ge').fill(role.email);
        await page.locator('input[type="password"]').first().fill(role.password);
        await page.getByRole('button', { name: /enter database/i }).click();
        await page.waitForURL(/\/(feed|onboarding)/);
        await expect(page).not.toHaveURL(/\/login$/);

        await context.storageState({ path: `playwright/.auth/${role.name}.json` });
        await browser.close();
    }
}
