import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '../../../api/axiosConfig';
import { ClubSquadRoster } from './ClubSquadRoster';
import { ClubSquadPage } from './ClubSquadPage';
import type { ClubProfile } from './types';
import i18n from '../../../i18n';

const auth = vi.hoisted(() => ({ sessionId: 'one', isAuthenticated: true, status: 'authenticated' }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../api/axiosConfig', () => ({ DEPLOYMENT_URLS: { mediaBaseUrl: '' }, apiClient: { get: vi.fn() } }));
const rows = [{ label: 'Squad', players: [{ id: 10, name: 'Synthetic player', number: 7, position: 'STRIKER', status: 'TRIALIST', isRegistered: false }] }];
const view = (squadId = 12) => <MemoryRouter><ClubSquadRoster clubId={1} squadId={squadId} /></MemoryRouter>;
beforeEach(async () => { await i18n.changeLanguage('en'); vi.clearAllMocks(); auth.sessionId = 'one'; auth.isAuthenticated = true; auth.status = 'authenticated'; localStorage.clear(); vi.mocked(apiClient.get).mockResolvedValue({ data: rows }); });
afterEach(async () => { cleanup(); await i18n.changeLanguage('en'); });

it('reads the selected roster and filters it without showing private management fields', async () => {
    render(view());
    expect(await screen.findByText('Synthetic player')).toBeVisible();
    expect(apiClient.get).toHaveBeenCalledWith('/clubs/1/squads/12/roster', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(screen.queryByText('Trialist')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Manage roster' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search players or shirt number'), { target: { value: 'missing' } });
    expect(screen.queryByText('Synthetic player')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Synthetic player')).toBeVisible();
});
it('keeps a single roster management link in the squad header', async () => {
    const club: ClubProfile = { id: 1, name: 'Synthetic academy', description: '', type: 'ACADEMY', isOfficial: false, statusLabel: '', followerCount: 0, memberCount: 0, isFollowedByMe: false, isStaffMember: true, isMember: true, trustedByClubs: [], honours: [], opportunities: [] };
    vi.mocked(apiClient.get).mockImplementation(async url => ({ data: String(url).endsWith('/roster') ? rows : String(url).endsWith('/training-schedule') ? { canView: false, sessions: [] } : [] }));
    render(<MemoryRouter><ClubSquadPage club={club} squad={{ id: 12, name: 'Academy U12', category: 'U12' }} programmes={[]} onContact={() => undefined} isAuthenticated canManage /></MemoryRouter>);
    await screen.findByText('Synthetic player');
    expect(screen.getAllByRole('link', { name: 'Manage roster' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Manage roster' })).toHaveAttribute('href', '/clubs/1/office?tab=squads&squad=12');
});

it.each(['Roster', 'Cards'])('distinguishes no search/filter matches from an empty squad in %s view', async mode => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [{ label: 'Squad', players: [...rows[0].players, { id: 11, name: 'Other player', position: 'GOALKEEPER' }] }] });
    render(view()); await screen.findByText('Synthetic player');
    fireEvent.click(screen.getByRole('button', { name: mode }));
    fireEvent.change(screen.getByLabelText('Position'), { target: { value: 'GOALKEEPER' } });
    fireEvent.change(screen.getByLabelText('Search players or shirt number'), { target: { value: 'Synthetic' } });
    expect(screen.getByText('No matching players')).toBeVisible();
    expect(screen.queryByText('No players to show in this squad yet.')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Clear filters' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Synthetic player')).toBeVisible();
    expect(screen.getByText('Other player')).toBeVisible();
});

it('translates roster controls, position codes and filtered empty state into Georgian', async () => {
    await i18n.changeLanguage('ka');
    vi.mocked(apiClient.get).mockResolvedValue({ data: [{ label: 'Squad', players: [{ id: 10, name: 'Synthetic player', position: 'RIGHT_BACK' }, { id: 11, name: 'Other player', position: 'GOALKEEPER' }] }] });
    render(view()); await screen.findByText('Synthetic player');
    expect(screen.getByRole('option', { name: 'მარჯვენა მცველი' })).toHaveValue('RIGHT_BACK');
    expect(screen.getByRole('option', { name: 'მეკარე' })).toHaveValue('GOALKEEPER');
    fireEvent.click(screen.getByRole('button', { name: 'ბარათები' }));
    fireEvent.change(screen.getByLabelText('მოძებნეთ მოთამაშე ან მაისურის ნომერი'), { target: { value: 'missing' } });
    expect(screen.getByText('შესაბამისი მოთამაშეები ვერ მოიძებნა')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'ფილტრების გასუფთავება' }));
    expect(screen.getByText('Synthetic player')).toBeVisible();
});
it('shows a retry for a failed read and hides old account and squad replies', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('offline'));
    const rendered = render(view());
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    await screen.findByText('Synthetic player');
    let resolve!: (value: unknown) => void;
    vi.mocked(apiClient.get).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    rendered.rerender(view(13));
    auth.sessionId = 'two';
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    rendered.rerender(view(14));
    await act(async () => resolve({ data: rows }));
    expect(screen.queryByText('Synthetic player')).not.toBeInTheDocument();
});
it('asks guests to sign in before reading a roster', () => {
    auth.isAuthenticated = false; auth.status = 'anonymous';
    render(view());
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?next=%2Fclubs%2F1%3Ftab%3Dteams%26squad%3D12');
    expect(apiClient.get).not.toHaveBeenCalled();
});
