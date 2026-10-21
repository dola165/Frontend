import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MyVenueBookings } from './VenueBookings';
import { fetchBookingHistory, updateBooking, type Booking, type BookingHistory } from './api';
const auth = vi.hoisted(() => ({ isAuthenticated: true, sessionId: 'coach' }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('./api', async () => ({ ...(await vi.importActual('./api')), fetchBookingHistory: vi.fn(), updateBooking: vi.fn() }));
function booking(id: number, extra: Partial<Booking> = {}): Booking {
  return { id, venueId: 22, venueName: 'Synthetic stadium', pitchId: 9, pitchName: 'Main pitch', startsAt:'2020-01-01T12:00:00+04:00', endsAt:'2020-01-01T13:00:00+04:00', timezone:'Asia/Tbilisi', status:'CONFIRMED', kind:'RENTAL', totalPrice:100, currency:'GEL', contactName:'Synthetic actor', contactPhone:'', note:'', expiresAt:null, seriesId:null, canCancel:false, ...extra };
}
const history = (ids: number[], pageCursor: string, nextCursor: string | null): BookingHistory => ({ content:ids.map(id => booking(id)), pageCursor, nextCursor });
function mount() { return render(<MemoryRouter><MyVenueBookings/></MemoryRouter>); }
beforeEach(() => { vi.clearAllMocks(); auth.isAuthenticated=true; auth.sessionId='coach'; });

it('reaches the oldest page and navigates back with the returned stable anchors', async () => {
  vi.mocked(fetchBookingHistory).mockResolvedValueOnce(history([253,252],'first','second')).mockResolvedValueOnce(history([2,1],'second',null)).mockResolvedValueOnce(history([253,252],'first','second'));
  mount(); await screen.findByText('Booking #253'); fireEvent.click(screen.getByRole('button',{name:'Older reservations'}));
  await screen.findByText('Booking #1'); expect(screen.queryByText('Booking #253')).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Older reservations'})).toBeDisabled();
  expect(screen.getByText(/reached the oldest/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Newer reservations'})); await screen.findByText('Booking #253');
  expect(vi.mocked(fetchBookingHistory).mock.calls.map(call => call[0]?.cursor)).toEqual([undefined,'second','first']);
});
it('refreshes an older page in place and includes new bookings only after choosing Latest', async () => {
  vi.mocked(fetchBookingHistory).mockResolvedValueOnce(history([253],'first','second')).mockResolvedValueOnce(history([1],'second',null)).mockResolvedValueOnce(history([1],'second',null)).mockResolvedValueOnce(history([254],'new',null));
  mount(); await screen.findByText('Booking #253'); fireEvent.click(screen.getByRole('button',{name:'Older reservations'})); await screen.findByText('Booking #1');
  fireEvent.click(screen.getByRole('button',{name:'Refresh this page'})); await screen.findByText('Booking #1');
  expect(vi.mocked(fetchBookingHistory).mock.calls[2][0]?.cursor).toBe('second');
  fireEvent.click(screen.getByRole('button',{name:'Latest reservations'})); await screen.findByText('Booking #254');
  expect(vi.mocked(fetchBookingHistory).mock.calls[3][0]?.cursor).toBeUndefined();
});
it('sends complete-history filters to the server and keeps them on later pages', async () => {
  vi.mocked(fetchBookingHistory).mockResolvedValueOnce(history([253],'first','second')).mockResolvedValueOnce(history([2],'filtered','filtered-older')).mockResolvedValueOnce(history([1],'filtered-older',null));
  mount(); await screen.findByText('Booking #253');
  fireEvent.change(screen.getByRole('combobox',{name:'Status'}),{target:{value:'CANCELLED'}});
  fireEvent.change(screen.getByLabelText('Booking date from'),{target:{value:'2010-01-01'}});
  fireEvent.change(screen.getByLabelText('Booking date to'),{target:{value:'2020-01-01'}});
  fireEvent.click(screen.getByRole('button',{name:'Apply filters'})); await screen.findByText('Booking #2');
  fireEvent.click(screen.getByRole('button',{name:'Older reservations'})); await screen.findByText('Booking #1');
  expect(vi.mocked(fetchBookingHistory).mock.calls[2][0]).toMatchObject({cursor:'filtered-older',status:'CANCELLED',fromDate:'2010-01-01',toDate:'2020-01-01'});
});
it('reports a failed older-page request and retries its anchor instead of claiming empty history', async () => {
  vi.mocked(fetchBookingHistory).mockResolvedValueOnce(history([253],'first','second')).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(history([1],'second',null));
  mount(); await screen.findByText('Booking #253');fireEvent.click(screen.getByRole('button',{name:'Older reservations'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('could not load');expect(screen.queryByText('No reservations found')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Retry'}));await screen.findByText('Booking #1');
  expect(vi.mocked(fetchBookingHistory).mock.calls[2][0]?.cursor).toBe('second');
});
it('retains visible receipts and explains a background failure without replacing them with an empty state', async () => {
  vi.mocked(fetchBookingHistory).mockResolvedValueOnce(history([1],'first',null)).mockRejectedValueOnce(new Error('offline'));
  mount();await screen.findByText('Booking #1');fireEvent.focus(window);
  await screen.findByRole('alert');expect(screen.getByText('Booking #1')).toBeInTheDocument();
  expect(vi.mocked(fetchBookingHistory).mock.calls[1][0]?.cursor).toBe('first');
});
it('aborts and clears an old account immediately and ignores its delayed history response', async () => {
  let finish!: (value: BookingHistory) => void;
  vi.mocked(fetchBookingHistory).mockResolvedValueOnce(history([253],'first','second')).mockImplementationOnce(()=>new Promise(resolve => { finish=resolve; })).mockResolvedValueOnce(history([99],'other',null));
  const view=mount();await screen.findByText('Booking #253');fireEvent.click(screen.getByRole('button',{name:'Older reservations'}));
  await waitFor(()=>expect(fetchBookingHistory).toHaveBeenCalledTimes(2));auth.sessionId='other';view.rerender(<MemoryRouter><MyVenueBookings/></MemoryRouter>);
  expect(screen.queryByText('Booking #253')).not.toBeInTheDocument();await screen.findByText('Booking #99');
  expect(vi.mocked(fetchBookingHistory).mock.calls[1][1]?.aborted).toBe(true);
  await act(async()=>finish(history([1],'second',null)));expect(screen.queryByText('Booking #1')).not.toBeInTheDocument();
});
it('keeps customer cancellation confirmation and refreshes the same history page after success', async () => {
  const future=booking(7,{startsAt:new Date(Date.now()+86400000*20).toISOString(),endsAt:new Date(Date.now()+86400000*20+3600000).toISOString(),canCancel:true});
  vi.mocked(fetchBookingHistory).mockResolvedValueOnce({content:[future],pageCursor:'first',nextCursor:null}).mockResolvedValueOnce({content:[{...future,status:'CANCELLED',canCancel:false}],pageCursor:'first',nextCursor:null});
  vi.mocked(updateBooking).mockResolvedValue({...future,status:'CANCELLED',canCancel:false});
  mount();await screen.findByText('Booking #7');fireEvent.click(screen.getByRole('button',{name:'Cancel reservation'}));
  expect(updateBooking).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Yes, cancel'}));
  await waitFor(()=>expect(updateBooking).toHaveBeenCalledWith(22,7,'CANCEL'));await screen.findByText('cancelled');
  expect(vi.mocked(fetchBookingHistory).mock.calls[1][0]?.cursor).toBe('first');expect(screen.queryByRole('button',{name:'Cancel reservation'})).not.toBeInTheDocument();
});
it('offers sign-in and explains empty filtered results without claiming a successful failed load', async () => {
  vi.mocked(fetchBookingHistory).mockResolvedValue(history([],'empty',null));const view=mount();await screen.findByText('No reservations found');
  auth.isAuthenticated=false;view.rerender(<MemoryRouter><MyVenueBookings/></MemoryRouter>);expect(screen.getByRole('link',{name:'Sign in'})).toHaveAttribute('href','/login');
});
