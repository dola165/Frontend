import '../../i18n';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { SquadInboxConversation } from './SquadInbox';
const overview = vi.hoisted(() => vi.fn());
vi.mock('./api', () => ({ overview }));
vi.mock('./SquadMessages', () => ({ SquadMessages: ({ thread, readOnly }: { thread: number | null; readOnly: boolean }) => <p>Thread {thread ?? 'group'} {readOnly ? 'read only' : 'write'}</p> }));
const base = { id: 11, viewer_id: 7, name: 'U14', academy_name: 'Synthetic academy', can_manage: false, threads: [], child_threads: [] };
beforeEach(() => overview.mockReset());
const show = (path: string) => render(<MemoryRouter initialEntries={[path]}><SquadInboxConversation id={11}/></MemoryRouter>);
it('does not silently redirect a revoked child thread into the guardian’s own conversation', async () => {
    overview.mockResolvedValue(base); show('/messages?squadId=11&channel=coach&thread=9');
    expect(await screen.findByRole('alert')).toHaveTextContent('no longer available');
    expect(screen.queryByText(/Thread /)).not.toBeInTheDocument();
});
it('retains the permitted child’s squad coach thread as read only', async () => {
    overview.mockResolvedValue({ ...base, child_threads: [{ user_id: 9, full_name: 'Child' }] });
    show('/messages?squadId=11&channel=coach&thread=9');
    expect(await screen.findByText('Thread 9 read only')).toBeInTheDocument();
});
it('opens the guardian’s own coach conversation when no particular thread was requested', async () => {
    overview.mockResolvedValue(base); show('/messages?squadId=11&channel=coach');
    expect(await screen.findByText('Thread 7 write')).toBeInTheDocument();
});
it('keeps a squad group link in the shared squad chat', async () => {
    overview.mockResolvedValue(base); show('/messages?squadId=11');
    expect(await screen.findByText('Thread group write')).toBeInTheDocument();
});
