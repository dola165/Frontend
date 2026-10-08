import { fireEvent, render, screen } from '@testing-library/react';
import { calendarTime, trainingBlocks, weekStart, type TrainingSession } from '../trainingCalendar';
import { TrainingWeekCalendar } from '../TrainingWeekCalendar';

const session = (id: string, startsAt: string, endsAt: string): TrainingSession => ({ id, title: `Training ${id}`, startsAt, endsAt, status: 'SCHEDULED', timezone: 'Asia/Tbilisi', location: 'Training ground' });
it('uses the club timezone for instants and preserves legacy wall-clock event times', () => {
  expect(calendarTime('2026-09-28T20:30:00Z', 'Asia/Tbilisi')).toEqual({ day: '2026-09-29', minute: 30 });
  expect(calendarTime('2026-09-29T16:00:00', 'Asia/Tbilisi')).toEqual({ day: '2026-09-29', minute: 960 });
  expect(weekStart('2026-09-27')).toBe('2026-09-21');
});
it('splits overnight sessions and gives simultaneous sessions separate lanes', () => {
  const blocks = trainingBlocks([
    session('night', '2026-09-28T23:00:00', '2026-09-29T01:00:00'),
    session('first', '2026-09-29T16:00:00', '2026-09-29T17:30:00'),
    session('second', '2026-09-29T16:30:00', '2026-09-29T18:00:00'),
    session('later', '2026-09-29T18:00:00', '2026-09-29T19:00:00'),
  ], 'Asia/Tbilisi');
  expect(blocks.filter(b => b.session.id === 'night').map(b => [b.day, b.start, b.end])).toEqual([['2026-09-28', 1380, 1440], ['2026-09-29', 0, 60]]);
  expect(blocks.find(b => b.session.id === 'first')).toMatchObject({ lane: 0, lanes: 2 });
  expect(blocks.find(b => b.session.id === 'second')).toMatchObject({ lane: 1, lanes: 2 });
  expect(blocks.find(b => b.session.id === 'later')).toMatchObject({ lane: 0, lanes: 1 });
});
it('offers session details and all dates without publishing a cancelled location', () => {
  render(<TrainingWeekCalendar sessions={[session('one', '2026-09-29T16:00:00', '2026-09-29T17:30:00'), { ...session('cancelled', '2026-10-01T16:00:00', '2026-10-01T17:30:00'), status: 'CANCELLED', location: 'Old cancelled location' }]}/>);
  fireEvent.click(screen.getByRole('button', { name: /16:00–17:30 Training one/ }));
  expect(screen.getByRole('region', { name: 'Selected training session' })).toHaveTextContent('Training ground');
  fireEvent.click(screen.getByRole('button', { name: 'All dates' }));
  expect(screen.getByText('Cancelled')).toBeVisible();
  expect(screen.queryByText('Old cancelled location')).not.toBeInTheDocument();
  expect(screen.getByText(/Times shown in Asia\/Tbilisi/)).toBeVisible();
});
