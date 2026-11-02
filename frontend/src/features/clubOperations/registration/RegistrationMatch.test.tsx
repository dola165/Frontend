import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../../api/axiosConfig';
import { MatchReadiness } from '../MatchReadiness';
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
afterEach(cleanup);
it.each([
  ['UNKNOWN', 'Eligibility unknown', 'Required credential is missing, unreviewed, corrected or no longer current.'],
  ['REVIEW_REQUIRED', 'Review needed', 'A correction is awaiting independent review.'],
  ['SUPERSEDED', 'Replaced by a later record', 'A later reviewed record retains this history.'],
  ['RECORDED_CURRENT', 'Recorded evidence current', ''],
])('shows calculated %s alongside the historical outcome in the existing match reader', async (state, label, reason) => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: [{ clubId: 12, clubName: 'Synthetic Dinamo context', canReadPreparation: true, records: [
    { id: 21, title: 'League 2026 entry', module: 'REGISTRATION', status: 'APPROVED', due_on: null, reviewOn: '2026-12-31', registration: { state, reasons: reason ? [reason] : [], expiresOn: '2026-10-29', credentialIds: [], supersededBy: null } },
  ] }] });
  render(<MemoryRouter><MatchReadiness event={88} /></MemoryRouter>);
  await screen.findByText(new RegExp(label));
  expect(screen.getByText(/Historical outcome: Approved/)).toBeVisible();
  expect(screen.getByText(/Validity ends 2026-10-29/)).toBeVisible();
  if (reason) expect(screen.getByText(reason)).toBeVisible();
  expect(screen.getByText(/not a universal playing permit/)).toBeVisible();
  expect(screen.getByRole('link', { name: 'League 2026 entry' })).toHaveAttribute('href', '/clubs/12/office?tab=tools&tool=registration&record=21');
  expect(screen.queryByText(/2026-12-31/)).not.toBeInTheDocument();
});
