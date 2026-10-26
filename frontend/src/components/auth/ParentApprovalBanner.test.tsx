import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import '../../i18n';

const auth = vi.hoisted(() => ({ user: { id: 4, email: 'teen@example.test', accountState: 'ACTIVE', parentApprovalDueAt: '2026-11-26' } as Record<string, unknown> }));
const api = vi.hoisted(() => ({ fetchParentApproval: vi.fn(), sendParentApproval: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: auth.user, bootstrapSession: vi.fn().mockResolvedValue(null) }) }));
vi.mock('../../api/parentApproval', () => api);

import { ParentApprovalBanner } from './ParentApprovalBanner';

beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); auth.user = { id: 4, email: 'teen@example.test', accountState: 'ACTIVE', parentApprovalDueAt: '2026-11-26' }; });

it('asks an older 13–15 account to get a parent’s approval by the date, with the same parent-email flow', async () => {
    api.fetchParentApproval.mockResolvedValue({ status: 'GRACE', parentEmail: null, linkSent: false, switchesToWaitingAt: '2026-11-26T09:00:00Z' });
    api.sendParentApproval.mockResolvedValue({ status: 'GRACE', parentEmail: 'parent@example.test', linkSent: true, switchesToWaitingAt: '2026-11-26T09:00:00Z' });
    render(<ParentApprovalBanner />);
    expect(screen.getByText('Ask your parent to approve your account by 26 November.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ask my parent' }));
    fireEvent.change(await screen.findByLabelText('Your parent’s email'), { target: { value: 'parent@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText('Sent to parent@example.test')).toBeInTheDocument();
    expect(screen.getByText('Ask them to open the email. After 26 November your account waits for their approval.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(api.sendParentApproval).toHaveBeenCalledWith('parent@example.test');
});

it('stays away for accounts without a due date, waiting ones, and after Later', () => {
    auth.user = { id: 5, accountState: 'ACTIVE', parentApprovalDueAt: null };
    const { unmount } = render(<ParentApprovalBanner />);
    expect(screen.queryByRole('status')).toBeNull();
    unmount();
    auth.user = { id: 4, accountState: 'AWAITING_PARENT', parentApprovalDueAt: '2026-11-26' };
    render(<ParentApprovalBanner />);
    expect(screen.queryByRole('status')).toBeNull();
});
