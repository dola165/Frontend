import { Badge, Button, EmptyNote, FixtureRow, List, Panel, Section } from '../../../design/primitives';
import type { Bootstrap } from '../../clubOperations/api';
import type { OpenWorkspace } from '../../clubOperations/workspaceStructure';
import type { ScheduleEventOccurrence } from '../../schedule/api';
import { dayLabel, isToday, kindOf, timeLabel, type AgendaEntry } from '../fixtures';
import { canReadSquad } from './coachData';

/** Today's sessions, then the rest of the week, for my squads only: training plus their matches. */
export function CoachWeek({ agenda, boot, onOpen, onOpenEvent }: {
    agenda: AgendaEntry[]; boot: Bootstrap | null; onOpen: OpenWorkspace; onOpenEvent: (event: ScheduleEventOccurrence) => void;
}) {
    const today = agenda.filter(entry => isToday(entry.startsAt));
    const later = agenda.filter(entry => !isToday(entry.startsAt));

    const row = (entry: AgendaEntry) => {
        if (entry.event) {
            const kind = kindOf(entry.event);
            return <FixtureRow key={entry.key} tone={kind.tone} time={timeLabel(entry.startsAt)} day={dayLabel(entry.startsAt)} title={entry.event.title}
                meta={[entry.squadName, entry.event.locationName].filter(Boolean).join(' · ')} onClick={() => onOpenEvent(entry.event!)} label={`Open ${entry.event.title} in the calendar`}
                trail={<Badge tone={kind.badge}>{kind.label}</Badge>} />;
        }
        const session = entry.session!;
        const context = { squad: String(entry.squadId), session: String(session.id) };
        return <FixtureRow key={entry.key} tone="training" time={timeLabel(entry.startsAt)} day={dayLabel(entry.startsAt)} title={session.title} meta={entry.squadName}
            onClick={() => onOpen('squads', { ...context, view: 'training' })} label={`Open ${session.title} for ${entry.squadName}`}
            trail={canReadSquad(boot, 'ATTENDANCE', entry.squadId) ? <Button size="sm" onClick={() => onOpen('attendance', context)}>Attendance</Button> : <Badge tone="info">Training</Badge>} />;
    };

    const next = later[0];
    return <>
        <Section title="Today" hint={today.length ? `${today.length} ${today.length === 1 ? 'session' : 'sessions'}` : undefined}>
            <Panel flush>{today.length ? <List label="Today">{today.map(row)}</List>
                : <EmptyNote title="Nothing scheduled for your squads today">{next ? `Next: ${dayLabel(next.startsAt).toLowerCase()} at ${timeLabel(next.startsAt)}, ${next.session?.title ?? next.event?.title} (${next.squadName}).` : 'Sessions and matches for your squads appear here.'}</EmptyNote>}</Panel>
        </Section>
        <Section title="This week" hint="Next 7 days">
            <Panel flush>{later.length ? <List label="This week">{later.slice(0, 8).map(row)}</List>
                : <EmptyNote title="No sessions or matches in the next 7 days">Plan training from a squad’s schedule.</EmptyNote>}</Panel>
        </Section>
    </>;
}
