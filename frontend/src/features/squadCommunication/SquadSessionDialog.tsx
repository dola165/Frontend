import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { CalendarDays, Clock3, MapPin, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDialogFocus } from '../../components/workspace/useDialogFocus';
import { formatDate, formatDateTime } from '../../utils/formatting';
import { extractApiErrorMessage } from '../../utils/apiError';
import type { CalendarSquad, SquadCalendarEvent } from './useSquadSchedule';
import * as api from './api';
import { VenueReservationSummary } from '../eventVenues/VenueReservationSummary';
import { SquadVenueReservationPanel } from './SquadVenueReservationPanel';
import { scheduleDestination } from '../schedule/origin';
import { ScheduleResult } from '../matchHistory/ScheduleResult';
import { useJourneyCopy } from './journeyCopy';
import { SquadEventEditComposer, SeriesScope } from './SquadEventEditComposer';
import { IntroductoryVisitors } from './IntroductoryVisitors';
import './journey-actions.css';
import './session-details.css';
import { getAuthSessionId, subscribeAuthSession } from '../../utils/authStorage';
import { acknowledgeReply, beginReply, readUncertainReply, replyScope, requireReplyScope, reviewNewReply, ReplyRecoveryError, type UncertainReply } from './availabilityRecovery';

export function SessionDialog({ title, children, onClose, busy = false, detail = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean; detail?: boolean }) {
    const ref = useRef<HTMLDivElement>(null);
    const copy = useJourneyCopy();
    useDialogFocus(true, ref, () => { if (!busy) onClose(); });
    return <div className="squad-schedule-overlay"><div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`squad-schedule-dialog${detail ? ' session-details' : ''}`}>
        <header><div>{detail && <p className="session-eyebrow">{copy('Squad event', 'გუნდის ღონისძიება')}</p>}<h2>{title}</h2></div><button type="button" aria-label={copy('Close session details', 'სესიის დეტალების დახურვა')} disabled={busy} onClick={onClose}><X size={20}/></button></header>{children}
    </div></div>;
}
const Dialog = SessionDialog;

export function SquadSessionDetails({ event, playerId, canManage = false, onClose, onSaved }: {
    event: SquadCalendarEvent; playerId?: number; canManage?: boolean; onClose: () => void; onSaved: () => void;
}) {
    const copy = useJourneyCopy();
    const destination = scheduleDestination(event);
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [cancel, setCancel] = useState(false), [reason, setReason] = useState('');
    const [saved, setSaved] = useState(false);
    const [editing, setEditing] = useState(false), [preview, setPreview] = useState<api.SessionConsequence | null>(null);
    const [scope,setScope] = useState<api.SeriesScope>('THIS');
    const [seriesPreview,setSeriesPreview] = useState<api.SeriesPreview|null>(null);
    const [cancellationReview,setCancellationReview] = useState<string|null>(null);
    const cancellation = useRef<{ signature: string; id: string } | null>(null);
    const authSessionId = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    const [replyRequests, setReplyRequests] = useState(new Map<number, UncertainReply>());
    const [replyRecoveryErrors, setReplyRecoveryErrors] = useState(new Set<number>());
    const [recovered, setRecovered] = useState(false);
    useEffect(() => {
        const scope = replyScope(), pending = new Map<number, UncertainReply>(), unreadable = new Set<number>();
        if (scope && event.session && event.squadId) for (const person of event.session.attendance) {
            try {
                const command = readUncertainReply(scope, event.squadId, event.session.id, person.id);
                if (command) pending.set(person.id, command);
            } catch (e) { unreadable.add(person.id); setError(extractApiErrorMessage(e, 'The earlier reply could not be recovered.')); }
        }
        setReplyRequests(pending);
        setReplyRecoveryErrors(unreadable);
    }, [authSessionId, event.squadId, event.session?.id, event.session?.attendance]);
    const sendReply = async (command: UncertainReply) => {
        requireReplyScope(command);
        await api.attendance(command.squadId, command.occurrenceId, command.playerId, command.response, command.revision, command.requestId, command.sessionId);
        acknowledgeReply(command);
        setReplyRequests(previous => {
            const next = new Map(previous);
            if (next.get(command.playerId)?.requestId === command.requestId) next.delete(command.playerId);
            return next;
        });
    };
    const saving = useRef(false);
    const act = async (action: () => Promise<unknown>, recovery = false) => {
        if (saving.current) return; saving.current = true; setBusy(true); setError(''); setSaved(false); setRecovered(false);
        try { await action(); setRecovered(recovery); setSaved(true); onSaved(); } catch (e) { setError(e instanceof ReplyRecoveryError ? e.message : extractApiErrorMessage(e, copy('Your change could not be saved.', 'ცვლილების შენახვა ვერ მოხერხდა.'))); }
        finally { saving.current = false; setBusy(false); }
    };
    if (editing && event.session) return <SquadEventEditComposer squad={{ id: event.squadId!, name: event.hostSquadName ?? 'Squad' }} session={event.session} onClose={() => setEditing(false)} onSaved={onSaved}/>;
    return <Dialog title={event.title} onClose={onClose} busy={busy} detail>
        <div className="session-context"><span>{event.hostSquadName}</span><span className="session-type">{event.eventType?.replaceAll('_', ' ').toLowerCase()}</span></div>
        <div className="session-time-card"><div className="session-date-tile"><span>{formatDate(event.startsAt,{month:'short'})}</span><strong>{formatDate(event.startsAt,{day:'2-digit'})}</strong></div><div><p className="session-eyebrow"><CalendarDays size={13}/>{formatDate(event.startsAt,{weekday:'long'})}</p><strong>{formatDate(event.startsAt,{day:'numeric',month:'long',year:'numeric'})}</strong><p><Clock3 size={15}/>{formatDate(event.startsAt,{hour:'2-digit',minute:'2-digit'})} – {new Date(event.startsAt).toDateString() === new Date(event.endsAt).toDateString() ? formatDate(event.endsAt,{hour:'2-digit',minute:'2-digit'}) : formatDateTime(event.endsAt)}</p><small>{Intl.DateTimeFormat().resolvedOptions().timeZone}</small></div></div>
        {!event.session?.venue_reservation && event.locationText && <div className="session-location"><MapPin size={20}/><div><span className="session-eyebrow">{copy('Where to meet', 'შეხვედრის ადგილი')}</span><strong>{event.locationText}</strong></div></div>}
        {event.description && <div className="session-coach-note"><span className="session-eyebrow">{copy('Session notes', 'სესიის შენიშვნები')}</span><p>{event.description}</p></div>}
        <VenueReservationSummary value={event.session?.venue_reservation}/>
        {!event.session && <ScheduleResult event={event} clubId={event.owningClubId} onSaved={onSaved} />}
        {destination && <Link to={destination}>{copy('Open match details & next actions', 'მატჩის დეტალები და შემდეგი ნაბიჯები')} →</Link>}
        {event.session && <p className="session-reply-help">{event.session.response_requested === false ? copy('No availability reply is requested for this event.', 'ამ ღონისძიებაზე ხელმისაწვდომობის პასუხი არ მოითხოვება.') : copy('Replies express plans to attend. They do not record actual attendance.', 'პასუხი გამოხატავს დასწრების გეგმას და არა ფაქტობრივ დასწრებას.')}{canManage && event.session.response_requested !== false && ` ${copy('Replies you enter are labelled as recorded by the coach.', 'თქვენი შეყვანილი პასუხი მოინიშნება, როგორც მწვრთნელის მიერ ჩაწერილი.')}`}</p>}
        {event.session?.series_id && <p className="squad-schedule-series-note">{event.session.response_requested === false ? copy('Part of a repeating series.', 'განმეორებადი სერიის ნაწილია.') : copy('Part of a repeating series. Availability is recorded separately for each date.', 'განმეორებადი სერიის ნაწილია. ხელმისაწვდომობა თითოეულ თარიღზე ცალკე ინახება.')}</p>}
        {canManage&&event.session&&event.squadId&&<IntroductoryVisitors squadId={event.squadId} sessionId={event.session.id} revision={event.session.revision} visitors={event.session.introductory_visitors??[]} onSaved={onSaved}/>}
        {saved && <p className="session-saved" role="status">{recovered ? copy('Earlier reply checked. Latest reply loaded.', 'წინა პასუხი შემოწმდა. ბოლო პასუხი ჩაიტვირთა.') : copy('Reply saved.', 'პასუხი შენახულია.')}</p>}
        {error && <p role="alert">{error} <button type="button" onClick={onSaved}>{copy('Reload latest session', 'სესიის განახლება')}</button></p>}
        {canManage && event.session && event.status !== 'CANCELLED' && new Date(event.startsAt) > new Date() && <SquadVenueReservationPanel key={`${event.session.id}:${event.session.revision}`} squadId={event.squadId!} sessionId={event.session.id} revision={event.session.revision} onSaved={onSaved}/>}
        {event.session?.attendance.filter(person => (playerId == null || person.id === playerId) && (replyRequests.has(person.id) || replyRecoveryErrors.has(person.id))).map(person => {
            const command = replyRequests.get(person.id);
            return <section className="session-reply-recovery" key={person.id} aria-label={`${copy('Earlier reply for', 'წინა პასუხი მოთამაშისთვის')} ${person.name}`}>
                <p>{copy('An earlier reply may have been saved.', 'წინა პასუხი შესაძლოა შენახული იყოს.')} {person.name}{command && <>: {command.response === 'GOING' ? copy('Going', 'დავესწრები') : command.response === 'NOT_GOING' ? copy('Can’t make it', 'ვერ დავესწრები') : copy('Not sure yet', 'ჯერ არ ვიცი')}</>}.</p>
                {command && command.revision !== event.session!.revision && <p>{copy('The session changed. Retrying checks the reply you originally reviewed.', 'სესია შეიცვალა. ხელახალი ცდა ამოწმებს თავდაპირველ პასუხს.')}</p>}
                {command && <button type="button" disabled={busy} onClick={() => void act(() => sendReply(command), true)}>{copy('Retry earlier reply', 'წინა პასუხის ხელახლა შემოწმება')}</button>}
                <button type="button" disabled={busy} onClick={() => {
                    const scope = replyScope(); if (!scope) return;
                    reviewNewReply(scope, event.squadId!, event.session!.id, person.id);
                    setReplyRequests(previous => { const next = new Map(previous); next.delete(person.id); return next; });
                    setReplyRecoveryErrors(previous => { const next = new Set(previous); next.delete(person.id); return next; });
                    setError(''); onSaved();
                }}>{copy('Review a new reply', 'ახალი პასუხის განხილვა')}</button>
            </section>;
        })}
        {event.status === 'CANCELLED' ? <p className="squad-schedule-notice">{copy('Cancelled', 'გაუქმებულია')}{event.session?.cancellation_reason && ` · ${event.session.cancellation_reason}`}</p> : <>
            {event.session && new Date(event.endsAt) <= new Date() && <p role="status">{copy('This session has ended. Its replies are read-only.', 'ეს სესია დასრულდა. პასუხების შეცვლა შეუძლებელია.')}</p>}
            {event.session?.response_requested !== false && event.session?.attendance.filter(person => playerId == null || person.id === playerId).map(person => <label className="family-attendance" data-response={person.response} key={person.id}>
                <span>{person.name} · {copy('planning to attend?', 'გეგმავს დასწრებას?')}{person.response_status === 'RECONFIRMATION_REQUIRED' && <small>{copy('Session changed. Please confirm again', 'სესია შეიცვალა. გთხოვთ, ხელახლა დაადასტუროთ')} ({copy('previous reply', 'წინა პასუხი')}: {person.previous_response === 'GOING' ? copy('going', 'დაესწრება') : person.previous_response === 'NOT_GOING' ? copy('can’t make it', 'ვერ დაესწრება') : copy('unsure', 'ჯერ არ იცის')}).</small>}{person.previous_response && <small className="journey-reply-source">{person.recorded_by === 'COACH' ? copy('Recorded by the coach', 'ჩაწერილია მწვრთნელის მიერ') : person.recorded_by === 'GUARDIAN' ? copy('Replied by guardian', 'პასუხი მეურვისგან') : person.recorded_by === 'PLAYER' ? copy('Replied by player', 'პასუხი მოთამაშისგან') : copy('Reply recorded; source not recorded', 'პასუხი ჩაწერილია; წყარო მითითებული არ არის')}</small>}</span><select aria-label={`${copy('Reply for', 'პასუხი მოთამაშისთვის')} ${person.name}`} value={person.response} disabled={busy || replyRequests.has(person.id) || replyRecoveryErrors.has(person.id) || person.active === false || new Date(event.endsAt) <= new Date()}
                    onChange={e => {
                        const response = e.target.value;
                        void act(async () => {
                            const scope = replyScope();
                            if (!scope) throw new ReplyRecoveryError('Reopen the session in your current account before replying.');
                            const request = beginReply(scope, event.squadId!, event.session!.id, person.id, response, event.session!.revision);
                            setReplyRequests(previous => new Map(previous).set(person.id, request));
                            await sendReply(request);
                        });
                    }}>
                    <option value="RECONFIRMATION_REQUIRED" disabled>{copy('Please confirm again', 'დაადასტურეთ ხელახლა')}</option><option value="INVALIDATED" disabled>{copy('Invitation removed', 'მოწვევა გაუქმებულია')}</option>
                    <option value="UNANSWERED" disabled>{copy('No reply yet', 'ჯერ პასუხი არ არის')}</option><option value="GOING">{copy('Going', 'დავესწრები')}</option><option value="NOT_GOING">{copy('Can’t make it', 'ვერ დავესწრები')}</option><option value="UNSURE">{copy('Not sure yet', 'ჯერ არ ვიცი')}</option>
                </select></label>)}
            {canManage && event.session && new Date(event.endsAt) > new Date() && (cancel ? <form onSubmit={async e => {
                e.preventDefault(); if (saving.current) return;
                const signature = JSON.stringify([event.session!.id, event.session!.revision, reason, scope]);
                if (cancellation.current?.signature !== signature) cancellation.current = { signature, id: crypto.randomUUID() };
                saving.current = true; setBusy(true); setError('');
                try {
                    if (event.session!.series_id) {
                        const data = { cancellation: { requestId:cancellation.current.id, revision:event.session!.revision, reason },scope,expected:seriesPreview?.expected };
                        if (!seriesPreview || cancellationReview !== signature) { setSeriesPreview(await api.previewSeriesCancellation(event.squadId!,event.session!.id,data)); setCancellationReview(signature); }
                        else { await api.cancelSeries(event.squadId!,event.session!.id,data); onSaved(); }
                    } else if (!preview || preview.revision !== event.session!.revision) setPreview(await api.previewCancellation(event.squadId!, event.session!.id, event.session!.revision, reason, cancellation.current.id));
                    else { await api.cancelSession(event.squadId!, event.session!.id, event.session!.revision, reason, cancellation.current.id); onSaved(); }
                } catch (e) { setError(extractApiErrorMessage(e, copy('The cancellation could not be saved.', 'გაუქმების შენახვა ვერ მოხერხდა.'))); }
                finally { saving.current = false; setBusy(false); }
            }}>
                {event.session.series_id && <SeriesScope disabled={busy} value={scope} onChange={value=>{setScope(value);setSeriesPreview(null);}}/>}
                <label>{copy('Cancellation reason', 'გაუქმების მიზეზი')}<input required disabled={busy} maxLength={500} value={reason} onChange={e => { setReason(e.target.value); setPreview(null);setSeriesPreview(null); }}/></label>
                {preview && <Consequence value={preview}/>}
                {seriesPreview && <p role="status">{seriesPreview.eventCount} {copy('events will be cancelled.', 'ღონისძიება გაუქმდება.')} {seriesPreview.notificationDeliveries} {copy('notifications will be sent. Past events remain unchanged.', 'შეტყობინება გაიგზავნება. წარსული ღონისძიებები უცვლელია.')}</p>}
                <button disabled={busy || !reason.trim()} type="submit">{preview || seriesPreview ? copy('Confirm cancellation & notify participants', 'გაუქმების დადასტურება და მონაწილეების შეტყობინება') : copy('Preview cancellation', 'გაუქმების წინასწარი ნახვა')}</button><button type="button" disabled={busy} onClick={() => setCancel(false)}>{copy('Keep session', 'სესიის შენარჩუნება')}</button>
            </form> : <><button type="button" onClick={() => setEditing(true)}>{copy('Edit or reschedule', 'შეცვლა ან გადატანა')}</button><button type="button" onClick={() => setCancel(true)}>{copy('Cancel session', 'სესიის გაუქმება')}</button></>)}
        </>}
    </Dialog>;
}

function Consequence({ value }: { value: api.SessionConsequence }) {
    const copy = useJourneyCopy();
    return <p role="status">{value.responsePolicy === 'PRESERVE' ? copy('Existing replies will stay valid.', 'არსებული პასუხები ძალაში დარჩება.') : `${value.affectedParticipants} ${copy('participants and', 'მონაწილეს და')} ${value.affectedResponses} ${copy('replies affected.', 'პასუხს ეხება ცვლილება.')} ${value.responsePolicy === 'INVALIDATE' ? copy('Replies will no longer count; the session will close.', 'პასუხები აღარ ჩაითვლება; სესია დაიხურება.') : copy('Previous replies will be kept, but participants must confirm again.', 'წინა პასუხები შენარჩუნდება, მაგრამ მონაწილეებმა ხელახლა უნდა დაადასტურონ.')}`} {value.notificationRecipients} {copy('people will be notified.', 'ადამიანი მიიღებს შეტყობინებას.')} {value.addedParticipants} {copy('added;', 'დაემატება;')} {value.removedParticipants} {copy('removed.', 'ამოიშლება.')}</p>;
}

export function SquadSessionEditor({ squad, date, session, onClose, onSaved }: { squad: CalendarSquad; date: Date; session?: api.SquadSession; onClose: () => void; onSaved: () => void }) {
    const copy = useJourneyCopy();
    const initial = new Date(date); initial.setHours(18, 0, 0, 0);
    const local = (value: Date) => new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const [title, setTitle] = useState(session?.title ?? copy('Training', 'ვარჯიში')), [start, setStart] = useState(session ? local(new Date(session.starts_at)) : local(initial)), [end, setEnd] = useState(session ? local(new Date(session.ends_at)) : local(new Date(initial.getTime() + 90 * 60000))), [location, setLocation] = useState(session?.location ?? '');
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const [people, setPeople] = useState<api.Person[] | null>(null), [playerIds, setPlayerIds] = useState(session?.attendance.filter(p => p.active !== false).map(p => p.id) ?? []);
    const [audienceChanged, setAudienceChanged] = useState(false);
    const [rosterRevision, setRosterRevision] = useState(0);
    const [preview, setPreview] = useState<{ signature: string; value: api.SessionConsequence } | null>(null);
    const signature = JSON.stringify([title, start, end, location, playerIds, audienceChanged, session?.revision]);
    const reviewed = preview?.signature === signature ? preview.value : null;
    useEffect(() => {
        const abort = new AbortController();
        void api.overview(squad.id, abort.signal).then(value => { if (!abort.signal.aborted) setPeople(value.players); }).catch(e => { if (!abort.signal.aborted) setError(extractApiErrorMessage(e, 'The current roster could not load.')); });
        return () => abort.abort();
    }, [squad.id, session, rosterRevision]);
    const saving = useRef(false), request = useRef<{ signature: string; id: string } | null>(null);
    return <Dialog title={`${session ? copy('Edit session', 'სესიის შეცვლა') : copy('New session', 'ახალი სესია')} · ${squad.name}`} onClose={onClose} busy={busy}><form onSubmit={async e => {
        e.preventDefault(); if (saving.current) return;
        if (new Date(end) <= new Date(start)) { setError(copy('End time must be after the start.', 'დასრულების დრო დაწყების შემდეგ უნდა იყოს.')); return; }
        saving.current = true; setBusy(true); setError('');
        if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
        try {
            const data = { requestId: request.current.id, title,
                startsAt: session && start === local(new Date(session.starts_at)) ? session.starts_at : new Date(start).toISOString(),
                endsAt: session && end === local(new Date(session.ends_at)) ? session.ends_at : new Date(end).toISOString(), location };
            if (session) {
                const change = { ...data, revision: session.revision, playerIds: audienceChanged ? playerIds : null };
                if (!reviewed) { setPreview({ signature, value: await api.previewSession(squad.id, session.id, change) }); return; }
                await api.editSession(squad.id, session.id, change);
            } else await api.createSession(squad.id, data);
            onSaved();
        }
        catch (error) { setError(extractApiErrorMessage(error, copy('The session could not be saved.', 'სესიის შენახვა ვერ მოხერხდა.'))); }
        finally { saving.current = false; setBusy(false); }
    }}>
        <label>{copy('Session title', 'სესიის სათაური')}<input required disabled={busy} maxLength={140} value={title} onChange={e => setTitle(e.target.value)}/></label>
        <label>{copy('Starts', 'დაწყება')}<input required disabled={busy} type="datetime-local" value={start} onChange={e => setStart(e.target.value)}/></label>
        <label>{copy('Ends', 'დასრულება')}<input required disabled={busy} type="datetime-local" value={end} onChange={e => setEnd(e.target.value)}/></label>
        <label>{copy('Meeting point', 'შეხვედრის ადგილი')}<input disabled={busy} maxLength={300} value={location} onChange={e => setLocation(e.target.value)}/></label>
        {session ? <fieldset disabled={busy || !people}><legend>{copy('Invited players', 'მოწვეული მოთამაშეები')}</legend>{people?.map(person => <label key={person.id}><input type="checkbox" checked={playerIds.includes(person.id)} onChange={e => { setAudienceChanged(true); setPlayerIds(ids => e.target.checked ? [...ids, person.id].sort((a, b) => a - b) : ids.filter(id => id !== person.id)); }}/>{person.name}</label>)}<p>{copy('To move this session to another squad, cancel it and create a new session there.', 'სხვა გუნდში გადასატანად გააუქმეთ ეს სესია და იქ ახალი შექმენით.')}</p></fieldset>
            : <div className="journey-roster"><strong>{copy('Invitations', 'მოწვევები')}</strong><p>{copy('This private session invites the current eligible squad roster when saved. Only invited players and their authorized guardians see it and receive notifications. Later roster additions are not automatically invited.', 'ამ პირად სესიაზე შენახვისას მოწვეული იქნება გუნდის მიმდინარე უფლებამოსილი შემადგენლობა. მას ხედავენ და შეტყობინებას იღებენ მხოლოდ მოწვეული მოთამაშეები და მათი უფლებამოსილი მეურვეები. მოგვიანებით დამატებული მოთამაშეები ავტომატურად არ მოიწვევიან.')}</p><p>{people ? people.map(person => person.name).join(' · ') || copy('No eligible players yet.', 'ჯერ უფლებამოსილი მოთამაშეები არ არიან.') : copy('Loading current roster…', 'მიმდინარე შემადგენლობა იტვირთება…')}</p><p>{copy('One session only. For another date, create another family session. Weekly club entries do not collect family replies.', 'მხოლოდ ერთი სესია. სხვა თარიღისთვის შექმენით ახალი ოჯახის სესია. კლუბის ყოველკვირეული ჩანაწერები ოჯახის პასუხებს არ აგროვებს.')}</p></div>}
        <p>{copy('Times shown in', 'დროის სარტყელი')}: {Intl.DateTimeFormat().resolvedOptions().timeZone}. {session ? copy('Review the consequences before saving.', 'შენახვამდე გადახედეთ შედეგებს.') : copy('Invited families receive a notification when you save.', 'შენახვისას მოწვეული ოჯახები მიიღებენ შეტყობინებას.')}</p>
        {reviewed && <Consequence value={reviewed}/>}
        {error && <p role="alert">{error} {!people && <button type="button" onClick={() => { setError(''); setRosterRevision(n => n+1); }}>{copy('Retry roster', 'შემადგენლობის ხელახლა ჩატვირთვა')}</button>} {session && <button type="button" onClick={onSaved}>{copy('Reload latest session', 'სესიის განახლება')}</button>}</p>}<button className="schedule-direction-primary" disabled={busy || !people}>{busy ? copy('Working…', 'მუშავდება…') : session ? reviewed ? copy('Confirm changes', 'ცვლილებების დადასტურება') : copy('Preview changes', 'ცვლილებების წინასწარი ნახვა') : copy('Create session & notify families', 'სესიის შექმნა და ოჯახების შეტყობინება')}</button>
    </form></Dialog>;
}
