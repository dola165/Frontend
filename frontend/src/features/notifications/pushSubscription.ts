import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { forgetPushSubscription, registerPushSubscription, type NotificationLanguage, type NotificationPreferences } from '../../api/notificationPreferences';

/** The service worker that shows pushes; its own scope, apart from anything else in public/. */
export const PUSH_WORKER_URL = '/push-sw.js';
export const PUSH_WORKER_SCOPE = '/push/';

/** What this browser can do, before asking anything. */
export type PushSupport = 'supported' | 'needs-home-screen' | 'unsupported';

export const isIosBrowser = (userAgent: string, platform: string, touchPoints: number) =>
    /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && touchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iPhones and iPads get web push only once the site is on the Home Screen (iOS 16.4+). */
export function pushSupport(): PushSupport {
    if (typeof window === 'undefined' || window.isSecureContext === false) return 'unsupported';
    if (isIosBrowser(navigator.userAgent, navigator.platform, navigator.maxTouchPoints) && !isStandalone()) return 'needs-home-screen';
    const hasApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    return hasApi ? 'supported' : 'unsupported';
}

/** The VAPID public key as the Push API wants it. */
export function applicationServerKey(base64Url: string): Uint8Array<ArrayBuffer> {
    const trimmed = base64Url.trim();
    const padded = trimmed + '='.repeat((4 - (trimmed.length % 4)) % 4);
    const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
}

/** A short name for the devices list: "Chrome on Windows", "Safari on iPhone". */
export function deviceName(userAgent = navigator.userAgent): string {
    const browser = /Edg\//.test(userAgent) ? 'Edge' : /OPR\//.test(userAgent) ? 'Opera' : /Firefox\//.test(userAgent) ? 'Firefox'
        : /Chrome\//.test(userAgent) ? 'Chrome' : /Safari\//.test(userAgent) ? 'Safari' : 'Browser';
    const os = /iPhone/.test(userAgent) ? 'iPhone' : /iPad/.test(userAgent) ? 'iPad' : /Android/.test(userAgent) ? 'Android'
        : /Windows/.test(userAgent) ? 'Windows' : /Mac OS X/.test(userAgent) ? 'Mac' : /Linux/.test(userAgent) ? 'Linux' : null;
    return os ? `${browser} on ${os}` : browser;
}

async function registration(): Promise<ServiceWorkerRegistration> {
    const existing = await navigator.serviceWorker.getRegistration(PUSH_WORKER_SCOPE);
    return existing ?? navigator.serviceWorker.register(PUSH_WORKER_URL, { scope: PUSH_WORKER_SCOPE });
}

export async function currentSubscription(): Promise<PushSubscription | null> {
    if (pushSupport() !== 'supported') return null;
    const existing = await navigator.serviceWorker.getRegistration(PUSH_WORKER_SCOPE);
    return existing ? existing.pushManager.getSubscription() : null;
}

export type EnableFailure = 'denied' | 'unsupported' | 'not-configured' | 'failed';
export type EnableOutcome = { ok: true; preferences: NotificationPreferences } | { ok: false; reason: EnableFailure };

/** Ask for permission, subscribe this browser, and tell the server. */
export async function enablePushOnThisDevice(publicKey: string | null, language: NotificationLanguage): Promise<EnableOutcome> {
    if (pushSupport() !== 'supported') return { ok: false, reason: 'unsupported' };
    if (!publicKey) return { ok: false, reason: 'not-configured' };
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };
    try {
        const worker = await registration();
        const key = applicationServerKey(publicKey);
        let subscription = await worker.pushManager.getSubscription();
        if (subscription && !sameKey(subscription, key)) { await subscription.unsubscribe(); subscription = null; }
        subscription = subscription ?? await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        const json = subscription.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return { ok: false, reason: 'failed' };
        const preferences = await registerPushSubscription({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth }, device: deviceName(), language });
        return { ok: true, preferences };
    } catch {
        return { ok: false, reason: 'failed' };
    }
}

/** Unsubscribe this browser and tell the server to forget it. */
export async function disablePushOnThisDevice(): Promise<NotificationPreferences | null> {
    const subscription = await currentSubscription();
    if (!subscription) return null;
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe().catch(() => false);
    return forgetPushSubscription(endpoint);
}

function sameKey(subscription: PushSubscription, key: Uint8Array): boolean {
    const current = subscription.options?.applicationServerKey;
    if (!current) return true;
    const bytes = new Uint8Array(current);
    return bytes.length === key.length && bytes.every((value, i) => value === key[i]);
}

export type DeviceState = 'checking' | 'on' | 'off' | 'denied' | 'needs-home-screen' | 'unsupported';

/** The app's current language as the server stores it. */
export function useNotificationLanguage(): NotificationLanguage {
    const { i18n } = useTranslation();
    return (i18n.resolvedLanguage ?? i18n.language ?? 'en').startsWith('ka') ? 'ka' : 'en';
}

/** Whether this browser receives pushes, and the two moves. */
export function usePushDevice(publicKey: string | null | undefined, onPreferences?: (preferences: NotificationPreferences) => void) {
    const language = useNotificationLanguage();
    const [state, setState] = useState<DeviceState>('checking');
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<EnableFailure | null>(null);

    const refresh = useCallback(async () => {
        const support = pushSupport();
        if (support !== 'supported') { setState(support); return; }
        if (Notification.permission === 'denied') { setState('denied'); return; }
        setState((await currentSubscription()) ? 'on' : 'off');
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);

    const enable = useCallback(async () => {
        setBusy(true); setFailure(null);
        try {
            const outcome = await enablePushOnThisDevice(publicKey ?? null, language);
            if (outcome.ok) { onPreferences?.(outcome.preferences); setState('on'); }
            else { setFailure(outcome.reason); setState(outcome.reason === 'denied' ? 'denied' : 'off'); }
            return outcome;
        } finally { setBusy(false); }
    }, [language, onPreferences, publicKey]);

    const disable = useCallback(async () => {
        setBusy(true); setFailure(null);
        try {
            const preferences = await disablePushOnThisDevice();
            if (preferences) onPreferences?.(preferences);
            setState('off');
        } finally { setBusy(false); }
    }, [onPreferences]);

    return { state, busy, failure, enable, disable, refresh, language };
}
