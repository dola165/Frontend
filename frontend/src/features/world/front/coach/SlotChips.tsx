import { Link } from 'react-router-dom';
import { appLocale } from '../../../../utils/formatting';
import { useWorldCopy } from '../../copy';
import { slotLink, type SlotChip } from './slots';
import './coach.css';

const clock = (value: string, timeZone: string) => new Date(value).toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit', hour12: false, timeZone });
const weekday = (value: string, timeZone: string) => new Date(value).toLocaleDateString(appLocale(), { weekday: 'short', timeZone });

/** Free slots at one venue as small links ("Tue 18:00") that open its booking calendar on that slot. */
export function SlotChips({ venueId, venueName, slots, timeZone, pitchName, currency, more }: {
    venueId: number; venueName: string; slots: SlotChip[]; timeZone: string; pitchName: (pitchId: number) => string; currency: string; /** Free slots not shown. */ more?: { count: number; to: string };
}) {
    const t = useWorldCopy();
    return (
        <ul className="gk-slots" aria-label={t('Free slots at {venue}', { venue: venueName })}>
            {slots.map(slot => <li key={slot.startsAt}>
                <Link className="gk-slot" to={slotLink(venueId, slot)} title={`${new Date(slot.startsAt).toLocaleDateString(appLocale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone })}, ${clock(slot.startsAt, timeZone)}–${clock(slot.endsAt, timeZone)} · ${pitchName(slot.pitchId)} · ${slot.price} ${currency}`}>
                    {weekday(slot.startsAt, timeZone)} <b>{clock(slot.startsAt, timeZone)}</b>
                </Link>
            </li>)}
            {more && more.count > 0 && <li><Link className="gk-slot" data-more to={more.to} aria-label={t('{count} more free slots at {venue}', { count: more.count, venue: venueName })}>+{more.count}</Link></li>}
        </ul>
    );
}
