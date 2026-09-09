// Run with the disposable ChatHistoryOverlayBrowserTest backend fixture.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';

const fixture = JSON.parse(await readFile(process.argv[2], 'utf8'));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(path.dirname(process.argv[2]), 'chat-history-overlay-browser');
await mkdir(output, { recursive: true });
const server = await createServer({ root, configFile: path.join(root, 'vite.config.ts'),
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(fixture.backend + '/api'), 'import.meta.env.VITE_ENABLE_MOCKS': '"false"' },
    server: { host: '127.0.0.1', port: 5177, strictPort: true, hmr: false } });
await server.listen();
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const results = {};
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
    const url = room => `http://127.0.0.1:5177/e2e/fixtures/chat-read.html?conversationId=${room}`;
    const senderHeaders = { Authorization: 'Bearer ' + fixture.sender.token };
    const recipientHeaders = { Authorization: 'Bearer ' + fixture.recipient.token };
    const send = async (content, room = fixture.conversation) => {
        const response = await context.request.post(`${fixture.backend}/api/chat/conversations/${room}/messages`, {
            headers: senderHeaders, data: { content, clientMessageId: crypto.randomUUID() } });
        expect(response.status()).toBe(201);
        return (await response.json()).id;
    };
    const unread = async (room = fixture.conversation) => {
        const response = await context.request.get(`${fixture.backend}/api/chat/conversations/${room}`, { headers: recipientHeaders });
        expect(response.status()).toBe(200);
        return (await response.json()).unreadCount ?? 0;
    };
    const scrollTop = log => log.evaluate(element => { element.scrollTop = 0; element.dispatchEvent(new Event('scroll')); });
    const offset = bubble => bubble.evaluate(element => element.getBoundingClientRect().top);
    const ids = [];
    for (let i = 0; i < 105; i++) ids.push(await send(`History ${i}`));
    await page.goto(url(fixture.conversation));
    await page.bringToFront();
    let log = page.getByRole('log', { name: 'Conversation messages' });
    await expect(log.locator('[data-chat-message-id]')).toHaveCount(50);
    await expect(log.getByText('History 104', { exact: true })).toBeInViewport();
    await scrollTop(log);
    await page.waitForTimeout(250);
    const anchor = log.locator(`[data-chat-message-id="${ids[55]}"]`);
    const before = await offset(anchor);
    const newest = await send('Arrival while reading history');
    await expect(log.locator(`[data-chat-message-id="${newest}"]`)).toBeAttached();
    expect(Math.abs(await offset(anchor) - before)).toBeLessThan(2);
    await expect(log.locator(`[data-chat-message-id="${newest}"]`)).not.toBeInViewport();
    // Failed paging retains the current history and offers a real retry.
    let fail = true;
    await page.route('**/messages/before?**', async route => {
        if (fail) { fail = false; await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }); }
        else await route.continue();
    });
    await log.getByRole('button', { name: 'Load older messages' }).click();
    await expect(log.getByRole('alert')).toContainText('try again');
    await log.getByRole('button', { name: 'Load older messages' }).click();
    await expect(log.locator('[data-chat-message-id]')).toHaveCount(101);
    expect(Math.abs(await offset(anchor) - before)).toBeLessThan(2);
    await scrollTop(log);
    const olderAnchor = log.locator(`[data-chat-message-id="${ids[5]}"]`);
    const olderOffset = await offset(olderAnchor);
    await log.getByRole('button', { name: 'Load older messages' }).click();
    await expect(log.locator('[data-chat-message-id]')).toHaveCount(106);
    expect(Math.abs(await offset(olderAnchor) - olderOffset)).toBeLessThan(2);
    await expect(log.getByRole('button', { name: 'Load older messages' })).toHaveCount(0);
    for (const bubble of await log.locator('[data-chat-message-id]').all()) {
        await bubble.scrollIntoViewIfNeeded();
        await page.waitForTimeout(230);
    }
    await expect.poll(unread).toBe(0);
    results.history = { messages: 106, olderPages: 2, unreadAfterViewingAll: 0, anchorPreserved: true, failedPageRetried: true };
    console.log('PASS R4: all 106 messages reachable and readable; two older pages, failure/retry and arrival preserve the visible anchor');
    await page.screenshot({ path: path.join(output, 'full-history.png') });

    // The same paging and anchor behavior in the small chat surface.
    await page.goto(url(fixture.conversation) + '&quick=1');
    await page.getByRole('button', { name: /Read User/ }).click();
    log = page.getByRole('log', { name: 'Quick chat messages' });
    await expect(log.locator('[data-chat-message-id]')).toHaveCount(50);
    await scrollTop(log);
    const quickAnchor = log.locator('[data-chat-message-id]').first();
    const quickOffset = await offset(quickAnchor);
    const quickId = await quickAnchor.getAttribute('data-chat-message-id');
    await log.getByRole('button', { name: 'Load older messages' }).click();
    await expect(log.locator('[data-chat-message-id]')).toHaveCount(100);
    expect(Math.abs(await offset(log.locator(`[data-chat-message-id="${quickId}"]`)) - quickOffset)).toBeLessThan(2);
    await scrollTop(log);
    await log.getByRole('button', { name: 'Load older messages' }).click();
    await expect(log.locator('[data-chat-message-id]')).toHaveCount(106);
    await expect(page.getByRole('link', { name: 'Open full conversation' })).toHaveAttribute('href', `/messages?conversationId=${fixture.conversation}`);
    await log.evaluate(element => { element.scrollTop = element.scrollHeight; element.dispatchEvent(new Event('scroll')); });
    // An opaque non-dialog overlay also blocks the shared read hook.
    await page.evaluate(() => {
        const cover = document.createElement('div'); cover.id = 'test-cover';
        cover.style.cssText = 'position:fixed;inset:0;background:#222;z-index:20000';
        document.body.append(cover);
    });
    const coveredQuick = await send('Unread behind a full-screen overlay');
    await expect(page.locator(`[data-chat-message-id="${coveredQuick}"]`)).toBeAttached();
    await page.waitForTimeout(600);
    expect(await unread()).toBe(1);
    await page.screenshot({ path: path.join(output, 'quick-chat-covered.png') });
    await page.evaluate(() => document.getElementById('test-cover').remove());
    await expect.poll(unread).toBe(0);
    results.quickChat = { messagesReachable: 106, anchorPreserved: true, coveredUnread: 1, dismissedUnread: 0 };
    console.log('PASS: quick chat reaches all history; opaque overlay blocks read until removed');

    const roomResponse = await context.request.post(`${fixture.backend}/api/chat/conversations`, {
        headers: senderHeaders, data: { contextType: 'GROUP', name: 'Overlay regression', participantIds: [fixture.recipient.id] } });
    expect(roomResponse.status()).toBe(201);
    const room = (await roomResponse.json()).id;
    await page.setViewportSize({ width: 1000, height: 900 });
    await page.goto(url(room));
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible();
    await page.getByTitle('New Chat', { exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'New Chat' })).toBeVisible();
    const hidden = await send('Incoming while New Chat is open', room);
    await expect(page.locator(`[data-chat-message-id="${hidden}"]`)).toBeAttached();
    const recovered = page.waitForResponse(response => response.url().includes(`/conversations/${room}/messages/after`));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await recovered;
    await page.waitForTimeout(600);
    expect(await unread(room)).toBe(1);
    await page.screenshot({ path: path.join(output, 'new-chat-keeps-unread.png') });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect.poll(() => unread(room)).toBe(0);
    results.newChat = { deliveryAndRecoveryContinue: true, unreadWhileOpen: 1, unreadAfterDismissal: 0 };
    console.log('PASS R5: actual New Chat keeps delivered/recovered messages unread until dismissed');
    expect(errors).toEqual([]);
} finally {
    await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    await browser.close();
    await server.close();
}
