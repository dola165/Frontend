import { EmptyState } from '../../components/ui/EmptyState';
import { CalendarDays } from 'lucide-react';
import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useDialogFocus } from '../../components/workspace/useDialogFocus';
import { useRefereeHistory } from '../matchExchange/useRefereeHistory';
import { useAction } from '../matchExchange/hooks';
import { remove, when, type RefereeHub, type Appointment } from '../matchExchange/api';
import type { ScheduleEventOccurrence } from '../schedule/api';
import { AvailabilityForm } from './ProfileTools';

export function AvailabilityDialog({ appointment, onClose, onSaved }: { appointment?: Appointment; onClose: () => void; onSaved: () => void }) {
  const ref = useRef<HTMLElement>(null); useDialogFocus(true, ref, onClose);
  return <div className="rw-backdrop" onClick={onClose}><section ref={ref} className="rw-availability-dialog" role="dialog" aria-modal="true" aria-label="Availability for this appointment" onClick={e => e.stopPropagation()}>
    <header className="rw-panel-heading"><div><h2>Make time for this match</h2><p>{appointment?.title}</p></div><button aria-label="Close availability" onClick={onClose}><X size={20}/></button></header>
    <p className="rw-inset mx-muted">Review the full window. Saving availability does not accept the invitation or clear another commitment.</p>
    <AvailabilityForm startsAt={appointment?.starts_at_iso} endsAt={appointment?.ends_at_iso} reload={() => { onSaved(); onClose(); }}/>
  </section></div>;
}

export function Availability({ hub, reload, openMatch }: { hub: RefereeHub; reload: () => void; openMatch: (id: number) => void }) {
  const [showAll, setShowAll] = useState(false);
  const { run, busy, feedback } = useAction(reload);
  const from = new Date().toISOString().slice(0,10), to = new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  const { data: personal, error, reload: retry } = useRefereeHistory<{ events: ScheduleEventOccurrence[] }>(`/schedule/me/events?from=${from}T00:00:00&to=${to}T23:59:59`);
  return <div className="rw-two-columns"><div className="rw-stack"><section className="mx-panel"><h2>Your available windows</h2><p className="mx-muted">Tell clubs when you can officiate. Accepted matches and personal commitments are still checked before an appointment is confirmed.</p>{feedback}
    {!hub.availability.length && <EmptyState compact icon={CalendarDays} title="No future availability added yet." description="Use the availability form to add the days and times you can officiate. Clubs can then check whether a match fits your schedule."/>}
    {hub.availability.slice(0, showAll ? undefined : 8).map(a => <div className="rw-window" key={a.id}><div><strong>{when(a.starts_at)}</strong><p>Until {when(a.ends_at)}</p></div><button disabled={busy} aria-label={`Remove availability ${when(a.starts_at)}`} onClick={() => void run(() => remove(`/referees/me/availability/${a.id}`), 'Availability removed')}>Remove</button></div>)}
    {hub.availability.length > 8 && <button className="rw-inline-link" onClick={() => setShowAll(v => !v)}>{showAll ? 'Show next windows only' : `Show all ${hub.availability.length} windows`}</button>}
    <p className="mx-muted">Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}. Removing a window does not cancel an accepted match.</p>
  </section><section className="mx-panel"><h2>Your commitments</h2><p className="mx-muted">Accepted matches and your personal calendar for the next 30 days.</p>
    {hub.appointments.filter(a => a.status === 'ACCEPTED' && a.event_status === 'SCHEDULED' && Date.parse(a.ends_at_iso)>Date.now() && Date.parse(a.starts_at_iso)<Date.now()+30*86400000).map(a => <button className="rw-commitment" key={a.id} onClick={() => openMatch(a.event_id)}><strong>{a.title}</strong><span>{when(a.starts_at_iso)} · {a.timezone}</span></button>)}
    {error ? <p role="alert">Your personal commitments could not load. <button onClick={retry}>Retry calendar</button></p> : !personal ? <p role="status">Loading personal commitments…</p> : personal.events.filter(e => e.origin !== 'MATCH_EXCHANGE' && e.status !== 'CANCELLED').map(e => <article className="rw-window" key={e.occurrenceId}><div><strong>{e.title}</strong><p>{when(e.startsAt)} – {when(e.endsAt)}</p></div><span className="rw-tag">Personal</span></article>)}
  </section></div><AvailabilityForm reload={reload}/></div>;
}
