import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { fetchMatchListings } from '../../world/api';
import { useWorldData } from '../../world/useWorldData';
import { addMinutes, dayLabel } from './matchPlan';
import '../../world/peek/step.css';

const shift = (date: string, days: number) => addMinutes(`${date}T12:00`, days * 1440).slice(0, 10);

/**
 * Before posting an open match: squads near you (within 50 km of your ground, when it is on the map) already looking for
 * a game of the same age group within a day of yours, and the way to offer to play one of them instead. Nothing shows
 * when there are none, or while it is not known.
 */
export function BeforeYouPost({ ageGroup, date, near, ownClubId }: { ageGroup: string; date: string; near: { lat: number; lng: number } | null; ownClubId: number | null }) {
    const from = date ? shift(date, -1) : '', to = date ? shift(date, 1) : '';
    const params = new URLSearchParams({ ageGroup, from, to });
    if (near) { params.set('lat', String(near.lat)); params.set('lng', String(near.lng)); params.set('radiusKm', '50'); }
    const found = useWorldData(date ? `before-post:${params}` : null, signal => fetchMatchListings(params, signal));
    const others = (found.data?.items ?? []).filter(match => match.club_id !== ownClubId && match.requested_club_id == null && match.listing_status === 'OPEN');
    if (!others.length) return null;
    const age = ageGroup === 'SENIOR' ? 'senior' : ageGroup;
    return (
        <Link className="gk-step-line" to={`/world/matches?tab=exchange&ageGroup=${ageGroup}&from=${from}&to=${to}`}>
            <span>{others.length === 1 ? `1 team near you wants a ${age} game around ${dayLabel(date)}` : `${others.length} teams near you want a ${age} game around ${dayLabel(date)}`}</span>
            <b>Offer to play instead</b><ArrowRight aria-hidden="true" />
        </Link>
    );
}
