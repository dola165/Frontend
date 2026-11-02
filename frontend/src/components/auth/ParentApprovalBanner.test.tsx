import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import '../../i18n';

const auth = vi.hoisted(() => ({ user: { id: 4, email: 'teen@example.test', accountState: 'ACTIVE', parentApprovalDueAt: '2026-11-26' } as Record<string, unknown> }));
const api = vi.hoisted(() => ({ fetchParentApproval: vi.fn() }));
const links = vi.hoisted(() => ({ addMyParentLink: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: auth.user, bootstrapSession: vi.fn().mockResolvedValue(null) }) }));
vi.mock('../../api/parentApproval', () => api);
vi.mock('../../features/parents/familyLinks', () => links);

import { ParentApprovalBanner } from './ParentApprovalBanner';

beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); auth.user = { id: 4, email: 'teen@example.test', accountState: 'ACTIVE', parentApprovalDueAt: '2026-11-26' }; });

it('asks an older 13–15 account to get a parent’s approval by the date, with the same "Add my parent" link', async () => {
    api.fetchParentApproval.mockResolvedValue({ status: 'GRACE', parentEmail: null, linkSent: false, switchesToWaitingAt: '2026-11-26T09:00:00Z' });
    links.addMyParentLink.mockResolvedValue({ id: 1, kind: 'ADD_PARENT', code: 'c'.repeat(43), path: `/family-link/${'c'.repeat(43)}`, expiresAt: '2026-11-26T00:00:00Z', personId: 4, personName: 'Luka' });
    render(<ParentApprovalBanner />);
    expect(screen.getByText('Ask your parent to approve your account by 26 November.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ask my parent' }));
    expect(await screen.findByDisplayValue(`${window.location.origin}/family-link/${'c'.repeat(43)}`)).toBeInTheDocument();
    expect(screen.queryByLabelText('Your parent’s email')).toBeNull();
    expect(links.addMyParentLink).toHaveBeenCalledTimes(1);
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
