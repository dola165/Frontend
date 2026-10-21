// Invoked by the isolated backend fixture described in GK09_GK13_R2_R3_FIX.md.
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';

const fixture = JSON.parse(await readFile(process.argv[2], 'utf8'));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(path.dirname(process.argv[2]), 'chat-read-browser');
await mkdir(output, { recursive: true });
const server = await createServer({ root, configFile: path.join(root, 'vite.config.ts'),
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(fixture.backend + '/api'), 'import.meta.env.VITE_ENABLE_MOCKS': '"false"' },
    server: { host: '127.0.0.1', port: 5177, strictPort: true, hmr: false } });
await server.listen();
// Full Chrome supports native tab focus; Chromium's headless shell reports every tab focused.
const browser = await chromium.launch({ headless: true, channel: process.env.GK_CHAT_BROWSER_CHANNEL ?? 'chrome' });
try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    context.setDefaultTimeout(12000);
    await context.addInitScript(account => {
        localStorage.setItem('accessToken', account.token);
        localStorage.setItem('userId', String(account.id));
        localStorage.setItem('user', JSON.stringify({ id: account.id, fullName: 'Read User', userType: 'PLAYER' }));
    }, fixture.recipient);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const url = `http://127.0.0.1:5177/e2e/fixtures/chat-read.html?conversationId=${fixture.conversation}`;
    const recipientHeaders = { Authorization: 'Bearer ' + fixture.recipient.token };
    const send = async content => {
        const response = await context.request.post(`${fixture.backend}/api/chat/conversations/${fixture.conversation}/messages`, {
            headers: { Authorization: 'Bearer ' + fixture.sender.token }, data: { content, clientMessageId: crypto.randomUUID() } });
        expect(response.status()).toBe(201);
        return (await response.json()).id;
    };
    const unread = async () => {
        const response = await context.request.get(`${fixture.backend}/api/chat/conversations/${fixture.conversation}`, { headers: recipientHeaders });
        expect(response.status()).toBe(200);
        return (await response.json()).unreadCount ?? 0;
    };
    const alerts = async () => {
        const response = await context.request.get(`${fixture.backend}/api/notifications/unread-count?scope=personal`, { headers: recipientHeaders });
        expect(response.status()).toBe(200);
        return (await response.json()).unreadCount;
    };
    await send('Opening through the conversation destination');
    expect(await alerts()).toBe(1);
    await page.goto(url);
    await page.bringToFront();
    await expect(page.getByRole('log').getByText('Opening through the conversation destination')).toBeVisible();
    await expect.poll(unread).toBe(0);
    await expect.poll(alerts).toBe(0);
    console.log('PASS: opening Messages through its exact destination clears displayed messages and their notification');

    // A failed acknowledgement preserves both counters, and retries visible content.
    let failedRead = false;
    await page.route('**/conversations/*/read', async route => {
        if (!failedRead) { failedRead = true; await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }); }
        else await route.continue();
    });
    await send('Retry the visible acknowledgement');
    await expect.poll(() => failedRead).toBe(true);
    expect(await unread()).toBe(1);
    expect(await alerts()).toBe(1);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(unread).toBe(0);
    await expect.poll(alerts).toBe(0);
    await page.unroute('**/conversations/*/read');
    console.log('PASS: read failure keeps unread feedback, then reconnect retries successfully');

    // Deliver while another tab has focus; receiving and recovering must not count as reading.
    // Playwright enables focus emulation on every page by default; turn it off
    // here so native background-tab visibility/focus is observable.
    const pageSession = await context.newCDPSession(page);
    await pageSession.send('Emulation.setFocusEmulationEnabled', { enabled: false });
    const background = await context.newPage();
    const backgroundSession = await context.newCDPSession(background);
    await backgroundSession.send('Emulation.setFocusEmulationEnabled', { enabled: false });
    await background.goto('about:blank');
    await background.bringToFront();
    await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(false);
    await send('Unread in a background tab');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(unread).toBe(1);
    await page.waitForTimeout(500);
    expect(await unread()).toBe(1);
    expect(await alerts()).toBe(1);
    await page.bringToFront();
    await pageSession.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await expect.poll(unread).toBe(0);
    await expect.poll(alerts).toBe(0);
    await background.close();
    console.log('PASS: background delivery/recovery stays unread until the conversation has focus');

    await page.goto(url + '&quick=1');
    await page.getByRole('button', { name: /Read User/ }).click();
    await expect(page.getByPlaceholder('Write a message...')).toBeVisible();
    await page.getByRole('button', { name: 'Minimize chat', exact: true }).click();
    const hiddenId = await send('Quick chat must stay unread while minimized');
    const recovered = page.waitForResponse(response => response.url().includes('/messages/after'));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await recovered;
    await page.waitForTimeout(500);
    expect(await unread()).toBe(1);
    expect(await alerts()).toBe(1);
    await expect(page.getByRole('log')).toHaveCount(0);
    await page.getByRole('button', { name: 'Restore chat', exact: true }).click();
    await expect(page.locator(`[data-chat-message-id="${hiddenId}"]`)).toBeVisible();
    await expect.poll(unread).toBe(0);
    await expect.poll(alerts).toBe(0);
    console.log('PASS: minimized quick chat keeps message and alert unread; restoration clears displayed content');

    // More history than fits on screen or in the initial 50-message page.
    await page.getByRole('button', { name: 'Close chat', exact: true }).click();
    for (let i = 0; i < 55; i++) await send(`History item ${i}: ` + 'Football discussion. '.repeat(20));
    expect(await unread()).toBe(55);
    await page.getByRole('button', { name: /Read User/ }).click();
    await expect(page.getByRole('log').locator('[data-chat-message-id]')).toHaveCount(50);
    await expect(page.getByRole('log').getByText(/^History item 54:/)).toBeInViewport();
    await expect.poll(unread).toBeLessThan(55);
    expect(await unread()).toBeGreaterThan(5);
    await page.screenshot({ path: path.join(output, 'visible-history-keeps-unseen-unread.png'), fullPage: true });
    console.log('PASS: offscreen and unfetched history remains unread after opening a populated conversation');
    expect(errors).toEqual([]);
} finally {
    await browser.close();
    await server.close();
}
