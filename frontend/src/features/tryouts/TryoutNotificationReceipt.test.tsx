import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import '../../i18n';
import { TryoutNotificationReceipt } from './TryoutNotificationReceipt';
import { apiClient } from '../../api/axiosConfig';
import type { NotificationItem } from '../../types/notifications';
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 8 }, sessionId: 'one' }) }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
const notice: NotificationItem = { id: 5, type: 'TRYOUT_APPLICATION_ACCEPTED', entityType: 'tryout_application', entityId: 33, scope: 'PERSONAL', title: 'Tryout update', body: 'Accepted', isRead: true, createdAt: '2026-09-27T10:00:00' };
afterEach(cleanup); beforeEach(() => { vi.clearAllMocks(); vi.mocked(apiClient.get).mockResolvedValue({ data: [{ id: 33, tryoutId: 12, status: 'ACCEPTED' }] }); });
it('connects an old decision notice to the current applicant-owned receipt', async () => {
  render(<MemoryRouter><TryoutNotificationReceipt notification={notice} /></MemoryRouter>);
  expect(await screen.findByRole('link', { name: 'View current application' })).toHaveAttribute('href', '/tryouts/12');
  expect(apiClient.get).toHaveBeenCalledWith('/tryouts/my-applications', expect.objectContaining({ _authSessionId: 'one' }));
});
it('uses the authorized staff destination for withdrawal instead of another person’s private receipt', () => {
  render(<MemoryRouter><TryoutNotificationReceipt notification={{ ...notice, type: 'TRYOUT_APPLICATION_WITHDRAWN', scope: 'CLUB', clubId: 1, linkPath: '/clubs/1/workspace?tab=tryouts&applicationId=33' }} /></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Review current club application' })).toHaveAttribute('href', '/clubs/1/workspace?tab=tryouts&applicationId=33');
  expect(apiClient.get).not.toHaveBeenCalled();
});
