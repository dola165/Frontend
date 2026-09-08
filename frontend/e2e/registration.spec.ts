import { expect, test } from '@playwright/test';

if (process.env.VITEST) {
    describe.skip('registration flow — Playwright only', () => {});
} else {
    const beginAnonymousSession = async (page: import('@playwright/test').Page) => {
        await page.goto('/clubs');
        await page.evaluate(async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            localStorage.clear();
            sessionStorage.clear();
        });
    };

    test.describe('registration and first-use flow', () => {
        test('email registration uses two short steps and preserves the destination', async ({ page }) => {
            await beginAnonymousSession(page);
            await page.goto('/signup?next=%2Ftournaments');

            await expect(page.getByText('Step 1 of 2')).toBeVisible();
            await page.getByLabel('Full Name').fill('Investor Demo User');
            await page.getByLabel('Email Address').fill(`investor-${Date.now()}@example.com`);
            await page.getByLabel('Password', { exact: true }).fill('Strongpass1');
            await page.getByLabel('Confirm Password').fill('Strongpass1');
            await page.getByRole('button', { name: 'Continue', exact: true }).click();

            await expect(page.getByText('Step 2 of 2')).toBeVisible();
            await page.getByRole('button', { name: /Organizer/ }).click();
            await page.getByLabel('Date of Birth').fill('1995-06-12');
            await page.getByRole('button', { name: 'Create Account' }).click();

            await expect(page).toHaveURL(/\/tournaments$/);
            await expect(page.getByRole('heading', { name: /Find your next competition/i })).toBeVisible();
            await expect.poll(() => page.evaluate(() => sessionStorage.getItem('grasskickz.auth-flow.v1'))).toBeNull();
        });

        test('verification waiting state survives refresh and offers a clear continuation', async ({ page }) => {
            await beginAnonymousSession(page);
            await page.goto('/signup');
            await page.evaluate(() => sessionStorage.setItem('grasskickz.auth-flow.v1', JSON.stringify({
                email: 'waiting@example.com',
                nextPath: '/clubs',
                newAccount: true,
                awaitingVerification: true,
            })));
            await page.goto('/verify-email?pending=1');

            await expect(page.getByText('Check your inbox')).toBeVisible();
            await expect(page.getByLabel('Registration email')).toHaveValue('waiting@example.com');
            await expect(page.getByRole('link', { name: /verified my email/i })).toHaveAttribute('href', '/login?next=%2Fclubs');
            await page.reload();
            await expect(page.getByText('Check your inbox')).toBeVisible();
            await expect(page.getByLabel('Registration email')).toHaveValue('waiting@example.com');
        });

        test('sensitive consent token stays out of login and signup URLs', async ({ page }) => {
            await beginAnonymousSession(page);
            await page.goto('/consent?token=investor-secret-token');
            const signup = page.getByRole('link', { name: /create/i });
            const login = page.getByRole('link', { name: 'I already have an account' });

            await expect(signup).toHaveAttribute('href', '/signup');
            await expect(login).toHaveAttribute('href', '/login');
            const stored = await page.evaluate(() => sessionStorage.getItem('grasskickz.auth-flow.v1'));
            expect(stored).toContain('/consent?token=investor-secret-token');
        });

        test('first-use setup asks only for essentials and stays put on invalid submission', async ({ page }) => {
            await beginAnonymousSession(page);
            await page.goto('/login');
            await page.getByLabel('Email Address').fill('fan@test.dev');
            await page.getByLabel('Password').fill('mock');
            await page.getByRole('button', { name: 'Enter Database' }).click();

            await expect(page.getByRole('heading', { name: /Establish Your Identity/i })).toBeVisible();
            await expect(page.getByRole('button', { name: /Agent/i })).toHaveCount(0);
            await expect(page.getByLabel('Date of Birth')).toBeDisabled();
            await page.getByLabel('Full Legal Name').fill('');
            await page.getByRole('button', { name: /Enter GrassKickZ/i }).click();
            await expect(page).toHaveURL(/\/onboarding$/);
            await expect(page.getByText(/Name must be at least 2 characters/i)).toBeVisible();

            await page.getByLabel('Full Legal Name').fill('Emma Thompson');
            await page.getByRole('button', { name: /Enter GrassKickZ/i }).click();
            await expect(page).toHaveURL(/\/home$/);
        });
    });
}
