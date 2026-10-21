import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { MyClubInvitationsPanel } from './MyClubInvitationsPanel';
import type { MyClubInvitation } from '../../clubs/domain';
import '../../../i18n';

const api = vi.hoisted(() => ({ load: vi.fn(), accept: vi.fn(), decline: vi.fn(), refresh: vi.fn() }));
const auth = vi.hoisted(() => ({ sessionId: 'one' }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ ...auth, refreshNavigationCapabilities: api.refresh }) }));
vi.mock('../../../utils/authStorage', () => ({ isCurrentAuthSession: (id: string) => id === auth.sessionId }));
vi.mock('../../clubs/api', () => ({ fetchMyClubInvitations: api.load, acceptClubInvitation: api.accept, declineClubInvitation: api.decline }));

const invitation: MyClubInvitation = { id: 8, clubId: 1, clubName: 'Synthetic club invitation', role: 'COACH', status: 'PENDING' };
const view = (onAccepted = vi.fn()) => <MemoryRouter><MyClubInvitationsPanel onInvitationAccepted={onAccepted} /></MemoryRouter>;
beforeEach(() => { vi.resetAllMocks(); auth.sessionId = 'one'; api.load.mockResolvedValue([invitation]); api.refresh.mockResolvedValue(undefined); api.accept.mockResolvedValue({ status: 'ACCEPTED' }); });

it('keeps the count unknown while loading and provides a real retry after failure', async () => {
    api.load.mockRejectedValueOnce(new Error('offline'));
    render(view());
    expect(screen.getByRole('status', { name: 'Loading invitations' })).toBeInTheDocument();
    expect(screen.queryByText('0 pending')).not.toBeInTheDocument();
    await screen.findByRole('alert');
    expect(screen.queryByText('You do not have any club invitations right now.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Synthetic club invitation');
    expect(screen.getByText('1 pending')).toBeInTheDocument();
});

it('refreshes a cancelled invitation on focus and removes its actions', async () => {
    render(view()); await screen.findByText('Synthetic club invitation');
    expect(screen.getByRole('button', { name: 'Accept' })).toBeEnabled();
    api.load.mockResolvedValue([{ ...invitation, status: 'CANCELLED' }]);
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Accept' })).toBeDisabled());
    expect(screen.getByText('0 pending')).toBeInTheDocument();
    expect(api.accept).not.toHaveBeenCalled();
});

it('locks duplicate responses, refreshes counts and navigation after confirmed acceptance', async () => {
    let done!: (value: { status: string }) => void;
    api.accept.mockReturnValue(new Promise(resolve => { done = resolve; }));
    const accepted = vi.fn(), changed = vi.fn(); window.addEventListener('requests-updated', changed);
    const rendered = render(view(accepted));
    try {
        fireEvent.click(await screen.findByRole('button', { name: 'Accept' }));
        fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
        expect(api.accept).toHaveBeenCalledExactlyOnceWith(8, { _authSessionId: 'one' });
        expect(screen.getByRole('button', { name: 'Decline' })).toBeDisabled();
        api.load.mockResolvedValue([{ ...invitation, status: 'ACCEPTED' }]);
        await act(async () => done({ status: 'ACCEPTED' }));
        expect(accepted).toHaveBeenCalledWith({ ...invitation, status: 'ACCEPTED' });
        expect(api.refresh).toHaveBeenCalledOnce(); expect(changed).toHaveBeenCalledOnce();
    } finally { rendered.unmount(); window.removeEventListener('requests-updated', changed); }
});

it('drops old account data and suppresses an old acceptance after the account changes', async () => {
    let done!: (value: { status: string }) => void;
    api.accept.mockReturnValue(new Promise(resolve => { done = resolve; }));
    const accepted = vi.fn(); const rendered = render(view(accepted));
    fireEvent.click(await screen.findByRole('button', { name: 'Accept' }));
    api.load.mockReturnValue(new Promise(() => {})); auth.sessionId = 'two'; rendered.rerender(view(accepted));
    expect(screen.queryByText('Synthetic club invitation')).not.toBeInTheDocument();
    expect(screen.queryByText('1 pending')).not.toBeInTheDocument();
    await act(async () => done({ status: 'ACCEPTED' }));
    expect(accepted).not.toHaveBeenCalled(); expect(api.refresh).not.toHaveBeenCalled();
});

it('reconciles a failed stale response with the current server status', async () => {
    api.accept.mockRejectedValue(new Error('cancelled elsewhere')); render(view());
    await screen.findByText('Synthetic club invitation'); api.load.mockResolvedValue([{ ...invitation, status: 'CANCELLED' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await screen.findByRole('alert');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Accept' })).toBeDisabled());
    expect(api.refresh).not.toHaveBeenCalled();
});
