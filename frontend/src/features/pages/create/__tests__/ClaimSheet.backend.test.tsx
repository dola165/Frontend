import '../../../../i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { makePage } from '../../__tests__/fixtures';
import type { PageView } from '../../api';

const api = vi.hoisted(() => ({ fetchPage: vi.fn(), claimPage: vi.fn() }));
const auth = vi.hoisted(() => ({ id: 1 }));
vi.mock('../../api', () => api);
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: auth.id } }) }));
import { ClaimSheet } from '../ClaimSheet';

const ref = { type: 'organization' as const, id: 7002 };
const available = () => makePage({ status: 'LIVE', claim: null, viewer: { role: null, canEdit: false, editable: [], canClaim: true } });
const pending = (): PageView => ({ ...available(), claim: { id: 'receipt-a', state: 'PENDING', mine: true, role: 'COACH', revision: 1, evidence: { phone: '+995555123456' } }, viewer: { role: null, canEdit: false, editable: [], canClaim: false } });
function tree() { return <MemoryRouter><ClaimSheet pageRef={ref} onClose={vi.fn()} /></MemoryRouter>; }
beforeEach(() => { vi.resetAllMocks(); auth.id = 1; api.fetchPage.mockResolvedValue(available()); });

it('submits once, keeps a private pending receipt, and never opens edit mode', async () => {
  api.claimPage.mockResolvedValue(pending()); render(tree());
  fireEvent.change(await screen.findByLabelText('Phone'), { target: { value: '+995555123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Claim it' }));
  await screen.findByText('Claim submitted for review');
  expect(api.claimPage).toHaveBeenCalledWith(ref, expect.objectContaining({ expectedVersion: 0, role: 'CHAIR', phone: '+995555123456', requestId: expect.any(String) }));
  expect(screen.getByRole('link', { name: 'Open page' }).getAttribute('href')).toBe('/organizations/7002');
  expect(screen.queryByRole('button', { name: 'Claim it' })).not.toBeInTheDocument();
});

it('reuses the exact command after a lost reply and changes identity only when the details change', async () => {
  api.claimPage.mockRejectedValueOnce(new Error('reply lost')).mockResolvedValueOnce(pending()); render(tree());
  fireEvent.change(await screen.findByLabelText('Phone'), { target: { value: '+995555123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Claim it' })); await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Claim it' })); await screen.findByText('Claim submitted for review');
  expect(api.claimPage.mock.calls[1]).toEqual(api.claimPage.mock.calls[0]);
});

it('reads the same pending receipt on a fresh mount instead of claiming editing access', async () => {
  api.fetchPage.mockResolvedValue(pending()); render(tree());
  await screen.findByText('Claim submitted for review');
  expect(screen.getByText('Receipt: receipt-a')).toBeInTheDocument();
  expect(screen.queryByLabelText('Phone')).not.toBeInTheDocument();expect(api.claimPage).not.toHaveBeenCalled();
});

it('retains a rejection reason and submits the current revision when corrected', async () => {
  api.fetchPage.mockResolvedValue({ ...available(), claim: { ...pending().claim, state: 'REJECTED', reason: 'Need different evidence', revision: 2 } });
  api.claimPage.mockResolvedValue(pending()); render(tree());
  fireEvent.change(await screen.findByLabelText('Phone'), { target: { value: '+995555123456' } });
  expect(screen.getByText('Need different evidence')).toBeInTheDocument();fireEvent.click(screen.getByRole('button', { name: 'Claim it' }));
  await waitFor(() => expect(api.claimPage).toHaveBeenCalledWith(ref, expect.objectContaining({ expectedVersion: 2 })));
});

it('discards the prior account form and late claim reply on account switch', async () => {
  let complete!: (page: PageView) => void;api.claimPage.mockReturnValue(new Promise<PageView>(resolve => { complete = resolve; }));
  const view = render(tree());fireEvent.change(await screen.findByLabelText('Phone'), { target: { value: '+995555123456' } });fireEvent.click(screen.getByRole('button', { name: 'Claim it' }));
  auth.id = 2;view.rerender(tree());await waitFor(() => expect(screen.getByLabelText('Phone')).toHaveValue(''));
  complete(pending());await waitFor(() => expect(screen.queryByText('Receipt: receipt-a')).not.toBeInTheDocument());
});
