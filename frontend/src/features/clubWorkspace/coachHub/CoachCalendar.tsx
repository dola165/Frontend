import { useSearchParams } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { ButtonLink, PageFrame, PageHeader, Panel, Skeleton } from '../../../design/primitives';
import type { SquadOverview } from '../../squadCommunication/api';
import { FamilySchedule } from '../../parents/FamilySchedule';
import { fromIsoDay } from '../../../design/calendar/calendarDates';
import { SquadSwitch } from './CoachVisuals';
import type { CoachData } from './CoachWorkspace';
import './coach-hub.css';

/**
 * My squads' calendar: the squad schedule every coach and family already uses (week board, calendar, agenda,
 * planning, weekly training, results), for all my squads at once or the one picked in the switcher. Coaches move a
 * session by dragging it and plan one by clicking an empty slot; nothing changes until they confirm.
 * A link can open a session (`session=squadId:sessionId`) on its day (`date`); `edit=1` opens it straight in its editor
 * (Edit in My squads' summary), while a plain click shows the calendar's own summary first.
 */
export function CoachCalendar({ data }: { data: CoachData }) {
    const [params] = useSearchParams();
    const spaces = (data.squads ?? []).filter(squad => data.shown.includes(squad.id)).map(squad => squad.overview).filter((space): space is SquadOverview => Boolean(space));
    const [squadId, sessionId] = (params.get('session') ?? '').split(':').map(Number);
    const date = fromIsoDay(params.get('date'));
    return <PageFrame className="cw-page ch-page">
        <PageHeader title="Calendar" actions={<ButtonLink to={data.workHref('calendar')}><CalendarDays aria-hidden="true" />Club calendar</ButtonLink>} />
        <SquadSwitch data={data} />
        {!data.squads ? <Panel><div className="cw-skeleton-rows" role="status" aria-label="Loading the calendar"><Skeleton height={420} /></div></Panel>
            : <div className="ch-schedule"><FamilySchedule key={`${data.shown.join(',')}:${params.get('session') ?? ''}:${params.get('date') ?? ''}`} squads={spaces} combined={!data.focus}
                initialSquadId={data.focus ?? (squadId || undefined)} initialSessionId={sessionId || undefined} initialDate={date ?? undefined} initialEdit={params.get('edit') === '1'} editable hideContext /></div>}
    </PageFrame>;
}
