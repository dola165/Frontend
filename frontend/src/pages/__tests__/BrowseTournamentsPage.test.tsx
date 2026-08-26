import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { BrowseTournamentsPage } from '../../pages/BrowseTournamentsPage';
import type { TournamentSummary } from '../../features/tournaments/domain';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

vi.mock('../../features/tournaments/api', () => ({
    fetchTournaments: vi.fn(),
    registerPlayer: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

vi.mock('../../utils/apiError', () => ({
    extractApiErrorMessage: vi.fn((_err: unknown, fallback: string) => fallback),
}));

import { fetchTournaments, registerPlayer } from '../../features/tournaments/api';
import { useAuth } from '../../context/AuthContext';

const makeTournament = (overrides: Partial<TournamentSummary> = {}): TournamentSummary => ({
    id: 1,
    name: 'Summer Showdown',
    status: 'PLANNING',
    organizerOrganizationId: 1,
    participantScope: 'PLAYER',
    visibility: 'PUBLIC',
    entryCount: 5,
    ...overrides,
});

const pageResult = (content: TournamentSummary[], totalPages = 1) => ({
    content,
    pageNumber: 0,
    pageSize: 12,
    totalElements: content.length,
    totalPages,
});

const renderPage = () =>
    render(
        <MemoryRouter>
            <BrowseTournamentsPage />
        </MemoryRouter>
    );

describe('BrowseTournamentsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            isAuthenticated: true,
            user: { id: 1 },
        });
    });

    it('shows loading spinner while fetching', () => {
        (fetchTournaments as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
        renderPage();
        expect(document.querySelector('.animate-spin')).toBeTruthy();
    });

    it('shows empty state when no tournaments exist', async () => {
        (fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(pageResult([]));
        renderPage();
        expect(await screen.findByText('No tournaments found')).toBeInTheDocument();
    });

    it('shows error banner when API fails', async () => {
        (fetchTournaments as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
        renderPage();
        expect(await screen.findByText('Failed to load events.')).toBeInTheDocument();
    });

    it('renders tournament cards on success', async () => {
        (fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(
            pageResult([makeTournament(), makeTournament({ id: 2, name: 'Winter Cup' })])
        );
        renderPage();
        expect(await screen.findByText('Summer Showdown')).toBeInTheDocument();
        expect(screen.getByText('Winter Cup')).toBeInTheDocument();
    });

    it('renders status badge on each card', async () => {
        (fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(pageResult([makeTournament()]));
        renderPage();
        expect(await screen.findByText('PLANNING')).toBeInTheDocument();
    });

    it('shows Register button for PLANNING + PLAYER-scope tournaments', async () => {
        (fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(pageResult([makeTournament()]));
        renderPage();
        expect(await screen.findByText('Register')).toBeInTheDocument();
    });

    it('shows Registered badge after successful registration', async () => {
        const user = userEvent.setup();
        (fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(pageResult([makeTournament()]));
        (registerPlayer as ReturnType<typeof vi.fn>).mockResolvedValue({});
        renderPage();

        const registerBtn = await screen.findByText('Register');
        await user.click(registerBtn);

        expect(registerPlayer).toHaveBeenCalledWith(1);
        expect(await screen.findByText('Registered')).toBeInTheDocument();
    });

    it('shows error toast when registration fails', async () => {
        const user = userEvent.setup();
        (fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(pageResult([makeTournament()]));
        (registerPlayer as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
        renderPage();

        const registerBtn = await screen.findByText('Register');
        await user.click(registerBtn);

        expect(await screen.findByText('Failed to register.')).toBeInTheDocument();
    });

    it('redirects unauthenticated users to login on register click', async () => {
        const user = userEvent.setup();
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            isAuthenticated: false,
            user: null,
        });
        (fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(pageResult([makeTournament()]));
        renderPage();

        const registerBtn = await screen.findByText('Register');
        await user.click(registerBtn);

        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/login'));
    });

    it('hides Register for non-PLAYER scope', async () => {
        (fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(
            pageResult([makeTournament({ participantScope: 'CLUB' })])
        );
        renderPage();
        await screen.findByText('Summer Showdown');
        expect(screen.queryByText('Register')).not.toBeInTheDocument();
    });

    it('hides Register for non-PLANNING status', async () => {
        (fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(
            pageResult([makeTournament({ status: 'ACTIVE' })])
        );
        renderPage();
        await screen.findByText('ACTIVE');
        expect(screen.queryByText('Register')).not.toBeInTheDocument();
    });

    it('shows tournament card links pointing to detail page', async () => {
        (fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(pageResult([makeTournament()]));
        renderPage();
        // Default view is list — the whole TournamentListCard is a Link; locate it via the title.
        const link = (await screen.findByText('Summer Showdown')).closest('a');
        expect(link).toHaveAttribute('href', '/tournaments/1');
    });

    it('filters tournaments by search query', async () => {
        const user = userEvent.setup();
        (fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(
            pageResult([makeTournament(), makeTournament({ id: 2, name: 'Winter Cup' })])
        );
        renderPage();
        await screen.findByText('Summer Showdown');

        const searchInput = screen.getByPlaceholderText('Search events...');
        await user.type(searchInput, 'winter');

        expect(screen.queryByText('Summer Showdown')).not.toBeInTheDocument();
        expect(screen.getByText('Winter Cup')).toBeInTheDocument();
    });

    it('shows pagination when multiple pages exist', async () => {
        (fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(
            pageResult([makeTournament()], 3)
        );
        renderPage();
        await screen.findByText('Summer Showdown');
        expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
    });

    // reason: BrowseTournamentsPage renders <PaginationBar> unconditionally (and PaginationBar always
    // shows "Page 1 of 1"), so the hide-on-single-page behavior no longer exists in the UI.
    it.skip('hides pagination for single-page results', async () => {
        (fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(pageResult([makeTournament()], 1));
        renderPage();
        await screen.findByText('Summer Showdown');
        expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
    });

    it('shows scope and visibility chips on cards', async () => {
        (fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(pageResult([makeTournament()]));
        renderPage();
        expect(await screen.findByText('Player')).toBeInTheDocument();
        expect(screen.getByText('Public')).toBeInTheDocument();
    });

    it('shows host club name when available', async () => {
        (fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(
            pageResult([makeTournament({ hostClubName: 'FC Barcelona' })])
        );
        renderPage();
        expect(await screen.findByText(/Hosted by FC Barcelona/)).toBeInTheDocument();
    });

    // reason: BrowseTournamentsPage now always renders the header "Create Tournament" link regardless
    // of auth (gating moved to /tournaments/setup); the hide-when-unauthenticated behavior was removed.
    it.skip('hides Create Event link when not authenticated', async () => {
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            isAuthenticated: false,
            user: null,
        });
        (fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(pageResult([]));
        renderPage();
        await screen.findByText('No tournaments found');
        expect(screen.queryByText('Create Event')).not.toBeInTheDocument();
    });
});
