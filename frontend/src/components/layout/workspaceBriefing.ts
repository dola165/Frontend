import { useEffect, useState } from 'react';
import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import type { AuthSessionId } from '../../utils/authStorage';
import type { RequestPage } from '../../features/requests/api';
import type { ScheduleEventOccurrence } from '../../features/schedule/api';
import type { SquadSession } from '../../features/squadCommunication/api';
import type { NavigationCapabilities } from '../../context/navigationCapabilities';
import { accessibleClubs } from './clubAccess';
import { formatDate, formatTime } from '../../utils/formatting';

export interface BriefingEvent { key: string; title: string; startsAt: string; endsAt: string; context: string; location: string | null; path: string; status: string; type: string }
interface Briefing { loading: boolean; requests: RequestPage | null; requestsFailed: boolean; events: BriefingEvent[]; scheduleFailed: string[]; now: Date }
const localDateTime = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19);

export function upcomingEvents(events: BriefingEvent[], now: Date, end: Date) {
    return [...new Map(events.filter(event => Number.isFinite(Date.parse(event.startsAt)) && Date.parse(event.endsAt) > now.getTime()
        && Date.parse(event.startsAt) < end.getTime() && event.status === 'SCHEDULED').map(event => [event.key, event])).values()]
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.key.localeCompare(b.key));
}
export function eventWhen(event: BriefingEvent, now: Date) {
    if (Date.parse(event.startsAt) <= now.getTime() && Date.parse(event.endsAt) > now.getTime()) return 'Now';
    const date = new Date(event.startsAt), tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    const day = date.toDateString() === now.toDateString() ? 'Today' : date.toDateString() === tomorrow.toDateString() ? 'Tomorrow' : formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' });
    return `${day} · ${formatTime(date)}`;
}

/** Read existing authority-filtered sources. Abort and hide the old account/context on change. */
export function useWorkspaceBriefing(sessionId: AuthSessionId, caps: NavigationCapabilities | undefined, revision: number) {
    const identity = JSON.stringify(caps?.workspaces ?? []);
    const key = `${sessionId}:${identity}:${revision}`;
    const empty = (): Briefing => ({ loading: true, requests: null, requestsFailed: false, events: [], scheduleFailed: [], now: new Date() });
    const [state, setState] = useState<Briefing & { key: string }>(() => ({ ...empty(), key: '' }));
    useEffect(() => {
        const abort = new AbortController(), now = new Date(), from = new Date(now), end = new Date(now);
        from.setHours(0, 0, 0, 0); end.setDate(end.getDate() + 7); end.setHours(0, 0, 0, 0);
        const capabilities: NavigationCapabilities = { version: 1, workspaces: JSON.parse(identity) };
        const config = { signal: abort.signal, _authSessionId: sessionId, timeout: 15000 } as AuthSessionRequestConfig;
        const scheduleParams = { from: localDateTime(from), to: localDateTime(end) };
        const sources: { label: string; load: Promise<BriefingEvent[]> }[] = [];
        const schedule = (event: ScheduleEventOccurrence, context: string): BriefingEvent => ({ key: `calendar:${event.occurrenceId}`, title: event.title,
            startsAt: event.startsAt, endsAt: event.endsAt, status: event.status, type: event.eventType, location: event.locationName, context,
            path: event.origin === 'MATCH_EXCHANGE' ? `/match-exchange/${event.eventId}` : `/calendar?eventId=${event.eventId}` });
        sources.push({ label: 'Personal schedule', load: apiClient.get<{ events: ScheduleEventOccurrence[] }>('/schedule/me/events', { ...config, params: scheduleParams })
            .then(r => r.data.events.map(event => schedule(event, 'Personal'))) });
        for (const club of accessibleClubs(capabilities)) {
            sources.push({ label: club.name, load: apiClient.get<{ events: ScheduleEventOccurrence[] }>(`/schedule/clubs/${club.id}/events`, { ...config, params: scheduleParams })
                .then(r => r.data.events.map(event => schedule(event, club.name))) });
        }
        for (const squad of capabilities.workspaces.filter(w => w.id === 'squad.workspace')) {
            sources.push({ label: `${squad.context.label} fixtures`, load: apiClient.get<ScheduleEventOccurrence[]>(`/match-arrangements/squads/${squad.context.id}/fixtures`, {
                ...config, params: { from: from.toISOString(), to: end.toISOString() },
            }).then(r => r.data.map(event => schedule(event, squad.context.label))) });
            sources.push({ label: squad.context.label, load: apiClient.get<SquadSession[]>(`/squad-communication/${squad.context.id}/sessions`, {
                ...config, params: { from: from.toISOString(), to: end.toISOString() },
            }).then(r => r.data.map(session => ({ key: `squad:${squad.context.id}:${session.id}`, title: session.title, startsAt: session.starts_at, endsAt: session.ends_at,
                status: session.status, type: session.event_type ?? 'TRAINING', context: squad.context.label,
                location: session.venue_reservation ? session.venue_reservation.status === 'CONFIRMED' ? `${session.venue_reservation.venueName} · ${session.venue_reservation.pitchName}` : null : session.location,
                path: `/squads/${squad.context.id}?tab=sessions&sessionId=${session.id}&at=${encodeURIComponent(session.starts_at)}`,
            }))) });
        }
        // Each source can finish independently; an unavailable request inbox must not hide the schedule.
        void Promise.allSettled([apiClient.get<RequestPage>('/requests', { ...config, params: { view: 'INCOMING', page: 0, size: 5 } }).then(r => r.data)]).then(([result]) => {
            if (!abort.signal.aborted) setState(previous => ({ ...(previous.key === key ? previous : { ...empty(), key }), now,
                requests: result.status === 'fulfilled' ? result.value : null, requestsFailed: result.status === 'rejected' }));
        });
        void Promise.allSettled(sources.map(source => source.load)).then(results => {
            if (!abort.signal.aborted) setState(previous => ({ ...(previous.key === key ? previous : { ...empty(), key }), now, loading: false,
                events: upcomingEvents(results.flatMap(result => result.status === 'fulfilled' ? result.value : []), now, end),
                scheduleFailed: results.flatMap((result, index) => result.status === 'rejected' ? [sources[index].label] : []),
            }));
        });
        return () => abort.abort();
    }, [sessionId, identity, revision, key]);
    return state.key === key ? state : empty();
}
