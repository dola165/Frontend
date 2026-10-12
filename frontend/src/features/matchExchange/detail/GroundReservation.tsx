import { useState } from 'react';
import { Link } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { Dialog } from '../../../design/Dialog';
import { Button, EmptyNote, Skeleton } from '../../../design/primitives';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { changeImpactFrom, hasBlockingAttention, type ChangeImpact, type Match } from '../api';
import { useLoad } from '../hooks';
import { MatchChangeImpact } from '../MatchChangeImpact';
import { linkReservation, moveGround, previewGround, reservationIssue, shareReservation, type MatchReservation } from '../reservations';
import './reservations.css';

const when = (iso: string, zone: string, parts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { ...parts, timeZone: zone }).format(new Date(iso));
const span = (r: MatchReservation, zone: string) =>
    `${when(r.startsAt, zone, { weekday: 'short', day: 'numeric', month: 'short' })} · ${when(r.startsAt, zone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}–${when(r.endsAt, zone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`;

/**
 * Using a pitch reservation for a match, as a step on the match page: your coming reservations (and those shared with
 * your club), each with why it cannot be used in words, or its one action. One at the match's own ground is linked by
 * either club; one elsewhere moves the match there, by the host only, after seeing who is told. The ones it can use come
 * first; one you booked can be shared with your own club's staff. A match that already holds a live reservation keeps it.
 */
export function GroundReservation({ match: m, onClose, reload }: { match: Match; onClose: () => void; reload: () => void }) {
    const squadId = m.can_manage ? m.squad_id : m.target_squad_id;
    const clubId = m.can_manage ? m.club_id : m.opponent_club_id;
    const clubName = m.can_manage ? m.club_name : m.opponent_name;
    const list = useLoad<MatchReservation[]>(squadId ? `/match-arrangements/bookings?squadId=${squadId}` : '');
    const live = m.booking && ['CONFIRMED', 'PENDING'].includes(m.booking.status);
    const [moving, setMoving] = useState<{ id: number; requestId: string; impact?: ChangeImpact } | null>(null);
    const [busy, setBusy] = useState(false);
    const [said, setSaid] = useState<{ text: string; error?: boolean } | null>(null);

    const act = async (action: () => Promise<unknown>, done: string) => {
        setBusy(true); setSaid(null);
        try { await action(); setMoving(null); setSaid({ text: done }); reload(); list.reload(); }
        catch (error) {
            const impact = changeImpactFrom(error);
            if (impact && moving) { setMoving({ ...moving, impact }); return; }
            setSaid({ text: extractApiErrorMessage(error, 'The ground could not be updated. Try again.'), error: true });
            if (isAxiosError(error) && error.response?.status === 409) { reload(); list.reload(); }
        } finally { setBusy(false); }
    };
    const preview = async (reservation: MatchReservation) => {
        const requestId = crypto.randomUUID();
        setBusy(true); setSaid(null);
        try { setMoving({ id: reservation.id, requestId, impact: await previewGround(m, reservation.id, requestId) }); }
        catch (error) { setSaid({ text: extractApiErrorMessage(error, 'The change could not be previewed. Try again.'), error: true }); }
        finally { setBusy(false); }
    };

    const row = (reservation: MatchReservation) => {
        const issue = reservationIssue(reservation, m);
        const here = reservation.venueId === m.venue_id;
        const review = moving?.id === reservation.id ? moving : null;
        const blocked = review?.impact ? hasBlockingAttention(review.impact) : false;
        // Sharing is offered only where it helps this match: on a reservation it can use.
        const shareable = !issue && reservation.canAllocate && reservation.allocatedClubId == null && reservation.status === 'CONFIRMED' && clubId != null;
        return (
            <li key={reservation.id} className="gk-reserve__row" data-unusable={issue ? true : undefined}>
                <span className="gk-reserve__text">
                    <strong>{reservation.venueName} · {reservation.pitchName}</strong>
                    <small>{span(reservation, m.timezone)} · {reservation.totalPrice} {reservation.currency}</small>
                    {issue && <small className="gk-reserve__why">{issue}</small>}
                </span>
                {!issue && !live && <span className="gk-reserve__act">
                    {here ? <Button size="sm" variant="primary" disabled={busy} onClick={() => void act(() => linkReservation(m, reservation.id), 'The reservation now holds this match.')}>Use for this match</Button>
                        : m.can_manage ? !review && <Button size="sm" disabled={busy} onClick={() => void preview(reservation)}>Move the match here</Button>
                            : <small className="gk-faint">Only {m.club_name} can move the match</small>}
                </span>}
                {shareable && <button type="button" className="gk-reserve__share" disabled={busy}
                    onClick={() => void act(() => shareReservation(reservation.id, clubId!), `${clubName ?? 'Your club'} staff can now use this reservation.`)}>Share with {clubName ?? 'your club'} staff</button>}
                {review?.impact && <div className="gk-reserve__review">
                    <MatchChangeImpact impact={review.impact} />
                    <div className="gk-reserve__actions">
                        <Button size="sm" variant="primary" disabled={busy || blocked}
                            onClick={() => void act(() => moveGround(m, reservation.id, review.requestId, review.impact?.confirmationToken), `The match moved to ${reservation.venueName}.`)}>
                            {m.opponent_name ? `Move the match and tell ${m.opponent_name}` : 'Move the match'}
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMoving(null)}>Keep the current ground</Button>
                    </div>
                </div>}
            </li>
        );
    };

    const book = m.venue_id ? `/stadiums/${m.venue_id}?book=1&date=${m.starts_at.slice(0, 10)}` : '/world/venues';
    return (
        <Dialog open size="sheet" title="Use a reservation" description={`${m.title} · ${m.location_name || 'Ground to be arranged'}`} onClose={onClose}
            footer={<div className="gk-reserve__links"><Link to={book}>{m.venue_id ? 'Book this ground for the match' : 'Find a pitch to book'}</Link><Link to="/world/venues?tab=bookings">My reservations</Link></div>}>
            <div className="gk gk-reserve">
                {live && <p className="gk-reserve__live">This match already holds a reservation ({m.booking!.status === 'PENDING' ? 'waiting for the venue' : 'confirmed'}).
                    Change or cancel it at the venue before using another. <Link to={`/stadiums/${m.booking!.venue_id}`}>Open the venue</Link></p>}
                {list.error ? <EmptyNote title="Your reservations could not load" action={<Button size="sm" onClick={list.reload}>Try again</Button>}>{list.error}</EmptyNote>
                    : !list.data ? <div className="gk-stack gk-stack--tight" role="status" aria-label="Loading your reservations"><Skeleton height={52} /><Skeleton height={52} /></div>
                        : list.data.length === 0 ? <EmptyNote title="No reservations to use">Book a pitch, and once the venue confirms it, use it here for this match.</EmptyNote>
                            : <ul className="gk-reserve__list" aria-label="Your reservations">{[...list.data].sort((a, b) => Number(Boolean(reservationIssue(a, m))) - Number(Boolean(reservationIssue(b, m)))).map(row)}</ul>}
                {said && <p className={said.error ? 'gk-notice gk-notice--danger' : 'gk-notice'} role={said.error ? 'alert' : 'status'}>{said.text}</p>}
                <p className="gk-faint gk-reserve__note">A reservation must cover the whole match and suit its format. Sharing one shows its pitch, time and price to your club’s staff, never your phone or notes.</p>
            </div>
        </Dialog>
    );
}
