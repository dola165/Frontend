import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { StadiumWorkspacePage } from '../../pages/StadiumWorkspacePage';
import { StadiumProfilePage } from '../../pages/StadiumProfilePage';
import { fetchVenue, fetchVenueBookings, type Venue } from './api';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'owner' }) }));
vi.mock('./api', async () => ({ ...(await vi.importActual('./api')), fetchVenue: vi.fn(), fetchVenueBookings: vi.fn() }));
vi.mock('./VenueMap', () => ({ VenueMap: () => <div>Public map</div> }));
vi.mock('./VenueCalendar', () => ({ VenueCalendar: () => <div>Public booking calendar</div> }));
vi.mock('./VenueEditors', () => ({ VenueListingEditor: () => <div>Public listing editor</div>, VenuePitchEditor: () => <div>Operational pitch editor</div> }));

const venue: Venue = {
  id: 22, revision: 1, displayName: 'Private operating identity', description: 'Promotional description', city: 'Tbilisi', addressText: 'Address',
  latitude: 41, longitude: 44, timezone: 'Asia/Tbilisi', currency: 'GEL', publicPhone: '', publicEmail: '', website: 'https://example.com',
  bookingMode: 'REQUEST', published: true, cancellationHours: 24, minBookingMinutes: 60, maxBookingMinutes: 180, slotMinutes: 30,
  amenities: [], photos: [{ url: '/uploads/restricted.jpg', caption: 'Promotion' }], openingHours: [], pitches: [], canManage: true, verificationStatus: 'UNVERIFIED',
  contentClassification: 'RESTRICTED', contentRevision: 2, promotionBlocked: true,
  capabilities: { enabledActivities: ['PROFILE', 'VENUE'], revision: 0, venueAvailable: true, canConfigureActivities: true,
    canEditProfile: true, canConfigureVenue: true, canManageVenueBookings: true, canCreateTournament: false, canInviteVenueOperator: true },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchVenue).mockResolvedValue(venue);
  vi.mocked(fetchVenueBookings).mockResolvedValue([]);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
function open(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/stadiums/:organizationId/manage" element={<StadiumWorkspacePage/>}/>
    <Route path="/stadiums/:organizationId" element={<StadiumProfilePage/>}/>
  </Routes></MemoryRouter>);
}
it('keeps operations available while removing blocked publication controls and misleading published status', async () => {
  open('/stadiums/22/manage');
  expect(await screen.findByText('Public promotion restricted')).toBeVisible();
  expect(screen.queryByText('Published')).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'View stadium' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Stadium page' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Calendar & reservations' }));
  expect(screen.getByRole('button', { name: 'Add booking or closure' })).toBeDisabled(); // No pitch exists yet.
  fireEvent.click(screen.getByRole('button', { name: 'Pitches' }));
  expect(screen.getByText('Operational pitch editor')).toBeVisible();
});
it.each(['/stadiums/22', '/stadiums/22?book=1'])('never mounts promotional media or booking for a blocked private response on %s', async (path) => {
  const { container } = open(path);
  expect(await screen.findByRole('heading', { name: 'Public promotion restricted' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Manage stadium' })).toHaveAttribute('href', '/stadiums/22/manage');
  expect(container.querySelector('img')).toBeNull();
  expect(screen.queryByText('Public booking calendar')).not.toBeInTheDocument();
  expect(screen.queryByText('Promotional description')).not.toBeInTheDocument();
  expect(screen.queryByText('Public map')).not.toBeInTheDocument();
});
it('preserves existing unreviewed visibility and publication controls', async () => {
  vi.mocked(fetchVenue).mockResolvedValue({ ...venue, contentClassification: 'UNREVIEWED', contentRevision: 0, promotionBlocked: false });
  open('/stadiums/22/manage');
  expect(await screen.findByText('Published')).toBeVisible();
  expect(screen.getByRole('link', { name: 'View stadium' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Stadium page' }));
  expect(screen.getByText('Public listing editor')).toBeVisible();
});
