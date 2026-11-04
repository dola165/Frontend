import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NotTheirParentAction } from './NotTheirParentAction';
import type { NotificationItem } from '../../types/notifications';

const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: api, DEPLOYMENT_URLS: { mediaBaseUrl: '' } }));

const notice = { id: 1, type: 'FAMILY_NEW_PARENT', scope: 'PERSONAL', entityType: 'family_guardian', entityId: 40, title: 'Nika has a new parent here', body: '', isRead: false, createdAt: '2026-11-04' } as NotificationItem;
beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

it('ends the link in place, and says what happened', async () => {
    api.post.mockResolvedValue({ data: undefined });
    render(<NotTheirParentAction notification={notice} />);
    fireEvent.click(screen.getByRole('button', { name: 'Not their parent' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/family/guardian-links/40/not-their-parent'));
    expect(await screen.findByRole('status')).toHaveTextContent('They’re no longer the parent here');
});

it('the server’s plain words when someone else answered first', async () => {
    api.post.mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { code: 'ALREADY_ANSWERED', message: 'Maia is no longer Nika’s parent here.' } } });
    render(<NotTheirParentAction notification={notice} />);
    fireEvent.click(screen.getByRole('button', { name: 'Not their parent' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Maia is no longer Nika’s parent here.');
});

it('shows nothing on any other notice', () => {
    const { container } = render(<NotTheirParentAction notification={{ ...notice, type: 'FAMILY_LINKED' }} />);
    expect(container).toBeEmptyDOMElement();
});
