// Diagnostic review: the assertions below deliberately reproduce outstanding defects.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';

const fixture = JSON.parse(await readFile(process.argv[2], 'utf8'));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(path.dirname(process.argv[2]), 'chat-signoff-browser');
await mkdir(output, { recursive: true });
const server = await createServer({ root, configFile: path.join(root, 'vite.config.ts'),
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(fixture.backend + '/api'), 'import.meta.env.VITE_ENABLE_MOCKS': '"false"' },
    server: { host: '127.0.0.1', port: 5177, strictPort: true, hmr: false } });
await server.listen();
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const results = {};
try {
    const context = await browser.newContext({ viewport: { width: 1000, height: 900 } });
    context.setDefaultTimeout(12000);
    await context.addInitScript(account => {
        localStorage.setItem('accessToken', account.token);
        localStorage.setItem('userId', String(account.id));
        localStorage.setItem('user', JSON.stringify({ id: account.id, fullName: 'Read User', userType: 'PLAYER' }));
    }, fixture.recipient);
    const page = await context.newPage();
    const errors = [];
    const historyRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
        if (/\/messages(?:\?|$)/.test(request.url()) && request.method() === 'GET') historyRequests.push(request.url());
    });
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

    const ids = [];
    for (let i = 0; i < 55; i++) ids.push(await send(`Signoff history ${i}`));
    expect(await unread()).toBe(55);
    await page.goto(url);
    await page.bringToFront();
    const log = page.getByRole('log', { name: 'Conversation messages' });
    await expect(log.locator('[data-chat-message-id]')).toHaveCount(50);
    // Read every available bubble through normal viewport scrolling, never via the read API.
    for (const bubble of await log.locator('[data-chat-message-id]').all()) {
        await bubble.scrollIntoViewIfNeeded();
        await page.waitForTimeout(240);
    }
    await expect.poll(unread).toBe(5);
    await log.evaluate(element => { element.scrollTop = 0; element.dispatchEvent(new Event('scroll')); });
    await page.waitForTimeout(400);
    await expect(log.getByText('Signoff history 0', { exact: true })).toHaveCount(0);
    await expect(log.getByText('Signoff history 5', { exact: true })).toBeInViewport();
    expect(historyRequests.every(request => Number(new URL(request).searchParams.get('page') ?? 0) === 0)).toBe(true);
    results.strandedHistory = { sent: 55, rendered: 50, unreadAfterViewingEveryAvailableMessage: await unread(), historyRequests };
    console.log('REPRO R4: after reading all 50 accessible messages, 5 older messages remain unread; scrolling to the top makes no older-page request');
    await page.screenshot({ path: path.join(output, 'stranded-history.png'), fullPage: true });

    // Also inspect whether a person reading history can retain their scroll position.
    const before = await log.evaluate(element => element.scrollTop);
    const latest = await send('Signoff new arrival during history reading');
    await expect(log.locator(`[data-chat-message-id="${latest}"]`)).toBeInViewport();
    const after = await log.evaluate(element => element.scrollTop);
    expect(after).toBeGreaterThan(before + 500);
    results.forcedScroll = { before, after };
    console.log('REPRO: a new incoming message moves a reader from the top of history to the bottom');

    // The real New Chat overlay covers the selected conversation but leaves its read hook enabled.
    // Reopen a fresh conversation with only one message so its bubble falls beneath the dialog.
    const newRoomResponse = await context.request.post(`${fixture.backend}/api/chat/conversations`, {
        headers: { Authorization: 'Bearer ' + fixture.sender.token }, data: { contextType: 'GROUP', name: 'Occlusion review', participantIds: [fixture.recipient.id] } });
    expect(newRoomResponse.status()).toBe(201);
    const newRoom = (await newRoomResponse.json()).id;
    await page.goto(`http://127.0.0.1:5177/e2e/fixtures/chat-read.html?conversationId=${newRoom}`);
    await page.bringToFront();
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible();
    await page.getByTitle('New Chat', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'New Chat', exact: true })).toBeVisible();
    await page.waitForTimeout(200);
    let releaseRead;
    const gate = new Promise(resolve => { releaseRead = resolve; });
    let capturedIds;
    await page.route(`**/conversations/${newRoom}/read`, async route => {
        capturedIds = route.request().postDataJSON().messageIds;
        await gate;
        await route.continue();
    });
    const messageResponse = await context.request.post(`${fixture.backend}/api/chat/conversations/${newRoom}/messages`, {
        headers: { Authorization: 'Bearer ' + fixture.sender.token }, data: { content: 'Message covered by the new chat dialog', clientMessageId: crypto.randomUUID() } });
    expect(messageResponse.status()).toBe(201);
    const hiddenMessage = (await messageResponse.json()).id;
    const hiddenBubble = page.locator(`[data-chat-message-id="${hiddenMessage}"]`);
    await expect(hiddenBubble).toBeAttached();
    const occlusion = await hiddenBubble.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const text = element.querySelector('p')?.getBoundingClientRect() ?? rect;
        const x = (text.left + text.right) / 2, y = (text.top + text.bottom) / 2;
        const top = document.elementFromPoint(x, y);
        return { x, y, covered: !element.contains(top), coveringClass: top?.className, focused: document.activeElement?.getAttribute('placeholder') };
    });
    expect(occlusion.covered).toBe(true);
    await expect.poll(() => capturedIds?.includes(hiddenMessage) ?? false).toBe(true);
    releaseRead();
    await expect.poll(async () => {
        const response = await context.request.get(`${fixture.backend}/api/chat/conversations/${newRoom}`, { headers: recipientHeaders });
        return (await response.json()).unreadCount ?? 0;
    }).toBe(0);
    await expect(page.getByRole('heading', { name: 'New Chat', exact: true })).toBeVisible();
    results.occludedRead = { hiddenMessage, capturedIds, ...occlusion, unread: 0 };
    console.log('REPRO R5: the server marked an incoming message read while the real New Chat overlay covered its text and retained focus');
    await page.screenshot({ path: path.join(output, 'read-behind-dialog.png'), fullPage: true });
    expect(errors).toEqual([]);
} finally {
    await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    await browser.close();
    await server.close();
}
