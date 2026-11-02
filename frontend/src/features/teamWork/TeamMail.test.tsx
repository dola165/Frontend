import '../../i18n';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from './api';
import { MyInbox } from './TeamMail';
import { NotifyButton } from './NotifyButton';
import { NotificationEmailPage } from './NotificationEmailPage';

vi.mock('./api', async importOriginal => ({
    ...await importOriginal<typeof api>(), fetchMail: vi.fn(), setMail: vi.fn(), removeMail: vi.fn(), confirmMail: vi.fn(), askAttention: vi.fn(), fetchTeam: vi.fn(),
}));

const now = new Date().toISOString();
const beqa = { id: 1, name: 'Beqa' }, gio = { id: 2, name: 'Gio' }, ilo = { id: 3, name: 'Ilo' };
const task: api.WorkItem = {
    id: 7, key: 'GK-7', title: 'Players page error', area: null, status: 'IN_PROGRESS', percent: null, step: null, notes: null, branch: null, prUrl: null, version: 0, updatedBy: beqa, updatedAt: now, createdAt: now,
    parentId: null, description: null, startedOn: null, end: { kind: 'UNKNOWN' }, percentFromSteps: false, people: [beqa, ilo], mediaCount: 0, commentCount: 0, small: false,
    doneMeans: null, tested: null, commits: null, priority: null, requestedBy: null, links: [], waitingOn: [], openQuestions: 0,
};
const member = (person: { id: number; name: string }, mail: boolean): api.Member => ({ userId: person.id, name: person.name, email: `${person.name.toLowerCase()}@team.test`, admin: true, addedAt: null, pending: false, mail });

beforeEach(() => vi.clearAllMocks());

it('your inbox goes from typed, to waiting for its link, to on, and can be stopped', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    vi.mocked(api.fetchMail).mockResolvedValue({ address: null, confirmed: false, linkSentAt: null });
    vi.mocked(api.setMail).mockResolvedValue({ address: 'ilo@example.test', confirmed: false, linkSentAt: now });
    const { unmount } = render(<MyInbox onChanged={changed} />);
    await user.type(await screen.findByLabelText('Your own inbox for notices'), 'ilo@example.test');
    await user.click(screen.getByRole('button', { name: 'Email me here' }));
    expect(api.setMail).toHaveBeenCalledWith('ilo@example.test');
    expect(await screen.findByText('ilo@example.test')).toBeInTheDocument();
    expect(screen.getByText(/Open the link we sent to/)).toBeInTheDocument();
    expect(changed).toHaveBeenCalled();
    unmount();

    vi.mocked(api.fetchMail).mockResolvedValue({ address: 'ilo@example.test', confirmed: true, linkSentAt: now });
    vi.mocked(api.removeMail).mockResolvedValue({ address: null, confirmed: false, linkSentAt: null });
    render(<MyInbox onChanged={changed} />);
    expect(await screen.findByText(/Notices also go to/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(api.removeMail).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Email me here' })).toBeInTheDocument();
});

it('Notify picks the task’s people but me, shows who gets email, and says who was told', async () => {
    const user = userEvent.setup();
    const put = vi.fn();
    vi.mocked(api.fetchTeam).mockResolvedValue([member(beqa, false), member(gio, false), member(ilo, true)]);
    const detail: api.Detail = { item: task, updates: [], steps: [], questions: [], foundCommits: [], media: [], comments: [], purposeChanges: [] };
    vi.mocked(api.askAttention).mockResolvedValue({ told: [ilo], justAsked: [gio], detail });
    render(<NotifyButton item={task} team={[beqa, gio, ilo]} me={1} onPut={put} />);
    await user.click(screen.getByRole('button', { name: 'Notify' }));
    const iloChip = await screen.findByRole('button', { name: /Ilo/ });
    expect(iloChip).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Gio/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: /Beqa/ })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('img', { name: 'Gets notices by email' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Gio/ }));
    await user.type(screen.getByLabelText('What’s needed, in one line'), 'Check the coach’s access');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(api.askAttention).toHaveBeenCalledWith(7, [3, 2], 'Check the coach’s access');
    expect(await screen.findByText('Sent to Ilo.')).toBeInTheDocument();
    expect(screen.getByText('Gio heard about it a few minutes ago, so not again.')).toBeInTheDocument();
    expect(put).toHaveBeenCalledWith(detail);
});

it('Notify with nobody picked says so and sends nothing', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchTeam).mockResolvedValue([]);
    render(<NotifyButton item={{ ...task, people: [beqa] }} team={[beqa, gio]} me={1} onPut={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Notify' }));
    await user.click(await screen.findByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Pick who should look.');
    expect(api.askAttention).not.toHaveBeenCalled();
});

const confirmPage = (path: string) => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/notification-email" element={<NotificationEmailPage />} /></Routes></MemoryRouter>);

it('the inbox link confirms only on the button, then says where notices go', async () => {
    const user = userEvent.setup();
    vi.mocked(api.confirmMail).mockResolvedValue({ address: 'ilo@example.test' });
    confirmPage('/notification-email?token=abc');
    expect(api.confirmMail).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Yes, send them here' }));
    expect(api.confirmMail).toHaveBeenCalledWith('abc');
    expect(await screen.findByText('ilo@example.test')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Team work' })).toHaveAttribute('href', '/team-work');
});

it('a used or expired link says so and points to Team work', async () => {
    const user = userEvent.setup();
    vi.mocked(api.confirmMail).mockRejectedValue({ response: { status: 404 } });
    confirmPage('/notification-email?token=old');
    await user.click(screen.getByRole('button', { name: 'Yes, send them here' }));
    expect(await screen.findByText('This link has expired or was already used')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Team work' })).toHaveAttribute('href', '/team-work?view=team');
});
