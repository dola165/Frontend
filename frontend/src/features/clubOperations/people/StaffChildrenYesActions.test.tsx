import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StaffChildrenYesActions } from './StaffChildrenYesActions';
import type { NotificationItem } from '../../../types/notifications';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: api, DEPLOYMENT_URLS: { mediaBaseUrl: '' } }));
vi.mock('../../../hooks/useCan', () => ({ refreshAccess: vi.fn() }));

const notice = { id: 1, type: 'CLUB_STAFF_CHILDREN_YES', scope: 'PERSONAL', entityType: 'club_staff_appointment', entityId: 44, title: 'Ana joined', body: '', isRead: false, createdAt: '2026-11-04', linkPath: '/clubs/7/workspace?tab=personnel' } as NotificationItem;
const people = (waitingYes: unknown) => ({ data: { people: [{ userId: 9, name: 'Ana Beridze', jobs: [{ kind: 'APPOINTMENT', id: 44, status: 'ACTIVE', revision: 2, waitingYes }] }] } });

beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

it('asks with the person’s name, never her or him, and the first answer goes to the server', async () => {
    api.get.mockResolvedValue(people({ invitedName: 'Ana Beridze', proof: 'EMAIL_CODE', canAnswer: true }));
    api.post.mockResolvedValue({ data: { answeredBy: 'Luka' } });
    render(<StaffChildrenYesActions notification={notice} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Let Ana see the children’s details' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/7/people/jobs/44/children-yes'));
    expect(await screen.findByRole('status')).toHaveTextContent('Ana can see the children’s details now.');
});

it('End job ends it through the job’s own route', async () => {
    api.get.mockResolvedValue(people({ invitedName: null, proof: null, canAnswer: true }));
    api.post.mockResolvedValue({ data: {} });
    render(<StaffChildrenYesActions notification={notice} />);
    fireEvent.click(await screen.findByRole('button', { name: 'End job' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/7/people/jobs/44/end', { revision: 2 }));
});

it('shows nothing once the job no longer waits, or to someone who can’t answer', async () => {
    api.get.mockResolvedValue(people(null));
    const { container } = render(<StaffChildrenYesActions notification={notice} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
});

it('the server’s plain words when someone else answered first', async () => {
    api.get.mockResolvedValue(people({ invitedName: null, proof: 'PHONE_TYPED', canAnswer: true }));
    api.post.mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { code: 'ALREADY_ANSWERED', message: 'Nino already said yes.' } } });
    render(<StaffChildrenYesActions notification={notice} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Let Ana see the children’s details' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nino already said yes.');
});
