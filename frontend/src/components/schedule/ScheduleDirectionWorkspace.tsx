import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, CircleHelp, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Chip } from '../../design/primitives';
import { ScheduleScore } from '../../features/matchHistory/ScheduleResult';
import { ScheduleBoard, type BoardEntry } from '../../features/schedule/board/ScheduleBoard';
import { kindOf, matchesType, typeFilters, type TypeFilter } from '../../features/schedule/board/scheduleEvents';
import { dayKey, type BoardPeriod, type BoardView } from '../../features/schedule/board/scheduleRange';
import type { ScheduleEventType } from '../../features/schedule/api';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import { localDateISO } from './scheduleFormUtils';
import { TrainingPlans } from './TrainingPlans';
import { EVENT_TYPES, type ScheduleWorkspaceEvent, type WorkspaceSurface, type WorkspaceView } from './workspaceTypes';
import { SelectionIndicator } from '../ui/SelectionIndicator';
import './schedule-direction-workspace.css';

interface Props {
    squadSchedule?: boolean;
    title?: string;
    description?: string;
    backLabel?: string;
    squadControl?: ReactNode;
    showTraining?: boolean;
    /** Leaves the training plans out (a trip is open over the schedule). */
    hideInspector?: boolean;
    supportsTrainingPlan?: boolean;
    createLabel?: string;
    extraActions?: ReactNode;
    priorityContent?: ReactNode;
    showHeading?: boolean;
    /** Another page frames the schedule: no back link or schedule switch of its own. */
    hideContext?: boolean;
    /** A schedule inside another page (Parent Hub): week and agenda only, no guide or plans. */
    embedded?: boolean;
    surface: WorkspaceSurface;
    clubName: string;
    canOpenClub: boolean;
    canCreate: boolean;
    mobile: boolean;
    busy: boolean;
    date: Date;
    days: Date[];
    view: WorkspaceView;
    events: ScheduleWorkspaceEvent[];
    squadNamesById: Readonly<Record<number, string>>;
    eventTypes: ScheduleEventType[];
    notices: ReactNode;
    /** Below the schedule, after the plans: the host's own links. */
    footer?: ReactNode;
    onSurface: (surface: WorkspaceSurface) => void;
    onView: (view: WorkspaceView) => void;
    onDate: (date: Date) => void;
    onPrevious: () => void;
    onNext: () => void;
    onToday: () => void;
    onBack: () => void;
    onHelp: () => void;
    onCreate: (day?: Date) => void;
    onCreateTraining: () => void;
    onSelect: (event: ScheduleWorkspaceEvent) => void;
    onTypes: (types: ScheduleEventType[]) => void;
    /** Which entries may be dragged to another day, and what to do when one is (the host confirms the move). */
    canMove?: (event: ScheduleWorkspaceEvent) => boolean;
    onMove?: (event: ScheduleWorkspaceEvent, day: Date) => void;
}

const typesFor = (filter: TypeFilter) => EVENT_TYPES.filter(type => matchesType(type, filter));
const sameTypes = (first: ScheduleEventType[], second: ScheduleEventType[]) => first.length === second.length && first.every(type => second.includes(type));
const storedView = (mobile: boolean): BoardView => {
    try {
        const saved = localStorage.getItem(`gk.schedule.view.${mobile ? 'mobile' : 'desktop'}`);
        if (saved === 'calendar' || saved === 'agenda') return saved;
    } catch { /* Storage can be unavailable in private browsing. */ }
    return 'week';
};

/**
 * A squad's, a club's or a family's schedule on the one schedule board: the page's own heading and way back, then
 * the shared toolbar, filters and week, calendar or agenda. Cards open where they belong; people who plan a squad
 * can add on a day and drag its sessions to another day.
 */
export function ScheduleDirectionWorkspace(props: Props) {
    const { t } = useTranslation();
    const copy = useJourneyCopy();
    const views: BoardView[] = props.embedded ? ['week', 'agenda'] : ['week', 'calendar', 'agenda'];
    const [chosen, setChosen] = useState<BoardView>(() => storedView(props.mobile));
    const display = views.includes(chosen) ? chosen : 'week';
    const choose = (value: BoardView) => {
        setChosen(value);
        try { localStorage.setItem(`gk.schedule.view.${props.mobile ? 'mobile' : 'desktop'}`, value === 'week' ? 'board' : value); } catch { /* Keep the current in-memory preference. */ }
    };
    // The calendar needs the host's month; the week and agenda its week.
    const { view: hostView, onView } = props;
    useEffect(() => {
        if (display === 'calendar' && hostView !== 'month') onView('month');
        else if (display !== 'calendar' && hostView === 'month') onView('week');
    }, [display, hostView, onView]);

    const club = props.squadSchedule || props.surface === 'CLUB_SCHEDULE';
    const typeFilter = typeFilters.find(filter => sameTypes(typesFor(filter.id), props.eventTypes))?.id ?? 'all';
    const filtered = typeFilter !== 'all';
    const squadName = (event: ScheduleWorkspaceEvent) => (event.hostSquadId != null ? props.squadNamesById[event.hostSquadId] : undefined) || event.hostSquadName;
    const now = new Date();
    const calendar = display === 'calendar';
    const first = props.days[0] ?? props.date;
    const period: BoardPeriod = {
        view: display,
        from: calendar ? new Date(props.date.getFullYear(), props.date.getMonth(), 1) : first,
        days: props.days.length || 7,
        label: '',
        isCurrent: calendar ? props.date.getFullYear() === now.getFullYear() && props.date.getMonth() === now.getMonth() : props.days.some(day => dayKey(day) === dayKey(now)),
        shift: direction => (direction < 0 ? props.onPrevious() : props.onNext()),
        today: props.onToday,
        setView: choose,
        goTo: day => { props.onDate(day); choose('week'); },
    };

    const byKey = new Map(props.events.map(event => [event.id, event]));
    const entries: BoardEntry[] = props.events.filter(event => Number.isFinite(Date.parse(event.startsAt))).map(event => {
        const cancelled = event.status.toUpperCase() === 'CANCELLED';
        const kind = kindOf(event);
        const replies = !cancelled ? event.responseSummary : undefined;
        const scored = ['MATCH', 'FRIENDLY'].includes(event.eventType) && Date.parse(event.endsAt) < now.getTime();
        const typeLabel = t(`schedule.event.${event.eventType.toLowerCase()}`, { defaultValue: kind.label });
        const trail = cancelled || replies?.cantCome || replies?.pending || event.conflict || scored ? <>
            {cancelled && <Badge tone="danger">{t('schedule.direction.cancelled', { defaultValue: 'Cancelled' })}</Badge>}
            {replies?.cantCome ? <Badge>{t('schedule.direction.cantCome', { defaultValue: '{{count}} can’t come', count: replies.cantCome })}</Badge> : null}
            {replies?.pending ? <Badge tone="warning">{t('schedule.direction.toConfirm', { defaultValue: '{{count}} to confirm', count: replies.pending })}</Badge> : null}
            {event.conflict && <Badge tone="warning">{t('schedule.direction.overlap', { defaultValue: 'Schedule overlap' })}</Badge>}
            {scored && !cancelled && <ScheduleScore event={event} />}
        </> : undefined;
        return {
            key: event.id, startsAt: event.startsAt, endsAt: event.endsAt, title: event.title, tone: kind.tone, cancelled,
            activity: event.journeys?.length ? 'OUTING' as const : event.eventType, recurring: event.recurring,
            meta: [squadName(event) || (club ? null : event.ownerLabel), event.subtitle, event.locationText].filter(Boolean).join(' · '),
            trail, movable: Boolean(props.canMove?.(event)), onOpen: () => props.onSelect(event), label: `${event.title}, ${typeLabel.toLowerCase()}`,
        };
    });

    const actions = <>
        {props.extraActions}
        {!props.mobile && !props.embedded && <Button iconOnly variant="ghost" aria-label={t('schedule.direction.help')} title={t('schedule.direction.help')} onClick={props.onHelp}><CircleHelp aria-hidden="true" /></Button>}
        {props.canCreate && <Button size="sm" variant="primary" data-tutorial="calendar-new-event-btn" disabled={props.busy} onClick={() => props.onCreate()}>
            <Plus aria-hidden="true" />{props.createLabel ?? t('schedule.direction.newEvent')}
        </Button>}
    </>;
    const squadControl = (props.embedded || (props.showHeading === false && !props.hideContext)) && props.squadControl;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return (
        <div className="schedule-direction" aria-busy={props.busy}>
            {props.priorityContent}
            {!props.hideContext && <div className="schedule-direction-context">
                <button type="button" data-tutorial="calendar-back-nav" onClick={props.onBack}>
                    <ArrowLeft size={15} aria-hidden="true" />
                    {props.backLabel ?? (club ? props.clubName : t('schedule.direction.back'))}
                </button>
                <div data-tutorial="calendar-surface-toggle" className="app-selection-rail schedule-direction-segments" role="group" aria-label={t('schedule.direction.chooseSchedule')}>
                    <SelectionIndicator value={club ? 'squad' : 'personal'} />
                    <button type="button" aria-pressed={!club} onClick={() => props.onSurface('MY_SCHEDULE')}>{t('schedule.direction.mySchedule')}</button>
                    {props.canOpenClub && <button type="button" aria-pressed={club} onClick={() => props.onSurface('CLUB_SCHEDULE')}>{t('schedule.direction.squadSchedule', { defaultValue: 'Squad schedule' })}</button>}
                </div>
            </div>}
            {props.showHeading !== false && <header className="schedule-direction-heading">
                <div>
                    <span className="schedule-direction-eyebrow">{club ? props.clubName : t('schedule.direction.yourWeek')}</span>
                    <h1>{props.title ?? (club ? t('schedule.direction.squadSchedule', { defaultValue: 'Squad schedule' }) : t('schedule.direction.mySchedule'))}<span>.</span></h1>
                    <p>{props.description ?? t(club ? 'schedule.direction.clubDescription' : 'schedule.direction.personalDescription')}</p>
                    {props.squadControl && <div className="schedule-direction-identity">{props.squadControl}</div>}
                </div>
            </header>}
            <ScheduleBoard label={props.title ?? t('schedule.direction.squadSchedule', { defaultValue: 'Squad schedule' })} range={period} views={views} entries={entries} loading={props.busy}
                actions={actions} notices={props.notices}
                filters={<>
                    <div className="gk-chips" role="group" aria-label={t('schedule.direction.filterTypes')}>
                        {typeFilters.map(filter => <Chip key={filter.id} pressed={typeFilter === filter.id} onClick={() => props.onTypes(typesFor(filter.id))}>{copy(filter.label, filter.ka)}</Chip>)}
                    </div>
                    {squadControl}
                </>}
                nav={{ previous: t('schedule.direction.previous'), next: t('schedule.direction.next'), jump: props.embedded ? undefined : { label: t('schedule.direction.jump'), value: localDateISO(props.date), onChange: props.onDate } }}
                onCreateAt={props.canCreate && !props.busy ? day => props.onCreate(day) : undefined}
                onMove={props.onMove ? (key, day) => { const event = byKey.get(key); if (event) props.onMove?.(event, day); } : undefined}
                empty={{
                    title: filtered ? copy('Nothing of this kind planned.', 'ამ ტიპის არაფერია დაგეგმილი.') : calendar ? copy('Nothing planned this month.', 'ამ თვეში არაფერია დაგეგმილი.') : copy('Nothing planned this week.', 'ამ კვირაში არაფერია დაგეგმილი.'),
                    action: filtered ? <button type="button" className="gk-board__link" onClick={() => props.onTypes(EVENT_TYPES)}>{copy('Show everything', 'ყველაფრის ჩვენება')}</button> : undefined,
                }}
                footer={<>
                    {!props.embedded && !props.hideInspector && props.showTraining !== false && <TrainingPlans events={props.events} squadName={squadName} canCreate={props.canCreate && !props.busy}
                        onCreate={props.supportsTrainingPlan === false ? undefined : props.onCreateTraining} onSelect={props.onSelect} />}
                    {props.footer}
                    {!props.embedded && <p className="gk-board__note">{t('schedule.direction.timezone', { defaultValue: 'Times shown in {{timezone}}', timezone })}</p>}
                </>} />
        </div>
    );
}
