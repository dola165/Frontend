import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { BrowsePanel } from '../directory/BrowsePanel';
import { DirectorySelectionContext, type DirectorySelection } from '../directory/selection';
import type { DirectorySource } from '../directory/types';
import type { DirectoryData } from '../directory/useDirectoryData';

interface Club { id: number; name: string; city: string }
const clubs: Club[] = [
    { id: 1, name: 'Riverside Academy', city: 'Tbilisi' },
    { id: 2, name: 'Saburtalo Youth FC', city: 'Tbilisi' },
    { id: 3, name: 'Telavi Valley FC', city: 'Telavi' },
];
const source = {
    id: 'clubs', label: 'Clubs', noun: ['club', 'clubs'], searchLabel: 'Search clubs', searchPlaceholder: 'Search clubs', filters: [], pageSize: 12, layout: 'rows',
    load: vi.fn(), key: (club: Club) => String(club.id), Item: () => null, empty: { title: 'No clubs', body: '' },
    line: (club: Club) => ({ title: club.name, detail: `Academy · ${club.city}`, to: `/clubs/${club.id}`, action: 'Open club', fact: '6.7 km away' }),
} satisfies DirectorySource<Club>;
const data = { items: clubs, loading: false, error: '', notice: undefined, hasMore: false, loadingMore: false, loadMore: vi.fn(), retry: vi.fn() } as unknown as DirectoryData;
// Riverside and Saburtalo share one pin; Telavi has no place.
const selection = (over: Partial<DirectorySelection> = {}): DirectorySelection => ({
    pinOf: new Map([['1', 'p1'], ['2', 'p1']]), hover: vi.fn(), choose: vi.fn(), clear: vi.fn(), mappable: true, incomplete: false, ...over,
});
const show = (value: DirectorySelection) => render(
    <MemoryRouter><DirectorySelectionContext.Provider value={value}>
        <BrowsePanel source={source} data={data} count="3 clubs near Tbilisi" folded={false} onToggle={vi.fn()} />
    </DirectorySelectionContext.Provider></MemoryRouter>,
);
const row = (name: string) => screen.getByRole('button', { name: new RegExp(name) });

describe('the Browse area', () => {
    it('lists results as buttons that choose them, with no way to leave until one is chosen', () => {
        const value = selection();
        show(value);
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        fireEvent.click(row('Saburtalo Youth FC'));
        expect(value.choose).toHaveBeenCalledWith('2');
    });

    it('shows the chosen result with its title and one action in place of its detail and fact', () => {
        show(selection({ chosen: '2', selectedPin: 'p1' }));
        const open = screen.getByRole('link', { name: 'Open club: Saburtalo Youth FC' });
        expect(open).toHaveAttribute('href', '/clubs/2');
        expect(row('Saburtalo Youth FC')).toHaveAttribute('aria-current', 'true');
        expect(within(row('Saburtalo Youth FC')).queryByText('6.7 km away')).not.toBeInTheDocument();
        expect(within(row('Saburtalo Youth FC')).queryByText('Academy · Tbilisi')).not.toBeInTheDocument();
        // The other result on the same pin is lit softly and keeps its line; only one row ever opens.
        expect(row('Riverside Academy')).toHaveAttribute('data-at-pin', 'true');
        expect(within(row('Riverside Academy')).getByText('6.7 km away')).toBeInTheDocument();
        expect(screen.getAllByRole('link')).toHaveLength(1);
    });

    it('says when the chosen result is not on the map, once its place could have been found', () => {
        const { unmount } = show(selection({ chosen: '3', placing: true }));
        expect(within(row('Telavi Valley FC')).queryByText('Not on the map')).not.toBeInTheDocument();
        unmount();
        show(selection({ chosen: '3' }));
        expect(within(row('Telavi Valley FC')).getByText('Not on the map')).toBeInTheDocument();
    });

    it('lets Escape end the choice and puts focus back on the row', () => {
        const value = selection({ chosen: '2', selectedPin: 'p1' });
        show(value);
        const open = screen.getByRole('link', { name: 'Open club: Saburtalo Youth FC' });
        open.focus();
        fireEvent.keyDown(open, { key: 'Escape' });
        expect(value.clear).toHaveBeenCalled();
        expect(row('Saburtalo Youth FC')).toHaveFocus();
    });
});
