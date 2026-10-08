import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import type { Booking } from '../../features/venues/api';
import { notificationId } from '../../utils/notificationDestinations';

/** The API rechecks current customer/manager access, independently of the inbox. */
export function BookingNotificationTarget({ venueId, bookingId, onClose }: {
    venueId: string; bookingId: string; onClose: () => void;
}) {
    const [result, setResult] = useState<{ key: string; booking?: Booking; error?: string } | null>(null);
    const [retry, setRetry] = useState(0);
    const key = `${venueId}:${bookingId}:${retry}`;
    const valid = notificationId(venueId) != null && notificationId(bookingId) != null;
    useEffect(() => {
        if (!valid) return;
        const controller = new AbortController();
        void apiClient.get<Booking>(`/venues/${venueId}/bookings/${bookingId}`, { signal: controller.signal }).then(({ data }) => {
            if (!controller.signal.aborted) setResult({ key, ...(String(data.id) === bookingId && String(data.venueId) === venueId
                ? { booking: data } : { error: 'This reservation is unavailable.' }) });
        }).catch((error: { response?: { status?: number } }) => {
            if (!controller.signal.aborted) setResult({ key, error: [403, 404, 410].includes(error.response?.status ?? 0)
                ? 'This reservation is unavailable or you no longer have access.'
                : 'We could not load this reservation. Please try again.' });
        });
        return () => controller.abort();
    }, [bookingId, key, valid, venueId]);
    const current = !valid ? { error: 'This notification destination is unavailable.' } : result?.key === key ? result : null;
    const booking = current && 'booking' in current ? current.booking : undefined;
    return <section aria-label="Reservation notification destination" className="shrink-0 border-b theme-border p-4">
        <div className="flex items-start justify-between gap-4">
            <h2 className="font-bold">Reservation {booking ? `#${booking.id} · ${booking.venueName}` : 'details'}</h2>
            <button type="button" onClick={onClose} className="app-text-action">Close details</button>
        </div>
        {!current && <p role="status">Loading reservation…</p>}
        {current?.error && <div role="alert"><p>{current.error}</p>{valid && <button type="button" className="app-text-action" onClick={() => setRetry(value => value + 1)}>Try again</button>}</div>}
        {booking && <>
            <p>{booking.status} · {booking.pitchName}</p>
            <p><time dateTime={booking.startsAt}>{new Date(booking.startsAt).toLocaleString(undefined, { timeZone: booking.timezone })}</time> – <time dateTime={booking.endsAt}>{new Date(booking.endsAt).toLocaleString(undefined, { timeZone: booking.timezone })}</time>{booking.timezone && ` (${booking.timezone})`}</p>
            <p>{booking.totalPrice} {booking.currency}</p>
            <Link className="app-text-action" to="/stadiums?tab=bookings">My reservations</Link>
        </>}
    </section>;
}
