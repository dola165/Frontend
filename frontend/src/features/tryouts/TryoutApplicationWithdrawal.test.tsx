import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TryoutApplicationWithdrawal } from './TryoutApplicationWithdrawal';
import { apiClient } from '../../api/axiosConfig';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { post: vi.fn() } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));
const application = { id: 42, tryoutId: 7, tryoutTitle: 'Football trial', status: 'PENDING', appliedAt: '2026-09-25' };
beforeEach(() => vi.resetAllMocks());

it('reviews the consequence, allows keeping the application, and sends only one confirmed request', async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(apiClient.post).mockReturnValue(new Promise(r => { resolve = r; }));
    const onChanged = vi.fn();
    render(<TryoutApplicationWithdrawal application={application} onChanged={onChanged}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw application' }));
    expect(screen.getByText(/cannot apply to this same tryout again/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Keep application' }));
    expect(apiClient.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw application' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm withdrawal' }));
    expect(screen.getByRole('button', { name: 'Withdrawing…' })).toBeDisabled();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith('/tryouts/applications/42/withdraw', {}, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    await act(async () => resolve({ data: { id: 42, status: 'WITHDRAWN' } }));
    expect(onChanged).toHaveBeenCalledTimes(1);
});

it.each(['ACCEPTED', 'REJECTED', 'WITHDRAWN'])('offers no withdrawal for %s', status => {
    render(<TryoutApplicationWithdrawal application={{ ...application, status }} onChanged={vi.fn()}/>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    if (status === 'WITHDRAWN') expect(screen.getByRole('status')).toHaveTextContent('Withdrawn by you');
});

it('preserves terminal event cancellation', () => {
    render(<TryoutApplicationWithdrawal application={{ ...application, tryoutLifecycleStatus: 'CANCELLED' }} onChanged={vi.fn()}/>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('explains a concurrent decision without claiming success', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('Decision changed'));
    const onChanged = vi.fn();
    render(<TryoutApplicationWithdrawal application={{ ...application, status: 'SHORTLISTED' }} onChanged={onChanged}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw application' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm withdrawal' }));
    await screen.findByRole('alert');
    expect(onChanged).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Keep application' })).toBeEnabled());
});

it('aborts on account unmount and ignores a late response', async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(apiClient.post).mockReturnValue(new Promise(r => { resolve = r; }));
    const onChanged = vi.fn(), view = render(<TryoutApplicationWithdrawal application={application} onChanged={onChanged}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw application' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm withdrawal' }));
    const signal = vi.mocked(apiClient.post).mock.calls[0][2]?.signal;
    view.unmount(); expect(signal?.aborted).toBe(true);
    await act(async () => resolve({ data: {} }));
    expect(onChanged).not.toHaveBeenCalled();
});
