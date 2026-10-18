import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from '../../i18n';
import { NewChatModal } from './NewChatModal';
import type { UserSearchResult } from '../../api/chat';

const auth = vi.hoisted(() => ({ sessionId: 'A' }));
const api = vi.hoisted(() => ({ searchUsers: vi.fn(), createConversation: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../utils/authStorage', () => ({ getStoredUserId: () => '1', isCurrentAuthSession: (id: string) => id === auth.sessionId }));
vi.mock('../../api/chat', () => ({ chatApi: api }));
const person = (id: number, name: string, minor = false): UserSearchResult => ({ id, fullName: name, username: name.toLowerCase(), position: null, userType: 'PERSON', avatarUrl: null, isMinor: minor });
const mount = () => render(<NewChatModal open onClose={vi.fn()} onConversationCreated={vi.fn()} recentContacts={[person(2, 'Peer')]} />);
const search = (value: string) => fireEvent.change(screen.getByRole('textbox', { name: 'Search people' }), { target: { value } });
const tick = () => act(async () => { await vi.advanceTimersByTimeAsync(300); });

beforeEach(async () => { vi.resetAllMocks(); auth.sessionId = 'A'; await i18n.changeLanguage('en'); vi.useFakeTimers(); });
afterEach(async () => { vi.useRealTimers(); await i18n.changeLanguage('en'); });

it('keeps newer query results when an earlier search arrives late, and filters minors and self', async () => {
    let finishOld: (value: unknown) => void = () => {};
    api.searchUsers.mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; }))
        .mockResolvedValueOnce({ data: { content: [person(1, 'Me'), person(4, 'Minor', true), person(3, 'Latest')] } });
    mount(); search('old'); await tick(); search('new'); await tick();
    expect(screen.getByText('Latest')).toBeInTheDocument();
    await act(async () => finishOld({ data: { content: [person(9, 'Stale')] } }));
    expect(screen.getByText('Latest')).toBeInTheDocument();
    expect(screen.queryByText('Stale')).not.toBeInTheDocument();
    expect(screen.queryByText('Minor')).not.toBeInTheDocument();
    expect(screen.queryByText('Me')).not.toBeInTheDocument();
});

it('does not show an old account search response', async () => {
    let done: (value: unknown) => void = () => {};
    api.searchUsers.mockReturnValue(new Promise(resolve => { done = resolve; }));
    const { rerender } = mount(); search('peer'); await tick();
    auth.sessionId = 'B';
    rerender(<NewChatModal open onClose={vi.fn()} onConversationCreated={vi.fn()} recentContacts={[]} />);
    await act(async () => done({ data: { content: [person(9, 'Private match')] } }));
    expect(screen.queryByText('Private match')).not.toBeInTheDocument();
});

it('shows Georgian search failure and retries the same query without an empty-result claim', async () => {
    await act(async () => { await i18n.changeLanguage('ka'); });
    api.searchUsers.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: { content: [person(3, 'Found')] } });
    mount(); fireEvent.change(screen.getByRole('textbox', { name: 'ადამიანების ძიება' }), { target: { value: 'Found' } });
    await tick();
    expect(screen.getByRole('alert')).toHaveTextContent('ძიება ვერ მოხერხდა.');
    expect(screen.queryByText('ვერავინ მოიძებნა.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ხელახლა ცდა' })); await tick();
    expect(screen.getByText('Found')).toBeInTheDocument();
    expect(api.searchUsers.mock.calls.map(call => call[0])).toEqual(['Found', 'Found']);
});

it('keeps the group name, people and failed-create feedback when the language changes', async () => {
    api.createConversation.mockRejectedValue(new Error('offline'));
    mount(); fireEvent.click(screen.getByRole('button', { name: 'New group' })); fireEvent.click(screen.getByText('Peer'));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Group name' }), { target: { value: 'Keep this name' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Create group with 1 person' })));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not create the group.');
    await act(async () => { await i18n.changeLanguage('ka'); });
    expect(screen.getByRole('dialog', { name: 'ახალი ჩატი' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'ჯგუფის სახელი' })).toHaveValue('Keep this name');
    expect(screen.getByText('Peer')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('ჯგუფი ვერ შეიქმნა.');
    expect(api.createConversation).toHaveBeenCalledTimes(1);
});

it('does not open a late created conversation in a different account', async () => {
    let done: (value: unknown) => void = () => {};
    api.createConversation.mockReturnValue(new Promise(resolve => { done = resolve; }));
    const created = vi.fn();
    const view = () => <NewChatModal open onClose={vi.fn()} onConversationCreated={created} recentContacts={[person(2, 'Peer')]} />;
    const { rerender } = render(view());
    fireEvent.click(screen.getByText('Peer'));
    auth.sessionId = 'B'; rerender(view());
    await act(async () => done({ data: { id: 9 } }));
    expect(created).not.toHaveBeenCalled();
});
