import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import '../../../i18n';
import { ApplicationsPage } from './ApplicationsPage';
afterEach(cleanup);
it('exposes matching totals and bounded page navigation', () => {
  const change = vi.fn();
  render(<MemoryRouter><ApplicationsPage applications={[]} applicationsLoading={false} applicationsError={null} filters={{ position: '', ageGroup: '', status: 'ALL', jobId: '' }} bulkPending={false} onFiltersChange={vi.fn()} onAcceptApplication={vi.fn()} onDeclineApplication={vi.fn()} onBulkDecide={vi.fn()} onRetry={vi.fn()} pagination={{ page: 0, size: 100, total: 203, onChange: change }} /></MemoryRouter>);
  expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Next page' })); expect(change).toHaveBeenCalledWith(1);
  expect(screen.getByText(/203 matching applications/)).toBeVisible();
});
