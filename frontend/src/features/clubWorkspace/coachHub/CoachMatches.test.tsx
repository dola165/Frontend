import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import type { Match } from '../../matchExchange/api';
import type { CoachData } from './CoachWorkspace';
import { CoachMatches } from './CoachMatches';

// What the page reads, each answering as the test says: the arrange check, the signed-in person, the match history,
// the club's listings and the results waiting.
const allowed = vi.hoisted(() => ({ answer: { pending: true, subject: null as `squad:${number}` | null } }));
const listings = vi.hoisted(() => ({ items: [] as unknown[], fetch: null as null | ((params: URLSearchParams) => Promise<{ items: unknown[]; total: number }>) }));
vi.mock('../../../hooks/useCan', () => ({ useFirstAllowed: () => allowed.answer }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 9 }, sessionId: 'fixture' }) }));
vi.mock('../../matchHistory/api', () => ({ getMatchHistory: async () => ({ items: [], total: 0, page: 0, pageSize: 100 }) }));
vi.mock('../../world/api', () => ({ fetchMatchListings: async (params: URLSearchParams) => listings.fetch ? listings.fetch(params) : ({ items: listings.items, total: listings.items.length }) }));
vi.mock('../../actions/useResultsWaiting', () => ({ useResultsWaiting: () => [], refreshResultsWaiting: () => undefined }));
// The one Arrange a match door, as the rule-checker would show it.
vi.mock('../../actions/ActionButton', () => ({ ActionButton: ({ subject }: { subject: { id: number } }) => <a href={`?do=arrange_match&do-squad=${subject.id}`}>Arrange a match</a> }));

afterEach(() => { cleanup(); listings.fetch = null; });
const data = { clubId: 1, clubName: 'Club', clubLogo: null, now: Date.parse('2026-10-29T10:00:00Z'), focus: null, shown: [103, 105], cards: new Map(), cardsFailed: [],
    mine: [{ id: 103, name: 'U14 Boys' }, { id: 105, name: 'U16 Boys' }], names: new Map([[103, 'U14 Boys'], [105, 'U16 Boys']]), refresh: vi.fn(), retryCards: vi.fn() } as unknown as CoachData;
const show = () => render(<MemoryRouter initialEntries={['/my-squads?tab=matches']}><CoachMatches data={data} /></MemoryRouter>);

it('offers Arrange a match and Add a past match only once the answer is in, for the first squad shown that allows it', async () => {
    show();
    expect(screen.queryByRole('link', { name: 'Arrange a match' })).not.toBeInTheDocument();
    cleanup();
    allowed.answer = { pending: false, subject: 'squad:105' };
    show();
    expect((await screen.findAllByRole('link', { name: 'Arrange a match' }))[0]).toHaveAttribute('href', '?do=arrange_match&do-squad=105');
    expect(screen.getByRole('button', { name: 'Add a past match' })).toBeInTheDocument();
    cleanup();
    allowed.answer = { pending: false, subject: null };
    show();
    expect(screen.queryByRole('link', { name: 'Arrange a match' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a past match' })).not.toBeInTheDocument();
});

it('lists the club’s open challenges and an invitation waiting for our answer, each opening the match in the squad’s context', async () => {
    const at = (days: number) => new Date(Date.parse('2026-10-29T10:00:00Z') + days * 86_400_000).toISOString();
    listings.items = [
        { event_id: 71, club_id: 1, squad_id: 105, squad_name: 'U16 Boys', club_name: 'Club', title: 'U16 Boys open challenge', listing_status: 'OPEN', starts_at_iso: at(2), ends_at_iso: at(3), window_from: '10:00:00', window_to: '14:00:00', match_minutes: 90, starts_at: '2026-10-31T10:00:00', ends_at: '2026-11-01T14:00:00' },
        { event_id: 72, club_id: 4, squad_id: 404, squad_name: 'U14', club_name: 'Saburtalo', title: 'Saburtalo U14 v U14 Boys', listing_status: 'OPEN', requested_club_id: 1, requested_squad_id: 103, can_respond: true, starts_at_iso: at(4), ends_at_iso: at(4.1) },
        { event_id: 73, club_id: 1, squad_id: 101, squad_name: 'First Team', club_name: 'Club', title: 'Not a squad shown', listing_status: 'OPEN', starts_at_iso: at(5), ends_at_iso: at(5.1) },
    ] as Partial<Match>[];
    allowed.answer = { pending: false, subject: 'squad:105' };
    show();
    const invitation = await screen.findByRole('link', { name: /Saburtalo U14 v U14 Boys/ });
    expect(invitation).toHaveAttribute('href', '/matches/72?from=squad%3A103');
    expect(invitation).toHaveTextContent('Your answer');
    expect(screen.getByRole('link', { name: /U16 Boys open challenge/ })).toHaveAttribute('href', '/matches/71?from=squad%3A105');
    expect(screen.queryByText('Not a squad shown')).not.toBeInTheDocument();
});

it('asks for every match still to answer, page by page, so a long history never hides one (fix round 1)', async () => {
    const at = (days: number) => new Date(Date.parse('2026-10-29T10:00:00Z') + days * 86_400_000).toISOString();
    const challenge = (id: number) => ({ event_id: id, club_id: 1, squad_id: 105, squad_name: 'U16 Boys', club_name: 'Club', title: `Open ${id}`, listing_status: 'OPEN', starts_at_iso: at(2), ends_at_iso: at(2.1) });
    const asked: URLSearchParams[] = [];
    listings.fetch = async params => {
        asked.push(params);
        return params.get('page') === '0' ? { items: Array.from({ length: 24 }, (_, i) => challenge(100 + i)), total: 25 }
            : { items: [{ event_id: 72, club_id: 4, squad_id: 404, squad_name: 'U14', club_name: 'Saburtalo', title: 'Saburtalo U14 v U14 Boys', listing_status: 'OPEN', requested_club_id: 1, requested_squad_id: 103, can_respond: true, starts_at_iso: at(9), ends_at_iso: at(9.1) }], total: 25 };
    };
    allowed.answer = { pending: false, subject: 'squad:105' };
    show();
    expect(await screen.findByRole('link', { name: /Saburtalo U14 v U14 Boys/ })).toHaveTextContent('Your answer');
    expect(asked.map(params => [params.get('mine'), params.get('active'), params.get('page')])).toEqual([['true', 'true', '0'], ['true', 'true', '1']]);
});

it('says so, with Try again, when the matches still to answer can’t load: never “nothing to answer”', async () => {
    let fail = true;
    listings.fetch = async () => { if (fail) throw new Error('Network Error'); return { items: [], total: 0 }; };
    allowed.answer = { pending: false, subject: 'squad:105' };
    show();
    expect(await screen.findByText('Open challenges and invitations · Couldn’t load')).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Coming up');
    expect(screen.queryByText('Open challenges and invitations · Couldn’t load')).not.toBeInTheDocument();
});
