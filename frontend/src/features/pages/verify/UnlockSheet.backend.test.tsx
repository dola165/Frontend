import '../../../i18n';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { makePage } from '../__tests__/fixtures';
import type { PageView, ReviewReceipt } from '../api';
import { PageEditContext, type PageEdit } from '../edit/context';

const api = vi.hoisted(() => ({ requestVerification: vi.fn() }));
vi.mock('../api', () => api);
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1 } }) }));
import { UnlockSheet } from './UnlockSheet';

const receipt: ReviewReceipt = { id: 'verification-receipt', revision: 1, status: 'PENDING', evidence: { phone: '+995555123456' }, submittedAt: '2026-10-18T00:00:00Z', reviewedAt: null, reason: null };
function Form({ initial }: { initial: PageView }) {
  const [page, replace] = useState(initial);
  return <PageEditContext.Provider value={{ page, replace } as unknown as PageEdit}><UnlockSheet action="VERIFIED_BADGE" onClose={vi.fn()} /></PageEditContext.Provider>;
}
beforeEach(() => vi.resetAllMocks());
it('saves a durable pending request, shows its receipt and preserves the exact retry after response loss', async () => {
  const page = makePage({ status: 'LIVE', verificationRevision: 4 });
  api.requestVerification.mockRejectedValueOnce(new Error('lost reply')).mockResolvedValueOnce({ ...page, verification: 'REQUESTED', verificationRequest: receipt });
  render(<Form initial={page} />);fireEvent.click(screen.getByRole('button', { name: 'Send' }));await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));await screen.findByText('Receipt: verification-receipt');
  expect(api.requestVerification.mock.calls[1]).toEqual(api.requestVerification.mock.calls[0]);
  expect(api.requestVerification.mock.calls[0][1]).toMatchObject({ expectedVersion: 4, requestId: expect.any(String), action: 'VERIFIED_BADGE' });
  expect(screen.queryByText('Verified')).not.toBeInTheDocument();
});
it('shows the saved request after reload without an invented promised response time', async () => {
  render(<Form initial={makePage({ status: 'LIVE', verification: 'REQUESTED', verificationRequest: receipt })} />);
  expect(screen.getByText('Receipt: verification-receipt')).toBeInTheDocument();expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
  expect(screen.queryByText(/within a day/)).not.toBeInTheDocument();
});
it('preserves a rejected outcome and permits an updated request at the current revision', () => {
  render(<Form initial={makePage({ status: 'LIVE', verificationRevision: 2, verificationRequest: { ...receipt, revision: 2, status: 'REJECTED', reason: 'Please correct legal name' } })} />);
  expect(screen.getByText('Please correct legal name')).toBeInTheDocument();expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
});
