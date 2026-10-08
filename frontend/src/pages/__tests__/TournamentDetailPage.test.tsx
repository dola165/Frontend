import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
vi.mock('../../features/competitions/api',()=>({getCompetitionProfile:vi.fn().mockResolvedValue({legacy:true,rules:null,revision:0})}));
import { TournamentDetailPage } from '../../pages/TournamentDetailPage';
import type { TournamentDetail } from '../../features/tournaments/domain';
import { apiClient } from '../../api/axiosConfig';

vi.mock('../../api/axiosConfig', async (importOriginal) => ({
    ...await importOriginal<typeof import('../../api/axiosConfig')>(),
    apiClient: { get: vi.fn(), post: vi.fn() },
}));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useParams: () => ({ tournamentId: '42' }),
        useNavigate: () => mockNavigate,
    };
});

vi.mock('../../features/tournaments/api', () => ({
    fetchTournament: vi.fn(),
    registerPlayer: vi.fn(),
    requestEntry: vi.fn(),
    fetchGroupStandings: vi.fn().mockResolvedValue([]),
    fetchTournamentTieState: vi.fn(),
    fetchTournamentTieHistory: vi.fn(),
    resolveTournamentTie: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

vi.mock('../../utils/apiError', () => ({
    extractApiErrorMessage: vi.fn((_err: unknown, fallback: string) => fallback),
}));

vi.mock('../../utils/authRedirect', () => ({
    buildLoginRedirectPath: vi.fn(() => '/login?next=%2F'),
}));

import { fetchTournament, fetchTournamentTieHistory, fetchTournamentTieState, registerPlayer, requestEntry } from '../../features/tournaments/api';
import { useAuth } from '../../context/AuthContext';

const mockTournament: TournamentDetail = {
    id: 42,
    name: 'Spring Cup',
    description: 'A seasonal tournament',
    rules: 'No fouls allowed',
    status: 'PLANNING',
    organizerOrganizationId: 1,
    participantScope: 'PLAYER',
    visibility: 'PUBLIC',
    startDate: '2099-07-01T00:00:00Z',
    endDate: '2099-07-05T00:00:00Z',
    registrationOpensAt: '2026-06-01T00:00:00Z',
    registrationClosesAt: '2099-06-30T00:00:00Z',
    staffAssignments: [],
    entries: [],
    stages: [],
    fixtures: [],
};

const renderPage = () =>
    render(
        <MemoryRouter>
            <TournamentDetailPage />
        </MemoryRouter>
    );

const publicEntry = (overrides: Partial<TournamentDetail['entries'][number]>): TournamentDetail['entries'][number] => ({
    id: 1, clubId: null, clubName: null, squadId: null, squadName: null, userId: null, displayName: null,
    status: 'APPROVED', seed: null, requestedBy: null, decidedBy: null, decidedAt: null, confirmedAt: null,
    withdrawnAt: null, withdrawalReason: null, ...overrides,
});

describe('TournamentDetailPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(apiClient.get).mockImplementation(async url => ({ data: url === '/competitions/player-eligibility' ? { eligible: true } : null }));
        vi.mocked(fetchTournamentTieState).mockResolvedValue({ contests: [], blocked: false, staleStageIds: [], blockedStageIds: [] });
        vi.mocked(fetchTournamentTieHistory).mockResolvedValue([]);
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            isAuthenticated: true,
            user: { id: 1, role: 'PLAYER', dob: '1990-01-01', profileComplete: true },
        });
    });

    it('shows loading spinner initially', () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
        renderPage();
        expect(document.querySelector('.animate-spin')).toBeTruthy();
    });

    it('shows error state when API fails', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
        renderPage();
        expect(await screen.findByText('Tournament not found')).toBeInTheDocument();
        expect(screen.getByText('Failed to load tournament details.')).toBeInTheDocument();
    });

    it('shows not-found state when tournament is null', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        renderPage();
        expect(await screen.findByText('Tournament not found')).toBeInTheDocument();
    });

    it('renders tournament name and description on success', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        expect(await screen.findByRole('heading', { name: 'Spring Cup', level: 1 })).toBeInTheDocument();
        expect(screen.getAllByText('A seasonal tournament').length).toBeGreaterThan(0);
        expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    });

    it('shows the Back to Tournaments link', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        expect(await screen.findByRole('link', { name: 'Back to competitions' })).toHaveAttribute('href', '/matches?section=competitions');
    });

    it('shows status badge', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        expect((await screen.findAllByText('Registration')).length).toBeGreaterThan(0);
    });

    it('lets a primary coach with eligible player identity enter without changing account role', async () => {
        vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true, user: { id: 1, role: 'COACH', dob: '1990-01-01', profileComplete: true } } as ReturnType<typeof useAuth>);
        vi.mocked(fetchTournament).mockResolvedValue(mockTournament);
        vi.mocked(registerPlayer).mockResolvedValue({} as Awaited<ReturnType<typeof registerPlayer>>);
        renderPage();
        await userEvent.click(await screen.findByRole('button', { name: 'Register' }));
        expect(registerPlayer).toHaveBeenCalledWith(42);
        expect(useAuth().user?.role).toBe('COACH');
    });
    it('offers recovery when private eligibility cannot be read without showing Register', async () => {
        vi.mocked(fetchTournament).mockResolvedValue(mockTournament);
        let attempts = 0;
        vi.mocked(apiClient.get).mockImplementation(async url => {
            if (url !== '/competitions/player-eligibility') return { data: null };
            if (++attempts === 1) throw new Error('Offline');
            return { data: { eligible: true } };
        });
        renderPage();
        const retry = await screen.findByRole('button', { name: 'Retry eligibility check' });
        expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();
        await userEvent.click(retry);
        expect(await screen.findByRole('button', { name: 'Register' })).toBeInTheDocument();
    });
    it('shows eligibility loading without mislabelling the person as ineligible', async () => {
        vi.mocked(fetchTournament).mockResolvedValue(mockTournament);
        vi.mocked(apiClient.get).mockImplementation(async url => {
            if (url === '/competitions/player-eligibility') return new Promise(() => {});
            return { data: null };
        });
        renderPage();
        expect(await screen.findByText('Checking entry eligibility…')).toBeInTheDocument();
        expect(screen.queryByText(/Individual entry requires an adult player/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();
    });

    it('shows register button for PLANNING + PLAYER-scope tournament', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        expect(await screen.findByText('Register')).toBeInTheDocument();
    });

    it('hides register button when user is already registered', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue({
            ...mockTournament,
            entries: [{ id: 1, userId: 1, status: 'ACTIVE' } as TournamentDetail['entries'][number]],
        });
        renderPage();
        expect(await screen.findByText('Registered')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /register/i })).not.toBeInTheDocument();
    });

    it('hides register button for non-PLAYER scope', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue({
            ...mockTournament,
            participantScope: 'CLUB',
        });
        renderPage();
        await screen.findAllByText('Clubs');
        expect(screen.queryByRole('button', { name: /register/i })).not.toBeInTheDocument();
    });

    it('shows a sign-in registration action for unauthenticated users', async () => {
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            isAuthenticated: false,
            user: null,
        });
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        await screen.findByText('Spring Cup');
        expect(screen.getByRole('button', { name: 'Sign in to register' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();
    });

    it('registers and refreshes tournament on success', async () => {
        const user = userEvent.setup();
        (fetchTournament as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce(mockTournament)
            .mockResolvedValueOnce({ ...mockTournament, entries: [{ id: 1, userId: 1, status: 'ACTIVE' } as TournamentDetail['entries'][number]] });
        (registerPlayer as ReturnType<typeof vi.fn>).mockResolvedValue({});
        renderPage();
        const btn = await screen.findByText('Register');
        await user.click(btn);
        expect(registerPlayer).toHaveBeenCalledWith(42);
        expect(await screen.findByText('Successfully registered for the tournament.')).toBeInTheDocument();
    });

    it('shows error message when registration fails', async () => {
        const user = userEvent.setup();
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        (registerPlayer as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Already registered'));
        renderPage();
        const btn = await screen.findByText('Register');
        await user.click(btn);
        expect(await screen.findByText('Failed to register.')).toBeInTheDocument();
    });

    it('shows workspace link for staff members', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue({
            ...mockTournament,
            staffAssignments: [{ userId: 1, role: 'ORGANIZER', status: 'ACTIVE' } as TournamentDetail['staffAssignments'][number]],
        });
        renderPage();
        expect(await screen.findByRole('link', { name: /Open workspace/ })).toHaveAttribute('href', '/tournaments/42/workspace');
    });

    it('renders scope and visibility badges', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        expect((await screen.findAllByText('Players')).length).toBeGreaterThan(0);
        expect(screen.getAllByText('Public').length).toBeGreaterThan(0);
    });

    it('renders participant counts', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue({
            ...mockTournament,
            entries: [{ id: 1, status: 'APPROVED' } as TournamentDetail['entries'][number], { id: 2, status: 'APPROVED' } as TournamentDetail['entries'][number]],
            fixtures: [{ id: 10 } as TournamentDetail['fixtures'][number]],
        });
        renderPage();
        expect((await screen.findAllByText(/2 entries/)).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/1 fixture/).length).toBeGreaterThan(0);
    });

    it('renders dates when present', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        expect(await screen.findByText(/Entry window: 1 Jun 2026/)).toBeInTheDocument();
    });

    it('renders rules section when present', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        await userEvent.click(await screen.findByRole('tab', { name: 'About' }));
        expect(screen.getByText('Competition rules')).toBeInTheDocument();
        expect(screen.getByText('No fouls allowed')).toBeInTheDocument();
    });

    it('shows an authoritative read-only tie explanation to a non-operator viewer', async () => {
        vi.mocked(fetchTournament).mockResolvedValue({ ...mockTournament, status: 'ACTIVE', entries: [
            publicEntry({ id: 21, clubName: 'Riverside' }), publicEntry({ id: 22, clubName: 'Hill FC' }),
        ], stages: [{ id: 10, parentStageId: null, name: 'Group A', stageType: 'GROUP', stageOrder: 1, status: 'COMPLETED', advanceCount: 1 }] });
        vi.mocked(fetchTournamentTieState).mockResolvedValue({ blocked: true, staleStageIds: [], blockedStageIds: [], contests: [{
            key: 'RANK:10:1', stageId: 10, fixtureId: null, rank: 1, candidateEntryIds: [21, 22], sourceRevision: '4:7:9',
            ruleContext: 'points DESC, goal difference DESC, goals for DESC', status: 'UNRESOLVED', selectedEntryId: null,
            resolutionId: null, consequential: true, readyForResolution: true,
        }] });
        renderPage();
        await userEvent.click(await screen.findByRole('tab', { name: 'Competition' }));
        expect(await screen.findByText(/Only tournament ADMIN or STAFF/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Resolve this tie' })).not.toBeInTheDocument();
        expect(screen.getByText('Competition progression is blocked')).toBeInTheDocument();
    });

    it('keeps tournament information while hiding unsupported extension links', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        await userEvent.click(await screen.findByRole('tab', { name: 'About' }));
        expect(screen.getAllByText('A seasonal tournament').length).toBeGreaterThan(0);
        expect(screen.queryByRole('link', { name: /Volunteer at this tournament/ })).not.toBeInTheDocument();
        expect(screen.queryByText(/Competition series/)).not.toBeInTheDocument();
    });

    it('shows a useful rules empty state when rules are not present', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue({
            ...mockTournament,
            rules: null,
        });
        renderPage();
        await screen.findByText('Spring Cup');
        await userEvent.click(screen.getByRole('tab', { name: 'About' }));
        expect(screen.getByText('Competition rules')).toBeInTheDocument();
        expect(screen.getByText('The organizer has not published competition rules yet.')).toBeInTheDocument();
    });

    afterEach(() => vi.restoreAllMocks());

    it('acknowledges withdrawal that removes private access and clears the private page', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        vi.mocked(fetchTournament).mockResolvedValue({
            ...mockTournament, visibility: 'PRIVATE',
            entries: [{ id: 7, userId: 1, status: 'ACTIVE' } as TournamentDetail['entries'][number]],
        });
        vi.mocked(apiClient.post).mockResolvedValue({ status: 204, data: '' });
        renderPage();
        await userEvent.click(await screen.findByRole('button', { name: 'Withdraw entry' }));
        expect(await screen.findByRole('heading', { name: 'Successfully withdrawn from the tournament.' })).toBeInTheDocument();
        expect(apiClient.post).toHaveBeenCalledWith('/tournaments/42/entries/7/withdraw', {});
        expect(fetchTournament).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('Spring Cup')).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Back to competitions' })).toBeInTheDocument();
    });

    it('uses the protected withdrawal response when public viewing access remains', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        vi.mocked(fetchTournament).mockResolvedValue({ ...mockTournament,
            entries: [{ id: 7, userId: 1, status: 'ACTIVE' } as TournamentDetail['entries'][number]] });
        vi.mocked(apiClient.post).mockResolvedValue({ status: 200, data: { ...mockTournament,
            entries: [{ id: 7, userId: 1, status: 'WITHDRAWN' }] } });
        renderPage();
        await userEvent.click(await screen.findByRole('button', { name: 'Withdraw entry' }));
        expect(await screen.findByRole('button', { name: 'Register' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Withdraw entry' })).not.toBeInTheDocument();
        expect(fetchTournament).toHaveBeenCalledTimes(1);
    });

    it('does not offer registration outside its window', async () => {
        vi.mocked(fetchTournament).mockResolvedValue({ ...mockTournament, registrationClosesAt: '2000-01-01T00:00:00' });
        renderPage();
        expect(await screen.findByText('Registration closed')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();
    });
    it('keeps individual entry unavailable to a parent or underage player', async () => {
        vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true, user: { id: 1, role: 'PLAYER', dob: '2020-01-01', profileComplete: true } } as ReturnType<typeof useAuth>);
        vi.mocked(apiClient.get).mockImplementation(async url => ({ data: url === '/competitions/player-eligibility' ? { eligible: false } : null }));
        vi.mocked(fetchTournament).mockResolvedValue(mockTournament);
        renderPage();
        expect(await screen.findByText(/Individual entry requires an adult player/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();
    });
    it('requires a squad selection, shows loading accurately and retries a failed squad read', async () => {
        vi.mocked(fetchTournament).mockResolvedValue({ ...mockTournament, participantScope: 'SQUAD' });
        vi.mocked(apiClient.get).mockImplementation(async url => {
            if (url === '/clubs/my-membership-context') return { data: { clubId: 1, clubName: 'Dinamo', myRole: 'COACH' } };
            throw new Error('Offline');
        });
        renderPage();
        await userEvent.click(await screen.findByRole('button', { name: 'Request entry' }));
        expect(await screen.findByText('Could not load squads. Your request has not been sent.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Submit request' })).toBeDisabled();
        vi.mocked(apiClient.get).mockResolvedValue({ data: [{ id: 3, name: 'U16 Boys' }] });
        await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
        await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Choose a squad' }), '3');
        vi.mocked(requestEntry).mockResolvedValue({} as never);
        await userEvent.click(screen.getByRole('button', { name: 'Submit request' }));
        await waitFor(() => expect(requestEntry).toHaveBeenCalledWith(42, { clubId: 1, squadId: 3 }));
    });
    it('does not offer a club entry using a player membership alone', async () => {
        vi.mocked(fetchTournament).mockResolvedValue({ ...mockTournament, participantScope: 'CLUB' });
        vi.mocked(apiClient.get).mockResolvedValue({ data: { clubId: 1, clubName: 'Dinamo', myRole: 'PLAYER' } });
        renderPage();
        await screen.findByText('Spring Cup');
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Request entry' })).not.toBeInTheDocument());
        expect(requestEntry).not.toHaveBeenCalled();
    });
    it.each(['REJECTED', 'WITHDRAWN'] as const)('explains a previous %s club request while allowing another request', async status => {
        vi.mocked(fetchTournament).mockResolvedValue({ ...mockTournament, participantScope: 'CLUB', entries: [
            publicEntry({ id: 3, clubId: 1, status }),
            publicEntry({ id: 4, clubId: 2, status: 'APPROVED' }),
        ] });
        vi.mocked(apiClient.get).mockResolvedValue({ data: { clubId: 1, clubName: 'Dinamo', myRole: 'COACH' } });
        renderPage();
        expect(await screen.findByText(new RegExp(`Previous request: ${status === 'REJECTED' ? 'Entry declined' : 'Withdrawn'}`))).toHaveTextContent('You can submit a new request.');
        expect(screen.getByRole('button', { name: 'Request entry' })).toBeEnabled();
        expect(requestEntry).not.toHaveBeenCalled();
    });
    it('starts with a useful overview and links to the organizer identity', async () => {
        vi.mocked(fetchTournament).mockResolvedValue({ ...mockTournament, organizerName: 'Dinamo organization' });
        renderPage();
        expect(await screen.findByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('link', { name: 'Organizer: Dinamo organization' })).toHaveAttribute('href', '/organizations/1');
    });
    it('discloses generic football stock when the host has not supplied artwork', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        expect(await screen.findByText('Football stock photo')).toBeInTheDocument();
    });

    it('renders useful empty states for participants and fixtures', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        await userEvent.click(await screen.findByRole('tab', { name: 'Competition' }));
        expect(await screen.findByText('The draw is coming soon')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('tab', { name: 'Teams' }));
        expect(screen.getByText('No confirmed entries yet')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('tab', { name: 'Matches' }));
        expect(screen.getByText('Schedule coming soon')).toBeInTheDocument();
    });

    it('shows the bracket to visitors without making private requests', async () => {
        vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false, user: null } as ReturnType<typeof useAuth>);
        vi.mocked(fetchTournament).mockResolvedValue({ ...mockTournament,
            staffAssignments: [{ role: 'ADMIN', status: 'ACTIVE' } as TournamentDetail['staffAssignments'][number]],
            organizerName: 'Health Partners', hostClubName: null,
            stages: [{ id: 3, name: 'Finals', stageType: 'KNOCKOUT', stageOrder: 1, status: 'ACTIVE', parentStageId: null, advanceCount: null }],
            fixtures: [{ id: 10, stageId: 3, homeEntryId: 1, awayEntryId: 2, homeLabel: 'Blue FC', awayLabel: 'Hill FC', roundNumber: 1, fixtureOrder: 1, status: 'SCHEDULED' } as TournamentDetail['fixtures'][number]],
        });
        renderPage();
        await userEvent.click(await screen.findByRole('tab', { name: 'Competition' }));
        expect(await screen.findByText('Blue FC')).toBeInTheDocument();
        expect(screen.getByText('Hill FC')).toBeInTheDocument();
        expect(screen.getByText('Organized by · Health Partners')).toBeInTheDocument();
        expect(screen.queryByText(/brackets will be added later/)).not.toBeInTheDocument();
        expect(screen.queryByText('Ready to place')).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /Open workspace/ })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Sign in to register/ })).toBeInTheDocument();
        expect(apiClient.get).not.toHaveBeenCalled();
        expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('keeps eliminated teams in the public history while omitting pending entries', async () => {
        vi.mocked(fetchTournament).mockResolvedValue({ ...mockTournament, entries: [
            publicEntry({ id: 1, clubId: 4, clubName: 'Eliminated FC', status: 'ELIMINATED' }),
            publicEntry({ id: 2, displayName: 'Guest club', draftTeamId: 9, status: 'APPROVED' }),
            publicEntry({ id: 3, clubName: 'Pending FC', status: 'PENDING' }),
        ] });
        renderPage();
        await userEvent.click(await screen.findByRole('tab', { name: 'Teams' }));
        expect(screen.getByRole('link', { name: 'Eliminated FC' })).toHaveAttribute('href', '/clubs/4');
        expect(screen.getByText('Guest club')).toBeInTheDocument();
        expect(screen.queryByText('Pending FC')).not.toBeInTheDocument();
        await userEvent.type(screen.getByRole('searchbox', { name: 'Search teams' }), 'guest');
        expect(screen.getByText('Guest club')).toBeInTheDocument();
        expect(screen.queryByText('Eliminated FC')).not.toBeInTheDocument();
    });

    it('filters matches by selected stage and completion', async () => {
        vi.mocked(fetchTournament).mockResolvedValue({ ...mockTournament,
            stages: [
                { id: 1, name: 'Opening round', stageType: 'KNOCKOUT', stageOrder: 1, status: 'COMPLETED', parentStageId: null, advanceCount: null },
                { id: 2, name: 'Final round', stageType: 'KNOCKOUT', stageOrder: 2, status: 'ACTIVE', parentStageId: null, advanceCount: null },
            ],
            fixtures: [
                { id: 1, stageId: 1, homeLabel: 'Early FC', awayLabel: 'First FC', status: 'COMPLETED', homeScore: 2, awayScore: 1 },
                { id: 2, stageId: 2, homeLabel: 'Final FC', awayLabel: 'Next FC', status: 'SCHEDULED' },
            ] as TournamentDetail['fixtures'],
        });
        renderPage();
        await userEvent.click(await screen.findByRole('tab', { name: 'Matches' }));
        expect(screen.getByText('Final FC')).toBeInTheDocument();
        expect(screen.queryByText('Early FC')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Results' }));
        expect(screen.getByText('No matches in this view yet.')).toBeInTheDocument();
        await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Stage' }), '1');
        expect(screen.getByText('Early FC')).toBeInTheDocument();
        expect(screen.queryByText('Final FC')).not.toBeInTheDocument();
    });

    it('offers a selectable link when clipboard access is unavailable', async () => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
        vi.mocked(fetchTournament).mockResolvedValue(mockTournament);
        renderPage();
        await userEvent.click(await screen.findByRole('button', { name: 'Copy link' }));
        expect(await screen.findByRole('textbox', { name: 'Copy this tournament link' })).toHaveValue(`${window.location.origin}/tournaments/42`);
    });

    it('refreshes results while keeping the selected public tab', async () => {
        vi.mocked(fetchTournament).mockResolvedValueOnce(mockTournament).mockResolvedValueOnce({
            ...mockTournament, entries: [publicEntry({ displayName: 'New guest team' })],
        });
        renderPage();
        await userEvent.click(await screen.findByRole('tab', { name: 'Teams' }));
        await userEvent.click(screen.getByRole('button', { name: 'Refresh results' }));
        expect(await screen.findByText('New guest team')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Teams' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('status')).toHaveTextContent('Results are up to date.');
    });

    it('keeps the current public results after a failed refresh and allows retry', async () => {
        vi.mocked(fetchTournament).mockResolvedValueOnce(mockTournament).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(mockTournament);
        renderPage();
        await userEvent.click(await screen.findByRole('tab', { name: 'Matches' }));
        await userEvent.click(screen.getByRole('button', { name: 'Refresh results' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Could not refresh results. Your current view is still here.');
        expect(screen.getByRole('heading', { name: 'Spring Cup' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Matches' })).toHaveAttribute('aria-selected', 'true');
        await userEvent.click(screen.getByRole('button', { name: 'Refresh results' }));
        expect(await screen.findByRole('status')).toHaveTextContent('Results are up to date.');
    });
});
