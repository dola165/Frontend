import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ClubMessageModal, buildClubCommunicationOptions, openClubCommunication } from '../ClubMessageModal';
import { apiClient } from '../../../api/axiosConfig';
import { useAuth } from '../../../context/AuthContext';

vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: vi.fn() }));
const contact = { userId: 12, fullName: 'Sam Coach', role: 'COACH', title: 'Youth coach' };
const props = () => ({ clubId: 4, clubName: 'City FC', options: buildClubCommunicationOptions('+995 555 123 456'), onClose: vi.fn(), onOpenGrassKickZChat: vi.fn() });
beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear();
    vi.mocked(useAuth).mockReturnValue({ sessionId: null, status: 'authenticated', user: { id: 7 } } as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.get).mockResolvedValue({ data: [contact] });
});
it('opens a real staff conversation only after explicit selection and keeps external contacts optional', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null); const input = props();
    render(<ClubMessageModal {...input} />);
    const button = await screen.findByRole('button', { name: /Message Sam Coach/ });
    expect(apiClient.get).toHaveBeenCalledWith('/clubs/4/staff', expect.objectContaining({ _authSessionId: null, signal: expect.any(AbortSignal) }));
    expect(open).not.toHaveBeenCalled(); expect(input.onOpenGrassKickZChat).not.toHaveBeenCalled();
    fireEvent.click(button); fireEvent.click(button);
    expect(input.onOpenGrassKickZChat).toHaveBeenCalledExactlyOnceWith(12);
    fireEvent.click(screen.getByRole('button', { name: /WhatsApp/ }));
    expect(open).toHaveBeenCalledWith('https://wa.me/995555123456', '_blank', 'noopener,noreferrer'); open.mockRestore();
});
it('excludes the current account, invalid IDs and duplicate public staff identities', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [contact, contact, { userId: 7, fullName: 'Me' }, { userId: 0 }, { userId: '13' }] });
    render(<ClubMessageModal {...props()} />);
    expect(await screen.findAllByRole('button', { name: /Message Sam/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Message Me/ })).not.toBeInTheDocument();
});
it('shows a recoverable load error instead of claiming that staff do not exist', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('offline'));
    render(<ClubMessageModal {...props()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t load club contacts.');
    expect(screen.queryByText(/no other public staff/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry contacts' }));
    expect(await screen.findByRole('button', { name: /Message Sam/ })).toBeInTheDocument();
});
it('preserves a specific recipient for guest sign-in without claiming a club mailbox exists', async () => {
    vi.mocked(useAuth).mockReturnValue({ sessionId: null, status: 'anonymous', user: null } as ReturnType<typeof useAuth>);
    const input = props(); render(<ClubMessageModal {...input} />);
    fireEvent.click(await screen.findByRole('button', { name: /Sign in to message Sam/ }));
    expect(input.onOpenGrassKickZChat).toHaveBeenCalledWith(12);
    expect(screen.queryByText('Demo')).not.toBeInTheDocument();
});
it('uses an honest empty state without sending the user to a generic inbox', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    const input = props(); render(<ClubMessageModal {...input} options={[]} />);
    expect(await screen.findByText(/no other public staff contacts/)).toBeInTheDocument();
    expect(input.onOpenGrassKickZChat).not.toHaveBeenCalled();
});
it('does not navigate from a stale account even before React processes the session change', async () => {
    const input = props(); render(<ClubMessageModal {...input} />);
    const button = await screen.findByRole('button', { name: /Message Sam/ });
    localStorage.setItem('gk-session-id', 'replacement'); fireEvent.click(button);
    expect(input.onOpenGrassKickZChat).not.toHaveBeenCalled();
});
it('aborts an old club load and ignores its delayed response', async () => {
    let finish!: (value: { data: typeof contact[] }) => void;
    vi.mocked(apiClient.get).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const input = props(); const view = render(<ClubMessageModal {...input} />);
    const signal = vi.mocked(apiClient.get).mock.calls[0][1]?.signal;
    vi.mocked(apiClient.get).mockResolvedValue({ data: [{ ...contact, userId: 15, fullName: 'New Coach' }] });
    view.rerender(<ClubMessageModal {...input} clubId={5} />);
    expect(signal?.aborted).toBe(true);
    await screen.findByRole('button', { name: /Message New Coach/ });
    await act(async () => { finish({ data: [contact] }); });
    expect(screen.queryByRole('button', { name: /Message Sam/ })).not.toBeInTheDocument();
});
it('supports Escape and rejects executable external URLs', async () => {
    const input = props(); render(<ClubMessageModal {...input} />);
    await screen.findByRole('button', { name: /Message Sam/ });
    fireEvent.keyDown(document, { key: 'Escape' }); await waitFor(() => expect(input.onClose).toHaveBeenCalledOnce());
    expect(buildClubCommunicationOptions(null, 'javascript:alert(1)')).toEqual([]);
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    openClubCommunication({ id: 'FACEBOOK_MESSENGER', label: 'Bad URL', description: '', url: 'javascript:alert(1)', isRecommended: false });
    expect(open).not.toHaveBeenCalled(); open.mockRestore();
});
