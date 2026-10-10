import { Badge, Button, EmptyNote, FixtureRow, List, Panel, Section } from '../../../design/primitives';
import type { Bootstrap } from '../../clubOperations/api';
import type { OpenWorkspace } from '../../clubOperations/workspaceStructure';
import { canReadSquad } from '../../clubOperations/squadAccess';
import type { ScheduleEventOccurrence } from '../../schedule/api';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';
import { dayLabel, isToday, kindOf, timeLabel, type AgendaEntry } from '../fixtures';

/** Today's sessions, then the rest of the week, for my squads only: training plus their matches. */
export function CoachWeek({ agenda, boot, onOpen, onOpenEvent }: {
    agenda: AgendaEntry[]; boot: Bootstrap | null; onOpen: OpenWorkspace; onOpenEvent: (event: ScheduleEventOccurrence) => void;
}) {
    const copy = useCopy('coachHub', coachHubEn);
    const today = agenda.filter(entry => isToday(entry.startsAt));
    const later = agenda.filter(entry => !isToday(entry.startsAt));

    const row = (entry: AgendaEntry) => {
        if (entry.event) {
            const kind = kindOf(entry.event);
            return <FixtureRow key={entry.key} tone={kind.tone} time={timeLabel(entry.startsAt)} day={dayLabel(entry.startsAt)} title={entry.event.title}
                meta={[entry.squadName, entry.event.locationName].filter(Boolean).join(' · ')} onClick={() => onOpenEvent(entry.event!)} label={copy('openInCalendar', { name: entry.event.title })}
                trail={<Badge tone={kind.badge}>{kind.label}</Badge>} />;
        }
        const session = entry.session!;
        const context = { squad: String(entry.squadId), session: String(session.id) };
        return <FixtureRow key={entry.key} tone="training" time={timeLabel(entry.startsAt)} day={dayLabel(entry.startsAt)} title={session.title} meta={entry.squadName}
            onClick={() => onOpen('squads', { ...context, view: 'training' })} label={copy('openSession', { name: session.title, squad: entry.squadName })}
            trail={canReadSquad(boot, 'ATTENDANCE', entry.squadId) ? <Button size="sm" onClick={() => onOpen('attendance', context)}>{copy('attendance')}</Button> : <Badge tone="info">{copy('training')}</Badge>} />;
    };

    const next = later[0];
    return <>
        <Section title={copy('today')} hint={today.length ? copy('sessions', { count: today.length }) : undefined}>
            <Panel flush>{today.length ? <List label={copy('today')}>{today.map(row)}</List>
                : <EmptyNote title={copy('nothingToday')}>{next ? copy('nextUp', { day: dayLabel(next.startsAt), time: timeLabel(next.startsAt), name: next.session?.title ?? next.event?.title ?? '', squad: next.squadName }) : copy('weekHint')}</EmptyNote>}</Panel>
        </Section>
        <Section title={copy('thisWeek')} hint={copy('nextSevenDays')}>
            <Panel flush>{later.length ? <List label={copy('thisWeek')}>{later.slice(0, 8).map(row)}</List>
                : <EmptyNote title={copy('weekEmpty')}>{copy('weekEmptyHint')}</EmptyNote>}</Panel>
        </Section>
    </>;
}
