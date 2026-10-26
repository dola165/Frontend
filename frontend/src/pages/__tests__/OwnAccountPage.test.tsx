import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import '../../i18n';

const api = vi.hoisted(() => ({ fetchOwnAccountLink: vi.fn(), acceptOwnAccount: vi.fn() }));
const login = vi.hoisted(() => vi.fn());
vi.mock('../../api/ownAccount', () => api);
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ loginWithAccessToken: login }) }));
vi.mock('../../components/layout/GrasskickzLogo', () => ({ GrasskickzLogo: () => <span>GrassKickZ</span> }));

import { OwnAccountPage } from '../OwnAccountPage';

const Where = () => <output data-testid="where">{useLocation().pathname}</output>;

it('lets the child set a password and lands them in their own account', async () => {
    api.fetchOwnAccountLink.mockResolvedValue({ name: 'Luka Beridze', email: 'luka@example.test', status: 'PENDING' });
    api.acceptOwnAccount.mockResolvedValue({ accessToken: 'child-token', accountState: 'ACTIVE' });
    login.mockResolvedValue({ id: 31, profileComplete: true, onboardingRequired: false, mustChangePassword: false, emailVerified: true });
    render(<MemoryRouter initialEntries={['/own-account?token=abc']}><Routes><Route path="/own-account" element={<OwnAccountPage />} /><Route path="*" element={<Where />} /></Routes></MemoryRouter>);
    expect(await screen.findByText('Luka, set a password and sign in on your own. Your football history stays with you.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Your password'), { target: { value: 'weak' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set password and sign in' }));
    expect(api.acceptOwnAccount).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Your password'), { target: { value: 'StrongPass1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set password and sign in' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/home'));
    expect(api.acceptOwnAccount).toHaveBeenCalledWith('abc', 'StrongPass1');
    expect(login).toHaveBeenCalledWith('child-token');
});

it('says a used link no longer works', async () => {
    api.fetchOwnAccountLink.mockResolvedValue({ name: 'Luka', email: null, status: 'USED' });
    render(<MemoryRouter initialEntries={['/own-account?token=old']}><Routes><Route path="/own-account" element={<OwnAccountPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByText('This link no longer works.')).toBeInTheDocument();
});
