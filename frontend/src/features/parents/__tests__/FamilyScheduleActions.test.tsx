import '../../../i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { FamilySchedule } from '../FamilySchedule';
import { useSquadSchedule, type SquadCalendarEvent } from '../../squadCommunication/useSquadSchedule';
import type { ScheduleWorkspaceEvent } from '../../../components/schedule/workspaceTypes';
import type { ReactNode } from 'react';

vi.mock('../../squadCommunication/useSquadSchedule', () => ({ useSquadSchedule: vi.fn() }));
vi.mock('../../squadCommunication/SquadEventComposer', () => ({ SquadEventComposer: ({ date }: { date: Date }) => <div role="status" data-date={date.toISOString()}>Unified event editor</div> }));
vi.mock('../../squadCommunication/SquadClubEventEditor', () => ({ SquadClubEventEditor: ({ weekly }: { weekly: boolean }) => <div role="status">{weekly ? 'Weekly club editor' : 'Ordinary club editor'}</div> }));
vi.mock('../../squadCommunication/SquadSessionDialog', async () => ({ ...await vi.importActual<typeof import('../../squadCommunication/SquadSessionDialog')>('../../squadCommunication/SquadSessionDialog'), SquadSessionEditor: ({ date }: { date: Date }) => <div role="status" data-date={date.toISOString()}>Unified event editor</div> }));
vi.mock('../../../components/schedule/ScheduleDirectionWorkspace', () => ({ ScheduleDirectionWorkspace: (p: { createLabel: string; onCreate: () => void; canCreate: boolean; extraActions: ReactNode; events: ScheduleWorkspaceEvent[]; onSelect: (e: ScheduleWorkspaceEvent) => void; notices: ReactNode; calendarContent: (e: ScheduleWorkspaceEvent[]) => ReactNode }) => <>{p.canCreate && <button onClick={p.onCreate}>{p.createLabel}</button>}{p.extraActions}{p.events.map(e => <button key={e.id} onClick={() => p.onSelect(e)}>{e.title}</button>)}{p.notices}{p.calendarContent(p.events)}</> }));
vi.mock('../../../components/schedule/ScheduleGrid', () => ({ ScheduleGrid: ({ canCreate, onCreateAt }: { canCreate: boolean; onCreateAt: (date: Date) => void }) => canCreate && <button onClick={() => onCreateAt(new Date('2099-09-21T12:00:00Z'))}>Create in calendar cell</button> }));
const squad = { id: 11, name: 'U14', club_id: 1, can_manage: true };
beforeEach(() => { vi.mocked(useSquadSchedule).mockReturnValue({ key: 'loaded', events: [], loading: false, error: '' }); });
const mount = (manager = true) => render(<MemoryRouter><Routes><Route path="/" element={<FamilySchedule squads={[{ ...squad, can_manage: manager }]}/>} /><Route path="/match-exchange/:id" element={<p>Exchange details</p>}/></Routes></MemoryRouter>);

it('opens the same event editor directly from the primary action and calendar cells', () => {
    const { unmount } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'New event' }));
    // The workspace double deliberately forwards its click event into the optional-date callback.
    expect(screen.getByText('Unified event editor')).toBeInTheDocument();
    expect(screen.queryByText('Ordinary club editor')).not.toBeInTheDocument();
    unmount();mount();
    fireEvent.click(screen.getByRole('button', { name: 'Create in calendar cell' }));
    expect(screen.getByText('Unified event editor')).toHaveAttribute('data-date', '2099-09-21T12:00:00.000Z');
});
it('does not make managers choose an intermediate scheduling route', () => { mount(); expect(screen.queryByRole('button', { name: 'Other scheduling options' })).not.toBeInTheDocument(); });
it.each([true, false])('routes Exchange records to their canonical details for can_manage=%s', manager => {
    vi.mocked(useSquadSchedule).mockReturnValue({ key: 'loaded', events: [{ id: '82@date', eventId: 82, origin: 'MATCH_EXCHANGE', originId: 82, title: 'Friendly fixture', eventType: 'FRIENDLY', startsAt: new Date().toISOString(), endsAt: new Date(Date.now()+3600000).toISOString(), owningClubId: 1 } as SquadCalendarEvent], loading: false, error: '' });
    mount(manager);fireEvent.click(screen.getByRole('button', { name: 'Friendly fixture' }));
    expect(screen.getByText('Exchange details')).toBeInTheDocument();
    expect(screen.queryByText('Ordinary club editor')).not.toBeInTheDocument();
});
