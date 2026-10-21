import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '../../../../i18n';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { OrganizationVenues } from '../OrganizationVenues';
import { fetchVenue, type Venue } from '../../../venues/api';
vi.mock('../../../venues/api', async original => ({ ...await original<typeof import('../../../venues/api')>(), fetchVenue: vi.fn() }));
vi.mock('../../../venues/VenueCalendar', () => ({ VenueCalendar: ({ venue }: { venue: Venue }) => <p>Calendar: {venue.displayName}</p> }));
const venue = (id: number, extra = {}) => ({ id, displayName: `Venue ${id}`, city: 'Tbilisi', canManage: false, published: true, photos: [], amenities: [], openingHours: [], bookingMode: 'REQUEST', currency: 'GEL',
  pitches: [{ id: id * 10, name: 'Main pitch', active: true, pricePerHour: 90, format: '7_A_SIDE', surface: 'ARTIFICIAL_GRASS' }],
  capabilities: { enabledActivities: ['VENUE'], canConfigureVenue: false }, ...extra }) as unknown as Venue;
beforeEach(() => { vi.resetAllMocks(); vi.mocked(fetchVenue).mockImplementation(async id => venue(Number(id))); });
const open = (view: 'venues' | 'schedule' | 'prices' = 'venues') => render(<MemoryRouter><OrganizationVenues venues={[{ id: 1 }, { id: 2 }]} view={view} /></MemoryRouter>);
it('shows actual hourly prices and public actions without venue administration', async () => {
  open(); const card = await screen.findByRole('article', { name: 'Venue 1' });
  expect(within(card).getByText(/90/)).toBeInTheDocument(); expect(within(card).getByRole('link', { name: 'Check availability' })).toHaveAttribute('href', '/stadiums/1?book=1');
  expect(screen.queryByRole('link', { name: 'Manage venue' })).not.toBeInTheDocument(); expect(screen.queryByRole('link', { name: 'Requests' })).not.toBeInTheDocument();
});
it('uses each venue’s permission, not ownership of the parent organization', async () => {
  vi.mocked(fetchVenue).mockImplementation(async id => venue(Number(id), { canManage: id === 1 })); open(); await screen.findByRole('article', { name: 'Venue 2' });
  expect(screen.getAllByRole('link', { name: 'Manage venue' })).toHaveLength(1); expect(screen.getByRole('link', { name: 'Manage venue' })).toHaveAttribute('href', '/stadiums/1/manage');
});
it('excludes restricted venue content and unpublished venues from public scheduling', async () => {
  vi.mocked(fetchVenue).mockImplementation(async id => venue(Number(id), { promotionBlocked: id === 1, published: false })); open('schedule');
  expect(await screen.findByText(/Availability will appear/)).toBeInTheDocument(); expect(screen.queryByText(/Calendar:/)).not.toBeInTheDocument(); expect(screen.queryByText('Venue 1')).not.toBeInTheDocument();
});
it('switches the calendar to the selected venue', async () => {
  open('schedule'); const select = await screen.findByRole('combobox', { name: 'Venue' }); expect(screen.getByText('Calendar: Venue 1')).toBeInTheDocument();
  fireEvent.change(select, { target: { value: '2' } }); expect(screen.getByText('Calendar: Venue 2')).toBeInTheDocument(); expect(screen.queryByText('Calendar: Venue 1')).not.toBeInTheDocument();
});
it('keeps successful cards available while retrying a failed venue', async () => {
  vi.mocked(fetchVenue).mockImplementation(async id => { if (id === 2) throw Error('Unavailable'); return venue(Number(id)); }); open();
  await screen.findByRole('alert'); expect(screen.getByRole('article', { name: 'Venue 1' })).toBeInTheDocument();
  let complete!: (value: Venue) => void;
  vi.mocked(fetchVenue).mockClear().mockImplementation(() => new Promise(resolve => { complete = resolve; })); fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(screen.getByRole('article', { name: 'Venue 1' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Retrying unavailable venues');
  expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled();
  expect(fetchVenue).toHaveBeenCalledTimes(1); expect(fetchVenue).toHaveBeenCalledWith(2, expect.any(AbortSignal));
  await act(async () => complete(venue(2)));
  expect(await screen.findByRole('article', { name: 'Venue 2' })).toBeInTheDocument();
});
it.each(['venues', 'prices'] as const)('does not offer booking for inactive venue activity in %s', async view => {
  vi.mocked(fetchVenue).mockImplementation(async id => venue(Number(id), { capabilities: { enabledActivities: ['PROFILE'] } })); open(view);
  await screen.findByText('Venue 1');
  expect(screen.queryByRole('link', { name: /Check availability/ })).not.toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: /View venue/ })[0]).toHaveAttribute('href', '/stadiums/1');
});
it('does not retain another organization’s venue data after the IDs change', async () => {
  const result = open(); await screen.findByRole('article', { name: 'Venue 1' });
  vi.mocked(fetchVenue).mockImplementation(() => new Promise(() => {}));
  result.rerender(<MemoryRouter><OrganizationVenues venues={[{ id: 9 }]} view="venues" /></MemoryRouter>);
  expect(screen.queryByRole('article')).not.toBeInTheDocument(); expect(screen.getByRole('status')).toHaveTextContent('Loading venues');
});
