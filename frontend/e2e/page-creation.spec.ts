import { expect, test, type Page } from '@playwright/test';

/**
 * Creating a club end to end on the sandbox (start both: `node sandbox/server.mjs 4306` and `node sandbox/web.mjs 4306 5179`,
 * then `PLAYWRIGHT_BASE_URL=http://localhost:5179 npx playwright test e2e/page-creation.spec.ts`).
 * 1. register a new adult; 2. create a club from Home with a crest from colours, a ground from the map, two age groups
 * and a fee range; 3. go live; 4. see the club in World, in search and under the My Club tab; 5. claim a pre-created
 * club as a second new user. Run at desktop and phone widths.
 */
/** Each run and each width registers its own people and club: the sandbox keeps them until it restarts. */
const stamp = Date.now().toString(36);

async function register(page: Page, name: string, email: string) {
  // The sandbox signs a visitor in as coach Luka unless the page says it is signed out.
  await page.goto('/signup?signedout=1');
  await page.getByRole('textbox', { name: 'Your name' }).fill(name);
  await page.getByRole('textbox', { name: 'Email or phone' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('Football123');
  await page.getByLabel('Date of birth').fill('1985-05-02');
  await page.getByLabel('Your town').selectOption({ label: 'Rustavi' });
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/\/(start|home)/);
  // The first run's four screens: Skip through them (Skip on the town screen still keeps the town given at sign-up).
  if (/\/start/.test(page.url())) {
    await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible();
    for (let i = 0; i < 5 && /\/start/.test(page.url()); i++) {
      await page.getByRole('button', { name: 'Skip' }).click();
      await page.waitForTimeout(300);
    }
  }
  await page.goto('/home');
  await expect(page).toHaveURL(/\/home/);
}

async function openRing(page: Page, words: RegExp) {
  await page.getByRole('button', { name: words }).click();
}

const flow = (width: number, height: number) => {
  test.describe(`${width}×${height}`, () => {
    test.use({ viewport: { width, height } });
    test.setTimeout(120_000);

    test('a newcomer creates a club in a minute, goes live, is found, and a second newcomer claims a known club', async ({ page }) => {
      const run = `${stamp}${width}`;
      const clubName = `Rustavi Lions ${run}`;
      await register(page, 'Giorgi Beridze', `giorgi.${run}@example.org`);

      // 2. From Home: the card for someone with no page of their own, then the sheet. The clock starts at "I want a club".
      const started = Date.now();
      let taps = 0;
      const tap = async (locator: ReturnType<Page['getByRole']>) => { taps++; await locator.click(); };
      // On a desktop Home's left rail has the card; on a phone the rail is folded away and the My Club tab opens the two tiles.
      if (width < 768) {
        await tap(page.getByRole('link', { name: 'My Club' }).first());
        await tap(page.getByRole('link', { name: /Start your club/ }).first());
      } else {
        await tap(page.getByRole('link', { name: /Start your club or page/ }).first());
      }
      await expect(page.getByRole('dialog')).toBeVisible();
      await tap(page.getByRole('radio', { name: /^Club/ }));
      // The town is already filled in: where the person registered.
      await expect(page.getByRole('button', { name: 'Change town' })).toHaveText(/Rustavi/);
      await page.getByLabel('Club name').fill(clubName);
      await tap(page.getByRole('button', { name: 'Create club' }));
      await expect(page).toHaveURL(/\/clubs\/\d+\?edit=1&new=1/);
      await expect(page.getByText('Draft · only you see this')).toBeVisible();
      const clubUrl = page.url().split('?')[0];
      // The first-time walkthrough (three bubbles) is skipped here; a person reads it once.
      await tap(page.getByRole('dialog', { name: 'This ring is your to-do list.' }).getByRole('button', { name: 'Skip' }));

      // A crest from colours.
      await openRing(page, /Next: Add your crest/);
      await page.getByRole('dialog', { name: 'Your crest' }).getByRole('group', { name: 'Main colour' }).getByRole('button', { name: 'Green', exact: true }).click();
      await page.getByRole('button', { name: 'Keep this crest' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);

      // About, in the identity panel: one sentence.
      await openRing(page, /Next: Say what you are/);
      const about = 'Community football in Rustavi for boys and girls from six up.';
      await page.getByRole('dialog', { name: 'About your page' }).getByLabel('About').fill(about);
      await page.getByRole('dialog', { name: 'About your page' }).getByRole('button', { name: 'Done' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);

      // A ground from the map's list.
      await openRing(page, /Next: Where do you play\?/);
      const grounds = page.getByRole('dialog', { name: 'Where do you play?' });
      // The pitch is both a pin on the map and a row in the list under it; the row.
      await grounds.locator('.gk-list-row', { hasText: 'Rustavi Community Pitches' }).first().click();
      await grounds.getByRole('button', { name: 'Done' }).click();
      await expect(page.getByText('Rustavi Community Pitches').first()).toBeVisible();

      // Two age groups.
      await openRing(page, /Next: Which ages\?/);
      const ages = page.getByRole('dialog', { name: 'Which ages?' });
      await ages.getByRole('group', { name: 'Age groups' }).locator('.gk-ages__row', { hasText: /^U10/ }).getByRole('button', { name: 'Boys' }).click();
      await ages.getByRole('group', { name: 'Age groups' }).locator('.gk-ages__row', { hasText: /^U12/ }).getByRole('button', { name: 'Girls' }).click();
      await ages.getByRole('button', { name: 'Done' }).click();
      await expect(page.getByText('U10 Boys').first()).toBeVisible();
      await expect(page.getByText('U12 Girls').first()).toBeVisible();

      // Contact: one tap on the account's email.
      await openRing(page, /Next: How to reach you/);
      await page.getByLabel('Phone').fill('+995 599 12 34 56');
      await page.locator('.gk-boxedit').getByRole('button', { name: 'Done' }).click();
      await expect(page.getByText(/\+995\s?599\s?12\s?34\s?56/)).toBeVisible();

      // A fee range: the inline editor's defaults are kept.
      await openRing(page, /Next: What does it cost\?/);
      await page.locator('.gk-boxedit').getByRole('button', { name: 'Done' }).click();
      await expect(page.getByText(/GEL \/ month/)).toBeVisible();

      // 3. Go live, the share card.
      await tap(page.getByRole('button', { name: 'Go live' }));
      await expect(page.getByRole('dialog', { name: 'Your page is live' })).toBeVisible();
      // Measured against the before review: taps, typed characters and seconds from "I want a club" to "my page is live".
      const panelTaps = 2 + 3 + 3 + 4 + 3 + 2; // crest: ring, Keep · about: ring, field, Done · ground: ring, pitch, Done · ages: ring, two groups, Done · contact: ring, field, Done · fees: ring, Done
      console.log(`page-creation ${width}×${height}: live after ${Math.round((Date.now() - started) / 1000)} s, ${taps + panelTaps} taps, ${clubName.length + about.length + 17} characters typed (the name, a sentence about the club, a phone)`);
      await page.getByRole('dialog', { name: 'Your page is live' }).getByRole('button', { name: 'Done' }).click();
      await expect(page.getByText('Draft · only you see this')).toHaveCount(0);

      // 4. World's clubs list, search, and the My Club tab.
      await page.goto(`/world/clubs?q=${encodeURIComponent('Lions ' + run)}`);
      await expect(page.getByRole('link', { name: clubName }).first()).toBeVisible();
      await page.goto('/home');
      if (width < 768) await page.getByRole('button', { name: 'Search' }).click();
      await page.getByRole('textbox', { name: 'Global search' }).fill(`Lions ${run}`);
      await expect(page.getByRole('link', { name: new RegExp(clubName) }).first()).toBeVisible();
      await page.getByRole('link', { name: 'My Club' }).first().click();
      await expect(page).toHaveURL(new RegExp(clubUrl.replace(/[/]/g, '\\/')));

      // 5. A second newcomer claims a pre-created club: the first seeded one still unclaimed (claims last until the sandbox restarts).
      await page.context().clearCookies();
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
      await register(page, 'Nino Kapanadze', `nino.${run}@example.org`);
      let known = 0;
      for (const id of [307, 306, 305, 304, 303, 302, 301]) {
        await page.goto(`/clubs/${id}`);
        await page.waitForLoadState('networkidle');
        if (await page.getByRole('link', { name: 'Claim it' }).count()) { known = id; break; }
      }
      expect(known, 'a seeded club still unclaimed').toBeGreaterThan(0);
      await page.getByRole('link', { name: 'Claim it' }).click();
      const claim = page.getByRole('dialog', { name: /^Claim / });
      await claim.getByRole('button', { name: 'I run it' }).click();
      await claim.getByLabel('Phone').fill('+995 577 11 22 33');
      await claim.getByRole('button', { name: 'Claim it' }).click();
      await expect(page).toHaveURL(new RegExp(`/clubs/${known}\\?edit=1&claimed=1`));
      await expect(page.getByText('Claim pending verification')).toBeVisible();
      // What was known about the club is already on the page and counted by the ring; the page was live before the claim.
      if (known === 307) await expect(page.getByText('Poladi Stadium training pitch').first()).toBeVisible();
      await expect(page.getByRole('button', { name: /of \d+ done/ })).toBeVisible();
    });
  });
};

flow(1440, 960);
flow(390, 844);
