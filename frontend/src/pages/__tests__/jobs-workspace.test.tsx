import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { JobsTab } from '../../components/workspace/tabs/JobsTab';
import * as api from '../../features/clubs/api';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../features/clubs/api', () => ({
    acceptClubApplication: vi.fn(),
    createClubJob: vi.fn(),
    declineClubApplication: vi.fn(),
    deleteClubJob: vi.fn(),
    fetchAllClubJobs: vi.fn(),
    fetchJobApplications: vi.fn(),
    updateClubJob: vi.fn(),
}));
const job: api.ClubJob = {
    id: 1,
    clubId: 10,
    title: 'Youth coach',
    status: 'OPEN',
    createdBy: 55,
    requiredRole: 'COACH',
};
beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.fetchAllClubJobs).mockResolvedValue([job]);
});
const setup = () =>
    render(<JobsTab clubId={10} currentUserId={55} canReviewAllApplications pendingKey={null} />);
it('surfaces close failures and retains the open posting', async () => {
    vi.mocked(api.updateClubJob).mockRejectedValue({
        response: { data: { error: 'Posting could not be closed' } },
    });
    setup();
    fireEvent.click(await screen.findByRole('button', { name: 'jobs.close' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Posting could not be closed');
    expect(screen.getByRole('button', { name: 'jobs.close' })).toBeEnabled();
});
it('keeps edits when saving fails and sends empty fields so a saved value can be cleared', async () => {
    vi.mocked(api.updateClubJob).mockRejectedValue({
        response: { data: { error: 'Please retry this save' } },
    });
    setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Youth coach' }));
    fireEvent.change(screen.getByLabelText('Job title'), { target: { value: 'Updated coach opening' } });
    fireEvent.change(screen.getByLabelText('Application route'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'jobs.save' }));
    await screen.findByText('Please retry this save');
    expect(screen.getByLabelText('Job title')).toHaveValue('Updated coach opening');
    expect(api.updateClubJob).toHaveBeenCalledWith(
        10,
        1,
        expect.objectContaining({ title: 'Updated coach opening', description: '', requiredRole: '' }),
    );
});
it('requires confirmation and keeps an application-history deletion conflict visible', async () => {
    vi.mocked(api.deleteClubJob).mockRejectedValue({
        response: { data: { error: 'Close this posting to preserve applications' } },
    });
    setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Youth coach' }));
    expect(api.deleteClubJob).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('preserve applications');
    expect(screen.getByText('Youth coach')).toBeInTheDocument();
});
