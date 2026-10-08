import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDurableMutation } from '../../features/admissions/club/useDurableMutation';
import { clearStoredAuth, getAuthSessionId, getStoredAccessToken, setRefreshedAccessToken, setStoredAccessToken } from '../authStorage';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { resolvedLanguage: 'en' } }) }));

type Body = { requestId: string; expectedVersion: number; action: string; internalNote: string };
const scope = 'login-A:club:case-30';
const key = `gk-admission-staff:${scope}`;
const otherKey = 'gk-admission-staff:login-A:club:case-31';
const draft = { action: 'ASSESS', internalNote: 'Private assessment', expectedVersion: 4 };

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function interruptedReceipt() {
    const operation = vi.fn<(body: Body) => Promise<{ id: number }>>()
        .mockRejectedValueOnce(new Error('Response lost'))
        .mockResolvedValue({ id: 30 });
    const hook = renderHook(() => useDurableMutation(scope));
    await act(async () => { await hook.result.current.send<{ id: number }, Body>(draft, operation); });
    expect(sessionStorage.getItem(key)).toContain('Private assessment');
    hook.unmount();
    return operation;
}

describe('authentication retires private staff admission receipts', () => {
    it.each(['logout', 'new account', 'same account'] as const)('clears applicant recovery after reloading outside the lazy admission routes on %s', change => {
        setStoredAccessToken('token-A');
        const session=getAuthSessionId();
        const applicantKey=`admission-retry:v1:77:${session}:88:submit:9`;
        const formKey=`admission-form:77:${session}:9:88`;
        const childKey=`new-child:77:${session}`;
        const setupKey=`gk-joining-setup-draft:${session}:1:81`;
        sessionStorage.setItem(applicantKey, JSON.stringify({requestId:'saved',payload:{playerId:88,message:'Private family arrangement'}}));
        sessionStorage.setItem(formKey, JSON.stringify({siblingConstraint:'Private sibling details'}));
        sessionStorage.setItem(childKey, JSON.stringify({fullName:'Private child identity',dateOfBirth:'2014-05-01',responsible:true,requestId:'child-saved'}));
        sessionStorage.setItem(setupKey, JSON.stringify({intake:'Private reviewed setup'}));
        sessionStorage.setItem('unrelated-session-preference','kept');
        setRefreshedAccessToken('refreshed-A',session);
        expect(sessionStorage.getItem(applicantKey)).toContain('Private family arrangement');
        expect(sessionStorage.getItem(formKey)).toContain('Private sibling details');
        expect(sessionStorage.getItem(childKey)).toContain('Private child identity');
        expect(sessionStorage.getItem(setupKey)).toContain('Private reviewed setup');
        // No applicant module/privacy listener is imported in this test.
        if(change==='logout')clearStoredAuth();else setStoredAccessToken(change==='new account'?'token-B':'token-A');
        expect(sessionStorage.getItem(applicantKey)).toBeNull();
        expect(sessionStorage.getItem(formKey)).toBeNull();
        expect(sessionStorage.getItem(childKey)).toBeNull();
        expect(sessionStorage.getItem(setupKey)).toBeNull();
        expect(sessionStorage.getItem('unrelated-session-preference')).toBe('kept');
    });
    it.each(['logout', 'new account', 'same account'] as const)('clears unmounted receipts on %s', async change => {
        setStoredAccessToken('token-A');
        const originalSession = getAuthSessionId();
        await interruptedReceipt();
        sessionStorage.setItem(otherKey, 'another unmounted private receipt');
        sessionStorage.setItem('unrelated-session-preference', 'kept');
        if (change === 'logout') clearStoredAuth();
        else setStoredAccessToken(change === 'new account' ? 'token-B' : 'token-A');
        expect(getAuthSessionId()).not.toBe(originalSession);
        expect(sessionStorage.getItem(key)).toBeNull();
        expect(sessionStorage.getItem(otherKey)).toBeNull();
        expect(sessionStorage.getItem('unrelated-session-preference')).toBe('kept');
        const remounted = renderHook(() => useDurableMutation(scope));
        expect(remounted.result.current.pending).toBeNull();
    });

    it('preserves the exact interrupted body across refresh and remount in one login', async () => {
        setStoredAccessToken('token-A');
        const session = getAuthSessionId();
        const operation = await interruptedReceipt();
        const receipt = sessionStorage.getItem(key);
        setRefreshedAccessToken('refreshed-token-A', session);
        expect(getAuthSessionId()).toBe(session);
        expect(sessionStorage.getItem(key)).toBe(receipt);
        const remounted = renderHook(() => useDurableMutation(scope));
        await act(async () => { await remounted.result.current.send<{ id: number }, Body>({ ...draft, expectedVersion: 5 }, operation); });
        expect(operation).toHaveBeenCalledTimes(2);
        expect(operation.mock.calls[1][0]).toEqual(operation.mock.calls[0][0]);
        expect(operation.mock.calls[1][0].expectedVersion).toBe(4);
        expect(sessionStorage.getItem(key)).toBeNull();
    });

    it('keeps the existing local draft cleanup on login and logout', () => {
        for (const change of [() => setStoredAccessToken('token-A'), clearStoredAuth]) {
            localStorage.setItem('gk-map-drafts:private', 'draft');
            localStorage.setItem('gk-availability-uncertain:private', 'reply');
            localStorage.setItem('theme', 'dark');
            sessionStorage.setItem(key, 'private');
            change();
            expect(localStorage.getItem('gk-map-drafts:private')).toBeNull();
            expect(localStorage.getItem('gk-availability-uncertain:private')).toBeNull();
            expect(localStorage.getItem('theme')).toBe('dark');
            expect(sessionStorage.getItem(key)).toBeNull();
        }
    });

    it.each(['login', 'logout'] as const)('allows %s and local cleanup when sessionStorage is blocked', change => {
        setStoredAccessToken('token-A');
        localStorage.setItem('gk-map-drafts:private', 'draft');
        vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
        expect(() => change === 'login' ? setStoredAccessToken('token-B') : clearStoredAuth()).not.toThrow();
        expect(localStorage.getItem('gk-map-drafts:private')).toBeNull();
        expect(getStoredAccessToken()).toBe(change === 'login' ? 'token-B' : null);
    });

    it('continues staff cleanup when a local recovery-key removal fails', () => {
        localStorage.setItem('gk-map-drafts:blocked', 'draft');
        sessionStorage.setItem(key, 'private');
        const remove = Storage.prototype.removeItem;
        vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, item: string) {
            if (item === 'gk-map-drafts:blocked') throw new DOMException('Blocked', 'SecurityError');
            return remove.call(this, item);
        });
        setStoredAccessToken('token-A');
        expect(sessionStorage.getItem(key)).toBeNull();
        expect(getStoredAccessToken()).toBe('token-A');
    });

    it('attempts every staff receipt when one removal fails', () => {
        sessionStorage.setItem(key, 'blocked');
        sessionStorage.setItem(otherKey, 'private');
        const remove = Storage.prototype.removeItem;
        vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, item: string) {
            if (item === key) throw new DOMException('Blocked', 'SecurityError');
            return remove.call(this, item);
        });
        clearStoredAuth();
        expect(sessionStorage.getItem(otherKey)).toBeNull();
        expect(getStoredAccessToken()).toBeNull();
    });
});
