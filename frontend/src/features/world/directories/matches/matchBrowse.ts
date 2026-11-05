import { eventDestination, type EventItem } from '../../../requests/api';
import { wt } from '../../copy';
import type { Places } from '../../directory/places';
import type { BrowseLine, LineSide } from '../../directory/types';
import { EVENT_BADGE, factTone, fixtureDay } from '../../format';
import { endOf } from '../../scoreboard/form';
import { peekOf } from '../../peek/usePeek';
import { matchPagePath } from '../../scoreboard/matchCode';
import { matchState } from '../../scoreboard/matchState';
import type { Fixture } from './fixtures';
import { eventWhen, fixtureTitle } from './matchPlaces';

export const HOSTING: Record<string, string> = { HOME: 'They host', AWAY: 'They travel', EITHER: 'Either ground' };
const TAG_TONE = { danger: 'danger', warning: 'warning', neutral: undefined } as const;

/**
 * A fixture as one line of the Browse area: when (or its state), the two sides stacked with their crests, my team
 * starred and the score once it counts, and what is owed.
 */
export function fixtureLine({ m, code, mine, showDay }: Fixture, places?: Places): BrowseLine {
    const state = matchState(m, Date.now(), mine.home || mine.away);
    const sameSquad = Boolean(m.homeSquadName && m.homeSquadName === m.awaySquadName);
    const side = (end: 'home' | 'away'): LineSide => {
        const team = endOf(m, end);
        return { name: team.club ? (sameSquad || !team.squad ? team.club : `${team.club} ${team.squad}`) : wt('To be decided'), crest: places?.club(team.clubId)?.logoUrl ?? null,
            mine: mine[end], score: state.score?.[end] ?? null };
    };
    return {
        when: { time: 'time' in state.when ? state.when.time : wt(state.when.word), day: showDay ? fixtureDay(m.startsAt, m.timezone) : undefined },
        sides: { home: side('home'), away: side('away') }, title: fixtureTitle(m), to: matchPagePath(m), action: wt('Open match'), peek: peekOf('match', code),
        detail: [m.homeSquadName && m.homeSquadName === m.awaySquadName ? m.homeSquadName : null, m.tournamentName, m.locationName].filter(Boolean).join(' · '),
        fact: state.tag && state.code !== 'before' ? wt(state.tag.word, state.tag.vars) : undefined, factTone: state.tag ? TAG_TONE[state.tag.tone] : undefined,
    };
}


/** What opening an event leads to, by where its destination goes. A club calendar event is a match only when it is one. */
const EVENT_ACTION: Record<EventItem['kind'], string> = { TOURNAMENT: 'Open tournament', SCHEDULE: 'Open event', SESSION: 'Open squad', TRYOUT: 'See trials' };
const eventAction = (item: EventItem) => item.kind === 'SCHEDULE' && item.activity === 'MATCH' ? 'Open match' : EVENT_ACTION[item.kind];

/** A published event on the fixture line, its kind on the right. */
export function eventLine(item: EventItem): BrowseLine {
    const badge = EVENT_BADGE[item.activity] ?? EVENT_BADGE.OTHER;
    return { when: eventWhen(item), title: item.name, action: wt(eventAction(item)),
        to: eventDestination(item) ?? undefined, detail: [item.context, item.location].filter(Boolean).join(' · '), fact: wt(badge.label), factTone: factTone(badge.tone) };
}
