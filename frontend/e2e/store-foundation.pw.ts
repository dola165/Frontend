import { expect, test } from '@playwright/test';
import { makePage } from '../src/features/pages/__tests__/fixtures';
import type { StoreOrder } from '../src/features/store/orders/api';

// Browser/UI proof only. Every API request is synthetic; all other network origins are blocked.
for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
    test(`${width}px ${theme}: contact, purchase request, later return and platform inventory doors`, async ({ page, baseURL }, info) => {
        await page.setViewportSize({ width, height: 960 });
        page.on('pageerror', error => console.log('Store browser error:', error.message));
        const item = { variantId: 7, productId: 1, quantity: 2, name: 'Actual training shirt with a long useful item name', variant: 'Medium', clubId: 10, seller: 'CLUB', currency: 'GEL' };
        const product = { id: 1, clubId: 10, clubName: 'Synthetic grassroots academy with a long club name', name: item.name, currency: 'GEL', price: 12.34, active: true, version: 3, variants: [{ id: 7, label: 'Medium', stock: 5 }], images: [], clubWhatsappNumber: '+995555010101', clubEmail: 'shop@example.test' };
        const quote = { clubId: 10, clubName: product.clubName, currency: 'GEL', subtotal: 2468, checkoutEnabled: false, message: '', lines: [{ variantId: 7, productId: 1, productVersion: 3, materialDigest: 'a'.repeat(64), material: { description: 'Actual shirt', images: [], sizes: ['Medium'], category: 'SHIRT', collection: null, sellerArrangement: null }, name: item.name, variant: 'Medium', quantity: 2, unitAmount: 1234, lineAmount: 2468 }] };
        const clubPage = makePage({ kind: 'CLUB', ref: { type: 'club', id: 10 }, clubId: 10, status: 'LIVE', verification: 'VERIFIED', viewer: { role: null, canEdit: false, editable: [] } });
        clubPage.identity.name = product.clubName;
        clubPage.identity.contact = { phone: '+995555010101', email: 'shop@example.test' };
        clubPage.links.profilePath = '/clubs/10';
        let orders: StoreOrder[] = [];
        const requestKeys: string[] = []; let quoteReads = 0;
        await page.addInitScript(({ theme, item }) => {
            localStorage.setItem('userId', '2'); localStorage.setItem('gk-session-id', 'synthetic-store-browser'); localStorage.setItem('gk-signed-in-session', 'synthetic-store-browser');
            localStorage.setItem('theme-preference', theme); localStorage.setItem('theme-chosen', '1'); localStorage.setItem('i18nextLng', 'en');
            localStorage.setItem('gk.store.cart.v1:2', JSON.stringify([item]));
        }, { theme, item });
        await page.routeWebSocket('**', socket => socket.close());
        await page.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (url.origin !== baseURL) return route.abort();
            if (!url.pathname.startsWith('/api/')) return route.continue();
            const path = url.pathname.replace('/api', '');
            let data: unknown = [];
            if (path === '/auth/refresh') data = { accessToken: `${btoa(JSON.stringify({ alg: 'none' }))}.${btoa(JSON.stringify({ sub: '2', exp: 4102444800, role: 'ORGANIZER' }))}.synthetic` };
            else if (path === '/users/me') data = { id: 2, username: 'synthetic-buyer', role: 'ORGANIZER', fullName: 'Synthetic buyer', email: 'buyer@example.test', dob: '1990-01-01', profileComplete: true, onboardingRequired: false, emailVerified: true, navigationCapabilities: { version: 1, workspaces: [] } };
            else if (path === '/users/me/place') data = { countryCode: 'GE', countryName: 'Georgia', cityName: 'Tbilisi' };
            else if (path === '/clubs/10/page') data = clubPage;
            else if (path === '/clubs/10') data = { id: 10, name: product.clubName, myRole: 'OWNER', isOfficial: true };
            else if (path === '/store/products/1') data = product;
            else if (path === '/store/products') data = { content: [product], totalElements: 1 };
            else if (path === '/store/front') data = { city: null, collections: [], near: [], followed: [], sellers: 1, own: 0 };
            else if (path === '/store/cart/quote') { quoteReads++; data = quote; }
            else if (path === '/store/platform/access') data = { canManage: true };
            else if (path === '/store/platform/seller') data = { contactEmail: '', whatsapp: '', website: '', arrangement: '', version: 0 };
            else if (path === '/store/orders' && route.request().method() === 'POST') {
                const input = route.request().postDataJSON();
                requestKeys.push(input.requestId);
                expect(input).toMatchObject({ clubId: 10, currency: 'GEL', contact: 'chosen contact@example.test', lines: [{ variantId: 7, quantity: 2, productVersion: 3, unitPrice: 12.34, materialDigest: quote.lines[0].materialDigest }] });
                orders = [{ id: crypto.randomUUID(), buyerId: 2, clubId: 10, sellerName: product.clubName, currency: 'GEL', total: 24.68, fulfillment: 'COLLECTION', buyerContact: input.contact, buyerNote: '', sellerAnswer: '', status: 'REQUESTED', settlement: 'UNREPORTED', version: 0, createdAt: '2026-10-30T12:00:00Z', updatedAt: '2026-10-30T12:00:00Z', lines: [{ productId: 1, variantId: 7, originalVariantId: 7, productVersion: 3, material: quote.lines[0].material, materialDigest: quote.lines[0].materialDigest, name: item.name, variant: 'Medium', quantity: 2, unitPrice: 12.34 }], history: [] }];
                data = orders[0];
            } else if (path === '/store/orders') data = orders;
            else if (path === `/store/orders/${orders[0]?.id}/commands`) {
                const command = route.request().postDataJSON();
                expect(command).toMatchObject({ action: 'CANCEL', version: 0 });
                orders = [{ ...orders[0], status: 'CANCELLED', version: 1 }]; data = orders[0];
            }
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
        });
        await page.goto('/clubs/10');
        try { await expect(page.getByText(product.clubName, { exact: true }).first()).toBeVisible(); }
        catch (error) { console.log('Store browser location:', page.url(), 'Page text:', (await page.locator('body').innerText()).slice(0, 2000)); throw error; }
        await page.screenshot({ path: info.outputPath('club-reference.png'), fullPage: true });
        await page.goto('/store/products/1');
        await expect(page.getByRole('link', { name: 'Ask on WhatsApp' })).toHaveAttribute('href', /wa.me/);
        await expect(page.getByRole('link', { name: 'Email the club' })).toHaveAttribute('href', /shop@example.test/);
        await page.goto('/store/cart');
        await expect(page.getByRole('button', { name: 'Request purchase', exact: true })).toBeVisible();
        expect((await page.getByRole('button', { name: 'Request purchase', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await page.getByLabel('Your contact for this request').fill('chosen contact@example.test');
        await page.getByLabel('Your contact for this request').press('Tab');
        await expect(page.getByLabel('Message (optional)')).toBeFocused();
        await page.screenshot({ path: info.outputPath('cart.png'), fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await page.getByRole('button', { name: 'Request purchase', exact: true }).click();
        await expect(page.getByText(/Request saved\./)).toBeVisible();
        await page.getByRole('link', { name: 'Open My requests' }).click();
        await expect(page.getByText(/Waiting for the seller. Stock is not reserved/)).toBeVisible();
        await page.screenshot({ path: info.outputPath('requests.png'), fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        // Query-only navigation keeps the actual StoreCart instance and its saved receipt.
        await page.getByRole('button', { name: 'Cancel and release any reservation' }).click();
        await expect(page.getByText(/cancelled · collection/)).toBeVisible();
        await page.getByRole('link', { name: 'Back to cart' }).click();
        await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible();
        await expect(page.getByText('Subtotal', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Request purchase', exact: true })).toHaveCount(0);
        const beforeReview = quoteReads;
        await page.getByRole('button', { name: 'Review current quote for another purchase' }).click();
        await expect(page.getByLabel('Your contact for this request')).toHaveValue('chosen contact@example.test');
        expect(quoteReads).toBeGreaterThan(beforeReview);
        await page.getByRole('button', { name: 'Request purchase', exact: true }).click();
        await expect(page.getByText(/Request saved\./)).toBeVisible();
        expect(requestKeys).toHaveLength(2); expect(requestKeys[1]).not.toBe(requestKeys[0]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await page.goto('/store?view=manage');
        await expect(page.getByRole('heading', { name: 'GrassKickZ store administration' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Add product', exact: true })).toBeVisible();
        await page.screenshot({ path: info.outputPath('platform.png'), fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await page.goto('/store/cart?view=requests');
        await expect(page.getByText(/Waiting for the seller. Stock is not reserved/)).toBeVisible();
        await expect(page.getByRole('button', { name: 'Cancel and release any reservation' })).toBeVisible();
    });
}
