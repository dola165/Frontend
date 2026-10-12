import type { BadgeTone } from '../../../design/primitives';
import { formats, label, type Match, type Squad } from '../api';

export interface State { label: string; tone: BadgeTone }

/** Whether the fixture can still be arranged: open or agreed, scheduled and not yet kicked off. */
export const isActive = (m: Match, now: number) => ['OPEN', 'ARRANGED'].includes(m.listing_status) && m.event_status === 'SCHEDULED' && new Date(m.starts_at_iso).getTime() > now;

/**
 * What the viewer can do with a match now, worked out once for the match page and World's match drawer: whether it
 * can still be arranged, whether they can offer to play (with which squads) or must answer an invitation, and
 * whether its result is due (it has ended, or a score waits) or it has at least started.
 */
export function matchGates(m: Match, now: number, squads: Squad[] = []) {
    const active = isActive(m, now);
    const eligible = squads.filter(s => s.club_id !== m.club_id);
    return {
        active, eligible,
        canPropose: m.listing_status === 'OPEN' && !m.requested_club_id && !m.can_manage && eligible.length > 0 && active,
        respond: Boolean(m.can_respond && m.listing_status === 'OPEN' && active),
        finished: new Date(m.ends_at_iso).getTime() <= now || m.result_status === 'PROPOSED' || m.result_status === 'DISPUTED',
        // Before kick-off there is no result to report or suggest.
        started: new Date(m.starts_at_iso).getTime() <= now || Boolean(m.result_status),
    };
}

/** The fixture's state in words, from the viewer's side. */
export function fixtureState(m: Match, now: number): State {
    if (m.event_status === 'CANCELLED' || m.listing_status === 'CANCELLED') return { label: 'Cancelled', tone: 'danger' };
    if (m.event_status === 'COMPLETED' || (m.listing_status === 'ARRANGED' && new Date(m.ends_at_iso).getTime() <= now)) return { label: 'Played', tone: 'neutral' };
    if (m.listing_status === 'ARRANGED') return { label: 'Agreed', tone: 'accent' };
    if (m.listing_status === 'EXPIRED') return { label: 'Expired', tone: 'neutral' };
    if (m.listing_status === 'CLOSED') return { label: m.requested_club_id ? 'Invitation declined' : 'Closed', tone: 'neutral' };
    if (m.requested_club_id) return m.can_respond ? { label: 'Invitation for your club', tone: 'warning' } : { label: 'Invitation sent', tone: 'warning' };
    return { label: 'Looking for an opponent', tone: 'info' };
}

export function groundState(m: Match): State {
    if (m.venue_status === 'BOOKED' || m.venue_status === 'HOST_CONFIRMED') return { label: 'Confirmed', tone: 'accent' };
    if (m.venue_status === 'NEEDS_ATTENTION') return { label: 'Needs attention', tone: 'danger' };
    return { label: m.location_name && !/to be (arranged|agreed|confirmed)/i.test(m.location_name) ? 'To confirm' : 'To be arranged', tone: 'warning' };
}

export function refereeState(m: Match): State {
    if (!m.referee_required || m.referee_status === 'NOT_REQUIRED') return { label: 'Not needed', tone: 'neutral' };
    if (m.external_referee_name) return { label: 'Arranged outside GrassKickZ', tone: 'accent' };
    if (m.referee_status === 'ACCEPTED') return { label: 'Appointed', tone: 'accent' };
    if (m.referee_status === 'INVITED') return { label: 'Invited', tone: 'info' };
    if (m.referee_status === 'REPLACEMENT_NEEDED') return { label: 'Replacement needed', tone: 'danger' };
    return { label: 'Needed', tone: 'warning' };
}

export function hostingText(m: Match) {
    const choice = m.hosting_choice ?? m.venue_preference;
    return choice === 'NEUTRAL' ? 'Neutral ground' : choice === 'FLEXIBLE' ? 'Hosting to be agreed' : m.venue_preference === 'HOME' ? `${m.club_name} host` : m.venue_preference === 'AWAY' ? `${m.club_name} travel` : 'Home or away';
}

/** "U14 · 9-a-side · Development level". */
export const matchFacts = (m: Match) => [m.age_group === 'SENIOR' ? 'Senior' : m.age_group, formats[m.format] ?? label(m.format), `${label(m.level)} level`].filter(Boolean).join(' · ');

const timeFormat = (zone: string) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zone });
const dayFormat = (zone: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: zone });
export const kickoffTime = (m: Match) => timeFormat(m.timezone).format(new Date(m.starts_at_iso));
export const kickoffDay = (m: Match) => dayFormat(m.timezone).format(new Date(m.starts_at_iso));
export const endTime = (m: Match) => timeFormat(m.timezone).format(new Date(m.ends_at_iso));
export const lengthMinutes = (m: Match) => Math.round((Date.parse(m.ends_at_iso) - Date.parse(m.starts_at_iso)) / 60000);
