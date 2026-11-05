import '../../../i18n';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from '../api';
import { NoticeLines } from './NoticeLines';

vi.mock('../api', async importOriginal => ({ ...await importOriginal<typeof api>(), noticeLines: vi.fn(), markNoticesSeen: vi.fn(), noticeReach: vi.fn() }));

beforeEach(() => { vi.clearAllMocks(); vi.mocked(api.markNoticesSeen).mockResolvedValue({ marked: 1 }); });

const space = (canManage: boolean) => ({ id: 7, name: 'U12', club_id: 1, academy_name: 'Dinamo', category: 'U12', can_manage: canManage, viewer_id: canManage ? 1 : 2,
    coaches: [{ user_id: 1, full_name: 'Nino Coach' }], players: [], threads: [], member_count: 3, notify_chat: true, head_coach_id: 1, can_assign_coach: false, available_coaches: [] }) as unknown as api.SquadOverview;
const line = (sentTo: api.NoticeSeen[], seenByMe = false): api.NoticeLine => ({ id: 31, authorId: 1, authorName: 'Nino Coach', audience: 'PARENTS', line: 'Bring water tomorrow', createdAt: new Date().toISOString(), seenByMe, sentTo });

it('shows the coach each line with who has seen it, and the names on request', async () => {
    const user = userEvent.setup();
    vi.mocked(api.noticeLines).mockResolvedValue([line([{ userId: 5, name: 'Ana Parent', seen: true, seenAt: null }, { userId: 6, name: 'Gio Parent', seen: false, seenAt: null }])]);
    render(<MemoryRouter><NoticeLines space={space(true)} /></MemoryRouter>);
    expect(await screen.findByText('Bring water tomorrow')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /1 of 2 seen/ }));
    expect(screen.getByText('Not seen yet').parentElement).toHaveTextContent('Gio Parent');
    expect(screen.getByText('Seen').parentElement).toHaveTextContent('Ana Parent');
    expect(screen.getByRole('button', { name: 'Notify' })).toBeInTheDocument();
});

it('shows a parent the lines sent to them and tells the server they saw them', async () => {
    vi.mocked(api.noticeLines).mockResolvedValue([line([])]);
    render(<MemoryRouter><NoticeLines space={space(false)} /></MemoryRouter>);
    expect(await screen.findByText('Bring water tomorrow')).toBeInTheDocument();
    await waitFor(() => expect(api.markNoticesSeen).toHaveBeenCalledWith(7, [31]));
    expect(screen.queryByRole('button', { name: /seen/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Notify' })).not.toBeInTheDocument();
});

it('stays out of the way of a parent with no line yet', async () => {
    vi.mocked(api.noticeLines).mockResolvedValue([]);
    const { container } = render(<MemoryRouter><NoticeLines space={space(false)} /></MemoryRouter>);
    await waitFor(() => expect(api.noticeLines).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
});

it('marks only the lines on screen as seen, and the rest when All opens', async () => {
    const user = userEvent.setup();
    const at = Date.now();
    vi.mocked(api.noticeLines).mockResolvedValue([1, 2, 3, 4, 5, 6, 7].map(id => ({ ...line([]), id, line: `Line ${id}`, createdAt: new Date(at - id * 60_000).toISOString() })));
    render(<MemoryRouter><NoticeLines space={space(false)} /></MemoryRouter>);
    await waitFor(() => expect(api.markNoticesSeen).toHaveBeenCalledWith(7, [1, 2, 3, 4, 5]));
    expect(api.markNoticesSeen).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Line 6')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All 7' }));
    await waitFor(() => expect(api.markNoticesSeen).toHaveBeenLastCalledWith(7, [6, 7]));
    expect(api.markNoticesSeen).toHaveBeenCalledTimes(2);
});
