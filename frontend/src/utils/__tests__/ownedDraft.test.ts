import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useOwnedDraft } from '../ownedDraft';

const signIn = (userId: string | null) => act(() => {
    if (userId) localStorage.setItem('userId', userId); else localStorage.removeItem('userId');
    window.dispatchEvent(new Event('gk-auth-changed'));
});

describe('A draft belongs to the signed-in person', () => {
    beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

    it('never shows one account’s draft to the next account on the same tab', () => {
        sessionStorage.setItem('gk.job.draft', JSON.stringify({ title: 'Unowned' }));
        localStorage.setItem('userId', '7');
        const { result } = renderHook(() => useOwnedDraft('job', { title: '' }));
        expect(result.current.draft.title).toBe('');
        expect(sessionStorage.getItem('gk.job.draft')).toBeNull();
        act(() => result.current.change({ title: 'Goalkeeper coach' }));
        signIn('8');
        expect(result.current.draft.title).toBe('');
        act(() => result.current.change({ title: 'Kit helper' }));
        signIn('7');
        expect(result.current.draft.title).toBe('Goalkeeper coach');
        signIn(null);
        expect(result.current.draft.title).toBe('');
    });
});
