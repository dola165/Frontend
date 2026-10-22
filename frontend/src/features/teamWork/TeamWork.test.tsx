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
}));
vi.mock('../../pages/RouteRecoveryPage', () => ({ RouteRecoveryPage: () => <p>Page not found</p> }));

const now = new Date().toISOString();
const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
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
    7: view([{ item: item(41, 'Checkout', 'PLANNED', 0), parts: [] }], { roadmap: roadmap(7, 'Store', { status: 'LATER', percent: 0 }), changes: [] }),
};
const detail = (work: api.WorkItem, extra: Partial<api.Detail> = {}): api.Detail => ({ item: work, updates: [], parts: [], media: [], comments: [], ...extra });
function Where() { const location = useLocation(); return <output data-testid="where">{location.search}</output>; }
const mount = (path = '/team-work') => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/team-work" element={<><TeamWorkPage /><Where /></>} /></Routes></MemoryRouter>);

beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.fetchTeam).mockResolvedValue([{ userId: 1, name: 'Nino', email: 'nino@example.com', admin: true, addedAt: null, pending: false }]);
    vi.mocked(api.fetchRoadmaps).mockResolvedValue([5, 6, 4, 7].map(id => plans[id].roadmap));
    vi.mocked(api.fetchRoadmap).mockImplementation(async id => plans[id]);
    vi.mocked(api.fetchBoard).mockResolvedValue({ items: [], trail: [], canManageTeam: true });
});

it('starts with this week’s work on its own plan when there is none, created through the normal API', async () => {
    vi.mocked(api.fetchRoadmaps).mockResolvedValueOnce([]);
    vi.mocked(api.createRoadmap).mockResolvedValue(view([], { roadmap: roadmap(9, 'This week’s work') }));
    vi.mocked(api.createWork).mockResolvedValue(detail(branding));
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Load this week’s work' }));
    await waitFor(() => expect(api.createWork).toHaveBeenCalledTimes(api.STARTER_WORK.length));
    expect(api.createRoadmap).toHaveBeenCalledWith('This week’s work');
    expect(api.createWork).toHaveBeenCalledWith(expect.objectContaining({ title: 'Registration', roadmapId: 9 }));
});

it('opens on plan boxes with who started them and who is on them, filtered by name through the URL', async () => {
    mount();
    const now = (await screen.findByRole('heading', { name: 'Working on now' })).parentElement!;
    const box = await within(now).findByRole('button', { name: /^October work/ });
    await waitFor(() => expect(box).toHaveTextContent('Started by Beqa · Beqa, Gio Beridze'));
    expect(box).toHaveTextContent('55%');
    expect(box).toHaveTextContent('3 in progress · 2 to do · 1 done');
    expect(box).toHaveTextContent('Next: Branding and landing');
    expect(screen.getByRole('heading', { name: 'Later 1' }).parentElement).toHaveTextContent('Store');
    expect(screen.getByRole('heading', { name: 'Finished 1' }).parentElement).toHaveTextContent('This week’s work');
    expect(screen.queryByText(/roadmap/i)).not.toBeInTheDocument();

    const names = screen.getByRole('group', { name: 'Show work for' });
    expect(within(names).getByRole('button', { name: 'All plans' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(within(names).getByRole('button', { name: 'Ilo' }));
    expect(screen.getByTestId('where')).toHaveTextContent('who=3');
    expect(within(now).getAllByRole('button')).toHaveLength(1);
    expect(within(now).getByRole('button')).toHaveTextContent('Registration and roles');
    expect(screen.queryByRole('heading', { name: /^Later/ })).not.toBeInTheDocument();
    await userEvent.click(within(names).getByRole('button', { name: 'Whole team' }));
    expect(screen.getByTestId('where')).toHaveTextContent('who=team');
    expect(screen.getByText('No plan for this right now.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Later 1' })).toBeInTheDocument();

    await userEvent.click(within(names).getByRole('button', { name: 'All plans' }));
    expect(screen.getByTestId('where')).not.toHaveTextContent('who=');
    await userEvent.click(within(now).getByRole('button', { name: /^Registration and roles/ }));
    await waitFor(() => expect(api.fetchRoadmap).toHaveBeenLastCalledWith(6, expect.anything()));
    expect(screen.getByTestId('where')).toHaveTextContent('roadmap=6');
});

it('shows a plan as a list with names and small fixes, then step by step, and keeps the extras behind “…”', async () => {
    vi.mocked(api.changeRoadmap).mockResolvedValue(view(october.pieces, { roadmap: roadmap(5, 'October work', { status: 'LATER', version: 4 }) }));
    vi.mocked(api.fetchDetail).mockResolvedValue(detail(october.pieces[1].item));
    mount('/team-work?roadmap=5');
    const list = await screen.findByRole('list', { name: 'October work' });
    expect(screen.getByRole('heading', { name: 'October work', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Started by Beqa · Beqa, Gio Beridze')).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: /^In progress Branding and landing/ })).toHaveTextContent('3 parts · 70% · Beqa');
    expect(within(list).getByRole('button', { name: /Registration/ })).toHaveTextContent('30% · Gio Beridze');
    expect(within(list).getByRole('button', { name: /Save button on phones/ })).toHaveTextContent('small');
    expect(screen.queryByText(/Copy as new version|Plan history/)).not.toBeInTheDocument();

    const steps = screen.getByRole('heading', { name: 'Step by step' }).parentElement!;
    const cards = within(steps).getAllByRole('button');
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveAttribute('aria-current', 'step');
    expect(cards[0]).toHaveTextContent('170%Branding and landingends about 1 week');
    expect(cards[2]).toHaveTextContent('3');
    await userEvent.click(cards[1]);
    expect(screen.getByTestId('where')).toHaveTextContent('open=2');

    // Gio's pieces only: the list and the steps follow the name, numbered as in the whole plan.
    await userEvent.click(within(screen.getByRole('group', { name: 'Show work for' })).getByRole('button', { name: 'Gio Beridze' }));
    expect(within(screen.getByRole('list', { name: 'October work' })).queryByText('Branding and landing')).not.toBeInTheDocument();
    expect(within(screen.getByRole('heading', { name: 'Step by step' }).parentElement!).getByRole('button')).toHaveTextContent(/^2/);

    await userEvent.click(screen.getByRole('button', { name: 'More for this plan' }));
    expect(screen.getByRole('menuitemradio', { name: 'Working on it now' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Later' }));
    expect(api.changeRoadmap).toHaveBeenCalledWith(5, { version: 3, status: 'LATER' });
    expect(await screen.findByText('Later', { selector: '.gk-badge, .gk-badge *' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'More for this plan' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Plan history' }));
    expect(within(screen.getByRole('dialog', { name: 'Plan history' })).getByText('Added Branding and landing')).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Plan history' })).getAllByRole('button', { name: 'Close' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'All plans' }));
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
    await userEvent.click(await screen.findByRole('button', { name: 'More for this plan' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Copy for AI' }));
    const dialog = screen.getByRole('dialog', { name: 'Copy for AI' });
    await waitFor(() => expect((within(dialog).getByLabelText('The plan as text') as HTMLTextAreaElement).value).toContain('# files: video abc.webm'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringMatching(/^plan: October work\n/));
    expect(await within(dialog).findByRole('button', { name: 'Copied' })).toBeInTheDocument();
});

it('opens a piece in place with its parts, comments and quick update, and keeps the words when a colleague saved first', async () => {
    vi.mocked(api.fetchDetail).mockResolvedValue(detail(branding, {
        parts, comments: [{ id: 3, author: { id: 2, name: 'Gio Beridze' }, body: 'Looks good on the phone', createdAt: now, editedAt: null, canEdit: false }],
        updates: [{ id: 9, author: { id: 1, name: 'Nino' }, at: twoDaysAgo, previousStatus: null, status: 'IN_PROGRESS', previousPercent: null, percent: 70, message: 'Added' }],
    }));
    vi.mocked(api.changeWork).mockRejectedValueOnce({ response: { status: 409, data: { detail: 'Someone else changed this work after you opened it.' } } });
    mount('/team-work?roadmap=5&open=1');
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

it('previews a paste before applying it, and never offers to delete', async () => {
    vi.mocked(api.pasteIntoRoadmap).mockResolvedValueOnce({ created: 1, updated: 1, moved: 1, unchanged: 0, applied: false, view: null, problems: [],
        lines: [{ line: 1, action: 'NEW', title: 'Agent Dola on live', parent: null, detail: null }, { line: 2, action: 'UPDATED', title: 'Registration', parent: null, detail: '30% → 45%' }, { line: 3, action: 'MOVED', title: 'Hero copy', parent: 'Registration', detail: null }] })
        .mockResolvedValueOnce({ created: 1, updated: 1, moved: 1, unchanged: 0, applied: true, view: view([{ item: branding, parts: [] }]), problems: [], lines: [] });
    mount('/team-work?roadmap=5');
    await userEvent.click(await screen.findByRole('button', { name: 'Paste from AI' }));
    const dialog = screen.getByRole('dialog', { name: 'Paste from AI' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Use the example' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Preview' }));
    expect(await within(dialog).findByText('1 new, 1 updated, 1 part moved')).toBeInTheDocument();
    expect(api.pasteIntoRoadmap).toHaveBeenCalledWith(5, api.PASTE_EXAMPLE, false);
    expect(within(dialog).queryByRole('button', { name: /delete|remove/i })).not.toBeInTheDocument();
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
    await userEvent.click(screen.getByRole('button', { name: 'All plans' }));
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
