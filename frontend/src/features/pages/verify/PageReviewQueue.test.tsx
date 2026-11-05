import '../../../i18n';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { PageReview } from '../api';

const api = vi.hoisted(() => ({ fetchPageReviews: vi.fn(), decidePageReview: vi.fn(), fetchPageReviewReceipt: vi.fn() }));
vi.mock('../api', () => api);
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 2 } }) }));
import { PageReviewQueue } from './PageReviewQueue';
import { PageReviewReceipt } from './PageReviewReceipt';

const row: PageReview = { id: 'request-uuid', revision: 1, ref: { type: 'club', id: 7 }, name: 'Synthetic managed FC', status: 'PENDING', requesterId: 3, canApprove: true, canDecide: true, ownershipAtSubmission: '', evidence: { phone: '+995555123456', action: 'VERIFIED_BADGE', legalName: 'Synthetic managed FC LLC' }, reason: null, submittedAt: '2026-10-18T00:00:00Z', reviewedAt: null };
function queue() { return render(<MemoryRouter initialEntries={['/admin/page-reviews?review=request-uuid']}><PageReviewQueue /></MemoryRouter>); }
beforeEach(() => { vi.resetAllMocks();api.fetchPageReviews.mockResolvedValue([row]); });
it('shows the verification evidence and links the requester', async () => {
  api.decidePageReview.mockResolvedValue({ ...row, status: 'APPROVED' });queue();await screen.findByLabelText('Review reason');
  expect(screen.getByText('Synthetic managed FC LLC')).toBeInTheDocument();expect(screen.getByRole('link', { name: 'View requester profile' })).toHaveAttribute('href', '/profile/3');
  expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();fireEvent.change(screen.getByLabelText('Review reason'), { target: { value: 'Synthetic evidence checked' } });
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));await waitFor(() => expect(api.decidePageReview).toHaveBeenCalledWith(row.id, expect.objectContaining({ expectedVersion: 1, outcome: 'APPROVED', reason: 'Synthetic evidence checked' })));
  await waitFor(() => expect(api.fetchPageReviews).toHaveBeenCalledWith('APPROVED', expect.any(AbortSignal)));
});
it('retains a failed rejection and reuses the exact command when the reply was lost', async () => {
  api.decidePageReview.mockRejectedValueOnce(new Error('reply lost')).mockResolvedValueOnce({ ...row, status: 'REJECTED' });queue();
  fireEvent.change(await screen.findByLabelText('Review reason'), { target: { value: 'Need additional evidence' } });fireEvent.click(screen.getByRole('button', { name: 'Reject' }));await screen.findByRole('alert');
  expect(screen.getByLabelText('Review reason')).toHaveValue('Need additional evidence');fireEvent.click(screen.getByRole('button', { name: 'Reject' }));await waitFor(() => expect(api.decidePageReview).toHaveBeenCalledTimes(2));
  expect(api.decidePageReview.mock.calls[1]).toEqual(api.decidePageReview.mock.calls[0]);
});
it('shows a current access denial without exposing stale queue evidence', async () => {
  api.fetchPageReviews.mockRejectedValue({ response: { status: 403, data: { detail: 'access revoked' } } });queue();await screen.findByText('access revoked');expect(screen.queryByText('+995555123456')).not.toBeInTheDocument();
});
it('opens the authorized receipt UUID independently of the notification identity', async () => {
  api.fetchPageReviewReceipt.mockResolvedValue({ ...row, status: 'REJECTED', reason: 'Synthetic review reason' });
  render(<MemoryRouter initialEntries={['/pages/requests/request-uuid']}><Routes><Route path="/pages/requests/:reviewId" element={<PageReviewReceipt />} /></Routes></MemoryRouter>);
  await screen.findByText('Synthetic review reason');expect(api.fetchPageReviewReceipt).toHaveBeenCalledWith('request-uuid', expect.any(AbortSignal));
});
it('keeps a stale reviewer notification useful after the request leaves the pending queue', async () => {
  api.fetchPageReviews.mockResolvedValue([]);queue();
  expect(await screen.findByRole('link', { name: 'View request' })).toHaveAttribute('href', '/pages/requests/request-uuid');
  expect(screen.getByText('This request may have changed status.')).toBeInTheDocument();
});
it('does not let a late decision reply redirect away from another request or erase its editor', async () => {
  let complete!: (value: PageReview) => void;
  api.decidePageReview.mockReturnValue(new Promise<PageReview>(resolve => { complete = resolve; }));
  api.fetchPageReviews.mockResolvedValue([row, { ...row, id: 'other-uuid', name: 'Synthetic other FC' }]);queue();
  fireEvent.change(await screen.findByLabelText('Review reason'), { target: { value: 'Evidence checked' } });fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  fireEvent.click(screen.getByRole('button', { name: /Synthetic other FC/ }));fireEvent.change(screen.getByLabelText('Review reason'), { target: { value: 'Keep this draft' } });
  await act(async () => complete({ ...row, status: 'APPROVED' }));
  expect(screen.getByLabelText('Review reason')).toHaveValue('Keep this draft');expect(api.fetchPageReviews).toHaveBeenCalledTimes(1);
});
