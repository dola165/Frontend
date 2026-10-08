import { afterEach, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import { applyAndroidPreferences, updateAndroidPreferences } from './preferences';

afterEach(async () => { localStorage.clear(); delete window.GrassKickZ; await i18n.changeLanguage('en'); });

it('restores the device preference before a new product screen mounts', async () => {
    window.GrassKickZ = { onmessage: null, postMessage: value => {
        const request = JSON.parse(value);
        queueMicrotask(() => window.GrassKickZ?.onmessage?.(new MessageEvent('message', {
            data: JSON.stringify({ id: request.id, status: 200, body: btoa(JSON.stringify({ theme: 'light', language: 'ka' })) }),
        })));
    } };
    const listener = vi.fn(); window.addEventListener('grasskickz:appearance', listener);
    await updateAndroidPreferences();
    expect(localStorage.getItem('theme-preference')).toBe('light');
    expect(i18n.resolvedLanguage).toBe('ka');
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener('grasskickz:appearance', listener);
});

it('keeps the last setting if native storage rejects a change', async () => {
    await applyAndroidPreferences({ theme: 'dark', language: 'en' });
    window.GrassKickZ = { onmessage: null, postMessage: value => {
        const request = JSON.parse(value);
        queueMicrotask(() => window.GrassKickZ?.onmessage?.(new MessageEvent('message', {
            data: JSON.stringify({ id: request.id, error: 'Could not save' }),
        })));
    } };
    await expect(updateAndroidPreferences({ theme: 'light' })).rejects.toThrow('Could not save');
    expect(localStorage.getItem('theme-preference')).toBe('dark');
});

it('ignores malformed broadcast preferences', async () => {
    await applyAndroidPreferences({ theme: 'light', language: 'en' });
    await applyAndroidPreferences({ theme: 'unknown', language: 'ka' });
    expect(localStorage.getItem('theme-preference')).toBe('light');
    expect(i18n.resolvedLanguage).toBe('en');
});
