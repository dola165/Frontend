import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '../../../api/axiosConfig';
import { ClubSquadRoster } from './ClubSquadRoster';
import '../../../i18n';

const auth = vi.hoisted(() => ({ sessionId: 'one', isAuthenticated: true, status: 'authenticated' }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../api/axiosConfig', () => ({ DEPLOYMENT_URLS: { mediaBaseUrl: '' }, apiClient: { get: vi.fn() } }));
const rows = [{ label: 'Squad', players: [{ id: 10, name: 'Synthetic player', number: 7, position: 'STRIKER', status: 'TRIALIST', isRegistered: false }] }];
const view = (squadId = 12, canManage = false) => <MemoryRouter><ClubSquadRoster clubId={1} squadId={squadId} canManage={canManage} /></MemoryRouter>;
beforeEach(() => { vi.clearAllMocks(); auth.sessionId = 'one'; auth.isAuthenticated = true; auth.status = 'authenticated'; localStorage.clear(); vi.mocked(apiClient.get).mockResolvedValue({ data: rows }); });
afterEach(cleanup);

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
it('keeps roster management in the authorised workspace with the selected squad', async () => {
    render(view(12, true));
    expect(await screen.findByRole('link', { name: 'Manage roster' })).toHaveAttribute('href', '/clubs/1/workspace?tab=squads&squad=12');
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
