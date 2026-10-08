import { useEffect, useState } from 'react';
import { fetchVenues, type Venue } from '../../venues/api';
import { extractApiErrorMessage } from '../../../utils/apiError';
import type { SquadEventPlan } from '../api';
import { useJourneyCopy } from '../journeyCopy';
import { previewTraining, selectionSignature, type BookingPreview, type TrainingSelection } from './api';
import './training-bookings.css';

export interface BookingReview { signature: string; token: string }
export function BookingDates({ preview }: { preview: BookingPreview }) {
    const copy = useJourneyCopy();
    const totals = preview.occurrences.reduce<Record<string, number>>((sum, item) => { if (item.quote) sum[item.quote.currency] = (sum[item.quote.currency] ?? 0) + item.quote.totalPrice; return sum; }, {});
    return <div className="training-booking-review">
        <strong>{preview.occurrences.length} {copy('training dates', 'ვარჯიშის თარიღი')}</strong>
        <ol>{preview.occurrences.map((item, index) => {
            const q = item.quote, timezone = q?.timezone ?? item.bookingTimezone;
            const date = (value?: string) => value ? new Date(value).toLocaleString(undefined, { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }) : '';
            return <li key={item.sessionId ?? index}>
                <strong>{date(item.startsAt ?? item.beforeStartsAt)} – {date(item.endsAt ?? item.beforeEndsAt)}</strong>
                {item.beforeStartsAt && item.startsAt && <span>{copy('Previously', 'წინა დრო')}: {date(item.beforeStartsAt)}</span>}
                {q && <><span>{q.venueName} · {q.pitchName} · {q.timezone}</span><span>{q.totalPrice.toFixed(2)} {q.currency} · {q.status === 'PENDING' ? copy('Venue approval required', 'საჭიროა სტადიონის დადასტურება') : copy('Confirmed when saved', 'შენახვისას დადასტურდება')}</span><small>{copy('Customer cancellation deadline', 'მომხმარებლის გაუქმების ვადა')}: {q.cancellationHours} {copy('hours before start', 'საათი დაწყებამდე')}</small></>}
                {item.bookingStatus && <span>{copy('Current reservation', 'მიმდინარე ჯავშანი')}: {item.bookingStatus.toLowerCase()}</span>}
                {item.bookingStartsAt && <span>{copy('Entire old reservation to release', 'გასათავისუფლებელი სრული ძველი ჯავშანი')}: {date(item.bookingStartsAt)} – {date(item.bookingEndsAt)} · {item.oldTotalPrice?.toFixed(2)} {item.oldCurrency}</span>}
                {item.cancellationDeadline && <small>{copy('Old booking cancellation deadline', 'ძველი ჯავშნის გაუქმების ვადა')}: {date(item.cancellationDeadline)}</small>}
                {(item.issue || q?.issue) && <strong className="training-booking-conflict">{item.issue || q?.issue}</strong>}
                {item.bookingConsequence && <small>{item.bookingConsequence}</small>}
        </li>;
        })}</ol>
        {Object.entries(totals).map(([currency, total]) => <strong key={currency}>{copy('Quoted total for selected dates', 'არჩეული თარიღების საერთო ფასი')}: {total.toFixed(2)} {currency}</strong>)}
        {preview.seriesPolicy && <p>{preview.seriesPolicy}</p>}
        {preview.occurrences.some(item => item.quote?.status === 'PENDING') && <p>{copy('Each request needs venue approval and expires after at most 24 hours, or when the session starts. Check every date before travelling.', 'თითო მოთხოვნას სტადიონის დადასტურება სჭირდება და იწურება არაუგვიანეს 24 საათისა ან სესიის დაწყებისას. გამგზავრებამდე შეამოწმეთ თითო თარიღი.')}</p>}
        {preview.responsePolicy && <p>{preview.responsePolicy} {preview.affectedResponses ?? 0} {copy('existing replies', 'არსებული პასუხი')}.</p>}
        <p>{preview.paymentPolicy}</p>
        {!preview.canCommit && <p role="alert">{copy('Resolve every conflict before saving. No partial series will be created or changed.', 'შენახვამდე მოაგვარეთ ყველა კონფლიქტი. სერია ნაწილობრივ არ შეიქმნება და არ შეიცვლება.')}</p>}
    </div>;
}

export function TrainingVenuePicker({ squadId, plan, selection, onChange, onReviewed }: {
    squadId: number; plan: SquadEventPlan; selection: TrainingSelection | null;
    onChange: (selection: TrainingSelection | null) => void; onReviewed: (review: BookingReview | null) => void;
}) {
    const copy = useJourneyCopy();
    const [venues, setVenues] = useState<Venue[]>([]), [search, setSearch] = useState(''), [page, setPage] = useState(0), [pages, setPages] = useState(0);
    const [chosen, setChosen] = useState<Venue | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false), [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState<{ signature: string; preview: BookingPreview } | null>(null), [failure, setFailure] = useState<{ signature: string; message: string } | null>(null);
    const enabled = selection !== null;
    const signature = selection ? selectionSignature(plan, selection) : '';
    useEffect(() => {
        if (!enabled) return;
        const abort = new AbortController();
        const timer = setTimeout(() => {
            setLoading(true); setError('');
            void fetchVenues({ q: search, page, size: 12 }, abort.signal).then(data => {
                if (!abort.signal.aborted) { setVenues(data.content); setPages(data.totalPages); }
            }).catch(e => { if (!abort.signal.aborted) setError(extractApiErrorMessage(e, 'Venues could not load.')); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
        }, 200);
        return () => { clearTimeout(timer); abort.abort(); };
    }, [enabled, search, page, attempt]);
    useEffect(() => {
        onReviewed(null);
        if (!signature) return;
        const { plan: currentPlan, selection: currentSelection } = JSON.parse(signature) as { plan: SquadEventPlan; selection: TrainingSelection };
        if (!currentSelection.venueId || !currentSelection.pitchId) return;
        const abort = new AbortController();
        const timer = setTimeout(() => { void previewTraining(squadId, currentPlan, currentSelection, abort.signal).then(preview => {
            if (!abort.signal.aborted) { setResult({ signature, preview }); setFailure(null); if (preview.canCommit) onReviewed({ signature, token: preview.quoteToken }); }
        }).catch(e => { if (!abort.signal.aborted) setFailure({ signature, message: extractApiErrorMessage(e, 'The venue preview could not load.') }); }); }, 300);
        return () => { clearTimeout(timer); abort.abort(); };
    }, [signature, squadId, onReviewed, attempt]);
    if (plan.eventType !== 'TRAINING') return null;
    const update = (fields: Partial<TrainingSelection>) => selection && onChange({ ...selection, ...fields });
    const current = result?.signature === signature ? result.preview : null;
    const previewError = failure?.signature === signature ? failure.message : '';
    const venue = chosen?.id === selection?.venueId ? chosen : venues.find(v => v.id === selection?.venueId) ?? null;
    return <section className="training-bookings" aria-label={copy('Training venue booking', 'ვარჯიშის მოედნის დაჯავშნა')}>
        <h3>{copy('Meeting point & pitch', 'შეხვედრის ადგილი და მოედანი')}</h3>
        <label className="training-booking-check"><input type="checkbox" checked={enabled} onChange={e => onChange(e.target.checked ? { venueId: 0, pitchId: 0, contactName: '', contactPhone: '', note: '' } : null)}/>{copy('Reserve a real venue for these dates', 'დაჯავშნეთ მოედანი ამ თარიღებისთვის')}</label>
        {!selection ? <p>{copy('The typed meeting point is descriptive only. It does not reserve a pitch.', 'შეყვანილი შეხვედრის ადგილი მხოლოდ აღწერაა და მოედანს არ ჯავშნის.')}</p> : <>
            <p>{copy('Review every date below. The selected venue and pitch will replace the descriptive meeting point.', 'გადახედეთ ყველა თარიღს. არჩეული სტადიონი და მოედანი ჩაანაცვლებს აღწერილ შეხვედრის ადგილს.')}</p>
            <p>{copy('These are club reservations for this squad. Current authorized squad staff can review and coordinate them after a coach handover.', 'ეს ჯავშნები კლუბისაა და ამ გუნდს ეკუთვნის. მწვრთნელის შეცვლის შემდეგ გუნდის მოქმედ უფლებამოსილ თანამშრომლებს შეუძლიათ მათი გადახედვა და შეთანხმება.')}</p>
            <label>{copy('Find a venue', 'სტადიონის ძებნა')}<input type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder={copy('Venue name or city', 'სახელი ან ქალაქი')}/></label>
            {loading && <p role="status">{copy('Loading venues…', 'სტადიონები იტვირთება…')}</p>}
            {error && <p role="alert">{error}</p>}
            <label>{copy('Venue', 'სტადიონი')}<select aria-label={copy('Venue', 'სტადიონი')} value={selection.venueId || ''} onChange={e => { const venue = venues.find(v => v.id === Number(e.target.value)) ?? null; setChosen(venue); update({ venueId: venue?.id ?? 0, pitchId: 0 }); }}>
                <option value="">{copy('Choose a venue', 'აირჩიეთ სტადიონი')}</option>
                {venue && !venues.some(v => v.id === venue.id) && <option value={venue.id}>{venue.displayName} · {venue.city}</option>}
                {venues.map(v => <option key={v.id} value={v.id}>{v.displayName} · {v.city}</option>)}
            </select></label>
            {!loading && !error && venues.length === 0 && <p>{copy('No matching published venues. Try another name or use a descriptive meeting point.', 'გამოქვეყნებული სტადიონი ვერ მოიძებნა. სცადეთ სხვა სახელი ან აღწერეთ შეხვედრის ადგილი.')}</p>}
            {pages > 1 && <div className="training-booking-actions"><button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)}>{copy('Previous venues', 'წინა სტადიონები')}</button><span>{page + 1} / {pages}</span><button type="button" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>{copy('More venues', 'სხვა სტადიონები')}</button></div>}
            {venue && <><label>{copy('Pitch', 'მოედანი')}<select aria-label={copy('Pitch', 'მოედანი')} value={selection.pitchId || ''} onChange={e => update({ pitchId: Number(e.target.value) })}><option value="">{copy('Choose a pitch', 'აირჩიეთ მოედანი')}</option>{venue.pitches.filter(p => p.active).map(p => <option value={p.id} key={p.id}>{p.name} · {p.pricePerHour} {venue.currency}/{copy('hour', 'საათი')}</option>)}</select></label><small>{venue.timezone} · {venue.minBookingMinutes}–{venue.maxBookingMinutes} {copy('minutes', 'წუთი')} · {copy('Start interval', 'დაწყების ინტერვალი')}: {venue.slotMinutes} {copy('minutes', 'წუთი')}</small></>}
            <div className="training-booking-fields"><label>{copy('Booking contact name', 'ჯავშნის საკონტაქტო სახელი')}<input value={selection.contactName} maxLength={100} onChange={e => update({ contactName: e.target.value })}/></label><label>{copy('Booking contact phone', 'ჯავშნის საკონტაქტო ტელეფონი')}<input type="tel" value={selection.contactPhone} maxLength={60} onChange={e => update({ contactPhone: e.target.value })}/></label></div>
            <small>{copy('Shared with the venue operations team; hidden from players and families.', 'ხელმისაწვდომია სტადიონის ოპერატორებისთვის; დაფარულია მოთამაშეებისა და ოჯახებისთვის.')}</small>
            {selection.pitchId > 0 && !current && !previewError && <p role="status">{copy('Checking every date and price…', 'თარიღებისა და ფასების შემოწმება…')}</p>}
            {previewError && <p role="alert">{previewError}</p>}
            {current && <BookingDates preview={current}/>}
            <button type="button" onClick={() => setAttempt(n => n + 1)}>{copy('Refresh venues & availability', 'სტადიონებისა და დროების განახლება')}</button>
        </>}
    </section>;
}
