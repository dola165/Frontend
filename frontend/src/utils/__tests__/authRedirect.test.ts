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
        expect(completedAuthDestination({ role: 'ORGANIZER' }, null, true)).toBe('/my-club');
        expect(completedAuthDestination({ role: 'PLAYER' }, null, true)).toBe('/clubs');
    });
});
