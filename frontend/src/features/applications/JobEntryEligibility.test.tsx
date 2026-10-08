import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JobDetailPage } from '../../pages/JobDetailPage';

const mock = vi.hoisted(() => ({ get: vi.fn(), submit: vi.fn(), job: vi.fn(), application: vi.fn() }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: mock.get } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated', user: { id: 5 }, sessionId: 'session-a' }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en', resolvedLanguage: 'en' } }) }));
vi.mock('../clubs/api', () => ({ fetchPublicJob: mock.job, fetchMyJobApplication: mock.application, createClubApplication: mock.submit }));
vi.mock('../recruitment/RecruitmentApplication', () => ({ RecruitmentApplication: () => <p>Saved recruitment receipt</p> }));
const renderJob = () => render(<MemoryRouter initialEntries={['/jobs/8']}><Routes><Route path="/jobs/:id" element={<JobDetailPage />} /></Routes></MemoryRouter>);
beforeEach(() => {
  vi.resetAllMocks();
  mock.job.mockResolvedValue({ id: 8, clubId: 1, title: 'Academy coach', clubName: 'Dinamo', requiredRole: 'COACH', status: 'OPEN' });
  mock.application.mockResolvedValue(null);
  mock.get.mockResolvedValue({ data: { allowed: true } });
  mock.submit.mockResolvedValue({ applicationId: 90 });
});
afterEach(cleanup);
describe('job-specific eligibility', () => {
  it('checks the specific club, role and job before submitting and displays the saved receipt', async () => {
    renderJob();
    fireEvent.change(await screen.findByLabelText('Message to the club'), { target: { value: 'Academy coaching' } });
    expect(mock.get).toHaveBeenCalledWith('/clubs/1/applications/eligibility', expect.objectContaining({ params: { role: 'COACH', intent: 'JOIN', jobId: 8 } }));
    fireEvent.click(screen.getByRole('button', { name: 'Send application' }));
    await screen.findByText('Saved recruitment receipt');
    expect(mock.submit).toHaveBeenCalledExactlyOnceWith(1, 'COACH', 'Academy coaching', { jobId: 8 }, expect.objectContaining({ _authSessionId: null }));
  });
  it('shows the missing identity reason and does not offer a doomed application', async () => {
    mock.get.mockResolvedValue({ data: { allowed: false, reason: 'IDENTITY_REQUIRED' } }); renderJob();
    expect(await screen.findByText(/Add the relevant player or coach identity/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Send application' })).toBeNull();
    expect(mock.submit).not.toHaveBeenCalled();
  });
  it('retains the typed draft while refreshing eligibility after a failed submission', async () => {
    mock.submit.mockRejectedValueOnce({ response: { data: { error: 'Please retry' } } }); renderJob();
    fireEvent.change(await screen.findByLabelText('Message to the club'), { target: { value: 'Keep this draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send application' }));
    await screen.findByText('Please retry');
    await waitFor(() => expect(screen.getByLabelText('Message to the club')).toHaveValue('Keep this draft'));
  });
  it('lets a previously withdrawn applicant request fresh eligibility', async () => {
    mock.application.mockResolvedValue({ id: 12, clubId: 1, status: 'CANCELLED' }); renderJob();
    expect(await screen.findByRole('button', { name: 'Send application' })).toBeEnabled();
    expect(screen.getByText('Saved recruitment receipt')).toBeVisible();
  });
});
