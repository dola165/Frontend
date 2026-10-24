import '../../i18n';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from './api';
import * as overview from './overviewApi';
import { dayKey } from '../schedule/board/scheduleRange';
import { planAsText } from './planAsText';
import { TeamWorkPage } from './TeamWorkPage';
import { TeamWorkHomeRow } from './TeamWorkHomeRow';

vi.mock('./api', async importOriginal => ({
    ...await importOriginal<typeof api>(), fetchBoard: vi.fn(), fetchDetail: vi.fn(), createWork: vi.fn(), changeWork: vi.fn(), fetchPlans: vi.fn(), fetchPlan: vi.fn(),
    createPlan: vi.fn(), changePlan: vi.fn(), pasteIntoPlan: vi.fn(), fetchTeam: vi.fn(), addMember: vi.fn(), newInvite: vi.fn(), removeMember: vi.fn(), fetchVersions: vi.fn(),
    addPlanStep: vi.fn(), removePlanStep: vi.fn(), setResponsibility: vi.fn(),
    addComment: vi.fn(), addPicture: vi.fn(), addVideo: vi.fn(), deleteWork: vi.fn(), askQuestion: vi.fn(), answerQuestion: vi.fn(), deleteQuestion: vi.fn(), pasteReport: vi.fn(),
}));
vi.mock('./overviewApi', () => ({ fetchTimeline: vi.fn(), fetchOpenQuestions: vi.fn(), fetchPins: vi.fn(), addPin: vi.fn(), removePin: vi.fn() }));
vi.mock('../../pages/RouteRecoveryPage', () => ({ RouteRecoveryPage: () => <p>Page not found</p> }));
// Agent Dola is not part of these tests: off for this account.
vi.mock('../dola/agentDola', () => ({ agentDolaStatus: () => Promise.reject({ response: { status: 404 } }) }));
// The reader is Beqa.
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1 } }) }));

const now = new Date().toISOString();
const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
const beqa = { id: 1, name: 'Beqa' }, gio = { id: 2, name: 'Gio Beridze' }, ilo = { id: 3, name: 'Ilo' };
const team = [beqa, gio, ilo];
const item = (id: number, title: string, status: api.WorkStatus, percent: number | null, extra: Partial<api.WorkItem> = {}): api.WorkItem => ({
    id, key: `GK-${id}`, title, area: null, status, percent, step: null, notes: null, branch: null, prUrl: null, version: 0, updatedBy: beqa, updatedAt: now, createdAt: now,
    parentId: null, description: null, startedOn: null, end: { kind: 'UNKNOWN' }, percentFromSteps: false, people: [], mediaCount: 0, commentCount: 0, small: false,
    doneMeans: null, tested: null, commits: null, priority: null, requestedBy: null, links: [], waitingOn: [], openQuestions: 0, ...extra,
});
const plan = (id: number, name: string, extra: Partial<api.Plan> = {}): api.Plan => ({ id, name, purpose: null, copiedFrom: null, copiedFromName: null, version: 3, taskCount: 2, updatedBy: beqa, updatedAt: now, createdAt: now,
    status: 'NOW', percent: 55, inProgress: 3, toDo: 2, done: 1, needsYou: 0, nextTask: 'Branding and landing', partOf: null, live: false, ...extra });
const branding = item(1, 'Branding and landing', 'IN_PROGRESS', 70, { startedOn: '2026-10-20', end: { kind: 'ABOUT', amount: 1, unit: 'WEEKS' }, people: [beqa] });
const steps = [item(11, 'Founders’ design', 'LIVE', 100, { parentId: 1 }), item(12, 'Hero copy', 'PLANNED', 0, { parentId: 1 }), item(13, 'Cloudflare lock', 'IN_PROGRESS', 50, { parentId: 1 })];
const started = (author: api.Person) => ({ id: 99, author, at: twoDaysAgo, message: 'Started' });
const view = (tasks: api.WorkNode[], extra: Partial<api.PlanView> = {}): api.PlanView => ({
    plan: plan(5, 'October work'), tasks, steps: [], changes: [{ id: 1, author: beqa, at: now, message: 'Added Branding and landing' }, started(beqa)], purposeChanges: [],
    trail: [], team, canManageTeam: true, ...extra,
});
const october = view([{ item: branding, steps }, { item: item(2, 'Registration', 'BLOCKED', 30, { step: 'Waiting for email provider', people: [gio] }), steps: [] },
    { item: item(3, 'Save button on phones', 'PLANNED', 0, { small: true }), steps: [] }]);
const plans: Record<number, api.PlanView> = {
    5: october,
    6: view([{ item: item(21, 'User registration', 'IN_PROGRESS', 20, { people: [ilo] }), steps: [] }], { plan: plan(6, 'Registration and roles', { percent: 20, inProgress: 1, toDo: 4, done: 0, nextTask: 'User registration' }), changes: [started(ilo)] }),
    4: view([{ item: item(31, 'Schedules', 'LIVE', 100), steps: [] }], { plan: plan(4, 'This week’s work', { updatedAt: twoDaysAgo, status: 'FINISHED', percent: 100 }), changes: [] }),
    7: view([{ item: item(41, 'Checkout', 'PLANNED', 0, { createdAt: monthAgo }), steps: [] }], { plan: plan(7, 'Store', { status: 'LATER', percent: 0 }), changes: [] }),
};
/** Every item on these plans, steps included, once each: what the board returns. */
const boardOf = (views: api.PlanView[]) => [...new Map(views.flatMap(found => found.tasks.flatMap(node => [node.item, ...node.steps])).map(work => [work.id, work])).values()];
const detail = (work: api.WorkItem, extra: Partial<api.Detail> = {}): api.Detail => ({ item: work, updates: [], steps: [], questions: [], foundCommits: [], media: [], comments: [], purposeChanges: [], ...extra });
const note = (id: number, author: api.Person, message: string) => ({ id, author, at: now, previousStatus: null, status: null, previousPercent: null, percent: null, message });
const refOf = (work: api.WorkItem): api.WorkRef => ({ id: work.id, key: work.key, title: work.title, status: work.status });
/** A time `daysAgo` days back at h:m, local. */
const at = (daysAgo: number, hours: number, minutes: number) => { const date = new Date(); date.setDate(date.getDate() - daysAgo); date.setHours(hours, minutes, 0, 0); return date.toISOString(); };
const event = (id: string, kind: overview.EventKind, when: string, work: api.WorkItem, extra: Partial<overview.WorkEvent> = {}): overview.WorkEvent => ({
    id, kind, at: when, task: refOf(work), parentId: work.parentId, status: work.status, previousStatus: null, by: beqa, text: null, question: null, ...extra });
function Where() { const location = useLocation(); return <output data-testid="where">{location.search}</output>; }
const mount = (path = '/team-work') => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/team-work" element={<><TeamWorkPage /><Where /></>} /></Routes></MemoryRouter>);
const useLists = (...extra: api.PlanView[]) => {
    vi.mocked(api.fetchPlans).mockResolvedValue([...[5, 6, 4, 7].map(id => plans[id].plan), ...extra.map(found => found.plan)]);
    vi.mocked(api.fetchPlan).mockImplementation(async id => extra.find(found => found.plan.id === id) ?? plans[id]);
    vi.mocked(api.fetchBoard).mockResolvedValue({ items: boardOf([...Object.values(plans), ...extra]), trail: [], canManageTeam: true, team: [] });
};

beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.fetchTeam).mockResolvedValue([{ userId: 1, name: 'Nino', email: 'nino@example.com', admin: true, addedAt: null, pending: false }]);
    useLists();
    vi.mocked(overview.fetchTimeline).mockResolvedValue({ events: [], more: false });
    vi.mocked(overview.fetchOpenQuestions).mockResolvedValue([]);
    vi.mocked(overview.fetchPins).mockResolvedValue([]);
});

it('starts with this week’s work as tasks on their own when there is nothing yet', async () => {
    vi.mocked(api.fetchPlans).mockResolvedValueOnce([]);
    vi.mocked(api.fetchBoard).mockResolvedValueOnce({ items: [], trail: [], canManageTeam: true, team: [] });
    vi.mocked(api.createWork).mockResolvedValue(detail(branding));
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'or load this week’s work' }));
    await waitFor(() => expect(api.createWork).toHaveBeenCalledTimes(api.STARTER_WORK.length));
    expect(api.createWork).toHaveBeenCalledWith(api.STARTER_WORK[0]);
    expect(api.createPlan).not.toHaveBeenCalled();
    // The page loads again by itself: the overview and its agenda replace the empty note, no reload needed.
    expect(await screen.findByRole('heading', { name: 'What happened' })).toBeInTheDocument();
    expect(screen.queryByText('No tasks yet')).not.toBeInTheDocument();
    expect(vi.mocked(overview.fetchTimeline).mock.calls.length).toBeGreaterThan(0);
});

it('opens on what waits on you, your pins and the plans, then what happened day by day with empty days left out', async () => {
    const look = item(90, 'Sign-up screen', 'NEEDS_LOOK', null, { people: [ilo] });
    const asking = item(91, 'Email provider', 'BLOCKED', null, { openQuestions: 1, people: [gio] });
    const extra = view([{ item: look, steps: [] }, { item: asking, steps: [] }], { plan: plan(11, 'Launch'), changes: [] });
    useLists(extra);
    vi.mocked(overview.fetchOpenQuestions).mockResolvedValue([{ task: refOf(asking), parentId: null, question: { id: 5, text: 'Which provider?', options: ['Mailgun', 'Postmark'], askedBy: gio, at: now, answer: null, answeredBy: null, answeredAt: null } }]);
    vi.mocked(overview.fetchPins).mockResolvedValue([{ id: 1, planId: 6, itemId: null, at: now }, { id: 2, planId: null, itemId: 1, at: now }]);
    vi.mocked(overview.removePin).mockResolvedValue([{ id: 2, planId: null, itemId: 1, at: now }]);
    vi.mocked(overview.fetchTimeline).mockResolvedValue({ more: false, events: [
        event('s-1', 'STATUS', at(0, 10, 5), plans[6].tasks[0].item, { by: ilo, status: 'IN_PROGRESS', previousStatus: 'PLANNED', text: 'Sign-up form' }),
        event('q-1', 'ASKED', at(0, 9, 0), asking, { by: gio, text: 'Which provider?' }),
        event('a-3', 'ADDED', at(3, 16, 0), october.tasks[2].item, { status: 'PLANNED' }),
        event('s-2', 'STATUS', at(4, 11, 0), steps[0], { status: 'LIVE', previousStatus: 'IN_PROGRESS' }),
    ] });
    vi.mocked(api.answerQuestion).mockResolvedValue(detail({ ...asking, openQuestions: 0 }));
    vi.mocked(api.fetchDetail).mockImplementation(async id => detail(id === 21 ? plans[6].tasks[0].item : branding));
    mount();

    // Pins: a plan and a task, each opening its own; unpin is quiet.
    const pinned = (await screen.findByRole('heading', { name: 'Pinned' })).closest('section')!;
    expect(within(pinned).getAllByRole('listitem').map(row => row.querySelector('.tw-pinned__name')?.textContent)).toEqual(['Registration and roles', 'Branding and landing']);
    await userEvent.click(within(pinned).getByRole('button', { name: 'Unpin Registration and roles' }));
    expect(overview.removePin).toHaveBeenCalledWith(1);
    expect(await within(pinned).findAllByRole('listitem')).toHaveLength(1);

    // Needs you: the task to look at and the question, answered in place; the board loads again after.
    const needs = (await screen.findByRole('heading', { name: 'Needs you 2' })).closest('section')!;
    expect(within(needs).getByRole('button', { name: /GK-91\s*Email provider/ })).toBeInTheDocument();
    expect(within(needs).getByRole('button', { name: /GK-90\s*Sign-up screen.*Needs your look/ })).toBeInTheDocument();
    const board = vi.mocked(api.fetchBoard).mock.calls.length;
    await userEvent.click(within(await within(needs).findByRole('group', { name: 'Answer: Which provider?' })).getByRole('button', { name: 'Mailgun' }));
    expect(api.answerQuestion).toHaveBeenCalledWith(5, 'Mailgun');
    await waitFor(() => expect(vi.mocked(api.fetchBoard).mock.calls.length).toBeGreaterThan(board));

    // What happened: days with something, newest first, as cards; nothing for yesterday or the day before.
    const happened = screen.getByRole('heading', { name: 'What happened' }).closest('section')!;
    const days = within(happened).getAllByRole('heading', { level: 4 }).map(heading => heading.textContent);
    expect(days).toHaveLength(3);
    expect(days[0]).toMatch(/^Today/);
    expect(days.some(day => day?.startsWith('Yesterday'))).toBe(false);
    const started = within(happened).getByRole('button', { name: 'GK-21 User registration. Started' });
    expect(started.closest('li')).toHaveTextContent('Started — Sign-up form');
    expect(started.closest('li')).toHaveTextContent('Ilo · Registration and roles');
    expect(started.closest('li')).toHaveTextContent('In progress');
    // A step's event is a card of its task, naming the step.
    const live = within(happened).getByRole('button', { name: 'GK-1 Branding and landing. Went live' }).closest('li')!;
    expect(live).toHaveTextContent('step GK-11: Went live');
    expect(live).toHaveTextContent('October work');

    // One toolbar: person and status filter the rows, through the link.
    await userEvent.selectOptions(within(happened).getByLabelText('Person'), 'Gio Beridze');
    expect(screen.getByTestId('where')).toHaveTextContent('who=2');
    expect(within(happened).getAllByRole('button', { name: /\. / }).map(row => row.getAttribute('aria-label'))).toEqual(['GK-91 Email provider. Asked']);
    await userEvent.selectOptions(within(happened).getByLabelText('Person'), 'Everyone');
    await userEvent.click(within(within(happened).getByRole('group', { name: 'Show by status' })).getByRole('button', { name: 'Live' }));
    expect(screen.getByTestId('where')).toHaveTextContent('status=LIVE');
    expect(within(happened).getAllByRole('heading', { level: 4 })).toHaveLength(1);
    await userEvent.click(within(within(happened).getByRole('group', { name: 'Show by status' })).getByRole('button', { name: 'Live' }));

    // A row opens its task over the agenda; closing it leaves the link clean.
    await userEvent.click(within(happened).getByRole('button', { name: 'GK-21 User registration. Started' }));
    expect(screen.getByTestId('where')).toHaveTextContent('task=21');
    const dialog = await screen.findByRole('dialog', { name: /GK-21\s*User registration/ });
    expect(await within(dialog).findByRole('region', { name: 'GK-21 User registration' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Pin User registration' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(within(dialog).getAllByRole('button', { name: 'Close' })[0]);
    expect(screen.getByTestId('where')).not.toHaveTextContent('task=');

    // The plans are one row of links.
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Plans' })).getByRole('button', { name: /^Store/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('plan=7');
});

it('folds tasks added at once, loads earlier days whole, and a link to an old day scrolls back to it', async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    const added = ['Hero copy', 'Footer', 'Logo', 'Colours'].map((title, index) => event(`a-${index}`, 'ADDED', at(1, 12, 10 - index), item(100 + index, title, 'PLANNED', null)));
    vi.mocked(overview.fetchTimeline)
        .mockResolvedValueOnce({ more: true, events: [...added, event('s-9', 'STATUS', at(6, 9, 0), branding, { status: 'IN_PROGRESS' })] })
        .mockResolvedValueOnce({ more: false, events: [event('s-9', 'STATUS', at(6, 9, 0), branding, { status: 'IN_PROGRESS' }), event('a-9', 'ADDED', at(8, 9, 0), branding, { status: 'PLANNED' })] });
    mount(`/team-work?day=${dayKey(new Date(at(8, 9, 0)))}`);

    // The link names a day the first page doesn't have: the next page loads, from the start of the last whole day.
    await waitFor(() => expect(overview.fetchTimeline).toHaveBeenCalledTimes(2));
    const start = new Date(at(1, 0, 0)); start.setHours(0, 0, 0, 0);
    expect(vi.mocked(overview.fetchTimeline).mock.calls[1][0]).toBe(start.toISOString());
    await waitFor(() => expect(scrolled).toHaveBeenCalled());
    const happened = screen.getByRole('heading', { name: 'What happened' }).closest('section')!;
    expect(within(happened).getAllByRole('heading', { level: 4 })).toHaveLength(3);
    expect(within(happened).queryByRole('button', { name: 'Show earlier days' })).not.toBeInTheDocument();

    const run = within(happened).getByRole('button', { name: 'Added 4 tasks. Show all' });
    expect(run.closest('li')).toHaveTextContent('Hero copy, Footer, Logo…');
    expect(within(happened).queryByRole('button', { name: 'GK-101 Footer. Added' })).not.toBeInTheDocument();
    await userEvent.click(run);
    expect(within(happened).getByRole('button', { name: 'GK-101 Footer. Added' })).toBeInTheDocument();
});

it('opens a plan on one view: the plan step by step, then day-grouped cards for what happened in it; pins it', async () => {
    vi.mocked(overview.addPin).mockResolvedValue([{ id: 4, planId: 5, itemId: null, at: now }]);
    vi.mocked(overview.fetchTimeline).mockResolvedValue({ more: false, events: [
        event('s-1', 'STATUS', at(0, 10, 0), branding, { status: 'IN_PROGRESS', text: 'Hero is in' }),
        event('s-2', 'STATUS', at(0, 9, 0), plans[6].tasks[0].item, { status: 'IN_PROGRESS' }),
    ] });
    mount('/team-work?plan=5');
    const card = await screen.findByRole('button', { name: 'GK-1 Branding and landing. Started' });
    expect(screen.queryByRole('group', { name: 'Plan view' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'In order' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 4 })[0]).toHaveTextContent(/^Today/);
    // Only this plan's tasks, and no plan name repeated on every card; the card says what happened, who and how far.
    expect(screen.queryByRole('button', { name: 'GK-21 User registration. Started' })).not.toBeInTheDocument();
    expect(card.closest('li')).not.toHaveTextContent('October work');
    expect(card.closest('li')).toHaveTextContent('Started — Hero is in');
    expect(card.closest('li')).toHaveTextContent('70%');
    expect(card.closest('li')).toHaveTextContent('Beqa');

    await userEvent.click(screen.getByRole('button', { name: 'Pin October work' }));
    expect(overview.addPin).toHaveBeenCalledWith({ planId: 5 });
    expect(await screen.findByRole('button', { name: 'Pin October work' })).toHaveAttribute('aria-pressed', 'true');
});

it('takes findings with a name and a tagged comment; anyone marks them seen or acknowledges them and pushes one to Pending, never straight onto a plan', async () => {
    const login = item(51, 'Login button overlaps', 'PLANNED', 0), old = item(52, 'Old idea', 'PLANNED', 0, { createdAt: twoDaysAgo });
    const ideas = view([{ item: login, steps: [] }, { item: old, steps: [] }], { plan: plan(8, 'Ideas'), changes: [] });
    const comment = { id: 5, author: gio, body: 'It covers the logo on phones, @Beqa can you look?', createdAt: now, editedAt: null, canEdit: false };
    useLists(ideas);
    vi.mocked(api.fetchDetail).mockImplementation(async id => id === 51 ? detail(login, { updates: [note(1, gio, 'Added')], comments: [comment] })
        : detail(old, { updates: [note(3, beqa, 'Seen'), note(2, ilo, 'Added')] }));
    vi.mocked(api.changeWork).mockImplementation(async (id, change) => id === 51 ? detail(login, { updates: [note(4, beqa, change.update!), note(1, gio, 'Added')], comments: [comment] })
        : detail(old, { updates: [note(6, beqa, change.update!), note(3, beqa, 'Seen'), note(2, ilo, 'Added')] }));
    vi.mocked(api.createPlan).mockResolvedValue(view([], { plan: plan(9, 'Waiting'), changes: [] }));
    vi.mocked(api.changePlan).mockResolvedValue(october);
    vi.mocked(api.createWork).mockResolvedValue(detail(item(60, 'checkout screen', 'PLANNED', 0)));
    vi.mocked(api.addComment).mockResolvedValue([]);
    vi.mocked(api.addPicture).mockResolvedValue(detail(item(60, 'checkout screen', 'PLANNED', 0)));
    mount();

    // Findings are neither a plan nor tasks.
    const groups = await screen.findByRole('navigation', { name: 'Plans' });
    expect(within(groups).queryByText('Ideas')).not.toBeInTheDocument();
    expect(screen.queryByText('Login button overlaps')).not.toBeInTheDocument();
    const side = screen.getByRole('navigation', { name: 'Team work' });
    await waitFor(() => expect(within(side).getByRole('button', { name: /^Ideas/ })).toHaveTextContent('Ideas1'));
    await userEvent.click(within(side).getByRole('button', { name: /^Ideas/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('view=ideas');

    // The ideas are the agenda's rows, day by day: today's first, then two days ago.
    const list = await screen.findByRole('region', { name: 'Ideas: 2' });
    expect(within(list).getAllByRole('heading').map(heading => heading.textContent)).toEqual([expect.stringMatching(/^Today/), expect.not.stringMatching(/^Today|^Yesterday/)]);
    const cards = within(list).getAllByRole('listitem');
    expect(cards[0]).toHaveTextContent('Login button overlaps');
    expect(cards[0]).toHaveTextContent('Gio Beridze');
    expect(within(cards[0]).getByText('@Beqa')).toHaveAttribute('data-me', 'true');
    expect(cards[0]).toHaveTextContent('Waiting for you');
    expect(within(list).queryByRole('button', { name: /add to plan/i })).not.toBeInTheDocument();
    expect(cards[1]).toHaveTextContent('Not acknowledged yet');
    expect(within(cards[1]).queryByRole('button', { name: 'Seen' })).not.toBeInTheDocument();

    await userEvent.click(within(cards[0]).getByRole('button', { name: 'Acknowledge' }));
    expect(api.changeWork).toHaveBeenCalledWith(51, { version: 0, update: 'Acknowledged' });
    expect(await within(cards[0]).findByText('Acknowledged by you')).toBeInTheDocument();
    expect(within(cards[0]).queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument();

    await userEvent.click(within(cards[1]).getByRole('button', { name: 'Push to Waiting' }));
    await waitFor(() => expect(api.changePlan).toHaveBeenCalledWith(8, { version: 3, order: [51] }));
    expect(api.changeWork).toHaveBeenCalledWith(52, { version: 0, update: 'Pushed to pending' });
    expect(api.createPlan).toHaveBeenCalledWith('Waiting');
    expect(api.changePlan).toHaveBeenCalledWith(9, { version: 3, order: [52] });

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
    expect(api.createWork).toHaveBeenCalledWith({ title: 'checkout screen', status: 'PLANNED', planId: 8, description: 'People cannot see the total on phones' });
    expect(api.addComment).toHaveBeenCalledWith(60, 'The total is cut off @Gio Beridze');
});

it('lists pending findings with who pushed them, and makes one a task on its own or in a plan', async () => {
    const search = item(61, 'Club search misses Georgian names', 'PLANNED', 0);
    const pending = view([{ item: search, steps: [] }], { plan: plan(9, 'Waiting'), changes: [] });
    useLists(pending);
    vi.mocked(api.fetchDetail).mockResolvedValue(detail(search, { updates: [note(2, beqa, 'Pushed to pending'), note(1, ilo, 'Added')] }));
    vi.mocked(api.changeWork).mockResolvedValue(detail(search, { updates: [note(3, beqa, 'Made a task'), note(2, beqa, 'Pushed to pending'), note(1, ilo, 'Added')] }));
    vi.mocked(api.changePlan).mockResolvedValue(october);
    mount('/team-work?view=waiting');

    const side = await screen.findByRole('navigation', { name: 'Team work' });
    expect(await within(side).findByRole('button', { name: /^Waiting/ })).toHaveTextContent('Waiting1');
    // Nobody is tagged, so it waits for a decision; who pushed it shows when it is opened.
    expect(await screen.findByRole('heading', { name: /^Needs a decision/ })).toBeInTheDocument();
    const card = (await screen.findByText('Club search misses Georgian names')).closest('li')!;
    await waitFor(() => expect(card).toHaveTextContent('Waiting for a decision'));
    expect(within(card).queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument();
    await userEvent.click(within(card).getByRole('button', { name: /^Club search misses Georgian names/ }));
    const opened = screen.getByRole('listitem', { name: 'Club search misses Georgian names' });
    expect(opened).toHaveTextContent('Pushed by Beqa · now');
    expect(opened).toHaveTextContent('Acknowledged by you');
    await userEvent.click(within(card).getByRole('button', { name: 'Make it a task' }));
    expect(within(card).getAllByRole('menuitem').map(option => option.textContent)).toEqual(['On its own', 'In October work', 'In Registration and roles', 'In Store']);
    await userEvent.click(within(card).getByRole('menuitem', { name: 'In October work' }));
    await waitFor(() => expect(api.changePlan).toHaveBeenCalledWith(9, { version: 3, order: [] }));
    expect(api.changeWork).toHaveBeenCalledWith(61, { version: 0, update: 'Made a task' });
    expect(api.changePlan).toHaveBeenCalledWith(5, { version: 3, order: [1, 2, 3, 61] });
});

it('shows what a plan is for first (or asks for it), its tasks in order, and keeps the extras behind “…”', async () => {
    vi.mocked(api.changePlan).mockImplementation(async (id, change) => view(october.tasks, { plan: plan(id, 'October work', { version: 4, purpose: change.purpose ?? 'Pitches for everyone', status: change.status ?? 'NOW' }) }));
    vi.mocked(api.fetchDetail).mockResolvedValue(detail(october.tasks[1].item));
    mount('/team-work?plan=5');
    // No purpose yet: the name is the heading and a clear prompt asks for the purpose; written, it becomes the heading.
    expect(await screen.findByRole('heading', { name: /^October work/, level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Started by Beqa · Beqa, Gio Beridze')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Write what this plan is for' }));
    await userEvent.type(screen.getByLabelText('What this plan is for'), 'Pitches for everyone{Enter}');
    expect(api.changePlan).toHaveBeenCalledWith(5, { version: 3, purpose: 'Pitches for everyone' });
    expect(await screen.findByRole('heading', { name: 'Pitches for everyone', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^October work/, level: 1 })).not.toBeInTheDocument();
    expect(screen.getByText('October work')).toBeInTheDocument();
    expect(screen.queryByText(/Copy as new version|Plan history/)).not.toBeInTheDocument();

    const steps = screen.getByRole('heading', { name: 'In order' }).parentElement!;
    const strip = within(steps).getAllByRole('button');
    expect(strip).toHaveLength(3);
    expect(strip[0]).toHaveAttribute('aria-current', 'step');
    expect(strip[0]).toHaveTextContent('170%Branding and landingends about 1 week');
    await userEvent.click(strip[1]);
    expect(screen.getByTestId('where')).toHaveTextContent('task=2');
    const opened = await screen.findByRole('dialog', { name: /GK-2\s*Registration/ });
    expect(await within(opened).findByRole('region', { name: 'GK-2 Registration' })).toBeInTheDocument();
    expect(within(opened).getByRole('button', { name: 'Take off this plan' })).toBeInTheDocument();
    await userEvent.click(within(opened).getAllByRole('button', { name: 'Close' })[0]);

    // Gio's tasks only, with the one toolbar: the order follows, numbered as in the whole plan.
    await userEvent.selectOptions(screen.getByLabelText('Person'), String(gio.id));
    expect(screen.getByTestId('where')).toHaveTextContent('who=2');
    expect(within(screen.getByRole('heading', { name: 'In order' }).parentElement!).getByRole('button')).toHaveTextContent(/^2/);

    await userEvent.click(screen.getByRole('button', { name: 'More for this plan' }));
    expect(screen.getByRole('menuitemradio', { name: 'Working on it now' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Later' }));
    expect(api.changePlan).toHaveBeenCalledWith(5, { version: 4, status: 'LATER' });
    expect(await screen.findByText('Later', { selector: '.gk-badge, .gk-badge *' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'More for this plan' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Plan history' }));
    expect(within(screen.getByRole('dialog', { name: 'Plan history' })).getByText('Added Branding and landing')).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Plan history' })).getAllByRole('button', { name: 'Close' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Back to overview' }));
    expect(screen.getByTestId('where')).not.toHaveTextContent('plan=');
});

it('copies a plan for AI in the paste format with comments and file names as notes the paste skips', async () => {
    vi.mocked(api.fetchDetail).mockImplementation(async id => detail(id === 1 ? branding : item(id, 'x', 'PLANNED', 0), id === 1 ? {
        comments: [1, 2, 3, 4].map(n => ({ id: n, author: gio, body: `Note ${n} | with a bar`, createdAt: `2026-10-2${n}T10:00:00Z`, editedAt: null, canEdit: false })),
        media: [{ id: 8, kind: 'VIDEO', url: '/uploads/team-work/abc.webm', contentType: 'video/webm', sizeBytes: 10, uploadedBy: beqa, createdAt: now, canDelete: true }],
    } : {}));
    const text = planAsText(october, new Map([[1, await api.fetchDetail(1)]]));
    expect(text.split('\n')).toEqual([
        'plan: October work',
        '# Lines starting with # are notes: the last comments and files. Tasks match by key or name; nothing is deleted.',
        '- [in progress] GK-1 Branding and landing | started 2026-10-20 | ends ~1 weeks | 70% | Beqa',
        '  # Gio Beridze, 2026-10-22: Note 2 / with a bar',
        '  # Gio Beridze, 2026-10-23: Note 3 / with a bar',
        '  # Gio Beridze, 2026-10-24: Note 4 / with a bar',
        '  # files: video abc.webm',
        '  - [live] GK-11 Founders’ design | ends don\'t know | 100%',
        '  - [planned] GK-12 Hero copy | ends don\'t know | 0%',
        '  - [in progress] GK-13 Cloudflare lock | ends don\'t know | 50%',
        '- [blocked] GK-2 Registration | ends don\'t know | 30% | Gio Beridze',
        '- [planned, small] GK-3 Save button on phones | ends don\'t know | 0%',
    ]);

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    mount('/team-work?plan=5');
    await userEvent.click(await screen.findByRole('button', { name: 'More for this plan' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Copy for AI' }));
    const dialog = screen.getByRole('dialog', { name: 'Copy for AI' });
    await waitFor(() => expect((within(dialog).getByLabelText('The plan as text') as HTMLTextAreaElement).value).toContain('# files: video abc.webm'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringMatching(/^plan: October work\n/));
    expect(await within(dialog).findByRole('button', { name: 'Copied' })).toBeInTheDocument();
});

it('opens a task in place with its steps, comments and quick update, and keeps the words when a colleague saved first', async () => {
    vi.mocked(api.fetchDetail).mockResolvedValue(detail(branding, {
        steps, comments: [{ id: 3, author: { id: 2, name: 'Gio Beridze' }, body: 'Looks good on the phone', createdAt: now, editedAt: null, canEdit: false }],
        updates: [{ id: 9, author: { id: 1, name: 'Nino' }, at: twoDaysAgo, previousStatus: null, status: 'IN_PROGRESS', previousPercent: null, percent: 70, message: 'Added' }],
    }));
    vi.mocked(api.changeWork).mockRejectedValueOnce({ response: { status: 409, data: { detail: 'Someone else changed this work after you opened it.' } } });
    mount('/team-work?plan=5&task=1');
    const task = await screen.findByRole('region', { name: 'GK-1 Branding and landing' });
    expect(within(task).getByText('about 1 week')).toBeInTheDocument();
    expect(within(task).getByText('Looks good on the phone')).toBeInTheDocument();
    expect(within(task).getAllByText('Gio Beridze').length).toBeGreaterThan(0);
    expect(within(task).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    // The status is one compact control; "What changed" appears with the change.
    expect(within(task).queryByLabelText('What changed')).not.toBeInTheDocument();
    await userEvent.click(within(task).getByRole('button', { name: 'Status: In progress' }));
    await userEvent.click(within(task).getByRole('menuitemradio', { name: 'Live' }));
    expect(within(task).getByRole('button', { name: 'Status: Live' })).toBeInTheDocument();
    await userEvent.type(within(task).getByLabelText('What changed'), 'Shipped');
    await userEvent.click(within(task).getByRole('button', { name: 'Save update' }));
    expect(api.changeWork).toHaveBeenCalledWith(1, { version: 0, status: 'LIVE', percent: 100, update: 'Shipped' });
    expect(await within(task).findByRole('alert')).toHaveTextContent('Someone else changed this work');
    expect(within(task).getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(within(task).getByLabelText('What changed')).toHaveValue('Shipped');
    await userEvent.click(within(task).getByRole('button', { name: /Hero copy/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('step=12');
});

it('estimates progress in words, copies a task for AI with a way to answer, and deletes a task only after asking', async () => {
    vi.mocked(api.fetchDetail).mockResolvedValue(detail(branding, { steps, comments: [{ id: 3, author: gio, body: 'Hero copy is too long', createdAt: now, editedAt: null, canEdit: false }] }));
    vi.mocked(api.changeWork).mockResolvedValue(detail({ ...branding, percent: 50 }, { steps, comments: [{ id: 3, author: gio, body: 'Hero copy is too long', createdAt: now, editedAt: null, canEdit: false }] }));
    vi.mocked(api.deleteWork).mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    mount('/team-work?plan=5&task=1');
    const task = await screen.findByRole('region', { name: 'GK-1 Branding and landing' });
    // Progress is a small value; its words and slider sit behind it. 70% is exact, so the slider is open; a word sets an estimate.
    expect(within(task).queryByLabelText('Exact progress')).not.toBeInTheDocument();
    await userEvent.click(within(task).getByRole('button', { name: 'Progress: 70%' }));
    expect(within(task).getByLabelText('Exact progress')).toHaveValue('70');
    await userEvent.click(within(task).getByRole('radio', { name: 'Halfway' }));
    expect(within(task).queryByLabelText('Exact progress')).not.toBeInTheDocument();
    await userEvent.click(within(task).getByRole('button', { name: 'Save update' }));
    expect(api.changeWork).toHaveBeenCalledWith(1, { version: 0, percent: 50 });

    await userEvent.click(within(task).getByRole('button', { name: 'Copy for AI' }));
    const brief = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];
    expect(brief).toContain('Team work task GK-1: Branding and landing');
    expect(brief).toContain('Done means: not written yet');
    expect(brief).toContain('in the plan "October work"');
    expect(brief).toContain('team-work?task=1');
    expect(brief).toContain('Gio Beridze');
    expect(brief).toContain('- [live] GK-11 Founders’ design (100%)');
    expect(brief).toContain('Put the key GK-1 in every commit message');
    expect(brief).toContain('report: GK-1');
    expect(await within(task).findByRole('button', { name: 'Copied' })).toBeInTheDocument();

    await userEvent.click(within(task).getByRole('button', { name: 'Delete' }));
    const confirm = screen.getByRole('dialog', { name: 'Delete this task?' });
    expect(confirm).toHaveTextContent('“Branding and landing” and its 3 steps');
    expect(api.deleteWork).not.toHaveBeenCalled();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    expect(api.deleteWork).toHaveBeenCalledWith(1);
    await waitFor(() => expect(screen.getByTestId('where')).not.toHaveTextContent('task='));
});

it('previews a paste before applying it, shows deletes, and flags a new task whose name is already in another plan', async () => {
    vi.mocked(api.pasteIntoPlan).mockResolvedValueOnce({ created: 2, updated: 1, moved: 1, unchanged: 0, deleted: 1, applied: false, view: null, problems: [],
        lines: [{ line: 1, action: 'NEW', title: 'Agent Dola on live', parent: null, detail: null }, { line: 2, action: 'UPDATED', title: 'Registration', parent: null, detail: '30% → 45%' }, { line: 3, action: 'MOVED', title: 'Hero copy', parent: 'Registration', detail: null },
            { line: 4, action: 'NEW', title: 'User registration', parent: null, detail: null }, { line: 5, action: 'DELETED', title: 'Save button on phones', parent: null, detail: null }] })
        .mockResolvedValueOnce({ created: 2, updated: 1, moved: 1, unchanged: 0, deleted: 1, applied: true, view: view([{ item: branding, steps: [] }]), problems: [], lines: [] });
    mount('/team-work?plan=5');
    await userEvent.click(await screen.findByRole('button', { name: 'Paste from AI' }));
    const dialog = screen.getByRole('dialog', { name: 'Paste from AI' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Use the example' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Preview' }));
    expect(await within(dialog).findByText('2 new, 1 updated, 1 step moved, 1 deleted')).toBeInTheDocument();
    expect(api.pasteIntoPlan).toHaveBeenCalledWith(5, api.PASTE_EXAMPLE, false);
    expect(within(dialog).getByText('Deleted')).toBeInTheDocument();
    expect(within(dialog).getByText('Already in Registration and roles')).toBeInTheDocument();
    expect(within(dialog).getByRole('status')).toHaveTextContent('1 new task has the name of a task in another plan');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    expect(api.pasteIntoPlan).toHaveBeenLastCalledWith(5, api.PASTE_EXAMPLE, true);
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
    const panel = (await screen.findByRole('heading', { name: 'Team' })).closest<HTMLElement>('.tw-team')!;
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
    await userEvent.click(await screen.findByRole('button', { name: 'What changed' }));
    expect(screen.getByTestId('where')).toHaveTextContent('view=changes');
    expect(await screen.findByRole('heading', { name: 'What changed', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('Format the media files', { selector: '.tw-latest__commit' })).toBeInTheDocument();
    expect(screen.getByText('Not known for this build')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent changes' })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('My backend version'), '9f8c21b8'.padEnd(40, '0'));
    expect(screen.getByRole('heading', { name: 'You’re missing 1' })).toBeInTheDocument();
    const missingList = screen.getByRole('heading', { name: 'You’re missing 1' }).parentElement!;
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
    await userEvent.click(screen.getByRole('button', { name: 'Copy update message' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(message.value);
    await userEvent.click(screen.getByRole('button', { name: 'Overview' }));
    expect(screen.getByTestId('where')).not.toHaveTextContent('view=');
});

it('shows how the point of a plan changed, a plan as a step of another, and “Part of” on the child', async () => {
    const store = plan(7, 'Store', { purpose: 'Pay for kit with a card', percent: 40, taskCount: 3, done: 1, inProgress: 1, partOf: { id: 6, name: 'Registration and roles', purpose: 'Parents find a pitch' } });
    const launch = view(plans[6].tasks, { plan: plan(6, 'Registration and roles', { purpose: 'Parents find a pitch' }), steps: [store],
        purposeChanges: [{ id: 1, author: beqa, at: now, previous: 'Every club pin on one map', purpose: 'Parents find a pitch' }], changes: [started(ilo)] });
    const storeView = view(plans[7].tasks, { plan: store, changes: [] });
    const without = view(plans[6].tasks, { plan: launch.plan, steps: [], purposeChanges: launch.purposeChanges, changes: [] });
    let detached = false;
    useLists(launch, storeView);
    vi.mocked(api.fetchPlan).mockImplementation(async id => id === 6 ? (detached ? without : launch) : id === 7 ? storeView : plans[id]);
    vi.mocked(api.removePlanStep).mockImplementation(async () => { detached = true; return without; });
    vi.mocked(api.addPlanStep).mockResolvedValue(launch);
    mount('/team-work?plan=6');
    expect(await screen.findByRole('heading', { name: 'Parents find a pitch', level: 1 })).toBeInTheDocument();
    const was = screen.getByText('Was:').closest('p')!;
    expect(was).toHaveTextContent('Was: Every club pin on one map → now: Parents find a pitch');
    expect(was).toHaveTextContent('by Beqa');

    // The step: the child plan with its purpose and progress; a quiet way to take it out.
    const strip = screen.getByRole('heading', { name: 'In order' }).parentElement!;
    const step = within(strip).getByRole('button', { name: 'Plan Store' });
    expect(step).toHaveTextContent('Pay for kit with a card');
    expect(step).toHaveTextContent('40%');
    expect(step).toHaveTextContent('plan · 2 open');
    await userEvent.click(within(strip).getByRole('button', { name: 'Take the plan Store out' }));
    expect(api.removePlanStep).toHaveBeenCalledWith(6, 7);
    await waitFor(() => expect(within(screen.getByRole('heading', { name: 'In order' }).parentElement!).queryByRole('button', { name: 'Plan Store' })).not.toBeInTheDocument());

    // Adding one back goes through the menu; the plan itself and the plans above are never offered.
    await userEvent.click(screen.getByRole('button', { name: 'More for this plan' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Add a plan as a step' }));
    const dialog = screen.getByRole('dialog', { name: 'Add a plan as a step' });
    const options = within(dialog).getAllByRole('option').map(option => option.textContent);
    expect(options).not.toContain('Parents find a pitch · Registration and roles');
    await userEvent.selectOptions(within(dialog).getByLabelText('Which plan'), '5');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add as a step' }));
    expect(api.addPlanStep).toHaveBeenCalledWith(6, 5);

    // The child says what it is part of, and opens the parent from there.
    await userEvent.click(screen.getByRole('button', { name: 'Back to overview' }));
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Plans' })).getByRole('button', { name: /Pay for kit with a card/ }));
    expect(await screen.findByRole('button', { name: 'Part of Registration and roles' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Part of Registration and roles' }));
    expect(screen.getByTestId('where')).toHaveTextContent('plan=6');
});

it('shows what one person is doing, with their responsibility, and the Team page writes it', async () => {
    const members: api.Member[] = [{ userId: 3, name: 'Ilo', email: 'admin.ilo@talanti.ge', admin: true, addedAt: null, pending: false, responsibility: 'Registration' },
        { userId: 2, name: 'Gio Beridze', email: 'admin.gio@talanti.ge', admin: true, addedAt: null, pending: false }];
    vi.mocked(api.fetchBoard).mockResolvedValue({ items: boardOf(Object.values(plans)), trail: [], canManageTeam: true, team: members });
    vi.mocked(api.fetchTeam).mockResolvedValue(members);
    vi.mocked(api.setResponsibility).mockResolvedValue([{ ...members[0], responsibility: 'Registration and sign-in' }, members[1]]);
    mount('/team-work?who=3');
    const doing = (await screen.findByRole('heading', { name: /What Ilo is doing/ })).closest('section')!;
    expect(doing).toHaveTextContent('Registration');
    expect(within(doing).getByRole('button', { name: /User registration/ })).toBeInTheDocument();
    expect(within(doing).getByRole('heading', { name: /In progress/ })).toBeInTheDocument();
    expect(within(doing).getByText('Nothing blocked.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent activity' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Plans' })).not.toBeInTheDocument();
    // The person filter names the responsibility too.
    expect(screen.getByRole('option', { name: 'Ilo · Registration' })).toBeInTheDocument();

    await userEvent.click(within(screen.getByRole('navigation', { name: 'Team work' })).getByRole('button', { name: 'Team' }));
    const line = await screen.findByLabelText('What Ilo looks after');
    expect(line).toHaveValue('Registration');
    await userEvent.type(line, ' and sign-in{Enter}');
    expect(api.setResponsibility).toHaveBeenCalledWith(3, 'Registration and sign-in');
    expect(await screen.findByDisplayValue('Registration and sign-in')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'What Ilo is doing' })).toHaveAttribute('href', '/team-work?who=3');
});

it('does not exist for accounts off the team, and Home shows no row without the capability', async () => {
    vi.mocked(api.fetchPlans).mockRejectedValue({ response: { status: 404 } });
    mount();
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    const { container } = render(<MemoryRouter><TeamWorkHomeRow caps={{ version: 1, workspaces: [] }} /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
});

it('shows team accounts a quiet Home row with how much is in progress', async () => {
    vi.mocked(api.fetchBoard).mockResolvedValue({ items: [item(1, 'Registration', 'IN_PROGRESS', 30), item(2, 'Branding', 'NEEDS_LOOK', 70, { openQuestions: 2 }), item(3, 'Schedule', 'LIVE', 100)], trail: [], canManageTeam: false, team: [] });
    render(<MemoryRouter><TeamWorkHomeRow caps={{ version: 1, workspaces: [{ id: 'team.work', context: { type: 'user', id: 1, label: 'Team work' } }] }} /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Team work. 1 in progress · 3 need you' })).toHaveAttribute('href', '/team-work');
});

it('shows the brief first: key, done means, questions for Beqa with quick answers, links and what it waits on; the tabs count what waits on you; a report pastes in', async () => {
    const schema = item(80, 'The schema', 'IN_PROGRESS', 40);
    const ref = { id: 80, key: 'GK-80', title: 'The schema', status: 'IN_PROGRESS' as const };
    const page = item(81, 'The task page', 'NEEDS_LOOK', null, { doneMeans: 'A task shows its key, done means, questions and links first', priority: 'NOW', requestedBy: beqa, openQuestions: 1,
        links: [{ kind: 'BLOCKED_BY', task: ref }], waitingOn: [ref] });
    const question = { id: 7, text: 'Should finished become live?', options: ['Live', 'Accepted'], askedBy: ilo, at: now, answer: null, answeredBy: null, answeredAt: null };
    const found = { id: 'abc1234'.padEnd(40, '0'), date: now, author: 'Dola', title: 'GK-81 the task page', merge: false };
    const upgrade = view([{ item: page, steps: [] }, { item: schema, steps: [] }], { plan: plan(10, 'Team work upgrade'), changes: [] });
    useLists(upgrade);
    vi.mocked(api.fetchDetail).mockImplementation(async id => detail(id === 81 ? page : schema, id === 81 ? { questions: [question], foundCommits: [found] } : {}));
    vi.mocked(api.answerQuestion).mockResolvedValue(detail({ ...page, openQuestions: 0 }, { questions: [{ ...question, answer: 'Live', answeredBy: beqa, answeredAt: now }], foundCommits: [found] }));
    vi.mocked(api.pasteReport).mockResolvedValueOnce({ applied: false, detail: null, problems: [], lines: [
        { field: 'status', action: 'SAME', detail: 'needs look → needs look' }, { field: 'branch', action: 'SET', detail: 'golive/registration-f' }, { field: 'question', action: 'ADDED', detail: 'Is the parent step needed for 16–17 too?' }] })
        .mockResolvedValueOnce({ applied: true, problems: [], lines: [], detail: detail({ ...page, branch: 'golive/registration-f', openQuestions: 2 }, { questions: [question], foundCommits: [found] }) });
    mount('/team-work?plan=10&task=81');

    const side = await screen.findByRole('navigation', { name: 'Team work' });
    await waitFor(() => expect(within(side).getByRole('button', { name: /^Overview/ })).toHaveTextContent('Overview2'));

    // The task page: what it is for (a prompt, here), then done means; who, when and Copy for AI in view; status compact.
    const task = await screen.findByRole('region', { name: 'GK-81 The task page' });
    expect(within(task).getByRole('button', { name: 'Write what this task is for' })).toBeInTheDocument();
    expect(within(task).getByRole('heading', { name: 'Done means' })).toBeInTheDocument();
    expect(within(task).getByText('A task shows its key, done means, questions and links first')).toBeInTheDocument();
    expect(within(task).getByText('Requested by Beqa')).toBeInTheDocument();
    expect(within(task).getByText('Now', { selector: '.tw-chip' })).toBeInTheDocument();
    expect(within(task).getByRole('button', { name: 'Copy for AI' })).toBeInTheDocument();
    expect(within(task).getByRole('button', { name: 'Add file, picture or video' })).toBeInTheDocument();
    expect(within(task).getByText('Waiting on GK-80 The schema')).toBeInTheDocument();
    expect(within(task).getByText('Blocked by')).toBeInTheDocument();
    expect(within(task).getByText('GK-81 the task page')).toBeInTheDocument();
    expect(within(task).getByRole('button', { name: 'Status: Needs your look' })).toBeInTheDocument();
    expect(within(task).getByRole('button', { name: 'Progress: no percent' })).toBeInTheDocument();
    expect(within(task).queryByRole('radio', { name: 'No percent' })).not.toBeInTheDocument();

    // A quick answer is kept with the question, and the count on the tab drops.
    const asked = within(task).getByText('Should finished become live?').closest('li')!;
    expect(within(asked).getByText('Ilo · now')).toBeInTheDocument();
    await userEvent.click(within(asked).getByRole('button', { name: 'Live' }));
    expect(api.answerQuestion).toHaveBeenCalledWith(7, 'Live');
    expect(await within(asked).findByText('Live', { selector: 'strong' })).toBeInTheDocument();
    expect(asked).toHaveTextContent('Beqa');
    expect(within(asked).getByRole('button', { name: 'Take back' })).toBeInTheDocument();

    // Paste report: a preview first, then apply.
    await userEvent.click(within(task).getByRole('button', { name: 'Paste report' }));
    const dialog = screen.getByRole('dialog', { name: 'Paste report · GK-81' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Use the example' }));
    expect((within(dialog).getByLabelText('The report, as text') as HTMLTextAreaElement).value).toContain('report: GK-81');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Preview' }));
    expect(await within(dialog).findByText('2 things to set')).toBeInTheDocument();
    expect(api.pasteReport).toHaveBeenCalledWith(81, expect.stringContaining('report: GK-81'), false);
    expect(within(dialog).getByText('golive/registration-f')).toBeInTheDocument();
    expect(within(dialog).getByText('Adds')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    expect(api.pasteReport).toHaveBeenLastCalledWith(81, expect.stringContaining('report: GK-81'), true);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Paste report · GK-81' })).not.toBeInTheDocument());
    expect(within(task).getByText('golive/registration-f')).toBeInTheDocument();
});
