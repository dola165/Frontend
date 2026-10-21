import { beforeEach, describe, expect, it } from 'vitest';
import { clearStoredAuth, setStoredAccessToken } from '../authStorage';

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

describe('sign-out leaves nothing personal for the next account on this browser', () => {
    it('removes per-account copies and drafts and keeps shared choices', () => {
        const personal = ['gk-prefs:v1:5', 'gk-pins:v1:5', 'gk-ws-layout:v1:7:5', 'gk-ws-focus:v1:7:5', 'gk-club-shortcuts-v1:7:5',
            'gk-workspace-role:7:5', 'gk:workspace:5', 'tutorial.calendar.completed', 'gk.store.cart.v1:5'];
        const shared = ['theme', 'gk.schedule.view.desktop', 'gk.store.cart.v1:guest'];
        const drafts = ['gk.job.draft:5', 'gk:arrange:5:s:coach-1', 'family-player:5:s', 'draw-draft:5', 'gk-record-create:5:7:OBSERVATION'];
        [...personal, ...shared].forEach(key => localStorage.setItem(key, 'x'));
        [...drafts, 'grasskickz.auth-flow.v1', 'unrelated-session-preference'].forEach(key => sessionStorage.setItem(key, 'x'));

        clearStoredAuth();

        personal.forEach(key => expect(localStorage.getItem(key), key).toBeNull());
        shared.forEach(key => expect(localStorage.getItem(key), key).toBe('x'));
        drafts.forEach(key => expect(sessionStorage.getItem(key), key).toBeNull());
        expect(sessionStorage.getItem('grasskickz.auth-flow.v1')).toBe('x');
        expect(sessionStorage.getItem('unrelated-session-preference')).toBe('x');
    });

    it('keeps the preferences copy through a sign-in, which reads its own account’s copy', () => {
        localStorage.setItem('gk-prefs:v1:5', '{}');
        setStoredAccessToken('token-A');
        expect(localStorage.getItem('gk-prefs:v1:5')).toBe('{}');
    });
});
