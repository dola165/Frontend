import { Link } from 'react-router-dom';
import { useMatchCopy } from '../copy';
import { ArrowRight } from 'lucide-react';
import { fetchMatchListings } from '../../world/api';
import { useWorldData } from '../../world/useWorldData';
import { addMinutes, dayLabel } from './matchPlan';
import '../../world/peek/step.css';

const shift = (date: string, days: number) => addMinutes(`${date}T12:00`, days * 1440).slice(0, 10);

/**
 * Before posting an open match: squads within 50 km of your ground already looking for a game of the same age group
 * within a day of yours, and the way to offer to play one of them instead. Nothing shows when there are none, while it is
 * not known, or when your ground is not on the map (then nothing can be said to be near).
 */
export function BeforeYouPost({ ageGroup, date, near, ownClubId }: { ageGroup: string; date: string; near: { lat: number; lng: number } | null; ownClubId: number | null }) {
    const t = useMatchCopy();
    const from = date ? shift(date, -1) : '', to = date ? shift(date, 1) : '';
    const params = new URLSearchParams({ ageGroup, from, to });
    if (near) { params.set('lat', String(near.lat)); params.set('lng', String(near.lng)); params.set('radiusKm', '50'); }
    // Without our ground on the map there is no "near you" to say: nothing is asked or shown.
    const found = useWorldData(date && near ? `before-post:${params}` : null, signal => fetchMatchListings(params, signal));
    const others = (found.data?.items ?? []).filter(match => match.club_id !== ownClubId && match.requested_club_id == null && match.listing_status === 'OPEN');
    if (!others.length) return null;
    const age = ageGroup === 'SENIOR' ? t('senior') : ageGroup;
    return (
        <Link className="gk-step-line" to={`/world/matches?tab=exchange&ageGroup=${ageGroup}&from=${from}&to=${to}`}>
            <span>{others.length === 1 ? t('1 team near you wants a {age} game around {day}', { age, day: dayLabel(date) }) : t('{count} teams near you want a {age} game around {day}', { count: others.length, age, day: dayLabel(date) })}</span>
            <b>{t('Offer to play instead')}</b><ArrowRight aria-hidden="true" />
        </Link>
    );
}
