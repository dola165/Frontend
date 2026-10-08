import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { BrowseTournamentsPage } from '../../pages/BrowseTournamentsPage';
import type { MyOrganization, TournamentSummary } from '../../features/tournaments/domain';

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
    fetchMyTournaments: vi.fn(),
    fetchMyTournamentInvitations: vi.fn(),
    fetchMyOrganizations: vi.fn(),
    registerPlayer: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

vi.mock('../../utils/apiError', () => ({
    extractApiErrorMessage: vi.fn((_err: unknown, fallback: string) => fallback),
}));

import { fetchMyOrganizations, fetchMyTournaments, fetchTournaments, registerPlayer } from '../../features/tournaments/api';
import { useAuth } from '../../context/AuthContext';
import {browsePersonalCompetitions} from '../../features/competitions/api';
vi.mock('../../features/competitions/api',()=>({browsePersonalCompetitions:vi.fn()}));

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
        <MemoryRouter initialEntries={['/tournaments?view=discover']}>
            <BrowseTournamentsPage />
        </MemoryRouter>
    );

describe('BrowseTournamentsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchMyOrganizations).mockResolvedValue([]);
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
        expect(await screen.findByText('Failed to load tournaments.')).toBeInTheDocument();
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
        expect(await screen.findByText('Registration')).toBeInTheDocument();
    });

    it('opens the detail before registration so entrants can inspect the policy and dates', async () => {
        vi.mocked(fetchTournaments).mockResolvedValue(pageResult([makeTournament()]));
        renderPage();
        expect(await screen.findByRole('link', { name: 'View Summer Showdown' })).toHaveAttribute('href', '/tournaments/1');
        expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();
        expect(registerPlayer).not.toHaveBeenCalled();
    });
    it('loads personal tournaments through their protected endpoint', async () => {
        vi.mocked(fetchTournaments).mockResolvedValue(pageResult([]));
        vi.mocked(browsePersonalCompetitions).mockResolvedValue(pageResult([makeTournament({ name: 'My private cup' })]));
        renderPage();
        await userEvent.click(screen.getByRole('button', { name: 'My tournaments' }));
        expect(await screen.findByText('My private cup')).toBeInTheDocument();
        expect(browsePersonalCompetitions).toHaveBeenCalledWith({ page: 0, size: 12, status: undefined, search: undefined, scope: undefined });
        expect(fetchMyTournaments).not.toHaveBeenCalled();
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
        await screen.findByText('In progress');
        expect(screen.queryByText('Register')).not.toBeInTheDocument();
    });

    it('shows tournament card links pointing to detail page', async () => {
        (fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(pageResult([makeTournament()]));
        renderPage();
        // Default view is list — the whole TournamentListCard is a Link; locate it via the title.
        const link = (await screen.findByText('Summer Showdown')).closest('a');
        expect(link).toHaveAttribute('href', '/tournaments/1');
    });

    it('sends search to the server and renders the complete paged result', async () => {
        const user = userEvent.setup();
        (fetchTournaments as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce(pageResult([makeTournament()], 3))
            .mockResolvedValue(pageResult([makeTournament({ id: 8, name: 'Winter Cup' })], 2));
        renderPage();
        await screen.findByText('Summer Showdown');

        const searchInput = screen.getByPlaceholderText('Search by tournament, host, or organizer...');
        await user.type(searchInput, 'winter');

        expect(await screen.findByText('Winter Cup')).toBeInTheDocument();
        await waitFor(() => expect(fetchTournaments).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0, size: 12, search: 'winter' })));
        expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });

    it('shows pagination when multiple pages exist', async () => {
        (fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(
            pageResult([makeTournament()], 3)
        );
        renderPage();
        await screen.findByText('Summer Showdown');
        expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
    });

    it('shows the single page without implying more results', async () => {
        (fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(pageResult([makeTournament()], 1));
        renderPage();
        await screen.findByText('Summer Showdown');
        expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    });

    it('shows scope and visibility chips on cards', async () => {
        (fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(pageResult([makeTournament()]));
        renderPage();
        expect(await screen.findByText('Players', { selector: 'span' })).toBeInTheDocument();
        expect(screen.getByText('Public')).toBeInTheDocument();
    });

    it('shows host club name when available', async () => {
        (fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(
            pageResult([makeTournament({ hostClubName: 'FC Barcelona' })])
        );
        renderPage();
        expect(await screen.findByText(/Hosted by FC Barcelona/)).toBeInTheDocument();
    });

    it('renders a polished banner fallback when no image is provided', async () => {
        (fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(pageResult([makeTournament()]));
        renderPage();
        expect(await screen.findByTestId('tournament-visual-fallback')).toBeInTheDocument();
    });

    it('shows the create action for server organization capability regardless of account persona', async () => {
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            isAuthenticated: true,
            user: { id: 2, role: 'PLAYER' },
        });
        vi.mocked(fetchMyOrganizations).mockResolvedValue([{ id: 9, canCreateTournament: true }] as MyOrganization[]);
        (fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(pageResult([]));
        renderPage();
        expect(await screen.findByRole('link', { name: 'Create tournament' })).toHaveAttribute('href', '/tournaments/setup');
    });

    it('keeps organizer setup reachable without inventing a creation capability from a persona', async () => {
        vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true, user: { id: 2, role: 'ORGANIZER' } } as ReturnType<typeof useAuth>);
        vi.mocked(fetchTournaments).mockResolvedValue(pageResult([]));
        renderPage();
        await screen.findByText('No tournaments found');
        expect(screen.queryByRole('link', { name: 'Create tournament' })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Tournament setup' })).toHaveAttribute('href', '/tournaments/setup');
    });

    it('ignores an old account capability response after the account changes', async () => {
        let finishOld!: (organizations: MyOrganization[]) => void;
        vi.mocked(fetchMyOrganizations).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; })).mockResolvedValue([]);
        vi.mocked(fetchTournaments).mockResolvedValue(pageResult([]));
        const view = renderPage();
        vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true, user: { id: 2, role: 'FAN' } } as ReturnType<typeof useAuth>);
        view.rerender(<MemoryRouter initialEntries={['/tournaments?view=discover']}><BrowseTournamentsPage /></MemoryRouter>);
        await act(async () => finishOld([{ id: 9, canCreateTournament: true }] as MyOrganization[]));
        expect(screen.queryByRole('link', { name: 'Create tournament' })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Tournament setup' })).toBeInTheDocument();
    });

    it('hides tournament creation when not authenticated', async () => {
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            isAuthenticated: false,
            user: null,
        });
        (fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(pageResult([]));
        renderPage();
        await screen.findByText('No tournaments found');
        expect(screen.queryByRole('link', { name: 'Create tournament' })).not.toBeInTheDocument();
        expect(fetchMyOrganizations).not.toHaveBeenCalled();
    });
});
