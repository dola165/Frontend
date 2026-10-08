import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { StadiumProfilePage } from '../../pages/StadiumProfilePage';
import { fetchVenue, type Venue } from './api';
import { VenueOrganizations } from './VenueOrganizations';
import { linkedVenueId } from './venueMapLink';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'coach' }) }));
vi.mock('./api', async () => ({ ...(await vi.importActual('./api')), fetchVenue: vi.fn() }));
vi.mock('./VenueMap', () => ({ VenueMap: () => <div>Embedded map</div> }));
vi.mock('./VenueCalendar', () => ({ VenueCalendar: () => <div>Booking calendar</div> }));
const venue: Venue = { id: 123, revision: 0, displayName: 'Isani Futsal Hall', description: '', city: 'Tbilisi', addressText: 'Isani',
    latitude: 41.72, longitude: 44.8, timezone: 'Asia/Tbilisi', currency: 'GEL', publicPhone: '', publicEmail: '', website: '',
    bookingMode: 'INSTANT', published: true, cancellationHours: 24, minBookingMinutes: 60, maxBookingMinutes: 180, slotMinutes: 30,
    amenities: [], photos: [], openingHours: [], pitches: [], canManage: false, verificationStatus: 'UNVERIFIED',
    organizations: [{ id: 17, displayName: 'City Football Group', clubId: null, logoUrl: null, relationships: ['OWNS', 'OPERATES'], declared: true }] };
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); vi.mocked(fetchVenue).mockResolvedValue(venue); });
it('opens the recorded organization portfolio and prices without confusing public identity with management', async () => {
    render(<MemoryRouter initialEntries={['/stadiums/123']}><Routes><Route path="/stadiums/:organizationId" element={<StadiumProfilePage />} /></Routes></MemoryRouter>);
    expect(await screen.findByText('Listed owner and operator')).toBeVisible();
    expect(screen.getByRole('link', { name: 'View all venues' })).toHaveAttribute('href', '/organizations/17?tab=venues');
    expect(screen.getByRole('link', { name: 'Compare prices' })).toHaveAttribute('href', '/organizations/17?tab=prices');
    expect(screen.getByRole('link', { name: 'Open in GrassKickZ Map' })).toHaveAttribute('href', '/map?venue=123');
    expect(screen.queryByRole('link', { name: 'Manage stadium' })).not.toBeInTheDocument();
});
it('labels a legacy operator accurately and uses the existing club facilities profile', () => {
    render(<MemoryRouter><VenueOrganizations venue={{ ...venue, organizations: [{ id: 2, displayName: 'Dinamo', clubId: 1, logoUrl: null, relationships: ['OPERATES'], declared: false }] }} /></MemoryRouter>);
    expect(screen.getByText('Operated by')).toBeVisible();
    expect(screen.getByRole('link', { name: 'View club facilities' })).toHaveAttribute('href', '/clubs/1?tab=facilities');
    expect(screen.queryByText(/owner/i)).not.toBeInTheDocument();
});
it.each(['?venue=0', '?venue=-1', '?venue=1.2', '?venue=9007199254740992', '?venue=bad', ''])('ignores an invalid map resource ID %s', value => expect(linkedVenueId(value)).toBeNull());
it('accepts a shareable venue URL without accepting supplied coordinates or identity text', () => expect(linkedVenueId('?venue=123&lat=0&name=spoof')).toBe(123));
