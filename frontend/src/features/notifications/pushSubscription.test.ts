import { afterEach, describe, expect, it, vi } from 'vitest';
import { applicationServerKey, deviceName, isIosBrowser, pushSupport } from './pushSubscription';

describe('push subscription helpers', () => {
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

    it('turns the VAPID public key into the 65-byte point the Push API wants', () => {
        // 65 bytes of 0x04, 0x01…: base64url without padding, as the server prints it.
        const bytes = new Uint8Array(65).map((_, i) => (i === 0 ? 4 : i % 256));
        const base64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const key = applicationServerKey(base64);
        expect(key.length).toBe(65);
        expect(key[0]).toBe(4);
        expect(key[64]).toBe(64);
        expect(applicationServerKey(` ${base64} `)).toEqual(key);
    });

    it('names the device after the browser and the system', () => {
        expect(deviceName('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0 Safari/537.36 Edg/152.0')).toBe('Edge on Windows');
        expect(deviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')).toBe('Safari on iPhone');
        expect(deviceName('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0 Mobile Safari/537.36')).toBe('Chrome on Android');
    });

    it('knows an iPad pretending to be a Mac', () => {
        expect(isIosBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 'MacIntel', 5)).toBe(true);
        expect(isIosBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 'MacIntel', 0)).toBe(false);
    });

    it('tells an iPhone in Safari to add the site to the Home Screen first', () => {
        vi.stubGlobal('navigator', { ...navigator, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1', platform: 'iPhone', maxTouchPoints: 5 });
        vi.stubGlobal('matchMedia', () => ({ matches: false }));
        expect(pushSupport()).toBe('needs-home-screen');
        vi.stubGlobal('matchMedia', () => ({ matches: true }));
        expect(pushSupport()).not.toBe('needs-home-screen');
    });

    it('reports a browser without the Push API as unsupported (jsdom is one)', () => {
        vi.stubGlobal('matchMedia', () => ({ matches: false }));
        expect(pushSupport()).toBe('unsupported');
    });
});
