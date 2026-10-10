import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { History } from 'lucide-react';
import { Badge, Button, ButtonLink, Chip } from '../../../design/primitives';
import type { ScheduleWorkspaceEvent } from '../../../components/schedule/workspaceTypes';
import { matchHistoryPath } from '../../matchHistory/api';
import { ScheduleBoard, type BoardEntry } from '../../schedule/board/ScheduleBoard';
import { EventDetailsDialog } from '../../schedule/board/EventDetailsDialog';
import { eventKind, matchesType, toWorkspaceEvent, typeFilterFrom, typeFilters, type TypeFilter } from '../../schedule/board/scheduleEvents';
import { useScheduleRange } from '../../schedule/board/scheduleRange';
import { scheduleDestination } from '../../schedule/origin';
import type { ScheduleEventOccurrence } from '../../schedule/api';
import { useClubSchedule } from './useClubSchedule';
import type { ClubProfile } from './types';

/**
 * The club schedule: every squad's training, matches and club events together,
 * filtered by squad and type. Squad schedules stay where squads plan them.
 */
export function ClubScheduleTab({ club, canManage }: { club: ClubProfile; canManage: boolean }) {
    const range = useScheduleRange();
    const [params, setParams] = useSearchParams();
    const type = typeFilterFrom(params.get('type'));
    const squad = params.get('squad') ?? 'all';
    const data = useClubSchedule(club.id, range.from, range.to);
    const [details, setDetails] = useState<ScheduleWorkspaceEvent | null>(null);
    const setFilter = (key: 'type' | 'squad', value: string) => {
        const next = new URLSearchParams(params);
        if (value === 'all') next.delete(key); else next.set(key, value);
        setParams(next, { replace: true });
    };
    const ownSquad = (event: ScheduleEventOccurrence) => event.clubId === club.id ? { id: event.challengerSquadId, name: event.challengerSquadName } : { id: event.targetSquadId, name: event.targetSquadName };
    const inSquad = (id: number | null | undefined) => squad === 'all' || (squad === 'club' ? id == null : String(id) === squad);

    const events: BoardEntry[] = data.events.filter(event => matchesType(event.eventType, type) && inSquad(ownSquad(event).id)).map(event => {
        const kind = eventKind[event.eventType] ?? eventKind.ACTIVITY;
        const destination = scheduleDestination(event) ?? (event.matchExchangeId ? `/match-exchange/${event.matchExchangeId}` : undefined);
        const cancelled = event.status === 'CANCELLED' || event.challengeStatus === 'REJECTED';
        return {
            key: `event:${event.occurrenceId}`, startsAt: event.startsAt, endsAt: event.endsAt, title: event.title, tone: kind.tone, cancelled,
            meta: [ownSquad(event).name ?? (event.eventType === 'TRAINING' || event.eventType === 'ACTIVITY' ? 'Whole club' : null), event.locationName].filter(Boolean).join(' · '),
            trail: cancelled ? <Badge tone="danger">{event.challengeStatus === 'REJECTED' ? 'Declined' : 'Cancelled'}</Badge>
                : event.challengeStatus === 'PENDING' ? <Badge tone="warning">Awaiting confirmation</Badge>
                : !event.publicNow ? <Badge>Members only</Badge> : <Badge tone={kind.badge}>{kind.label}</Badge>,
            to: destination, onOpen: destination ? undefined : () => setDetails(toWorkspaceEvent(event, club.name)),
            label: `${event.title}, ${kind.label.toLowerCase()}`,
        };
    });
    const training: BoardEntry[] = matchesType('TRAINING', type) ? data.training.filter(session => inSquad(session.squadId) && squad !== 'club').map(session => ({
        key: `training:${session.squadId}:${session.id}`, startsAt: session.startsAt, endsAt: session.endsAt, tone: 'training',
        title: session.timesOnly ? `${session.squadName} training` : session.title,
        meta: [session.squadName, session.location].filter(Boolean).join(' · '),
        cancelled: session.status === 'CANCELLED',
        trail: session.status === 'CANCELLED' ? <Badge tone="danger">Cancelled</Badge> : <Badge tone="info">Training</Badge>,
        to: data.mySquads.includes(session.squadId) ? `/squads/${session.squadId}?tab=sessions&sessionId=${session.id}&at=${encodeURIComponent(session.startsAt)}` : undefined,
    })) : [];
    const selected = data.squads.find(s => String(s.id) === squad);

    return <>
        <ScheduleBoard label={`${club.name} schedule`} range={range} entries={[...events, ...training]} loading={data.loading} error={data.error} onRetry={data.retry}
            actions={<>
                <ButtonLink size="sm" variant="ghost" to={matchHistoryPath({ clubId: club.id, squadId: selected?.id })}><History aria-hidden="true" />Results</ButtonLink>
                {canManage && <ButtonLink size="sm" variant="primary" to={selected && data.mySquads.includes(selected.id) ? `/squads/${selected.id}?tab=sessions` : '/squads'}>Plan training</ButtonLink>}
            </>}
            filters={<>
                <div className="gk-chips" role="group" aria-label="Show">{typeFilters.map(filter => <Chip key={filter.id} pressed={type === filter.id} onClick={() => setFilter('type', filter.id)}>{filter.label}</Chip>)}</div>
                <label className="gk-row"><span className="gk-visually-hidden">Squad</span>
                    <select className="gk-input" value={squad} onChange={event => setFilter('squad', event.target.value)} aria-label="Squad">
                        <option value="all">All squads</option>
                        {data.squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        <option value="club">Whole-club events</option>
                    </select>
                </label>
            </>}
            notices={data.privateSquads.length > 0 && (type === 'all' || type === 'training') && squad === 'all' ? <p className="gk-faint">Training times for {data.privateSquads.join(', ')} are shared with squad members only.</p> : undefined}
            empty={{ title: emptyTitle(type, selected?.name), body: range.isCurrent ? 'Try the next week or another filter.' : 'Try another week or filter.', action: <Button size="sm" onClick={() => range.shift(1)}>Next {range.view === 'week' ? 'week' : 'four weeks'}</Button> }} />
        {details && <EventDetailsDialog event={details} onClose={() => setDetails(null)} />}
    </>;
}

function emptyTitle(type: TypeFilter, squad?: string) {
    const what = type === 'matches' ? 'matches' : type === 'training' ? 'training sessions' : type === 'events' ? 'club events' : 'sessions, matches or events';
    return squad ? `No ${what} for ${squad} in this period` : `No ${what} in this period`;
}
