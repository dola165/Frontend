import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { askedChoice, followChoice } from '../directory/followChoice';
import type { DirectorySource } from '../directory/types';
import type { DirectoryData } from '../directory/useDirectoryData';
import { useOutsideChoice } from '../directory/useOutsideChoice';

const DOLA = '/world?tab=clubs&city=Tbilisi&ageGroup=U14&selected=2';

describe('following a link that chooses a World result', () => {
    it('keeps the list on screen and changes only the choice, so the map flies instead of starting over', () => {
        expect(followChoice(DOLA, { pathname: '/world', search: '?tab=clubs&city=Batumi&gender=FEMALE&selected=7' }))
            .toEqual({ to: '/world?tab=clubs&city=Batumi&gender=FEMALE&selected=2', state: { choose: '2' } });
        // An address naming no tab shows the page's first list.
        expect(followChoice(DOLA, { pathname: '/world', search: '' })).toEqual({ to: '/world?selected=2', state: { choose: '2' } });
    });

    it('opens the link as it is from another list or page, still asking for the flight', () => {
        expect(followChoice(DOLA, { pathname: '/world', search: '?tab=events' })).toEqual({ to: DOLA, state: { choose: '2' } });
        expect(followChoice(DOLA, { pathname: '/home', search: '' })).toEqual({ to: DOLA, state: { choose: '2' } });
    });

    it('follows any other link as it is', () => {
        expect(followChoice('/world?tab=clubs&city=Tbilisi', { pathname: '/world', search: '?city=Batumi' })).toEqual({ to: '/world?tab=clubs&city=Tbilisi' });
        expect(followChoice('/calendar', { pathname: '/world', search: '' })).toEqual({ to: '/calendar' });
    });

    it('reads the result a followed link asked for from its history state', () => {
        expect(askedChoice({ choose: '2' })).toBe('2');
        expect(askedChoice({ pane: true })).toBeUndefined();
        expect(askedChoice(null)).toBeUndefined();
    });
});

describe('a chosen result outside the loaded pages', () => {
    interface Row { id: number; name: string }
    const one = vi.fn(async (key: string) => ({ id: Number(key), name: `Club ${key}` }));
    const clubs = { id: 'clubs', key: (row: Row) => String(row.id), one } as unknown as DirectorySource<Row>;
    const loaded = (items: Row[], loading = false) => ({ items, loading }) as unknown as DirectoryData;
    const page = [{ id: 1, name: 'Club 1' }];

    it('is looked up on its own and put on the map after the list', async () => {
        const { result } = renderHook(() => useOutsideChoice(clubs, '9', loaded(page), true));
        await waitFor(() => expect(result.current.items.map(row => row.id)).toEqual([1, 9]));
        expect(one).toHaveBeenCalledWith('9', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    });

    it('is not looked up while the list loads, when the list holds it, or while the map is folded', () => {
        one.mockClear();
        renderHook(() => useOutsideChoice(clubs, '9', loaded([], true), true));
        renderHook(() => useOutsideChoice(clubs, '1', loaded(page), true));
        renderHook(() => useOutsideChoice(clubs, '9', loaded(page), false));
        expect(one).not.toHaveBeenCalled();
    });
});
