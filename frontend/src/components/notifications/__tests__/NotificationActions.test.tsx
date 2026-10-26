import '../../../i18n';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NotificationActions } from '../NotificationActions';
import * as squads from '../../../features/squadCommunication/api';
import { apiClient } from '../../../api/axiosConfig';
import type { NotificationItem } from '../../../types/notifications';

vi.mock('../../../features/squadCommunication/api', () => ({ joinRequests: vi.fn(), approveAllJoinRequests: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { post: vi.fn(), get: vi.fn() } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 4 }, refreshNavigationCapabilities: () => Promise.resolve() }) }));

const base: NotificationItem = { id: 1, type: 'SQUAD_JOIN_REQUESTS', scope: 'CLUB', entityType: 'squad', entityId: 11, title: '3 want to join U12', body: 'Approve all, or open each request.', isRead: false, createdAt: '2026-10-23T09:00:00Z', linkPath: '/squads/11?tab=players&invite=1' };
const group = { id: 81, version: 3, name: 'U12 intake', method: 'DIRECT' as const };
const request = (id: number, childName: string): squads.SquadJoinRequest => ({ id, version: 1, source: 'LINK', playerId: id + 100, childName, birthYear: 2015, guardianName: null, message: null, createdAt: '2026-10-23T09:00:00Z', caseId: null, destination: '', groups: [group], setup: { canConfigure: false, destination: null } });
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

it('lets the coach approve the whole squad list from the notice', async () => {
    vi.mocked(squads.joinRequests).mockResolvedValue([request(1, 'Luka Beridze'), request(2, 'Nika Beridze'), request(3, 'Ana Beridze'), request(4, 'Saba Beridze')]);
    vi.mocked(squads.approveAllJoinRequests).mockResolvedValue({ approved: 4, groupName: 'U12 intake', decisions: [] });
    render(<NotificationActions notification={base} />);
    expect(await screen.findByText('Luka, Nika, Ana and 1 more')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve all 4' }));
    await waitFor(() => expect(squads.approveAllJoinRequests).toHaveBeenCalledWith(11, expect.objectContaining({ requests: [1, 2, 3, 4].map(id => ({ inquiryId: id, expectedVersion: 1 })), groupId: 81, groupVersion: 3 })));
    expect(await screen.findByText('4 offered a place in U12 intake. Families accept the terms next.')).toBeInTheDocument();
});

it('shows nothing when the list has already been answered', async () => {
    vi.mocked(squads.joinRequests).mockResolvedValue([]);
    const { container } = render(<NotificationActions notification={base} />);
    await waitFor(() => expect(squads.joinRequests).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
});

it('lets a parent confirm a second parent, which sends the usual guardian invitation', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 5, outcome: 'INVITED' } });
    render(<NotificationActions notification={{ ...base, type: 'FAMILY_LINK_REQUEST', scope: 'PERSONAL', entityType: 'family_link_request', entityId: 5, title: 'Nino Kapanadze asks to be Luka’s parent too' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, add as parent' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/family/link-requests/5', { accept: true, requestId: expect.stringMatching(/^[0-9a-f-]{36}$/) }));
    expect(await screen.findByText('Invitation sent. They accept it in Parent Hub.')).toBeInTheDocument();
    expect(squads.joinRequests).not.toHaveBeenCalled();
});

it('lets an admin confirm a suggested assistant in the notification itself', async () => {
    const suggested = { kind: 'APPOINTMENT', id: 55, status: 'SUGGESTED', revision: 3, canConfirm: true };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { people: [{ userId: 30, name: 'Dato', jobs: [suggested] }] } });
    vi.mocked(apiClient.post).mockResolvedValue({ data: { appointmentId: 55, outcome: 'CONFIRMED', answeredBy: 'Nino', link: { token: 'dato.tok', expiresAt: '2026-11-02T12:00:00' } } });
    render(<NotificationActions notification={{ ...base, type: 'CLUB_PEOPLE', clubId: null, linkPath: '/clubs/7/workspace?tab=personnel', entityType: 'club_staff_appointment', entityId: 55, title: 'Giorgi suggests Dato as assistant coach for U12' }} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/clubs/7/people/suggestions/55', { confirm: true, revision: 3 }));
    expect(await screen.findByText('Confirmed. Send Dato this link to choose a password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Invite link for Dato')).toHaveValue(`${window.location.origin}/club-invite?token=dato.tok`);
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toBeInTheDocument();
});

it('shows no buttons once the suggestion was already answered', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { people: [{ userId: 30, name: 'Dato', jobs: [{ kind: 'APPOINTMENT', id: 55, status: 'INVITED', revision: 4 }] }] } });
    const { container } = render(<NotificationActions notification={{ ...base, type: 'CLUB_PEOPLE', linkPath: '/clubs/7/workspace?tab=personnel', entityType: 'club_staff_appointment', entityId: 55 }} />);
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/clubs/7/people', expect.anything()));
    expect(container.querySelector('button')).toBeNull();
});

it('lets the person a club is handed to take it over in the notification', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { ownerId: 1, ownerName: 'Luka', handover: { id: 3, toUserId: 4, toName: 'Mari', status: 'PENDING', createdAt: '2026-10-27T10:00:00' }, reclaim: null } });
    vi.mocked(apiClient.post).mockResolvedValue({ data: { outcome: 'TRANSFERRED' } });
    render(<NotificationActions notification={{ ...base, type: 'CLUB_OWNERSHIP', clubId: null, linkPath: '/clubs/7', entityType: 'club', entityId: 7, title: 'Luka wants to hand you FC Dinamo' }} />);
    fireEvent.click(await screen.findByRole('button', { name: /Take over/ }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/clubs/7/ownership/handover/3/answer', { accept: true }));
    expect(await screen.findByText('You own the club now.')).toBeInTheDocument();
});
