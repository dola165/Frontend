import { expect, test } from '@playwright/test';

// W7a pin — reason: this is a Playwright E2E suite (needs the Playwright runner, playwright/.auth
// storage states, a live backend and seeded E2E_* credentials); Vitest's default include pattern
// (**.spec.ts) picks it up and fails at collection under the Vitest runner. Run it via
// `npm run qa:smoke` (npx playwright test e2e/smoke.spec.ts) instead.
if (process.env.VITEST) {
    describe.skip('e2e smoke — Playwright-only suite, pinned under Vitest (see comment above)', () => {});
} else {

const leaderEmail = process.env.E2E_LEADER_EMAIL;
const leaderPassword = process.env.E2E_LEADER_PASSWORD;
const adminEmail = process.env.E2E_SYSTEM_ADMIN_EMAIL;
const adminPassword = process.env.E2E_SYSTEM_ADMIN_PASSWORD;
const otherClubId = process.env.E2E_OTHER_CLUB_ID;
const playerEmail = process.env.E2E_PLAYER_EMAIL;
const playerPassword = process.env.E2E_PLAYER_PASSWORD;

test.describe('Talanti smoke flows — leader', () => {
    test.use({ storageState: 'playwright/.auth/leader.json' });

    test('leader can restore account and reach the main operating surfaces', async ({ page }) => {
        test.skip(!leaderEmail || !leaderPassword, 'Seeded leader credentials are required for this smoke flow.');

        await page.goto('/account?tab=security');
        await expect(page.getByRole('heading', { name: /account settings/i })).toBeVisible();
        await expect(page.getByText(/email verified|verification pending/i).first()).toBeVisible();

        await page.goto('/my-club');
        await page.waitForURL(/\/clubs\/\d+/);
        await expect(page.getByRole('button', { name: /manage club/i })).toBeVisible();

        await page.getByRole('button', { name: /manage club/i }).click();
        await expect(page.getByText(/open club workspace/i).first()).toBeVisible();
        await page.getByText(/open club workspace/i).first().click();
        await page.waitForURL(/\/workspace/);
        await expect(page.getByText(/overview/i).first()).toBeVisible();
    });

    test('leader can open the planner create flow', async ({ page }) => {
        test.skip(!leaderEmail || !leaderPassword, 'Seeded leader credentials are required for this smoke flow.');

        await page.goto('/calendar');
        await expect(page.getByRole('button', { name: /new event/i })).toBeVisible();
        await page.getByRole('button', { name: /new event/i }).click();
        await expect(page.getByRole('heading', { name: /what kind of event/i })).toBeVisible();
    });

    test('leader can open the challenge flow against another club', async ({ page }) => {
        test.skip(!leaderEmail || !leaderPassword || !otherClubId, 'Leader credentials and E2E_OTHER_CLUB_ID are required for challenge smoke coverage.');

        await page.goto(`/clubs/${otherClubId}`);
        await expect(page.getByRole('button', { name: /challenge/i })).toBeVisible();
        await page.getByRole('button', { name: /challenge/i }).click();
        await expect(page.getByRole('heading', { name: /issue challenge/i })).toBeVisible();
    });

    test('store catalog loads and quick-view offers a contact order CTA', async ({ page }) => {
        test.skip(!leaderEmail || !leaderPassword, 'Seeded leader credentials are required for this smoke flow.');

        await page.goto('/store');
        await expect(page.getByRole('heading', { name: /^store$/i })).toBeVisible();
        await expect(page.getByText('Matchday Ticket — U16 Derby').first()).toBeVisible();
        await page.getByText('Matchday Ticket — U16 Derby').first().click();
        await expect(page.getByRole('link', { name: /order via whatsapp/i })).toBeVisible();
    });

    test('organizer sees the full map category set', async ({ page }) => {
        test.skip(!leaderEmail || !leaderPassword, 'Seeded leader credentials are required for this smoke flow.');

        await page.goto('/map');
        await expect(page.getByRole('button', { name: /Matches Browse open match challenges/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Tournaments Explore tournaments and cups/i })).toBeVisible();
    });

    test('calendar opens past events read-only with a complete action', async ({ page }) => {
        test.skip(!leaderEmail || !leaderPassword, 'Seeded leader credentials are required for this smoke flow.');

        await page.goto('/calendar');
        await expect(page.getByRole('button', { name: /new event/i })).toBeVisible();

        const pastChip = page.locator('button', { hasText: 'Friendly vs Saburtalo U16' }).first();
        await expect(pastChip).toBeVisible({ timeout: 15000 });
        // Dispatch a DOM click directly — the timeline bars re-render continuously,
        // which makes Playwright's pointer-actionability checks time out.
        await pastChip.evaluate((el) => (el as HTMLButtonElement).click());
        // PastEventModal, not the event editor
        await expect(page.getByRole('heading', { name: 'Friendly vs Saburtalo U16' })).toBeVisible();
        await expect(page.getByText(/(completed|in the past)/i).first()).toBeVisible();
        await expect(page.getByRole('heading', { name: /edit event/i })).toHaveCount(0);
    });

    test('workspace exposes jobs and join-policy settings to owners', async ({ page }) => {
        test.skip(!leaderEmail || !leaderPassword, 'Seeded leader credentials are required for this smoke flow.');

        await page.goto('/my-club');
        await page.waitForURL(/\/clubs\/\d+/);
        const clubId = page.url().match(/\/clubs\/(\d+)/)?.[1];
        if (!clubId) throw new Error('Could not resolve club id from /my-club redirect.');

        await page.goto(`/clubs/${clubId}/workspace?tab=jobs`);
        await expect(page.getByText(/hiring/i).first()).toBeVisible();
        await page.getByRole('button', { name: /post job/i }).click();
        await expect(page.getByText(/new posting/i).first()).toBeVisible();

        await page.goto(`/clubs/${clubId}/workspace?tab=settings`);
        await expect(page.getByText(/open trial/i).first()).toBeVisible();
        await expect(page.getByText(/invite only/i).first()).toBeVisible();
    });

    test('workspace player-cards tab opens create and edit surfaces', async ({ page }) => {
        test.skip(!leaderEmail || !leaderPassword, 'Seeded leader credentials are required for this smoke flow.');

        await page.goto('/my-club');
        await page.waitForURL(/\/clubs\/\d+/);
        const clubId = page.url().match(/\/clubs\/(\d+)/)?.[1];
        if (!clubId) throw new Error('Could not resolve club id from /my-club redirect.');

        await page.goto(`/clubs/${clubId}/workspace?tab=player-cards`);
        // The tab renders either the card list (headers) or the empty state.
        await expect(page.getByText(/no player cards yet|full name/i).first()).toBeVisible({ timeout: 15000 });

        // The create modal opens with the create title.
        await page.getByRole('button', { name: /create card/i }).click();
        await expect(page.getByRole('heading', { name: /create player card/i })).toBeVisible();
        await page.getByRole('button', { name: /^cancel$/i }).click();
    });
});

test.describe('Talanti smoke flows — player', () => {
    test.use({ storageState: 'playwright/.auth/player.json' });

    test('player map is limited to clubs and tryouts', async ({ page }) => {
        test.skip(!playerEmail || !playerPassword, 'Seeded player credentials are required for this smoke flow.');

        await page.goto('/map');
        await expect(page.getByRole('button', { name: /Clubs Find football clubs near you/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Tryouts Discover open tryout sessions/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Matches Browse open match challenges/i })).toHaveCount(0);
        await expect(page.getByRole('button', { name: /Tournaments Explore tournaments and cups/i })).toHaveCount(0);
    });
});

test.describe('Talanti smoke flows — system admin', () => {
    test.use({ storageState: 'playwright/.auth/admin.json' });

    test('system admin can access the admin panel', async ({ page }) => {
        test.skip(!adminEmail || !adminPassword, 'Seeded system admin credentials are required for this smoke flow.');

        await page.goto('/admin');
        await expect(page.getByRole('heading', { name: /admin panel/i })).toBeVisible();
        await expect(page.getByPlaceholder(/search by name, username, or email/i)).toBeVisible();
    });
});

}
