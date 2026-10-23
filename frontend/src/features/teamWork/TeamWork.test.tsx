import '../../i18n';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from './api';
import { planAsText } from './planAsText';
import { TeamWorkPage } from './TeamWorkPage';
import { TeamWorkHomeRow } from './TeamWorkHomeRow';

vi.mock('./api', async importOriginal => ({
    ...await importOriginal<typeof api>(), fetchBoard: vi.fn(), fetchDetail: vi.fn(), createWork: vi.fn(), changeWork: vi.fn(), fetchRoadmaps: vi.fn(), fetchRoadmap: vi.fn(),
    createRoadmap: vi.fn(), changeRoadmap: vi.fn(), pasteIntoRoadmap: vi.fn(), fetchTeam: vi.fn(), addMember: vi.fn(), newInvite: vi.fn(), removeMember: vi.fn(), fetchVersions: vi.fn(),
    addComment: vi.fn(), addPicture: vi.fn(), addVideo: vi.fn(), deleteWork: vi.fn(),
}));
vi.mock('../../pages/RouteRecoveryPage', () => ({ RouteRecoveryPage: () => <p>Page not found</p> }));
// The reader is Beqa.
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1 } }) }));

const now = new Date().toISOString();
const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
const beqa = { id: 1, name: 'Beqa' }, gio = { id: 2, name: 'Gio Beridze' }, ilo = { id: 3, name: 'Ilo' };
const team = [beqa, gio, ilo];
const item = (id: number, title: string, status: api.WorkStatus, percent: number, extra: Partial<api.WorkItem> = {}): api.WorkItem => ({
    id, title, area: null, status, percent, step: null, notes: null, branch: null, prUrl: null, version: 0, updatedBy: beqa, updatedAt: now, createdAt: now,
    parentId: null, description: null, startedOn: null, end: { kind: 'UNKNOWN' }, percentFromParts: false, people: [], mediaCount: 0, commentCount: 0, small: false, ...extra,
});
const roadmap = (id: number, name: string, extra: Partial<api.Roadmap> = {}): api.Roadmap => ({ id, name, copiedFrom: null, copiedFromName: null, version: 3, pieceCount: 2, updatedBy: beqa, updatedAt: now, createdAt: now,
    status: 'NOW', percent: 55, inProgress: 3, toDo: 2, finished: 1, nextPiece: 'Branding and landing', ...extra });
const branding = item(1, 'Branding and landing', 'IN_PROGRESS', 70, { startedOn: '2026-10-20', end: { kind: 'ABOUT', amount: 1, unit: 'WEEKS' }, people: [beqa] });
const parts = [item(11, 'Founders’ design', 'FINISHED', 100, { parentId: 1 }), item(12, 'Hero copy', 'PLANNED', 0, { parentId: 1 }), item(13, 'Cloudflare lock', 'IN_PROGRESS', 50, { parentId: 1 })];
const started = (author: api.Person) => ({ id: 99, author, at: twoDaysAgo, message: 'Started' });
const view = (pieces: api.WorkNode[], extra: Partial<api.RoadmapView> = {}): api.RoadmapView => ({
    roadmap: roadmap(5, 'October work'), pieces, changes: [{ id: 1, author: beqa, at: now, message: 'Added Branding and landing' }, started(beqa)],
    trail: [], team, canManageTeam: true, ...extra,
});
const october = view([{ item: branding, parts }, { item: item(2, 'Registration', 'ON_HOLD', 30, { step: 'Waiting for email provider', people: [gio] }), parts: [] },
    { item: item(3, 'Save button on phones', 'PLANNED', 0, { small: true }), parts: [] }]);
const plans: Record<number, api.RoadmapView> = {
    5: october,
    6: view([{ item: item(21, 'User registration', 'IN_PROGRESS', 20, { people: [ilo] }), parts: [] }], { roadmap: roadmap(6, 'Registration and roles', { percent: 20, inProgress: 1, toDo: 4, finished: 0, nextPiece: 'User registration' }), changes: [started(ilo)] }),
    4: view([{ item: item(31, 'Schedules', 'FINISHED', 100), parts: [] }], { roadmap: roadmap(4, 'This week’s work', { updatedAt: twoDaysAgo, status: 'FINISHED', percent: 100 }), changes: [] }),
    7: view([{ item: item(41, 'Checkout', 'PLANNED', 0, { createdAt: monthAgo }), parts: [] }], { roadmap: roadmap(7, 'Store', { status: 'LATER', percent: 0 }), changes: [] }),
};
/** Every item on these plans, parts included, once each: what the board returns. */
const boardOf = (views: api.RoadmapView[]) => [...new Map(views.flatMap(found => found.pieces.flatMap(node => [node.item, ...node.parts])).map(work => [work.id, work])).values()];
const detail = (work: api.WorkItem, extra: Partial<api.Detail> = {}): api.Detail => ({ item: work, updates: [], parts: [], media: [], comments: [], ...extra });
const note = (id: number, author: api.Person, message: string) => ({ id, author, at: now, previousStatus: null, status: null, previousPercent: null, percent: null, message });
function Where() { const location = useLocation(); return <output data-testid="where">{location.search}</output>; }
const mount = (path = '/team-work') => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/team-work" element={<><TeamWorkPage /><Where /></>} /></Routes></MemoryRouter>);
const useLists = (...extra: api.RoadmapView[]) => {
    vi.mocked(api.fetchRoadmaps).mockResolvedValue([...[5, 6, 4, 7].map(id => plans[id].roadmap), ...extra.map(found => found.roadmap)]);
    vi.mocked(api.fetchRoadmap).mockImplementation(async id => extra.find(found => found.roadmap.id === id) ?? plans[id]);
    vi.mocked(api.fetchBoard).mockResolvedValue({ items: boardOf([...Object.values(plans), ...extra]), trail: [], canManageTeam: true });
};

beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.fetchTeam).mockResolvedValue([{ userId: 1, name: 'Nino', email: 'nino@example.com', admin: true, addedAt: null, pending: false }]);
    useLists();
});

it('starts with this week’s work as tasks on their own when there is nothing yet', async () => {
    vi.mocked(api.fetchRoadmaps).mockResolvedValueOnce([]);
    vi.mocked(api.fetchBoard).mockResolvedValueOnce({ items: [], trail: [], canManageTeam: true });
    vi.mocked(api.createWork).mockResolvedValue(detail(branding));
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Load this week’s work' }));
    await waitFor(() => expect(api.createWork).toHaveBeenCalledTimes(api.STARTER_WORK.length));
    expect(api.createWork).toHaveBeenCalledWith(api.STARTER_WORK[0]);
    expect(api.createRoadmap).not.toHaveBeenCalled();
});

it('opens on groups: the weeks with tasks added, done and open, then the projects, filtered by name, with no progress bars', async () => {
    mount();
    const groups = (await screen.findByRole('heading', { name: 'Groups' })).closest('section')!;
    expect(within(groups).getAllByRole('button').map(box => box.textContent)).toEqual([
        'This week5 added · 1 done · 4 open', 'Last weekNothing yet', 'Earlier1 added · 0 done · 1 open',
        'October work3 tasks · 0 done · 3 open', 'Registration and roles1 task · 0 done · 1 open', 'StoreLater1 task · 0 done · 1 open', 'This week’s workFinished1 task · 1 done · 0 open',
        'New project']);
    expect(within(groups).queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/roadmap/i)).not.toBeInTheDocument();

    const names = screen.getByRole('group', { name: 'Show work for' });
    expect(within(names).getByRole('button', { name: 'Everyone' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(within(names).getByRole('button', { name: 'Ilo' }));
    expect(screen.getByTestId('where')).toHaveTextContent('who=3');
    expect(within(groups).getAllByRole('button').map(box => box.querySelector('.tw-group__name')?.textContent).filter(Boolean)).toEqual(['This week', 'Last week', 'Registration and roles']);
    await userEvent.click(within(names).getByRole('button', { name: 'Everyone' }));

    // A week and a project each open their own page.
    await userEvent.click(within(groups).getByRole('button', { name: /^This week\s*5 added/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('when=week');
    expect(screen.getByRole('heading', { name: 'This week', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('5 added · 1 done · 4 open')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Added this week 5/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Groups' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to progress' }));
    expect(screen.getByTestId('where')).not.toHaveTextContent('when=');
    await userEvent.click(within(await screen.findByRole('heading', { name: 'Groups' }).then(heading => heading.closest('section')!)).getByRole('button', { name: /^Registration and roles/ }));
    expect(screen.getByRole('heading', { name: 'Registration and roles', level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('roadmap=6');
});

it('lists every task as a card with its project and stages, finished ones folded away, and opens a card to its details in place', async () => {
    const all = boardOf(Object.values(plans));
    vi.mocked(api.fetchDetail).mockImplementation(async id => detail(all.find(work => work.id === id)!, id === 1 ? { parts } : {}));
    mount();
    const tasks = (await screen.findByRole('heading', { name: 'All tasks 6' })).closest('section')!;
    const cards = within(tasks).getAllByRole('button', { name: /%|Not started|Started|Halfway|Nearly done|Done/ });
    expect(cards.map(card => card.querySelector('.tw-task__name')?.textContent)).toEqual(['Branding and landing', 'User registration', 'Registration', 'Save button on phones', 'Checkout']);
    expect(cards[0]).toHaveTextContent('70%');
    expect(cards[0]).toHaveTextContent('October work · 3 stages · Beqa');
    expect(within(tasks).queryByText('Schedules')).not.toBeInTheDocument();
    await userEvent.click(within(tasks).getByRole('button', { name: 'Show finished (1)' }));
    expect(screen.getByTestId('where')).toHaveTextContent('finished=show');
    expect(within(tasks).getByText('Schedules')).toBeInTheDocument();

    // The colour key filters by status, through the URL.
    const statuses = within(tasks).getByRole('group', { name: 'Show by status' });
    await userEvent.click(within(statuses).getByRole('button', { name: 'Planned' }));
    expect(screen.getByTestId('where')).toHaveTextContent('status=PLANNED');
    expect(within(tasks).getAllByRole('button', { name: /%|Not started|Started|Halfway|Nearly done|Done/ }).map(card => card.querySelector('.tw-task__name')?.textContent)).toEqual(['Save button on phones', 'Checkout']);
    await userEvent.click(within(statuses).getByRole('button', { name: 'Finished' }));
    expect(within(tasks).getAllByRole('button', { name: /%|Not started|Started|Halfway|Nearly done|Done/ })).toHaveLength(3);
    await userEvent.click(within(statuses).getByRole('button', { name: 'Planned' }));
    await userEvent.click(within(statuses).getByRole('button', { name: 'Finished' }));
    expect(screen.getByTestId('where')).not.toHaveTextContent('status=');

    // A big task shows its stages as plain rows; a stage opens below it.
    await userEvent.click(within(tasks).getByRole('button', { name: /Branding and landing/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('task=1');
    const piece = await within(tasks).findByRole('region', { name: 'Branding and landing' });
    expect(within(piece).getByRole('heading', { name: 'Stages' })).toBeInTheDocument();
    expect(within(piece).getByRole('button', { name: 'Add a stage' })).toBeInTheDocument();
    await userEvent.click(within(piece).getByRole('button', { name: /Hero copy/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('open=12');
    expect(await within(tasks).findByRole('region', { name: 'Hero copy' })).toBeInTheDocument();

    // A small fix has no stages to add.
    await userEvent.click(within(tasks).getByRole('button', { name: /Save button on phones/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('task=3');
    const small = await within(tasks).findByRole('region', { name: 'Save button on phones' });
    expect(within(small).queryByRole('button', { name: 'Add a stage' })).not.toBeInTheDocument();
});

it('takes findings with a name and a tagged comment; anyone marks them seen or acknowledges them and pushes one to Pending, never straight onto a project', async () => {
    const login = item(51, 'Login button overlaps', 'PLANNED', 0), old = item(52, 'Old idea', 'PLANNED', 0, { createdAt: twoDaysAgo });
    const intake = view([{ item: login, parts: [] }, { item: old, parts: [] }], { roadmap: roadmap(8, 'Add to plans'), changes: [] });
    const comment = { id: 5, author: gio, body: 'It covers the logo on phones, @Beqa can you look?', createdAt: now, editedAt: null, canEdit: false };
    useLists(intake);
    vi.mocked(api.fetchDetail).mockImplementation(async id => id === 51 ? detail(login, { updates: [note(1, gio, 'Added')], comments: [comment] })
        : detail(old, { updates: [note(3, beqa, 'Seen'), note(2, ilo, 'Added')] }));
    vi.mocked(api.changeWork).mockImplementation(async (id, change) => id === 51 ? detail(login, { updates: [note(4, beqa, change.update!), note(1, gio, 'Added')], comments: [comment] })
        : detail(old, { updates: [note(6, beqa, change.update!), note(3, beqa, 'Seen'), note(2, ilo, 'Added')] }));
    vi.mocked(api.createRoadmap).mockResolvedValue(view([], { roadmap: roadmap(9, 'Pending'), changes: [] }));
    vi.mocked(api.changeRoadmap).mockResolvedValue(october);
    vi.mocked(api.createWork).mockResolvedValue(detail(item(60, 'checkout screen', 'PLANNED', 0)));
    vi.mocked(api.addComment).mockResolvedValue([]);
    vi.mocked(api.addPicture).mockResolvedValue(detail(item(60, 'checkout screen', 'PLANNED', 0)));
    mount();

    // Findings are neither a project nor tasks.
    const groups = (await screen.findByRole('heading', { name: 'Groups' })).closest('section')!;
    expect(within(groups).queryByText('Add to plans')).not.toBeInTheDocument();
    expect(screen.queryByText('Login button overlaps')).not.toBeInTheDocument();
    const side = screen.getByRole('navigation', { name: 'Team work' });
    await waitFor(() => expect(within(side).getByRole('button', { name: /^Add to plans/ })).toHaveTextContent('Add to plans1'));
    await userEvent.click(within(side).getByRole('button', { name: /^Add to plans/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('view=add');

    const list = (await screen.findByRole('heading', { name: 'Findings 2' })).closest('section')!;
    const cards = within(list).getAllByRole('listitem');
    expect(cards[0]).toHaveTextContent('Login button overlaps');
    expect(cards[0]).toHaveTextContent('Gio Beridze · now');
    expect(within(cards[0]).getByText('@Beqa')).toHaveAttribute('data-me', 'true');
    expect(cards[0]).toHaveTextContent('Waiting for you');
    expect(within(list).queryByRole('button', { name: /add to plan/i })).not.toBeInTheDocument();
    expect(cards[1]).toHaveTextContent('Not acknowledged yet');
    expect(within(cards[1]).queryByRole('button', { name: 'Seen' })).not.toBeInTheDocument();

    await userEvent.click(within(cards[0]).getByRole('button', { name: 'Acknowledge' }));
    expect(api.changeWork).toHaveBeenCalledWith(51, { version: 0, update: 'Acknowledged' });
    expect(await within(cards[0]).findByText('Acknowledged by you')).toBeInTheDocument();
    expect(within(cards[0]).queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument();

    await userEvent.click(within(cards[1]).getByRole('button', { name: 'Push to pending' }));
    await waitFor(() => expect(api.changeRoadmap).toHaveBeenCalledWith(8, { version: 3, order: [51] }));
    expect(api.changeWork).toHaveBeenCalledWith(52, { version: 0, update: 'Pushed to pending' });
    expect(api.createRoadmap).toHaveBeenCalledWith('Pending');
    expect(api.changeRoadmap).toHaveBeenCalledWith(9, { version: 3, order: [52] });

    // A new finding: the name comes from the file; "@" offers the team.
    const file = new File(['png'], 'checkout-screen.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('Choose pictures and videos'), file);
    expect(screen.getByLabelText('Name')).toHaveValue('checkout screen');
    await userEvent.type(screen.getByLabelText('What it’s for (optional)'), 'People cannot see the total on phones');
    const box = screen.getByLabelText('Comment (optional)');
    await userEvent.type(box, 'The total is cut off @Gi');
    expect(screen.getByRole('option', { name: '@Gio Beridze' })).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(box).toHaveValue('The total is cut off @Gio Beridze ');
    await userEvent.click(screen.getByRole('button', { name: 'Drop it' }));
    await waitFor(() => expect(api.addPicture).toHaveBeenCalledWith(60, file));
    expect(api.createWork).toHaveBeenCalledWith({ title: 'checkout screen', status: 'PLANNED', roadmapId: 8, description: 'People cannot see the total on phones' });
    expect(api.addComment).toHaveBeenCalledWith(60, 'The total is cut off @Gio Beridze');
});

it('lists pending findings with who pushed them, and makes one a task on its own or in a project', async () => {
    const search = item(61, 'Club search misses Georgian names', 'PLANNED', 0);
    const pending = view([{ item: search, parts: [] }], { roadmap: roadmap(9, 'Pending'), changes: [] });
    useLists(pending);
    vi.mocked(api.fetchDetail).mockResolvedValue(detail(search, { updates: [note(2, beqa, 'Pushed to pending'), note(1, ilo, 'Added')] }));
    vi.mocked(api.changeWork).mockResolvedValue(detail(search, { updates: [note(3, beqa, 'Made a task'), note(2, beqa, 'Pushed to pending'), note(1, ilo, 'Added')] }));
    vi.mocked(api.changeRoadmap).mockResolvedValue(october);
    mount('/team-work?view=pending');

    const side = await screen.findByRole('navigation', { name: 'Team work' });
    expect(await within(side).findByRole('button', { name: /^Pending/ })).toHaveTextContent('Pending1');
    const card = (await screen.findByText('Club search misses Georgian names')).closest('li')!;
    await waitFor(() => expect(card).toHaveTextContent('Pushed by Beqa · now'));
    expect(card).toHaveTextContent('Acknowledged by you');
    expect(within(card).queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument();
    await userEvent.click(within(card).getByRole('button', { name: 'Make it a task' }));
    expect(within(card).getAllByRole('menuitem').map(option => option.textContent)).toEqual(['On its own', 'In October work', 'In Registration and roles', 'In Store']);
    await userEvent.click(within(card).getByRole('menuitem', { name: 'In October work' }));
    await waitFor(() => expect(api.changeRoadmap).toHaveBeenCalledWith(9, { version: 3, order: [] }));
    expect(api.changeWork).toHaveBeenCalledWith(61, { version: 0, update: 'Made a task' });
    expect(api.changeRoadmap).toHaveBeenCalledWith(5, { version: 3, order: [1, 2, 3, 61] });
});

it('shows a project’s tasks as cards in its order, then in order, and keeps the extras behind “…”', async () => {
    vi.mocked(api.changeRoadmap).mockResolvedValue(view(october.pieces, { roadmap: roadmap(5, 'October work', { status: 'LATER', version: 4 }) }));
    vi.mocked(api.fetchDetail).mockResolvedValue(detail(october.pieces[1].item));
    mount('/team-work?roadmap=5');
    const list = await screen.findByRole('list', { name: 'October work' });
    expect(screen.getByRole('heading', { name: 'October work', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Started by Beqa · Beqa, Gio Beridze')).toBeInTheDocument();
    const cards = within(list).getAllByRole('button', { name: /%|Not started|Started|Halfway|Nearly done|Done/ });
    expect(cards.map(card => card.querySelector('.tw-task__name')?.textContent)).toEqual(['Branding and landing', 'Registration', 'Save button on phones']);
    expect(cards[0]).toHaveTextContent('70%');
    expect(cards[0]).toHaveTextContent('3 stages · Beqa');
    expect(cards[0]).not.toHaveTextContent('October work');
    expect(cards[2]).toHaveTextContent('small');
    expect(cards[2]).toHaveTextContent('Not started');
    expect(screen.queryByText(/Copy as new version|Project history/)).not.toBeInTheDocument();

    const steps = screen.getByRole('heading', { name: 'In order' }).parentElement!;
    const strip = within(steps).getAllByRole('button');
    expect(strip).toHaveLength(3);
    expect(strip[0]).toHaveAttribute('aria-current', 'step');
    expect(strip[0]).toHaveTextContent('170%Branding and landingends about 1 week');
    await userEvent.click(strip[1]);
    expect(screen.getByTestId('where')).toHaveTextContent('task=2');
    expect(await within(list).findByRole('region', { name: 'Registration' })).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: 'Take off this project' })).toBeInTheDocument();

    // Gio's tasks only: the cards and the order follow the name, numbered as in the whole project.
    await userEvent.click(within(screen.getByRole('group', { name: 'Show work for' })).getByRole('button', { name: 'Gio Beridze' }));
    expect(within(screen.getByRole('list', { name: 'October work' })).queryByText('Branding and landing')).not.toBeInTheDocument();
    expect(within(screen.getByRole('heading', { name: 'In order' }).parentElement!).getByRole('button')).toHaveTextContent(/^2/);

    await userEvent.click(screen.getByRole('button', { name: 'More for this project' }));
    expect(screen.getByRole('menuitemradio', { name: 'Working on it now' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Later' }));
    expect(api.changeRoadmap).toHaveBeenCalledWith(5, { version: 3, status: 'LATER' });
    expect(await screen.findByText('Later', { selector: '.gk-badge, .gk-badge *' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'More for this project' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Project history' }));
    expect(within(screen.getByRole('dialog', { name: 'Project history' })).getByText('Added Branding and landing')).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Project history' })).getAllByRole('button', { name: 'Close' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Back to progress' }));
    expect(screen.getByTestId('where')).not.toHaveTextContent('roadmap=');
});

it('copies a plan for AI in the paste format with comments and file names as notes the paste skips', async () => {
    vi.mocked(api.fetchDetail).mockImplementation(async id => detail(id === 1 ? branding : item(id, 'x', 'PLANNED', 0), id === 1 ? {
        comments: [1, 2, 3, 4].map(n => ({ id: n, author: gio, body: `Note ${n} | with a bar`, createdAt: `2026-10-2${n}T10:00:00Z`, editedAt: null, canEdit: false })),
        media: [{ id: 8, kind: 'VIDEO', url: '/uploads/team-work/abc.webm', contentType: 'video/webm', sizeBytes: 10, uploadedBy: beqa, createdAt: now, canDelete: true }],
    } : {}));
    const text = planAsText(october, new Map([[1, await api.fetchDetail(1)]]));
    expect(text.split('\n')).toEqual([
        'plan: October work',
        '# Lines starting with # are notes: the last comments and files. Pieces match by name; nothing is deleted.',
        '- [in progress] Branding and landing | started 2026-10-20 | ends ~1 weeks | 70% | Beqa',
        '  # Gio Beridze, 2026-10-22: Note 2 / with a bar',
        '  # Gio Beridze, 2026-10-23: Note 3 / with a bar',
        '  # Gio Beridze, 2026-10-24: Note 4 / with a bar',
        '  # files: video abc.webm',
        '  - [finished] Founders’ design | ends don\'t know | 100%',
        '  - [planned] Hero copy | ends don\'t know | 0%',
        '  - [in progress] Cloudflare lock | ends don\'t know | 50%',
        '- [on hold] Registration | ends don\'t know | 30% | Gio Beridze',
        '- [planned, small] Save button on phones | ends don\'t know | 0%',
    ]);

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    mount('/team-work?roadmap=5');
    await userEvent.click(await screen.findByRole('button', { name: 'More for this project' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Copy for AI' }));
    const dialog = screen.getByRole('dialog', { name: 'Copy for AI' });
    await waitFor(() => expect((within(dialog).getByLabelText('The plan as text') as HTMLTextAreaElement).value).toContain('# files: video abc.webm'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringMatching(/^plan: October work\n/));
    expect(await within(dialog).findByRole('button', { name: 'Copied' })).toBeInTheDocument();
});

it('opens a task in place with its stages, comments and quick update, and keeps the words when a colleague saved first', async () => {
    vi.mocked(api.fetchDetail).mockResolvedValue(detail(branding, {
        parts, comments: [{ id: 3, author: { id: 2, name: 'Gio Beridze' }, body: 'Looks good on the phone', createdAt: now, editedAt: null, canEdit: false }],
        updates: [{ id: 9, author: { id: 1, name: 'Nino' }, at: twoDaysAgo, previousStatus: null, status: 'IN_PROGRESS', previousPercent: null, percent: 70, message: 'Added' }],
    }));
    vi.mocked(api.changeWork).mockRejectedValueOnce({ response: { status: 409, data: { detail: 'Someone else changed this work after you opened it.' } } });
    mount('/team-work?roadmap=5&task=1');
    const piece = await screen.findByRole('region', { name: 'Branding and landing' });
    expect(within(piece).getByText('about 1 week')).toBeInTheDocument();
    expect(within(piece).getByText('Looks good on the phone')).toBeInTheDocument();
    expect(within(piece).getByText('Gio Beridze')).toBeInTheDocument();
    expect(within(piece).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    await userEvent.click(within(piece).getByRole('radio', { name: 'Finished' }));
    await userEvent.type(within(piece).getByLabelText('What changed'), 'Shipped');
    await userEvent.click(within(piece).getByRole('button', { name: 'Save update' }));
    expect(api.changeWork).toHaveBeenCalledWith(1, { version: 0, status: 'FINISHED', percent: 100, update: 'Shipped' });
    expect(await within(piece).findByRole('alert')).toHaveTextContent('Someone else changed this work');
    expect(within(piece).getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(within(piece).getByLabelText('What changed')).toHaveValue('Shipped');
    await userEvent.click(within(piece).getByRole('button', { name: /Hero copy/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('open=12');
});

it('estimates progress in words, copies a task for AI with a way to answer, and deletes a task only after asking', async () => {
    vi.mocked(api.fetchDetail).mockResolvedValue(detail(branding, { parts, comments: [{ id: 3, author: gio, body: 'Hero copy is too long', createdAt: now, editedAt: null, canEdit: false }] }));
    vi.mocked(api.changeWork).mockResolvedValue(detail({ ...branding, percent: 50 }, { parts, comments: [{ id: 3, author: gio, body: 'Hero copy is too long', createdAt: now, editedAt: null, canEdit: false }] }));
    vi.mocked(api.deleteWork).mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    mount('/team-work?roadmap=5&task=1');
    const piece = await screen.findByRole('region', { name: 'Branding and landing' });
    // 70% is exact, so the slider is open; a word sets an estimate.
    expect(within(piece).getByLabelText('Exact progress')).toHaveValue('70');
    await userEvent.click(within(piece).getByRole('radio', { name: 'Halfway' }));
    expect(within(piece).queryByLabelText('Exact progress')).not.toBeInTheDocument();
    await userEvent.click(within(piece).getByRole('button', { name: 'Save update' }));
    expect(api.changeWork).toHaveBeenCalledWith(1, { version: 0, percent: 50 });

    await userEvent.click(within(piece).getByRole('button', { name: 'Copy for AI' }));
    const brief = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];
    expect(brief).toContain('Team work task: Branding and landing');
    expect(brief).toContain('in the project "October work"');
    expect(brief).toContain('team-work?task=1');
    expect(brief).toContain('Gio Beridze');
    expect(brief).toContain('plan: October work');
    expect(await within(piece).findByRole('button', { name: 'Copied' })).toBeInTheDocument();

    await userEvent.click(within(piece).getByRole('button', { name: 'Delete' }));
    const confirm = screen.getByRole('dialog', { name: 'Delete this task?' });
    expect(confirm).toHaveTextContent('“Branding and landing” and its 3 stages');
    expect(api.deleteWork).not.toHaveBeenCalled();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    expect(api.deleteWork).toHaveBeenCalledWith(1);
    await waitFor(() => expect(screen.getByTestId('where')).not.toHaveTextContent('task='));
});

it('filters tasks by project, or those on none', async () => {
    vi.mocked(api.fetchBoard).mockResolvedValue({ items: [...boardOf(Object.values(plans)), item(70, 'Loose fix', 'PLANNED', 0)], trail: [], canManageTeam: true });
    mount();
    const tasks = (await screen.findByRole('heading', { name: 'All tasks 7' })).closest('section')!;
    await userEvent.selectOptions(within(tasks).getByLabelText('Project'), 'Registration and roles');
    expect(screen.getByTestId('where')).toHaveTextContent('project=6');
    expect(within(tasks).getAllByRole('button', { name: /%|Not started|Started|Halfway|Nearly done|Done/ }).map(card => card.querySelector('.tw-task__name')?.textContent)).toEqual(['User registration']);
    await userEvent.selectOptions(within(tasks).getByLabelText('Project'), 'No project');
    expect(within(tasks).getAllByRole('button', { name: /%|Not started|Started|Halfway|Nearly done|Done/ }).map(card => card.querySelector('.tw-task__name')?.textContent)).toEqual(['Loose fix']);
});

it('previews a paste before applying it, shows deletes, and flags a new task whose name is already in another project', async () => {
    vi.mocked(api.pasteIntoRoadmap).mockResolvedValueOnce({ created: 2, updated: 1, moved: 1, unchanged: 0, deleted: 1, applied: false, view: null, problems: [],
        lines: [{ line: 1, action: 'NEW', title: 'Agent Dola on live', parent: null, detail: null }, { line: 2, action: 'UPDATED', title: 'Registration', parent: null, detail: '30% → 45%' }, { line: 3, action: 'MOVED', title: 'Hero copy', parent: 'Registration', detail: null },
            { line: 4, action: 'NEW', title: 'User registration', parent: null, detail: null }, { line: 5, action: 'DELETED', title: 'Save button on phones', parent: null, detail: null }] })
        .mockResolvedValueOnce({ created: 2, updated: 1, moved: 1, unchanged: 0, deleted: 1, applied: true, view: view([{ item: branding, parts: [] }]), problems: [], lines: [] });
    mount('/team-work?roadmap=5');
    await userEvent.click(await screen.findByRole('button', { name: 'Paste from AI' }));
    const dialog = screen.getByRole('dialog', { name: 'Paste from AI' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Use the example' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Preview' }));
    expect(await within(dialog).findByText('2 new, 1 updated, 1 stage moved, 1 deleted')).toBeInTheDocument();
    expect(api.pasteIntoRoadmap).toHaveBeenCalledWith(5, api.PASTE_EXAMPLE, false);
    expect(within(dialog).getByText('Deleted')).toBeInTheDocument();
    expect(within(dialog).getByText('Already in Registration and roles')).toBeInTheDocument();
    expect(within(dialog).getByRole('status')).toHaveTextContent('1 new task has the name of a task in another project');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    expect(api.pasteIntoRoadmap).toHaveBeenLastCalledWith(5, api.PASTE_EXAMPLE, true);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Paste from AI' })).not.toBeInTheDocument());
});

it('lists the team’s accounts without remove buttons, makes the account and one-time link for a team email, and a new link for an invited one', async () => {
    const team: api.Member[] = [{ userId: 1, name: 'Dola', email: 'admin.dola@talanti.ge', admin: true, addedAt: null, pending: false },
        { userId: 7, name: 'Gio', email: 'admin.gio@talanti.ge', admin: false, addedAt: now, pending: true }];
    const invite = { userId: 8, email: 'admin.otto@talanti.ge', token: 'tok-1', expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() };
    vi.mocked(api.fetchTeam).mockResolvedValue(team);
    vi.mocked(api.addMember).mockResolvedValue({ members: [...team, { userId: 8, name: 'Otto', email: invite.email, admin: false, addedAt: now, pending: true }], invite });
    vi.mocked(api.newInvite).mockResolvedValue({ ...invite, userId: 7, email: 'admin.gio@talanti.ge', token: 'tok-2' });
    mount();
    await userEvent.click(within(await screen.findByRole('navigation', { name: 'Team work' })).getByRole('button', { name: 'Team' }));
    expect(screen.getByTestId('where')).toHaveTextContent('view=team');
    const panel = (await screen.findByRole('heading', { name: 'Team' })).closest('section')!;
    expect(await within(panel).findByText('admin.gio@talanti.ge')).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
    expect(within(panel).queryByText('System admin')).not.toBeInTheDocument();
    expect(within(panel).getByText(/APP_TEAM_WORK_EMAILS/)).toBeInTheDocument();

    await userEvent.type(within(panel).getByPlaceholderText('admin.name@talanti.ge'), invite.email);
    await userEvent.click(within(panel).getByRole('button', { name: 'Make account and link' }));
    expect(api.addMember).toHaveBeenCalledWith(invite.email);
    expect(await within(panel).findByLabelText(`Sign-up link for ${invite.email}`)).toHaveValue(`${window.location.origin}/reset-password?token=tok-1`);
    await userEvent.click(within(panel).getAllByRole('button', { name: 'New link' })[0]);
    expect(api.newInvite).toHaveBeenCalledWith(7);
    expect(await within(panel).findByDisplayValue(`${window.location.origin}/reset-password?token=tok-2`)).toBeInTheDocument();

    // Any other email is refused by the server; its words show as they are.
    vi.mocked(api.addMember).mockRejectedValueOnce({ response: { status: 400, data: { detail: 'Team work is only for the team’s own accounts; that email is not on the team list.' } } });
    await userEvent.type(within(panel).getByPlaceholderText('admin.name@talanti.ge'), 'someone@example.com');
    await userEvent.click(within(panel).getByRole('button', { name: 'Make account and link' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('not on the team list');
});

it('stays up to date: shows the latest backend, remembers my version, lists only what I am missing and copies the update message', async () => {
    const commit = (id: string, title: string, date: string, merge = false) => ({ id: id.padEnd(40, '0'), date, author: 'Dola', title, merge });
    vi.mocked(api.fetchVersions).mockResolvedValue({ backend: { known: true, branch: 'codex/real-backend-integration-20261017', commits: [
        commit('148b8c6d', 'Format the media files', '2026-10-22T19:38:58+04:00'),
        commit('02896b0e', 'Merge branch \'refs/heads/golive/teamwork-5\' into codex/real-backend-integration-20261017', '2026-10-22T19:30:00+04:00', true),
        commit('9f8c21b8', 'Only the team’s own six accounts', '2026-10-21T19:15:26+04:00'),
        commit('715d88c1', 'Plans with a status', '2026-10-20T10:00:00+04:00'),
    ] } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    localStorage.removeItem('gk.teamWork.myVersion');
    mount('/team-work');
    await userEvent.click(await screen.findByRole('button', { name: 'Stay up to date' }));
    expect(screen.getByTestId('where')).toHaveTextContent('view=updates');
    expect(await screen.findByRole('heading', { name: 'Stay up to date', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('Format the media files', { selector: '.tw-latest__commit' })).toBeInTheDocument();
    expect(screen.getByText('Not known: this build was made without its git history.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent changes' })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('My backend version'), '9f8c21b8'.padEnd(40, '0'));
    expect(screen.getByRole('heading', { name: 'Changes you’re missing (1)' })).toBeInTheDocument();
    const missingList = screen.getByRole('heading', { name: 'Changes you’re missing (1)' }).parentElement!;
    expect(within(missingList).getByText('Format the media files')).toBeInTheDocument();
    expect(within(missingList).getByText('merged: golive/teamwork-5')).toBeInTheDocument();
    expect(within(missingList).queryByText('Plans with a status')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('gk.teamWork.myVersion')!)).toEqual({ backend: '9f8c21b8'.padEnd(40, '0') });

    await userEvent.clear(screen.getByLabelText('Or paste the backend commit id'));
    await userEvent.type(screen.getByLabelText('Or paste the backend commit id'), '148b8c6');
    expect(screen.getByRole('heading', { name: 'You are up to date' })).toBeInTheDocument();

    const message = screen.getByLabelText('The message for Claude or Codex') as HTMLTextAreaElement;
    expect(message.value).toContain('github.com/dola165/GrassKickZ — reach at least commit 148b8c6');
    expect(message.value).toContain('whether this computer was already up to date');
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(message.value);
    await userEvent.click(screen.getByRole('button', { name: 'Progress' }));
    expect(screen.getByTestId('where')).not.toHaveTextContent('view=');
});

it('does not exist for accounts off the team, and Home shows no row without the capability', async () => {
    vi.mocked(api.fetchRoadmaps).mockRejectedValue({ response: { status: 404 } });
    mount();
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    const { container } = render(<MemoryRouter><TeamWorkHomeRow caps={{ version: 1, workspaces: [] }} /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
});

it('shows team accounts a quiet Home row with how much is in progress', async () => {
    vi.mocked(api.fetchBoard).mockResolvedValue({ items: [item(1, 'Registration', 'IN_PROGRESS', 30), item(2, 'Branding', 'IN_PROGRESS', 70), item(3, 'Schedule', 'FINISHED', 100)], trail: [], canManageTeam: false });
    render(<MemoryRouter><TeamWorkHomeRow caps={{ version: 1, workspaces: [{ id: 'team.work', context: { type: 'user', id: 1, label: 'Team work' } }] }} /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Team work. 2 in progress' })).toHaveAttribute('href', '/team-work');
});
