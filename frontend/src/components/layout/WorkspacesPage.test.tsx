import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { WorkspacesPage } from './WorkspacesPage';
import { eventWhen, upcomingEvents, type BriefingEvent } from './workspaceBriefing';
import type { NavigationCapabilities } from '../../context/navigationCapabilities';
import { apiClient } from '../../api/axiosConfig';
const auth = vi.hoisted(() => ({ user: { id: 1, navigationCapabilities: { version: 1, workspaces: [] } as NavigationCapabilities }, sessionId: 'session-a', refreshNavigationCapabilities: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
const cap = (id: string, type = 'club', context = 1, label = 'FC Dinamo Tbilisi Academy') => ({ id, context: { type, id: context, label } });
const inbox = { items: [], counts: { incoming: 0, actionable: 0, outgoing: 0, history: 0 }, unavailableSources: [], hasMore: false, total: 0 };
const date = new Date(); date.setDate(date.getDate() + 1); date.setHours(12, 0, 0, 0);
const end = new Date(date); end.setHours(13);
const event = { eventId: 17, occurrenceId: '17:tomorrow', title: 'Training at Dinamo', startsAt: date.toISOString(), endsAt: end.toISOString(), status: 'SCHEDULED', eventType: 'TRAINING', locationName: 'Training ground' };
const renderPage = () => render(<MemoryRouter><WorkspacesPage/></MemoryRouter>);
beforeEach(() => {
    vi.clearAllMocks(); auth.sessionId = 'session-a'; auth.user = { id: 1, navigationCapabilities: { version: 1, workspaces: [cap('club.operations')] } };
    vi.mocked(apiClient.get).mockImplementation(async url => ({ data: url === '/requests' ? inbox : { events: [] } }));
});
it('shows real pending decisions and scheduled activities with destinations, keeping management quiet', async () => {
    vi.mocked(apiClient.get).mockImplementation(async url => ({ data: url === '/requests' ? { ...inbox, counts: { ...inbox.counts, actionable: 8, outgoing: 2 }, items: [{ key: 'staff:1', actionable: true, title: 'Staff invitation', context: 'Dinamo', destination: '/clubs/1/workspace?tab=my-role' }] } : { events: url === '/schedule/clubs/1/events' ? [event] : [] } }));
    renderPage();
    expect(await screen.findByText('8 requests need a decision')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Staff invitation Dinamo' })).toHaveAttribute('href', '/clubs/1/workspace?tab=my-role');
    expect(await screen.findByText('Training at Dinamo')).toBeVisible();
    expect(screen.getByRole('link', { name: /Tomorrow.*Training at Dinamo/ })).toHaveAttribute('href', '/calendar?eventId=17');
    expect(screen.getByRole('link', { name: 'My profile' })).not.toBeVisible();
    await userEvent.click(screen.getByText('Manage my work'));
    expect(screen.getByRole('link', { name: 'My profile' })).toHaveAttribute('href', '/profile/1');
    expect(screen.getByRole('link', { name: /sent requests awaiting/ })).toHaveAttribute('href', '/requests?view=OUTGOING');
});
it('reports partial requests without claiming all clear, and preserves other schedules on source failure', async () => {
    vi.mocked(apiClient.get).mockImplementation(async url => {
        if (url === '/schedule/clubs/1/events') throw Error('unavailable');
        return { data: url === '/requests' ? { ...inbox, unavailableSources: ['STAFF'] } : { events: [event] } };
    });
    renderPage();
    expect(await screen.findByText('Some requests are unavailable')).toBeVisible();
    expect(screen.queryByText('No requests awaiting your decision')).not.toBeInTheDocument();
    expect(await screen.findByText('Training at Dinamo')).toBeVisible();
    expect(screen.getByText(/Some schedules couldn’t load/)).toBeVisible();
});
it('keeps a failed inbox distinct from an empty one and refreshes successfully', async () => {
    let failed = true;
    vi.mocked(apiClient.get).mockImplementation(async url => { if (url === '/requests' && failed) throw Error('offline'); return { data: url === '/requests' ? inbox : { events: [] } }; });
    renderPage();
    expect(await screen.findByText('Requests couldn’t load')).toBeVisible();
    failed = false; await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No requests awaiting your decision')).toBeVisible();
});
it('does not allow a returned request destination to navigate outside the application', async () => {
    vi.mocked(apiClient.get).mockImplementation(async url => ({ data: url === '/requests' ? { ...inbox, counts: { ...inbox.counts, actionable: 1 }, items: [{ key: 'bad', actionable: true, title: 'Review me', context: 'Club', destination: 'https://external.invalid' }] } : { events: [] } }));
    renderPage(); expect(await screen.findByRole('link', { name: 'Review me Club' })).toHaveAttribute('href', '/requests?view=INCOMING');
});
it('reveals overflow places and can find a hidden connection without changing access', async () => {
    auth.user.navigationCapabilities.workspaces = Array.from({ length: 7 }, (_, index) => cap('club.player', 'club', index + 1, `Club ${index + 1}`));
    renderPage(); await screen.findByText('No requests awaiting your decision');
    const clubs = screen.getByRole('region', { name: 'Clubs' });
    expect(within(clubs).getByRole('link', { name: /Club 7/ })).not.toBeVisible();
    await userEvent.click(screen.getByText('Show 4 more'));
    expect(within(clubs).getByRole('link', { name: /Club 7/ })).toHaveAttribute('href', '/clubs/7');
    await userEvent.type(screen.getByRole('textbox', { name: 'Find a workspace' }), 'club 7');
    expect(within(clubs).getAllByRole('link')).toHaveLength(1);
    expect(apiClient.get).not.toHaveBeenCalledWith(expect.stringContaining('/squad-communication'), expect.anything());
});
it('aborts and discards old-account responses when the session changes', async () => {
    let resolve!: (value: { data: unknown }) => void;
    const delayed = new Promise<{ data: unknown }>(done => { resolve = done; });
    vi.mocked(apiClient.get).mockImplementation(url => url === '/requests' ? delayed as ReturnType<typeof apiClient.get> : Promise.resolve({ data: { events: [] } }));
    const view = renderPage(); const config = vi.mocked(apiClient.get).mock.calls.find(([url]) => url === '/requests')![1]!;
    auth.sessionId = 'session-b'; auth.user = { id: 8, navigationCapabilities: { version: 1, workspaces: [] } };
    vi.mocked(apiClient.get).mockImplementation(async url => ({ data: url === '/requests' ? inbox : { events: [] } }));
    view.rerender(<MemoryRouter><WorkspacesPage/></MemoryRouter>);
    await screen.findByText('No requests awaiting your decision');
    await act(async () => resolve({ data: { ...inbox, counts: { ...inbox.counts, actionable: 99 } } }));
    expect(config.signal?.aborted).toBe(true);
    expect(screen.queryByText(/99 requests/)).not.toBeInTheDocument();
    expect(screen.queryByText('FC Dinamo Tbilisi Academy')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clubs I follow' })).toBeVisible();
});
it('lets a person clear a filter after an access refresh reduces the number of connections', async () => {
    auth.user.navigationCapabilities.workspaces = Array.from({ length: 7 }, (_, index) => cap('club.player', 'club', index + 1, `Club ${index + 1}`));
    const view = renderPage(); await screen.findByText('No requests awaiting your decision');
    await userEvent.type(screen.getByRole('textbox', { name: 'Find a workspace' }), 'Club 7');
    auth.user.navigationCapabilities.workspaces = [cap('club.player', 'club', 1, 'Club 1')];
    view.rerender(<MemoryRouter><WorkspacesPage/></MemoryRouter>);
    await userEvent.clear(screen.getByRole('textbox', { name: 'Find a workspace' }));
    expect(screen.getByRole('link', { name: /Club 1/ })).toHaveAttribute('href', '/clubs/1');
});
it('uses only current authorized teams and preserves the location confirmation rule', async () => {
    auth.user.navigationCapabilities.workspaces = [cap('squad.workspace', 'squad', 10, 'Dinamo U16')];
    vi.mocked(apiClient.get).mockImplementation(async url => ({ data: url === '/requests' ? inbox : url === '/match-arrangements/squads/10/fixtures' ? [] : url === '/squad-communication/10/sessions' ? [{ id: 5, title: 'Squad training', starts_at: date.toISOString(), ends_at: end.toISOString(), status: 'SCHEDULED', location: 'Unconfirmed ground', venue_reservation: { status: 'PENDING', venueName: 'Pending stadium', pitchName: 'Pitch 1' } }] : { events: [] } }));
    const view = renderPage(); expect(await screen.findByText('Squad training')).toBeVisible();
    expect(screen.queryByText(/Pending stadium|Unconfirmed ground/)).not.toBeInTheDocument();
    auth.user.navigationCapabilities = { version: 1, workspaces: [] };
    view.rerender(<MemoryRouter><WorkspacesPage/></MemoryRouter>);
    expect(screen.queryByText('Squad training')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Room for your next activity')).toBeVisible());
});
it('sorts actual occurrences, removes duplicates, and excludes cancelled, ended and out-of-window events', () => {
    const now = new Date('2026-10-01T10:00:00Z'), end = new Date('2026-10-08T00:00:00Z');
    const item: BriefingEvent = { key: '1', title: 'Now', startsAt: '2026-10-01T09:00:00Z', endsAt: '2026-10-01T11:00:00Z', context: 'Club', location: null, path: '/calendar', status: 'SCHEDULED', type: 'TRAINING' };
    expect(upcomingEvents([item, item, { ...item, key: 'ended', endsAt: now.toISOString() }, { ...item, key: 'cancelled', status: 'CANCELLED' }, { ...item, key: 'next', startsAt: end.toISOString() }], now, end)).toEqual([item]);
    expect(eventWhen(item, now)).toBe('Now');
});
