import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ClubWorkspacePage from './ClubWorkspacePage';
import { fetchClubManagementOverview } from '../features/clubs/api';
import { fetchNotifications, fetchUnreadNotificationCount } from '../api/notifications';
import type { ClubManagementOverview } from '../features/clubs/domain';
import { emitNotificationsChanged } from '../utils/notifications';

const auth = vi.hoisted(() => ({ isAuthenticated: true, sessionId: 'session-A' }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../features/clubOperations/useClubOperations', () => ({ useClubOperations: () => ({ boot: null, loading: false, error: '', refresh: vi.fn() }) }));
vi.mock('../features/clubOperations/useWorkspaceRoles', () => ({ useWorkspaceRoles: () => ({ data: null, loading: false, error: '', refresh: vi.fn() }), focusedBootstrap: (boot: unknown) => boot, savedRole: () => null, rememberRole: vi.fn() }));
vi.mock('../utils/authStorage', () => ({ getStoredUserId: () => '1', getAuthSessionId: () => auth.sessionId, isCurrentAuthSession: (id: string) => id === auth.sessionId }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../api/axiosConfig', () => ({ apiClient: { get: vi.fn().mockResolvedValue({ data: {} }) }, DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost' } }));
vi.mock('../features/clubs/api', async importOriginal => ({ ...await importOriginal<object>(), fetchClubManagementOverview: vi.fn() }));
vi.mock('../features/schedule/api', () => ({ fetchClubSchedule: vi.fn().mockResolvedValue([]) }));
vi.mock('../api/notifications', () => ({ fetchNotifications: vi.fn(), fetchUnreadNotificationCount: vi.fn(), markNotificationAsRead: vi.fn(), markAllNotificationsAsRead: vi.fn() }));

const overview = (role: ClubManagementOverview['currentUserRole']): ClubManagementOverview => ({ currentUserRole: role, assignableInviteRoles: [], assignableStaffRoles: [], activePlayerCount: 0, trialistCount: 0, overdueTrialistCount: 0, pendingTryoutCount: 0, members: [], pendingInvitations: [], pendingApplications: [] });
function Page() { return <><Link to='/clubs/2/workspace?tab=inbox'>Switch club</Link><ClubWorkspacePage darkMode /></>; }
const view = () => render(<MemoryRouter initialEntries={['/clubs/1/workspace?tab=inbox']}><Routes><Route path='/clubs/:id/workspace' element={<Page />} /></Routes></MemoryRouter>);
beforeEach(() => {
    vi.clearAllMocks();
    auth.isAuthenticated = true; auth.sessionId = 'session-A';
    vi.mocked(fetchNotifications).mockResolvedValue({ content: [], pageNumber: 0, pageSize: 20, totalElements: 0 });
    vi.mocked(fetchUnreadNotificationCount).mockResolvedValue({ unreadCount: 0 });
});
afterEach(cleanup);

it('waits for management access, including notification events and an inbox deep link', async () => {
    let reject!: (error: Error) => void;
    vi.mocked(fetchClubManagementOverview).mockReturnValue(new Promise((_, fail) => { reject = fail; }));
    view();
    act(() => emitNotificationsChanged());
    expect(fetchUnreadNotificationCount).not.toHaveBeenCalled();
    expect(fetchNotifications).not.toHaveBeenCalled();
    await act(async () => reject(new Error('Forbidden')));
    act(() => emitNotificationsChanged());
    expect(fetchUnreadNotificationCount).not.toHaveBeenCalled();
    expect(fetchNotifications).not.toHaveBeenCalled();
});

it.each(['OWNER', 'CLUB_ADMIN', 'COACH'] as const)('loads the authorized %s inbox, but does not carry access to another club', async role => {
    vi.mocked(fetchClubManagementOverview).mockResolvedValueOnce(overview(role)).mockRejectedValue(new Error('Forbidden'));
    view();
    await waitFor(() => expect(fetchUnreadNotificationCount).toHaveBeenCalledTimes(1));
    expect(fetchNotifications).toHaveBeenCalledTimes(1);
    const signal = vi.mocked(fetchUnreadNotificationCount).mock.calls[0][1]!.signal!;
    await act(async () => fireEvent.click(screen.getByText('Switch club')));
    expect(signal.aborted).toBe(false); // Completed request; only in-flight work needs cancellation.
    act(() => emitNotificationsChanged());
    expect(fetchUnreadNotificationCount).toHaveBeenCalledTimes(1);
    expect(fetchNotifications).toHaveBeenCalledTimes(1);
});

it('cancels pending inbox work when the account is retired', async () => {
    vi.mocked(fetchClubManagementOverview).mockResolvedValue(overview('OWNER'));
    vi.mocked(fetchUnreadNotificationCount).mockReturnValue(new Promise(() => {}));
    const rendered = view();
    await waitFor(() => expect(fetchUnreadNotificationCount).toHaveBeenCalledTimes(1));
    const signal = vi.mocked(fetchUnreadNotificationCount).mock.calls[0][1]!.signal!;
    auth.isAuthenticated = false;
    rendered.rerender(<MemoryRouter><ClubWorkspacePage darkMode /></MemoryRouter>);
    expect(signal.aborted).toBe(true);
});
