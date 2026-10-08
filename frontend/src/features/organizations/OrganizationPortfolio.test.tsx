import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import { OrganizationPortfolio } from './OrganizationPortfolio';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
const venue = { relationshipId: 10, id: 20, name: 'Training ground', city: 'Tbilisi', relationship: 'OPERATES', source: 'LEGACY_OPERATION', revision: 0, published: true, canManage: false, canEnd: false };
beforeEach(() => vi.resetAllMocks());

it('lists a venue once when it has both relationships without inventing booking access', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { clubId: null, canManageRelationships: false, venues: [venue, { ...venue, relationshipId: 11, relationship: 'OWNS', source: 'DECLARED' }] } });
  render(<MemoryRouter><OrganizationPortfolio id={1} /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Training ground' })).toBeInTheDocument();
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.getByText('Owned · declared, not verified')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Manage venue' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Link a venue' })).not.toBeInTheDocument();
});

it('sends the selected relationship and never submits a permission grant', async () => {
  vi.mocked(apiClient.get).mockImplementation(async url => ({ data: String(url).endsWith('venue-candidates') ? [{ id: 20, name: 'Training ground', city: null }] : { clubId: 1, canManageRelationships: true, venues: [] } }));
  vi.mocked(apiClient.post).mockResolvedValue({ data: { clubId: 1, canManageRelationships: true, venues: [venue] } });
  render(<MemoryRouter><OrganizationPortfolio id={1} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Link a venue' }));
  await screen.findByRole('option', { name: 'Training ground' });
  fireEvent.change(screen.getByLabelText('Venue'), { target: { value: '20' } });
  fireEvent.change(screen.getByLabelText('Relationship'), { target: { value: 'OWNS' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save relationship' }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/organizations/1/venue-relationships', { venueId: 20, relationship: 'OWNS' }));
});

it('requires an explicit end action and submits the viewed revision', async () => {
  const data = { clubId: null, canManageRelationships: true, venues: [{ ...venue, source: 'DECLARED', canEnd: true, revision: 3 }] };
  vi.mocked(apiClient.get).mockResolvedValue({ data });
  vi.mocked(apiClient.post).mockResolvedValue({ data: { ...data, venues: [] } });
  render(<MemoryRouter><OrganizationPortfolio id={1} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'End operation relationship with Training ground' }));
  expect(apiClient.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'End relationship' }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/organizations/1/venue-relationships/10/end', { revision: 3 }));
});
