import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { searchOpportunities } from '../../admissions/api';
import type { Participant } from '../../admissions/types';
import { eventSearch } from '../../requests/api';
import { groupsSource } from '../directories/opportunitySources';
import { events } from '../directories/matchSources';
import { LegacyMatchesRedirect, WorldRedirect } from '../WorldRedirect';
import type { DirectoryQuery, LoadContext } from '../directory/types';

vi.mock('../../admissions/api', () => ({ searchOpportunities: vi.fn() }));
vi.mock('../../requests/api', async original => ({ ...await original<typeof import('../../requests/api')>(), eventSearch: vi.fn() }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated', sessionId: 'world', user: { id: 1, navigationCapabilities: undefined } }) }));

const context: LoadContext = { signal: new AbortController().signal, sessionId: 'world', authenticated: true };
const query = (values: Record<string, string>, q = ''): DirectoryQuery => ({ q, sort: '', values: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, [value]])) });
const child: Participant = { id: 101, name: 'Nino', dateOfBirth: '2018-04-02', minor: true, guardian: true, provenance: null, gender: 'FEMALE' };

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchOpportunities).mockResolvedValue({ items: [], total: 0, page: 0, size: 20, hasMore: false } as never);
    vi.mocked(eventSearch).mockResolvedValue({ items: [], total: 41, hasMore: true });
});

it('searches training groups for the chosen child by birth year and category, keeping waiting lists optional', async () => {
    const source = groupsSource([child]);
    expect(source.filters.find(filter => filter.key === 'player')).toBeTruthy();
    await source.load(query({ player: '101', includeWaitlist: 'true', club: '4' }), 0, context);
    expect(searchOpportunities).toHaveBeenLastCalledWith(expect.objectContaining({ birthYear: 2018, gender: 'FEMALE', acceptingOnly: true, includeWaitlist: true, clubId: 4, page: 0 }), context.signal);
});

it('offers no child choice to someone searching only for themselves', () => {
    expect(groupsSource([{ ...child, minor: false, guardian: false }]).filters.some(filter => filter.key === 'player')).toBe(false);
});

it('asks the server for the requested page of events rather than filtering the first', async () => {
    const page = await events.load(query({ activity: 'TRYOUT', location: 'Tbilisi' }, 'დინამო'), 1, context);
    expect(eventSearch).toHaveBeenCalledWith(expect.objectContaining({ q: 'დინამო', activity: 'TRYOUT', location: 'Tbilisi', page: 1, size: 20 }), 'world', context.signal);
    expect(page).toEqual({ items: [], total: 41, hasMore: true });
});

function Where() {
    const location = useLocation();
    return <p>{location.pathname}{location.search}{location.hash}</p>;
}
const visit = (path: string, element: ReactNode) => render(
    <MemoryRouter initialEntries={[path]}><Routes><Route path={path.split('?')[0]} element={element} /><Route path="*" element={<Where />} /></Routes></MemoryRouter>,
);

it.each([
    ['/matches', 'hub', '/world/matches'],
    ['/matches?section=find&tab=mine', 'hub', '/world/matches?tab=mine'],
    ['/match-exchange?format=SEVEN_A_SIDE', 'exchange', '/world/matches?format=SEVEN_A_SIDE&tab=exchange'],
    ['/match-exchange?tab=referees&q=gff', 'exchange', '/world/people?q=gff&role=REFEREE'],
    ['/match-history?clubId=1', 'history', '/world/matches?clubId=1&period=HISTORY'],
    ['/matches?section=competitions&view=hosts&kind=CLUB&host=4', 'hub', '/world/competitions?host=CLUB%3A4'],
    ['/tournaments?view=invitations', 'competitions', '/world/competitions?tab=invitations'],
] as const)('sends %s to its World page', (path, kind, expected) => {
    visit(path, <LegacyMatchesRedirect kind={kind} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
});

it('renames old club directory keys and keeps the rest of the search', () => {
    visit('/clubs?search=dinamo&type=ACADEMY', <WorldRedirect to="/world/clubs" rename={{ search: 'q' }} />);
    expect(screen.getByText('/world/clubs?type=ACADEMY&q=dinamo')).toBeInTheDocument();
});
