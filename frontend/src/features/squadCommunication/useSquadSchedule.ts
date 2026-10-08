import { useEffect, useState } from 'react';
import { fetchClubSchedule, type ScheduleEventOccurrence } from '../schedule/api';
import type { ScheduleWorkspaceEvent } from '../../components/schedule/workspaceTypes';
import { extractApiErrorMessage } from '../../utils/apiError';
import * as api from './api';
import { apiClient } from '../../api/axiosConfig';

export type CalendarSquad = Pick<api.SquadSpace, 'id' | 'name'> & Partial<api.SquadSpace>;
export type SquadCalendarEvent = ScheduleWorkspaceEvent & { squadId?: number; owningClubId?: number | null; session?: api.SquadSession };

export function sessionEvent(squad: CalendarSquad, session: api.SquadSession): SquadCalendarEvent {
    const rental = session.venue_reservation;
    const location = rental ? rental.status === 'CONFIRMED' ? `${rental.venueName} · ${rental.pitchName}` : null : session.location;
    return { id: `squad:${squad.id}:${session.id}`, eventId: session.id, origin: 'SQUAD_SESSION', title: session.title,
        eventType: session.event_type ?? 'TRAINING', description: session.description, startsAt: session.starts_at, endsAt: session.ends_at, locationText: location,
        status: session.status, visibility: 'CLUB_ONLY', publicationState: 'PRIVATE', recurring: !!session.series_id, seriesId: session.series_id, responseSummary: session.response_requested === false ? undefined : { total: session.attendance.filter(p => p.active !== false).length, going: session.attendance.filter(p => p.active !== false && p.response === 'GOING').length, pending: session.attendance.filter(p => p.active !== false && ['UNANSWERED', 'RECONFIRMATION_REQUIRED'].includes(p.response)).length },
        ownerLabel: squad.name, hostSquadId: squad.id, hostSquadName: squad.name, squadId: squad.id, session,
        mapEligible: false, appearsOnMap: false, conflictingEventIds: [] };
}

function assignedEvent(event: ScheduleEventOccurrence, squad: CalendarSquad): SquadCalendarEvent {
    return { id: event.occurrenceId, eventId: event.eventId, origin: event.origin, originId: event.originId, title: event.title, description: event.description,
        homeScore: event.homeScore, awayScore: event.awayScore, resultStatus: event.resultStatus, matchExchangeId: event.matchExchangeId, canRecordResult: event.canRecordResult, resultClubId: event.resultClubId,
        eventType: event.eventType, startsAt: event.startsAt, endsAt: event.endsAt, locationText: event.locationName,
        status: event.status, visibility: event.visibility === 'PRIVATE' ? 'CLUB_ONLY' : event.visibility,
        publicationState: event.publicNow ? 'LIVE' : event.publishAt ? 'QUEUED' : 'PRIVATE',
        recurring: event.recurring, recurrence: event.recurrence, ownerLabel: squad.name,
        hostSquadId: squad.id, hostSquadName: squad.name, squadId: squad.id, owningClubId: event.clubId,
        locationLat: event.locationLat, locationLng: event.locationLng, opponentClubId: event.opponentClubId,
        publishAt: event.publishAt,
        mapEligible: false, appearsOnMap: event.publicNow, conflictingEventIds: event.conflictingEventIds ?? [] };
}

/** Read the existing sources. Never copy sessions into personal or club event tables. */
export function useSquadSchedule(squads: CalendarSquad[], from: string, to: string, revision = 0, playerId?: number) {
    const identity = JSON.stringify(squads.map(({ id, name, club_id }) => ({ id, name, club_id })));
    const [state, setState] = useState<{ key: string; events: SquadCalendarEvent[]; error: string; loading: boolean }>({ key: '', events: [], error: '', loading: true });
    const key = `${identity}:${from}:${to}:${playerId ?? ''}`;
    useEffect(() => {
        const abort = new AbortController();
        const selected = JSON.parse(identity) as CalendarSquad[];
        let inFlight = false;
        const load = async () => {
            if (inFlight || abort.signal.aborted) return;
            inFlight = true;
            try {
                // Sessions store instants; the legacy club feed uses local calendar boundaries.
                const window = { from: new Date(from).toISOString(), to: new Date(to).toISOString(), ...(playerId == null ? {} : { playerId }) };
                const sessions = await Promise.all(selected.map(async squad => (await api.sessions(squad.id, abort.signal, window))
                    .filter(session => playerId == null || session.attendance.some(p => p.id === playerId && p.active !== false))
                    .map(session => sessionEvent(squad, session))));
                // Club feeds can be unavailable to a family; squad sessions must still load.
                const clubs = [...new Set(selected.flatMap(squad => squad.club_id ? [squad.club_id] : []))];
                const feeds = await Promise.allSettled(clubs.map(id => fetchClubSchedule(id, from, to, abort.signal)));
                const connectedFeeds = await Promise.allSettled(selected.map(squad => apiClient.get<ScheduleEventOccurrence[]>(`/match-arrangements/squads/${squad.id}/fixtures`, { params: { from: window.from, to: window.to }, signal: abort.signal, timeout: 15000 }).then(r => r.data)));
                const connected = connectedFeeds.flatMap(feed => feed.status === 'fulfilled' ? [feed.value] : []);
                const connectedIds = new Set(connected.flat().map(e => e.eventId));
                const assigned = [...connected.flat(), ...feeds.flatMap(feed => feed.status === 'fulfilled' ? feed.value.filter(e => !connectedIds.has(e.eventId)) : [])].flatMap(event => {
                    const squad = selected.find(s => s.id === event.challengerSquadId || s.id === event.targetSquadId);
                    return squad ? [assignedEvent(event, squad)] : [];
                });
                if (!abort.signal.aborted) setState({ key, events: [...new Map([...sessions.flat(), ...assigned].map(event => [event.id, event])).values()],
                    // Training enrollment does not grant competitive affiliation.
                    // Optional feeds deliberately deny/hide records from an actor
                    // without that access; retrying cannot change this. Mandatory
                    // squad-session failures still reach the error path below.
                    error: [...feeds, ...connectedFeeds].some(feed => feed.status === 'rejected' && ![403, 404].includes(feed.reason?.response?.status)) ? 'Squad sessions are available, but some match and event listings could not load. Try again.' : '', loading: false });
            } catch (error) {
                if (!abort.signal.aborted) setState({ key, events: [], error: extractApiErrorMessage(error, 'Your squad schedule could not load.'), loading: false });
            } finally {
                inFlight = false;
            }
        };
        void load();
        const refresh = () => { if (!document.hidden) void load(); };
        const timer = setInterval(refresh, 5000);
        window.addEventListener('focus', refresh);
        return () => { abort.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); };
    }, [identity, from, to, revision, key, playerId]);
    return state.key === key ? state : { events: [], error: '', loading: true };
}
