import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../i18n';
import { IdentityActivationForm } from '../IdentityActivationForm';
import { apiClient } from '../../../api/axiosConfig';
const auth = vi.hoisted(() => ({ sessionId: 'identity-session' }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { post: vi.fn() } }));
vi.mock('../../../utils/authStorage', () => ({ isCurrentAuthSession: (id: string) => id === auth.sessionId }));
const fill = () => {
    fireEvent.change(screen.getByLabelText('Recorded date of birth'), { target: { value: '2000-05-06' } });
    fireEvent.change(screen.getByLabelText('Recipient’s own email'), { target: { value: 'adult@example.test' } });
};
describe('Identity invitation', () => {
    beforeEach(() => { vi.clearAllMocks(); auth.sessionId = 'identity-session'; });
    it('explains adult acceptance and sends the invitation to the recorded identity', async () => {
        vi.mocked(apiClient.post).mockResolvedValue({ data: { status: 'EMAIL_VERIFICATION_PENDING' } });
        render(<IdentityActivationForm childId={42} adult onChanged={vi.fn()} />);
        expect(screen.getByText(/grants no guardian access/)).toBeInTheDocument();
        fill(); fireEvent.click(screen.getByRole('button', { name: 'Send account invitation' }));
        await screen.findByRole('status');
        expect(apiClient.post).toHaveBeenCalledWith('/family/children/42/activation', { dateOfBirth: '2000-05-06', email: 'adult@example.test' }, { _authSessionId: 'identity-session' });
        expect(screen.getByRole('status')).toHaveTextContent('verify their mailbox');
        expect(screen.queryByText(/temporary password/i)).not.toBeInTheDocument();
    });
    it('suppresses duplicate clicks and discards a response after the account changes', async () => {
        let finish!: (value: { data: object }) => void;
        vi.mocked(apiClient.post).mockReturnValue(new Promise(resolve => { finish = resolve; }));
        const changed = vi.fn(); render(<IdentityActivationForm childId={42} onChanged={changed} />);
        fill(); fireEvent.click(screen.getByRole('button', { name: 'Send account invitation' }));
        fireEvent.click(screen.getByRole('button', { name: 'Sending…' }));
        expect(apiClient.post).toHaveBeenCalledOnce(); auth.sessionId = 'another-session';
        await act(async () => { finish({ data: {} }); });
        expect(screen.queryByRole('status')).not.toBeInTheDocument(); expect(changed).not.toHaveBeenCalled();
    });
    it('keeps recipient input available after a recoverable delivery failure', async () => {
        vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Delivery failed')).mockResolvedValueOnce({ data: {} });
        render(<IdentityActivationForm adult path="/clubs/3/player-cards/7/activation-invitation" onChanged={vi.fn()} />);
        fill(); fireEvent.click(screen.getByRole('button', { name: 'Send account invitation' }));
        await screen.findByRole('alert'); expect(screen.getByLabelText('Recipient’s own email')).toHaveValue('adult@example.test');
        fireEvent.click(screen.getByRole('button', { name: 'Send account invitation' }));
        await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2)); await screen.findByRole('status');
    });
});
