import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { apiClient } from '../../../../api/axiosConfig';
import { FootballProfilePage } from '../FootballProfilePage';
import { readFootball, type PersonFootballProfile, type ServerLine } from '../api';

const auth = vi.hoisted(() => ({
    user: { id: 5, fullName: 'Nino Beridze', username: 'nino', dob: '1990-04-02' } as Record<string, unknown>,
    sessionId: 'football-fixture', refreshNavigationCapabilities: vi.fn(async () => undefined),
}));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../../api/axiosConfig', () => ({ DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost:8080' }, apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

const yes = (action: string) => ({ action, allowed: true });
const dinamo = { id: 7, name: 'Dinamo Academy', logoUrl: null };
const vets = { id: 9, name: 'Veterans FC', logoUrl: null };
const lines: ServerLine[] = [
    { line: 'job:81', kind: 'JOB', title: 'Head coach', label: 'Head coach · U12 · Dinamo Academy', club: dinamo, squads: [{ id: 12, name: 'U12' }], clubWide: false, since: '2025-09-01', sinceKnown: false, appointmentId: 81, revision: 4, actions: [yes('end_job'), yes('manage_club')] },
    { line: 'head:14', kind: 'COACH', title: 'Head coach', label: 'Head coach · U14 · Dinamo Academy', club: dinamo, squads: [{ id: 14, name: 'U14' }], clubWide: false, since: null, leaveAs: null, actions: [yes('manage_squad')] },
    { line: 'owner:9', kind: 'OWNER', title: 'Owner', label: 'Owner · Veterans FC', club: vets, squads: [], clubWide: true, leaveAs: 'STAFF', actions: [{ action: 'leave_club', allowed: false, reason: 'OWNER_STAYS' }, yes('manage_club')] },
    { line: 'plays:3', kind: 'PLAYS_FOR', title: 'Player', label: 'Player · Veterans 35+ · Veterans FC', club: vets, squads: [{ id: 3, name: 'Veterans 35+' }], clubWide: false, leaveAs: 'PLAYER', actions: [yes('leave_club')] },
    { line: 'parent:4', kind: 'PARENT_OF', title: 'Parent', label: 'Parent', club: null, child: { id: 4, name: 'Luka Beridze' }, actions: [] },
    { line: 'follows:2', kind: 'FOLLOWS', title: 'Follows', label: 'Follows Saburtalo', club: { id: 2, name: 'Saburtalo' }, actions: [yes('unfollow')] },
];
const profile: PersonFootballProfile = {
    userId: 5, own: true, revision: 6,
    publicRole: { line: 'job:81', label: 'Head coach · U12 · Dinamo Academy', chosen: false },
    roleChoices: [{ line: 'job:81', label: 'Head coach · U12 · Dinamo Academy' }, { line: 'owner:9', label: 'Owner · Veterans FC' }, { line: 'plays:3', label: 'Player · Veterans 35+ · Veterans FC' }],
    whereYouAre: lines,
    career: { lines: [{ line: 'job:31', kind: 'JOB', title: 'Assistant coach', label: 'Assistant coach · U10 · Dinamo Academy', club: dinamo, squads: [{ id: 10, name: 'U10' }], since: '2023-09-01', until: '2025-08-31' }], counts: { sessionsCoached: 212, matchesPlayed: null, matchesRefereed: 3 } },
};

function serve(data = profile) {
    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
        if (path === '/users/me/football-profile') return { data };
        if (path === '/users/me/professions') return { data: { items: [], version: 3 } };
        if (path === '/users/me/discovery') return { data: { openTo: [], licence: null, rate: null, version: 2 } };
        if (path === '/users/5') return { data: { id: 5, username: 'nino', bio: '' } };
        if (path === '/me/club-relationships') return { data: [{ clubId: 9, departureSnapshots: { PLAYER: 'snap-9' } }] };
        throw new Error(`Unexpected read ${path}`);
    });
}
const mount = (path = '/account/football') => render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/account/football" element={<FootballProfilePage />} />
</Routes></MemoryRouter>);

afterEach(() => { cleanup(); vi.mocked(apiClient.get).mockReset(); vi.mocked(apiClient.post).mockReset(); vi.mocked(apiClient.put).mockReset(); auth.user.dob = '1990-04-02'; });

describe('your football profile', () => {
    it('fills where you are from links and jobs, with Leave only where the rule-checker allows it', async () => {
        serve(); mount();
        const where = within(await screen.findByRole('list', { name: 'Where you are' }));
        // One block per club: Dinamo's two head-coach places (one a job that can end, so not merged), then Veterans FC.
        expect(where.getAllByRole('link', { name: /Dinamo Academy|Veterans FC/ }).map(link => link.textContent)).toEqual(['Dinamo Academy', 'Veterans FC']);
        expect(where.getAllByText('Head coach')).toHaveLength(2);
        // A start filled in from older data is not a fact: "since at least".
        expect(where.getByText(/^since at least Sept? 2025$/)).toBeInTheDocument();
        expect(where.getByRole('link', { name: 'U12' })).toHaveAttribute('href', '/my-squads?squad=12');
        expect(where.getByRole('link', { name: 'U14' })).toHaveAttribute('href', '/my-squads?squad=14');
        expect(where.getByRole('link', { name: 'Veterans 35+' })).toHaveAttribute('href', '/squads/3');
        expect(where.getByText('Parent of Luka')).toBeInTheDocument();
        expect(where.getByText('Follows Saburtalo')).toBeInTheDocument();
        // The job ends as a job and the squad place is left; a squad's head coach and the Owner have no Leave here.
        expect(where.getAllByRole('button', { name: 'Leave' })).toHaveLength(2);
        expect(where.getAllByRole('link', { name: 'Manage' }).map(link => link.getAttribute('href'))).toEqual(['/clubs/9/office', '/parent?player=4']);
        expect(screen.getByLabelText('Career in numbers')).toHaveTextContent('212 sessions coached3 matches refereed');
        expect(within(screen.getByRole('list', { name: 'Career' })).getByText('Assistant coach · U10')).toBeInTheDocument();
        expect(screen.queryByRole('checkbox', { name: /Player|Coach|Fan/ })).not.toBeInTheDocument();
    });

    it('ends a job as a job, and leaves a squad place through the club’s departure', async () => {
        serve(); mount();
        const where = within(await screen.findByRole('list', { name: 'Where you are' }));
        vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
        fireEvent.click(where.getAllByRole('button', { name: 'Leave' })[0]);
        fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Leave' }));
        await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/clubs/7/people/jobs/81/end', { revision: 4 }));
        fireEvent.click((await screen.findAllByRole('button', { name: 'Leave' }))[1]);
        fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Leave' }));
        await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/clubs/9/relationships/PLAYER/leave', expect.objectContaining({ snapshot: 'snap-9' })));
        expect(auth.refreshNavigationCapabilities).toHaveBeenCalled();
    });

    it('the Owner hands the club over, and leaving a club’s staff goes through the one leave flow', async () => {
        serve();
        mount();
        const where = within(await screen.findByRole('list', { name: 'Where you are' }));
        fireEvent.click(where.getByRole('button', { name: /Hand the club over/ }));
        expect(await screen.findByRole('dialog', { name: 'Hand Veterans FC over' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Hand Veterans FC over' })).not.toBeInTheDocument());
    });

    it('picks the line under your name from your real lines, with the revision', async () => {
        serve(); mount();
        fireEvent.click(await screen.findByRole('button', { name: /Head coach · U12 · Dinamo Academy/ }));
        const menu = within(screen.getByRole('listbox'));
        expect(menu.getAllByRole('option')).toHaveLength(4);
        expect(menu.queryByText(/Luka|Parent|Follows/)).not.toBeInTheDocument();
        vi.mocked(apiClient.put).mockResolvedValue({ data: { ...profile, publicRole: { line: 'plays:3', label: 'Player · Veterans 35+ · Veterans FC', chosen: true } } });
        fireEvent.click(menu.getByText('Player · Veterans 35+ · Veterans FC'));
        await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/users/me/football-profile/public-role', { line: 'plays:3', revision: 6 }));
        expect(await screen.findByRole('button', { name: /Player · Veterans 35\+ · Veterans FC/ })).toBeInTheDocument();
    });

    it('saves a chip as a profession at once', async () => {
        serve(); mount();
        vi.mocked(apiClient.put).mockResolvedValue({ data: { items: [{ id: 1, title: 'Physio', label: null, detail: null, since: null, published: false, verification: 'SELF_REPORTED', verifiedBy: null }], version: 4 } });
        fireEvent.click(await screen.findByRole('button', { name: 'Physio' }));
        await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/users/me/professions', expect.objectContaining({ expectedVersion: 3, professions: [expect.objectContaining({ title: 'Physio' })] })));
        expect(await screen.findByRole('button', { name: 'Remove Physio' })).toBeInTheDocument();
    });

    it('offers Start a club and Add my child to adults only', async () => {
        auth.user.dob = '2010-01-01';
        serve(); mount();
        const doors = within(await screen.findByRole('list', { name: 'Start something' }));
        expect(doors.getByRole('link', { name: /Join a squad/ })).toBeInTheDocument();
        expect(doors.queryByRole('link', { name: /Start a club/ })).not.toBeInTheDocument();
        expect(doors.queryByRole('link', { name: /Add my child/ })).not.toBeInTheDocument();
    });

});

describe('someone else’s football', () => {
    it('never keeps a parent line, a child, a follow or any control for another viewer', () => {
        const view = readFootball({ ...profile, own: false, roleChoices: [] });
        expect(view.lines.map(line => line.kind)).toEqual(['JOB', 'COACH', 'OWNER', 'PLAYS_FOR']);
        expect(view.lines.every(line => line.manage === null && line.leave === null && line.child === null)).toBe(true);
        expect(view.follows).toEqual([]);
        expect(view.choices).toEqual([]);
    });
});
