import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { chatApi } from '../../../../api/chat';
import { emitNotificationsChanged } from '../../../../utils/notifications';
import { useUnreadMessages } from '../useUnreadMessages';

vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'session-1' }) }));
vi.mock('../../../../api/chat', () => ({ chatApi: { getConversations: vi.fn() } }));

const conversations = (...unread: number[]) =>
    ({ data: { content: unread.map((unreadCount, id) => ({ id, unreadCount })) } }) as unknown as Awaited<ReturnType<typeof chatApi.getConversations>>;
function Count() { return <output>{useUnreadMessages() ?? '…'}</output>; }

beforeEach(() => { vi.resetAllMocks(); });

it('looks again as soon as a chat is read, so the header count drops at once', async () => {
    vi.mocked(chatApi.getConversations).mockResolvedValue(conversations(3, 0, 1));
    render(<MemoryRouter><Count /></MemoryRouter>);
    expect(await screen.findByText('2')).toBeInTheDocument();
    vi.mocked(chatApi.getConversations).mockResolvedValue(conversations(0, 0, 1));
    act(() => emitNotificationsChanged({ chatRead: true }));
    expect(await screen.findByText('1')).toBeInTheDocument();
});
