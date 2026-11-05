import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '../../../i18n';
import type { JoiningChild } from '../api';

const api = vi.hoisted(() => ({ approveChildAccount: vi.fn() }));
vi.mock('../api', () => api);

import { ApproveAccount } from './ApproveAccount';

const child = (parentApproval: JoiningChild['parentApproval']) => ({ playerId: 31, identity: { playerId: 31, version: 1, fullName: 'Luka Beridze', dateOfBirth: '2012-02-01', gender: null, photoUrl: null, positions: [], dominantFoot: null, heightCm: null, weightKg: null, canEdit: true, minor: true },
    clubs: [], cases: [], inquiries: [], parentApproval }) as JoiningChild;

beforeEach(async () => { vi.clearAllMocks(); await i18n.changeLanguage('en'); });

it('approves a waiting child in one tap', async () => {
    api.approveChildAccount.mockResolvedValue({ childName: 'Luka Beridze', status: 'APPROVED' });
    const changed = vi.fn();
    render(<ApproveAccount child={child({ status: 'WAITING', dueAt: '2026-11-03T10:00:00Z' })} onChanged={changed} />);
    expect(screen.getByText('Approve Luka’s account')).toBeInTheDocument();
    expect(screen.getByText('Removed on 3 November without your approval.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('Luka’s account is approved.')).toBeInTheDocument();
    expect(api.approveChildAccount).toHaveBeenCalledWith(31);
    expect(changed).toHaveBeenCalled();
});

it('names the day a grace account starts waiting, refreshes when nothing waits, and shows nothing otherwise', async () => {
    api.approveChildAccount.mockRejectedValue({ response: { status: 409, data: { code: 'PARENT_APPROVAL_NOT_NEEDED' } } });
    const changed = vi.fn();
    const { unmount } = render(<ApproveAccount child={child({ status: 'GRACE', dueAt: '2026-11-26T09:00:00Z' })} onChanged={changed} />);
    expect(screen.getByText('Works until 26 November, then waits for your approval.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await vi.waitFor(() => expect(changed).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
    unmount();
    const { container } = render(<ApproveAccount child={child(null)} onChanged={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
});
