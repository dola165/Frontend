import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
vi.mock('../../features/competitions/api', async importOriginal => ({ ...await importOriginal<typeof import('../../features/competitions/api')>(), getCompetitionProfile: vi.fn().mockResolvedValue({legacy:true,rules:null,revision:0}) }));
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

// Entering is World's shared step (`TournamentEntry`, tested on its own); the page hands it the tournament and what to say otherwise.
vi.mock('../../features/world/peek/tournament/TournamentEntry', () => ({
    TournamentEntry: ({ tournamentId, otherwise }: { tournamentId: number; otherwise: import('react').ReactNode }) => <div data-testid="entry" data-tournament={tournamentId}>{otherwise}</div>,
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

import { fetchTournament, fetchTournamentTieHistory, fetchTournamentTieState } from '../../features/tournaments/api';
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
        expect(await screen.findByRole('link', { name: 'Back to tournaments' })).toHaveAttribute('href', '/world/tournaments');
    });

    it('shows a closing-only entry window in the published competition timezone', async () => {
        const { getCompetitionProfile, defaultRules } = await import('../../features/competitions/api');
        vi.mocked(getCompetitionProfile).mockResolvedValueOnce({ legacy: false, rules: { ...defaultRules('CUP'), timezone: 'America/New_York', sideSize: 7, matchMinutes: 30, tiebreaks: [] }, revision: 0 });
        vi.mocked(fetchTournament).mockResolvedValue({ ...mockTournament, registrationOpensAt: null, registrationClosesAt: '2099-06-30T00:30:00+04:00' });
        renderPage();
        expect(await screen.findByText('Entry window: Closes 29 Jun 2099')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('tab', { name: 'About' }));
        expect(screen.getByText('Closes 29 Jun 2099')).toBeInTheDocument();
    });

    it('shows status badge', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        expect((await screen.findAllByText('Registration')).length).toBeGreaterThan(0);
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

    it('hands entering to the same decision as World', async () => {
        vi.mocked(fetchTournament).mockResolvedValue(mockTournament);
        renderPage();
        expect(await screen.findByTestId('entry')).toHaveAttribute('data-tournament', '42');
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

    it('keeps individual entry unavailable to a parent or underage player', async () => {
        vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true, user: { id: 1, role: 'PLAYER', dob: '2020-01-01', profileComplete: true } } as ReturnType<typeof useAuth>);
        vi.mocked(apiClient.get).mockImplementation(async url => ({ data: url === '/competitions/player-eligibility' ? { eligible: false } : null }));
        vi.mocked(fetchTournament).mockResolvedValue(mockTournament);
        renderPage();
        expect(await screen.findByText(/Individual entry requires an adult player/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();
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
        expect(screen.getByTestId('entry')).toBeInTheDocument();
        expect(apiClient.get).not.toHaveBeenCalled();
        expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('shows public allocation status and removes a cancelled venue link after reload', async () => {
        const reservation = { venueId: 71, venueName: 'Synthetic ground', pitchName: 'Pitch A', status: 'CONFIRMED' as const, startsAt: '2099-07-01T10:00:00Z', endsAt: '2099-07-01T10:30:00Z', timezone: 'Asia/Tbilisi' };
        const detail = { ...mockTournament, fixtures: [{ id: 10, homeLabel: 'Blue FC', awayLabel: 'Hill FC', status: 'SCHEDULED', venueReservation: reservation }] as TournamentDetail['fixtures'] };
        vi.mocked(fetchTournament).mockResolvedValueOnce(detail).mockResolvedValueOnce({ ...detail, fixtures: [{ ...detail.fixtures[0], venueReservation: { ...reservation, status: 'UNAVAILABLE', unavailableReason: 'CANCELLED' } }] });
        renderPage();
        await userEvent.click(await screen.findByRole('tab', { name: 'Matches' }));
        expect(screen.getByText('Pitch confirmed')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Synthetic ground · Pitch A' })).toHaveAttribute('href', '/stadiums/71');
        await userEvent.click(screen.getByRole('button', { name: 'Refresh results' }));
        expect(await screen.findByText('Venue reservation no longer confirmed')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Synthetic ground · Pitch A' })).not.toBeInTheDocument();
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
