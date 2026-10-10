import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { EmptyNote, Panel, Section, Skeleton } from '../../../design/primitives';
import { DayAgenda, type DayAgendaItem } from '../DayAgenda';
import { kindOf, squadAgenda } from '../fixtures';
import { kindNames, replies, sessionKind, type CoachSquad } from './useCoachData';
import type { CoachData } from './CoachWorkspace';

const HOUR = 3_600_000, DAY = 86_400_000;

/**
 * The coming week of my squads, today first: sessions and matches from the squad spaces with who's coming,
 * and club events that involve the squads. Each entry opens it in the schedule.
 */
export function CoachWeek({ data, squads }: { data: CoachData; squads: CoachSquad[] | null }) {
    const navigate = useNavigate();
    const { now, names } = data;
    const from = now - 3 * HOUR, to = now + 7 * DAY;
    const items: (DayAgendaItem & { time: number })[] = [];
    for (const squad of squads ?? []) for (const session of squad.sessions) {
        const time = new Date(session.starts_at).getTime();
        if (time < from || time > to) continue;
        const reply = replies(session), kind = sessionKind(session), squadName = names.get(squad.id);
        const status = session.status === 'CANCELLED' ? <span className="cw-status cw-status--danger">Cancelled</span>
            : reply.asked && reply.none ? <span className="cw-status cw-status--warning">{reply.none} no reply</span>
                : reply.cant ? <span className="cw-status">{reply.cant} can’t come</span> : undefined;
        items.push({ key: `s-${session.id}`, time, startsAt: session.starts_at, title: session.title, kind, kindLabel: kindNames[kind], squad: squadName,
            meta: [squadName, session.location].filter(Boolean).join(' · '), status, label: `${session.title}, ${squadName}`, onClick: () => navigate(`?tab=schedule&session=${session.id}`) });
    }
    // Club events (meetings, trials) come from the club calendar; matches and training already came from the squads.
    const shown = data.mine.filter(squad => squads?.some(item => item.id === squad.id));
    for (const entry of squadAgenda([], data.events, shown, from, to)) {
        const event = entry.event;
        if (!event || ['MATCH', 'FRIENDLY', 'TRAINING'].includes(event.eventType)) continue;
        items.push({ key: entry.key, time: new Date(entry.startsAt).getTime(), startsAt: entry.startsAt, title: event.title, kind: event.eventType, kindLabel: kindOf(event).label, squad: entry.squadName,
            meta: [entry.squadName, event.locationName].filter(Boolean).join(' · '), label: event.title, onClick: () => data.openEvent(event) });
    }
    items.sort((a, b) => a.time - b.time);
    return <Section boxed icon={CalendarDays} title="Coming up" hint="Next 7 days" action={<Link className="gk-section__action" to="?tab=schedule">Schedule</Link>}>
        <Panel flush>{!squads ? <div className="cw-skeleton-rows" role="status" aria-label="Loading the week">{[0, 1, 2].map(i => <Skeleton key={i} height={44} />)}</div>
            : items.length ? <DayAgenda label="Coming up" items={items} limit={8} />
                : <EmptyNote title="Nothing in the next 7 days">Sessions and matches for your squads appear here.</EmptyNote>}</Panel>
    </Section>;
}
