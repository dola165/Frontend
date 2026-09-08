import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { ConsentPage } from '../ConsentPage';
import { apiClient } from '../../api/axiosConfig';
import { activatePlayerCard } from '../../features/clubs/api';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, isBootstrapping: false }) }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: { post: vi.fn() } }));
vi.mock('../../features/clubs/api', () => ({ activatePlayerCard: vi.fn() }));

const show = () => render(<MemoryRouter initialEntries={['/consent?token=invitation']}><ConsentPage /></MemoryRouter>);

describe('ConsentPage participation and account activation', () => {
    beforeEach(() => vi.clearAllMocks());

    it.each([false, undefined])('does not offer activation unless explicitly eligible (%s)', async (activationEligible) => {
        vi.mocked(apiClient.post).mockResolvedValue({ data: { accepted: true, cardId: 7, activationEligible } });
        show();
        fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
        expect(await screen.findByText(/Consent confirmed\. The club can now assign/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Activate Account' })).not.toBeInTheDocument();
    });

    it('keeps activation available after a recoverable failure without consuming consent again', async () => {
        vi.mocked(apiClient.post).mockResolvedValue({ data: { accepted: true, cardId: 7, activationEligible: true } });
        vi.mocked(activatePlayerCard).mockRejectedValueOnce(new Error('Temporary failure'))
            .mockResolvedValueOnce({ username: 'player_test', tempPassword: 'temporary' });
        show();
        fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
        const dob = await screen.findByLabelText("Child's Date of Birth");
        fireEvent.change(dob, { target: { value: `${new Date().getFullYear() - 14}-01-01` } });
        fireEvent.change(screen.getByLabelText("Child's Email (new, unused)"), { target: { value: 'child@example.com' } });
        fireEvent.click(screen.getByRole('button', { name: 'Activate Account' }));
        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(screen.getByLabelText("Child's Email (new, unused)")).toHaveValue('child@example.com');
        fireEvent.click(screen.getByRole('button', { name: 'Activate Account' }));
        await waitFor(() => expect(activatePlayerCard).toHaveBeenCalledTimes(2));
        expect(await screen.findByText('player_test')).toBeInTheDocument();
        expect(apiClient.post).toHaveBeenCalledOnce();
    });
});
