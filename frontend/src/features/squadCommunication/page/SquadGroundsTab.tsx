import { useMemo, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { GkRoot, Skeleton } from '../../../design/primitives';
import { formatDateTime } from '../../../utils/formatting';
import { ScheduleDirections } from '../../schedule/board/ScheduleDirections';
import { useSquadSchedule, type SquadCalendarEvent } from '../useSquadSchedule';
import { scheduleDestination } from '../../schedule/origin';
import type * as api from '../api';
import { getAuthSessionId, subscribeAuthSession } from '../../../utils/authStorage';
import { EventDetailsDialog } from '../../schedule/board/EventDetailsDialog';
import './squad-grounds.css';

const eventPath = (event: SquadCalendarEvent, childId?: number) => scheduleDestination(event) ??
    (event.origin === 'SQUAD_SESSION' && event.session && event.squadId
        ? `/squads/${event.squadId}?tab=sessions&sessionId=${event.session.id}&at=${encodeURIComponent(event.startsAt)}${childId ? `&player=${childId}` : ''}` : null);

/** The actual upcoming places, with a route back to the occurrence that owns each plan. */
export function SquadGroundsTab({ space, childId }: { space: api.SquadOverview; childId?: number }) {
    const account = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    return <SquadGrounds key={`${account}:${space.id}:${childId}:${space.can_manage}`} space={space} childId={childId}/>;
}

function SquadGrounds({ space, childId }: { space: api.SquadOverview; childId?: number }) {
    const [revision, setRevision] = useState(0);
    const [selection, setSelection] = useState<{ id: string; origin?: string } | null>(null);
    const range = useMemo(() => { const from = new Date(); from.setHours(0, 0, 0, 0); return { from: from.toISOString(), to: new Date(from.getTime() + 29 * 86400000).toISOString() }; }, []);
    const { events, loading, error } = useSquadSchedule([space], range.from, range.to, revision, space.can_manage ? undefined : childId, false);
    const upcoming = events.filter(event => event.status.toUpperCase() !== 'CANCELLED').sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    const grounds = new Map<string, SquadCalendarEvent[]>();
    for (const event of upcoming) {
        if (!event.locationText) continue;
        const key = `${event.locationLat ?? ''}:${event.locationLng ?? ''}:${event.locationText}`;
        grounds.set(key, [...(grounds.get(key) ?? []), event]);
    }
    const unresolved = upcoming.filter(event => !event.locationText);
    // Keep the occurrence identity and current scoped feed; never reinterpret an event ID as a session.
    const selected = events.find(event => event.id === selection?.id && event.origin === selection.origin);
    const open = (event: SquadCalendarEvent) => {
        const destination = eventPath(event, childId);
        const label = <>{event.title} · {formatDateTime(event.startsAt)}</>;
        return destination ? <Link to={destination}>{label}</Link>
            : <button type="button" onClick={() => setSelection({ id: event.id, origin: event.origin })}>{label}</button>;
    };
    if (loading) return <Skeleton height={120} />;
    return <GkRoot role="region" className="calendar-grounds" aria-label="Squad grounds">
        {error && <p role="alert">{error} <button type="button" onClick={() => setRevision(n => n + 1)}>Retry grounds</button></p>}
        {!error && !upcoming.length && <p>No grounds planned in the next four weeks.</p>}
        {[...grounds.entries()].map(([key, dates]) => <article key={key}>
            <h3><MapPin aria-hidden="true" size={20}/>{dates[0].locationText}</h3>
            <ScheduleDirections place={dates[0].locationText} lat={dates[0].locationLat} lng={dates[0].locationLng}/>
            <ul>{dates.map(event => <li key={event.id}>{open(event)}</li>)}</ul>
        </article>)}
        {unresolved.length > 0 && <article><h3>Meeting point to confirm</h3><ul>{unresolved.map(event => <li key={event.id}>
            {open(event)}
            <span>{event.session?.venue_reservation?.status === 'PENDING' ? 'Pitch request awaiting approval' : event.session?.venue_reservation?.status === 'UNAVAILABLE' ? 'Pitch reservation unavailable — check the current plan' : 'No meeting point saved'}</span>
        </li>)}</ul></article>}
        {selected && <EventDetailsDialog event={selected} onClose={() => setSelection(null)}/>}
    </GkRoot>;
}
