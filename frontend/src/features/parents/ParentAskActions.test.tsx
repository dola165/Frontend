import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ParentAskActions } from './ParentAskActions';
import type { NotificationItem } from '../../types/notifications';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: api, DEPLOYMENT_URLS: { mediaBaseUrl: '' } }));

const notice = { id: 1, type: 'FAMILY_PARENT_ASK', scope: 'PERSONAL', entityType: 'family_parent_ask', entityId: 9, title: 'Maia says they’re Nika’s parent', body: '', isRead: false, createdAt: '2026-11-04' } as NotificationItem;
const ask = { id: 9, adultName: 'Maia', childName: 'Nika', clubName: 'Dinamo', status: 'WAITING', answeredBy: null, canAnswer: true };
beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

it('asks with both names in place, and a yes says what happened', async () => {
    api.get.mockResolvedValue({ data: ask });
    api.post.mockResolvedValue({ data: undefined });
    render(<ParentAskActions notification={notice} />);
    fireEvent.click(await screen.findByRole('button', { name: 'I know Maia is Nika’s parent' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/family/parent-asks/9/answer', { yes: true }));
    expect(await screen.findByRole('status')).toHaveTextContent('Maia is Nika’s parent here now.');
});

it('Not their parent answers no', async () => {
    api.get.mockResolvedValue({ data: ask });
    api.post.mockResolvedValue({ data: undefined });
    render(<ParentAskActions notification={notice} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Not their parent' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/family/parent-asks/9/answer', { yes: false }));
    expect(await screen.findByRole('status')).toHaveTextContent('Maia isn’t Nika’s parent here.');
});

it('the first answer counts: a later one shows who answered, or the server’s words', async () => {
    api.get.mockResolvedValue({ data: { ...ask, status: 'YES', answeredBy: 'Olga' } });
    render(<ParentAskActions notification={notice} />);
    expect(await screen.findByRole('status')).toHaveTextContent('Olga already answered.');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    cleanup();
    api.get.mockResolvedValue({ data: ask });
    api.post.mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { code: 'ALREADY_ANSWERED', message: 'Olga already answered.' } } });
    render(<ParentAskActions notification={notice} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Not their parent' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Olga already answered.');
});

it('a wrong no is changed in place, and shows who said it and when', async () => {
    api.get.mockResolvedValue({ data: { ...ask, status: 'NO', answeredBy: 'Olga', answeredAt: '2026-11-03T10:00:00Z', canChangeNo: true } });
    api.post.mockResolvedValue({ data: undefined });
    render(<ParentAskActions notification={notice} />);
    expect(await screen.findByText(/^Olga said no · /)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Not their parent' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'I know Maia is Nika’s parent' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/family/parent-asks/9/change-to-yes'));
    expect(await screen.findByRole('status')).toHaveTextContent('Maia is Nika’s parent here now.');
});

it('a no the server won’t let this person change stays a plain line', async () => {
    api.get.mockResolvedValue({ data: { ...ask, status: 'NO', answeredBy: 'Olga', canChangeNo: false } });
    render(<ParentAskActions notification={notice} />);
    expect(await screen.findByRole('status')).toHaveTextContent('Olga already answered.');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('shows nothing to the person who asked, or on another notice', async () => {
    api.get.mockResolvedValue({ data: { ...ask, canAnswer: false } });
    const { container } = render(<ParentAskActions notification={notice} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    cleanup();
    const other = render(<ParentAskActions notification={{ ...notice, type: 'FAMILY_LINKED' }} />);
    expect(other.container).toBeEmptyDOMElement();
});
