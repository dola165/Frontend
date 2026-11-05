import { render, screen } from '@testing-library/react';
import { PastEventModal } from '../PastEventModal';
import type { ScheduleWorkspaceEvent } from '../workspaceTypes';
import '../../../i18n';

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'session-a' }) }));
vi.mock('../../../features/scores/api', () => ({ getScoreSummary: vi.fn(() => new Promise(() => {})), getScoreRecord: vi.fn(), writeScore: vi.fn() }));

const event: ScheduleWorkspaceEvent = {
    id: 'match-1', eventId: 1, title: 'City derby', eventType: 'MATCH',
    startsAt: '2020-01-05T18:00:00', endsAt: '2020-01-05T19:30:00',
    status: 'Scheduled', visibility: 'CLUB_ONLY', publicationState: 'PRIVATE', recurring: false,
    ownerLabel: 'City club', mapEligible: false, appearsOnMap: false, conflictingEventIds: [],
};

it('keeps past club events read-only for ordinary members', () => {
    render(<PastEventModal event={{ ...event, eventType: 'TRAINING' }} clubId={1} clubName="City club" onClose={vi.fn()} onCompleted={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'City derby' })).toBeInTheDocument();
    expect(screen.getByText('Only club schedule managers can complete this event.')).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /complete match/i })).not.toBeInTheDocument();
});

it('lets coaches mark a past event completed, but never offers to complete a match: its result does', () => {
    const { rerender } = render(<PastEventModal event={{ ...event, eventType: 'TRAINING', title: 'Tuesday training' }} clubId={1} clubName="City club" canComplete onClose={vi.fn()} onCompleted={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Mark as completed' })).toBeInTheDocument();
    rerender(<PastEventModal event={event} clubId={1} clubName="City club" canComplete onClose={vi.fn()} onCompleted={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /complete/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Only club schedule managers can complete this event.')).not.toBeInTheDocument();
});

it('recognizes the display-normalized completed status and does not offer completion again', () => {
    render(<PastEventModal event={{ ...event, status: 'Completed' }} clubId={1} clubName="City club" canComplete canRecordResult onClose={vi.fn()} onCompleted={vi.fn()} />);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /complete match/i })).not.toBeInTheDocument();
});
