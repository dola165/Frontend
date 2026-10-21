import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageFrame } from '../../../design/primitives';
import { ScheduleDirectionWorkspace } from '../../../components/schedule/ScheduleDirectionWorkspace';
import { CalendarTutorial } from '../../../components/schedule/CalendarTutorial';
import { useMobileSchedule } from '../../../components/schedule/useMobileSchedule';
import { EVENT_TYPES, type ScheduleWorkspaceEvent, type WorkspaceView } from '../../../components/schedule/workspaceTypes';
import { MatchHistoryLink } from '../../matchHistory/MatchHistoryLink';
import { EventDetailsDialog } from '../../schedule/board/EventDetailsDialog';
import { toWorkspaceEvent } from '../../schedule/board/scheduleEvents';
import { scheduleDestination } from '../../schedule/origin';
import { useClubSchedule, type ClubTraining } from '../../clubs/profile/useClubSchedule';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { useCalendarDay } from './useCalendarDay';
import '../../squadCommunication/squad-schedule.css';
import '../../parents/family-schedule.css';

const weekStart = (value: Date) => { const date = new Date(value.getFullYear(), value.getMonth(), value.getDate()); date.setDate(date.getDate() - (date.getDay() + 6) % 7); return date; };
const trainingEvent = (session: ClubTraining): ScheduleWorkspaceEvent => ({
    id: `training:${session.squadId}:${session.id}`, eventId: Number(session.id) || 0, title: session.timesOnly ? `${session.squadName} training` : session.title, eventType: 'TRAINING',
    startsAt: session.startsAt, endsAt: session.endsAt, locationText: session.location ?? null, status: session.status, visibility: 'CLUB_ONLY', publicationState: 'PRIVATE', recurring: false,
    ownerLabel: session.squadName, hostSquadId: session.squadId, hostSquadName: session.squadName, mapEligible: false, appearsOnMap: false, conflictingEventIds: [],
});

/**
 * The club's calendar in the workspace: every squad's training, matches and club events together, on the same
 * schedule coaches and families use. Squads are planned in My squads, where coaches drag sessions to move them.
 */
export function ClubCalendar({ clubId, clubName, canManage }: { clubId: number; clubName: string; canManage: boolean }) {
    const navigate = useNavigate();
    const copy = useJourneyCopy();
    const mobile = useMobileSchedule();
    const [date, setDate] = useCalendarDay();
    const [view, setView] = useState<WorkspaceView>('week');
    const [types, setTypes] = useState(EVENT_TYPES);
    const [details, setDetails] = useState<ScheduleWorkspaceEvent | null>(null);
    const [help, setHelp] = useState(false);
    const range = useMemo(() => {
        const from = view === 'month' ? new Date(date.getFullYear(), date.getMonth(), 1) : view === 'day' ? new Date(date.getFullYear(), date.getMonth(), date.getDate()) : weekStart(date);
        const to = new Date(from);
        if (view === 'month') to.setMonth(to.getMonth() + 1); else to.setDate(to.getDate() + (view === 'day' ? 1 : 7));
        return { from, to };
    }, [date, view]);
    const days = useMemo(() => Array.from({ length: view === 'day' ? 1 : 7 }, (_, index) => { const day = view === 'day' ? new Date(date) : weekStart(date); day.setDate(day.getDate() + index); return day; }), [date, view]);
    const data = useClubSchedule(clubId, range.from, range.to);
    const originals = new Map(data.events.map(event => [event.occurrenceId, event]));
    const events = [...data.events.map(event => toWorkspaceEvent(event, clubName)), ...data.training.map(trainingEvent)].filter(event => types.includes(event.eventType));
    const shift = (amount: number) => { const next = new Date(date); if (view === 'month') next.setMonth(next.getMonth() + amount, 1); else next.setDate(next.getDate() + amount * (view === 'day' ? 1 : 7)); setDate(next); };
    // Club entries open where they belong (a match, a squad session); the rest show their details here.
    const select = (event: { id: string }) => {
        const original = originals.get(event.id), destination = original && (scheduleDestination(original) ?? (original.matchExchangeId ? `/match-exchange/${original.matchExchangeId}` : undefined));
        const training = event.id.startsWith('training:') ? event.id.split(':') : null;
        if (destination) navigate(destination);
        else if (training && data.mySquads.includes(Number(training[1]))) navigate(`/my-squads?tab=calendar&squad=${training[1]}`);
        else setDetails(events.find(item => item.id === event.id) ?? null);
    };

    return <PageFrame className="cw-page">
        <section className="squad-schedule-workspace" aria-label={`${clubName} calendar`}>
            <ScheduleDirectionWorkspace surface="CLUB_SCHEDULE" squadSchedule hideContext showHeading={false} title={copy('Club calendar', 'კლუბის კალენდარი')} clubName={clubName} canOpenClub
                canCreate={canManage && data.mySquads.length > 0} createLabel={copy('Plan training', 'ვარჯიშის დაგეგმვა')} mobile={mobile} busy={data.loading} date={date} days={days} view={view}
                events={events} squadNamesById={Object.fromEntries(data.squads.map(squad => [squad.id, squad.name]))} eventTypes={types}
                extraActions={<MatchHistoryLink clubId={clubId} className="gk-btn gk-btn--ghost gk-btn--sm" />}
                notices={<>{data.error && <p role="alert" className="squad-schedule-notice">{data.error} <button type="button" onClick={data.retry}>{copy('Try again', 'ხელახლა ცდა')}</button></p>}
                    {data.privateSquads.length > 0 && <p className="squad-schedule-notice">{copy(`Training times for ${data.privateSquads.join(', ')} are shared with squad members only.`, `${data.privateSquads.join(', ')} — ვარჯიშის დრო მხოლოდ გუნდის წევრებს უჩანთ.`)}</p>}</>}
                onTypes={setTypes} onSurface={() => {}} onView={setView} onDate={setDate} onPrevious={() => shift(-1)} onNext={() => shift(1)} onToday={() => setDate(new Date())}
                onBack={() => {}} onHelp={() => setHelp(true)} onCreate={() => navigate('/my-squads?tab=calendar')} onCreateTraining={() => navigate('/my-squads?tab=calendar')} onSelect={select} />
        </section>
        {details && <EventDetailsDialog event={details} onClose={() => setDetails(null)} />}
        {help && <CalendarTutorial canCreate={false} onComplete={() => setHelp(false)} />}
    </PageFrame>;
}
