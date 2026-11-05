import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter, Link, MemoryRouter, useLocation, useNavigationType } from 'react-router-dom';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClubProfile } from '../../../components/discovery/clubDirectoryTypes';
import type { AdmissionCase, FirstVisitSessions, Opportunity } from '../../admissions/types';
import type { TrainingProgramme } from '../../clubs/presentation';
import type { JoiningChild } from '../../joining-contract/types';
import { FinderContext, FINDER_OPENED } from './finderContext';

/** Step 5, fix round 1 (Codex's review): the finder's findings, each failing without its fix. */
const world = vi.hoisted(() => ({ child: null as null | { id: number; name: string; dateOfBirth: string; gender: 'MALE' | 'FEMALE' | null } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'parent-session', status: 'authenticated' }) }));
vi.mock('../../squadCommunication/journeyCopy', () => ({ useJourneyCopy: () => ((en: string) => en) }));
vi.mock('../players', () => ({ useWorldChild: () => ({ child: world.child, pending: false }) }));
vi.mock('../../parents/AddChild', () => ({ AddChild: () => <p>Add child form</p> }));
vi.mock('../../admissions/api', () => ({ fetchFirstVisits: vi.fn(), bookFirstVisit: vi.fn(), savePlayerIdentity: vi.fn(), searchOpportunities: vi.fn(), fetchOpportunity: vi.fn() }));
vi.mock('../../tryouts/api', () => ({ searchTryouts: vi.fn() }));
vi.mock('../api', () => ({ fetchClubProfile: vi.fn() }));
vi.mock('../../joining-contract/api', () => ({ submitClubEnquiry: vi.fn() }));
vi.mock('../directories/ClubsDirectory', () => ({ default: () => <p>Club list</p> }));
vi.mock('../stage/WorldStage', () => ({ WorldStage: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('../WorldSessionProvider', () => ({ WorldSessionProvider: ({ children }: { children: ReactNode }) => <>{children}</> }));

import * as admissions from '../../admissions/api';
import { searchTryouts } from '../../tryouts/api';
import { fetchClubProfile } from '../api';
import { submitClubEnquiry } from '../../joining-contract/api';
import { BookFirstVisit } from './BookFirstVisit';
import { FinderClub } from './FinderClub';
import { FinderNamedGroup } from './FinderNamedGroup';
import { AskTheClub } from './AskTheClub';
import ClubFinder from './ClubFinder';

const boys = { id: 31, organizationId: 4, clubId: 1, organizationName: 'Dinamo', name: 'U12 Boys', birthYearFrom: 2014, birthYearTo: 2015, gender: 'MALE', squadId: 160, availability: 'AVAILABLE',
    schedule: 'Tue, Thu 17:00', location: { name: 'Rustavi ground', address: 'Rustavi', latitude: null, longitude: null }, terms: { feesKnown: true, charges: [] }, firstVisits: { places: 3, fee: null, currency: null } } as unknown as Opportunity;
const kid = (playerId: number, name: string, gender: 'MALE' | 'FEMALE' | null, dateOfBirth = '2014-05-02'): JoiningChild => ({ playerId, identity: { playerId, version: 4, fullName: name, dateOfBirth, gender,
    photoUrl: null, positions: ['CM'], dominantFoot: 'LEFT', heightCm: 140, weightKg: null, canEdit: true, minor: true }, clubs: [], cases: [], inquiries: [] });
const offer = (over: Partial<FirstVisitSessions> = {}): FirstVisitSessions => ({ groupId: 31, groupVersion: 6, places: 3, fee: null, currency: null, timezone: 'Asia/Tbilisi',
    sessions: [{ reference: 'time:1793440800', sessionId: null, startsAt: '2026-11-01T07:00:00Z', endsAt: '2026-11-01T08:30:00Z', place: 'Rustavi ground', placesLeft: 2 }], ...over });
const booking = (status: 'CONFIRMED' | 'INVITED') => ({ id: 77, playerId: 61, playerName: 'Saba Beridze', sessions: [{ id: 5, status, startsAt: '2026-11-01T07:00:00Z', endsAt: '2026-11-01T08:30:00Z',
    location: { name: 'Rustavi ground' }, cost: 'Free' }] }) as unknown as AdmissionCase;
const club = { id: 1, name: 'Dinamo Academy', cityName: 'Rustavi', logoUrl: null, whatsappNumber: null, addressText: null, latitude: null, longitude: null } as unknown as ClubProfile;
const changed = vi.fn();
const inFinder = (node: ReactNode, family: JoiningChild[] = []) => render(<MemoryRouter><FinderContext.Provider value={{ family, changed }}>{node}</FinderContext.Provider></MemoryRouter>);
const conflict = (code: string) => Object.assign(new Error(code), { response: { status: 409, data: { code, message: code } } });

beforeEach(() => { world.child = { id: 61, name: 'Saba Beridze', dateOfBirth: '2014-05-02', gender: null }; vi.mocked(admissions.fetchFirstVisits).mockResolvedValue(offer()); });
afterEach(() => { cleanup(); vi.clearAllMocks(); sessionStorage.clear(); });

describe('booking a first visit', () => {
    it('S9: keeps a child with no gender declared and asks for it in the booking, through the card’s versioned update', async () => {
        vi.mocked(admissions.savePlayerIdentity).mockResolvedValue({ ...kid(61, 'Saba Beridze', 'MALE').identity, version: 5 });
        vi.mocked(admissions.bookFirstVisit).mockResolvedValue(booking('CONFIRMED'));
        inFinder(<BookFirstVisit group={boys} onClose={vi.fn()} />, [kid(61, 'Saba Beridze', null)]);
        const book = await screen.findByRole('button', { name: 'Book for Saba' });
        expect(screen.queryByText('Add the child')).not.toBeInTheDocument();
        // Nothing is guessed: the question waits for an answer.
        expect(book).toBeDisabled();
        const question = screen.getByRole('radiogroup', { name: 'Is Saba a boy or a girl?' });
        expect(within(question).getByRole('button', { name: 'Boy' })).toHaveAttribute('aria-pressed', 'false');
        fireEvent.click(within(question).getByRole('button', { name: 'Boy' }));
        fireEvent.click(book);
        await screen.findByText(/^Booked/);
        expect(admissions.savePlayerIdentity).toHaveBeenCalledWith(61, expect.objectContaining({ expectedVersion: 4, gender: 'MALE', fullName: 'Saba Beridze', dateOfBirth: '2014-05-02', positions: ['CM'], dominantFoot: 'LEFT', heightCm: 140 }), 'parent-session');
        expect(vi.mocked(admissions.savePlayerIdentity).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(admissions.bookFirstVisit).mock.invocationCallOrder[0]);
    });

    it('S9: a declaration that doesn’t fit the group is saved but books nothing', async () => {
        vi.mocked(admissions.savePlayerIdentity).mockResolvedValue({ ...kid(61, 'Saba Beridze', 'FEMALE').identity, version: 5 });
        inFinder(<BookFirstVisit group={boys} onClose={vi.fn()} />, [kid(61, 'Saba Beridze', null)]);
        fireEvent.click(await screen.findByRole('button', { name: 'Girl' }));
        fireEvent.click(screen.getByRole('button', { name: 'Book for Saba' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('This group is for boys.');
        expect(admissions.bookFirstVisit).not.toHaveBeenCalled();
    });

    it('S2 and S1: carries the terms and the training it showed (a times-only timetable has no session id), and shows what changed', async () => {
        vi.mocked(admissions.bookFirstVisit).mockRejectedValueOnce(conflict('TERMS_CHANGED')).mockResolvedValue(booking('CONFIRMED'));
        inFinder(<BookFirstVisit group={boys} onClose={vi.fn()} />, [kid(61, 'Saba Beridze', 'MALE')]);
        fireEvent.click(await screen.findByRole('button', { name: 'Book for Saba' }));
        expect(admissions.bookFirstVisit).toHaveBeenCalledWith(31, expect.objectContaining({ playerId: 61, session: 'time:1793440800', groupVersion: 6,
            startsAt: '2026-11-01T07:00:00Z', endsAt: '2026-11-01T08:30:00Z', place: 'Rustavi ground' }), 'parent-session');
        const first = vi.mocked(admissions.bookFirstVisit).mock.calls[0][1];
        // The club now charges for it: nothing was booked, and the change is shown before booking again.
        vi.mocked(admissions.fetchFirstVisits).mockResolvedValue(offer({ groupVersion: 7, fee: 20, currency: 'GEL' }));
        const notice = await screen.findByText('The club changed this visit. Check it and book again.');
        await waitFor(() => expect(notice.closest('[role=alert]')).toHaveTextContent('Price: 20 GEL, was Free'));
        expect(screen.queryByText(/^Booked/)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Book for Saba' }));
        await screen.findByText(/^Booked/);
        const second = vi.mocked(admissions.bookFirstVisit).mock.calls[1][1];
        expect(second).toMatchObject({ groupVersion: 7 });
        expect(second.requestId).not.toBe(first.requestId);
    });

    it('S2: a training that moved is named with its old and new time', async () => {
        vi.mocked(admissions.bookFirstVisit).mockRejectedValueOnce(conflict('SESSION_CHANGED'));
        const moved = offer({ sessions: [{ reference: 'session:12', sessionId: 12, startsAt: '2026-11-01T07:00:00Z', endsAt: '2026-11-01T08:30:00Z', place: 'Rustavi ground', placesLeft: 2 }] });
        vi.mocked(admissions.fetchFirstVisits).mockResolvedValueOnce(moved);
        inFinder(<BookFirstVisit group={boys} onClose={vi.fn()} />, [kid(61, 'Saba Beridze', 'MALE')]);
        vi.mocked(admissions.fetchFirstVisits).mockResolvedValue(offer({ sessions: [{ ...moved.sessions[0], startsAt: '2026-11-01T08:00:00Z', endsAt: '2026-11-01T09:30:00Z', place: 'Vake pitch 2' }] }));
        fireEvent.click(await screen.findByRole('button', { name: 'Book for Saba' }));
        await waitFor(() => expect(screen.getByText(/^Training: /)).toHaveTextContent(/Vake pitch 2, was .* · Rustavi ground/));
    });

    it('S21: a group needing the current club’s permission is reserved, not booked', async () => {
        vi.mocked(admissions.bookFirstVisit).mockResolvedValue(booking('INVITED'));
        inFinder(<BookFirstVisit group={boys} onClose={vi.fn()} />, [kid(61, 'Saba Beridze', 'MALE')]);
        fireEvent.click(await screen.findByRole('button', { name: 'Book for Saba' }));
        const done = await screen.findByRole('status');
        expect(done).toHaveTextContent(/^Reserved · /);
        expect(done).toHaveTextContent('The club confirms after its checks');
        expect(done).not.toHaveTextContent(/^Booked/);
    });

    it.each([false, true])('S2: a stale times-only reference refreshes availability and explains the withdrawn training (empty=%s)', async empty => {
        vi.mocked(admissions.bookFirstVisit).mockRejectedValueOnce(conflict('SESSION_UNAVAILABLE')).mockResolvedValue(booking('CONFIRMED'));
        const old = offer();
        vi.mocked(admissions.fetchFirstVisits).mockResolvedValueOnce(old);
        inFinder(<BookFirstVisit group={boys} onClose={vi.fn()} />, [kid(61, 'Saba Beridze', 'MALE')]);
        const book = await screen.findByRole('button', { name: 'Book for Saba' });
        const next = { ...old.sessions[0], reference: 'time:1793444400', startsAt: '2026-11-01T08:00:00Z', endsAt: '2026-11-01T09:30:00Z' };
        vi.mocked(admissions.fetchFirstVisits).mockResolvedValue(offer({ sessions: empty ? [] : [next] }));
        fireEvent.click(book);
        expect(await screen.findByText(/The training on .* is no longer offered/)).toBeInTheDocument();
        expect(admissions.fetchFirstVisits).toHaveBeenCalledTimes(2);
        if (empty) {
            expect(screen.getByText('No first visits in the next four weeks. Ask the club instead.')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Book for Saba' })).toBeDisabled();
        } else {
            fireEvent.click(screen.getByRole('button', { name: 'Book for Saba' }));
            await screen.findByText(/^Booked/);
            expect(vi.mocked(admissions.bookFirstVisit).mock.calls[1][1]).toMatchObject({ session: next.reference, startsAt: next.startsAt, endsAt: next.endsAt });
            expect(vi.mocked(admissions.bookFirstVisit).mock.calls[1][1].requestId).not.toBe(vi.mocked(admissions.bookFirstVisit).mock.calls[0][1].requestId);
        }
    });

    it('S20: a failed load of the trainings offers Try again, which loads them', async () => {
        vi.mocked(admissions.fetchFirstVisits).mockRejectedValueOnce(Object.assign(new Error('down'), { response: { status: 503 } }));
        inFinder(<BookFirstVisit group={boys} onClose={vi.fn()} />, [kid(61, 'Saba Beridze', 'MALE')]);
        fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
        expect(await screen.findByRole('radiogroup', { name: 'Choose a training' })).toBeInTheDocument();
        expect(admissions.fetchFirstVisits).toHaveBeenCalledTimes(2);
    });
});

describe('the club inside the finder', () => {
    beforeEach(() => { vi.mocked(searchTryouts).mockResolvedValue({ items: [] } as never); });

    it('S20: a failed groups or tryouts load says so with Try again, never that the club lists nothing', async () => {
        vi.mocked(admissions.searchOpportunities).mockRejectedValueOnce(Object.assign(new Error('down'), { response: { status: 503 } })).mockResolvedValue({ items: [boys] } as never);
        vi.mocked(searchTryouts).mockRejectedValueOnce(Object.assign(new Error('down'), { response: { status: 503 } }));
        inFinder(<FinderClub club={club} />);
        expect(await screen.findByText('Couldn’t load the club’s groups')).toBeInTheDocument();
        expect(screen.getByText('Couldn’t load the tryouts')).toBeInTheDocument();
        expect(screen.queryByText(/No group lists a place/)).not.toBeInTheDocument();
        fireEvent.click(within(screen.getByText('Couldn’t load the club’s groups').closest('p')!).getByRole('button', { name: 'Try again' }));
        expect(await screen.findByRole('region', { name: 'Boys' })).toBeInTheDocument();
    });

    it('layer 1 walk p3: a club with no groups set up for joining still offers Join, the club page’s My child with this child chosen', async () => {
        vi.mocked(admissions.searchOpportunities).mockResolvedValue({ items: [] } as never);
        inFinder(<FinderClub club={club} />);
        expect(await screen.findByText(/No group lists a place for Saba/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Join' })).toHaveAttribute('href', '/clubs/1?join=child&player=61');
    });

    it('S14: a group reads as the club’s own name without its age code, the birth years beside it', async () => {
        vi.mocked(admissions.searchOpportunities).mockResolvedValue({ items: [boys, { ...boys, id: 32, name: 'U10' , birthYearFrom: 2016, birthYearTo: 2017 }] } as never);
        inFinder(<FinderClub club={club} />);
        const group = await screen.findByRole('region', { name: 'Boys' });
        expect(within(group).getByText('Boys')).toBeInTheDocument();
        expect(within(group).getByText('born 2014–2015')).toBeInTheDocument();
        expect(screen.queryByText(/U12/)).not.toBeInTheDocument();
        // A name that is only a code gives way to the birth years.
        expect(screen.getByText('Born 2016–2017')).toBeInTheDocument();
        expect(screen.queryByText('U10')).not.toBeInTheDocument();
    });

    it('S10: a link’s group opens with its club above the list, closed or outside the six listed', async () => {
        vi.mocked(admissions.fetchOpportunity).mockResolvedValue({ ...boys, id: 44, name: 'Girls Saturday', gender: 'FEMALE', availability: 'CLOSED' });
        vi.mocked(fetchClubProfile).mockResolvedValue(club);
        vi.mocked(admissions.searchOpportunities).mockResolvedValue({ items: [boys] } as never);
        render(<MemoryRouter initialEntries={['/parent?player=61&find=club&group=44']}><FinderContext.Provider value={{ family: [], changed }}><FinderNamedGroup /></FinderContext.Provider></MemoryRouter>);
        const named = await screen.findByRole('region', { name: 'Dinamo Academy' });
        expect(admissions.fetchOpportunity).toHaveBeenCalledWith(44, expect.anything());
        expect(fetchClubProfile).toHaveBeenCalledWith(1, expect.anything());
        expect(await within(named).findByRole('region', { name: 'Girls Saturday' })).toBeInTheDocument();
        expect(within(named).getByRole('region', { name: 'Boys' })).toBeInTheDocument();
    });
});

describe('asking the club from World', () => {
    it('S15: carries the programme it is about (and its one squad), and the parent may choose another', async () => {
        vi.mocked(submitClubEnquiry).mockResolvedValue({ conversationDestination: null } as never);
        const programmes = [{ id: 12, name: 'Foundation (U8–U10)', squadIds: [160] }, { id: 13, name: 'Evening group', squadIds: [161, 162] }] as TrainingProgramme[];
        inFinder(<AskTheClub club={club} group={null} programmes={programmes} onClose={vi.fn()} />);
        expect(screen.getByRole('textbox')).toHaveValue('Hello, my child Saba was born in 2014. Is there a place in Foundation?');
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));
        await screen.findByText('Sent to the club');
        expect(submitClubEnquiry).toHaveBeenCalledWith(1, expect.objectContaining({ playerId: 61, programmeId: 12, squadId: 160, groupId: null }), 'parent-session');
        cleanup();
        inFinder(<AskTheClub club={club} group={null} programmes={programmes} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Evening group' }));
        expect(screen.getByRole('textbox')).toHaveValue('Hello, my child Saba was born in 2014. Is there a place in Evening group?');
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));
        await screen.findByText('Sent to the club');
        // Several squads: the club routes it, nothing is guessed from the text.
        expect(submitClubEnquiry).toHaveBeenLastCalledWith(1, expect.objectContaining({ programmeId: 13, squadId: null }), 'parent-session');
    });
});

describe('closing the finder', () => {
    function Where() { const location = useLocation(); const type = useNavigationType(); return <output data-testid="where">{`${type} ${location.pathname}${location.search}`}</output>; }
    function Page() {
        const location = useLocation();
        return <>{new URLSearchParams(location.search).get('find') === 'club' && <ClubFinder families={[]} onChanged={vi.fn()} />}
            <Link to="/parent?player=61&find=club" state={FINDER_OPENED}>Find a club near you</Link><Where /></>;
    }

    it('S23: ✕ goes back over the entry its own link opened', async () => {
        window.history.replaceState(null, '', '/parent?player=61');
        render(<BrowserRouter><Page /></BrowserRouter>);
        fireEvent.click(screen.getByRole('link', { name: 'Find a club near you' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Close' }));
        await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('POP /parent?player=61'));
    });

    it('S23: a later link at the same place in history never sends ✕ back to an unrelated page', async () => {
        // An earlier opening at this index, left by Back, and a shared group link opened from Messages since.
        window.history.replaceState(null, '', '/messages');
        render(<BrowserRouter><Page /></BrowserRouter>);
        sessionStorage.setItem('gk-finder-opened', '1');
        act(() => { window.history.pushState({ usr: null, key: 'shared', idx: 1 }, '', '/parent?player=61&find=club&group=44'); window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state })); });
        fireEvent.click(await screen.findByRole('button', { name: 'Close' }));
        await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('REPLACE /parent?player=61'));
        expect(screen.getByTestId('where')).not.toHaveTextContent('/messages');
    });
});
