import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OverviewTab } from '../OverviewTab';
import type { ClubManagementOverview } from '../../../../features/clubs/domain';
import type { ScheduleEventOccurrence } from '../../../../features/schedule/api';

const overview: ClubManagementOverview = {
    currentUserRole: 'OWNER',
    assignableInviteRoles: ['COACH'],
    assignableStaffRoles: ['CLUB_ADMIN', 'COACH'],
    activePlayerCount: 12,
    trialistCount: 3,
    overdueTrialistCount: 1,
    pendingTryoutCount: 0,
    members: [
        { userId: 1, username: 'owner', fullName: 'Owner', role: 'OWNER', roleEditable: false },
        { userId: 2, username: 'coach', fullName: 'Coach', role: 'COACH', roleEditable: true },
    ],
    pendingInvitations: [],
    pendingApplications: [],
};

const renderOverview = (overrides: Partial<Parameters<typeof OverviewTab>[0]> = {}) => {
    const props = {
        overview,
        clubId: 1,
        onTabChange: vi.fn(),
        canManageLeadership: true,
        canManageOperations: true,
        upcomingEvents: [] as ScheduleEventOccurrence[],
        scheduleLoading: false,
        scheduleError: null,
        tryoutPendingCount: 0,
        unreadInboxCount: 0,
        onOpenSchedule: vi.fn(),
        onRetrySchedule: vi.fn(),
        ...overrides,
    };
    render(<MemoryRouter><OverviewTab {...props} /></MemoryRouter>);
    return props;
};

describe('OverviewTab phase 3 summaries', () => {
    it('uses truthful staff and schedule empty-state copy', () => {
        renderOverview();
        expect(screen.getByText('Staff')).toBeInTheDocument();
        expect(screen.getByText('No club events are scheduled in the next 7 days.')).toBeInTheDocument();
        expect(screen.queryByText(/coming soon/i)).toBeNull();
    });

    it('opens the calendar from an upcoming event summary', () => {
        const props = renderOverview({
            upcomingEvents: [{
                eventId: 8,
                occurrenceId: '8:2026-09-07T18:00',
                clubId: 1,
                clubName: 'Test FC',
                userId: null,
                eventType: 'TRAINING',
                title: 'First team training',
                description: null,
                startsAt: '2026-09-07T18:00:00',
                endsAt: '2026-09-07T19:30:00',
                locationName: 'Main pitch',
                locationLat: null,
                locationLng: null,
                visibility: 'PRIVATE',
                publishAt: null,
                publicNow: false,
                recurring: false,
                recurrence: null,
                opponentClubId: null,
                opponentClubName: null,
                challengeStatus: null,
                status: 'SCHEDULED',
                conflict: false,
                conflictingEventIds: [],
            }],
        });
        expect(screen.getByText('First team training')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Open calendar' }));
        expect(props.onOpenSchedule).toHaveBeenCalled();
    });

    it('uses the authoritative tryout total before the tab is opened', () => {
        renderOverview({ overview: { ...overview, pendingTryoutCount: 4 }, tryoutPendingCount: 0 });
        expect(screen.getByText('Tryout Reviews').closest('.rounded-xl')).toHaveTextContent('4');
    });
});
