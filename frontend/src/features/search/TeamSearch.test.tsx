import '../../i18n';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from './api';
import { TeamSearch } from './TeamSearch';

vi.mock('./api', async importOriginal => ({
    ...await importOriginal<typeof api>(), searchTeam: vi.fn(), fetchBestMatches: vi.fn(), reportMiss: vi.fn(), reportOpened: vi.fn(), fetchMissed: vi.fn(),
}));
// Team files are fetched with the sign-in; here the address itself stands in for the picture.
vi.mock('../../hooks/useMediaSource', () => ({ useMediaSource: (source?: string) => source }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1 } }) }));

const where = (extra: Partial<api.SearchWhere> = {}): api.SearchWhere => ({ key: null, status: null, plan: null, parent: null, chat: null, person: null, at: null, tasks: null, openTasks: null, ...extra });
const open = (extra: Partial<api.SearchOpen> = {}): api.SearchOpen => ({ task: null, step: null, plan: null, view: null, who: null, message: null, conversation: null, ...extra });
const task = (id: number, title: string, extra: Partial<api.SearchHit> = {}): api.SearchHit => ({
    kind: 'TASK', id, title, why: { field: 'NAME', by: null, text: title, marks: [{ start: 0, end: Math.min(4, title.length) }] },
    where: where({ key: `GK-${id}`, status: 'IN_PROGRESS', plan: { id: 9, name: 'Registration and roles' } }), open: open({ task: id }), file: null, ...extra,
});
const plan: api.SearchHit = { kind: 'PLAN', id: 9, title: 'Registration and roles', why: { field: 'NAME', by: null, text: 'Registration and roles', marks: [{ start: 0, end: 12 }, { start: 17, end: 22 }] },
    where: where({ status: 'NOW', openTasks: 6 }), open: open({ plan: 9 }), file: null };
const comment = task(31, 'Checkout', { why: { field: 'COMMENT', by: 'Beqa', text: 'Payments go through Keepz, not Stripe', marks: [{ start: 20, end: 25 }] } });
const message: api.SearchHit = { kind: 'MESSAGE', id: 70, title: 'Gio Beridze', why: { field: 'MESSAGE', by: 'Gio Beridze', text: 'დღეს კოდით რეგისტრაცია უნდა დავასრულოთ', marks: [{ start: 11, end: 22 }] },
    where: where({ chat: { id: 2, name: 'Team chat' }, person: { id: 2, name: 'Gio Beridze' }, at: new Date().toISOString(), tasks: [{ id: 21, key: 'GK-21', title: 'User registration', status: 'NEEDS_LOOK' }] }),
    open: open({ message: 70, conversation: 2 }), file: null };
const picture: api.SearchHit = { kind: 'CHAT_FILE', id: 5, title: 'dinamo-arena.jpg', why: { field: 'SENT_WITH', by: 'Beqa', text: 'Stadium photos for the venue page', marks: [{ start: 0, end: 7 }] },
    where: where({ chat: { id: 2, name: 'Team chat' }, person: { id: 1, name: 'Beqa' }, at: new Date().toISOString() }), open: open({ message: 71, conversation: 2 }),
    file: { kind: 'IMAGE', name: 'dinamo-arena.jpg', url: '/uploads/team-work/a.jpg', thumbUrl: '/uploads/team-work/a-thumb.jpg', contentType: 'image/jpeg', width: 640, height: 480 } };
const results = (extra: Partial<api.SearchResults> = {}): api.SearchResults => ({
    query: 'registration and roles', words: ['registration', 'roles'], askBest: false,
    groups: [{ group: 'WORK', hits: [plan, task(21, 'User registration'), comment], more: true }, { group: 'CHATS', hits: [message], more: false }, { group: 'FILES', hits: [picture], more: false }],
    ...extra,
});

function Where() { const location = useLocation(); return <output data-testid="where">{location.pathname + location.search}</output>; }
function Go({ to }: { to: string }) { const navigate = useNavigate(); return <button type="button" onClick={() => navigate(to)}>go {to}</button>; }
const mount = () => render(<MemoryRouter initialEntries={['/team-work']}><Routes>
    <Route path="/team-work" element={<><TeamSearch /><input aria-label="Elsewhere" /><Go to="/team-work?task=44" /><Where /></>} />
    <Route path="/team-work/chat" element={<Where />} />
</Routes></MemoryRouter>);
const box = () => screen.getByRole('combobox', { name: 'Search words' });

beforeEach(() => {
    vi.resetAllMocks();
    window.sessionStorage.clear();
    vi.mocked(api.searchTeam).mockResolvedValue(results());
    vi.mocked(api.fetchBestMatches).mockResolvedValue({ status: 'SURE', hits: [] });
    vi.mocked(api.reportMiss).mockResolvedValue({ id: 77 });
    vi.mocked(api.reportOpened).mockResolvedValue(undefined);
    vi.mocked(api.fetchMissed).mockResolvedValue([]);
});

it('opens with the box, with / and with Ctrl+K, but / typed in a field stays a character', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: /Search tasks, plans, chats and pictures/ }));
    expect(box()).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: /Close/ }));
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: 'Elsewhere' }), 'a/b');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await userEvent.click(document.body);
    await userEvent.keyboard('/');
    expect(box()).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await userEvent.keyboard('{Control>}k{/Control}');
    expect(box()).toBeInTheDocument();
    expect(api.searchTeam).not.toHaveBeenCalled();
});

it('waits for typing to pause and cancels an older search', async () => {
    let first: AbortSignal | undefined;
    vi.mocked(api.searchTeam).mockImplementationOnce((_q, signal) => { first = signal; return new Promise(() => {}); }).mockResolvedValue(results());
    mount();
    await userEvent.keyboard('/');
    await userEvent.type(box(), 'registration');
    // One search for the settled words, not one per letter.
    await waitFor(() => expect(api.searchTeam).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.searchTeam).mock.calls[0][0]).toBe('registration');
    await userEvent.type(box(), ' roles');
    await waitFor(() => expect(api.searchTeam).toHaveBeenCalledTimes(2));
    expect(first?.aborted).toBe(true);
    expect(vi.mocked(api.searchTeam).mock.calls[1][0]).toBe('registration roles');
});

it('shows each result as its short name, why it matched and where it is, by group, and Enter opens the top one', async () => {
    mount();
    await userEvent.keyboard('/');
    await userEvent.type(box(), 'registration and roles');
    await screen.findAllByRole('option');
    const list = screen.getByRole('listbox', { name: 'Results' });
    const groups = within(list).getAllByRole('group');
    expect(groups.map(group => group.getAttribute('aria-labelledby') && document.getElementById(group.getAttribute('aria-labelledby')!)?.textContent))
        .toEqual(['Tasks and plans', 'Chats', 'Pictures and files']);
    const options = within(list).getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[0]).toHaveTextContent('Registration and roles');
    expect(within(options[0]).getAllByText(/Registration|roles/, { selector: 'mark' })).toHaveLength(2);
    expect(options[0]).toHaveTextContent('Now');
    expect(options[0]).toHaveTextContent('6 open');
    expect(options[2]).toHaveTextContent('Checkout');
    expect(options[2]).toHaveTextContent('Comment by Beqa: Payments go through Keepz, not Stripe');
    expect(within(options[2]).getByText('Keepz', { selector: 'mark' })).toBeInTheDocument();
    expect(options[3]).toHaveTextContent('Show more');
    expect(options[4]).toHaveTextContent('Gio Beridze');
    expect(options[4]).toHaveTextContent('Team chat');
    expect(options[4]).toHaveTextContent('about GK-21 User registration');
    expect(options[5].querySelector('img')).toHaveAttribute('src', '/uploads/team-work/a-thumb.jpg');
    expect(options[5]).toHaveTextContent('Sent by Beqa with: Stadium photos for the venue page');

    await userEvent.keyboard('{ArrowDown}');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowUp}{Enter}');
    expect(screen.getByTestId('where')).toHaveTextContent('/team-work?plan=9');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});

it('a chat result opens the chat at its message; Show more brings the next ten', async () => {
    mount();
    await userEvent.keyboard('/');
    await userEvent.type(box(), 'registration and roles');
    await screen.findAllByRole('option');
    vi.mocked(api.searchTeam).mockResolvedValueOnce(results({ groups: [{ group: 'WORK', hits: [task(40, 'Password reset email')], more: false }] }));
    await userEvent.click(screen.getByRole('option', { name: 'Show more' }));
    expect(api.searchTeam).toHaveBeenLastCalledWith('registration and roles', undefined, { group: 'WORK', offset: 3, limit: 10 });
    expect(await screen.findByRole('option', { name: /Password reset email/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Show more' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', { name: /Gio Beridze/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/team-work/chat?chat=2&message=70');
});

it('asks for the best matches only for a vague search, once the words settle, and shows them first', async () => {
    vi.mocked(api.searchTeam).mockResolvedValue(results({ askBest: true }));
    vi.mocked(api.fetchBestMatches).mockResolvedValue({ status: 'PICKED', hits: [task(22, 'Define roles and what each can do', { why: { field: 'MEANING', by: null, text: '', marks: [] } })] });
    mount();
    await userEvent.keyboard('/');
    await userEvent.type(box(), 'who can do what stuff');
    const best = await screen.findByText('Best matches', {}, { timeout: 3000 });
    expect(api.fetchBestMatches).toHaveBeenCalledTimes(1);
    expect(api.fetchBestMatches).toHaveBeenCalledWith('who can do what stuff', expect.any(AbortSignal));
    const first = screen.getAllByRole('option')[0];
    expect(first).toHaveTextContent('Define roles and what each can do');
    expect(first).toHaveTextContent('Picked by meaning, not by the words');
    expect(best).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('where')).toHaveTextContent('/team-work?task=22');
});

it('a clear search never asks for the best matches', async () => {
    mount();
    await userEvent.keyboard('/');
    await userEvent.type(box(), 'registration and roles');
    await screen.findAllByRole('option');
    await act(() => new Promise(resolve => setTimeout(resolve, 1000)));
    expect(api.fetchBestMatches).not.toHaveBeenCalled();
});

it('“Not what I was looking for” keeps the words and the results shown, then what is opened next', async () => {
    mount();
    await userEvent.keyboard('/');
    await userEvent.type(box(), 'registration and roles');
    await screen.findAllByRole('option');
    await userEvent.click(screen.getByRole('button', { name: 'Not what I was looking for' }));
    expect(api.reportMiss).toHaveBeenCalledWith('registration and roles', [
        { kind: 'PLAN', id: 9 }, { kind: 'TASK', id: 21 }, { kind: 'TASK', id: 31 }, { kind: 'MESSAGE', id: 70 }, { kind: 'CHAT_FILE', id: 5 }]);
    expect(await screen.findByText(/Now open what you were looking for/)).toBeInTheDocument();
    // Opened by hand on Team work, not from the results: that is what was wanted.
    await userEvent.click(screen.getByRole('button', { name: /Close/ }));
    await userEvent.click(screen.getByRole('button', { name: 'go /team-work?task=44' }));
    await waitFor(() => expect(api.reportOpened).toHaveBeenCalledWith(77, { kind: 'TASK', id: 44 }));
    // Only once.
    await userEvent.keyboard('/');
    await userEvent.type(box(), 'x');
    await userEvent.click(await screen.findByRole('option', { name: /^User registration/ }));
    expect(api.reportOpened).toHaveBeenCalledTimes(1);
});

it('what search missed lists the words, who, and what they opened instead', async () => {
    vi.mocked(api.fetchMissed).mockResolvedValue([
        { id: 1, query: 'flow after registration', by: { id: 2, name: 'Gio Beridze' }, at: new Date().toISOString(), shown: 3, opened: task(44, 'The flow after sign-up'), openedAt: new Date().toISOString() },
        { id: 2, query: 'stadium pics', by: { id: 3, name: 'Ilo' }, at: new Date().toISOString(), shown: 0, opened: null, openedAt: null },
    ]);
    mount();
    await userEvent.keyboard('/');
    await userEvent.click(screen.getByRole('button', { name: 'What search missed' }));
    const dialog = await screen.findByRole('dialog', { name: 'What search missed' });
    expect(await within(dialog).findByText('“flow after registration”')).toBeInTheDocument();
    expect(within(dialog).getByText(/Gio Beridze/)).toBeInTheDocument();
    expect(within(dialog).getByText('Nothing opened after')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'GK-44 The flow after sign-up' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/team-work?task=44');
});

it('says so when nothing is found or search fails', async () => {
    vi.mocked(api.searchTeam).mockResolvedValueOnce(results({ groups: [] }));
    mount();
    await userEvent.keyboard('/');
    await userEvent.type(box(), 'zzz');
    expect(await screen.findByText(/Nothing found for “zzz”/)).toBeInTheDocument();
    vi.mocked(api.searchTeam).mockRejectedValueOnce(new Error('down'));
    await userEvent.type(box(), 'q');
    expect(await screen.findByRole('alert')).toHaveTextContent('Search isn’t working right now');
});
