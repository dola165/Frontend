import '../../i18n';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { SquadInboxConversation } from './SquadInbox';
import { activeRoom } from './squadRoomWords';
import * as api from './api';

vi.mock('./api', async original => ({ ...(await original<typeof api>()), overview: vi.fn(), messages: vi.fn(), postMessage: vi.fn(), markRead: vi.fn(), chooseRooms: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 's', user: { fullName: 'Teo Teen' } }) }));
vi.mock('../../components/auth/AddMyParentButton', () => ({ AddMyParentButton: () => <p>Add my parent link</p> }));

const base = { id: 171, viewer_id: 7, name: 'U16', academy_name: 'Synthetic academy', can_manage: false, threads: [], child_threads: [] } as unknown as api.SquadOverview;
const rooms = (mine: api.SquadRoom[], extra: Partial<api.SquadRooms> = {}): api.SquadOverview => ({ ...base, rooms: { separate: true, can_switch: false, mine, unread: {}, ...extra } });
const show = (path = '/messages?squadId=171') => render(<MemoryRouter initialEntries={[path]}><SquadInboxConversation id={171} /></MemoryRouter>);

beforeEach(() => {
    vi.mocked(api.messages).mockReset().mockResolvedValue([]);
    vi.mocked(api.postMessage).mockReset().mockResolvedValue({ data: { id: 5 } } as never);
    vi.mocked(api.chooseRooms).mockReset().mockResolvedValue({} as never);
});

it('shows a player only the players’ room, with who it is for', async () => {
    vi.mocked(api.overview).mockResolvedValue(rooms(['PLAYERS']));
    show();
    expect(await screen.findByRole('heading', { name: 'Players’ room' })).toBeInTheDocument();
    expect(screen.getByText('For the squad’s players and coaches.')).toBeInTheDocument();
    expect(screen.queryByText(/parents and coaches/)).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Rooms' })).not.toBeInTheDocument();
    await waitFor(() => expect(api.messages).toHaveBeenCalledWith(171, 'CHAT', null, expect.any(AbortSignal), undefined, 'PLAYERS'));
});

it('shows a parent only the parents’ room and posts there', async () => {
    vi.mocked(api.overview).mockResolvedValue(rooms(['PARENTS']));
    show();
    expect(await screen.findByText('For the squad’s parents and coaches.')).toBeInTheDocument();
    await userEvent.type(await screen.findByRole('textbox'), 'Who drives?');
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(api.postMessage).toHaveBeenCalledWith(171, expect.objectContaining({ room: 'PARENTS', body: 'Who drives?' })));
});

it('lets a coach move between both rooms with their unread counts, and keeps the room in the address', async () => {
    vi.mocked(api.overview).mockResolvedValue(rooms(['PLAYERS', 'PARENTS'], { can_switch: true, unread: { PARENTS: 3 } }));
    show('/messages?squadId=171&room=PLAYERS');
    const nav = await screen.findByRole('navigation', { name: 'Rooms' });
    expect(nav).toHaveTextContent('Players’ room');
    expect(nav).toHaveTextContent('Parents’ room3');
    expect(screen.getByRole('link', { name: 'Players’ room' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Parents’ room/ })).toHaveAttribute('href', '/messages?squadId=171&room=PARENTS');
});

it('keeps one room behind the switch, and only a coach sees the switch', async () => {
    vi.mocked(api.overview).mockResolvedValue({ ...base, can_manage: true, rooms: { separate: false, can_switch: true, mine: ['PLAYERS', 'PARENTS'], unread: {} } });
    show();
    expect(await screen.findByRole('heading', { name: 'Squad chat' })).toBeInTheDocument();
    expect(screen.getByText('For everyone in the squad and its coaches.')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Rooms' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: 'Separate rooms for players and parents' }));
    await waitFor(() => expect(api.chooseRooms).toHaveBeenCalledWith(171, true));
});

it('tells a teen with no parent what to do instead of offering a private chat', async () => {
    vi.mocked(api.overview).mockResolvedValue({ ...rooms(['PLAYERS']), viewer_needs_parent: true });
    show('/messages?squadId=171&channel=coach');
    expect(await screen.findByText('Add your parent so coaches can message you.')).toBeInTheDocument();
    expect(screen.getByText('Add my parent link')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

it('tells the coach to use the players’ room for a player with no parent', async () => {
    vi.mocked(api.overview).mockResolvedValue({ ...rooms(['PLAYERS', 'PARENTS']), can_manage: true, threads: [{ user_id: 31, full_name: 'Nika', unread_count: 0, needs_parent: true }] });
    show('/messages?squadId=171&channel=coach&thread=31');
    expect(await screen.findByText(/has no parent here yet/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

it('chooses the room asked for only if the reader is in it', () => {
    expect(activeRoom(rooms(['PLAYERS']), 'PARENTS')).toBe('PLAYERS');
    expect(activeRoom(rooms(['PLAYERS', 'PARENTS']), 'PARENTS')).toBe('PARENTS');
    expect(activeRoom(rooms(['PLAYERS', 'PARENTS'], { unread: { PARENTS: 1 } }))).toBe('PARENTS');
    expect(activeRoom({ ...base, rooms: { separate: false, can_switch: false, mine: ['PLAYERS'], unread: {} } }, 'PLAYERS')).toBeNull();
    expect(activeRoom(base)).toBeNull();
});
