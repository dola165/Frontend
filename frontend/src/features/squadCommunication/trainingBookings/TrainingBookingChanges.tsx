import { useEffect, useRef, useState } from 'react';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { useJourneyCopy } from '../journeyCopy';
import { bookingContext, previewBookingChange, saveBookingChange, type BookingChange, type BookingContext, type BookingPreview } from './api';
import { BookingDates } from './TrainingVenuePicker';
import type { SeriesScope } from '../api';
import './training-bookings.css';

const localInput = (raw: string) => { const date = new Date(raw); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
export function TrainingBookingChanges({ squadId, sessionId, revision, onSaved }: { squadId: number; sessionId: number; revision: number; onSaved: () => void }) {
    const copy = useJourneyCopy();
    const [context, setContext] = useState<BookingContext | null>(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
    const [action, setAction] = useState<'RESCHEDULE' | 'CANCEL'>('RESCHEDULE'), [scope, setScope] = useState<SeriesScope>('THIS');
    const [start, setStart] = useState(''), [end, setEnd] = useState(''), [reason, setReason] = useState(''), [busy, setBusy] = useState(false);
    const [review, setReview] = useState<{ signature: string; preview: BookingPreview; request: BookingChange } | null>(null);
    const request = useRef<{ signature: string; id: string } | null>(null), saving = useRef(false);
    const signature = JSON.stringify({ revision: context?.revision, action, scope, start, end, reason });
    useEffect(() => {
        const abort = new AbortController();
        void bookingContext(squadId, sessionId, abort.signal).then(value => {
            if (!abort.signal.aborted) { setContext(value); setStart(localInput(value.startsAt)); setEnd(localInput(value.endsAt)); setReview(null); setError(''); }
        }).catch(e => { if (!abort.signal.aborted) setError(extractApiErrorMessage(e, 'Coordinated booking changes could not load.')); });
        return () => abort.abort();
    }, [squadId, sessionId, revision, attempt]);
    const check = async () => {
        if (saving.current || !context) return;
        saving.current = true; setBusy(true); setError(''); setReview(null);
        try {
            if (!reason.trim()) throw new Error(copy('Enter a reason for the change history.', 'მიუთითეთ მიზეზი ცვლილების ისტორიისთვის.'));
            if (action === 'RESCHEDULE' && (!start || !end || localInput(new Date(start).toISOString()) !== start || localInput(new Date(end).toISOString()) !== end)) throw new Error('Choose valid, unambiguous local times.');
            if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
            const data: BookingChange = { requestId: request.current.id, revision: context.revision, scope, action, reason: reason.trim(), ...(action === 'RESCHEDULE' ? { startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() } : {}) };
            const preview = await previewBookingChange(squadId, sessionId, data);setReview({ signature, preview, request: data });
        } catch (e) { setError(extractApiErrorMessage(e, 'The change could not be previewed.')); }
        finally { saving.current = false;setBusy(false); }
    };
    const save = async () => {
        if (saving.current || !review || review.signature !== signature || !review.preview.canCommit) return;
        saving.current = true;setBusy(true);setError('');
        try { await saveBookingChange(squadId, sessionId, { ...review.request, quoteToken: review.preview.quoteToken });setReview(null);onSaved();setAttempt(n => n + 1); }
        catch (e) { setError(extractApiErrorMessage(e, 'The result could not be confirmed. Retry this unchanged request safely, or reload the latest booking.')); }
        finally { saving.current = false;setBusy(false); }
    };
    const current = review?.signature === signature ? review : null;
    return <section className="training-bookings" aria-label={copy('Change training & reservation together', 'ვარჯიშისა და ჯავშნის ერთად შეცვლა')}>
        <h3>{copy('Change training & reservation together', 'ვარჯიშისა და ჯავშნის ერთად შეცვლა')}</h3>
        {!context && !error && <p role="status">{copy('Loading booking authority…', 'ჯავშნის უფლებების ჩატვირთვა…')}</p>}
        {context && !context.canCoordinate && <p>{copy('Current authorized squad staff can coordinate club reservations. A personal reservation stays with its booker; contact them or the venue to arrange a change.', 'კლუბის ჯავშნის შეთანხმება შეუძლია გუნდის მოქმედ უფლებამოსილ თანამშრომელს. პირადი ჯავშანი მის ავტორს რჩება; ცვლილებისთვის დაუკავშირდით მას ან სტადიონს.')}</p>}
        {context?.canCoordinate && <>
            <p>{copy('Club reservations remain available to current authorized squad staff when coaches change. Personal reservations stay with their booker.', 'მწვრთნელის შეცვლისას კლუბის ჯავშანი გუნდის მოქმედ უფლებამოსილ თანამშრომლებს რჩებათ ხელმისაწვდომი. პირადი ჯავშანი მის ავტორს რჩება.')}</p>
            <p>{copy('Preview the old reservation cancellation, replacement availability and family updates before saving. Every selected date succeeds together or nothing changes.', 'შენახვამდე გადახედეთ ძველი ჯავშნის გაუქმებას, ახალი დროის ხელმისაწვდომობას და ოჯახების შეტყობინებებს. ყველა არჩეული თარიღი ერთად იცვლება, ან არაფერი შეიცვლება.')}</p>
            <fieldset disabled={busy}><legend>{copy('Coordinated change', 'შეთანხმებული ცვლილება')}</legend>
                <div className="training-booking-fields"><label>{copy('Action', 'მოქმედება')}<select aria-label={copy('Action', 'მოქმედება')} value={action} onChange={e => setAction(e.target.value as typeof action)}><option value="RESCHEDULE">{copy('Reschedule & replace reservation', 'დროის შეცვლა და ჯავშნის ჩანაცვლება')}</option><option value="CANCEL">{copy('Cancel training & reservation', 'ვარჯიშისა და ჯავშნის გაუქმება')}</option></select></label>
                <label>{copy('Dates to change', 'შესაცვლელი თარიღები')}<select aria-label={copy('Dates to change', 'შესაცვლელი თარიღები')} value={scope} onChange={e => setScope(e.target.value as SeriesScope)}><option value="THIS">{copy('This date only', 'მხოლოდ ეს თარიღი')}</option>{context.series && <><option value="FOLLOWING">{copy('This and following dates', 'ეს და შემდეგი თარიღები')}</option><option value="ALL_FUTURE">{copy('All future dates in this series', 'სერიის ყველა მომავალი თარიღი')}</option></>}</select></label></div>
                {action === 'RESCHEDULE' && <><div className="training-booking-fields"><label>{copy('New start for this date', 'ამ თარიღის ახალი დასაწყისი')}<input type="datetime-local" value={start} onChange={e => setStart(e.target.value)}/></label><label>{copy('New end for this date', 'ამ თარიღის ახალი დასასრული')}<input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)}/></label></div><small>{copy('Input timezone', 'შეყვანის დროის სარტყელი')}: {Intl.DateTimeFormat().resolvedOptions().timeZone}. {copy('Recurring dates shift in the saved series timezone', 'სერიის თარიღები იცვლება შენახულ დროის სარტყელში')}: {context.timezone}.</small><p>{copy('The same pitch is requested at the new time. A venue requiring approval must approve each replacement again.', 'იგივე მოედანი მოითხოვება ახალ დროს. თუ სტადიონი დადასტურებას მოითხოვს, თითო ახალი ჯავშანი ხელახლა უნდა დადასტურდეს.')}</p></>}
                <label>{copy('Reason for the change', 'ცვლილების მიზეზი')}<textarea value={reason} maxLength={500} onChange={e => setReason(e.target.value)}/></label>
            </fieldset>
            <div className="training-booking-actions"><button type="button" disabled={busy} onClick={() => void check()}>{busy ? copy('Checking…', 'მოწმდება…') : copy('Preview every affected date', 'ყველა თარიღის გადახედვა')}</button></div>
            {current && <><BookingDates preview={current.preview}/><button type="button" disabled={busy || !current.preview.canCommit} onClick={() => void save()}>{busy ? copy('Saving…', 'ინახება…') : action === 'CANCEL' ? copy('Confirm cancellation & notify families', 'გაუქმების დადასტურება და ოჯახების შეტყობინება') : copy('Confirm reschedule & notify families', 'დროის შეცვლის დადასტურება და ოჯახების შეტყობინება')}</button></>}
        </>}
        {error && <p role="alert">{error} <button type="button" disabled={busy} onClick={() => setAttempt(n => n + 1)}>{copy('Reload latest booking', 'ჯავშნის განახლება')}</button></p>}
    </section>;
}
