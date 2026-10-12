import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DirectorySearch } from '../directory/DirectorySearch';
import { DirectoryPage } from '../directory/DirectoryPage';
import { readQuery, useDirectoryState } from '../directory/useDirectoryState';
import type { DirectoryPage as DirectoryPageResult, DirectorySource } from '../directory/types';

const auth = vi.hoisted(() => ({ status: 'authenticated' as string }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: auth.status, sessionId: 'world', user: { id: 1 } }) }));

interface Row { id: number; name: string }
const rows = (from: number, count: number): Row[] => Array.from({ length: count }, (_, index) => ({ id: from + index, name: `Club ${from + index}` }));

function source(overrides: Partial<DirectorySource<Row>> = {}): DirectorySource<Row> {
    return {
        id: 'clubs', label: 'Clubs', noun: ['club', 'clubs'], searchLabel: 'Search clubs', searchPlaceholder: 'Search clubs', layout: 'rows', pageSize: 2,
        filters: [
            { kind: 'text', key: 'maxFee', label: 'Highest entry fee' },
            { kind: 'choice', key: 'currency', label: 'Fee currency', fallback: 'GEL', when: query => Boolean(query.values.maxFee?.[0]), options: [{ value: 'GEL', label: 'GEL' }, { value: 'USD', label: 'USD' }] },
            { kind: 'date', key: 'from', label: 'From' },
            { kind: 'date', key: 'to', label: 'Until' },
        ],
        load: vi.fn(async (_query, page) => ({ items: rows(page * 2 + 1, 2), total: 6, hasMore: page < 2 })),
        key: row => String(row.id),
        Item: ({ item }) => <li>{item.name}</li>,
        line: row => ({ title: row.name }),
        empty: { title: 'No clubs listed yet', body: 'Clubs appear here.' },
        ...overrides,
    };
}

function Where() {
    const location = useLocation();
    return <output data-testid="where">{location.pathname}{location.search}</output>;
}
function Go({ to, label }: { to: string | number; label: string }) {
    const navigate = useNavigate();
    return <button type="button" onClick={() => (typeof to === 'number' ? navigate(to) : navigate(to))}>{label}</button>;
}
const where = () => screen.getByTestId('where').textContent;

beforeEach(() => {
    auth.status = 'authenticated';
    sessionStorage.clear();
});

describe('reading a directory query', () => {
    it('gives a filter that does not apply no value, and a fallback only to filters that apply', () => {
        const clubs = source();
        expect(readQuery(clubs, new URLSearchParams('currency=USD')).query.values.currency).toEqual([]);
        expect(readQuery(clubs, new URLSearchParams('')).query.values.currency).toEqual([]);
        expect(readQuery(clubs, new URLSearchParams('maxFee=50')).query.values.currency).toEqual(['GEL']);
        expect(readQuery(clubs, new URLSearchParams('maxFee=50&currency=USD')).query.values.currency).toEqual(['USD']);
    });

    it('uses a remembered choice when the address has none, and counts it as active', () => {
        const remember = { read: () => '7', write: vi.fn() };
        const clubs = source({ filters: [{ kind: 'choice', key: 'player', label: 'Searching for', remember, options: [{ value: '7', label: 'Nino' }] }] });
        const { query, active } = readQuery(clubs, new URLSearchParams(''));
        expect(query.values.player).toEqual(['7']);
        expect(active.map(filter => filter.key)).toEqual(['player']);
        // A remembered child who is not one of the options is ignored.
        expect(readQuery(source({ filters: [{ kind: 'choice', key: 'player', label: 'Searching for', remember: { read: () => '9', write: vi.fn() }, options: [{ value: '7', label: 'Nino' }] }] }), new URLSearchParams('')).query.values.player).toEqual([]);
    });
});

describe('choosing the tab', () => {
    function Probe({ sources, signedIn = true, tabAlias }: { sources: DirectorySource<Row>[]; signedIn?: boolean; tabAlias?: string }) {
        const state = useDirectoryState(sources, { signedIn, tabAlias });
        return <><p>{state.source.id}</p><button type="button" onClick={() => state.setTab(sources[1].id)}>switch</button></>;
    }
    const a = source({ id: 'fixtures', signInReason: 'Members only.' }), b = source({ id: 'events' });

    it('opens guests on the first tab they can see without signing in', () => {
        render(<MemoryRouter initialEntries={['/world/matches']}><Probe sources={[a, b]} signedIn={false} /></MemoryRouter>);
        expect(screen.getByText('events')).toBeInTheDocument();
    });

    it('reads an older tab parameter and drops it when the tab changes', () => {
        render(<MemoryRouter initialEntries={['/world/opportunities?type=events']}><Probe sources={[a, b, source({ id: 'groups' })]} tabAlias="type" /><Where /></MemoryRouter>);
        expect(screen.getByText('events')).toBeInTheDocument();
        fireEvent.click(screen.getByText('switch'));
        expect(where()).toBe('/world/opportunities?tab=events');
    });
});

describe('the chosen result', () => {
    function Probe({ sources }: { sources: DirectorySource<Row>[] }) {
        const state = useDirectoryState(sources);
        return <>
            <button type="button" onClick={() => state.setSelected('3')}>choose</button>
            <button type="button" onClick={() => state.setSort('NAME')}>sort</button>
            <button type="button" onClick={() => state.setShown(2)}>more</button>
            <button type="button" onClick={() => state.setSearch('dinamo')}>search</button>
            <button type="button" onClick={() => state.setValues('maxFee', ['50'])}>filter</button>
            <button type="button" onClick={() => state.clearFilters()}>clear</button>
            <button type="button" onClick={() => state.setTab(sources[1].id)}>tab</button>
            <p data-testid="selected">{state.selected ?? '-'}</p>
        </>;
    }
    const chosen = () => screen.getByTestId('selected').textContent;

    it('stays in the address through sorting and showing more, and goes with a new search, filter, Clear or tab', () => {
        render(<MemoryRouter initialEntries={['/world/clubs']}><Probe sources={[source(), source({ id: 'hosts' })]} /><Where /></MemoryRouter>);
        fireEvent.click(screen.getByText('choose'));
        expect(where()).toBe('/world/clubs?selected=3');
        fireEvent.click(screen.getByText('sort'));
        fireEvent.click(screen.getByText('more'));
        expect(chosen()).toBe('3');
        for (const action of ['search', 'filter', 'clear', 'tab']) {
            fireEvent.click(screen.getByText('choose'));
            expect(chosen()).toBe('3');
            fireEvent.click(screen.getByText(action));
            expect(chosen()).toBe('-');
        }
    });
});

describe('where the list is (a day): not a filter', () => {
    const days = () => source({ filters: [
        { kind: 'date', key: 'day', label: 'Day', nav: true },
        { kind: 'choice', key: 'period', label: 'When', nav: true, options: [{ value: 'HISTORY', label: 'Results' }] },
        { kind: 'toggle', key: 'mine', label: 'My teams' },
    ] });
    function Probe({ sources }: { sources: DirectorySource<Row>[] }) {
        const state = useDirectoryState(sources);
        return <>
            <button type="button" onClick={() => state.go({ day: ['2026-10-13'], period: [] })}>day</button>
            <button type="button" onClick={() => state.go({ period: ['HISTORY'], day: [] })}>results</button>
            <button type="button" onClick={() => state.setSelected('3')}>choose</button>
            <button type="button" onClick={() => state.clearFilters()}>clear</button>
            <button type="button" onClick={() => state.setTab(sources[1].id)}>tab</button>
            <p data-testid="active">{state.activeFilters.map(filter => filter.key).join(',') || '-'}</p>
            <p data-testid="values">{JSON.stringify(state.query.values)}</p>
        </>;
    }

    it('reaches the list but is never an active, clearable filter', () => {
        const { query, active } = readQuery(days(), new URLSearchParams('day=2026-10-13&period=HISTORY&mine=true'));
        expect(query.values).toMatchObject({ day: ['2026-10-13'], period: ['HISTORY'], mine: ['true'] });
        expect(active.map(filter => filter.key)).toEqual(['mine']);
    });

    it('is written in one step with what it replaces, ends a choice, survives Clear filters and goes with the tab', () => {
        render(<MemoryRouter initialEntries={['/world/matches?period=HISTORY&mine=true']}><Probe sources={[days(), source({ id: 'events' })]} /><Where /></MemoryRouter>);
        fireEvent.click(screen.getByText('choose'));
        fireEvent.click(screen.getByText('day'));
        expect(where()).toBe('/world/matches?mine=true&day=2026-10-13');
        fireEvent.click(screen.getByText('results'));
        expect(where()).toBe('/world/matches?mine=true&period=HISTORY');
        expect(screen.getByTestId('active').textContent).toBe('mine');
        fireEvent.click(screen.getByText('clear'));
        expect(where()).toBe('/world/matches?period=HISTORY');
        fireEvent.click(screen.getByText('tab'));
        expect(where()).toBe('/world/matches?tab=events');
    });
});

describe('the search box', () => {
    function Search() {
        const location = useLocation();
        const q = new URLSearchParams(location.search).get('q') ?? '';
        const navigate = useNavigate();
        const state = { source: source(), query: { q, sort: '', values: {} }, setSearch: (value: string) => navigate(value ? `/world/clubs?q=${value}` : '/world/clubs', { replace: true }) };
        return <DirectorySearch state={state} delay={20} />;
    }
    const app = (path = '/world/clubs') => render(
        <MemoryRouter initialEntries={['/world', path]} initialIndex={1}>
            <Routes><Route path="*" element={<><Search /><Where /><Go to="/world/clubs?q=saburtalo" label="link" /><Go to="/world/clubs" label="nav" /><Go to={-1} label="back" /><Go to={1} label="forward" /></>} /></Routes>
        </MemoryRouter>,
    );
    const box = () => screen.getByRole('searchbox', { name: 'Search clubs' }) as HTMLInputElement;

    it('commits typed text after a pause', async () => {
        app();
        fireEvent.change(box(), { target: { value: 'dinamo ' } });
        await waitFor(() => expect(where()).toBe('/world/clubs?q=dinamo'));
        // The trailing space the person is still typing stays in the box.
        expect(box().value).toBe('dinamo ');
    });

    it('follows a link or the World navigation instead of writing old text back', async () => {
        app('/world/clubs?q=riverside');
        expect(box().value).toBe('riverside');
        fireEvent.click(screen.getByText('link'));
        expect(box().value).toBe('saburtalo');
        fireEvent.click(screen.getByText('nav'));
        expect(box().value).toBe('');
        await new Promise(resolve => setTimeout(resolve, 60));
        expect(where()).toBe('/world/clubs');
    });

    it('restores the search of each history entry on Back and Forward', async () => {
        app('/world/clubs?q=riverside');
        fireEvent.click(screen.getByText('link'));
        fireEvent.click(screen.getByText('back'));
        await waitFor(() => expect(box().value).toBe('riverside'));
        fireEvent.click(screen.getByText('forward'));
        await waitFor(() => expect(box().value).toBe('saburtalo'));
        await new Promise(resolve => setTimeout(resolve, 60));
        expect(where()).toBe('/world/clubs?q=saburtalo');
    });
});

describe('the directory page', () => {
    const page = (path: string, sources: DirectorySource<Row>[]) => render(
        <MemoryRouter initialEntries={[path]}><DirectoryPage title="Clubs" subtitle="All clubs" sources={sources} /><Where /></MemoryRouter>,
    );

    it('keeps the number of pages shown in the address and loads them all again', async () => {
        const clubs = source();
        const first = page('/world/clubs', [clubs]);
        expect(await screen.findByText('Club 2')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Show more clubs' }));
        expect(await screen.findByText('Club 4')).toBeInTheDocument();
        await waitFor(() => expect(where()).toBe('/world/clubs?shown=2'));
        first.unmount();

        const again = source();
        page('/world/clubs?shown=2', [again]);
        expect(await screen.findByText('Club 4')).toBeInTheDocument();
        expect(vi.mocked(again.load).mock.calls.map(call => call[1])).toEqual([0, 1]);
    });

    it('starts a new search on the first page', async () => {
        const clubs = source();
        page('/world/clubs?shown=3&maxFee=20', [clubs]);
        expect(await screen.findByText('Club 6')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
        await waitFor(() => expect(where()).toBe('/world/clubs'));
    });

    it('says when an end date is before the start date instead of searching', async () => {
        const clubs = source();
        page('/world/clubs?from=2026-10-20&to=2026-10-01', [clubs]);
        expect(await screen.findByText('The end date is before the start date. Change one of them to search.')).toBeInTheDocument();
        expect(clubs.load).not.toHaveBeenCalled();
    });

    it('shows a source notice instead of results', async () => {
        page('/world/clubs', [source({ load: async () => ({ items: [], total: null, hasMore: false, notice: 'Not available yet.' }) })]);
        expect(await screen.findByText('Not available yet.')).toBeInTheDocument();
        expect(screen.queryByText('No clubs listed yet')).not.toBeInTheDocument();
    });

    it('shows guests the reason and a sign-in action without a search box', async () => {
        auth.status = 'unauthenticated';
        const gated = source({ signInReason: 'Clubs are visible to members.' });
        page('/world/clubs', [gated]);
        expect(screen.getByText('Clubs are visible to members.')).toBeInTheDocument();
        expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
        expect(gated.load).not.toHaveBeenCalled();
    });

    it('refreshes a live list quietly when the window regains focus, keeping the pages shown', async () => {
        let score = '0 – 0';
        const live = source({ refreshMs: 60_000, load: vi.fn(async (_query, page) => ({ items: page === 0 ? [{ id: 1, name: `Dinamo ${score}` }] : [{ id: 2, name: 'Second page' }], total: 2, hasMore: page === 0 })) });
        page('/world/clubs?shown=2', [live]);
        expect(await screen.findByText('Dinamo 0 – 0')).toBeInTheDocument();
        expect(screen.getByText('Second page')).toBeInTheDocument();
        score = '1 – 0';
        act(() => { window.dispatchEvent(new Event('focus')); });
        expect(await screen.findByText('Dinamo 1 – 0')).toBeInTheDocument();
        expect(screen.getByText('Second page')).toBeInTheDocument();
        expect(screen.queryByRole('status', { name: /Loading/ })).not.toBeInTheDocument();
    });

    it('never shows an older search as current', async () => {
        let release: (value: { items: Row[]; total: number; hasMore: boolean }) => void = () => {};
        const slow = source({
            load: vi.fn((query): Promise<DirectoryPageResult<Row>> => query.q === 'din'
                ? new Promise(resolve => { release = resolve; })
                : Promise.resolve({ items: [{ id: 9, name: 'Dinamo Tbilisi' }], total: 1, hasMore: false })),
        });
        render(<MemoryRouter initialEntries={['/world/clubs?q=din']}><DirectoryPage title="Clubs" subtitle="" sources={[slow]} /><Go to="/world/clubs?q=dinamo" label="refine" /></MemoryRouter>);
        fireEvent.click(screen.getByText('refine'));
        expect(await screen.findByText('Dinamo Tbilisi')).toBeInTheDocument();
        await act(async () => release({ items: [{ id: 1, name: 'Old result' }], total: 1, hasMore: false }));
        expect(screen.queryByText('Old result')).not.toBeInTheDocument();
    });
});
