import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import '../../i18n';
import TryoutBrowsePage from './TryoutBrowsePage';
import { apiClient } from '../../api/axiosConfig';
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [], total: 42, hasMore: true } }); });
it('sends late-page literal Georgian search and dates to the server before displaying counts', async () => {
  render(<MemoryRouter initialEntries={['/tryouts?q=%E1%83%93%E1%83%98%E1%83%9C%E1%83%90%E1%83%9B%E1%83%9D%25_&page=2&from=2099-01-01']}><TryoutBrowsePage /></MemoryRouter>);
  await screen.findByText('42 tryouts found');
  expect(apiClient.get).toHaveBeenCalledWith('/tryouts/discovery', expect.objectContaining({ params: expect.objectContaining({ q: 'დინამო%_', page: 2, from: '2099-01-01', status: 'OPEN' }) }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' })); await screen.findByText('Page 4');
  expect(apiClient.get).toHaveBeenLastCalledWith('/tryouts/discovery', expect.objectContaining({ params: expect.objectContaining({ page: 3 }) }));
});
it('links each posting to its identity without fabricating a schedule date', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [{ id: 41, title: 'Open intake', clubName: 'Dinamo', status: 'OPEN', tryoutDate: null }], total: 1, hasMore: false } });
  render(<MemoryRouter><TryoutBrowsePage /></MemoryRouter>);
  expect(await screen.findByText('Date to be confirmed')).toBeVisible();
  expect(screen.getByRole('link', { name: 'View tryout' })).toHaveAttribute('href', '/tryouts/41');
});
it('offers a retry after a failed search', async () => {
  vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('offline'));
  render(<MemoryRouter><TryoutBrowsePage /></MemoryRouter>);
  await screen.findByRole('alert'); fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('42 tryouts found')).toBeVisible();
});
