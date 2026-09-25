import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Check, Clock3, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { extractApiErrorMessage } from "../../utils/apiError";
import { fetchMyBookings, updateBooking, type Booking } from "./api";
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
        <div className="venue-empty">
          <CalendarDays size={32} />
          <h3>No reservations here yet</h3>
          <p>
            {owner
              ? "Online reservations and the sessions you add will appear here."
              : "Choose a stadium and an available time to get started."}
          </p>
        </div>
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

export function MyVenueBookings() {
  const { isAuthenticated, sessionId } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();
    // Clear the old account's reservations while loading the current session.
    setLoading(true);
    setBookings([]);
    setError("");
    void fetchMyBookings(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setBookings(data);
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(extractApiErrorMessage(err, "Reservations could not load."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [isAuthenticated, sessionId, reload]);
  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();
    let pending = false;
    const refresh = async () => {
      if (pending || document.visibilityState === 'hidden') return;
      pending = true;
      try { const data = await fetchMyBookings(controller.signal); if (!controller.signal.aborted) { setBookings(data); setError(''); } }
      catch { /* The explicit reload path reports failures without clearing visible reservations. */ }
      finally { pending = false; }
    };
    const timer = window.setInterval(() => void refresh(), 5000);
    window.addEventListener('focus', refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [isAuthenticated, sessionId]);
  if (!isAuthenticated)
    return (
      <div className="venue-empty">
        <CalendarDays size={32} />
        <h2>Your next game starts here</h2>
        <p>Sign in to request a pitch and track your reservations.</p>
        <Link className="venue-button venue-button--primary" to="/login">
          Sign in
        </Link>
      </div>
    );
  if (loading)
    return (
      <p className="venue-empty" role="status">
        Loading your reservations…
      </p>
    );
  if (error)
    return (
      <div className="venue-error" role="alert">
        {error}
        <button className="venue-link" onClick={() => setReload((n) => n + 1)}>
          Retry
        </button>
      </div>
    );
  return (
    <>
      <p className="venue-muted">
        Times are shown in each venue’s timezone. Payment is arranged directly
        with the venue.
      </p>
      <BookingRows
        key={String(sessionId)}
        bookings={bookings}
        onChange={() => setReload((n) => n + 1)}
      />
    </>
  );
}
