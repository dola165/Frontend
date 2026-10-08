import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildLoginRedirectPath,
    buildSignupPath,
    clearAuthFlow,
    completedAuthDestination,
    getAuthFlow,
    publicContinuationPath,
    requiredAccountStep,
    resolvePostAuthRedirect,
    sanitizeAuthRedirect,
    rememberAuthFlow,
} from '../authRedirect';

class MemoryStorage implements Storage {
    private values = new Map<string, string>();
    get length() { return this.values.size; }
    clear() { this.values.clear(); }
    getItem(key: string) { return this.values.get(key) ?? null; }
    key(index: number) { return [...this.values.keys()][index] ?? null; }
    removeItem(key: string) { this.values.delete(key); }
    setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('registration destination flow', () => {
    beforeEach(() => {
        vi.stubGlobal('window', { sessionStorage: new MemoryStorage() });
        clearAuthFlow();
    });

    afterEach(() => vi.unstubAllGlobals());

    it('keeps an ordinary destination in the login URL and session state', () => {
        expect(buildLoginRedirectPath('/tournaments/42', '?tab=entries')).toBe(
            '/login?next=%2Ftournaments%2F42%3Ftab%3Dentries',
        );
        expect(getAuthFlow().nextPath).toBe('/tournaments/42?tab=entries');
        expect(resolvePostAuthRedirect(null)).toBe('/tournaments/42?tab=entries');
    });

    it('keeps a consent token only in session storage', () => {
        const destination = '/consent?token=secret-parent-token';
        expect(buildSignupPath(destination)).toBe('/signup');
        expect(getAuthFlow().nextPath).toBe(destination);
        expect(publicContinuationPath(destination)).toBeUndefined();
    });

    it('rejects external, protocol-relative, and authentication-loop destinations', () => {
        expect(sanitizeAuthRedirect('https://evil.example')).toBeNull();
        expect(sanitizeAuthRedirect('//evil.example')).toBeNull();
        expect(sanitizeAuthRedirect('/login?next=/clubs')).toBeNull();
    });

    it('orders required account steps before the final destination', () => {
        expect(requiredAccountStep({ mustChangePassword: true, onboardingRequired: true })).toBe('/set-password');
        expect(requiredAccountStep({ mustChangePassword: false, onboardingRequired: true })).toBe('/onboarding');
        expect(requiredAccountStep({ profileComplete: true })).toBeNull();
        expect(completedAuthDestination({ role: 'ORGANIZER' }, null, true)).toBe('/roles?setup=1&role=ORGANIZER');
        expect(completedAuthDestination({ role: 'PLAYER' }, null, true)).toBe('/roles?setup=1&role=PLAYER');
        expect(completedAuthDestination({ role: 'PARENT' }, null, true)).toBe('/roles?setup=1&role=PARENT');
        expect(completedAuthDestination({ role: 'PARENT' }, '/consent?token=synthetic-consent', true))
            .toBe('/consent?token=synthetic-consent');
    });

    it.each(['/home/../login', '/%6cogin/', '/onboarding/', '/%2fevil.example', '/%5cevil.example', '/bad%00path', '/%zz', '/home/..//evil.example'])('rejects ambiguous or normalized auth-loop path %s', (path) => {
        expect(sanitizeAuthRedirect(path)).toBeNull();
    });

    it('normalizes safe destinations while preserving their query and invitation fragment', () => {
        expect(sanitizeAuthRedirect('/clubs/../requests?tab=incoming')).toBe('/requests?tab=incoming');
        expect(sanitizeAuthRedirect('/join-squad#private-invitation')).toBe('/join-squad#private-invitation');
        expect(publicContinuationPath('/requests?%74oken=secret')).toBeUndefined();
        expect(publicContinuationPath('/%63onsent?code=secret')).toBeUndefined();
        expect(publicContinuationPath('/requests#private-invitation')).toBeUndefined();
    });

    it('keeps sign-in and recovery usable when session storage is blocked', () => {
        vi.stubGlobal('window', { get sessionStorage() { throw new Error('Storage is blocked'); } });
        clearAuthFlow();
        expect(() => rememberAuthFlow({ nextPath: '/join-squad#keep-this-private', email: 'account@example.test' })).not.toThrow();
        expect(buildSignupPath('/join-squad#keep-this-private')).toBe('/signup');
        expect(resolvePostAuthRedirect(null)).toBe('/join-squad#keep-this-private');
        clearAuthFlow(); expect(getAuthFlow()).toEqual({});
    });
});
