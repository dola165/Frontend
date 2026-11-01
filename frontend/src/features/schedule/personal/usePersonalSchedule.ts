import { getAuthSessionId, subscribeAuthSession } from '../../../utils/authStorage';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ScheduleWorkspaceEvent } from '../../../components/schedule/workspaceTypes';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { fetchMyClubMembershipContext } from '../../clubs/api';
import type { ClubMembershipContext } from '../../clubs/domain';
import { mergeJourneyEntries, useJourneyEntries } from '../../mapPlanning/journeyScheduleData';
import * as squadApi from '../../squadCommunication/api';
import { useSquadSchedule } from '../../squadCommunication/useSquadSchedule';
import { fetchClubSchedule, fetchMySchedule } from '../api';
import { localDateTime } from '../board/scheduleRange';
import { toWorkspaceEvent } from '../board/scheduleEvents';

type Event = ScheduleWorkspaceEvent;

/** Marks personal events that overlap the club calendar, so people see a clash before it happens. */
function withConflicts(personal: Event[], club: Event[]): Event[] {
    return personal.map(event => {
        if (!event.conflictingEventIds.length) return { ...event, conflict: null };
        const source = club.find(c => event.conflictingEventIds.includes(c.eventId) && Date.parse(event.startsAt) < Date.parse(c.endsAt) && Date.parse(event.endsAt) > Date.parse(c.startsAt))
            ?? club.find(c => event.conflictingEventIds.includes(c.eventId));
        if (!source) return { ...event, conflict: { sourceEventId: '', sourceTitle: 'Club schedule', overlapMinutes: 0, severity: 'warning', explanation: 'Overlaps with the club schedule.' } };
        const overlap = Math.max(0, Math.round((Math.min(Date.parse(event.endsAt), Date.parse(source.endsAt)) - Math.max(Date.parse(event.startsAt), Date.parse(source.startsAt))) / 60000));
        return { ...event, conflict: { sourceEventId: source.id, sourceTitle: source.title, overlapMinutes: overlap, severity: overlap >= 45 ? 'critical' : 'warning', explanation: `Overlaps with ${source.title} for ${overlap} minutes.` } };
    });
}

/**
 * Everything on one person's schedule: their own events, their squads' sessions and fixtures
 * (as player, parent or coach) and trips. Club calendar events are read for clash warnings.
 */
export function usePersonalSchedule(from: Date, to: Date) {
    const account = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    const fromTime = from.getTime(), toTime = to.getTime();
    const [revision, setRevision] = useState(0);
    const [context, setContext] = useState<{ account?: string | null; ready: boolean; value: ClubMembershipContext | null; error: string }>({ ready: false, value: null, error: '' });
    const [squads, setSquads] = useState<{ account?: string | null; ready: boolean; items: squadApi.SquadSpace[]; error: string }>({ ready: false, items: [], error: '' });
    const [calendar, setCalendar] = useState<{ key: string; personal: Event[]; club: Event[]; error: string } | null>(null);
    const clubOfOccurrence = useRef(new Map<string, number | null>());

    useEffect(() => {
        let active = true;
        void fetchMyClubMembershipContext().then(value => { if (active) setContext({ account, ready: true, value, error: '' }); })
            .catch(error => { if (active) setContext({ account, ready: true, value: null, error: extractApiErrorMessage(error, 'Your club membership could not load.') }); });
        const controller = new AbortController();
        void squadApi.spaces(controller.signal).then(items => { if (!controller.signal.aborted) setSquads({ account, ready: true, items, error: '' }); })
            .catch(error => { if (!controller.signal.aborted) setSquads({ account, ready: true, items: [], error: extractApiErrorMessage(error, 'Your squads could not load.') }); });
        return () => { active = false; controller.abort(); };
    }, [account, revision]);

    const currentContext = context.account === account ? context : { ready: false, value: null, error: '' };
    const currentSquads = squads.account === account ? squads : { ready: false, items: [], error: '' };
    const clubId = currentContext.value?.clubId ?? null;
    const key = `${account}:${fromTime}:${toTime}:${clubId}:${revision}`;
    useEffect(() => {
        if (!currentContext.ready) return;
        const controller = new AbortController();
        const start = localDateTime(new Date(fromTime)), end = localDateTime(new Date(toTime));
        void Promise.all([fetchMySchedule(start, end, controller.signal), clubId ? fetchClubSchedule(clubId, start, end, controller.signal) : Promise.resolve([])])
            .then(([mine, club]) => {
                if (controller.signal.aborted) return;
                clubOfOccurrence.current = new Map([...mine, ...club].map(event => [event.occurrenceId, event.clubId]));
                setCalendar({ key, personal: mine.map(event => toWorkspaceEvent(event, event.clubId ? event.clubName ?? 'Club' : 'Only you')), club: club.map(event => toWorkspaceEvent(event, currentContext.value?.clubName ?? 'Club')), error: '' });
            })
            .catch(error => { if (!controller.signal.aborted) setCalendar({ key, personal: [], club: [], error: extractApiErrorMessage(error, 'Your schedule could not load.') }); });
        return () => controller.abort();
    }, [currentContext.ready, currentContext.value?.clubName, clubId, fromTime, toTime, key]);

    const squadData = useSquadSchedule(currentSquads.items, localDateTime(from), localDateTime(to), revision);
    const journeys = useJourneyEntries(from.toISOString(), to.toISOString(), revision);
    const current = calendar?.key === key ? calendar : null;
    const events = useMemo(() => {
        const unique = new Map([...(current?.personal ?? []), ...squadData.events].map(event => [event.id, event]));
        return mergeJourneyEntries(withConflicts([...unique.values()], current?.club ?? []), journeys.entries);
    }, [current, squadData.events, journeys.entries]);

    return {
        events, squads: currentSquads.items, context: currentContext.value,
        loading: !current || !currentSquads.ready || (squadData.loading && !squadData.events.length),
        error: currentContext.error || current?.error || currentSquads.error || squadData.error || journeys.error || '',
        isClubEvent: (event: Event) => clubOfOccurrence.current.get(event.id) != null,
        isSquadEvent: (event: Event) => squadData.events.some(item => item.id === event.id),
        reload: () => setRevision(value => value + 1),
    };
}
