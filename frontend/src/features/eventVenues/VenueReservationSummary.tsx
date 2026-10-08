import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './event-venues.css';

export interface VenueReservationSummaryValue {
    venueId: number; venueName: string; pitchName: string;
    status: 'CONFIRMED' | 'PENDING' | 'UNAVAILABLE'; startsAt: string; endsAt: string; timezone: string;
    unavailableReason?: 'DECLINED' | 'CANCELLED' | 'EXPIRED' | 'VENUE_UNAVAILABLE';
}

export function VenueReservationSummary({ value }: { value?: VenueReservationSummaryValue | null }) {
    const { i18n } = useTranslation();
    const copy = (en: string, ka: string) => i18n.language.startsWith('ka') ? ka : en;
    if (!value) return null;
    if (value.status === 'UNAVAILABLE') return <aside className="ev-summary" aria-label={copy('Stadium reservation', 'სტადიონის ჯავშანი')}>
        <strong>{copy('Venue reservation no longer confirmed', 'მოედნის ჯავშანი აღარ არის დადასტურებული')}</strong>
        {value.unavailableReason === 'DECLINED' && <span>{copy('The venue declined this pitch request.', 'სტადიონმა მოედნის მოთხოვნა უარყო.')}</span>}
        {value.unavailableReason === 'CANCELLED' && <span>{copy('The pitch reservation was cancelled.', 'მოედნის ჯავშანი გაუქმებულია.')}</span>}
        {value.unavailableReason === 'EXPIRED' && <span>{copy('The pitch request expired without confirmation.', 'მოედნის მოთხოვნის ვადა დადასტურების გარეშე ამოიწურა.')}</span>}
        <span>{copy('Check the latest coach or organizer update before travelling.', 'გამგზავრებამდე შეამოწმეთ მწვრთნელის ან ორგანიზატორის ბოლო განახლება.')}</span>
    </aside>;
    const time = (raw: string) => new Date(raw).toLocaleString(i18n.language.startsWith('ka') ? 'ka-GE' : 'en-GB', { timeZone: value.timezone, dateStyle: 'medium', timeStyle: 'short' });
    return <aside className="ev-summary" aria-label={copy('Stadium reservation', 'სტადიონის ჯავშანი')}>
        <strong>{value.status === 'CONFIRMED' ? copy('Pitch confirmed', 'მოედანი დადასტურებულია') : copy('Pitch awaiting stadium confirmation', 'მოედანი სტადიონის დადასტურებას ელოდება')}</strong>
        <Link to={`/stadiums/${value.venueId}`}>{value.venueName} · {value.pitchName}</Link>
        <span>{time(value.startsAt)} – {time(value.endsAt)} · {value.timezone}</span>
        {value.status === 'PENDING' && <span>{copy('This request is not yet a confirmed venue.', 'ეს მოთხოვნა ჯერ არ არის დადასტურებული ჯავშანი.')}</span>}
    </aside>;
}
