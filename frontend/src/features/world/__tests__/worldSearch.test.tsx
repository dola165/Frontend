import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { fetchClubDirectory } from '../api';
import { WorldSearch } from '../front/WorldSearch';

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: 'unauthenticated', sessionId: 'world', user: null }) }));
vi.mock('../api', () => ({ fetchClubDirectory: vi.fn(), fetchPeople: vi.fn() }));
vi.mock('../../venues/api', () => ({ fetchVenues: vi.fn(async () => ({ content: [] })) }));
vi.mock('../../competitions/api', () => ({ browseCompetitions: vi.fn(async () => ({ content: [] })), structureLabels: {} }));
vi.mock('../../matchHistory/api', () => ({ getMatchHistory: vi.fn() }));
vi.mock('../../tryouts/api', () => ({ searchTryouts: vi.fn(async () => ({ items: [] })) }));

const clubs: Record<string, { id: number; name: string }> = { ri: { id: 3, name: 'Riverside Academy' }, saburtalo: { id: 4, name: 'Saburtalo Youth' } };

function Where() {
    const location = useLocation();
    return <output data-testid="where">{location.pathname}</output>;
}
const show = () => render(
    <MemoryRouter initialEntries={['/world']}>
        <Routes><Route path="/world" element={<WorldSearch />} /><Route path="*" element={<Where />} /></Routes>
    </MemoryRouter>,
);
const box = () => screen.getByRole('searchbox', { name: 'Search GrassKickZ World' });

beforeEach(() => {
    vi.mocked(fetchClubDirectory).mockReset();
    vi.mocked(fetchClubDirectory).mockImplementation(async params => {
        const club = clubs[params.get('search') ?? ''];
        // The newer search answers more slowly, so stale results are on screen when Enter is pressed.
        if (params.get('search') === 'saburtalo') await new Promise(resolve => setTimeout(resolve, 80));
        return { content: club ? [{ ...club, type: 'ACADEMY', cityName: 'Tbilisi' }] : [], pageNumber: 0, pageSize: 4, totalElements: club ? 1 : 0, totalPages: 1 } as never;
    });
});

it('opens the first result of what was typed, even when older results are still on screen', async () => {
    show();
    fireEvent.change(box(), { target: { value: 'ri' } });
    expect(await screen.findByText('Riverside Academy')).toBeInTheDocument();
    fireEvent.change(box(), { target: { value: 'saburtalo' } });
    fireEvent.keyDown(box(), { key: 'Enter' });
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/clubs/4'), { timeout: 2000 });
});

it('opens the first result at once when the results are for the typed text', async () => {
    show();
    fireEvent.change(box(), { target: { value: 'ri' } });
    expect(await screen.findByText('Riverside Academy')).toBeInTheDocument();
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(screen.getByTestId('where').textContent).toBe('/clubs/3');
});

it('does nothing on Enter when the typed text has no results', async () => {
    show();
    fireEvent.change(box(), { target: { value: 'zz' } });
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(await screen.findByText(/match “zz”/)).toBeInTheDocument();
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
});
