import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { AppHeader } from '../AppHeader';
import type { AuthUser } from '../../../../context/AuthContext';
import * as agentDola from '../../../../features/dola/agentDola';
import * as oldDola from '../../../../features/dola/api';

vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1 }, sessionId: 'session-1', status: 'authenticated' }) }));
vi.mock('../../../../features/dola/agentDola', () => ({ agentDolaStatus: vi.fn() }));
vi.mock('../../../../features/dola/api', () => ({ dolaStatus: vi.fn() }));
vi.mock('../useUnreadMessages', () => ({ useUnreadMessages: () => 0 }));

const user = { id: 1, fullName: 'Luka Gelashvili', avatarUrl: null, navigationCapabilities: { version: 1, workspaces: [] } } as unknown as AuthUser;
const teamMember = { ...user, navigationCapabilities: { version: 1, workspaces: [{ id: 'team.work', context: { type: 'user', id: 1, label: 'Team work' } }] } } as unknown as AuthUser;
const header = (who: AuthUser = user) => render(<MemoryRouter initialEntries={['/home']}><AppHeader user={who} myClubId={null} themePreference="map-light"
    setThemePreference={vi.fn()} onLogout={vi.fn()} /></MemoryRouter>);
const oldStatus = (available: boolean) => ({ name: 'Agent Dola', available, mode: 'REVIEWED_ACTIONS_PILOT', maxMessageLength: 2000, capabilities: [] });

beforeEach(() => { vi.resetAllMocks(); });

it('offers Agent Dola to every customer, opening its panel over Home in a new tab', async () => {
    vi.mocked(agentDola.agentDolaStatus).mockResolvedValue({ available: true, maxMessageLength: 8000, writer: false, reason: null, welcome: '', examples: [] });
    header();
    expect(await screen.findByRole('link', { name: 'Agent Dola' })).toHaveAttribute('href', '/home?dola=open');
    expect(oldDola.dolaStatus).not.toHaveBeenCalled();
});

it('takes a team member to Team work with the Dola panel open in a new tab', async () => {
    vi.mocked(agentDola.agentDolaStatus).mockResolvedValue({ available: true, maxMessageLength: 8000, writer: false, reason: null, welcome: '', examples: [] });
    header(teamMember);
    expect(await screen.findByRole('link', { name: 'Agent Dola' })).toHaveAttribute('href', '/team-work?dola=open');
});

it('shows no link when an older server has no Agent Dola for this account and the old assistant is off', async () => {
    vi.mocked(agentDola.agentDolaStatus).mockRejectedValue({ response: { status: 404 } });
    vi.mocked(oldDola.dolaStatus).mockResolvedValue(oldStatus(false));
    header();
    await waitFor(() => expect(oldDola.dolaStatus).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: 'Agent Dola' })).not.toBeInTheDocument();
});

it('shows no link when Dola is switched off and the old assistant cannot be reached', async () => {
    vi.mocked(agentDola.agentDolaStatus).mockResolvedValue({ available: false, maxMessageLength: 8000, writer: false, reason: 'SWITCHED_OFF', welcome: '', examples: [] });
    vi.mocked(oldDola.dolaStatus).mockRejectedValue(new Error('offline'));
    header();
    await waitFor(() => expect(oldDola.dolaStatus).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: 'Agent Dola' })).not.toBeInTheDocument();
});

it('keeps the old assistant link while the old assistant is on', async () => {
    vi.mocked(agentDola.agentDolaStatus).mockRejectedValue({ response: { status: 404 } });
    vi.mocked(oldDola.dolaStatus).mockResolvedValue(oldStatus(true));
    header();
    expect(await screen.findByRole('link', { name: 'Agent Dola' })).toHaveAttribute('href', '/assistant');
});
