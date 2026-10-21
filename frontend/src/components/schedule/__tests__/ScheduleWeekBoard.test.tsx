import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ScheduleWeekBoard } from '../ScheduleWeekBoard';
import type { ScheduleWorkspaceEvent } from '../workspaceTypes';
import '../../../i18n';

const days = [19, 20, 21, 22, 23, 24, 25].map(day => new Date(2026, 9, day));
const session = (id: number, day: number): ScheduleWorkspaceEvent & { session: { id: number } } => ({
    id: `squad:5875:${id}`, eventId: id, origin: 'SQUAD_SESSION', title: 'Private U12 plan',
    session: { id },
    eventType: 'TRAINING', startsAt: `2026-10-${day}T14:00:00Z`, endsAt: `2026-10-${day}T15:00:00Z`,
    status: 'SCHEDULED', visibility: 'CLUB_ONLY', publicationState: 'PRIVATE', recurring: true,
    seriesId: 'squad-training-81', recurrence: null, ownerLabel: 'U12', hostSquadId: 5875,
    mapEligible: false, appearsOnMap: false, conflictingEventIds: [],
});
const monday = session(81, 19), wednesday = session(82, 21);
beforeEach(() => { localStorage.clear(); vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-17T12:00:00Z').getTime()); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function plans() { return within(screen.getByRole('heading', { name: 'Training plans' }).closest('section')!); }
function mobileJump() {
    const panel = screen.getByRole('heading', { name: 'Training plans' }).closest('section')!;
    // The phone jump is CSS-hidden at the test document's desktop width.
    return document.querySelector(`button[aria-controls="${panel.id}"]`);
}

it('shows a saved canonical private series when the calendar timetable feed is empty', () => {
    const onSelect = vi.fn();
    render(<ScheduleWeekBoard days={days} events={[monday, wednesday]} trainingEvents={[]} view="board" canCreate onCreateTraining={vi.fn()} onSelect={onSelect} />);
    expect(mobileJump()).toHaveTextContent(/Training plans\s*1 plan/);
    expect(screen.queryByText('No weekly training in this view.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create a training plan' })).not.toBeInTheDocument();
    fireEvent.click(plans().getByRole('button', { name: /Private U12 plan/ }));
    expect(onSelect).toHaveBeenCalledWith(monday);
    expect(onSelect.mock.calls[0][0]).toBe(monday);
    expect(onSelect.mock.calls[0][0]).toMatchObject({ id: 'squad:5875:81', origin: 'SQUAD_SESSION', publicationState: 'PRIVATE', mapEligible: false, appearsOnMap: false });
});
it('counts one canonical series even when both feeds already contain its occurrences', () => {
    render(<ScheduleWeekBoard days={days} events={[monday, wednesday]} trainingEvents={[monday, wednesday]} view="board" onSelect={vi.fn()} />);
    expect(plans().getAllByRole('button', { name: /Private U12 plan/ })).toHaveLength(1);
    expect(mobileJump()).toHaveTextContent(/Training plans\s*1 plan/);
});
it('preserves an existing timetable beside a private series with the same source-local identity', () => {
    const legacy: ScheduleWorkspaceEvent = { ...monday, id: 'calendar:91', eventId: 91, origin: 'CLUB_CALENDAR', title: 'Club weekly timetable',
        recurrence: { frequency: 'WEEKLY', intervalValue: 1, daysOfWeek: ['MONDAY', 'WEDNESDAY'], startDate: '2026-10-19', startTime: '18:00', endTime: '19:00', timezone: 'Asia/Tbilisi' } };
    const add = vi.fn(), onSelect = vi.fn();
    render(<ScheduleWeekBoard days={days} events={[monday, wednesday]} trainingEvents={[legacy]} view="board" canCreate onCreateTraining={add} onSelect={onSelect} />);
    expect(mobileJump()).toHaveTextContent(/Training plans\s*2 plans/);
    fireEvent.click(plans().getByRole('button', { name: /Club weekly timetable/ }));
    expect(onSelect).toHaveBeenCalledWith(legacy);
    fireEvent.click(plans().getByRole('button', { name: 'Add training plan' })); expect(add).toHaveBeenCalledOnce();
});
it('does not invent a plan for one private session and keeps ordinary event creation available', () => {
    const one = { ...monday, recurring: false, seriesId: null }, create = vi.fn();
    render(<ScheduleWeekBoard days={days} events={[one]} trainingEvents={[]} view="board" canCreate onCreate={create} onCreateTraining={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.queryByRole('heading', { name: 'Training plans' })).not.toBeInTheDocument();
    expect(screen.queryByText('No weekly training in this view.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create a training plan' })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Add event on/ })[0]); expect(create).toHaveBeenCalledWith(days[0]);
});
it('honors a hidden training shelf while keeping the canonical calendar occurrences', () => {
    render(<ScheduleWeekBoard days={days} events={[monday]} view="board" showTraining={false} onSelect={vi.fn()} />);
    expect(screen.queryByRole('heading', { name: 'Training plans' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Private U12 plan').length).toBeGreaterThan(0);
});
