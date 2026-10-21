import type { SquadSession } from '../../squadCommunication/api';
import type { ScheduleEventOccurrence, ScheduleEventType } from '../../schedule/api';
import { squadAgenda } from '../fixtures';
import { opponentOf, sessionKind } from './useCoachData';
import type { CoachData } from './CoachWorkspace';

/** One thing on a coach's calendar: a squad session or match (with replies), or a club event that involves the squad. */
export interface CoachEvent {
    key: string; kind: ScheduleEventType; start: Date; end: Date; title: string; short: string; squad: string; squadId: number;
    location: string | null; cancelled: boolean; session?: SquadSession; event?: ScheduleEventOccurrence; opponent?: { id: number | null; name: string } | null;
}

/** The squads shown, as calendar entries: sessions and matches from the squad spaces, and club events from the club calendar. */
export function coachEvents(data: CoachData, squads: { id: number; sessions: SquadSession[] }[] | null = data.squads): CoachEvent[] {
    const entries: CoachEvent[] = [];
    for (const squad of squads ?? []) {
        if (!data.shown.includes(squad.id)) continue;
        const name = data.names.get(squad.id) ?? '';
        for (const session of squad.sessions) {
            const opponent = opponentOf(session, squad.id, data.events, data.clubName);
            entries.push({ key: `s-${session.id}`, kind: sessionKind(session), start: new Date(session.starts_at), end: new Date(session.ends_at || session.starts_at), title: session.title,
                short: opponent ? `vs ${opponent.name}` : session.title, squad: name, squadId: squad.id, location: session.location, cancelled: session.status === 'CANCELLED', session, opponent });
        }
    }
    const shown = data.mine.filter(squad => data.shown.includes(squad.id));
    for (const entry of squadAgenda([], data.events, shown, -Infinity, Infinity)) {
        const event = entry.event;
        if (!event || ['MATCH', 'FRIENDLY', 'TRAINING'].includes(event.eventType)) continue;
        entries.push({ key: entry.key, kind: event.eventType, start: new Date(event.startsAt), end: new Date(event.endsAt), title: event.title, short: event.title, squad: entry.squadName, squadId: entry.squadId,
            location: event.locationName, cancelled: event.status === 'CANCELLED', event });
    }
    return entries.sort((a, b) => a.start.getTime() - b.start.getTime());
}
