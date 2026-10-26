import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import '../../i18n';

const api = vi.hoisted(() => ({ fetchParentApproval: vi.fn(), sendParentApproval: vi.fn() }));
vi.mock('../../api/parentApproval', () => api);
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 3, email: 'teen@example.test' }, bootstrapSession: vi.fn(), logout: vi.fn() }) }));
vi.mock('../../components/layout/GrasskickzLogo', () => ({ GrasskickzLogo: () => <span>GrassKickZ</span> }));

import { WaitingForParentPage } from '../WaitingForParentPage';

beforeEach(() => { vi.clearAllMocks(); });

it('offers Try again when the status cannot be read, never the email form', async () => {
    api.fetchParentApproval.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ status: 'WAITING', parentEmail: 'parent@example.test', linkSent: true });
    render(<MemoryRouter><WaitingForParentPage /></MemoryRouter>);
    expect(await screen.findByText('This could not be loaded. Check your connection and try again.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Your parent’s email')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Sent to parent@example.test')).toBeInTheDocument();
    expect(api.sendParentApproval).not.toHaveBeenCalled();
});

it('lets "Use another email" go back to the link already sent', async () => {
    api.fetchParentApproval.mockResolvedValue({ status: 'WAITING', parentEmail: 'parent@example.test', linkSent: true });
    render(<MemoryRouter><WaitingForParentPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Use another email' }));
    expect(screen.getByLabelText('Your parent’s email')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep parent@example.test' }));
    expect(screen.getByText('Sent to parent@example.test')).toBeInTheDocument();
    expect(api.sendParentApproval).not.toHaveBeenCalled();
});
