import type { AuthSessionId } from '../../../../utils/authStorage';
import { getMatchHistory } from '../../../matchHistory/api';
import type { Match } from '../../../matchExchange/api';
import { mySquads } from '../../../matchExchange/arrange/api';
import { shared, detached } from '../../cache';
import { appLocale } from '../../../../utils/formatting';
import type { ResultGroup } from '../../directory/groups';
import { isoDayOf } from '../../format';
import { listingCode } from '../../scoreboard/matchCode';
import { zonedMatch } from '../../scoreboard/matchState';
import { busyDaysOf, fitOf, fitSquads, type FitSquad } from '../../scoreboard/squadFit';
import { loadAllMine } from './arrangements';
import { longDay } from './matchday';

/** An open match as Matches lists it: the listing, its code, its Georgian day, my squad it suits, and whether that squad already plays that day. */
export interface OpenMatch { m: Match; code: string; day: string; fit: FitSquad | null; busy: boolean }


/** My squads (those I may arrange for), the days each already plays and the listings I have offered on, shared for a minute. */
export const loadMyFit = (sessionId: AuthSessionId) => shared(`my-fit:${sessionId}`, async () => {
    const squads = fitSquads(await mySquads(detached()).catch(() => []));
    const upcoming = squads.length ? (await getMatchHistory('period=UPCOMING&mine=true&size=100', detached(), sessionId).catch(() => ({ items: [] }))).items.map(zonedMatch) : [];
    // Listings I am part of without hosting them: I have offered (or been turned down) already.
    const clubs = new Set(squads.map(squad => squad.clubId));
    const offered = squads.length ? new Set((await loadAllMine('').catch(() => [])).filter(m => !clubs.has(m.club_id)).map(m => m.event_id)) : new Set<number>();
    return { squads, busy: busyDaysOf(upcoming, squads), offered };
});

/** Listings as open matches, each with the squad of mine it suits and whether that squad is free that day. */
export function toOpenMatches(items: Match[], fit: { squads: FitSquad[]; busy: Map<number, Set<string>>; offered?: Set<number> }): OpenMatch[] {
    return items.map(m => {
        const day = isoDayOf(m.starts_at_iso), squad = fit.offered?.has(m.event_id) ? null : fitOf(m, fit.squads);
        return { m, code: listingCode(m.event_id), day, fit: squad, busy: Boolean(squad && fit.busy.get(squad.id)?.has(day)) };
    });
}

/** Below the map, open matches are grouped by their day, soonest first. */
export const dayGroup = (o: OpenMatch): ResultGroup => ({ key: o.day, label: longDay(o.day, appLocale()), rank: Date.parse(`${o.day}T12:00:00Z`) / 1e13 });

/** In the Browse area, by the city they are played in. */
export const cityGroup = (o: OpenMatch): ResultGroup => ({ key: `city:${o.m.city || '?'}`, label: o.m.city || 'City not given' });
