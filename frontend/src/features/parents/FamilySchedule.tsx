import { scheduleMonthEntries } from '../../components/schedule/segments';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Users } from 'lucide-react';
import { SquadCoachIdentity } from '../squadCommunication/SquadCoachIdentity';
import { JourneyEventDetails } from '../mapPlanning/JourneySchedule';
import { mergeJourneyEntries, useJourneyEntries } from '../mapPlanning/journeyScheduleData';
import { ScheduleDirectionWorkspace } from '../../components/schedule/ScheduleDirectionWorkspace';
import { MatchHistoryLink } from '../matchHistory/MatchHistoryLink';
import { ScheduleGrid } from '../../components/schedule/ScheduleGrid';
import { ScheduleToolbar } from '../../components/schedule/ScheduleToolbar';
import { CalendarTutorial } from '../../components/schedule/CalendarTutorial';
import { useMobileSchedule } from '../../components/schedule/useMobileSchedule';
import { EVENT_TYPES, type WorkspaceView } from '../../components/schedule/workspaceTypes';
import { localDateISO } from '../../components/schedule/scheduleFormUtils';
import { formatDate } from '../../utils/formatting';
import { extractApiErrorMessage } from '../../utils/apiError';
import * as api from '../squadCommunication/api';
import { useSquadSchedule, type CalendarSquad } from '../squadCommunication/useSquadSchedule';
import { SquadSessionDetails } from '../squadCommunication/SquadSessionDialog';
import { SquadClubEventEditor } from '../squadCommunication/SquadClubEventEditor';
import { SquadEventComposer } from '../squadCommunication/SquadEventComposer';
import { SessionNextActions } from '../squadCommunication/SessionNextActions';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { scheduleDestination } from '../schedule/origin';
import type { ParentChild } from './api';
import './family-schedule.css';
import '../squadCommunication/squad-schedule.css';

const weekStart = (value: Date) => {
    const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
    date.setDate(date.getDate() - (date.getDay() + 6) % 7);
    return date;
};

export function ChildSquadSchedule({ child }: { child: ParentChild }) {
    return <ChildSchedule key={`${child.userId}:${child.clubId}`} child={child}/>;
}
function ChildSchedule({ child }: { child: ParentChild }) {
    const copy = useJourneyCopy();
    const [squads, setSquads] = useState<api.SquadOverview[] | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        const abort = new AbortController();
        void api.spaces(abort.signal).then(async rows => {
            const candidates = rows.filter(row => row.club_id === child.clubId);
            const results = await Promise.all(candidates.map(row => api.overview(row.id, abort.signal)));
            if (!abort.signal.aborted) setSquads(results.filter(row => row.players.some(p => p.id === child.userId)));
        }).catch(e => { if (!abort.signal.aborted) setError(extractApiErrorMessage(e, 'Your squad schedule could not load. Please refresh to try again.')); });
        return () => abort.abort();
    }, [child.clubId, child.userId]);
    return <>
        {squads && squads.length > 0 && <nav className="family-squad-links" aria-label="This child’s squads">{squads.map(squad =>
            <Link key={squad.id} to={`/squads/${squad.id}`}><div className="family-squad-identity"><small>{copy('This week', 'ეს კვირა')} · {squad.academy_name || child.clubName}</small><strong>{squad.name}</strong><SquadCoachIdentity space={squad}/></div><span className="family-squad-open">{copy('Open squad', 'გუნდის გახსნა')} <ArrowRight size={18} /></span></Link>)}</nav>}
        {error && <p role="alert" className="parent-warning">{error}</p>}
        {!squads && !error ? <p role="status">Loading your child’s schedule…</p> : <FamilySchedule squads={squads ?? []} playerId={child.userId} prioritizeNextAction />}
    </>;
}

/** The exact schedule workspace used by the main calendar, backed by the selected squad. */
export function FamilySchedule({ squads, playerId, initialSquadId, initialDate, initialSessionId, onSquadChange, inSquadPage = false, prioritizeNextAction = false }: {
    squads: CalendarSquad[]; playerId?: number; initialSquadId?: number; initialDate?: Date; initialSessionId?: number; onSquadChange?: (id: number) => void; inSquadPage?: boolean; prioritizeNextAction?: boolean;
}) {
    const navigate = useNavigate();
    const copy = useJourneyCopy();
    const mobile = useMobileSchedule();
    const [picked, setPicked] = useState(initialSquadId);
    const squad = squads.find(s => s.id === picked) ?? (initialSquadId ? undefined : squads[0]);
    const [date, setDate] = useState(() => initialDate && Number.isFinite(initialDate.getTime()) ? initialDate : new Date());
    const [view, setView] = useState<WorkspaceView>('week');
    const [types, setTypes] = useState(EVENT_TYPES);
    const [selectedId, setSelectedId] = useState<string | null>(() => squad && initialSessionId ? `squad:${squad.id}:${initialSessionId}` : null);
    const [revision, setRevision] = useState(0);
    const [eventDraft, setEventDraft] = useState<{date: Date; weekly: boolean} | null>(null);
    const [help, setHelp] = useState(false);
    const range = useMemo(() => {
        const from = view === 'month' ? new Date(date.getFullYear(), date.getMonth(), 1) : view === 'day' ? new Date(date.getFullYear(), date.getMonth(), date.getDate()) : weekStart(date);
        const to = new Date(from);
        if (view === 'month') to.setMonth(to.getMonth() + 1); else to.setDate(to.getDate() + (view === 'day' ? 1 : 7));
        return { from, to };
    }, [date, view]);
    const { events, error, loading } = useSquadSchedule(squad ? [squad] : [], `${localDateISO(range.from)}T00:00:00`, `${localDateISO(range.to)}T00:00:00`, revision, playerId);
    const days = useMemo(() => Array.from({ length: view === 'day' ? 1 : 7 }, (_, i) => {
        const day = view === 'day' ? new Date(date) : weekStart(date); day.setDate(day.getDate() + i); return day;
    }), [date, view]);
    const journeys=useJourneyEntries(range.from.toISOString(),range.to.toISOString(),revision,playerId,squad?.id);
    const connected=mergeJourneyEntries(events,journeys.entries);
    const visible = connected.filter(event => types.includes(event.eventType) && new Date(event.startsAt) < range.to && new Date(event.endsAt) > range.from);
    const selected = connected.find(event => event.id === selectedId);
    const rangeLabel = formatDate(date, { month: 'long', year: 'numeric' });
    const refresh = () => setRevision(n => n + 1);
    const openSessionCreation = (day?: Date) => setEventDraft({ date: day instanceof Date && Number.isFinite(day.getTime()) ? day : date, weekly: false });
    const shift = (amount: number) => {
        const next = new Date(date);
        if (view === 'month') next.setMonth(next.getMonth() + amount, 1); else next.setDate(next.getDate() + amount * (view === 'day' ? 1 : 7));
        setDate(next); setSelectedId(null);
    };
    const select = (event: { id: string }) => {
        const item = connected.find(candidate => candidate.id === event.id);
        const destination = item && scheduleDestination(item);
        if (item?.journeys?.length) setSelectedId(event.id); else if (destination) navigate(destination); else setSelectedId(event.id);
    };
    const chooseSquad = (id: number) => { setPicked(id); setSelectedId(null); setEventDraft(null); onSquadChange?.(id); };
    const editingEvent = selected && !selected.journeys?.length && !selected.session && !scheduleDestination(selected) && squad?.can_manage && selected.owningClubId === squad.club_id;
    const nextActions = !loading && <SessionNextActions events={events} canManage={!!squad?.can_manage} playerId={playerId} onSelect={select} compact={!prioritizeNextAction}/>;
    return <section className="squad-schedule-workspace" aria-label="Squad schedule">

        <ScheduleDirectionWorkspace hideInspector={Boolean(selected?.journeys?.length)} surface="CLUB_SCHEDULE" squadSchedule title="Squad schedule"
            extraActions={<MatchHistoryLink clubId={squad?.club_id} squadId={squad?.id} className="schedule-direction-help" />}
            clubName={squad ? `${squad.academy_name ? squad.academy_name + ' · ' : ''}${squad.name}` : 'Your squads'}
            description="Training, matches and the next time your squad meets."
            backLabel={inSquadPage ? 'Back to my squads' : squad ? 'Back to squad' : 'Back to my squads'}
            canOpenClub canCreate={!!squad?.can_manage}
            createLabel={copy('New event', 'ახალი ღონისძიება')} showTraining supportsTrainingPlan
            priorityContent={prioritizeNextAction ? nextActions : undefined}
            showHeading={!prioritizeNextAction}
            mobile={mobile} busy={loading} date={date} days={days} view={view} rangeLabel={rangeLabel}
            events={visible} squadNamesById={Object.fromEntries(squads.map(s => [s.id, s.name]))}
            eventTypes={types} publicOnly={false} onTypes={setTypes} onPublicOnly={() => {}}
            onSurface={surface => { if (surface === 'MY_SCHEDULE') navigate('/calendar?scope=personal'); }}
            onView={setView} onDate={setDate} onPrevious={() => shift(-1)} onNext={() => shift(1)} onToday={() => setDate(new Date())}
            onBack={() => navigate(squad && !inSquadPage ? `/squads/${squad.id}` : '/squads')}
            onHelp={() => setHelp(true)} onCreate={openSessionCreation} onCreateTraining={() => setEventDraft({ date, weekly: true })} onSelect={select}
            squadControl={<label className="schedule-direction-squad"><Users size={15}/><select aria-label="Choose squad" value={squad?.id ?? ''} onChange={event => chooseSquad(Number(event.target.value))}>
                {!squad && <option value="">Choose a squad</option>}{squads.map(s => <option key={s.id} value={s.id}>{s.name}{s.academy_name ? ` · ${s.academy_name}` : ''}</option>)}
            </select></label>}
            notices={<>{journeys.error && <p role="alert" className="squad-schedule-notice">{journeys.error} <button onClick={refresh}>Try again</button></p>}{error && <p role="alert" className="squad-schedule-notice">{error} <button onClick={refresh}>Try again</button></p>}{!squad && <p role="status">{initialSquadId ? 'This squad is unavailable. Choose one of your squads.' : 'Your schedule will appear when you or your child joins a squad.'}</p>}{!prioritizeNextAction && nextActions}</>}
            calendarContent={items => <div className="schedule-direction-calendar">
                <ScheduleToolbar workspaceLabel="Squad schedule" rangeLabel={rangeLabel} viewMode={view} stats={[]} scheduleBusy={loading} onViewModeChange={setView} editMode={false} onToggleEditMode={() => {}} canEdit={false}/>
                <div className="schedule-direction-calendar-grid"><ScheduleGrid viewMode={view} cursorDate={date} days={days} events={items}
                    monthEvents={scheduleMonthEntries(items)}
                    onSelectDate={setDate} onEditEvent={select} onOpenPastEvent={select} canCreate={!!squad?.can_manage}
                    onCreateAt={openSessionCreation} editMode={false} onEventDragEnd={() => {}}/></div>
            </div>}/>
        {selectedId && !selected && !loading && <p role="status" className="squad-schedule-notice">{copy('This session is unavailable in the selected week or your invitation has changed. Check your latest coach update.', 'ეს სესია არჩეულ კვირაში მიუწვდომელია ან თქვენი მოწვევა შეიცვალა. ნახეთ მწვრთნელის ბოლო განახლება.')}</p>}
        {!!selected?.journeys?.length && <JourneyEventDetails entries={selected.journeys} onClose={()=>setSelectedId(null)} onSaved={refresh}/>}
        {selected && !selected.journeys?.length && !editingEvent && <SquadSessionDetails key={selected.id} event={selected} playerId={playerId} canManage={!!squad?.can_manage} onClose={() => setSelectedId(null)} onSaved={refresh}/>}
        {editingEvent && squad && <SquadClubEventEditor key={selected.id} squad={squad} date={date} event={selected} onClose={() => setSelectedId(null)} onSaved={() => { setSelectedId(null); refresh(); }}/ >}
        {eventDraft && squad?.can_manage && <SquadEventComposer key={`${squad.id}:${eventDraft.date.toISOString()}:${eventDraft.weekly}`} squad={squad} date={eventDraft.date} weekly={eventDraft.weekly} onClose={() => setEventDraft(null)} onSaved={() => { setEventDraft(null); refresh(); }}/ >}
        {help && !selected?.journeys?.length && <CalendarTutorial canCreate={!!squad?.can_manage} onComplete={() => setHelp(false)}/>}
    </section>;
}
