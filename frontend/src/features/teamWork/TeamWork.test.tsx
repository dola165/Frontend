import '../../i18n';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from './api';
import { TeamWorkPage } from './TeamWorkPage';
import { TeamWorkHomeRow } from './TeamWorkHomeRow';

vi.mock('./api', async importOriginal => ({
    ...await importOriginal<typeof api>(), fetchBoard: vi.fn(), fetchDetail: vi.fn(), createWork: vi.fn(), changeWork: vi.fn(), fetchRoadmaps: vi.fn(), fetchRoadmap: vi.fn(),
    createRoadmap: vi.fn(), changeRoadmap: vi.fn(), pasteIntoRoadmap: vi.fn(), fetchTeam: vi.fn(), addMember: vi.fn(), newInvite: vi.fn(), removeMember: vi.fn(),
}));
vi.mock('../../pages/RouteRecoveryPage', () => ({ RouteRecoveryPage: () => <p>Page not found</p> }));

const now = new Date().toISOString();
const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
const beqa = { id: 1, name: 'Beqa' };
const item = (id: number, title: string, status: api.WorkStatus, percent: number, extra: Partial<api.WorkItem> = {}): api.WorkItem => ({
    id, title, area: null, status, percent, step: null, notes: null, branch: null, prUrl: null, version: 0, updatedBy: beqa, updatedAt: now, createdAt: now,
    parentId: null, description: null, startedOn: null, end: { kind: 'UNKNOWN' }, percentFromParts: false, people: [], mediaCount: 0, commentCount: 0, small: false, ...extra,
});
const roadmap = (id: number, name: string, extra: Partial<api.Roadmap> = {}): api.Roadmap => ({ id, name, copiedFrom: null, copiedFromName: null, version: 3, pieceCount: 2, updatedBy: beqa, updatedAt: now, createdAt: now,
    status: 'NOW', percent: 55, inProgress: 3, toDo: 2, finished: 1, nextPiece: 'Branding and landing', ...extra });
const branding = item(1, 'Branding and landing', 'IN_PROGRESS', 70, { startedOn: '2026-10-20', end: { kind: 'ABOUT', amount: 1, unit: 'WEEKS' } });
const parts = [item(11, 'Founders’ design', 'FINISHED', 100, { parentId: 1 }), item(12, 'Hero copy', 'PLANNED', 0, { parentId: 1 }), item(13, 'Cloudflare lock', 'IN_PROGRESS', 50, { parentId: 1 })];
const view = (pieces: api.WorkNode[], extra: Partial<api.RoadmapView> = {}): api.RoadmapView => ({
    roadmap: roadmap(5, 'October work'), pieces, changes: [{ id: 1, author: beqa, at: now, message: 'Added Branding and landing' }],
    trail: [{ itemId: 2, title: 'Registration', at: twoDaysAgo }, { itemId: 1, title: 'Branding', at: now }], team: [beqa, { id: 2, name: 'Gio' }], canManageTeam: true, ...extra,
});
const detail = (work: api.WorkItem, extra: Partial<api.Detail> = {}): api.Detail => ({ item: work, updates: [], parts: [], media: [], comments: [], ...extra });
function Where() { const location = useLocation(); return <output data-testid="where">{location.search}</output>; }
const mount = (path = '/team-work') => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/team-work" element={<><TeamWorkPage /><Where /></>} /></Routes></MemoryRouter>);

beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.fetchTeam).mockResolvedValue([{ userId: 1, name: 'Nino', email: 'nino@example.com', admin: true, addedAt: null, pending: false }]);
    vi.mocked(api.fetchRoadmaps).mockResolvedValue([roadmap(5, 'October work'), roadmap(6, 'Registration and roles', { percent: 20, inProgress: 1, toDo: 4, finished: 0, nextPiece: 'User registration' }),
        roadmap(4, 'This week’s work', { updatedAt: twoDaysAgo, status: 'FINISHED', percent: 100 }), roadmap(7, 'Store', { status: 'LATER', percent: 0 })]);
    vi.mocked(api.fetchBoard).mockResolvedValue({ items: [], trail: [], canManageTeam: true });
    vi.mocked(api.fetchRoadmap).mockResolvedValue(view([{ item: branding, parts }, { item: item(2, 'Registration', 'ON_HOLD', 30, { step: 'Waiting for email provider' }), parts: [] }]));
});

it('starts with this week’s work on its own roadmap when there is none, created through the normal API', async () => {
    vi.mocked(api.fetchRoadmaps).mockResolvedValueOnce([]);
    vi.mocked(api.createRoadmap).mockResolvedValue(view([], { roadmap: roadmap(9, 'This week’s work') }));
    vi.mocked(api.createWork).mockResolvedValue(detail(branding));
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Load this week’s work' }));
    await waitFor(() => expect(api.createWork).toHaveBeenCalledTimes(api.STARTER_WORK.length));
    expect(api.createRoadmap).toHaveBeenCalledWith('This week’s work');
    expect(api.createWork).toHaveBeenCalledWith(expect.objectContaining({ title: 'Registration', roadmapId: 9 }));
});

it('opens on the plans being worked on now as boxes, with later and finished plans below', async () => {
    mount();
    const boxes = await screen.findByRole('heading', { name: 'Working on now' });
    const now = boxes.parentElement!;
    const box = within(now).getByRole('button', { name: /^October work/ });
    expect(box).toHaveTextContent('55%');
    expect(box).toHaveTextContent('3 in progress · 2 to do · 1 done');
    expect(box).toHaveTextContent('Next: Branding and landing');
    expect(within(now).getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Later 1' }).parentElement).toHaveTextContent('Store');
    expect(screen.getByRole('heading', { name: 'Finished 1' }).parentElement).toHaveTextContent('This week’s work');
    expect(screen.queryByText(/roadmap/i)).not.toBeInTheDocument();
    await userEvent.click(within(now).getByRole('button', { name: /^Registration and roles/ }));
    await waitFor(() => expect(api.fetchRoadmap).toHaveBeenLastCalledWith(6, expect.anything()));
    expect(screen.getByTestId('where')).toHaveTextContent('roadmap=6');
});

it('shows a plan as a tree with dots, parts, small fixes and a time strip, moves it to later, and goes back to all plans', async () => {
    vi.mocked(api.fetchRoadmap).mockResolvedValue(view([{ item: branding, parts }, { item: item(2, 'Registration', 'ON_HOLD', 30, { step: 'Waiting for email provider' }), parts: [] },
        { item: item(3, 'Save button on phones', 'PLANNED', 0, { small: true }), parts: [] }]));
    vi.mocked(api.changeRoadmap).mockResolvedValue(view([], { roadmap: roadmap(5, 'October work', { status: 'LATER', version: 4 }) }));
    mount('/team-work?roadmap=5');
    const tree = await screen.findByRole('list', { name: 'October work' });
    expect(screen.getByRole('heading', { name: 'October work', level: 1 })).toBeInTheDocument();
    expect(within(tree).getByRole('button', { name: /^In progress Branding and landing/ })).toHaveTextContent('3 parts · 70%');
    expect(within(tree).getByRole('button', { name: /Registration/ })).toHaveTextContent('30% · Waiting for email provider');
    expect(within(tree).getByRole('button', { name: /Save button on phones/ })).toHaveTextContent('small');
    expect(within(tree).getByRole('img', { name: /Started 20 Oct · ends: about 1 week · 70%/ })).toBeInTheDocument();
    expect(screen.getByText('Planned', { selector: '.tw-key span' })).toBeInTheDocument();
    expect(screen.getByText(/changed by Beqa · now/)).toBeInTheDocument();
    expect(screen.getByLabelText('Latest switches')).toHaveTextContent('Registration · 2 days ago→Branding · now');
    await userEvent.click(within(tree).getByRole('button', { name: 'Hide the parts of Branding and landing' }));
    expect(within(tree).queryByText('Hero copy')).not.toBeInTheDocument();

    expect(screen.getByRole('radio', { name: 'Now' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Later' }));
    expect(api.changeRoadmap).toHaveBeenCalledWith(5, { version: 3, status: 'LATER' });
    expect(await screen.findByRole('radio', { name: 'Later' })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'All plans' }));
    expect(screen.getByTestId('where')).not.toHaveTextContent('roadmap=');
    expect(await screen.findByRole('heading', { name: 'Working on now' })).toBeInTheDocument();
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
    expect(within(piece).getByText('GB')).toBeInTheDocument();
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

it('adds a colleague without an account and shows the one-time sign-up link, with a new link for pending colleagues', async () => {
    const invite = { userId: 7, email: 'admin.gio@talanti.ge', token: 'tok-1', expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() };
    const gio = { userId: 7, name: null, email: invite.email, admin: false, addedAt: now, pending: true };
    vi.mocked(api.addMember).mockResolvedValue({ members: [gio], invite });
    vi.mocked(api.newInvite).mockResolvedValue({ ...invite, token: 'tok-2' });
    mount();
    await userEvent.type(await screen.findByPlaceholderText('Colleague’s email'), invite.email);
    await userEvent.click(screen.getByRole('button', { name: 'Add colleague' }));
    expect(api.addMember).toHaveBeenCalledWith(invite.email);
    expect(await screen.findByLabelText(`Sign-up link for ${invite.email}`)).toHaveValue(`${window.location.origin}/reset-password?token=tok-1`);
    expect(screen.getByText('Invited')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New link' }));
    expect(await screen.findByDisplayValue(`${window.location.origin}/reset-password?token=tok-2`)).toBeInTheDocument();
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
