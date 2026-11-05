import type { Participation } from '../../admissions/types';
import type { SquadCalendarEvent } from '../../squadCommunication/useSquadSchedule';
import { parentName } from '../../world/finder/waysIn';
import type { JoiningChild } from '../api';
import { firstName } from './childFacts';

type Copy = (en: string, ka: string) => string;

/**
 * A first visit that waits for the club's checks (the child's current club's permission): reserved, not yet confirmed;
 * the club confirms it once the permission is recorded (owner, 29 October 2026).
 */
export const reservedVisit = (p: Pick<Participation, 'status' | 'introductionPermission'>) =>
    p.status === 'INVITED' && p.introductionPermission?.required === true && !p.introductionPermission.allowsParticipation;

/** The participations that put a child on a club's pitch outside their own squads: first visits and trials. */
const LIVE = ['INVITED', 'CONFIRMED', 'RECONFIRM_REQUIRED', 'ATTENDED', 'CANCELLED'];

/**
 * A child's first visits and trial sessions (admission participations) as calendar entries: pink, named "First visit"
 * (or "First visit · reserved" while the club's checks are open) with the club and the group as a parent reads it, so
 * the family's week shows them beside the squads' sessions. Opening one goes to its request.
 */
export function visitEvents(child: JoiningChild, copy: Copy, who?: string): SquadCalendarEvent[] {
    const title = copy('First visit', 'პირველი ვიზიტი'), reserved = copy('First visit · reserved', 'პირველი ვიზიტი · დაჯავშნილია წინასწარ');
    return child.cases.flatMap(c => c.sessions.filter(p => LIVE.includes(p.status)).map(p => ({
        id: `visit:${p.id}`, eventId: p.id, title: reservedVisit(p) ? reserved : title, subtitle: c.organizationName, eventType: 'TRYOUT' as const,
        startsAt: p.startsAt, endsAt: p.endsAt, locationText: p.location?.name ?? null, locationLat: p.location?.latitude ?? null, locationLng: p.location?.longitude ?? null,
        status: p.status === 'CANCELLED' ? 'CANCELLED' : 'SCHEDULED', visibility: 'CLUB_ONLY' as const, publicationState: 'PRIVATE' as const, recurring: false,
        ownerLabel: parentName(c.groupName) ?? c.groupName, hostSquadName: parentName(c.groupName) ?? c.groupName, who: who ?? firstName(child), mapEligible: false, appearsOnMap: false, conflictingEventIds: [],
    })));
}

/**
 * A squad's short mark on a parent's item: the first word of the club's name for it without its age code ("Mixed" for
 * "U12 Mixed", owner 29 October 2026); the name as written when it is nothing but a code.
 */
export function squadTag(name?: string | null) {
    const own = parentName(name);
    return own ? own.split(/\s+/)[0] : (name ?? '').trim();
}

/** The maps app at the place: by its coordinates when known, else by what the club wrote. */
export function directionsUrl(place?: string | null, lat?: number | null, lng?: number | null) {
    if (lat != null && lng != null) return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    return place ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place)}` : null;
}
