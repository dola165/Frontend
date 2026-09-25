import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, ShieldCheck, ArrowRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { buildLoginRedirectPath } from "../../utils/authRedirect";
import { extractApiErrorMessage } from "../../utils/apiError";
import { createBooking, fetchAvailability, formats, surfaces, type Availability, type Slot, type Venue } from "./api";
import { addDays, dayLabel, money, timeLabel, today, validDate } from "./utils";
import { availableEnds, hoursLabel } from "./timeRange";

export function VenueCalendar({ venue }: { venue: Venue }) {
  const { user, isAuthenticated, sessionId } = useAuth();
  const [params] = useSearchParams();
  const minimumDate = today(venue.timezone);
  const requestedDate = params.get("date") || "";
  const initialDate = validDate(requestedDate) && requestedDate >= minimumDate ? requestedDate : minimumDate;
  const [date, setDate] = useState(initialDate);
  const [selectedDay, setSelectedDay] = useState(initialDate);
  const [pitchId, setPitchId] = useState(venue.pitches.find(pitch => pitch.active && pitch.id === Number(params.get("pitch")))?.id || venue.pitches.find(pitch => pitch.active)?.id || 0);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [choosing, setChoosing] = useState<"start" | "end">("start");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [step, setStep] = useState<"time" | "details">("time");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [reload, setReload] = useState(0);
  const [bookingError, setBookingError] = useState("");
  const [repeatWeeks, setRepeatWeeks] = useState(1);
  const submitting = useRef(false);
  const current = useRef(true);
  const requestKey = useRef<{ fingerprint: string; id: string } | null>(null);
  const restore = useRef({start: params.get("start"), end: params.get("end"), pitchId});
  const heading = useRef<HTMLHeadingElement>(null);
  const duration = start && end ? (Date.parse(end) - Date.parse(start)) / 60000 : 0;
  const pitch = venue.pitches.find(value => value.id === pitchId);
  const daySlots = availability?.days.find(day => day.date === selectedDay)?.pitches.find(value => value.pitchId === pitchId)?.slots || [];
  const nextDaySlots = availability?.days.find(day => day.date === addDays(selectedDay, 1))?.pitches.find(value => value.pitchId === pitchId)?.slots || [];
  const ends = availableEnds([...daySlots, ...nextDaySlots], start, venue.slotMinutes, venue.maxBookingMinutes);
  const boundaries = [...new Map([...daySlots.flatMap(value => [value.startsAt, value.endsAt]), ...(choosing === "end" ? ends : [])].map(value => [Date.parse(value), value])).values()].sort((a,b) => Date.parse(a)-Date.parse(b));
  const labelTime = (value: string) => `${timeLabel(value, venue.timezone)}${new Intl.DateTimeFormat("en-CA", {timeZone:venue.timezone, year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value)) > selectedDay ? " +1 day" : ""}`;
  const resetRange = () => { setStart(""); setEnd(""); setSlot(null); setChoosing("start"); setQuoteError(""); setStep("time"); };
  const changeWeek = (value: string) => { resetRange(); setDate(value); setSelectedDay(value); };
  const changeStep = (value: "time" | "details") => { setStep(value); requestAnimationFrame(() => heading.current?.focus()); };
  useEffect(() => { current.current = true; return () => { current.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setSlot(null); setStart(""); setEnd(""); setChoosing("start"); setStep("time"); setAvailability(null);
    // The eighth day supplies continuations for games crossing midnight on day seven.
    void fetchAvailability(venue.id, date, venue.minBookingMinutes, 8, controller.signal)
      .then(data => {
        if (controller.signal.aborted) return;
        setAvailability(data);
        const previous = restore.current;
        if (previous.start && previous.end) {
          const windows = data.days.flatMap(day => day.pitches.find(p => p.pitchId === previous.pitchId)?.slots || []);
          const startsHere = data.days[0]?.pitches.find(p => p.pitchId === previous.pitchId)?.slots.some(s => s.available && Date.parse(s.startsAt) === Date.parse(previous.start!));
          if (startsHere && availableEnds(windows,previous.start,venue.slotMinutes,venue.maxBookingMinutes).some(e => Date.parse(e) === Date.parse(previous.end!))) {
            setStart(previous.start); setEnd(previous.end); setChoosing("end");
          }
        }
        restore.current = {start:null,end:null,pitchId:0};
      })
      .catch(err => { if (!controller.signal.aborted) setError(extractApiErrorMessage(err, "Availability could not load.")); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [venue.id, venue.minBookingMinutes, venue.slotMinutes, venue.maxBookingMinutes, date, reload, sessionId]);
  useEffect(() => {
    const controller = new AbortController();
    setSlot(null); setQuoteError(""); setQuoting(false);
    if (!start || !end) return () => controller.abort();
    setQuoting(true);
    void fetchAvailability(venue.id, selectedDay, duration, 1, controller.signal)
      .then(data => {
        if (controller.signal.aborted) return;
        const exact = data.days.find(day => day.date === selectedDay)?.pitches.find(value => value.pitchId === pitchId)?.slots.find(value => value.available && Date.parse(value.startsAt) === Date.parse(start) && Date.parse(value.endsAt) === Date.parse(end));
        if (!exact) { setQuoteError("This time is no longer available. Choose another range or refresh times."); return; }
        setSlot(exact);
      })
      .catch(err => { if (!controller.signal.aborted) setQuoteError(extractApiErrorMessage(err, "We couldn’t check this time. Refresh times to try again.")); })
      .finally(() => { if (!controller.signal.aborted) setQuoting(false); });
    return () => controller.abort();
  }, [venue.id, start, end, duration, pitchId, selectedDay, sessionId]);
  const reserve = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!slot || !pitch || step !== "details" || submitting.current) return;
    const data = new FormData(event.currentTarget);
    submitting.current = true; setSaving(true); setBookingError(""); setSuccess("");
    try {
      const payload = { expectedTotalPrice: slot.price, currency: venue.currency, repeatWeeks, pitchId,
        startsAt: slot.startsAt, endsAt: slot.endsAt, contactName: String(data.get("name")).trim(), contactPhone: String(data.get("phone")).trim(), note: String(data.get("note")).trim() };
      const fingerprint = JSON.stringify(payload);
      if (requestKey.current?.fingerprint !== fingerprint) requestKey.current = { fingerprint, id: crypto.randomUUID() };
      const result = await createBooking(venue.id, { ...payload, requestId: requestKey.current.id });
      if (current.current) {
        setSuccess(result[0]?.status === "CONFIRMED"
          ? `${result.length > 1 ? `${result.length} weekly reservations are` : "Your pitch is"} confirmed. You’ll find it in My reservations.`
          : `${result.length > 1 ? `${result.length} weekly requests sent.` : "Request sent."} Awaiting owner confirmation. Track each date in My reservations.`);
        resetRange(); setReload(n => n + 1);
      }
    } catch (err) {
      if (current.current) { setBookingError(extractApiErrorMessage(err,"That time may no longer be available. Refresh the calendar and try again.")); resetRange(); setReload(n => n + 1); }
    } finally { submitting.current = false; if (current.current) setSaving(false); }
  };
  if (!venue.pitches.some(value => value.active)) return <section className="venue-panel venue-empty"><CalendarDays size={28}/><h2>Availability is being prepared</h2><p>Contact the venue for opening times and pitch information.</p></section>;
  return <section id="availability" className="venue-calendar-section venue-range-booking">
    <nav className="venue-booking-steps" aria-label="Booking steps">
      <button disabled={saving} aria-current={step === "time" ? "step" : undefined} onClick={() => changeStep("time")}><span>1</span> Day & time</button>
      <ArrowRight size={16}/>
      <button disabled={!slot || saving} aria-current={step === "details" ? "step" : undefined} onClick={() => changeStep("details")}><span>2</span> Details & confirm</button>
    </nav>
    <div className="venue-section-heading"><div><h2 ref={heading} tabIndex={-1}>{step === "time" ? "When are we playing?" : "Make it your game"}</h2><p>{step === "time" ? "Choose your day, then tap a start and end time." : "Choose a one-off or weekly game, then confirm your details."} All times in {venue.timezone}.</p></div></div>
    {bookingError && <div className="venue-error" role="alert">{bookingError}</div>}
    {success && <div className="venue-success" role="status"><CheckCircle2 size={21}/><div><strong>{success}</strong><p>Pay directly at the venue. <Link to="/stadiums?tab=bookings">View my reservations →</Link></p></div></div>}
    <fieldset className="venue-booking-fields" disabled={saving}>
    <div className="venue-booking-layout">
      <div className="venue-panel venue-calendar">
        <div hidden={step !== "time"}>
          <div className="venue-range-toolbar">
            <label className="venue-field"><span>Pitch</span><select value={pitchId} onChange={event => { resetRange(); setPitchId(Number(event.target.value)); }}>{venue.pitches.filter(value => value.active).map(value => <option key={value.id} value={value.id}>{value.name} · {formats[value.format]}</option>)}</select></label>
            <div className="venue-week-controls">
              <button className="venue-button venue-icon-button" aria-label="Previous week" disabled={date <= minimumDate} onClick={() => changeWeek(addDays(date,-7) < minimumDate ? minimumDate : addDays(date,-7))}><ChevronLeft size={18}/></button>
              <label><span className="sr-only">Calendar start date</span><input type="date" min={minimumDate} value={date} onChange={event => { if(validDate(event.target.value) && event.target.value >= minimumDate) changeWeek(event.target.value); }}/></label>
              <button className="venue-button venue-icon-button" aria-label="Next week" onClick={() => changeWeek(addDays(date,7))}><ChevronRight size={18}/></button>
              <button className="venue-link" onClick={() => changeWeek(minimumDate)}>Today</button>
            </div>
          </div>
          {loading ? <div className="venue-empty" role="status"><Clock3 size={24}/>Checking pitch availability…</div> : error ? <div className="venue-error" role="alert">{error}<button className="venue-link" onClick={() => setReload(n => n+1)}>Retry</button></div> : <>
            <div className="venue-date-strip" aria-label="Choose a day">{availability?.days.slice(0,7).map(day => <button key={day.date} className={selectedDay === day.date ? "is-selected" : ""} aria-label={dayLabel(day.date,"long")} aria-pressed={selectedDay === day.date} onClick={() => { resetRange(); setSelectedDay(day.date); }}><span>{new Date(day.date+"T12:00:00Z").toLocaleDateString(undefined,{weekday:"short",timeZone:"UTC"})}</span><strong>{new Date(day.date+"T12:00:00Z").getUTCDate()}</strong><small>{new Date(day.date+"T12:00:00Z").toLocaleDateString(undefined,{month:"short",timeZone:"UTC"})}</small></button>)}</div>
            <div className="venue-range-fields">
              <button className={choosing === "start" ? "is-active" : ""} aria-pressed={choosing === "start"} onClick={() => setChoosing("start")}><span>Start time</span><strong>{start ? labelTime(start) : "Choose start"}</strong></button>
              <ArrowRight size={20}/>
              <button className={choosing === "end" ? "is-active" : ""} disabled={!start} aria-pressed={choosing === "end"} onClick={() => setChoosing("end")}><span>End time</span><strong>{end ? labelTime(end) : "Choose end"}</strong></button>
              <span className="venue-range-length" role="status">{duration ? hoursLabel(duration) : `${hoursLabel(venue.minBookingMinutes)} minimum`}</span>
            </div>
            <p className="venue-range-instruction" aria-live="polite">{choosing === "start" ? "Tap when you want to start." : "Tap when you want to finish. Highlighted times show your whole booking."}</p>
            <div className="venue-range-grid" aria-label={choosing === "start" ? "Choose start time" : "Choose end time"}>{boundaries.map(value => {
              const at=Date.parse(value), first=Date.parse(start), last=Date.parse(end);
              const selectable=choosing === "start" ? daySlots.some(s => Date.parse(s.startsAt) === at && s.available) : ends.some(e => Date.parse(e) === at);
              const endpoint=at === first || at === last;
              const inside=at > first && at < last;
              return <button key={value} disabled={!selectable} className={`venue-range-time ${endpoint ? "is-endpoint" : ""} ${inside ? "is-in-range" : ""}`} aria-pressed={endpoint || inside} aria-label={`${choosing === "start" ? "Start" : "End"} ${labelTime(value)}${selectable ? "" : ", unavailable"}`} onClick={() => { if (choosing === "end" && end === value) return; setSlot(null); setSuccess(""); setQuoteError(""); if(choosing === "start") { setStart(value); setEnd(""); setChoosing("end"); } else { setEnd(value); } }}>{labelTime(value)}</button>;
            })}</div>
            {!daySlots.some(value => value.available) && <p className="venue-day-closed">No free times on this day. Try another day or pitch.</p>}
            <div className="venue-calendar-legend"><span><i/>Available</span><span><i className="is-busy"/>Unavailable</span><span>{hoursLabel(venue.minBookingMinutes)}–{hoursLabel(venue.maxBookingMinutes)} per booking</span></div>
          </>}
          {quoteError && <div className="venue-error" role="alert">{quoteError}<button className="venue-link" onClick={() => { resetRange(); setReload(n => n+1); }}>Refresh times</button></div>}
        </div>
        {isAuthenticated ? <form hidden={step !== "details" || !slot} key={String(sessionId)} onSubmit={reserve} className="venue-form">
          <label className="venue-field"><span>Make it a regular game</span><select value={repeatWeeks} onChange={event => setRepeatWeeks(Number(event.target.value))}><option value="1">Just this date</option>{Array.from({length:11},(_,i)=>i+2).map(value=><option key={value} value={value}>Weekly for {value} weeks</option>)}</select></label>
          {repeatWeeks > 1 && <p className="venue-muted">{repeatWeeks} weekly reservations · {money((slot?.price || 0)*repeatWeeks,venue.currency)} total. Each date follows the same confirmation and cancellation rules.</p>}
          <div className="venue-contact-fields">
            <label className="venue-field"><span>Contact name</span><input name="name" required maxLength={100} autoComplete="name" defaultValue={user?.fullName || user?.name || ""}/></label>
            <label className="venue-field"><span>Phone number</span><input name="phone" type="tel" required maxLength={40} autoComplete="tel" placeholder="+995…"/></label>
          </div>
          <label className="venue-field"><span>Note for the venue <small>(optional)</small></span><textarea name="note" rows={2} maxLength={1000} placeholder="Anything the owner should know?"/></label>
          <label className="venue-checkbox"><input required type="checkbox"/>I agree to the cancellation policy shown in the booking summary.</label>
          <button className="venue-button venue-button--primary venue-button--wide" disabled={saving || !slot}>{saving ? "Reserving…" : venue.bookingMode === "INSTANT" ? "Confirm reservation" : "Request this time"}</button>
        </form> : step === "details" && <div className="venue-empty"><CalendarDays size={28}/><h3>Keep your game in one place</h3><p>Sign in to reserve this pitch and manage your bookings.</p><Link className="venue-button venue-button--primary" to={buildLoginRedirectPath(`/stadiums/${venue.id}`, `?book=1&date=${selectedDay}&duration=${duration}&pitch=${pitchId}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, "")}>Sign in to reserve</Link></div>}
      </div>
      <aside className="venue-panel venue-reservation">
        <span className="venue-eyebrow">Your time on the pitch</span><h3>{pitch?.name}</h3>
        <p>{pitch && formats[pitch.format]} · {pitch && surfaces[pitch.surface]}{pitch?.covered ? " · Covered" : ""}</p>
        <div className="venue-reservation-summary" aria-live="polite">
          <span>{dayLabel(selectedDay,"long")}</span><strong>{start ? labelTime(start) : "--:--"} – {end ? labelTime(end) : "--:--"}</strong>
          <div><span>{duration ? hoursLabel(duration) : "Choose your hours"}</span><strong>{quoting ? "Checking…" : slot ? money(slot.price,venue.currency) : "—"}</strong></div>
          <small>{slot ? "Per date · Pay at the venue" : pitch ? `${money(pitch.pricePerHour,venue.currency)} / hour` : ""}</small>
        </div>
        {step === "time" ? <button className="venue-button venue-button--primary venue-button--wide" disabled={!slot || quoting} onClick={() => changeStep("details")}>Continue <ArrowRight size={17}/></button> : <button className="venue-button venue-button--wide" onClick={() => changeStep("time")}>Edit day & time</button>}
        {step === "details" && repeatWeeks > 1 && slot && <p className="venue-repeat-summary">{repeatWeeks} weekly games · <strong>{money(slot.price * repeatWeeks, venue.currency)} total</strong></p>}
        <div className="venue-booking-policy">
          <p><ShieldCheck size={16}/>{venue.bookingMode === "INSTANT" ? "Your booking is confirmed immediately." : "The owner confirms each booking request."}</p>
          <p><Clock3 size={16}/>Cancel at least {venue.cancellationHours} hours before your start time. For later changes, contact the venue.</p>
          <p><CheckCircle2 size={16}/>Pay at the venue. No online payment is collected.</p>
        </div>
      </aside>
    </div>
    </fieldset>
  </section>;
}
