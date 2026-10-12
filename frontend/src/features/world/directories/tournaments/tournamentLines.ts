import { wt } from '../../copy';
import type { ResultGroup } from '../../directory/groups';
import type { Places } from '../../directory/places';
import type { BrowseLine, DirectoryArea, Placement } from '../../directory/types';
import { codeLabel, dateColumn, factTone, shortDate } from '../../format';
import { peekOf } from '../../peek/usePeek';
import { FORMAT_WORD } from '../../../tournaments/shape/shapeOf';
import { tournamentFact, whatLabel, type TournamentItem } from './tournamentItem';

/** How far "near" reaches for tournaments: the city and the towns a team would travel to for a day. */
export const NEAR_KM = 40;

/** The World area as the backend's distance search (`/competitions` takes up to 500 km). */
export function nearParams(params: URLSearchParams, area?: DirectoryArea) {
    if (!area?.centre) return params;
    params.set('latitude', String(area.centre.lat));
    params.set('longitude', String(area.centre.lng));
    params.set('radiusKm', String(NEAR_KM));
    return params;
}

/** A tournament as one line of the Browse area: its first day, name, what it is and who runs it, and its one fact. Opening it shows its pane. */
export function tournamentLine(item: TournamentItem): BrowseLine {
    const fact = tournamentFact(item);
    return {
        when: dateColumn(item.start), title: item.name, to: `/tournaments/${item.id}`, action: wt('Open tournament'), peek: peekOf('tournament', item.id),
        detail: [item.rules && wt(FORMAT_WORD[item.rules.structure]), ...whatLabel(item).slice(0, 2), item.organizer].filter(Boolean).join(' · '),
        fact: fact.label, factTone: factTone(fact.tone),
    };
}

/** A tournament at its own ground (a trophy pin). One without a known ground stays in the list only. */
export function tournamentPlace(item: TournamentItem, places: Places): Placement | null {
    const at = places.competition(item.id);
    return at ? { lat: at.lat, lng: at.lng, tone: 'tournament', label: item.name, meta: shortDate(item.start) ?? undefined, to: `/tournaments/${item.id}`, action: wt('Open tournament'), noun: ['tournament', 'tournaments'] } : null;
}

const AGE_ORDER = (age: string) => /^U\d+$/.test(age) ? Number(age.slice(1)) : age === 'SENIOR' ? 30 : age === 'VETERANS' ? 31 : 40;

/** All tournaments under their age group, youngest first; finished ones after every age. */
export function ageGroupOf(item: TournamentItem): ResultGroup {
    if (item.status === 'COMPLETED' || item.status === 'CANCELLED') return { key: 'finished', label: 'Finished', rank: 100 };
    const age = item.rules?.ageGroup;
    return age ? { key: `age:${age}`, label: codeLabel(age), rank: AGE_ORDER(age) } : { key: 'age:other', label: 'Other ages', rank: 50 };
}
