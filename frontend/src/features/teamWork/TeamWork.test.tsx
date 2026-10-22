import '../../i18n';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from './api';
import { TeamWorkPage } from './TeamWorkPage';
import { TeamWorkHomeRow } from './TeamWorkHomeRow';

vi.mock('./api', async importOriginal => ({ ...await importOriginal<typeof api>(), fetchBoard: vi.fn(), fetchDetail: vi.fn(), createWork: vi.fn(), changeWork: vi.fn(), fetchTeam: vi.fn(), addMember: vi.fn(), removeMember: vi.fn() }));
vi.mock('../../pages/RouteRecoveryPage', () => ({ RouteRecoveryPage: () => <p>Page not found</p> }));

const now = new Date().toISOString();
const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
const item = (id: number, title: string, status: api.WorkStatus, percent: number, extra: Partial<api.WorkItem> = {}): api.WorkItem => ({
    id, title, area: null, status, percent, step: null, notes: null, branch: null, prUrl: null, version: 0, updatedBy: { id: 1, name: 'Beqa' }, updatedAt: now, createdAt: now, ...extra,
});
const board = (items: api.WorkItem[], canManageTeam = true): api.Board => ({ items, trail: [{ itemId: 1, title: 'Registration', at: twoDaysAgo }, { itemId: 3, title: 'Branding', at: now }], canManageTeam });
const mount = (path = '/team-work') => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/team-work" element={<TeamWorkPage />} /></Routes></MemoryRouter>);

beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.fetchTeam).mockResolvedValue([{ userId: 1, name: 'Nino', email: 'nino@example.com', admin: true, addedAt: null }]);
});

it('offers a system admin this week’s work on an empty board, created through the normal API', async () => {
    vi.mocked(api.fetchBoard).mockResolvedValueOnce(board([])).mockResolvedValue(board([item(1, 'Registration', 'IN_PROGRESS', 30)]));
    vi.mocked(api.createWork).mockResolvedValue({ item: item(1, 'Registration', 'IN_PROGRESS', 30), updates: [] });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Load this week’s work' }));
    await waitFor(() => expect(api.createWork).toHaveBeenCalledTimes(api.STARTER_WORK.length));
    expect(api.createWork).toHaveBeenCalledWith(expect.objectContaining({ title: 'Registration', status: 'IN_PROGRESS', percent: 30, step: 'Waiting for email provider' }));
    expect(await screen.findByRole('table', { name: 'Team work' })).toBeInTheDocument();
});

it('lists the work with status, progress and who touched it, filters by status and shows the trail', async () => {
    vi.mocked(api.fetchBoard).mockResolvedValue(board([
        item(1, 'Registration', 'IN_PROGRESS', 30, { step: 'Waiting for email provider', area: 'Sign-up' }),
        item(2, 'Page creation', 'ON_HOLD', 45, { updatedAt: twoDaysAgo }),
        item(4, 'One schedule everywhere', 'FINISHED', 100),
    ], false));
    mount();
    const table = await screen.findByRole('table', { name: 'Team work' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Registration');
    expect(rows[0]).toHaveTextContent('Waiting for email provider');
    expect(rows[0]).toHaveTextContent('30%');
    expect(rows[0]).toHaveTextContent('Beqa · now');
    expect(rows[1]).toHaveTextContent('Beqa · 2 days ago');
    expect(screen.getByLabelText('Latest switches')).toHaveTextContent('Registration · 2 days ago→Branding · now');
    await userEvent.click(screen.getByRole('button', { name: /On hold/ }));
    expect(within(screen.getByRole('table', { name: 'Team work' })).getAllByRole('row')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Load this week’s work' })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Colleague’s email')).not.toBeInTheDocument();
});

it('opens a piece of work, saves a quick update and keeps the words when a colleague saved first', async () => {
    const registration = item(1, 'Registration', 'IN_PROGRESS', 30);
    vi.mocked(api.fetchBoard).mockResolvedValue(board([registration]));
    vi.mocked(api.fetchDetail).mockResolvedValue({ item: registration, updates: [{ id: 9, author: { id: 1, name: 'Nino' }, at: twoDaysAgo, previousStatus: null, status: 'IN_PROGRESS', previousPercent: null, percent: 30, message: 'Added' }] });
    vi.mocked(api.changeWork).mockRejectedValueOnce({ response: { status: 409, data: { detail: 'Someone else changed this work after you opened it.' } } });
    mount('/team-work?item=1');
    const dialog = await screen.findByRole('dialog', { name: 'Registration' });
    expect(within(dialog).getByText('Nino · 2 days ago')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Finished' }));
    expect(within(dialog).getByText('100%', { selector: 'output' })).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('What changed'), 'Shipped');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save update' }));
    expect(api.changeWork).toHaveBeenCalledWith(1, { version: 0, status: 'FINISHED', percent: 100, update: 'Shipped' });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Someone else changed this work');
    expect(within(dialog).getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('What changed')).toHaveValue('Shipped');
});

it('does not exist for accounts off the team, and Home shows no row without the capability', async () => {
    vi.mocked(api.fetchBoard).mockRejectedValue({ response: { status: 404 } });
    mount();
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    const { container } = render(<MemoryRouter><TeamWorkHomeRow caps={{ version: 1, workspaces: [] }} /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
});

it('shows team accounts a quiet Home row with how much is in progress', async () => {
    vi.mocked(api.fetchBoard).mockResolvedValue(board([item(1, 'Registration', 'IN_PROGRESS', 30), item(2, 'Branding', 'IN_PROGRESS', 70), item(3, 'Schedule', 'FINISHED', 100)]));
    render(<MemoryRouter><TeamWorkHomeRow caps={{ version: 1, workspaces: [{ id: 'team.work', context: { type: 'user', id: 1, label: 'Team work' } }] }} /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Team work. 2 in progress' })).toHaveAttribute('href', '/team-work');
});
