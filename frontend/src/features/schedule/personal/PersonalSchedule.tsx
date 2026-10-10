import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Badge, Button, ButtonLink, Chip } from '../../../design/primitives';
import { EventCreationModal, type EventCreationFormValues } from '../../../components/schedule/EventCreationModal';
import { PastEventModal } from '../../../components/schedule/PastEventModal';
import { NotificationTarget } from '../../../components/notifications/NotificationTarget';
import type { ScheduleWorkspaceEvent } from '../../../components/schedule/workspaceTypes';
import { useAndroidUnsavedChanges } from '../../../android/useAndroidUnsavedChanges';
import { canManageClubOperations, isLeadershipRole } from '../../clubs/domain';
import { JourneyEventDetails } from '../../mapPlanning/JourneySchedule';
import type { JourneyEntry } from '../../mapPlanning/journeyScheduleData';
import { SquadSessionDetails } from '../../squadCommunication/SquadSessionDialog';
import type { SquadCalendarEvent } from '../../squadCommunication/useSquadSchedule';
import { availability, availabilityLabel } from '../../squadCommunication/attendance';
import { createMyEvent, updateScheduleEvent, type ScheduleEventUpsertInput } from '../api';
import { scheduleDestination } from '../origin';
import { ScheduleBoard, type BoardEntry } from '../board/ScheduleBoard';
import { EventDetailsDialog } from '../board/EventDetailsDialog';
import { kindOf, matchesType, typeFilterFrom, typeFilters } from '../board/scheduleEvents';
import { useScheduleRange } from '../board/scheduleRange';
import { editPersonalEvent, newPersonalEvent } from './personalEventForm';
import { usePersonalSchedule } from './usePersonalSchedule';

/** Read when an event is opened, so a page left open still treats it correctly. */
const hasStarted = (iso: string) => Date.parse(iso) < Date.now();

type Event = ScheduleWorkspaceEvent & { journeys?: JourneyEntry[]; session?: SquadCalendarEvent['session']; squadId?: number };
type Editor = { mode: 'create' | 'edit'; values: EventCreationFormValues; eventId?: number; clubId?: number | null; startsAt?: string };

/**
 * Your schedule: your own plans, your squads' sessions and matches (as player, parent or coach)
 * and trips, in one place. Replying "can't come" happens in the session, never in a wall of dropdowns.
 */
export function PersonalSchedule() {
    const navigate = useNavigate();
    const range = useScheduleRange();
    const [params, setParams] = useSearchParams();
    const data = usePersonalSchedule(range.from, range.to);
    const type = typeFilterFrom(params.get('type'));
    const whose = params.get('squad') ?? 'all';
    const [editor, setEditor] = useState<Editor | null>(null);
    const [open, setOpen] = useState<{ kind: 'squad' | 'past' | 'read' | 'journey'; event: Event } | null>(null);
    const [notice, setNotice] = useState('');
    useAndroidUnsavedChanges(Boolean(editor));
    const role = data.context?.myRole;
    const managed = new Set(data.squads.filter(squad => squad.can_manage).map(squad => squad.id));

    const setFilter = (key: string, value: string | null) => {
        const next = new URLSearchParams(params);
        if (value === null || value === 'all') next.delete(key); else next.set(key, value);
        setParams(next, { replace: true });
    };
    const create = (day?: Date) => setEditor({ mode: 'create', values: newPersonalEvent(day ?? (range.isCurrent ? new Date() : range.from)) });

    // "New event" links (the post composer, Dola) open the editor once, then the link is tidied away.
    const requestedNew = params.get('newEvent') === '1';
    const [openedNew, setOpenedNew] = useState(false);
    if (requestedNew !== openedNew) { setOpenedNew(requestedNew); if (requestedNew) create(); }
    useEffect(() => { if (requestedNew) setFilter('newEvent', null); }, [requestedNew]); // eslint-disable-line react-hooks/exhaustive-deps
    const linkedJourney = data.events.flatMap(event => event.journeys ?? []).find(entry => String(entry.planId) === params.get('journey') && (!params.get('journeyChild') || entry.subjects.some(subject => String(subject.id) === params.get('journeyChild'))));

    const openEvent = (event: Event) => {
        if (event.journeys?.length) return setOpen({ kind: 'journey', event });
        const destination = scheduleDestination(event);
        if (destination) return navigate(destination);
        if (event.id.startsWith('tournament-referee:')) return navigate('/referees/me');
        if (data.isSquadEvent(event)) return setOpen({ kind: 'squad', event });
        if (data.isClubEvent(event)) return setOpen({ kind: 'read', event });
        if (hasStarted(event.startsAt)) return setOpen({ kind: 'past', event });
        setEditor({ mode: 'edit', values: editPersonalEvent(event), eventId: event.eventId, clubId: null, startsAt: event.startsAt });
    };
    const save = async (payload: ScheduleEventUpsertInput) => {
        if (editor?.mode === 'edit' && editor.eventId) { await updateScheduleEvent(editor.eventId, payload); setNotice('Event updated.'); }
        else { const result = await createMyEvent(payload); setNotice(result.conflict ? 'Event saved. It overlaps something on your club’s schedule.' : 'Event saved.'); }
        setEditor(null);
        range.goTo(new Date(payload.startsAt));
        data.reload();
    };

    const entries: BoardEntry[] = (data.events as Event[]).filter(event => matchesType(event.eventType, type))
        .filter(event => whose === 'all' || (whose === 'me' ? event.ownerLabel === 'Only you' : String(event.hostSquadId ?? event.squadId) === whose))
        .map(event => {
            const kind = event.journeys?.length ? { tone: 'event' as const, badge: 'violet' as const, label: 'Trip' } : kindOf(event);
            const cancelled = event.status.toUpperCase() === 'CANCELLED';
            return { key: event.id, startsAt: event.startsAt, endsAt: event.endsAt, title: event.title, tone: kind.tone, cancelled,
                meta: [event.hostSquadName ?? event.ownerLabel, event.locationText].filter(Boolean).join(' · '),
                trail: cancelled ? <Badge tone="danger">Cancelled</Badge> : trailFor(event, managed) ?? <Badge tone={kind.badge}>{kind.label}</Badge>,
                onOpen: () => openEvent(event), label: `${event.title}, ${kind.label.toLowerCase()}` };
        });

    return <>
        <ScheduleBoard label="My schedule" range={range} entries={entries} loading={data.loading} error={data.error} onRetry={data.reload} onCreateAt={create}
            actions={<>
                {data.squads.length > 0 && <ButtonLink size="sm" variant="ghost" to="/squads">Squad schedules</ButtonLink>}
                <Button size="sm" variant="primary" onClick={() => create()}><Plus aria-hidden="true" />New event</Button>
            </>}
            filters={<>
                <div className="gk-chips" role="group" aria-label="Show">{typeFilters.map(filter => <Chip key={filter.id} pressed={type === filter.id} onClick={() => setFilter('type', filter.id)}>{filter.label}</Chip>)}</div>
                {data.squads.length > 0 && <select className="gk-input" aria-label="Whose schedule" value={whose} onChange={event => setFilter('squad', event.target.value)}>
                    <option value="all">Everything for me</option>
                    <option value="me">Only my own plans</option>
                    {data.squads.map(squad => <option key={squad.id} value={squad.id}>{squad.name}</option>)}
                </select>}
            </>}
            notices={notice ? <p className="gk-notice" role="status">{notice}</p> : undefined}
            empty={{ title: 'Nothing planned in this period', body: data.squads.length ? 'Your squads’ sessions and matches appear here, with anything you add yourself.' : 'Add your own plans, or join a squad to see its sessions here.', action: <Button size="sm" onClick={() => create()}>Add an event</Button> }} />

        {editor && <EventCreationModal isOpen mode={editor.mode} surface="MY_SCHEDULE" initialValues={editor.values} clubId={data.context?.clubId ?? null}
            targetEventId={editor.eventId} canManageSchedule={Boolean(data.context?.clubId) && isLeadershipRole(role)} targetEventClubId={editor.clubId ?? null}
            targetEventStartsAt={editor.startsAt ?? null} onCancelled={data.reload} subjectLabel="Only you" onClose={() => setEditor(null)} onSubmit={save} />}
        {open?.kind === 'past' && <PastEventModal event={open.event} clubId={null} clubName={data.context?.clubName ?? 'Club'} canComplete={canManageClubOperations(role)} canRecordResult={false}
            onClose={() => setOpen(null)} onCompleted={() => { setOpen(null); data.reload(); }} />}
        {open?.kind === 'squad' && <SquadSessionDetails event={open.event as SquadCalendarEvent} canManage={managed.has((open.event as SquadCalendarEvent).squadId ?? -1)} onClose={() => setOpen(null)} onSaved={data.reload} />}
        {open?.kind === 'read' && <EventDetailsDialog event={open.event} onClose={() => setOpen(null)} />}
        {(open?.kind === 'journey' || linkedJourney) && <JourneyEventDetails entries={open?.event.journeys ?? [linkedJourney!]} onSaved={data.reload}
            onClose={() => { setOpen(null); if (params.get('journey')) { const next = new URLSearchParams(params); next.delete('journey'); next.delete('journeyChild'); setParams(next, { replace: true }); } }} />}
        {params.get('eventId') && <NotificationTarget kind="event" id={params.get('eventId') ?? ''} onClose={() => setFilter('eventId', null)} />}
    </>;
}

/** What the person needs to know at a glance: a coach sees availability, a family sees their own answer. */
function trailFor(event: Event, managed: Set<number>) {
    if (event.conflict) return <Badge tone="warning">Clashes with {event.conflict.sourceTitle}</Badge>;
    if (event.ownerLabel === 'Only you') return <Badge>Only you</Badge>;
    if (!event.session) return null;
    const value = availability(event.session);
    if (managed.has(event.squadId ?? -1)) return value.cantCome.length || value.toConfirm.length || value.unsure.length
        ? <Badge tone={value.toConfirm.length ? 'warning' : 'neutral'}>{availabilityLabel(event.session)}</Badge> : null;
    if (value.cantCome.length) return <Badge>Can’t come</Badge>;
    if (value.toConfirm.length) return <Badge tone="warning">Please confirm</Badge>;
    return null;
}
