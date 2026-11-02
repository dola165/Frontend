import '../../../i18n';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { primarySectionFor } from '../../../components/layout/header/sections';
import type { Match, Squad } from '../../matchExchange/api';
import { MatchParticipants } from '../../matchExchange/MatchParticipants';
import { LegacyMatchRedirect } from '../LegacyMatchRedirect';
import { NameOpponent, OpponentAnswer } from '../MatchAsks';
import { backLink, defaultFrom, matchPath, parseFrom } from '../matchContext';

const http = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
const loaded = vi.hoisted(() => ({ data: undefined as unknown }));
vi.mock('../../matchExchange/api', async original => ({ ...(await original<typeof import('../../matchExchange/api')>()), post: http.post }));
vi.mock('../../matchExchange/hooks', async original => ({ ...(await original<typeof import('../../matchExchange/hooks')>()), useLoad: () => ({ data: loaded.data, error: '', reload: vi.fn() }) }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });
const copy = (en: string) => en;
const match = (patch: Partial<Match> = {}) => ({ event_id: 12, revision: 3, club_id: 4, club_name: 'Saburtalo Youth', squad_name: 'U14', listing_status: 'ARRANGED', event_status: 'SCHEDULED',
    starts_at: '2099-10-31T11:00:00', ends_at: '2099-10-31T12:20:00', starts_at_iso: '2099-10-31T07:00:00Z', ends_at_iso: '2099-10-31T08:20:00Z', timezone: 'Asia/Tbilisi', ...patch } as Match);

describe('one match, opened in its context', () => {
    it('lights the place it came from and leads back there', () => {
        expect(primarySectionFor('/matches/12', [], '?from=squad:103')).toBe('my-squads');
        expect(primarySectionFor('/matches/12', [], '?from=world')).toBe('world');
        expect(primarySectionFor('/matches/12', [], '?from=parent')).toBe('parent-hub');
        expect(primarySectionFor('/matches/12', [], '?from=referee')).toBe('my-matches');
        expect(primarySectionFor('/my-matches', [])).toBe('my-matches');
        expect(backLink(parseFrom('squad:103')!, { squad: 'U14 Boys' }, copy)).toEqual({ to: '/my-squads?tab=matches&squad=103', label: 'U14 Boys · Matches' });
        expect(backLink(parseFrom('world')!, {}, copy)).toEqual({ to: '/world/matches', label: 'Matches near you' });
        expect(backLink(parseFrom('referee')!, {}, copy)).toEqual({ to: '/my-matches', label: 'My matches' });
        expect(parseFrom('squad:abc')).toBeNull();
        expect(matchPath(12, { kind: 'squad', id: 103 }, '#result')).toBe('/matches/12?from=squad%3A103#result');
        expect(matchPath(5727, { kind: 'parent', playerId: 9611 })).toBe('/matches/5727?from=parent&player=9611');
        expect(backLink(parseFrom('parent', '9611')!, {}, copy)).toEqual({ to: '/parent?player=9611', label: 'Parent Hub' });
        expect(parseFrom('parent', 'https://other.test')).toEqual({ kind: 'parent' });
    });

    it('opens a link that names no context in the viewer’s own: their squad, their child’s, the referee’s, else World', () => {
        expect(defaultFrom(match({ viewer_squad_id: 103 }), false)).toEqual({ kind: 'squad', id: 103 });
        expect(defaultFrom(match({ viewer_squad_id: 103 }), true)).toEqual({ kind: 'parent' });
        expect(defaultFrom(match({ own_appointments: [{ id: 1 }] as Match['own_appointments'] }), false)).toEqual({ kind: 'referee' });
        expect(defaultFrom(match(), false)).toEqual({ kind: 'world' });
    });

    it('lands an old /match-exchange link on the match page with its query and anchor', () => {
        function Where() { const location = useLocation(); return <p>{location.pathname + location.search + location.hash}</p>; }
        render(<MemoryRouter initialEntries={['/match-exchange/12?ground=reserve#result']}><Routes>
            <Route path="/match-exchange/:eventId" element={<LegacyMatchRedirect />} /><Route path="*" element={<Where />} />
        </Routes></MemoryRouter>);
        expect(screen.getByText('/matches/12?ground=reserve#result')).toBeInTheDocument();
    });
});

describe('who is expected', () => {
    const team = { squadId: 103, squadName: 'U14 Boys', canManage: false, players: [
        { id: 1, name: 'Giorgi Mikadze', selected: true, response: 'UNANSWERED', revision: 4, canRespond: true },
        { id: 2, name: 'Luka Beridze', selected: true, response: 'NOT_GOING', revision: 2, canRespond: false },
        { id: 3, name: 'Saba Kiteishvili', selected: false, response: 'NOT_INVITED', revision: 1, canRespond: false }] };

    it('counts every called-up player as expected unless their family said they can’t come, with one button and no "coming"', async () => {
        loaded.data = [team];
        http.post.mockResolvedValue({});
        render(<MemoryRouter><MatchParticipants match={match({ starts_at_iso: '2099-10-31T07:00:00Z' })} reload={vi.fn()} /></MemoryRouter>);
        expect(screen.getAllByText('1 expected · 1 not coming').length).toBeGreaterThan(0);
        expect(screen.queryByRole('button', { name: /^Coming/ })).not.toBeInTheDocument();
        expect(screen.queryByText(/hasn’t answered|Remind/)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Can’t come' }));
        await waitFor(() => expect(http.post).toHaveBeenCalledWith('/match-arrangements/12/squads/103/attendance', { playerId: 1, response: 'NOT_GOING', revision: 4, matchRevision: 3 }));
    });
});

describe('a match added against our club', () => {
    const squads: Squad[] = [{ id: 103, club_id: 1, name: 'U14 Boys', category: 'U14', club_name: 'Dinamo' }, { id: 104, club_id: 1, name: 'U14 Girls', category: 'U14', club_name: 'Dinamo' }];

    it('asks which squad plays, then adds it to that squad’s week; or answers Not us', async () => {
        http.post.mockResolvedValue({});
        render(<MemoryRouter><OpponentAnswer match={match({ opponent_asked_club: 1, opponent_answer: 'WAITING', can_answer_opponent: true })} squads={squads} reload={vi.fn()} /></MemoryRouter>);
        expect(screen.getByRole('heading')).toHaveTextContent(/^Saburtalo Youth added a match against you/);
        expect(screen.getByRole('button', { name: 'Add it to our week' })).toBeDisabled();
        fireEvent.click(screen.getByRole('radio', { name: 'U14 Girls' }));
        fireEvent.click(screen.getByRole('button', { name: 'Add it to our week' }));
        await waitFor(() => expect(http.post).toHaveBeenCalledWith('/match-arrangements/12/opponent-answer', { answer: 'ADD', squadId: 104, revision: 3 }));
        fireEvent.click(screen.getByRole('button', { name: 'Not us' }));
        await waitFor(() => expect(http.post).toHaveBeenLastCalledWith('/match-arrangements/12/opponent-answer', { answer: 'NOT_US', squadId: null, revision: 3 }));
    });

    it('lets staff type the name of an opponent that is not in GrassKickZ', async () => {
        http.post.mockResolvedValue({});
        render(<MemoryRouter><NameOpponent match={match({ can_name_opponent: true })} reload={vi.fn()} /></MemoryRouter>);
        fireEvent.change(screen.getByLabelText('Opponent'), { target: { value: ' Gori Juniors ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(http.post).toHaveBeenCalledWith('/match-arrangements/12/outside-opponent', { name: 'Gori Juniors', revision: 3 }));
    });
});
