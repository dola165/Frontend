import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StandingSchedule } from '../StandingSchedule';
import type { ScheduleWorkspaceEvent } from '../workspaceTypes';

const training = (eventId: number, date: string, overrides: Partial<ScheduleWorkspaceEvent> = {}): ScheduleWorkspaceEvent => ({
    id: `${eventId}@${date}T18:00:00`, eventId, title: 'Evening training', eventType: 'TRAINING',
    startsAt: `${date}T18:00:00`, endsAt: `${date}T19:30:00`, status: 'Scheduled',
    visibility: 'CLUB_ONLY', publicationState: 'PRIVATE', recurring: true,
    recurrence: { frequency: 'WEEKLY', intervalValue: 1, daysOfWeek: ['MONDAY', 'FRIDAY'],
        startDate: '2020-01-01', endDate: null, startTime: '18:00:00', endTime: '19:30:00', timezone: 'Asia/Tbilisi' },
    ownerLabel: 'City club', mapEligible: false, appearsOnMap: false, conflictingEventIds: [], ...overrides,
});

describe('StandingSchedule', () => {
    it('keeps identically named series separate while grouping occurrences by eventId', () => {
        render(<StandingSchedule events={[
            training(1, '2099-01-09', { hostSquadId: 16 }), training(1, '2099-01-12', { hostSquadId: 16 }),
            training(2, '2099-01-09', { hostSquadId: 17 }),
        ]} onSelect={vi.fn()} squadNamesById={{ 16: 'U16', 17: 'First team' }} />);
        expect(screen.getAllByRole('button')).toHaveLength(2);
        expect(screen.getByRole('button', { name: /Evening training.*U16/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Evening training.*First team/ })).toBeInTheDocument();
    });

    it('opens the next future session instead of an earlier or more distant occurrence', async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        const next = training(1, '2099-01-09');
        render(<StandingSchedule events={[
            training(1, '2099-01-16'), training(1, '2020-01-01'), next, training(1, '2020-01-03'),
        ]} onSelect={onSelect} />);
        await user.click(screen.getByRole('button', { name: /Evening training/ }));
        expect(onSelect).toHaveBeenCalledWith(next);
    });

    it('falls back to the latest past session when the current view has no future occurrence', async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        const latest = training(1, '2020-01-03');
        render(<StandingSchedule events={[latest, training(1, '2020-01-01')]} onSelect={onSelect} />);
        await user.click(screen.getByRole('button', { name: /Evening training/ }));
        expect(onSelect).toHaveBeenCalledWith(latest);
    });

    it('excludes one-time events, non-training recurrence and raw or display-normalized cancellations', () => {
        render(<StandingSchedule events={[
            training(1, '2099-01-09', { recurring: false, recurrence: null }),
            training(2, '2099-01-09', { eventType: 'MATCH' }),
            training(3, '2099-01-09', { status: 'CANCELLED' }),
            training(4, '2099-01-09', { status: 'Cancelled' }),
        ]} onSelect={vi.fn()} />);
        expect(screen.getByText('No weekly training in this view.')).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('offers creation only when an authorized creation callback is supplied', async () => {
        const user = userEvent.setup();
        const onCreateTraining = vi.fn();
        const { rerender } = render(<StandingSchedule events={[]} />);
        expect(screen.queryByRole('button', { name: /weekly training/i })).not.toBeInTheDocument();
        rerender(<StandingSchedule events={[]} onCreateTraining={onCreateTraining} />);
        await user.click(screen.getByRole('button', { name: 'Add weekly training' }));
        expect(onCreateTraining).toHaveBeenCalledTimes(1);
        rerender(<StandingSchedule events={[training(1, '2099-01-09')]} onCreateTraining={onCreateTraining} />);
        await user.click(screen.getByRole('button', { name: 'Create weekly training' }));
        expect(onCreateTraining).toHaveBeenCalledTimes(2);
        rerender(<StandingSchedule events={[training(1, '2099-01-09')]} />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.getByRole('article')).toHaveTextContent('Evening training');
    });
});
