import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import i18next from 'i18next';
import { extractApiErrorCode, extractApiErrorMessage } from './apiError';

const response = (data: unknown, status = 400) => ({ response: { data, status } });

// In-memory language selection only: never load the app detector or auth/API bootstrap.
beforeAll(async () => {
    await i18next.init({ lng: 'en', fallbackLng: 'en', resources: { en: { translation: {} }, ka: { translation: {} } } });
});
afterEach(async () => { await i18next.changeLanguage('en'); });

describe('extractApiErrorMessage', () => {
    it('can load before app initialization without starting locale, storage or request effects', async () => {
        vi.resetModules();
        const coldI18next = i18next.createInstance();
        vi.doMock('i18next', () => ({ default: coldI18next }));
        const init = vi.spyOn(coldI18next, 'init');
        const changeLanguage = vi.spyOn(coldI18next, 'changeLanguage');
        const readStorage = vi.spyOn(Storage.prototype, 'getItem');
        const writeStorage = vi.spyOn(Storage.prototype, 'setItem');
        const request = vi.spyOn(globalThis, 'fetch');
        try {
            const cold = await import('./apiError');
            expect(coldI18next.isInitialized).toBeFalsy();
            expect(cold.extractApiErrorMessage(null)).toBe('Something went wrong.');
            expect(cold.extractApiErrorMessage(response({ detail: 'Server explanation' }))).toBe('Server explanation');
            for (const effect of [init, changeLanguage, readStorage, writeStorage, request]) expect(effect).not.toHaveBeenCalled();
        } finally {
            vi.doUnmock('i18next');
            vi.resetModules();
            vi.restoreAllMocks();
        }
    });
    it('shows the actionable Problem Details explanation instead of its type URI or title', () => {
        expect(extractApiErrorMessage(response({ type: 'about:blank', title: 'Conflict', status: 409, detail: 'This shift is full. Choose another shift.', instance: '/api/volunteer-shifts/20/signup' }, 409)))
            .toBe('This shift is full. Choose another shift.');
    });
    it('prefers detail then message then error regardless of JSON property order', () => {
        expect(extractApiErrorMessage(response({ error: 'Conflict', message: 'Schedule changed.', detail: 'Expand the edition dates first.' }))).toBe('Expand the edition dates first.');
        expect(extractApiErrorMessage(response({ type: 'https://example.test/problem', error: 'Bad Request', message: 'Choose an available referee.', detail: '  ' }))).toBe('Choose an available referee.');
        expect(extractApiErrorMessage(response({ code: 'FULL', error: 'No places remain.', detail: null }))).toBe('No places remain.');
    });
    it('falls back to the problem title when no detailed explanation exists', () => {
        expect(extractApiErrorMessage(response({ type: 'about:blank', status: 404, title: 'Volunteer shift not found' }))).toBe('Volunteer shift not found');
    });
    it('preserves plain text and field-validation responses while ignoring metadata', () => {
        expect(extractApiErrorMessage(response('Choose a future start time.'))).toBe('Choose a future start time.');
        expect(extractApiErrorMessage(response({ code: 'VALIDATION_FAILED', timestamp: '2026-09-18', startsAt: 'Start must be in the future.', capacity: 'Capacity must be positive.' }))).toBe('Start must be in the future.');
    });
    it('does not display machine metadata when there is no human-readable explanation', () => {
        expect(extractApiErrorMessage(response({ type: 'about:blank', instance: '/api/events/1', code: 'E_CONFLICT', status: 409, path: '/api/events/1', timestamp: '2026-09-18' }), 'Please retry.')).toBe('Please retry.');
    });
    it.each([
        ['en', 'Too many attempts. Please wait a moment and try again.', 'Sign in using your existing method, then open Account → Linked Accounts to connect Google.'],
        ['ka-GE', 'მეტისმეტად ბევრი მცდელობაა. ცოტა ხანს მოიცადეთ და სცადეთ ხელახლა.', 'შედით არსებული მეთოდით, შემდეგ Google-ის დასაკავშირებლად გახსენით ანგარიში → დაკავშირებული ანგარიშები.'],
    ])('localizes owned guidance in %s while preserving status and code precedence', async (language, rateLimit, providerLink) => {
        await i18next.changeLanguage(language);
        const linked = response({ code: 'provider_link_required', detail: 'Account exists', message: 'Server message' });
        expect(extractApiErrorMessage(response(linked.response.data, 429), 'Explicit fallback')).toBe(rateLimit);
        expect(extractApiErrorMessage(response('Raw limiter payload', 429))).toBe(rateLimit);
        expect(extractApiErrorMessage(linked, 'Explicit fallback')).toBe(providerLink);
        expect(extractApiErrorCode(linked)).toBe('provider_link_required');
    });
    it('preserves server text and explicit fallbacks literally even when they collide with owned English copy', async () => {
        await i18next.changeLanguage('ka-GE');
        const collisions = [
            'Something went wrong.',
            'Too many attempts. Please wait a moment and try again.',
            'Sign in using your existing method, then open Account → Linked Accounts to connect Google.',
        ];
        for (const literal of [...collisions, 'Unknown server explanation', '  Keep surrounding spaces.  ']) {
            expect(extractApiErrorMessage(response(literal))).toBe(literal);
            for (const field of ['detail', 'message', 'error', 'title', 'displayName']) {
                expect(extractApiErrorMessage(response({ code: 'UNKNOWN_CODE', [field]: literal }))).toBe(literal);
            }
            expect(extractApiErrorMessage(response(null), literal)).toBe(literal);
        }
        expect(extractApiErrorMessage(null, '')).toBe('');
    });
    it('resolves the missing fallback at call time and leaves already captured strings unchanged', async () => {
        const captured = extractApiErrorMessage(null);
        await i18next.changeLanguage('ka-GE');
        expect(extractApiErrorMessage(null)).toBe('რაღაც ვერ შესრულდა.');
        expect(extractApiErrorMessage(response({ code: 'UNKNOWN_CODE' }), undefined)).toBe('რაღაც ვერ შესრულდა.');
        expect(captured).toBe('Something went wrong.');
    });
    it.each([null, undefined, {}, new Error('Network failed'), response(null), response({ detail: ' ', message: null })])('handles missing error data without throwing', error => {
        expect(extractApiErrorMessage(error, 'Unable to save.')).toBe('Unable to save.');
    });
});

describe('extractApiErrorCode', () => {
    it('preserves an application code independently of its displayed message', () => {
        expect(extractApiErrorCode(response({ code: 'FULL', detail: 'No places remain.' }))).toBe('FULL');
    });
    it.each([null, undefined, {}, response({ type: 'about:blank' }), response({ code: ' ' })])('returns null when no code exists', error => {
        expect(extractApiErrorCode(error)).toBeNull();
    });
});
