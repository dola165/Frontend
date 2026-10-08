import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, HeartHandshake, MapPin, Plus, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { extractApiErrorMessage } from '../utils/apiError';
import * as api from '../features/volunteers/api';
import { ExtensionDemoLabel } from '../features/capabilities/ExtensionBoundary';
import { isExtensionCapabilityAvailable } from '../features/capabilities/extensions';
import '../features/volunteers/volunteers.css';

const message = (error: unknown) => extractApiErrorMessage(error, 'This could not be saved. Please try again.');
const positiveId = (value: string | null) => value && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : undefined;
const date = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const localInput = (value: string) => { const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };

export function VolunteerContextLink({ eventId, tournamentId }: { eventId?: number; tournamentId?: number }) {
  if (!isExtensionCapabilityAvailable('volunteerShifts')) return null;
  return <Link to={`/volunteering?${eventId ? `eventId=${eventId}` : `tournamentId=${tournamentId}`}`}><HeartHandshake size={16} /> Volunteer shifts<ExtensionDemoLabel capability="volunteerShifts" /></Link>;
}
export function VolunteerPage() {
  const { sessionId } = useAuth();
  return <VolunteerWorkspace key={sessionId} />;
}
function VolunteerWorkspace() {
  const [params, setParams] = useSearchParams();
  const rawView = params.get('view');
  const view: api.VolunteerView = rawView === 'mine' || rawView === 'manage' ? rawView : 'discover';
  const eventId = positiveId(params.get('eventId')), tournamentId = positiveId(params.get('tournamentId')), selectedId = positiveId(params.get('shift'));
  const [result, setResult] = useState<api.VolunteerPageResult | null>(null), [sources, setSources] = useState<api.VolunteerSource[]>([]);
  const [page, setPage] = useState(0), [revision, setRevision] = useState(0), [error, setError] = useState(''), [sourceError, setSourceError] = useState('');
  const [creating, setCreating] = useState(false), [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void api.listShifts(view, page, eventId, tournamentId, controller.signal).then(setResult).catch(e => { if (!controller.signal.aborted) setError(message(e)); });
    return () => controller.abort();
  }, [view, page, eventId, tournamentId, revision]);
  useEffect(() => {
    const controller = new AbortController();
    void api.getSources(controller.signal).then(setSources).catch(e => { if (!controller.signal.aborted) setSourceError(message(e)); });
    return () => controller.abort();
  }, [revision]);
  const refresh = () => { setError(''); setRevision(r => r + 1); };
  const select = (id?: number) => { setCreating(false); const next = new URLSearchParams(params); if (id) next.set('shift', String(id)); else next.delete('shift'); setParams(next); };
  const chooseView = (value: api.VolunteerView) => { setResult(null); setError(''); setPage(0); const next = new URLSearchParams(params); next.set('view', value); next.delete('shift'); setParams(next); setCreating(false); };
  const changed = (text: string) => { setNotice(text); refresh(); };
  return <main className="volunteer-page">
    <header className="volunteer-heading"><div><span className="volunteer-eyebrow">Community football</span><h1><HeartHandshake aria-hidden="true" /> Volunteering</h1><p>Find a shift, reserve your place and help make matchday happen.</p></div>{sources.length > 0 && <button className="volunteer-primary" onClick={() => { select(); setCreating(true); }}><Plus size={18} /> Create a shift</button>}</header>
    <p className="volunteer-note">Looking to referee a match? <Link to="/referees/me#open-requests">Open referee requests and officiating workspace</Link></p>
    <p className="volunteer-note">Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}. Signups require an active account aged 13 or older. Confirmations, changes and reminders appear in your GrassKickZ notifications.</p>
    {notice && <p className="volunteer-notice" role="status">{notice}</p>}
    {sourceError && <p role="alert">Coordinator events could not be loaded. {sourceError} <button onClick={() => { setSourceError(''); refresh(); }}>Retry</button></p>}
    <nav className="volunteer-tabs" aria-label="Volunteer views">{([['discover', 'Find a shift'], ['mine', 'My commitments'], ['manage', 'Coordinate']] as const).map(([key, title]) => <button key={key} aria-pressed={view === key} onClick={() => chooseView(key)}>{title}</button>)}</nav>
    {(eventId || tournamentId) && <p className="volunteer-note">Showing shifts for this {eventId ? 'club event' : 'tournament'}. <Link to="/volunteering">Browse all events</Link></p>}
    {creating ? <ShiftEditor sources={sources} eventId={eventId} tournamentId={tournamentId} onClose={() => setCreating(false)} onSaved={shift => { select(shift.id); changed('Your volunteer shift is ready.'); }} />
      : selectedId ? <ShiftDetail key={selectedId} id={selectedId} onBack={() => select()} onChanged={changed} />
        : <>
          {error ? <div className="volunteer-empty" role="alert"><p>{error}</p><button onClick={refresh}>Try again</button></div> : !result ? <p role="status">Loading volunteer shifts…</p> : result.items.length ? <div className="volunteer-grid">{result.items.map(shift => <ShiftCard key={shift.id} shift={shift} onOpen={() => select(shift.id)} />)}</div> : <div className="volunteer-empty"><HeartHandshake size={36} /><h2>{view === 'mine' ? 'Your first shift starts here' : view === 'manage' ? 'Bring your volunteers together' : 'No upcoming shifts here yet'}</h2><p>{view === 'mine' ? 'Reserve a place on a shift to see it here, including any later changes or cancellations.' : view === 'manage' ? 'Create a shift for a club event or tournament you coordinate. Set the time, places and shared tasks.' : 'Coordinators can publish shifts for their events and tournaments. Check back for new opportunities.'}</p>{view === 'manage' && sources.length === 0 && <p>Create an upcoming club calendar event or become tournament staff first. <Link to="/tournaments">Browse tournaments</Link></p>}{view === 'mine' && <button onClick={() => chooseView('discover')}>Find a shift</button>}</div>}
          {(page > 0 || result?.hasMore) && <div className="volunteer-pagination"><button disabled={page === 0} onClick={() => { setResult(null); setError(''); setPage(p => p - 1); }}>Previous</button><span>Page {page + 1}</span><button disabled={!result?.hasMore} onClick={() => { setResult(null); setError(''); setPage(p => p + 1); }}>Next</button></div>}
        </>}
  </main>;
}
function ShiftCard({ shift, onOpen }: { shift: api.VolunteerShift; onOpen: () => void }) {
  return <article className="volunteer-card"><div className="volunteer-card-top"><span>{shift.sourceTitle}</span>{shift.signedUp && <strong><CheckCircle2 size={14} /> You're signed up</strong>}</div><h2><button onClick={onOpen}>{shift.title}</button></h2><p><CalendarDays size={17} /> {date(shift.startsAt)}</p><p><MapPin size={17} /> {shift.meetingPoint || 'Meeting point to be confirmed'}</p><p><Users size={17} /> {shift.status === 'CANCELLED' ? 'Cancelled' : `${shift.signupCount} of ${shift.capacity} places filled`}</p><p className="volunteer-description">{shift.description}</p><button className="volunteer-open" onClick={onOpen}>{shift.canManage ? 'Manage shift' : 'View shift'} →</button></article>;
}
function ShiftDetail({ id, onBack, onChanged }: { id: number; onBack: () => void; onChanged: (text: string) => void }) {
  const [shift, setShift] = useState<api.VolunteerShift | null>(null), [error, setError] = useState(''), [pending, setPending] = useState(false), [editing, setEditing] = useState(false), [cancelReason, setCancelReason] = useState(''), [cancelling, setCancelling] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => { const controller = new AbortController(); void api.getShift(id, controller.signal).then(setShift).catch(e => { if (!controller.signal.aborted) setError(message(e)); }); return () => controller.abort(); }, [id, retry]);
  const run = async (action: () => Promise<api.VolunteerShift>, success: string) => { setPending(true); setError(''); try { setShift(await action()); setCancelling(false); onChanged(success); } catch (e) { setError(message(e)); } finally { setPending(false); } };
  if (!shift) return <section className="volunteer-panel"><button onClick={onBack}>← All shifts</button>{error ? <p role="alert">{error} <button onClick={() => { setError(''); setRetry(n => n + 1); }}>Try again</button></p> : <p role="status">Loading shift…</p>}</section>;
  if (editing) return <ShiftEditor initial={shift} sources={[]} onClose={() => setEditing(false)} onSaved={saved => { setShift(saved); setEditing(false); onChanged('Shift updated. Confirmed volunteers have been notified.'); }} />;
  const past = new Date(shift.startsAt).getTime() <= Date.now();
  return <section className="volunteer-panel">
    <button className="volunteer-back" onClick={onBack}>← All shifts</button>
    <span className="volunteer-eyebrow">{shift.sourceTitle}</span><h2>{shift.title}</h2>
    {shift.status === 'CANCELLED' && <p className="volunteer-alert" role="status"><strong>This shift is cancelled.</strong> {shift.cancellationReason}</p>}
    <div className="volunteer-facts"><div><CalendarDays /><strong>When</strong><span>{date(shift.startsAt)} – {date(shift.endsAt)}</span></div><div><MapPin /><strong>Meeting point</strong><span>{shift.meetingPoint || 'To be confirmed'}</span></div><div><Users /><strong>Volunteers</strong><span>{shift.signupCount} confirmed · {Math.max(0, shift.capacity - shift.signupCount)} places remaining</span></div></div>
    <p className="volunteer-detail-description">{shift.description}</p>
    {shift.tournamentId && <Link to={`/tournaments/${shift.tournamentId}`}>View tournament →</Link>}
    {error && <p className="volunteer-alert" role="alert">{error}</p>}
    <div className="volunteer-actions">{shift.signedUp ? <><strong><CheckCircle2 size={18} /> You're signed up</strong><button disabled={pending} onClick={() => void run(() => api.withdrawShift(id), 'Your place has been released.')}>Withdraw from shift</button></> : shift.canJoin ? <button className="volunteer-primary" disabled={pending} onClick={() => void run(() => api.joinShift(id), 'Your volunteer place is confirmed.')}>Reserve my place</button> : <span>{shift.status === 'CANCELLED' ? 'This shift is closed.' : past ? 'This shift has started.' : shift.signupCount >= shift.capacity ? 'This shift is full. Check back if a place opens.' : 'Signups are closed for this event.'}</span>}
      {shift.canManage && shift.status === 'OPEN' && <>{!past && <button disabled={pending} onClick={() => setEditing(true)}>Edit shift</button>}<button disabled={pending} onClick={() => setCancelling(true)}>Cancel shift</button></>}
    </div>
    {cancelling && <form className="volunteer-cancel" onSubmit={e => { e.preventDefault(); void run(() => api.cancelShift(id, cancelReason.trim()), 'Shift cancelled. Confirmed volunteers have been notified.'); }}><label>Reason for cancellation<textarea required maxLength={500} value={cancelReason} onChange={e => setCancelReason(e.target.value)} /></label><p>All confirmed volunteers will receive this reason in their notifications.</p><button disabled={pending || !cancelReason.trim()}>Confirm cancellation</button><button type="button" disabled={pending} onClick={() => setCancelling(false)}>Keep shift</button></form>}
    <section className="volunteer-task-section"><h3>Shared tasks</h3>{shift.tasks.length ? <ul className="volunteer-tasks">{shift.tasks.map(task => <li key={task.id}><label><input type="checkbox" checked={task.completed} disabled={pending || !task.canToggle} onChange={e => void run(() => api.setTaskComplete(id, task.id, e.target.checked), 'Task updated.')} /><span>{task.label}</span></label></li>)}</ul> : <p>No shared tasks added yet.</p>}<p className="volunteer-note">Signed-up volunteers can complete shared tasks. A completed task can be reopened by its completing volunteer or a coordinator.</p></section>
    {shift.canManage && <section className="volunteer-roster"><h3>Confirmed volunteers ({shift.volunteers.length})</h3><p className="volunteer-note">Only event coordinators can see this list.</p>{shift.volunteers.length ? <ul>{shift.volunteers.map(volunteer => <li key={volunteer.id}><strong>{volunteer.name}</strong><span>Joined {date(volunteer.signedUpAt)}</span></li>)}</ul> : <p>No volunteers have signed up yet.</p>}</section>}
  </section>;
}
function ShiftEditor({ initial, sources, eventId, tournamentId, onClose, onSaved }: { initial?: api.VolunteerShift; sources: api.VolunteerSource[]; eventId?: number; tournamentId?: number; onClose: () => void; onSaved: (shift: api.VolunteerShift) => void }) {
  const [source, setSource] = useState(initial ? `${initial.eventId ? 'EVENT' : 'TOURNAMENT'}:${initial.eventId ?? initial.tournamentId}` : eventId ? `EVENT:${eventId}` : tournamentId ? `TOURNAMENT:${tournamentId}` : sources[0] ? `${sources[0].kind}:${sources[0].id}` : '');
  const [title, setTitle] = useState(initial?.title ?? ''), [description, setDescription] = useState(initial?.description ?? ''), [meetingPoint, setMeetingPoint] = useState(initial?.meetingPoint ?? ''), [startsAt, setStartsAt] = useState(initial ? localInput(initial.startsAt) : ''), [endsAt, setEndsAt] = useState(initial ? localInput(initial.endsAt) : ''), [capacity, setCapacity] = useState(initial?.capacity ?? 5), [tasks, setTasks] = useState(initial?.tasks.map(t => t.label).join('\n') ?? ''), [pending, setPending] = useState(false), [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt) || new Date(startsAt) <= new Date()) { setError('Choose a future start and an end after the start.'); return; }
    const [kind, rawId] = source.split(':'); const sourceId = Number(rawId);
    if (!Number.isSafeInteger(sourceId) || sourceId <= 0) { setError('Choose an event you coordinate.'); return; }
    const labels = tasks.split('\n').map(t => t.trim()).filter(Boolean);
    if (labels.length > 30 || labels.some(t => t.length > 200) || new Set(labels).size !== labels.length) { setError('Add up to 30 unique tasks, each no longer than 200 characters.'); return; }
    setPending(true);
    try { onSaved(await api.saveShift({ eventId: kind === 'EVENT' ? sourceId : null, tournamentId: kind === 'TOURNAMENT' ? sourceId : null, title: title.trim(), description: description.trim(), meetingPoint: meetingPoint.trim(), startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), capacity, tasks: labels }, initial?.id)); } catch (e) { setError(message(e)); } finally { setPending(false); }
  };
  const selectedSource = sources.find(s => `${s.kind}:${s.id}` === source);
  return <form className="volunteer-panel volunteer-editor" onSubmit={e => void submit(e)}><h2>{initial ? 'Edit volunteer shift' : 'Create a volunteer shift'}</h2>
    {initial ? <p>For {initial.sourceTitle}</p> : <label>Club event or tournament<select required value={source} onChange={e => setSource(e.target.value)}><option value="">Choose an event</option>{sources.map(s => <option key={`${s.kind}:${s.id}`} value={`${s.kind}:${s.id}`}>{s.title} · {s.kind === 'EVENT' ? 'Club event' : 'Tournament'}</option>)}</select></label>}
    {selectedSource && <p className="volunteer-note">{selectedSource.visibility === 'PUBLIC' ? 'This shift will be discoverable by signed-in GrassKickZ users.' : 'This event is private. Only its coordinators and already confirmed volunteers can see this shift. Make the event public to recruit more volunteers.'}</p>}
    <label>Shift title<input required maxLength={140} value={title} onChange={e => setTitle(e.target.value)} placeholder="Welcome desk, equipment team, pitch setup…" /></label>
    <label>What volunteers will do<textarea maxLength={3000} value={description} onChange={e => setDescription(e.target.value)} /></label>
    <div className="volunteer-form-row"><label>Starts at<input required type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} /></label><label>Ends at<input required type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} /></label><label>Places<input required type="number" min={initial?.signupCount || 1} max={500} value={capacity} onChange={e => setCapacity(Number(e.target.value))} /></label></div>
    <label>Meeting point<input maxLength={255} value={meetingPoint} onChange={e => setMeetingPoint(e.target.value)} placeholder="Main entrance, pitch 2…" /></label>
    <label>Shared tasks — one per line<textarea rows={4} value={tasks} onChange={e => setTasks(e.target.value)} placeholder={'Set up the registration desk\nCollect equipment after the last match'} /></label>
    <p className="volunteer-note">{initial ? 'Confirmed volunteers are notified when you save changes. Existing task completion is preserved when its name stays the same.' : 'Signup is confirmed immediately while places remain. Volunteers cannot reserve overlapping shifts.'}</p>
    {error && <p role="alert" className="volunteer-alert">{error}</p>}
    <div className="volunteer-actions"><button className="volunteer-primary" disabled={pending || !title.trim() || !source}>{pending ? 'Saving…' : initial ? 'Save changes' : 'Publish shift'}</button><button type="button" disabled={pending} onClick={onClose}>Cancel</button></div>
  </form>;
}
