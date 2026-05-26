import { expect, test, type Page } from '@playwright/test';

const leaderEmail = process.env.E2E_LEADER_EMAIL;
const leaderPassword = process.env.E2E_LEADER_PASSWORD;
const adminEmail = process.env.E2E_SYSTEM_ADMIN_EMAIL;
const adminPassword = process.env.E2E_SYSTEM_ADMIN_PASSWORD;
const otherClubId = process.env.E2E_OTHER_CLUB_ID;

const loginAs = async (page: Page, email: string, password: string) => {
    await page.goto('/login');
    await page.getByPlaceholder('player@talanti.ge').fill(email);
    await page.locator('input[type="password"]').first().fill(password);
    await page.getByRole('button', { name: /enter database/i }).click();
};

test.describe('Talanti smoke flows', () => {
    test('leader can restore account and reach the main operating surfaces', async ({ page }) => {
        test.skip(!leaderEmail || !leaderPassword, 'Seeded leader credentials are required for this smoke flow.');

        await loginAs(page, leaderEmail, leaderPassword);
        await page.waitForURL(/\/(feed|onboarding)/);
        await expect(page).not.toHaveURL(/\/login$/);

        await page.goto('/account?tab=security');
        await expect(page.getByRole('heading', { name: /account center/i })).toBeVisible();
        await expect(page.getByText(/email verified|verification pending/i).first()).toBeVisible();

        await page.goto('/my-club');
        await page.waitForURL(/\/clubs\/\d+/);
        await expect(page.getByRole('button', { name: /manage club/i })).toBeVisible();

        await page.getByRole('button', { name: /manage club/i }).click();
        await expect(page.getByText(/club operations/i).first()).toBeVisible();
        await expect(page.getByRole('button', { name: /invites/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /applications/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /tryouts/i })).toBeVisible();
    });

    test('leader can open the planner create flow', async ({ page }) => {
        test.skip(!leaderEmail || !leaderPassword, 'Seeded leader credentials are required for this smoke flow.');

        await loginAs(page, leaderEmail, leaderPassword);
        await page.goto('/calendar');
        await expect(page.getByRole('heading', { name: /club planner/i })).toBeVisible();
        await page.getByRole('button', { name: /add event/i }).click();
        await expect(page.getByRole('heading', { name: /log new event/i })).toBeVisible();
    });

    test('leader can open the challenge flow against another club', async ({ page }) => {
        test.skip(!leaderEmail || !leaderPassword || !otherClubId, 'Leader credentials and E2E_OTHER_CLUB_ID are required for challenge smoke coverage.');

        await loginAs(page, leaderEmail, leaderPassword);
        await page.goto(`/clubs/${otherClubId}`);
        await expect(page.getByRole('button', { name: /challenge/i })).toBeVisible();
        await page.getByRole('button', { name: /challenge/i }).click();
        await expect(page.getByRole('heading', { name: /issue challenge/i })).toBeVisible();
    });

    test('system admin can access the admin panel', async ({ page }) => {
        test.skip(!adminEmail || !adminPassword, 'Seeded system admin credentials are required for this smoke flow.');

        await loginAs(page, adminEmail, adminPassword);
        await page.goto('/admin');
        await expect(page.getByRole('heading', { name: /admin panel/i })).toBeVisible();
        await expect(page.getByPlaceholder(/search by name, username, or email/i)).toBeVisible();
    });
});
