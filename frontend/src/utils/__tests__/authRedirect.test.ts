import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildLoginRedirectPath,
    beginExplicitSignOut,
    completeSignOutNavigation,
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

    it('discards the previous account’s private destination during explicit sign-out, then allows new invitations', () => {
        rememberAuthFlow({ nextPath: '/messages?conversationId=801', email: 'old@example.test', newAccount: true });
        beginExplicitSignOut();
        expect(buildLoginRedirectPath('/messages', '?conversationId=801')).toBe('/login');
        // Repeated protected-route renders cannot restore the retired account's continuation.
        expect(buildLoginRedirectPath('/messages', '?conversationId=801')).toBe('/login');
        expect(getAuthFlow()).toEqual({ nextPath: undefined, email: undefined, newAccount: false, town: undefined });
        completeSignOutNavigation();
        expect(buildLoginRedirectPath('/team-work', '', '#new-invitation')).toBe('/login');
        expect(getAuthFlow().nextPath).toBe('/team-work#new-invitation');
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
        // A new account starts its first run whatever it was registered as; an invitation it arrived with still wins.
        expect(completedAuthDestination({}, null, true)).toBe('/start');
        expect(completedAuthDestination({ profileComplete: true }, null, false)).toBe('/home');
        expect(completedAuthDestination({}, '/consent?token=synthetic-consent', true))
            .toBe('/consent?token=synthetic-consent');
        expect(sanitizeAuthRedirect('/start')).toBeNull();
    });

    it.each(['/home/../login', '/%6cogin/', '/onboarding/', '/%2fevil.example', '/%5cevil.example', '/bad%00path', '/%zz', '/home/..//evil.example'])('rejects ambiguous or normalized auth-loop path %s', (path) => {
        expect(sanitizeAuthRedirect(path)).toBeNull();
    });

    it('normalizes safe destinations while preserving their query and invitation fragment', () => {
        expect(sanitizeAuthRedirect('/clubs/../requests?tab=incoming')).toBe('/requests?tab=incoming');
        expect(sanitizeAuthRedirect('/team-work#private-invitation')).toBe('/team-work#private-invitation');
        expect(publicContinuationPath('/requests?%74oken=secret')).toBeUndefined();
        expect(publicContinuationPath('/%63onsent?code=secret')).toBeUndefined();
        expect(publicContinuationPath('/requests#private-invitation')).toBeUndefined();
    });

    it('keeps sign-in and recovery usable when session storage is blocked', () => {
        vi.stubGlobal('window', { get sessionStorage() { throw new Error('Storage is blocked'); } });
        clearAuthFlow();
        expect(() => rememberAuthFlow({ nextPath: '/team-work#keep-this-private', email: 'account@example.test' })).not.toThrow();
        expect(buildSignupPath('/team-work#keep-this-private')).toBe('/signup');
        expect(resolvePostAuthRedirect(null)).toBe('/team-work#keep-this-private');
        clearAuthFlow(); expect(getAuthFlow()).toEqual({});
    });
});
