import type { Booking, Venue } from './api';
import { addDays, zonedInstant } from './utils';

export type OwnerView = 'overview' | 'calendar' | 'requests' | 'listing' | 'pitches' | 'setup';
export function ownerView(value: string | null): OwnerView {
  return ['overview', 'calendar', 'requests', 'listing', 'pitches', 'setup'].includes(value || '') ? value as OwnerView : 'overview';
}
export function localDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}
export function currentStatus(booking: Booking, now = Date.now()) {
  return booking.status === 'PENDING' && booking.expiresAt && Date.parse(booking.expiresAt) <= now ? 'EXPIRED' : booking.status;
}
export function needsDecision(booking: Booking, now = Date.now()) {
  return currentStatus(booking, now) === 'PENDING' && Date.parse(booking.startsAt) > now;
}
export function bookingsOnDate(bookings: Booking[], date: string, timezone: string) {
  const from = Date.parse(zonedInstant(date, '00:00', timezone));
  const to = Date.parse(zonedInstant(addDays(date, 1), '00:00', timezone));
  return bookings.filter(b => Date.parse(b.startsAt) < to && Date.parse(b.endsAt) > from);
}
export function requestOrder(a: Booking, b: Booking) {
  return Date.parse(a.expiresAt || a.startsAt) - Date.parse(b.expiresAt || b.startsAt) || Date.parse(a.startsAt) - Date.parse(b.startsAt);
}
export function matchesBooking(booking: Booking, query: string) {
  return [booking.contactName, booking.contactPhone, booking.pitchName, booking.note, String(booking.id)]
    .some(value => (value || '').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
}
export function setupChecks(venue: Venue) {
  return [
    { title: 'Introduce your venue', detail: 'Name, cover photo and a useful description.', ready: !!venue.displayName?.trim() && !!venue.description?.trim() && venue.photos.length > 0, view: 'listing' as OwnerView, step: 0 },
    { title: 'Help teams arrive', detail: 'Street address, entrance pin and the phone someone answers.', ready: !!venue.city?.trim() && !!venue.addressText?.trim() && venue.latitude != null && venue.longitude != null && !!venue.publicPhone?.trim(), view: 'listing' as OwnerView, step: 1 },
    { title: 'Map your bookable pitches', detail: 'Active pitches, hourly rates and shared space.', ready: venue.pitches.some(p => p.active), view: 'pitches' as OwnerView },
    { title: 'Set your hours and rules', detail: 'Opening hours, booking length, confirmation and cancellation notice.', ready: venue.openingHours.length > 0, view: 'listing' as OwnerView, step: 2 },
  ];
}
