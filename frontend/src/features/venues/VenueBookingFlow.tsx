import { validateVenueForm } from './flowValidation';
import { useRef, useState, type FormEvent } from 'react';
import { CalendarDays, Clock3, ShieldCheck, UsersRound, Wrench } from 'lucide-react';
import { createBooking, fetchVenueBookings, type Booking, type BookingDraft, type BookingKind, type Venue } from './api';
import { addDays, dayLabel, money, zonedInstant } from './utils';
import { extractApiErrorMessage } from '../../utils/apiError';
import { VenueSteps } from './VenueFlow';

const kinds = [
  { id: 'MANUAL', title: 'Customer booking', description: 'A phone booking or walk-in you have already agreed.', icon: UsersRound },
  { id: 'ACADEMY', title: 'Club or academy time', description: 'Keep a regular team’s training slot in the calendar.', icon: CalendarDays },
  { id: 'CLOSURE', title: 'Close a pitch', description: 'Block time for maintenance, weather or a private closure.', icon: Wrench },
] as const;

export function VenueBookingFlow({ venue, date, initialKind, onSave, onCancel }: { venue: Venue; date: string; initialKind?: BookingKind; onSave: (bookings: Booking[]) => void; onCancel: () => void }) {
  const intake = venue.capabilities?.enabledActivities.includes('VENUE') ?? false;
  const [kind, setKind] = useState<BookingKind>(intake ? initialKind || 'MANUAL' : 'CLOSURE');
  const [draft, setDraft] = useState({ pitchId: venue.pitches.find(p => p.active)?.id ?? 0, date, endDate: date, start: '18:00', end: '19:00', repeats: 1, name: '', phone: '', note: '' });
  const [step, setStep] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [review, setReview] = useState<BookingDraft | null>(null);
  const form = useRef<HTMLFormElement>(null), submitting = useRef(false);
  const requestKey = useRef<{ fingerprint: string; id: string } | null>(null);
  const pitch = venue.pitches.find(p => p.id === draft.pitchId && p.active);
  const change = <K extends keyof typeof draft>(key: K, value: typeof draft[K]) => { setDraft(d => ({ ...d, [key]: value })); setReview(null); };
  let minutes = 0;
  try { minutes = (Date.parse(zonedInstant(draft.endDate, draft.end, venue.timezone)) - Date.parse(zonedInstant(draft.date, draft.start, venue.timezone))) / 60000; } catch { /* Incomplete date input. */ }
  const price = kind === 'CLOSURE' ? 0 : Math.floor((Math.round((pitch?.pricePerHour ?? 0) * 100) * Math.max(0, minutes)) / 60 + .5) / 100;
  const navigate = (next: number) => { if (busy) return; if (next === 2) { void prepare(); return; } setStep(next); setError(''); };

  async function prepare() {
    if (!form.current || submitting.current || !validateVenueForm(form.current, setStep)) return;
    if (!pitch) { setError('Add an active pitch before creating a calendar entry.'); return; }
    setError(''); setBusy(true); submitting.current = true;
    try {
      if (!intake && kind !== 'CLOSURE') throw new Error('New bookings are paused. You can still close a pitch.');
      if (minutes <= 0) throw new Error('End time must be later than start time. Choose the next end date for an overnight entry.');
      if (minutes % venue.slotMinutes !== 0 || Number(draft.start.slice(3)) % venue.slotMinutes !== 0) throw new Error(`Use ${venue.slotMinutes}-minute intervals for this venue.`);
      if (kind === 'CLOSURE' ? minutes > 1440 : minutes < venue.minBookingMinutes || minutes > venue.maxBookingMinutes) throw new Error(kind === 'CLOSURE' ? 'Each closure can cover up to 24 hours.' : `Bookings must last ${venue.minBookingMinutes}–${venue.maxBookingMinutes} minutes.`);
      if (kind !== 'CLOSURE' && (!draft.name.trim() || !draft.phone.trim())) throw new Error('Add the customer or team name and contact phone.');
      const occurrences = Array.from({ length: draft.repeats }, (_, i) => ({ start: zonedInstant(addDays(draft.date, i * 7), draft.start, venue.timezone), end: zonedInstant(addDays(draft.endDate, i * 7), draft.end, venue.timezone) }));
      if (Date.parse(occurrences[0].start) <= Date.now() || Date.parse(occurrences.at(-1)!.end) > Date.now() + 180 * 86400000) throw new Error('Choose future dates within the next 180 days, including every repeated week.');
      // Rates are per occurrence; a DST transition must not silently change a reviewed total.
      if (occurrences.some(o => (Date.parse(o.end) - Date.parse(o.start)) / 60000 !== minutes)) throw new Error('A daylight-saving change affects this series. Create those dates separately so their times and prices can be reviewed.');
      const existing = await fetchVenueBookings(venue.id, occurrences[0].start, occurrences.at(-1)!.end);
      const conflicts = occurrences.filter(o => existing.some(b => {
        if (!['PENDING', 'CONFIRMED'].includes(b.status) || (b.status === 'PENDING' && b.expiresAt && Date.parse(b.expiresAt) <= Date.now())) return false;
        const other = venue.pitches.find(p => p.id === b.pitchId);
        const shared = other && !!pitch.resourceGroup && other.resourceGroup === pitch.resourceGroup && other.resourceUnits.some(u => pitch.resourceUnits.includes(u));
        return (b.pitchId === pitch.id || shared) && Date.parse(b.startsAt) < Date.parse(o.end) && Date.parse(b.endsAt) > Date.parse(o.start);
      }));
      if (conflicts.length) throw new Error(`${conflicts.length} date${conflicts.length > 1 ? 's' : ''} overlap an existing booking or closure, including shared pitch space. Choose another pitch or time.`);
      setReview({ pitchId: pitch.id, startsAt: occurrences[0].start, endsAt: occurrences[0].end, contactName: kind === 'CLOSURE' ? 'Venue closure' : draft.name.trim(), contactPhone: kind === 'CLOSURE' ? venue.publicPhone || 'Venue' : draft.phone.trim(), note: draft.note.trim(), kind, repeatWeeks: draft.repeats, expectedTotalPrice: price, currency: venue.currency });
      setStep(2);
    } catch (err) { setError(extractApiErrorMessage(err, err instanceof Error ? err.message : 'Availability could not be checked. Try again.')); }
    finally { setBusy(false); submitting.current = false; }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (step !== 2 || !review) { if (step === 0) navigate(1); else await prepare(); return; }
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    const fingerprint = JSON.stringify(review);
    if (requestKey.current?.fingerprint !== fingerprint) requestKey.current = { fingerprint, id: crypto.randomUUID() };
    try { onSave(await createBooking(venue.id, { ...review, requestId: requestKey.current.id })); }
    catch (err) { setError(extractApiErrorMessage(err, 'This entry could not be saved. Your details are still here.')); }
    finally { submitting.current = false; setBusy(false); }
  }

  return <form ref={form} onSubmit={submit} noValidate className="venue-flow venue-booking-flow" aria-label="Booking or closure editor">
    <div className="venue-section-heading"><div><p className="venue-eyebrow">A complete calendar, one entry at a time</p><h2>{kind === 'CLOSURE' ? 'Plan a pitch closure' : 'Add a booking'}</h2><p>Choose the purpose, set the time, then review before anything is saved.</p></div></div>
    <VenueSteps labels={['What are you adding?', 'Pitch & time', 'Review & save']} step={step} onChange={navigate} disabled={busy}/>
    <div className="venue-flow-grid"><fieldset disabled={busy} className="venue-flow-main">
      <section className="venue-panel" hidden={step !== 0} data-flow-step="0"><h2>What is this time for?</h2><div className="venue-flow-choices">{kinds.filter(k => intake || k.id === 'CLOSURE').map(k => <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => { setKind(k.id); setReview(null); }}><k.icon size={24}/><strong>{k.title}</strong><small>{k.description}</small></button>)}</div><p className="venue-muted">Customer bookings and academy time become confirmed entries. Closures block availability and have no rental charge.</p></section>
      <section className="venue-panel" hidden={step !== 1} data-flow-step="1"><div className="venue-section-heading"><div><h2>Choose the pitch and time</h2><p>All times use {venue.timezone}.</p></div></div><div className="venue-form-grid">
        <label className="venue-field"><span>Pitch</span><select required value={draft.pitchId || ''} onChange={e => change('pitchId', Number(e.target.value))}><option value="" disabled>Choose a pitch</option>{venue.pitches.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="venue-field"><span>Repeat weekly</span><select aria-label="Repeat weekly" value={draft.repeats} onChange={e => change('repeats', Number(e.target.value))}><option value={1}>This date only</option>{[2,4,6,8,12].map(w => <option key={w} value={w}>{w} weeks</option>)}</select></label>
        <label className="venue-field"><span>Start date</span><input type="date" required value={draft.date} onChange={e => { setDraft(d => ({ ...d, date: e.target.value, endDate: d.endDate === d.date ? e.target.value : d.endDate })); setReview(null); }}/></label>
        <label className="venue-field"><span>Start time</span><input type="time" required step={venue.slotMinutes*60} value={draft.start} onChange={e => change('start',e.target.value)}/></label>
        <label className="venue-field"><span>End date</span><input type="date" required min={draft.date} value={draft.endDate} onChange={e => change('endDate',e.target.value)}/></label>
        <label className="venue-field"><span>End time</span><input type="time" required step={venue.slotMinutes*60} value={draft.end} onChange={e => change('end',e.target.value)}/></label>
        {kind !== 'CLOSURE' && <><label className="venue-field"><span>Customer / academy name</span><input required maxLength={100} value={draft.name} onChange={e => change('name',e.target.value)}/></label><label className="venue-field"><span>Contact phone</span><input type="tel" required maxLength={40} value={draft.phone} onChange={e => change('phone',e.target.value)}/></label></>}
      </div><label className="venue-field"><span>{kind === 'CLOSURE' ? 'Reason for closure' : 'Notes'}</span><textarea aria-label={kind === 'CLOSURE' ? 'Reason for closure' : 'Notes'} rows={3} maxLength={1000} value={draft.note} onChange={e => change('note',e.target.value)}/></label></section>
      <section className="venue-panel" hidden={step !== 2} data-flow-step="2"><p className="venue-eyebrow">One last look</p><h2>{kind === 'CLOSURE' ? 'Ready to block this time?' : 'Ready to confirm this booking?'}</h2><p>The preview shows exactly what you are adding to {venue.displayName}.</p><div className="venue-flow-check"><ShieldCheck size={22}/><span>No overlapping bookings found when checked. Availability and permissions are checked again when you save.</span></div><p className="venue-muted">{draft.repeats > 1 ? `All ${draft.repeats} dates are saved together. If any date conflicts, none are added. You can cancel each date separately.` : 'This saves one entry in your venue calendar.'}</p><p className="venue-muted">{kind === 'CLOSURE' ? 'This closes availability; it does not cancel any existing booking.' : 'Payment is arranged at the venue. This does not collect money or send a customer invitation.'}</p></section>
    </fieldset><aside className="venue-live-preview" tabIndex={0} aria-label="Booking preview"><div className="venue-preview-label"><span>Live calendar preview</span><small>{step === 2 ? 'Ready for review' : 'Not saved yet'}</small></div><div className="venue-booking-ticket"><span className="venue-tag">{kinds.find(k => k.id === kind)?.title}</span><h3>{pitch?.name || 'Choose a pitch'}</h3><p>{venue.displayName}</p></div><div className="venue-preview-body"><dl className="venue-ticket-details"><div><dt>Date</dt><dd>{draft.date ? dayLabel(draft.date,'long') : 'Choose a date'}</dd></div><div><dt>Time</dt><dd>{draft.start}–{draft.end}{draft.endDate !== draft.date ? ` · ends ${draft.endDate}` : ''}</dd></div><div><dt>Duration</dt><dd>{minutes > 0 ? `${minutes} minutes` : 'Choose an end time'}</dd></div><div><dt>Repeats</dt><dd>{draft.repeats === 1 ? 'One date' : `${draft.repeats} dates, weekly`}</dd></div>{kind !== 'CLOSURE' && <><div><dt>For</dt><dd>{draft.name || 'Customer or academy name'}</dd></div><div><dt>Phone</dt><dd>{draft.phone || 'Contact number'}</dd></div></>}</dl><strong className="venue-preview-price">{kind === 'CLOSURE' ? 'No rental charge' : `${money(price,venue.currency)}${draft.repeats > 1 ? ' / date' : ''}`}</strong>{draft.repeats > 1 && <p>{kind !== 'CLOSURE' && `${money(price*draft.repeats,venue.currency)} across `}{draft.repeats} dates · last starts {draft.date ? dayLabel(addDays(draft.date,(draft.repeats-1)*7)) : '—'}</p>}{draft.note && <p className="venue-preview-description">{draft.note}</p>}<p className="venue-muted"><Clock3 size={13}/> {venue.timezone}</p></div></aside></div>
    {error && <p className="venue-error" role="alert">{error}</p>}
    <footer className="venue-flow-actions"><p>{step === 2 ? 'Save only when the details above are right.' : 'Your calendar stays unchanged until the final step.'}</p><div><button type="button" className="venue-button" disabled={busy} onClick={onCancel}>Discard entry</button>{step > 0 && <button type="button" className="venue-button" disabled={busy} onClick={() => navigate(step-1)}>Back</button>}<button type="submit" className="venue-button venue-button--primary" disabled={busy || !pitch}>{busy ? step === 2 ? 'Saving…' : 'Checking…' : step === 0 ? 'Continue' : step === 1 ? 'Review booking' : kind === 'CLOSURE' ? 'Block these times' : 'Add confirmed booking'}</button></div></footer>
  </form>;
}
