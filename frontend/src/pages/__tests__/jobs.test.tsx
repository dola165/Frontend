import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobsDirectoryPage } from '../JobsDirectoryPage';
import { JobDetailPage } from '../JobDetailPage';
import * as api from '../../features/clubs/api';
const auth = vi.hoisted(() => ({ status: 'authenticated', user: { id: 55 } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../features/clubs/api', () => ({
    fetchOpenJobDirectory: vi.fn(),
    fetchPublicJob: vi.fn(),
    fetchMyJobApplication: vi.fn(),
    createClubApplication: vi.fn(),
    cancelClubApplication: vi.fn(),
}));
const job: api.ClubJob = {
    id: 1,
    clubId: 10,
    title: 'Academy player',
    description: 'Join our team',
    requiredRole: 'PLAYER',
    status: 'OPEN',
    category: 'OTHER',
    engagementType: 'PAID',
    clubName: 'Alpha FC',
    clubCountryName: 'Georgia',
    clubCityName: 'Tbilisi',
    createdAt: '2026-09-01T12:00:00Z',
};
function Location() {
    const location = useLocation(),
        navigate = useNavigate();
    return (
        <>
            <output data-testid="location">
                {location.pathname}
                {location.search}
            </output>
            <button onClick={() => navigate(-1)}>History back</button>
        </>
    );
}
function directory(path = '/jobs', club?: number) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Location />
            <JobsDirectoryPage fixedClubId={club} clubName="Alpha FC" />
        </MemoryRouter>,
    );
}
function detail() {
    return render(
        <MemoryRouter initialEntries={['/jobs/1']}>
            <Routes>
                <Route path="/jobs/:id" element={<JobDetailPage />} />
            </Routes>
        </MemoryRouter>,
    );
}
beforeEach(() => {
    vi.resetAllMocks();
    auth.status = 'authenticated';
    auth.user = { id: 55 };
    vi.mocked(api.fetchOpenJobDirectory).mockResolvedValue([job]);
    vi.mocked(api.fetchPublicJob).mockResolvedValue(job);
    vi.mocked(api.fetchMyJobApplication).mockResolvedValue(null);
});
describe('Jobs browsing and application recovery', () => {
    it('keeps exact opportunity links and club scope with an exit to the general directory', async () => {
        vi.mocked(api.fetchOpenJobDirectory).mockResolvedValue([
            job,
            { ...job, id: 2, clubId: 20, title: 'Other club role' },
        ]);
        directory('/clubs/10?tab=business', 10);
        await screen.findByRole('link', { name: /Academy player Alpha FC/ });
        expect(screen.queryByRole('link', { name: /Other club role/ })).not.toBeInTheDocument();
        expect(screen.getAllByRole('link', { name: 'View opportunity' })[0]).toHaveAttribute(
            'href',
            '/jobs/1',
        );
        expect(screen.getByRole('link', { name: 'Browse all jobs & volunteering' })).toHaveAttribute(
            'href',
            '/jobs',
        );
        fireEvent.change(screen.getByLabelText('Search jobs'), { target: { value: 'missing' } });
        fireEvent.click(screen.getByRole('button', { name: 'Clear search and filters' }));
        expect(screen.getByTestId('location')).toHaveTextContent('/clubs/10?tab=business');
    });
    it('restores filters through history and clears dependent location selections', async () => {
        vi.mocked(api.fetchOpenJobDirectory).mockResolvedValue([
            job,
            { ...job, id: 2, clubId: 20, clubCountryName: 'France', clubCityName: 'Paris' },
        ]);
        directory('/jobs?country=Georgia&city=Tbilisi&clubId=10');
        await screen.findByRole('button', { name: 'Preview Academy player' });
        fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'France' } });
        expect(screen.getByTestId('location')).toHaveTextContent('/jobs?country=France');
        expect(screen.getByLabelText('City')).toHaveValue('');
        fireEvent.click(screen.getByRole('button', { name: 'History back' }));
        await waitFor(() => expect(screen.getByLabelText('City')).toHaveValue('Tbilisi'));
    });
    it('keeps preview selection on its page and resets pagination on a new search', async () => {
        vi.mocked(api.fetchOpenJobDirectory).mockResolvedValue(
            Array.from({ length: 14 }, (_, i) => ({ ...job, id: i + 1, title: `Role ${i + 1}` })),
        );
        directory();
        await screen.findByText('14 opportunities');
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Preview Role 1' }));
        expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Search jobs'), { target: { value: 'Role 14' } });
        expect(screen.getByRole('button', { name: 'Preview Role 14' })).toBeInTheDocument();
        expect(screen.getByTestId('location')).not.toHaveTextContent('page=');
    });
    it('can retry a failed directory load', async () => {
        vi.mocked(api.fetchOpenJobDirectory)
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValue([job]);
        directory();
        fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
        await screen.findByRole('button', { name: 'Preview Academy player' });
    });
    it('submits the actual role, retains failed drafts, then shows a confirmed pending application', async () => {
        vi.mocked(api.createClubApplication)
            .mockRejectedValueOnce({ response: { data: { error: 'Temporarily unavailable' } } })
            .mockResolvedValue({ applicationId: 77 });
        detail();
        const message = await screen.findByLabelText('Message to the club');
        fireEvent.change(message, { target: { value: 'I play goalkeeper' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send application' }));
        await screen.findByText('Temporarily unavailable');
        expect(message).toHaveValue('I play goalkeeper');
        expect(api.createClubApplication).toHaveBeenCalledWith(10, 'PLAYER', 'I play goalkeeper', {
            jobId: 1,
        });
        fireEvent.click(screen.getByRole('button', { name: 'Send application' }));
        await screen.findByRole('heading', { name: 'Application pending' });
        expect(screen.queryByLabelText('Message to the club')).not.toBeInTheDocument();
    });
    it('loads a pending application even when the posting is closed and confirms withdrawal', async () => {
        vi.mocked(api.fetchPublicJob).mockRejectedValue(new Error('closed'));
        vi.mocked(api.fetchMyJobApplication).mockResolvedValue({ id: 77, clubId: 10, status: 'PENDING' });
        vi.mocked(api.cancelClubApplication).mockResolvedValue({ status: 'CANCELLED' });
        detail();
        fireEvent.click(await screen.findByRole('button', { name: 'Withdraw application' }));
        expect(api.cancelClubApplication).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Confirm withdrawal' }));
        await screen.findByText('Application withdrawn.');
        expect(api.cancelClubApplication).toHaveBeenCalledWith(10, 77);
    });
    it('does not offer a duplicate form after acceptance', async () => {
        vi.mocked(api.fetchMyJobApplication).mockResolvedValue({ id: 77, clubId: 10, status: 'ACCEPTED' });
        detail();
        await screen.findByRole('heading', { name: 'Application accepted' });
        expect(screen.queryByRole('button', { name: 'Send application' })).not.toBeInTheDocument();
    });
    it('routes other roles to club contacts instead of silently applying as coach', async () => {
        vi.mocked(api.fetchPublicJob).mockResolvedValue({ ...job, requiredRole: 'CLUB_ADMIN' });
        detail();
        expect(await screen.findByRole('link', { name: 'Open club contact details' })).toHaveAttribute(
            'href',
            '/clubs/10?tab=contact',
        );
        expect(screen.queryByRole('button', { name: 'Send application' })).not.toBeInTheDocument();
        expect(api.createClubApplication).not.toHaveBeenCalled();
    });
    it('does not reveal a previous viewer draft or application after switching accounts', async () => {
        const view = detail();
        fireEvent.change(await screen.findByLabelText('Message to the club'), {
            target: { value: 'Private draft' },
        });
        auth.user = { id: 56 };
        view.rerender(
            <MemoryRouter initialEntries={['/jobs/1']}>
                <Routes>
                    <Route path="/jobs/:id" element={<JobDetailPage />} />
                </Routes>
            </MemoryRouter>,
        );
        await waitFor(() => expect(screen.getByLabelText('Message to the club')).toHaveValue(''));
    });
    it('preserves the exact destination through sign in', async () => {
        auth.status = 'anonymous';
        detail();
        expect(await screen.findByRole('link', { name: 'Sign in to apply' })).toHaveAttribute(
            'href',
            '/login?next=%2Fjobs%2F1',
        );
        expect(api.fetchMyJobApplication).not.toHaveBeenCalled();
    });
});
