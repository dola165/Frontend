import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
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

import { fetchTournament, registerPlayer } from '../../features/tournaments/api';
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
    startDate: '2026-07-01T00:00:00Z',
    endDate: '2026-07-05T00:00:00Z',
    registrationOpensAt: '2026-06-01T00:00:00Z',
    registrationClosesAt: '2026-06-30T00:00:00Z',
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

describe('TournamentDetailPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(apiClient.get).mockResolvedValue({ data: null });
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            isAuthenticated: true,
            user: { id: 1, profileComplete: true },
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
        expect(screen.getAllByText('A seasonal tournament')).toHaveLength(2);
    });

    it('shows the Back to Tournaments link', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        expect(await screen.findByRole('link', { name: 'Back to tournaments' })).toHaveAttribute('href', '/tournaments');
    });

    it('shows status badge', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        expect((await screen.findAllByText('Registration')).length).toBeGreaterThan(0);
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
        expect(await screen.findByText('Entry window')).toBeInTheDocument();
    });

    it('renders rules section when present', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        expect(await screen.findByText('Competition rules')).toBeInTheDocument();
        expect(screen.getByText('No fouls allowed')).toBeInTheDocument();
    });

    it('shows a useful rules empty state when rules are not present', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue({
            ...mockTournament,
            rules: null,
        });
        renderPage();
        await screen.findByText('Spring Cup');
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
        expect(screen.getByRole('link', { name: 'Back to tournaments' })).toBeInTheDocument();
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

    it('renders the tournament banner fallback when no image is available', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        expect(await screen.findByTestId('tournament-visual-fallback')).toBeInTheDocument();
    });

    it('renders useful empty states for participants and fixtures', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        expect(await screen.findByText('No confirmed entries yet')).toBeInTheDocument();
        expect(screen.getByText('Schedule coming soon')).toBeInTheDocument();
    });
});
