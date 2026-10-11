import { positionCode } from '../../../../components/squads/squadLabels';
import { appLocale } from '../../../../utils/formatting';
import { wt } from '../../copy';
import type { Places } from '../../directory/places';
import type { BrowseLine, Placement } from '../../directory/types';
import { peekOf } from '../../peek/usePeek';
import type { PersonItem } from './peopleData';
import { openToWords } from './peopleWords';

/** Which of the three person views a result is shown in (referees have their own). */
export type PersonKind = 'staff' | 'specialist' | 'player';

const POSITION_LABEL: Record<string, string> = {
    GOALKEEPER: 'Goalkeeper', CENTER_BACK: 'Centre-back', CENTRE_BACK: 'Centre-back', RIGHT_BACK: 'Right-back', LEFT_BACK: 'Left-back', DEFENSIVE_MIDFIELDER: 'Defensive midfielder',
    CENTRAL_MIDFIELDER: 'Central midfielder', ATTACKING_MIDFIELDER: 'Attacking midfielder', RIGHT_WINGER: 'Right winger', LEFT_WINGER: 'Left winger', STRIKER: 'Striker', FORWARD: 'Forward',
};
export const positionLabel = (position: string | null | undefined) => position ? wt(POSITION_LABEL[position] ?? positionCode(position)) : null;
/** What someone does, in their own words ("Goalkeeper coach"), without the club their headline repeats. */
export const jobOf = (person: PersonItem) => person.profession || person.headline?.split(' · ')[0] || null;
const FOOT: Record<string, string> = { LEFT: 'Left foot', RIGHT: 'Right foot', BOTH: 'Both feet' };
/** A player in a few words: "Striker · 24 · Left foot". */
export const playerLine = (person: PersonItem) =>
    [positionLabel(person.position), person.age != null ? wt('{age} years', { age: person.age }) : null, FOOT[person.foot?.toUpperCase() ?? ''] ? wt(FOOT[person.foot!.toUpperCase()]) : null].filter(Boolean).join(' · ');

/**
 * How far away something is, in a few characters: "6.1 km", "24 km"; "≈" when it is counted at its city's centre.
 * Nothing under a kilometre at a city centre (that is everyone in the city, not someone next door).
 */
export function kmLabel(km: number | null | undefined, approximate = false) {
    if (km == null || !Number.isFinite(km)) return null;
    if (km < 1) return approximate ? null : wt('under 1 km');
    const value = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
    return `${approximate ? '≈' : ''}${wt('{distance} km', { distance: value.toLocaleString(appLocale(), { maximumFractionDigits: 1 }) })}`;
}

/** Where a person is and how far: "Tbilisi · 6.1 km" (from the place the search was made from). */
export const personWhere = (person: PersonItem) => [person.city, kmLabel(person.distanceKm, person.clubId == null)].filter(Boolean).join(' · ');

/** A person as one line of the Browse area: face, name, what they do, and what they are open to. */
export function personLine(person: PersonItem, kind: PersonKind): BrowseLine {
    const open = openToWords(kind, person.openTo);
    const detail = [kind === 'player' ? playerLine(person) : jobOf(person), personWhere(person)].filter(Boolean).join(' · ');
    return { title: person.fullName, crest: { src: person.avatarUrl, name: person.fullName, round: true }, to: `/profile/${person.id}`, action: wt('Open profile'), peek: peekOf('person', person.id),
        detail: detail || undefined, fact: open[0], factTone: open.length ? 'accent' : undefined };
}

const cityPin = (city: string) => `area:${city.trim().toLowerCase()}`;

/** People are counted at their club (its crest in a ring), people without a club at their city; nobody is named. */
export function personPlace(person: PersonItem, places: Places, noun: [string, string]): Placement | null {
    if (person.clubId != null) {
        const club = places.club(person.clubId);
        return club ? { lat: club.lat, lng: club.lng, tone: 'person', pin: `club:${person.clubId}`, approximate: 'club', label: club.name, crest: club.logoUrl ?? person.clubLogoUrl, noun,
            to: `/clubs/${person.clubId}`, action: wt('Open club') } : null;
    }
    return person.centre && person.city ? { lat: person.centre.lat, lng: person.centre.lng, tone: 'person', pin: cityPin(person.city), approximate: 'area', label: person.city, noun } : null;
}
