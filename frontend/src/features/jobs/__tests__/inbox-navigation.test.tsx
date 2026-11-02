import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { NotificationListItem } from '../../../components/notifications/NotificationListItem';
import { buildNotificationDestination } from '../../../utils/notifications';
import { JobsPage } from '../../../pages/JobsPage';
import { JobDetailPage } from '../../../pages/JobDetailPage';
import { fetchPublicJob } from '../../clubs/api';
import * as api from '../responsesApi';
import type { NotificationItem } from '../../../types/notifications';
import type { Job } from '../api';

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated', user: { id: 8 } }) }));
vi.mock('../../clubs/api', () => ({ fetchPublicJob: vi.fn(), fetchMyJobApplication: vi.fn() }));
vi.mock('../responsesApi', () => ({ fetchResponses: vi.fn(), fetchMyResponses: vi.fn(), sendResponse: vi.fn() }));
vi.mock('../../world/useWorldArea', () => ({ useWorldArea: () => ({ area: { ready: false, anywhere: true, guessed: false, city: 'Tbilisi' } }) }));
vi.mock('../JobsMap', () => ({ JobsMap: () => null }));
vi.mock('../../store/front/useReveal', () => ({ useReveal: () => ({ current: null }) }));

const job: Job = { id: 101, title: 'Synthetic public listing', description: 'Public duties', status: 'OPEN', version: 0, createdAt: '2026-10-30T12:00:00Z', clubId: null, direction: 'HIRING', applyMethod: 'IN_APP', requiredRole: null, canManage: true, poster: { kind: 'PERSON', id: 8, name: 'Adult publisher', avatarUrl: null, city: null } };
const response: api.JobResponse = { id: 30, jobId: 101, applicantId: 9, applicantName: 'Adult applicant', title: job.title, direction: 'HIRING', listingStatus: 'OPEN', terms: { version: 0, description: 'Public duties', city: null }, offeredListingVersion: null, contactAllowed: true, status: 'SUBMITTED', version: 0, applicant: false, publisher: true, actions: ['REPLY', 'OFFER', 'DECLINE'], updatedAt: job.createdAt!, events: [{ id: 40, action: 'SUBMIT', side: 'APPLICANT', note: 'Only an authorized workspace may show this note', createdAt: job.createdAt! }] };

function Flow({ path }: { path: string }) {
    const navigate = useNavigate();
    const notice: NotificationItem = { id: 2, type: 'PUBLIC_JOB_RESPONSE', entityType: 'public_job_response', entityId: 30, scope: 'PERSONAL', title: 'Work response update', body: 'A work response was updated.', isRead: false, createdAt: job.createdAt!, linkPath: path };
    return <><button onClick={() => navigate('/')}>Inbox</button><Routes>
        <Route path="/" element={<NotificationListItem notification={notice} onOpen={value => navigate(buildNotificationDestination(value))} />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />
    </Routes></>;
}

beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear(); localStorage.setItem('gk-session-id', 'inbox-login');
    vi.mocked(fetchPublicJob).mockResolvedValue(job);
});

it.each(['/jobs', '/jobs/101'])('the actual notification click opens %s and rechecks authority on return', async path => {
    const receipt = path === '/jobs' ? { ...response, applicantId: 8, applicant: true, publisher: false, actions: ['REPLY', 'WITHDRAW'] as api.ResponseAction[] } : response;
    vi.mocked(api.fetchMyResponses).mockResolvedValue([receipt]);
    vi.mocked(api.fetchResponses).mockResolvedValue({ publisher: true, canSubmit: false, reason: 'OWN_LISTING', responses: [receipt] });
    render(<MemoryRouter><Flow path={path} /></MemoryRouter>);
    expect(screen.queryByText(response.events[0].note!)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Review response/ }));
    expect(await screen.findByText(response.events[0].note!)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: path === '/jobs' ? 'Withdraw' : 'Send offer' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Inbox' }));
    vi.mocked(api.fetchMyResponses).mockRejectedValue(new Error('Current response access ended'));
    vi.mocked(api.fetchResponses).mockRejectedValue(new Error('Current response access ended'));
    fireEvent.click(screen.getByRole('button', { name: /Review response/ }));
    expect(screen.queryByText(response.events[0].note!)).not.toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('This could not load.');
    expect(screen.queryByText(response.events[0].note!)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send offer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Withdraw' })).not.toBeInTheDocument();
});
