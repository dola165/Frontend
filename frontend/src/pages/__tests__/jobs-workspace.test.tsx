import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { JobsTab } from '../../components/workspace/tabs/JobsTab';
import * as api from '../../features/clubs/api';
vi.mock('react-i18next', () => { const t = (key: string) => key; return { useTranslation: () => ({ t }) }; });
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
    version: 0,
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
    fireEvent.change(screen.getByLabelText('Role title'), { target: { value: 'Updated coach opening' } });
    fireEvent.change(screen.getByLabelText('Application route'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'jobs.save' }));
    await screen.findByText('Please retry this save');
    expect(screen.getByLabelText('Role title')).toHaveValue('Updated coach opening');
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

it('keeps a stale draft while showing latest terms and requires explicit replacement', async () => {
    vi.mocked(api.updateClubJob).mockRejectedValue({ response: { status: 409, data: { error: 'This posting changed' } } });
    setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Youth coach' }));
    fireEvent.change(screen.getByLabelText('Role description'), { target: { value: 'My unsaved terms' } });
    fireEvent.click(screen.getByRole('button', { name: 'jobs.save' }));
    await screen.findByText('This posting changed');
    expect(api.updateClubJob).toHaveBeenLastCalledWith(10, 1, expect.objectContaining({ version: 0, description: 'My unsaved terms' }));
    vi.mocked(api.fetchAllClubJobs).mockResolvedValue([{ ...job, version: 1, description: 'New paid terms', engagementType: 'PAID' }]);
    fireEvent.click(screen.getByRole('button', { name: 'View latest saved posting' }));
    await screen.findByRole('region', { name: 'Latest saved posting' });
    expect(screen.getByLabelText('Role description')).toHaveValue('My unsaved terms');
    expect(screen.getByText('New paid terms')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Discard my draft and use latest posting' }));
    expect(screen.getByLabelText('Role description')).toHaveValue('New paid terms');
    fireEvent.click(screen.getByRole('button', { name: 'jobs.save' }));
    await screen.findByText('This posting changed');
    expect(api.updateClubJob).toHaveBeenLastCalledWith(10, 1, expect.objectContaining({ version: 1, description: 'New paid terms', engagementType: 'PAID' }));
});
it('sends the displayed version for close and the confirmed version for delete', async () => {
    vi.mocked(api.updateClubJob).mockRejectedValue({ response: { status: 409, data: { error: 'Posting changed' } } });
    setup();
    fireEvent.click(await screen.findByRole('button', { name: 'jobs.close' }));
    await screen.findByRole('alert');
    expect(api.updateClubJob).toHaveBeenCalledWith(10, 1, { status: 'CLOSED', version: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Delete Youth coach' }));
    vi.mocked(api.fetchAllClubJobs).mockResolvedValue([{ ...job, version: 2, title: 'Newer title' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Reload jobs' }));
    await screen.findByText('Newer title');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(api.deleteClubJob).toHaveBeenCalledWith(10, 1, 0);
});
