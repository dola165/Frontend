import { chromium, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const MOCK_MODE = process.env.E2E_MOCKS === 'true';

const mockPersonas: Record<string, { id: number; role: string }> = {
    'player@test.dev': { id: 1, role: 'PLAYER' },
    'organizer@test.dev': { id: 2, role: 'ORGANIZER' },
    'coach@test.dev': { id: 3, role: 'COACH' },
    'fan@test.dev': { id: 4, role: 'FAN' },
    'admin@test.dev': { id: 5, role: 'SYSTEM_ADMIN' }
};

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

        if (MOCK_MODE) {
            const persona = mockPersonas[role.email.toLowerCase()];
            if (!persona) {
                throw new Error(`No mock E2E persona is registered for ${role.email}.`);
            }

            await page.goto(`${BASE_URL}/clubs`);
            await page.getByRole('heading', { name: /club directory/i }).waitFor({ state: 'visible', timeout: 15000 });
            const tokenPayload = Buffer.from(JSON.stringify({
                sub: persona.id,
                role: persona.role,
                iat: Date.now()
            })).toString('base64');
            const accessToken = `mock-jwt.${tokenPayload}.mock-sig`;
            await page.evaluate(({ token, userId }) => {
                localStorage.setItem('accessToken', token);
                localStorage.setItem('userId', String(userId));
            }, { token: accessToken, userId: persona.id });
        } else {
            await page.goto(`${BASE_URL}/login`);
            const emailInput = page.locator('input[type="email"]');
            await emailInput.waitFor({ state: 'visible', timeout: 15000 });
            await emailInput.fill(role.email);
            await page.locator('input[type="password"]').fill(role.password);
            await page.locator('button[type="submit"]').click();
            await page.waitForURL(/\/(feed|onboarding)/);
            await expect(page).not.toHaveURL(/\/login$/);
        }

        await context.storageState({ path: `playwright/.auth/${role.name}.json` });
        await browser.close();
    }
}
