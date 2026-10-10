import { EmptyNote, Panel, Section } from '../../../design/primitives';
import { CalendarDays } from 'lucide-react';
import type { Bootstrap } from '../../clubOperations/api';
import type { OpenWorkspace } from '../../clubOperations/workspaceStructure';
import type { ScheduleEventOccurrence } from '../../schedule/api';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';
import { kindOf, type AgendaEntry } from '../fixtures';
import { DayAgenda, type DayAgendaItem } from '../DayAgenda';

/** My squads' week, today first: training plus their matches, by day, with same-time entries merged. */
export function CoachWeek({ agenda, onOpen, onOpenEvent }: {
    agenda: AgendaEntry[]; boot: Bootstrap | null; onOpen: OpenWorkspace; onOpenEvent: (event: ScheduleEventOccurrence) => void;
}) {
    const copy = useCopy('coachHub', coachHubEn);
    const item = (entry: AgendaEntry): DayAgendaItem => {
        if (entry.event) {
            const kind = kindOf(entry.event);
            return { key: entry.key, startsAt: entry.startsAt, title: entry.event.title, meta: [entry.squadName, entry.event.locationName].filter(Boolean).join(' · '), tone: kind.tone,
                trail: <span className="gk-fixture__tag">{kind.label}</span>, onClick: () => onOpenEvent(entry.event!), label: copy('openInCalendar', { name: entry.event.title }), kind: entry.event.eventType, squad: entry.squadName };
        }
        const session = entry.session!;
        return { key: entry.key, startsAt: entry.startsAt, title: session.title, meta: entry.squadName, tone: 'training', trail: <span className="gk-fixture__tag">{copy('training')}</span>,
            onClick: () => onOpen('squads', { squad: String(entry.squadId), session: String(session.id), view: 'training' }), label: copy('openSession', { name: session.title, squad: entry.squadName }), kind: 'TRAINING', squad: entry.squadName };
    };
    return <Section icon={CalendarDays} tone="info" title={copy('thisWeek')} hint={copy('nextSevenDays')}>
        <Panel flush>{agenda.length ? <DayAgenda label={copy('thisWeek')} items={agenda.map(item)} limit={8} />
            : <EmptyNote title={copy('weekEmpty')}>{copy('weekEmptyHint')}</EmptyNote>}</Panel>
    </Section>;
}
