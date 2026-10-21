import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import { SquadAgePolicy } from './SquadAgePolicy';
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('sends a reviewed season cutoff with the current policy revision', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { cutoffOn: null, revision: 0, effectiveCutoff: '2026-10-03' } });
  vi.mocked(apiClient.put).mockResolvedValue({ data: { cutoffOn: '2026-09-01', revision: 1, effectiveCutoff: '2026-09-01' } });
  render(<SquadAgePolicy club={1} squad={9} />); fireEvent.click(screen.getByText('Age eligibility and season cutoff'));
  fireEvent.change(await screen.findByLabelText('Season cutoff date'), { target: { value: '2026-09-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save age policy' }));
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/clubs/1/squads/9/age-policy', { cutoffOn: '2026-09-01', revision: 0 }));
});
