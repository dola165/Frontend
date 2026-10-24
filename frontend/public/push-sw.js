/*
 * GrassKickZ push service worker. Registered by src/features/notifications/pushSubscription.ts
 * under the scope /push/ so it never controls pages (mockServiceWorker.js, MSW's dev-only worker,
 * keeps its own scope); push events reach a registration whatever its scope.
 *
 * The server (NotificationDeliveryWorker) sends {title, body, url, tag}. The payload never holds
 * private content for groups that are not safe or for minors: the words are generic and the page
 * the link opens checks access again.
 */
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });

self.addEventListener('push', event => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
    const title = typeof data.title === 'string' && data.title ? data.title : 'GrassKickZ';
    const url = typeof data.url === 'string' && data.url ? data.url : '/notifications';
    event.waitUntil(self.registration.showNotification(title, {
        body: typeof data.body === 'string' ? data.body : '',
        icon: '/logo/logo.png',
        badge: '/logo/logo.png',
        tag: typeof data.tag === 'string' && data.tag ? data.tag : 'grasskickz',
        renotify: true,
        data: { url },
    }));
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const target = new URL((event.notification.data && event.notification.data.url) || '/notifications', self.location.origin);
    if (target.origin !== self.location.origin) return;
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async windows => {
        for (const client of windows) {
            if (new URL(client.url).origin !== self.location.origin) continue;
            try {
                const navigated = 'navigate' in client ? await client.navigate(target.href) : null;
                const focused = navigated || client;
                if ('focus' in focused) await focused.focus();
                return;
            } catch { /* a window the worker may not steer: open a new one */ }
        }
        await self.clients.openWindow(target.href);
    }));
});

// The push service rotated the subscription: tell the server the new one. Best effort; the
// settings screen also re-registers the current subscription whenever it opens.
self.addEventListener('pushsubscriptionchange', event => {
    const options = event.oldSubscription ? event.oldSubscription.options : null;
    if (!options || !options.applicationServerKey) return;
    event.waitUntil(self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: options.applicationServerKey })
        .then(subscription => fetch('/api/notifications/push-subscriptions', {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint, keys: subscription.toJSON().keys, device: 'Renewed subscription' }),
        })).catch(() => undefined));
});
