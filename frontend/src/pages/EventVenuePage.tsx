import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { extractApiErrorMessage } from '../utils/apiError';
import { fetchAvailability, fetchMyBookings, fetchVenues, type Booking, type Slot, type Venue } from '../features/venues/api';
import { attachEventVenue, cancelEventVenue, coversEvent, fetchEventVenue, reserveEventVenue, type EventVenueDetail, type EventVenueSourceRef } from '../features/eventVenues/api';
import '../features/eventVenues/event-venues.css';

export function EventVenuePage() {
    const [params] = useSearchParams();
    return <EventVenueWorkspace key={params.toString()} initial={{ type: params.get('type') || '', id: Number(params.get('id')), occurrenceStart: params.get('occurrenceStart') || undefined, timezone: params.get('timezone') || undefined, durationMinutes: Number(params.get('durationMinutes')) || 90 }}/>;
}
function EventVenueWorkspace({ initial }: { initial: EventVenueSourceRef }) {
    const { i18n } = useTranslation();
    const copy = (en: string, ka: string) => i18n.language.startsWith('ka') ? ka : en;
    const [sourceRef, setSourceRef] = useState(initial);
    const [detail, setDetail] = useState<EventVenueDetail | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [success, setSuccess] = useState('');
    const [venues, setVenues] = useState<Venue[]>([]);
    const [venueId, setVenueId] = useState<number | null>(null);
    const venue = venues.find(item => item.id === venueId);
    const [slots, setSlots] = useState<Array<Slot & { pitchId: number; pitchName: string }>>([]);
    const [slotLoading, setSlotLoading] = useState(false);
    const [slotError, setSlotError] = useState('');
    const [selected, setSelected] = useState<number | null>(null);
    const [duration, setDuration] = useState(90);
    const [mine, setMine] = useState<Booking[]>([]);
    const [requestId, setRequestId] = useState(() => crypto.randomUUID());
    const [reload, setReload] = useState(0);
    const source = detail?.source;
    const live = detail?.reservations.some(item => item.state === 'LINKED' && ['PENDING', 'CONFIRMED'].includes(item.bookingStatus));
    const ready = source?.canBook && source.startsAt && source.endsAt && !live;
    const ownBookings = useMemo(() => source ? mine.filter(item => ['PENDING', 'CONFIRMED'].includes(item.status) && coversEvent(item.startsAt, item.endsAt, source)) : [], [mine, source]);

    useEffect(() => {
        let active = true; setLoading(true); setError(''); setSlots([]); setSelected(null); setDetail(null);
        fetchEventVenue(sourceRef).then(value => { if (active) setDetail(value); })
            .catch(e => { if (active) setError(extractApiErrorMessage(e, 'Could not load this event reservation.')); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [sourceRef, reload]);
    useEffect(() => {
        if (!ready) return;
        let active = true;
        Promise.all([fetchVenues({ size: 20 }), fetchMyBookings()]).then(([available, own]) => { if (active) { setVenues(available.content); setMine(own); } })
            .catch(e => { if (active) setError(extractApiErrorMessage(e, 'Could not load stadiums.')); });
        return () => { active = false; };
    }, [ready]);
    useEffect(() => {
        if (!venue || !source?.startsAt || !source.endsAt || !ready) { setSlots([]); return; }
        let active = true; setSlotLoading(true); setSlots([]); setSelected(null); setSlotError('');
        const date = new Intl.DateTimeFormat('sv-SE', { timeZone: venue.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(source.startsAt));
        fetchAvailability(venue.id, date, duration, 1).then(value => {
            if (!active) return;
            setSlots(value.days.flatMap(day => day.pitches.flatMap(pitch => pitch.slots.filter(slot => slot.available && coversEvent(slot.startsAt, slot.endsAt, source))
                .map(slot => ({ ...slot, pitchId: pitch.pitchId, pitchName: venue.pitches.find(item => item.id === pitch.pitchId)?.name || String(pitch.pitchId) })))));
        }).catch(e => { if (active) setSlotError(extractApiErrorMessage(e, 'Could not check availability.')); }).finally(() => { if (active) setSlotLoading(false); });
        return () => { active = false; };
    }, [venue, source, duration, ready]);

    async function mutate(action: () => Promise<EventVenueDetail>) {
        if (busy) return;
        setBusy(true); setError(''); setSuccess('');
        try { setDetail(await action()); setSelected(null); setRequestId(crypto.randomUUID()); setSuccess(copy('Event reservation updated.', 'ღონისძიების ჯავშანი განახლდა.')); }
        catch (e) { setError(extractApiErrorMessage(e, 'Could not update the reservation.')); }
        finally { setBusy(false); }
    }
    function applyTime(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); const values = new FormData(event.currentTarget);
        setVenueId(null); setSourceRef({ ...initial, timezone: String(values.get('timezone') || '') || undefined, durationMinutes: Number(values.get('duration')) || 90, occurrenceStart: String(values.get('occurrence') || '') || initial.occurrenceStart });
    }
    async function search(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); const values = new FormData(event.currentTarget); setBusy(true); setError('');
        try { setVenues((await fetchVenues({ q: String(values.get('query') || ''), size: 20 })).content); setVenueId(null); }
        catch (e) { setError(extractApiErrorMessage(e, 'Could not search stadiums.')); } finally { setBusy(false); }
    }
    function book(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); if (!venue || selected === null || !slots[selected]) return;
        const values = new FormData(event.currentTarget), slot = slots[selected];
        void mutate(() => reserveEventVenue(sourceRef, venue.id, { pitchId: slot.pitchId, startsAt: slot.startsAt, endsAt: slot.endsAt, contactName: String(values.get('name')), contactPhone: String(values.get('phone')), note: String(values.get('note') || ''), kind: 'RENTAL', repeatWeeks: 1, expectedTotalPrice: slot.price, currency: venue.currency, requestId }));
    }
    function chooseVenue(id: number) {
        const next = venues.find(item => item.id === id);
        if (!next || !source?.startsAt || !source.endsAt) return;
        const minutes = (Date.parse(source.endsAt) - Date.parse(source.startsAt)) / 60000;
        setDuration(Math.max(next.minBookingMinutes, Math.ceil(minutes / next.slotMinutes) * next.slotMinutes)); setVenueId(id); setRequestId(crypto.randomUUID());
    }
    const dateTime = (value: string) => new Date(value).toLocaleString(i18n.language.startsWith('ka') ? 'ka-GE' : 'en-GB', { timeZone: source?.timezone || 'UTC' });
    return <main className="ev-page"><Link to={source?.returnPath || '/schedule'}>{copy('Back to event', 'ღონისძიებაზე დაბრუნება')}</Link><h1>{copy('Reserve a pitch for your event', 'ღონისძიებისთვის მოედნის დაჯავშნა')}</h1>
        <p>{copy('The reservation stays connected to the event. A pending request is not a confirmed pitch.', 'ჯავშანი დაკავშირებული იქნება ღონისძიებასთან. მოლოდინში მყოფი მოთხოვნა დადასტურებული ჯავშანი არ არის.')}</p>
        {loading && <p role="status">{copy('Loading event…', 'ღონისძიების ჩატვირთვა…')}</p>}
        {error && <div role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={() => setReload(value => value + 1)}>{copy('Refresh', 'განახლება')}</button></div>}
        {success && <p role="status">{success}</p>}
        {source && <><section><h2>{source.title}</h2><p>{source.localStart?.replace('T', ' ')} – {source.localEnd?.replace('T', ' ')} {source.timezone || copy('(timezone required)', '(საათობრივი სარტყელი აუცილებელია)')}</p>
            {source.timezone && <p>{copy('Reservation times below are shown in', 'ქვემოთ ჯავშნის დრო ნაჩვენებია სარტყელში')} {source.timezone}.</p>}
            <form onSubmit={applyTime} className="ev-form"><label>{copy('Event timezone', 'ღონისძიების საათობრივი სარტყელი')}<input name="timezone" required defaultValue={source.timezone || sourceRef.timezone || ''} placeholder="Europe/London" list="ev-zones"/></label><datalist id="ev-zones"><option value="Europe/London"/><option value="Europe/Tallinn"/><option value="Asia/Tbilisi"/><option value="UTC"/></datalist>
                {source.type === 'TOURNAMENT_FIXTURE' && <label>{copy('Match reservation duration (minutes)', 'მატჩის ჯავშნის ხანგრძლივობა (წუთი)')}<input name="duration" type="number" min={15} max={720} step={15} defaultValue={sourceRef.durationMinutes || 90}/></label>}
                {source.type === 'CLUB_EVENT' && <label>{copy('Occurrence kickoff', 'გამეორების დაწყება')}<input name="occurrence" type="datetime-local" defaultValue={source.localStart?.slice(0, 16) || ''}/></label>}
                <button type="submit" disabled={busy}>{copy('Confirm event time', 'ღონისძიების დროის დადასტურება')}</button>
            </form><p>{copy('If the event is cancelled or its time/location changes, reservations are released while cancellation is allowed. After the deadline, contact the stadium: the original rental still needs resolving.', 'ღონისძიების გაუქმების ან დროის/ადგილის ცვლილებისას ჯავშანი გაუქმდება, თუ ვადა ჯერ არ გასულა. ვადის შემდეგ დაუკავშირდით სტადიონს: ძველი ჯავშანი კვლავ მოსაგვარებელია.')}</p></section>
            {detail.reservations.length > 0 && <section><h2>{copy('Linked reservations', 'დაკავშირებული ჯავშნები')}</h2>{detail.reservations.map(item => <article key={item.id} className="ev-reservation"><h3><Link to={`/stadiums/${item.venueId}?bookingId=${item.bookingId}`}>{item.venueName} · {item.pitchName}</Link></h3><p>{dateTime(item.startsAt)} – {dateTime(item.endsAt)}</p><strong>{item.state === 'NEEDS_ATTENTION' ? copy('Action required — previous rental still active', 'საჭიროა მოქმედება — წინა ჯავშანი კვლავ აქტიურია') : item.state === 'RELEASED' ? copy('Released', 'გაუქმებული') : item.bookingStatus === 'PENDING' ? copy('Awaiting stadium confirmation', 'სტადიონის დადასტურების მოლოდინში') : copy('Confirmed', 'დადასტურებული')}</strong>{item.reason && <p>{item.reason}</p>}{item.venuePhone && <p>{copy('Stadium contact:', 'სტადიონის კონტაქტი:')} {item.venuePhone}</p>}{item.canCancel && <button type="button" disabled={busy} onClick={() => void mutate(() => cancelEventVenue(item.id, sourceRef))}>{copy('Cancel reservation', 'ჯავშნის გაუქმება')}</button>}</article>)}</section>}
            {!source.canBook && <p>{copy('This event is cancelled, completed, or already started. Its reservations remain visible above.', 'ეს ღონისძიება გაუქმებულია, დასრულებულია ან უკვე დაწყებულია. მისი ჯავშნები ჩანს ზემოთ.')}</p>}
            {ready && <><section><h2>{copy('Choose a stadium', 'აირჩიეთ სტადიონი')}</h2><form onSubmit={search} className="ev-form"><label>{copy('Search stadiums', 'სტადიონების ძიება')}<input name="query" maxLength={200}/></label><button disabled={busy}>{copy('Search', 'ძიება')}</button></form><div className="ev-options">{venues.map(item => <button key={item.id} type="button" aria-pressed={venueId === item.id} onClick={() => chooseVenue(item.id)}>{item.displayName} · {item.city}</button>)}</div>
                {venue && <><p>{copy('Stadium timezone:', 'სტადიონის საათობრივი სარტყელი:')} {venue.timezone} · {copy('Cancellation deadline:', 'გაუქმების ვადა:')} {venue.cancellationHours} {copy('hours before kickoff', 'საათით ადრე')}</p><label>{copy('Pitch rental duration (minutes)', 'მოედნის ქირაობის ხანგრძლივობა (წუთი)')}<input type="number" min={venue.minBookingMinutes} max={venue.maxBookingMinutes} step={venue.slotMinutes} value={duration} onChange={event => { setDuration(Number(event.target.value)); setRequestId(crypto.randomUUID()); }}/></label>{slotLoading && <p role="status">{copy('Checking availability…', 'ხელმისაწვდომობის შემოწმება…')}</p>}{slotError && <p role="alert">{slotError}</p>}{!slotLoading && !slotError && slots.length === 0 && <p>{copy('No available pitch covers this event. Try another stadium or a longer rental duration.', 'თავისუფალი მოედანი ამ დროს არ არის. სცადეთ სხვა სტადიონი ან გაზარდეთ ქირაობის ხანგრძლივობა.')}</p>}<div className="ev-options">{slots.map((slot, index) => <button type="button" key={`${slot.pitchId}-${slot.startsAt}`} aria-pressed={selected === index} onClick={() => { setSelected(index); setRequestId(crypto.randomUUID()); }}>{slot.pitchName} · {dateTime(slot.startsAt)} – {dateTime(slot.endsAt)} · {slot.price} {venue.currency}</button>)}</div>
                {selected !== null && slots[selected] && <form onSubmit={book} className="ev-form"><label>{copy('Contact name', 'საკონტაქტო სახელი')}<input name="name" required maxLength={100}/></label><label>{copy('Phone', 'ტელეფონი')}<input name="phone" required maxLength={60}/></label><label>{copy('Note for stadium', 'შენიშვნა სტადიონისთვის')}<textarea name="note" maxLength={2000}/></label><button disabled={busy}>{venue.bookingMode === 'REQUEST' ? copy('Request this pitch for event', 'ღონისძიებისთვის მოედნის მოთხოვნა') : copy('Reserve this pitch for event', 'ღონისძიებისთვის მოედნის დაჯავშნა')}</button></form>}</>}
            </section><section><h2>{copy('Use an existing reservation', 'არსებული ჯავშნის გამოყენება')}</h2><p>{copy('Only your active reservations covering the entire event are listed.', 'ნაჩვენებია მხოლოდ თქვენი აქტიური ჯავშნები, რომლებიც ღონისძიების მთელ დროს ფარავს.')}</p>{ownBookings.length === 0 && <p>{copy('No matching reservations.', 'შესაბამისი ჯავშნები არ არის.')}</p>}{ownBookings.map(item => <div className="ev-reservation" key={item.id}><p>{item.venueName} · {item.pitchName} · {dateTime(item.startsAt)}</p><button disabled={busy} onClick={() => void mutate(() => attachEventVenue(sourceRef, item.id))}>{copy('Link reservation', 'ჯავშნის დაკავშირება')} #{item.id}</button></div>)}</section></>}
        </>}
    </main>;
}
