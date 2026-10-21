import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../../api/axiosConfig';
import { FamilySchedule } from '../../parents/FamilySchedule';
import { CoachCalendar } from '../coachHub/CoachCalendar';
import { ClubCalendar } from './ClubCalendar';
import type { CoachData } from '../coachHub/CoachWorkspace';
import { isoDay } from '../../../design/calendar/calendarDates';
import '../../../i18n';

vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }, DEPLOYMENT_URLS: { mediaBaseUrl: 'http://fixture.invalid' } }));
vi.mock('../../../components/schedule/useMobileSchedule', () => ({ useMobileSchedule: () => false }));
vi.mock('../../squadCommunication/useSquadSchedule', () => ({ useSquadSchedule: () => ({ events: [], loading: false, error: '' }) }));
vi.mock('../../mapPlanning/journeyScheduleData', async original => ({ ...await original<object>(), useJourneyEntries: () => ({ entries: [], loading: false, error: '' }) }));
vi.mock('../../clubs/profile/useClubSchedule', () => ({ useClubSchedule: (_club: number, from: Date) => {
    const start = new Date(from); start.setHours(18, 0, 0, 0); const end = new Date(start); end.setHours(19);
    return { events: [], training: [103, 105].map(squadId => ({ id: squadId, squadId, squadName: squadId === 103 ? 'U14' : 'U16', title: `Club ${squadId} training`, startsAt: start.toISOString(), endsAt: end.toISOString(), status: 'SCHEDULED', location: 'Fixture ground' })), squads: [{ id: 103, name: 'U14' }, { id: 105, name: 'U16' }], mySquads: [103, 105], privateSquads: [], loading: false, error: '', retry: vi.fn() };
} }));
const squads = [103, 105].map(id => ({ id, club_id: 1, academy_name: 'Fixture academy', name: id === 103 ? 'U14' : 'U16', category: '', can_manage: false, unread_count: 0, viewer_id: 9, member_count: 0, notify_chat: true, head_coach_id: 9, can_assign_coach: false, available_coaches: [], coaches: [], players: [], threads: [] }));
function Coach() {
    const [params] = useSearchParams(), focus = [103, 105].find(id => String(id) === params.get('squad')) ?? null;
    const mine = squads.map(squad => ({ id: squad.id, name: squad.name, player_count: 0 }));
    // This consumer fixture supplies precisely the fields read by Calendar and SquadSwitch.
    const data: Pick<CoachData, 'clubId' | 'clubName' | 'clubLogo' | 'focus' | 'mine' | 'shown' | 'squads' | 'workHref'> = { clubId: 1, clubName: 'Fixture academy', clubLogo: null, focus, mine, shown: focus ? [focus] : [103, 105], squads: squads.map(overview => ({ id: overview.id, overview, sessions: [], updates: [], failed: [], error: '' })),
        workHref: (tab: string, context: Record<string, string> = {}) => '/clubs/1/workspace?' + new URLSearchParams({ tab, ...context }),
    };
    return <CoachCalendar data={data as CoachData} />;
}
function Navigation() {
    const where = useLocation(), navigate = useNavigate();
    return <><output data-testid="route">{where.pathname + where.search}</output><button onClick={() => navigate(-1)}>Browser Back</button><button onClick={() => navigate(1)}>Browser Forward</button></>;
}
function mount(entries = ['/my-squads?tab=calendar&clubId=1&squad=105']) {
    return render(<MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}><Navigation /><Routes>
        <Route path="/my-squads" element={<Coach />} /><Route path="/clubs/:id/workspace" element={<ClubCalendar clubId={1} clubName="Fixture academy" canManage={false} />} />
        <Route path="/parent" element={<FamilySchedule squads={squads} initialSquadId={105} playerId={8} />} />
    </Routes></MemoryRouter>);
}
const day = () => screen.getByLabelText('Jump to a date');
const route = () => new URL(screen.getByTestId('route').textContent!, 'http://fixture.invalid');
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-17T12:00:00Z')); });
afterEach(() => { expect(apiClient.post).not.toHaveBeenCalled(); expect(apiClient.put).not.toHaveBeenCalled(); expect(apiClient.patch).not.toHaveBeenCalled(); expect(apiClient.delete).not.toHaveBeenCalled(); cleanup(); localStorage.clear(); sessionStorage.clear(); vi.useRealTimers(); });

it('preserves the viewed week across Club calendar, Back, Forward and fresh mounts', () => {
    let view = mount(); expect(day()).toHaveValue('2026-10-17');
    fireEvent.click(screen.getByRole('button', { name: 'Next period' })); expect(day()).toHaveValue('2026-10-24');
    fireEvent.click(screen.getByRole('link', { name: 'Club calendar' }));
    expect(day()).toHaveValue('2026-10-24'); expect(route().pathname).toBe('/clubs/1/workspace'); expect(route().searchParams.get('date')).toBe('2026-10-24');
    expect(screen.getAllByText('Club 103 training').length).toBeGreaterThan(0); expect(screen.getAllByText('Club 105 training').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Browser Back' })); expect(day()).toHaveValue('2026-10-24'); expect(route().searchParams.get('clubId')).toBe('1'); expect(route().searchParams.get('squad')).toBe('105');
    fireEvent.click(screen.getByRole('button', { name: 'Browser Forward' })); expect(day()).toHaveValue('2026-10-24');
    const clubUrl = screen.getByTestId('route').textContent!; view.unmount(); view = mount([clubUrl]); expect(day()).toHaveValue('2026-10-24');
    view.unmount(); view = mount(['/my-squads?tab=calendar&clubId=1&squad=105&date=2026-10-24']); expect(day()).toHaveValue('2026-10-24'); view.unmount();
});
it.each(['/my-squads?tab=calendar&clubId=1&squad=105', '/clubs/1/workspace?tab=calendar'])('restores date-only Back/Forward on the same mounted route: %s', base => {
    mount([base + '&date=2026-10-19', base + '&date=2026-10-26']); expect(day()).toHaveValue('2026-10-26');
    fireEvent.click(screen.getByRole('button', { name: 'Browser Back' })); expect(day()).toHaveValue('2026-10-19');
    fireEvent.click(screen.getByRole('button', { name: 'Browser Forward' })); expect(day()).toHaveValue('2026-10-26');
});
for (const base of ['/my-squads?tab=calendar&clubId=1&squad=105', '/clubs/1/workspace?tab=calendar']) {
    it.each(['', '&date=2026-02-29', '&date=2026-02-31', '&date=2026-10-24T00%3A00%3A00Z', '&date=2026-10-24&date=2026-10-25'])('defaults absent or malformed/duplicate day to today without rollover: ' + base + '%s', suffix => {
        mount([base + suffix]); expect(day()).toHaveValue('2026-10-17');
    });
    it('keeps canonical local calendar days without UTC shifting: ' + base, () => {
        mount([base + '&date=2028-02-29']); expect(day()).toHaveValue('2028-02-29');
        fireEvent.change(day(), { target: { value: '2026-10-24' } }); expect(day()).toHaveValue('2026-10-24'); expect(route().searchParams.get('date')).toBe('2026-10-24');
    });
}
it('keeps uncontrolled parent date navigation local when no controlled-date props are supplied', () => {
    mount(['/parent?playerId=8']); expect(day()).toHaveValue(isoDay(new Date())); fireEvent.click(screen.getByRole('button', { name: 'Next period' }));
    expect(day()).toHaveValue('2026-10-24'); expect(screen.getByTestId('route')).toHaveTextContent(/^\/parent\?playerId=8$/);
});
