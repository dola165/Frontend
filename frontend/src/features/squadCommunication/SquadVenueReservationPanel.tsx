import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import { extractApiErrorMessage } from '../../utils/apiError';
import './squad-venue-reservation.css';
import { TrainingBookingChanges } from './trainingBookings/TrainingBookingChanges';

interface Option {
    id: number; venueId: number; venueName: string; pitchName: string;
    startsAt: string; endsAt: string; timezone: string; totalPrice: number; currency: string;
}
interface Options { revision: number; linked: boolean; options: Option[]; manageBookingPath?: string }

export function SquadVenueReservationPanel({ squadId, sessionId, revision, onSaved }: {
    squadId: number; sessionId: number; revision: number; onSaved: () => void;
}) {
    const { i18n } = useTranslation();
    const georgian = (i18n.resolvedLanguage ?? i18n.language ?? 'en').startsWith('ka');
    const copy = useCallback((en: string, ka: string) => georgian ? ka : en, [georgian]);
    const [data, setData] = useState<Options | null>(null), [error, setError] = useState('');
    const [selected, setSelected] = useState(''), [busy, setBusy] = useState(false), [review, setReview] = useState(false);
    const [reload, setReload] = useState(0);
    const saving = useRef(false), request = useRef<{ key: string; id: string } | null>(null);
    const endpoint = `/squad-communication/${squadId}/sessions/${sessionId}/reservation`;
    useEffect(() => {
        const abort = new AbortController();
        void apiClient.get<Options>(`${endpoint}/options`, { signal: abort.signal }).then(r => {
            if (!abort.signal.aborted) { setData(r.data); setSelected(''); setReview(false); setError(''); }
        }).catch(e => { if (!abort.signal.aborted) { setData(null); setError(extractApiErrorMessage(e, copy('Reservations could not load.', 'ჯავშნების ჩატვირთვა ვერ მოხერხდა.'))); } });
        return () => abort.abort();
    }, [endpoint, revision, reload, copy]);
    const change = async () => {
        if (saving.current || !data) return;
        const key = `${endpoint}:${data.revision}:${data.linked ? 'remove' : selected}`;
        if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
        saving.current = true; setBusy(true); setError('');
        try {
            await apiClient.put(endpoint, { requestId: request.current.id, revision: data.revision, bookingId: data.linked ? null : Number(selected) });
            onSaved(); setReload(n => n + 1);
        } catch (e) { setReview(false); setError(extractApiErrorMessage(e, copy('The reservation link could not be saved. Reload and try again.', 'ჯავშნის მიბმა ვერ შეინახა. განაახლეთ და სცადეთ ხელახლა.'))); }
        finally { saving.current = false; setBusy(false); }
    };
    return <section className="squad-venue-link" aria-label={copy('Session reservation', 'სესიის ჯავშანი')}>
        <h3>{copy('Pitch reservation', 'მოედნის ჯავშანი')}</h3>
        {!data && !error && <p role="status">{copy('Loading your reservations…', 'თქვენი ჯავშნები იტვირთება…')}</p>}
        {data && (data.linked ? <>
            <TrainingBookingChanges squadId={squadId} sessionId={sessionId} revision={revision} onSaved={onSaved}/>
            {data.manageBookingPath && <Link to={data.manageBookingPath}>{copy('Open venue booking', 'ჯავშნის გახსნა')} →</Link>}
            <p>{copy('To keep the venue booking but detach this session, use Remove reservation link below. This clears the meeting point and asks families to confirm again. Personal bookings remain with their booker; club reservations remain with current authorized staff for their recorded squad.', 'ჯავშნის შესანარჩუნებლად და სესიიდან მოსახსნელად გამოიყენეთ მიბმის მოხსნა. ეს შლის შეხვედრის ადგილს და ოჯახებს ხელახლა დადასტურებას სთხოვს. პირადი ჯავშანი მის ავტორს რჩება; კლუბის ჯავშანი შესაბამისი გუნდის მოქმედ უფლებამოსილ თანამშრომლებს რჩებათ.')}</p>
        </> : <>
            <p>{copy('Choose one of your confirmed reservations covering this entire session. Each reservation can be linked to one session. For a series, link each date separately.', 'აირჩიეთ თქვენი დადასტურებული ჯავშანი, რომელიც სესიის სრულ დროს მოიცავს. თითო ჯავშანი ერთ სესიას უკავშირდება. სერიის თითოეული თარიღი ცალკე მიაბით.')}</p>
            {data.options.length ? <label>{copy('Confirmed reservation', 'დადასტურებული ჯავშანი')}<select disabled={busy} value={selected} onChange={e => { setSelected(e.target.value); setReview(false); }}>
                <option value="">{copy('Choose a reservation', 'აირჩიეთ ჯავშანი')}</option>
                {data.options.map(o => <option key={o.id} value={o.id}>{o.venueName} · {o.pitchName} · {new Date(o.startsAt).toLocaleString(undefined, { timeZone: o.timezone })} – {new Date(o.endsAt).toLocaleTimeString(undefined, { timeZone: o.timezone, hour: '2-digit', minute: '2-digit' })} ({o.timezone}) · {o.totalPrice} {o.currency}</option>)}
            </select></label> : <p>{copy('No confirmed, unassigned reservation covers this session yet. Book a pitch, wait for approval if required, then return here and refresh.', 'ამ სესიისთვის ჯერ არ არის დადასტურებული თავისუფალი ჯავშანი. დაჯავშნეთ მოედანი, საჭიროების შემთხვევაში დაელოდეთ დადასტურებას, შემდეგ დაბრუნდით და განაახლეთ.')}</p>}
            <Link to="/stadiums">{copy('Browse stadiums & book', 'სტადიონების ნახვა და დაჯავშნა')} →</Link>
        </>)}
        {review && <p role="status">{data?.linked ? copy('Confirm removing this session’s link. This does not cancel or refund the venue booking.', 'დაადასტურეთ სესიის მიბმის მოხსნა. ეს არ აუქმებს ჯავშანს და არ აბრუნებს თანხას.') : copy('The meeting point will become this venue and pitch. Invited families will be notified and asked to confirm availability again. No new booking or charge is created.', 'შეხვედრის ადგილი გახდება ეს სტადიონი და მოედანი. მოწვეული ოჯახები მიიღებენ შეტყობინებას და ხელახლა დაადასტურებენ ხელმისაწვდომობას. ახალი ჯავშანი ან გადასახადი არ იქმნება.')}</p>}
        <div className="squad-venue-actions">
            {data && (data.linked || selected) && <button type="button" disabled={busy} onClick={() => review ? void change() : setReview(true)}>{busy ? copy('Saving…', 'ინახება…') : review ? copy('Confirm & notify families', 'დადასტურება და ოჯახების შეტყობინება') : data.linked ? copy('Remove reservation link', 'ჯავშნის მიბმის მოხსნა') : copy('Review reservation link', 'ჯავშნის მიბმის გადახედვა')}</button>}
            {review && <button type="button" disabled={busy} onClick={() => setReview(false)}>{copy('Back', 'უკან')}</button>}
            <button type="button" disabled={busy} onClick={() => { setData(null); setReview(false); setReload(n => n + 1); }}>{copy('Refresh reservations', 'ჯავშნების განახლება')}</button>
        </div>
        {error && <p role="alert">{error}</p>}
    </section>;
}
