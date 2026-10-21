import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { DayAgenda } from './DayAgenda';
import { kindOf } from './fixtures';
import type { ScheduleEventType } from '../schedule/api';

afterEach(cleanup);
it('renders the real backend meeting type and its label without breaking the agenda', () => {
    const kind = kindOf({ eventType: 'MEETING' });
    render(<DayAgenda label="Upcoming" items={[{ key: 'meeting', title: 'Coaching Staff Meeting', startsAt: '2026-10-20T10:00:00+04:00', kind: 'MEETING', kindLabel: kind.label }]} />);
    expect(screen.getByText('Coaching Staff Meeting')).toBeVisible();
    expect(screen.getByText('Meeting')).toBeVisible();
});
it('keeps an unknown future event visible with a calendar icon', () => {
    render(<DayAgenda label="Upcoming" items={[{ key: 'future', title: 'Saved future activity', startsAt: '2026-10-20T10:00:00+04:00', kind: 'FUTURE' as ScheduleEventType }]} />);
    expect(screen.getByText('Saved future activity')).toBeVisible();
});
