import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { bookingsOnDate, currentStatus, needsDecision, setupChecks } from './ownerWorkflow';
import { fetchVenue, fetchVenueBookings, updateBooking, type Booking, type Venue } from './api';
import { BookingRows } from './VenueBookings';
import { VenueOwnerHome, VenueRequestInbox, VenueSetup } from './VenueOwnerHome';
import { VenueOperations } from './VenueOperations';
import { useOwnerBookings } from './useOwnerBookings';
import { StadiumWorkspacePage } from '../../pages/StadiumWorkspacePage';
import { addDays, today, zonedInstant } from './utils';

vi.mock('./api', async () => ({ ...(await vi.importActual('./api')), fetchVenue: vi.fn(), fetchVenueBookings: vi.fn(), updateBooking: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'owner' }) }));
vi.mock('./VenueMap', () => ({ VenueMap: () => <div>Map</div> }));
const venue: Venue = {
  id: 22, revision: 1, displayName: 'Test venue', description: 'Football pitches', city: 'Tbilisi', addressText: 'Entrance 1', latitude: 41, longitude: 44, timezone: 'Asia/Tbilisi', currency: 'GEL', publicPhone: '555000111', publicEmail: '', website: '', bookingMode: 'REQUEST', published: false, cancellationHours: 24, minBookingMinutes: 60, maxBookingMinutes: 180, slotMinutes: 30, amenities: [], photos: [{url:'/cover.jpg',caption:''}], openingHours: [{dayOfWeek:1,opensAt:'08:00',closesAt:'23:00'}], canManage: true, verificationStatus: 'UNVERIFIED',
  pitches: [{id:9,revision:1,name:'Main pitch',format:'5_A_SIDE',surface:'ARTIFICIAL_GRASS',covered:false,pricePerHour:80,active:true,resourceGroup:'main',resourceUnits:['left','right']}],
  capabilities: { enabledActivities:['PROFILE','VENUE'], revision:1, venueAvailable:true, canConfigureVenue:true, canManageVenueBookings:true, canEditProfile:true, canConfigureActivities:true, canCreateTournament:false, canInviteVenueOperator:true },
};
function booking(changes: Partial<Booking> = {}): Booking {
  return { id:1,venueId:22,venueName:'Test venue',pitchId:9,pitchName:'Main pitch',startsAt:new Date(Date.now()+86400000).toISOString(),endsAt:new Date(Date.now()+90000000).toISOString(),status:'PENDING',kind:'RENTAL',totalPrice:80,currency:'GEL',contactName:'Evening team',contactPhone:'555111222',note:'',expiresAt:new Date(Date.now()+3600000).toISOString(),seriesId:null,canCancel:true,...changes };
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(fetchVenue).mockResolvedValue(venue); vi.mocked(fetchVenueBookings).mockResolvedValue([]); vi.mocked(updateBooking).mockResolvedValue(booking({status:'CONFIRMED'})); });

it('includes an overnight entry on both days and excludes the exact end boundary', () => {
  const b = booking({ startsAt:'2026-09-22T23:00:00+04:00', endsAt:'2026-09-23T01:00:00+04:00' });
  expect(bookingsOnDate([b], '2026-09-22', venue.timezone)).toEqual([b]);
  expect(bookingsOnDate([b], '2026-09-23', venue.timezone)).toEqual([b]);
  expect(bookingsOnDate([{...b,endsAt:'2026-09-23T00:00:00+04:00'}], '2026-09-23', venue.timezone)).toEqual([]);
});
it('never offers an expired or already started request for a decision', () => {
  const b = booking({expiresAt:new Date(Date.now()-1000).toISOString()});
  expect(currentStatus(b)).toBe('EXPIRED'); expect(needsDecision(b)).toBe(false);
  expect(needsDecision(booking({startsAt:new Date(Date.now()-1000).toISOString()}))).toBe(false);
});
it('derives setup checks from saved facts without treating publication as completed setup', () => {
  expect(setupChecks(venue).every(c => c.ready)).toBe(true);
  expect(setupChecks({...venue,published:true,publicPhone:'',pitches:[]}).filter(c => !c.ready)).toHaveLength(2);
});
it('splits the complete booking horizon into bounded requests and deduplicates crossing records', async () => {
  const b = booking(); vi.mocked(fetchVenueBookings).mockResolvedValue([b]);
  const {result} = renderHook(() => useOwnerBookings(22,venue.timezone,today(venue.timezone),181));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(fetchVenueBookings).toHaveBeenCalledTimes(3);
  for (const call of vi.mocked(fetchVenueBookings).mock.calls) expect((Date.parse(call[2])-Date.parse(call[1]))/86400000).toBeLessThanOrEqual(91);
  expect(result.current.bookings).toEqual([b]);
});
it('does not report an empty successful inbox when one range fails', async () => {
  vi.mocked(fetchVenueBookings).mockResolvedValueOnce([booking()]).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
  const {result} = renderHook(() => useOwnerBookings(22,venue.timezone,today(venue.timezone),181));
  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(result.current.bookings).toEqual([]);
});
it('aborts old loads and clears results when the venue scope changes', async () => {
  vi.mocked(fetchVenueBookings).mockResolvedValue([booking()]);
  const {result,rerender} = renderHook(({id}) => useOwnerBookings(id,venue.timezone,today(venue.timezone),7), {initialProps:{id:22}});
  await waitFor(() => expect(result.current.bookings).toHaveLength(1));
  let resolve!: (b: Booking[]) => void;
  vi.mocked(fetchVenueBookings).mockReturnValue(new Promise(r => {resolve=r;}));
  rerender({id:23});
  expect(result.current.bookings).toEqual([]); expect(vi.mocked(fetchVenueBookings).mock.calls[0][3]?.aborted).toBe(true);
  await act(async () => resolve([]));
});
it('requires explicit review before accepting a request', async () => {
  const changed = vi.fn(); render(<MemoryRouter><BookingRows owner timezone={venue.timezone} bookings={[booking()]} onChange={changed}/></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Accept'}));
  expect(updateBooking).not.toHaveBeenCalled(); expect(screen.getByRole('region',{name:'Review booking decision'})).toHaveTextContent('in-app reservation update');
  fireEvent.click(screen.getByRole('button',{name:'Confirm booking'}));
  await waitFor(() => expect(updateBooking).toHaveBeenCalledWith(22,1,'ACCEPT')); expect(changed).toHaveBeenCalledTimes(1);
});
it('reviews a closure removal as one occurrence and sends no action when kept unchanged', () => {
  render(<MemoryRouter><BookingRows owner bookings={[booking({kind:'CLOSURE',status:'CONFIRMED',seriesId:'weekly'})]} onChange={vi.fn()}/></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Remove closure'}));
  expect(screen.getByRole('region')).toHaveTextContent('Only this date changes');
  fireEvent.click(screen.getByRole('button',{name:'Keep unchanged'})); expect(updateBooking).not.toHaveBeenCalled();
});
it('preserves a failed decision for retry and never reports success', async () => {
  vi.mocked(updateBooking).mockRejectedValue(new Error('offline'));
  render(<MemoryRouter><BookingRows owner bookings={[booking()]} onChange={vi.fn()}/></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Decline'})); fireEvent.click(screen.getByRole('button',{name:'Yes, decline'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be updated'); expect(screen.getByRole('button',{name:'Yes, decline'})).toBeEnabled(); expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it('does not offer owner actions on past bookings or expired requests', () => {
  render(<MemoryRouter><BookingRows owner bookings={[booking({startsAt:new Date(Date.now()-1000).toISOString(),status:'CONFIRMED'}),booking({id:2,expiresAt:new Date(Date.now()-1000).toISOString()})]} onChange={vi.fn()}/></MemoryRouter>);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('finds requests beyond a week and puts the first expiry first', async () => {
  const later = booking({id:2,contactName:'Later deadline',expiresAt:new Date(Date.now()+7200000).toISOString()});
  const urgent = booking({id:3,contactName:'Urgent future game',startsAt:new Date(Date.now()+80*86400000).toISOString()});
  vi.mocked(fetchVenueBookings).mockResolvedValue([later,urgent]);
  render(<MemoryRouter><VenueRequestInbox venue={venue} active/></MemoryRouter>);
  await screen.findByRole('heading',{name:'Urgent future game'});
  expect(screen.getAllByRole('article')[0]).toHaveTextContent('Urgent future game');
  expect(screen.getAllByRole('article')).toHaveLength(2);
});
it('opens exactly the incomplete setup section and makes no writes', () => {
  const navigate = vi.fn(); render(<MemoryRouter><VenueSetup venue={{...venue,publicPhone:''}} navigate={navigate} add={vi.fn()}/></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:/Help teams arrive/})); expect(navigate).toHaveBeenCalledWith('listing',1); expect(updateBooking).not.toHaveBeenCalled();
});
it('shows weekly and historical records without treating missing entries as free availability', async () => {
  const date = addDays(today(venue.timezone),1), b = booking({startsAt:zonedInstant(date,'15:00',venue.timezone),endsAt:zonedInstant(date,'16:00',venue.timezone),status:'CANCELLED'});
  vi.mocked(fetchVenueBookings).mockResolvedValue([b]);
  render(<MemoryRouter><VenueOperations venue={venue} active date={date} setDate={vi.fn()} add={vi.fn()} revision={0}/></MemoryRouter>);
  await screen.findByRole('heading',{name:'Your calendar is clear here'});
  expect(screen.getByText(/Opening hours and shared pitch space/)).toBeVisible();
  fireEvent.click(screen.getByLabelText('Include cancelled, declined & expired'));
  expect(screen.getByRole('article')).toHaveTextContent('cancelled');
  fireEvent.click(screen.getByRole('button',{name:'Week'})); expect(screen.getByLabelText('Week at a glance').children).toHaveLength(7);
});
it('gives delegated operators daily tools without owner configuration controls', async () => {
  vi.mocked(fetchVenue).mockResolvedValue({...venue,capabilities:{...venue.capabilities!,canConfigureVenue:false,canConfigureActivities:false,canEditProfile:false,canInviteVenueOperator:false}});
  render(<MemoryRouter initialEntries={['/stadiums/22/manage?view=setup']}><Routes><Route path="/stadiums/:organizationId/manage" element={<StadiumWorkspacePage/>}/></Routes></MemoryRouter>);
  await screen.findByRole('heading',{name:'Test venue'});
  expect(screen.getByRole('button',{name:'Overview'})).toHaveAttribute('aria-pressed','true');
  expect(screen.queryByRole('button',{name:'Stadium page'})).not.toBeInTheDocument(); expect(screen.queryByRole('button',{name:'Setup & handover'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Pitches'})).not.toBeInTheDocument();
  expect(screen.queryByRole('link',{name:/Organization|Activities & venue team/})).not.toBeInTheDocument();
  expect(screen.queryByText('Your venue', {exact:true})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Requests'})); await screen.findByRole('heading',{name:'Booking requests'});
});

it('denies the workspace when current capabilities withdraw operations despite a legacy canManage flag', async () => {
  vi.mocked(fetchVenue).mockResolvedValue({...venue,capabilities:{...venue.capabilities!,canManageVenueBookings:false}});
  render(<MemoryRouter initialEntries={['/stadiums/22/manage?view=calendar']}><Routes><Route path="/stadiums/:organizationId/manage" element={<StadiumWorkspacePage/>}/></Routes></MemoryRouter>);
  await screen.findByRole('heading',{name:'This workspace belongs to the venue team'});
  expect(fetchVenueBookings).not.toHaveBeenCalled();
});

it('gives a new owner an actionable setup step and a direct draft preview', async () => {
  const navigate = vi.fn();
  render(<MemoryRouter><VenueOwnerHome venue={{...venue,photos:[],pitches:[]}} active navigate={navigate} add={vi.fn()}/></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Continue setup'}));
  expect(navigate).toHaveBeenCalledWith('listing',0);
  expect(screen.getByRole('link',{name:'Preview venue page'})).toHaveAttribute('href','/stadiums/22');
  fireEvent.click(screen.getByRole('button',{name:'Add your first pitch'}));
  expect(navigate).toHaveBeenLastCalledWith('pitches');
  await waitFor(() => expect(screen.queryByText('Checking upcoming requests…')).not.toBeInTheDocument());
});

it('connects saved pitches to their public preview without exposing inactive pitches', async () => {
  render(<MemoryRouter><VenueOwnerHome venue={{...venue,pitches:[{...venue.pitches[0],photoUrl:'/uploads/pitch.jpg'},{...venue.pitches[0],id:10,name:'Closed pitch',active:false}]}} active navigate={vi.fn()} add={vi.fn()}/></MemoryRouter>);
  expect(screen.getByRole('link',{name:'Preview on venue page →'})).toHaveAttribute('href','/stadiums/22#pitch-9');
  expect(screen.getByRole('heading',{name:'Closed pitch'})).toBeVisible();
  await waitFor(() => expect(screen.queryByText('Checking upcoming requests…')).not.toBeInTheDocument());
});
