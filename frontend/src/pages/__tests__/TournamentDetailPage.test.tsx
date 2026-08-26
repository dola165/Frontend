import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TournamentDetailPage } from '../../pages/TournamentDetailPage';
import type { TournamentDetail } from '../../features/tournaments/domain';

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
        expect(await screen.findByText('Tournament Not Found')).toBeInTheDocument();
        expect(screen.getByText('Failed to load tournament details.')).toBeInTheDocument();
    });

    it('shows not-found state when tournament is null', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        renderPage();
        expect(await screen.findByText('Tournament Not Found')).toBeInTheDocument();
    });

    it('renders tournament name and description on success', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        expect(await screen.findByText('Spring Cup')).toBeInTheDocument();
        expect(screen.getByText('A seasonal tournament')).toBeInTheDocument();
    });

    it('shows the Back to Tournaments link', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        expect(await screen.findByText(/Back to Tournaments/)).toBeInTheDocument();
    });

    it('shows status badge', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        expect(await screen.findByText('PLANNING')).toBeInTheDocument();
    });

    it('shows register button for PLANNING + PLAYER-scope tournament', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        expect(await screen.findByText('Register')).toBeInTheDocument();
    });

    it('hides register button when user is already registered', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue({
            ...mockTournament,
            entries: [{ id: 1, userId: 1, status: 'ACTIVE' } as any],
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
        await screen.findByText('Club');
        expect(screen.queryByRole('button', { name: /register/i })).not.toBeInTheDocument();
    });

    it('does not show register button for unauthenticated users', async () => {
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            isAuthenticated: false,
            user: null,
        });
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        await screen.findByText('Spring Cup');
        expect(screen.queryByText('Register')).not.toBeInTheDocument();
    });

    it('registers and refreshes tournament on success', async () => {
        const user = userEvent.setup();
        (fetchTournament as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce(mockTournament)
            .mockResolvedValueOnce({ ...mockTournament, entries: [{ id: 1, userId: 1, status: 'ACTIVE' } as any] });
        (registerPlayer as ReturnType<typeof vi.fn>).mockResolvedValue({});
        renderPage();
        const btn = await screen.findByText('Register');
        await user.click(btn);
        expect(registerPlayer).toHaveBeenCalledWith(42);
        expect(await screen.findByText('Successfully registered for the event.')).toBeInTheDocument();
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
            staffAssignments: [{ userId: 1, role: 'ORGANIZER', status: 'ACTIVE' } as any],
        });
        renderPage();
        expect(await screen.findByText('Workspace')).toBeInTheDocument();
    });

    it('renders scope and visibility badges', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        expect(await screen.findByText('Player')).toBeInTheDocument();
        expect(screen.getByText('Public')).toBeInTheDocument();
    });

    it('renders participant counts', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue({
            ...mockTournament,
            entries: [{ id: 1 } as any, { id: 2 } as any],
            fixtures: [{ id: 10 } as any],
        });
        renderPage();
        expect(await screen.findByText(/2 entries/)).toBeInTheDocument();
        expect(screen.getByText(/1 fixture/)).toBeInTheDocument();
    });

    it('renders dates when present', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        expect(await screen.findByText(/Registration:/)).toBeInTheDocument();
    });

    it('renders rules section when present', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournament);
        renderPage();
        expect(await screen.findByText('Rules')).toBeInTheDocument();
        expect(screen.getByText('No fouls allowed')).toBeInTheDocument();
    });

    it('omits rules section when not present', async () => {
        (fetchTournament as ReturnType<typeof vi.fn>).mockResolvedValue({
            ...mockTournament,
            rules: null,
        });
        renderPage();
        await screen.findByText('Spring Cup');
        expect(screen.queryByText('Rules')).not.toBeInTheDocument();
    });
});
