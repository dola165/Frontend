import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '../../../../api/axiosConfig';
import { ClubActivityList } from '../ClubActivityList';

vi.mock('../../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('../../../../context/AuthContext', () => ({useAuth: () => ({sessionId:null,status:'authenticated'})}));
const at = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
const event = (id: number, eventType: string, title: string, extra = {}) => ({ eventId: id, occurrenceId: `${id}@first`, clubId: 701, title, eventType, startsAt: at(2), endsAt: at(2.1), status: 'SCHEDULED', publicNow: true, ...extra });
const fixtures = [
    event(1, 'MATCH', 'Upcoming match'), event(2, 'FRIENDLY', 'Past friendly', { startsAt: at(-2), endsAt: at(-1.9), status: 'COMPLETED' }),
    event(3, 'TRAINING', 'U16 training', { challengerSquadId: 16, challengerSquadName: 'U16', recurring: true }),
    event(4, 'TRAINING', 'First team training', { challengerSquadId: 17, challengerSquadName: 'First team' }),
    event(5, 'MEETING', 'Parents meeting'), event(6, 'ACTIVITY', 'Tournament trip'), event(7, 'TRYOUT', 'Open tryout'),
    event(8, 'MATCH', 'Cancelled match', { status: 'CANCELLED' }), event(9, 'MATCH', 'Declined match', { challengeStatus: 'REJECTED' }),
];
const mockData = () => vi.mocked(apiClient.get).mockImplementation(async url => ({ data: String(url).endsWith('/training-schedule') ? {squadId:16,squadName:'U16',visibility:'PRIVATE',canView:true,canManage:false,revision:0,sessions:[{id:'session:20',title:'U16 squad session',startsAt:at(2),endsAt:at(2.05),status:'SCHEDULED',timezone:'Asia/Tbilisi'}]} : String(url).endsWith('/squads') ? [{ id: 16, name: 'U16' }, { id: 17, name: 'First team' }] : { events: fixtures } }));
const view = (mode: 'schedule' | 'events' = 'schedule', clubId = 701) => <MemoryRouter><ClubActivityList clubId={clubId} isOwnClubAdmin={false} view={mode} /></MemoryRouter>;
beforeEach(() => { vi.clearAllMocks(); mockData(); });

it('opens on future fixtures and exposes training by squad separately', async () => {
    const user = userEvent.setup(); render(view());
    expect(await screen.findByText('Upcoming match')).toBeVisible();
    for (const title of ['Parents meeting', 'U16 training', 'Past friendly', 'Cancelled match', 'Declined match']) expect(screen.queryByText(title)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Training' }));
    expect(screen.getByRole('button', {name:'U16'})).toBeVisible();
    await user.selectOptions(screen.getByLabelText('Squad'), '16');
    expect(screen.queryByText('First team training')).not.toBeInTheDocument();
    expect(await screen.findByText('U16 squad session')).toBeVisible();
    expect(apiClient.get).toHaveBeenCalledWith('/clubs/701/squads/16/training-schedule', expect.anything());
    expect(screen.queryByLabelText('When')).not.toBeInTheDocument();
});

it('keeps recent and cancelled fixtures available without leading with them', async () => {
    const user = userEvent.setup(); render(view()); await screen.findByText('Upcoming match');
    await user.selectOptions(screen.getByLabelText('When'), 'recent');
    expect(screen.getByText('Past friendly')).toBeVisible();
    expect(screen.getByText('Cancelled match')).toBeVisible();
    expect(screen.getByText('Declined match')).toBeVisible();
    expect(screen.queryByText('Upcoming match')).not.toBeInTheDocument();
});

it('events contains meetings, tryouts and activities with a club-scoped jobs link', async () => {
    render(view('events')); await screen.findByText('Parents meeting');
    expect(screen.getByText('Tournament trip')).toBeVisible(); expect(screen.getByText('Open tryout')).toBeVisible();
    expect(screen.queryByText('Upcoming match')).not.toBeInTheDocument(); expect(screen.queryByText('U16 training')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ongoing roles/ })).toHaveAttribute('href', '/clubs/701?tab=business&opportunity=jobs');
    expect(screen.queryByRole('link', { name: /Plan a club/ })).not.toBeInTheDocument();
});

it('reports failed reads and retries rather than claiming there are no events', async () => {
    const user = userEvent.setup(); vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('offline'));
    render(view('events')); expect(await screen.findByRole('alert')).toHaveTextContent('Could not load events');
    await user.click(screen.getByRole('button', { name: 'Retry' })); expect(await screen.findByText('Parents meeting')).toBeVisible();
});

it('ignores a late response after changing club', async () => {
    let resolveOld!: (value: { data: { events: typeof fixtures } }) => void;
    vi.mocked(apiClient.get).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    const { rerender } = render(view('events'));
    rerender(view('events', 702)); await screen.findByText('Parents meeting');
    resolveOld({ data: { events: [event(99, 'MEETING', 'Old club private meeting')] } });
    await waitFor(() => expect(screen.queryByText('Old club private meeting')).not.toBeInTheDocument());
});
