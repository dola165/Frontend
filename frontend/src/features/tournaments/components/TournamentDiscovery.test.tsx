import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '../../../i18n';
import { TournamentDiscovery, TournamentHosts } from './TournamentDiscovery';
import { fetchHostTournaments, fetchTournamentDiscovery, fetchTournamentHost, fetchTournamentHosts, setTournamentHostFollow } from '../api';
import { useAuth } from '../../../context/AuthContext';
import type { TournamentDiscoveryOverview, TournamentHost } from '../domain';

vi.mock('../api', () => ({ fetchHostTournaments: vi.fn(), fetchTournamentDiscovery: vi.fn(), fetchTournamentHost: vi.fn(), fetchTournamentHosts: vi.fn(), setTournamentHostFollow: vi.fn() }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: vi.fn() }));
const host: TournamentHost = { kind: 'CLUB', id: 1, name: 'Dinamo', logoUrl: null, tournamentCount: 14, following: false };
const overview: TournamentDiscoveryOverview = {
    highlights: [{ id: 1, name: 'Youth Cup', status: 'PLANNING', organizerOrganizationId: 2, participantScope: 'CLUB', visibility: 'PUBLIC', entryCount: 1 }],
    followedHosts: [], suggestedHosts: [host],
    shelves: [{ scope: 'CLUB', tournaments: [], total: 18 }, { scope: 'SQUAD', tournaments: [], total: 0 }, { scope: 'PLAYER', tournaments: [], total: 0 }],
};
const page = <T,>(content: T[], total = content.length) => ({ content, totalElements: total, totalPages: Math.ceil(total / 12), pageSize: 12, pageNumber: 0 });
const browse = vi.fn(), hosts = vi.fn(), open = vi.fn();
function renderOverview() {
    return render(<MemoryRouter><TournamentDiscovery onBrowse={browse} onHosts={hosts} onHost={open}/></MemoryRouter>);
}
beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true, user: { id: 1 } } as ReturnType<typeof useAuth>);
    vi.mocked(fetchTournamentDiscovery).mockResolvedValue(structuredClone(overview));
    vi.mocked(fetchTournamentHosts).mockResolvedValue(page([host]));
    vi.mocked(fetchTournamentHost).mockResolvedValue(host);
    vi.mocked(fetchHostTournaments).mockResolvedValue(page(overview.highlights, 14));
});

it('shows real categories and links spotlight to the competition before entry', async () => {
    renderOverview();
    expect(await screen.findByRole('link', { name: 'View Youth Cup' })).toHaveAttribute('href', '/tournaments/1');
    for (const title of ['Club competitions', 'Squad competitions', 'Player competitions']) expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByText('1 entry')).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('region', { name: 'Club competitions' })).getByRole('button', { name: 'View all 18' }));
    expect(browse).toHaveBeenCalledWith('CLUB');
    await userEvent.click(screen.getByRole('button', { name: 'Tournaments by Dinamo' }));
    expect(open).toHaveBeenCalledWith(host);
});
it('saves tournament follows through desired-state API and moves the host into personal interests', async () => {
    vi.mocked(setTournamentHostFollow).mockResolvedValue({ following: true });
    renderOverview();
    await userEvent.click(await screen.findByRole('button', { name: 'Follow Dinamo for tournaments' }));
    await screen.findByRole('heading', { name: 'Hosts you follow' });
    expect(setTournamentHostFollow).toHaveBeenCalledWith('CLUB', 1, true);
    expect(screen.getByRole('button', { name: 'Unfollow Dinamo for tournaments' })).toHaveAttribute('aria-pressed', 'true');
});
it('retains the previous state on failed follow and provides a retryable error', async () => {
    vi.mocked(setTournamentHostFollow).mockRejectedValue(new Error('offline'));
    renderOverview();
    await userEvent.click(await screen.findByRole('button', { name: 'Follow Dinamo for tournaments' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save this follow');
    expect(screen.getByRole('button', { name: 'Follow Dinamo for tournaments' })).toHaveAttribute('aria-pressed', 'false');
});
it('requires sign in for following without hiding public discovery', async () => {
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false } as ReturnType<typeof useAuth>);
    renderOverview();
    expect(await screen.findByRole('link', { name: 'Sign in to follow' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: 'Follow Dinamo for tournaments' })).not.toBeInTheDocument();
    expect(setTournamentHostFollow).not.toHaveBeenCalled();
});
it('does not display obsolete overview data after a failed refresh', async () => {
    vi.mocked(fetchTournamentDiscovery).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(overview);
    renderOverview();
    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Youth Cup');
    expect(fetchTournamentDiscovery).toHaveBeenCalledTimes(2);
});
it('ignores a completed request after the account view unmounts', async () => {
    let finish!: (value: TournamentDiscoveryOverview) => void;
    vi.mocked(fetchTournamentDiscovery).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = renderOverview(); view.unmount();
    await act(async () => finish(overview));
    expect(screen.queryByText('Youth Cup')).not.toBeInTheDocument();
});
it('opens a host profile and pages the complete host event result', async () => {
    render(<MemoryRouter><TournamentHosts kind="CLUB" hostId={1} onHost={open} onBack={hosts}/></MemoryRouter>);
    await screen.findByText('Youth Cup');
    expect(screen.getByRole('link', { name: 'View host profile' })).toHaveAttribute('href', '/clubs/1');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(fetchHostTournaments).toHaveBeenLastCalledWith({ kind: 'CLUB', id: 1, page: 1, size: 12 }));
});
it('searches and filters hosts on the server', async () => {
    render(<MemoryRouter><TournamentHosts kind={null} hostId={null} onHost={open} onBack={hosts}/></MemoryRouter>);
    await screen.findByText('Dinamo');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search hosts' }), 'dinamo');
    await userEvent.click(screen.getByRole('button', { name: 'Following only' }));
    await waitFor(() => expect(fetchTournamentHosts).toHaveBeenLastCalledWith({ page: 0, size: 12, search: 'dinamo', following: true }));
});
