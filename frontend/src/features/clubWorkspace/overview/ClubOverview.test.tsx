import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClubOverview } from './ClubOverview';
import type { ClubManagementOverview, ClubPlayerAffiliation } from '../../clubs/domain';
import type { ScheduleEventOccurrence } from '../../schedule/api';
import { fetchClubPlayers } from '../../clubs/api';
import '../../../i18n';

vi.mock('../../clubs/api', () => ({ fetchClubPlayers: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));

beforeEach(() => {
    localStorage.clear();
    vi.mocked(fetchClubPlayers).mockReset();
    vi.mocked(fetchClubPlayers).mockResolvedValue({ content: [], pageNumber: 0, pageSize: 50, totalElements: 0 });
});

const overview: ClubManagementOverview = {
    currentUserRole: 'OWNER', assignableInviteRoles: ['COACH'], assignableStaffRoles: ['CLUB_ADMIN', 'COACH'],
    activePlayerCount: 12, trialistCount: 3, overdueTrialistCount: 1, pendingTryoutCount: 0,
    members: [
        { userId: 1, username: 'owner', fullName: 'Owner', role: 'OWNER', roleEditable: false },
        { userId: 2, username: 'coach', fullName: 'Coach', role: 'COACH', roleEditable: true },
    ],
    pendingInvitations: [], pendingApplications: [],
};
const event: ScheduleEventOccurrence = {
    eventId: 8, occurrenceId: '8:2026-09-07T18:00', clubId: 1, clubName: 'Test FC', userId: null, eventType: 'TRAINING',
    title: 'First team training', description: null, startsAt: '2026-09-07T18:00:00', endsAt: '2026-09-07T19:30:00',
    locationName: 'Main pitch', locationLat: null, locationLng: null, visibility: 'PRIVATE', publishAt: null, publicNow: false,
    recurring: false, recurrence: null, opponentClubId: null, opponentClubName: null, challengeStatus: null, status: 'SCHEDULED',
    conflict: false, conflictingEventIds: [],
};

const renderOverview = (overrides: Partial<Parameters<typeof ClubOverview>[0]> = {}) => {
    const props: Parameters<typeof ClubOverview>[0] = {
        clubId: 1, clubName: 'Test FC', overview, roles: null, boot: null,
        schedule: { events: [], loading: false, error: null, retry: vi.fn(), open: vi.fn(), openEvent: vi.fn() },
        unreadInbox: 0, inboxAllowed: true, tryoutPending: 0, canManageOperations: true, canManageLeadership: true,
        tabs: [], pinned: [], onOpen: vi.fn(), onOpenPlayers: vi.fn(),
        ...overrides,
    };
    render(<MemoryRouter><ClubOverview {...props} /></MemoryRouter>);
    return props;
};

describe('Club overview', () => {
    it('uses truthful staff and schedule empty-state copy', async () => {
        renderOverview();
        expect(screen.getAllByText('Staff')).not.toHaveLength(0);
        expect(screen.getByText('No club events are scheduled in the next 7 days.')).toBeInTheDocument();
        expect(screen.queryByText(/coming soon/i)).toBeNull();
        await screen.findByText(/All current players checked\./);
    });

    it('opens the calendar from an upcoming fixture', async () => {
        const props = renderOverview({ schedule: { events: [event], loading: false, error: null, retry: vi.fn(), open: vi.fn(), openEvent: vi.fn() } });
        fireEvent.click(screen.getByRole('button', { name: 'Open First team training in calendar' }));
        expect(props.schedule.openEvent).toHaveBeenCalledWith(event);
        fireEvent.click(screen.getByRole('button', { name: 'Open calendar' }));
        expect(props.schedule.open).toHaveBeenCalled();
        await screen.findByText(/All current players checked\./);
    });

    it('puts overdue work first and uses the authoritative tryout count', async () => {
        const props = renderOverview({ overview: { ...overview, pendingTryoutCount: 4 }, tryoutPending: 4 });
        const rows = screen.getAllByRole('listitem').map(item => item.textContent ?? '').filter(text => /overdue trial|tryout review/.test(text));
        expect(rows[0]).toMatch(/1 overdue trial decision/);
        fireEvent.click(screen.getByRole('button', { name: /4 tryout reviews/ }));
        expect(props.onOpen).toHaveBeenCalledWith('tryouts');
        fireEvent.click(screen.getByRole('button', { name: /1 overdue trial decision/ }));
        expect(props.onOpenPlayers).toHaveBeenCalledWith('TRIALIST');
        await screen.findByText(/All current players checked\./);
    });

    it('separates missing, pending and expired consent and opens the correct player status', async () => {
        const players: ClubPlayerAffiliation[] = [
            { userId: 10, fullName: 'Missing consent', status: 'ACTIVE', primary: true, requiresParentalConsent: true, parentalConsentStatus: 'NOT_REQUIRED' },
            { userId: 11, fullName: 'Pending reply', status: 'ACTIVE', primary: true, requiresParentalConsent: true, parentalConsentStatus: 'PENDING' },
            { userId: 12, fullName: 'Confirmed player', status: 'ACTIVE', primary: true, requiresParentalConsent: true, parentalConsentStatus: 'CONFIRMED' },
            { userId: 13, fullName: 'Adult player', status: 'ACTIVE', primary: true, requiresParentalConsent: false, parentalConsentStatus: 'NOT_REQUIRED' },
            { userId: 14, fullName: 'Expired trialist', status: 'TRIALIST', primary: true, requiresParentalConsent: true, parentalConsentStatus: 'EXPIRED' },
        ];
        vi.mocked(fetchClubPlayers).mockImplementation(async (_clubId, status) => {
            const content = players.filter(player => player.status === status);
            return { content, pageNumber: 0, pageSize: 50, totalElements: content.length };
        });
        const props = renderOverview();
        await screen.findByText('Expired trialist');
        expect(screen.getByText('Consent needed')).toBeInTheDocument();
        expect(screen.getByText('Awaiting parent')).toBeInTheDocument();
        expect(screen.getByText('Consent expired')).toBeInTheDocument();
        expect(screen.queryByText('Confirmed player')).toBeNull();
        expect(screen.queryByText('Adult player')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /Expired trialist/ }));
        expect(props.onOpenPlayers).toHaveBeenCalledWith('TRIALIST');
        expect(fetchClubPlayers).toHaveBeenCalledTimes(2);
        expect(fetchClubPlayers).toHaveBeenCalledWith(1, 'ACTIVE', 0, 50);
        expect(fetchClubPlayers).toHaveBeenCalledWith(1, 'TRIALIST', 0, 50);
    });

    it('does not present a bounded consent sample as a full-club total', async () => {
        vi.mocked(fetchClubPlayers).mockResolvedValue({
            content: [{ userId: 10, fullName: 'Sample player', status: 'ACTIVE', primary: true, requiresParentalConsent: true }],
            pageNumber: 0, pageSize: 50, totalElements: 80,
        });
        renderOverview({ overview: { ...overview, activePlayerCount: 80, trialistCount: 0, overdueTrialistCount: 0 } });
        await screen.findByText(/Checked 1 of 80 current players\. Open Players to review the rest\./);
        expect(screen.queryByText(/All current players checked\./)).toBeNull();
        expect(fetchClubPlayers).toHaveBeenCalledTimes(1);
    });

    it('shows a retry after a consent failure', async () => {
        vi.mocked(fetchClubPlayers).mockRejectedValueOnce(new Error('Unavailable'));
        renderOverview();
        await screen.findByText('Could not check parent consent.');
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        await screen.findByText(/All current players checked\./);
        expect(fetchClubPlayers).toHaveBeenCalledTimes(4);
    });

    it('does not fetch consent or expose management actions without permission', async () => {
        renderOverview({ canManageOperations: false, canManageLeadership: false });
        expect(screen.queryByText(/Parent consent/)).toBeNull();
        expect(screen.queryByText(/membership application/)).toBeNull();
        expect(screen.queryByRole('button', { name: /Invitations/ })).toBeNull();
        await waitFor(() => expect(fetchClubPlayers).not.toHaveBeenCalled());
    });
});
