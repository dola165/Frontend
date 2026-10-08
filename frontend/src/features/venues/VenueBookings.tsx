import { EmptyState } from '../../components/ui/EmptyState';
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Check, Clock3, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { extractApiErrorMessage } from "../../utils/apiError";
import { fetchBookingHistory, updateBooking, type Booking, type BookingHistory } from "./api";
import { bookingDate, money } from "./utils";
import { currentStatus, needsDecision } from "./ownerWorkflow";
import './venue-owner.css';

export function BookingRows({
  bookings,
  owner = false,
  timezone,
  onChange,
}: {
  bookings: Booking[];
  owner?: boolean;
  timezone?: string;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState<number | null>(null),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState<{ id: number; action: "ACCEPT" | "DECLINE" | "CANCEL" } | null>(null),
    [receipt, setReceipt] = useState(""), [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  const submitting = useRef(false);
  const act = async (
    booking: Booking,
    action: "ACCEPT" | "DECLINE" | "CANCEL",
  ) => {
    if (submitting.current) return;
    if (Date.parse(booking.startsAt) <= Date.now() || !['PENDING','CONFIRMED'].includes(currentStatus(booking)) || (action !== 'CANCEL' && !needsDecision(booking))) {
      setError('This entry can no longer be changed here. Refresh the calendar to see its current status.'); return;
    }
    submitting.current = true;
    setBusy(booking.id);
    setError("");
    try {
      await updateBooking(booking.venueId, booking.id, action);
      setConfirm(null);
      setReceipt(`${booking.kind === 'CLOSURE' ? 'Closure' : 'Booking'} #${booking.id} ${action === 'ACCEPT' ? 'confirmed' : action === 'DECLINE' ? 'declined' : 'cancelled'}.`);
      onChange();
    } catch (err) {
      setError(
        extractApiErrorMessage(
          err,
          "The reservation could not be updated. Refresh and try again.",
        ),
      );
    } finally {
      submitting.current = false;
      setBusy(null);
    }
  };
  return (
    <div className="venue-bookings">
      {receipt && <p role="status" className="venue-success">{receipt}</p>}
      {error && (
        <p role="alert" className="venue-error">
          {error}
        </p>
      )}
      {!bookings.length ? (
        <EmptyState icon={CalendarDays} title="No reservations here yet" description={owner ? "Online reservations and the sessions you add will appear here. Use your venue calendar to add a booking, academy time or closure." : "Choose a stadium and an available time. Your requests, confirmed bookings and their details will stay together here."}/>
      ) : (
        bookings.map((entry) => { const booking = { ...entry, status: currentStatus(entry, now) }; return (
          <article className="venue-booking-row" key={booking.id}>
            <div className="venue-booking-icon">
              <CalendarDays size={21} />
            </div>
            <div className="venue-booking-main">
              <div className="venue-inline">
                {owner ? <h3>{booking.kind === 'CLOSURE' ? 'Pitch closure' : booking.contactName || 'Booking request'}</h3> : <Link to={`/stadiums/${booking.venueId}`}><h3>{booking.venueName}</h3></Link>}
                <span
                  className={`venue-status venue-status--${booking.status.toLowerCase()}`}
                >
                  {booking.status === "PENDING"
                    ? "Awaiting owner"
                    : booking.status.toLowerCase()}
                </span>
                {booking.kind !== "RENTAL" && (
                  <span className="venue-tag">
                    {({MANUAL:'Customer booking',ACADEMY:'Academy time',CLOSURE:'Closure',RENTAL:'Online booking'})[booking.kind]}
                  </span>
                )}
              </div>
              <p className="venue-muted">Booking #{booking.id}</p>
              <p>
                {booking.pitchName} ·{" "}
                {bookingDate(booking.startsAt, booking.timezone || timezone)} –{" "}
                {new Date(booking.endsAt).toLocaleDateString('en-CA', { timeZone: booking.timezone || timezone }) !== new Date(booking.startsAt).toLocaleDateString('en-CA', { timeZone: booking.timezone || timezone }) && `${new Date(booking.endsAt).toLocaleDateString(undefined, { timeZone: booking.timezone || timezone, month:'short', day:'numeric' })} `}
                {new Date(booking.endsAt).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                  timeZone: booking.timezone || timezone,
                })}
                {booking.timezone && <> · {booking.timezone}</>}
              </p>
              {!owner && (booking.venueAddress || booking.venuePhone) && (
                <p>
                  {booking.venueAddress}
                  {booking.venuePhone && (
                    <>
                      {" "}
                      ·{" "}
                      <a href={`tel:${booking.venuePhone}`}>
                        {booking.venuePhone}
                      </a>
                    </>
                  )}
                </p>
              )}
              {!owner &&
                booking.cancellationDeadline &&
                ["PENDING", "CONFIRMED"].includes(booking.status) && (
                  <p className="venue-muted">
                    Cancellation deadline:{" "}
                    {bookingDate(
                      booking.cancellationDeadline,
                      booking.timezone || timezone,
                    )}
                    . For later changes, contact the venue.
                  </p>
                )}
              {owner && (
                <p>
                  {booking.contactName}
                  {booking.contactPhone && (
                    <>
                      {" "}
                      ·{" "}
                      <a href={`tel:${booking.contactPhone}`}>
                        {booking.contactPhone}
                      </a>
                    </>
                  )}
                  {booking.note && <> · {booking.note}</>}
                </p>
              )}
              {booking.status === "PENDING" && (
                <p className="venue-muted">
                  <Clock3 size={13} /> Not confirmed yet.{" "}
                  {booking.expiresAt
                    ? `The request expires ${bookingDate(booking.expiresAt, booking.timezone || timezone)}.`
                    : "The owner will review your request."}
                </p>
              )}
              {booking.seriesId && (
                <p className="venue-muted">Part of a weekly series</p>
              )}
            </div>
            <div className="venue-booking-actions">
              <strong>
                {booking.kind === "CLOSURE"
                  ? "Closed"
                  : money(booking.totalPrice, booking.currency)}
              </strong>
              {owner && needsDecision(booking, now) && confirm?.id !== booking.id && (
                <div className="venue-inline">
                  <button
                    className="venue-button venue-button--primary"
                    disabled={busy !== null}
                    onClick={() => { setError(""); setConfirm({ id: booking.id, action: "ACCEPT" }); }}
                  >
                    <Check size={14} />
                    Accept
                  </button>
                  <button
                    className="venue-button"
                    disabled={busy !== null}
                    onClick={() => { setError(""); setConfirm({ id: booking.id, action: "DECLINE" }); }}
                  >
                    <X size={14} />
                    Decline
                  </button>
                </div>
              )}
              {(booking.canCancel || owner) && (!owner || booking.status === 'CONFIRMED') && Date.parse(booking.startsAt) > now && ['PENDING','CONFIRMED'].includes(booking.status) && confirm?.id !== booking.id && <button className="venue-link" disabled={busy !== null} onClick={() => { setError(''); setConfirm({ id: booking.id, action: 'CANCEL' }); }}>{booking.kind === 'CLOSURE' ? 'Remove closure' : 'Cancel reservation'}</button>}

            </div>
            {confirm?.id === booking.id && <div className="venue-owner-decision" role="region" aria-label="Review booking decision"><h3>{confirm.action === 'ACCEPT' ? 'Confirm this booking?' : confirm.action === 'DECLINE' ? 'Decline this request?' : booking.kind === 'CLOSURE' ? 'Reopen this time?' : 'Cancel this reservation?'}</h3><p>{booking.pitchName} · {bookingDate(booking.startsAt, booking.timezone || timezone)} · {booking.contactName}</p><p>{confirm.action === 'ACCEPT' ? 'The request becomes a confirmed booking for this pitch and time.' : 'This entry releases its claim on the time. Other bookings and shared pitch restrictions still apply.'} {booking.seriesId ? 'Only this date changes; the other dates in the weekly series stay as they are.' : ''}</p>{owner && booking.kind !== 'CLOSURE' && <p>{booking.kind === 'RENTAL' ? 'The customer receives an in-app reservation update.' : 'For a booking arranged by phone, contact the customer yourself about this change.'}</p>}<div className="venue-inline"><button className={`venue-button ${confirm.action === 'ACCEPT' ? 'venue-button--primary' : 'venue-button--danger'}`} disabled={busy !== null || Date.parse(booking.startsAt) <= now || !['PENDING','CONFIRMED'].includes(booking.status)} onClick={() => void act(booking, confirm.action)}>{busy === booking.id ? 'Saving…' : confirm.action === 'ACCEPT' ? 'Confirm booking' : confirm.action === 'DECLINE' ? 'Yes, decline' : booking.kind === 'CLOSURE' ? 'Yes, remove closure' : 'Yes, cancel'}</button><button className="venue-button" disabled={busy !== null} onClick={() => setConfirm(null)}>Keep unchanged</button></div></div>}
          </article>
        ); })
      )}
    </div>
  );
}

/** Keyed by session so an account change cannot render the previous person's history. */
function PersonalBookingHistory() {
  const [filters, setFilters] = useState({ status: '', fromDate: '', toDate: '' });
  const [draft, setDraft] = useState(filters);
  const [anchors, setAnchors] = useState<(string | undefined)[]>([undefined]);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<BookingHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const cursor = anchors[page];
  const activeAnchor = useRef<string | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    activeAnchor.current = cursor;
    setLoading(true); setData(null); setError('');
    const query = { size: 50, status: filters.status || undefined, fromDate: filters.fromDate || undefined, toDate: filters.toDate || undefined };
    const load = async (background = false) => {
      if (pending || background && document.visibilityState === 'hidden') return;
      pending = true;
      try {
        const result = await fetchBookingHistory({ ...query, cursor: activeAnchor.current }, controller.signal);
        if (!controller.signal.aborted) {
          activeAnchor.current = result.pageCursor;
          setData(result); setError('');
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(extractApiErrorMessage(err, 'Reservations could not load. Try again.'));
      } finally {
        pending = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    const refresh = () => void load(true);
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener('focus', refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [cursor, filters, reload]);

  const latest = () => { activeAnchor.current = undefined; setAnchors([undefined]); setPage(0); setReload(n => n + 1); };
  const retry = () => {
    // Pin an initially loaded page before explicit refresh, including after cancellation.
    setAnchors(values => values.map((value, index) => index === page ? activeAnchor.current : value));
    setReload(n => n + 1);
  };
  const older = () => {
    if (!data?.nextCursor) return;
    setAnchors(values => [...values.slice(0, page), data.pageCursor, data.nextCursor!]);
    setPage(n => n + 1);
  };
  return <>
    <p className="venue-muted">Times and booking dates use each venue’s timezone. Payment is arranged directly with the venue.</p>
    <form className="venue-history-filters" aria-label="Filter reservation history" onSubmit={event => {
      event.preventDefault(); setFilters({ ...draft }); latest();
    }}>
      <label>Status<select aria-label="Status" value={draft.status} onChange={event => setDraft(value => ({ ...value, status: event.target.value }))}>
        <option value="">All statuses</option><option value="PENDING">Awaiting owner</option><option value="CONFIRMED">Confirmed</option>
        <option value="CANCELLED">Cancelled</option><option value="DECLINED">Declined</option><option value="EXPIRED">Expired</option>
      </select></label>
      <label>Booking date from<input type="date" value={draft.fromDate} max={draft.toDate || '9999-12-31'} min="0001-01-01" onChange={event => setDraft(value => ({ ...value, fromDate: event.target.value }))}/></label>
      <label>Booking date to<input type="date" value={draft.toDate} min={draft.fromDate || '0001-01-01'} max="9999-12-31" onChange={event => setDraft(value => ({ ...value, toDate: event.target.value }))}/></label>
      <button className="venue-button" type="submit">Apply filters</button>
      <button className="venue-link" type="button" onClick={() => { const empty = { status: '', fromDate: '', toDate: '' }; setDraft(empty); setFilters(empty); latest(); }}>Clear filters</button>
    </form>
    <nav className="venue-history-navigation" aria-label="Reservation history pages">
      <button className="venue-button" disabled={loading || page === 0} onClick={() => setPage(n => n - 1)}>Newer reservations</button>
      <button className="venue-button" disabled={loading || !data?.nextCursor} onClick={older}>Older reservations</button>
      <button className="venue-link" disabled={loading} onClick={latest}>Latest reservations</button>
      <button className="venue-link" disabled={loading} onClick={retry}>Refresh this page</button>
      <span className="venue-muted" role="status">Page {page + 1} · newest booking time first</span>
    </nav>
    {loading && <p className="venue-empty" role="status">Loading your reservations…</p>}
    {error && <div className="venue-error" role="alert">{error} <button className="venue-link" onClick={retry}>Retry</button></div>}
    {!loading && data && <>
      {data.content.length > 0 ? <BookingRows bookings={data.content} onChange={retry}/> :
        <EmptyState icon={CalendarDays} title={page > 0 ? 'No more reservations on this page' : 'No reservations found'}
          description={filters.status || filters.fromDate || filters.toDate ? 'Try another status or booking date range, or clear the filters.' : page > 0 ? 'Go to a newer page or choose Latest reservations to start again.' : 'Your requests and confirmed bookings will appear here when you reserve a pitch.'}/>}
      {!data.nextCursor && data.content.length > 0 && <p className="venue-muted" role="status">You’ve reached the oldest reservations in this history.</p>}
      <p className="venue-muted">Choose Latest reservations to include new bookings. Refresh keeps your place and checks current status and access.</p>
    </>}
  </>;
}

export function MyVenueBookings() {
  const { isAuthenticated, sessionId } = useAuth();
  if (!isAuthenticated) return <div className="venue-empty"><CalendarDays size={32}/><h2>Your next game starts here</h2>
    <p>Sign in to request a pitch and track your reservations.</p><Link className="venue-button venue-button--primary" to="/login">Sign in</Link></div>;
  return <PersonalBookingHistory key={String(sessionId)}/>;
}
