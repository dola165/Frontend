import { useMemo, useState, type ReactNode } from 'react';
import {
    ArrowLeft,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    CircleHelp,
    Columns3,
    List,
    Plus,
    Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../utils/formatting';
import { localDateISO } from './scheduleFormUtils';
import { ScheduleWeekBoard } from './ScheduleWeekBoard';
import {
    EVENT_TYPES,
    eventTypeCopy,
    type ScheduleWorkspaceEvent,
    type WorkspaceSurface,
    type WorkspaceView,
} from './workspaceTypes';
import type { ScheduleEventType } from '../../features/schedule/api';
import './schedule-direction-workspace.css';

interface Props {
    squadSchedule?: boolean;
    title?: string;
    description?: string;
    backLabel?: string;
    squadControl?: ReactNode;
    showTraining?: boolean;
    hideInspector?: boolean;
    supportsTrainingPlan?: boolean;
    createLabel?: string;
    extraActions?: ReactNode;
    priorityContent?: ReactNode;
    showHeading?: boolean;
    surface: WorkspaceSurface;
    clubName: string;
    canOpenClub: boolean;
    canCreate: boolean;
    mobile: boolean;
    busy: boolean;
    date: Date;
    days: Date[];
    view: WorkspaceView;
    rangeLabel: string;
    events: ScheduleWorkspaceEvent[];
    squadNamesById: Readonly<Record<number, string>>;
    eventTypes: ScheduleEventType[];
    publicOnly: boolean;
    calendarContent: (events: ScheduleWorkspaceEvent[]) => ReactNode;
    notices: ReactNode;
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
    onPublicOnly: () => void;
}

export function ScheduleDirectionWorkspace(props: Props) {
    const { t } = useTranslation();
    const [display, setDisplay] = useState<'board' | 'agenda' | 'calendar'>(() => {
        try {
            const saved = localStorage.getItem(`gk.schedule.view.${props.mobile ? 'mobile' : 'desktop'}`);
            if (saved === 'board' || saved === 'agenda' || saved === 'calendar') return saved;
        } catch { /* Storage can be unavailable in private browsing. */ }
        return props.mobile ? 'agenda' : 'board';
    });
    const [squad, setSquad] = useState('all');
    const club = props.squadSchedule || props.surface === 'CLUB_SCHEDULE';
    const selectedSquad = club ? squad : 'all';
    const events = useMemo(
        () => props.events.filter((event) => selectedSquad === 'all' || event.hostSquadId === Number(selectedSquad)),
        [props.events, selectedSquad],
    );
    const filtered = props.eventTypes.length !== EVENT_TYPES.length || props.publicOnly || selectedSquad !== 'all';
    const reset = () => {
        props.onTypes(EVENT_TYPES);
        if (props.publicOnly) props.onPublicOnly();
        setSquad('all');
    };
    const selectDisplay = (value: typeof display) => {
        setDisplay(value);
        try { localStorage.setItem(`gk.schedule.view.${props.mobile ? 'mobile' : 'desktop'}`, value); } catch { /* Keep the current in-memory preference. */ }
        if (value !== 'calendar') props.onView('week');
    };
    const first = props.days[0] ?? props.date;
    const last = props.days[props.days.length - 1] ?? props.date;
    const hasHeadingActions = Boolean(props.extraActions) || !props.mobile || props.canCreate;
    const headingActions = <div className="schedule-direction-actions">
        {props.extraActions}
        {!props.mobile && (
            <button
                type="button"
                className="schedule-direction-help"
                aria-label={t('schedule.direction.help')}
                onClick={props.onHelp}
            >
                <CircleHelp size={18} />
            </button>
        )}
        {props.canCreate && (
            <button
                type="button"
                data-tutorial="calendar-new-event-btn"
                className="schedule-direction-primary"
                disabled={props.busy}
                onClick={() => props.onCreate()}
            >
                <Plus size={19} aria-hidden="true" />
                {props.createLabel ?? t('schedule.direction.newEvent')}
            </button>
        )}
    </div>;

    return (
        <div className="schedule-direction" aria-busy={props.busy}>
            {props.priorityContent}
            <div className="schedule-direction-context">
                <button type="button" data-tutorial="calendar-back-nav" onClick={props.onBack}>
                    <ArrowLeft size={15} aria-hidden="true" />
                    {props.backLabel ?? (club ? props.clubName : t('schedule.direction.back'))}
                </button>
                <div
                    data-tutorial="calendar-surface-toggle"
                    className="app-selection-rail schedule-direction-segments"
                    role="group"
                    aria-label={t('schedule.direction.chooseSchedule')}
                >
                    <SelectionIndicator value={club ? 'squad' : 'personal'} />
                    <button type="button" aria-pressed={!club} onClick={() => props.onSurface('MY_SCHEDULE')}>
                        {t('schedule.direction.mySchedule')}
                    </button>
                    {props.canOpenClub && (
                        <button type="button" aria-pressed={club} onClick={() => props.onSurface('CLUB_SCHEDULE')}>
                            {t('schedule.direction.squadSchedule', { defaultValue: 'Squad schedule' })}
                        </button>
                    )}
                </div>
                {props.showHeading === false && hasHeadingActions && headingActions}
            </div>
            {props.showHeading !== false && <header className="schedule-direction-heading">
                <div>
                    <span className="schedule-direction-eyebrow">
                        {club ? props.clubName : t('schedule.direction.yourWeek')}
                    </span>
                    <h1>
                        {props.title ?? (club ? t('schedule.direction.squadSchedule', { defaultValue: 'Squad schedule' }) : t('schedule.direction.mySchedule'))}
                        <span>.</span>
                    </h1>
                    <p>{props.description ?? t(club ? 'schedule.direction.clubDescription' : 'schedule.direction.personalDescription')}</p>
                    {props.squadControl && <div className="schedule-direction-identity">{props.squadControl}</div>}
                </div>
                {headingActions}
            </header>}
            <div className="schedule-direction-weekbar">
                <div className="schedule-direction-period" data-tutorial="calendar-date-nav">
                    {props.view !== 'month' && (
                        <span className="schedule-direction-numerals" aria-hidden="true">
                            {first.getDate()}
                            {props.view !== 'day' && (
                                <>
                                    <span>—</span>
                                    {last.getDate()}
                                </>
                            )}
                        </span>
                    )}
                    <div className="schedule-direction-date-label">
                        <strong>
                            {props.view === 'month'
                                ? props.rangeLabel
                                : `${formatDate(first, { month: 'long', year: 'numeric' })}${first.getMonth() !== last.getMonth() ? ` / ${formatDate(last, { month: 'short' })}` : ''}`}
                        </strong>
                        <small role="status">
                            {props.busy
                                ? t('schedule.direction.updating')
                                : t('schedule.direction.eventsCount', { count: events.length })}
                        </small>
                    </div>
                    <div className="schedule-direction-date-buttons">
                        <button type="button" aria-label={t('schedule.direction.previous')} onClick={props.onPrevious}>
                            <ChevronLeft size={18} />
                        </button>
                        <button type="button" onClick={props.onToday}>
                            {t('schedule.direction.today')}
                        </button>
                        <button type="button" aria-label={t('schedule.direction.next')} onClick={props.onNext}>
                            <ChevronRight size={18} />
                        </button>
                        <label className="schedule-direction-jump" title={t('schedule.direction.jump')}>
                            <CalendarDays size={16} aria-hidden="true" />
                            <input
                                type="date"
                                aria-label={t('schedule.direction.jump')}
                                value={localDateISO(props.date)}
                                onChange={(event) => {
                                    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) return;
                                    const date = new Date(`${event.target.value}T12:00:00`);
                                    if (Number.isFinite(date.getTime())) props.onDate(date);
                                }}
                            />
                        </label>
                    </div>
                </div>
                <div
                    data-tutorial="calendar-view-mode"
                    className="app-selection-rail schedule-direction-segments"
                    role="group"
                    aria-label={t('schedule.direction.view')}
                >
                    <SelectionIndicator value={display} />
                    {(
                        [
                            { value: 'board', icon: Columns3 },
                            { value: 'calendar', icon: CalendarDays },
                            { value: 'agenda', icon: List },
                        ] as const
                    ).map(({ value, icon: Icon }) => (
                        <button
                            type="button"
                            key={value}
                            aria-pressed={display === value}
                            onClick={() => selectDisplay(value)}
                        >
                            <Icon size={15} aria-hidden="true" />
                            {t(`schedule.direction.${value}`)}
                        </button>
                    ))}
                </div>
            </div>
            <div className="schedule-direction-filters">
                <div
                    className="schedule-direction-types"
                    data-tutorial="calendar-event-filters"
                    role="group"
                    aria-label={t('schedule.direction.filterTypes')}
                >
                    <button
                        type="button"
                        aria-pressed={props.eventTypes.length === EVENT_TYPES.length}
                        onClick={() => props.onTypes(EVENT_TYPES)}
                    >
                        {t('schedule.direction.allEvents')}
                    </button>
                    {EVENT_TYPES.map((type) => (
                        <button
                            type="button"
                            key={type}
                            aria-pressed={props.eventTypes.length === 1 && props.eventTypes.includes(type)}
                            onClick={() =>
                                props.onTypes(
                                    props.eventTypes.length === 1 && props.eventTypes.includes(type)
                                        ? EVENT_TYPES
                                        : [type],
                                )
                            }
                        >
                            <i style={{ background: eventTypeCopy[type].accent }} />
                            {t(`schedule.event.${type.toLowerCase()}`)}
                        </button>
                    ))}
                </div>
                <div className="schedule-direction-filter-options">
                    {props.showHeading === false && props.squadControl}
                    {club && !props.squadSchedule && (
                        <>
                            <button
                                type="button"
                                className="schedule-direction-public"
                                aria-pressed={props.publicOnly}
                                onClick={props.onPublicOnly}
                            >
                                {t('schedule.direction.publicOnly')}
                            </button>
                            <label className="schedule-direction-squad">
                                <Users size={15} aria-hidden="true" />
                                <select
                                    aria-label={t('schedule.direction.filterSquad')}
                                    value={selectedSquad}
                                    onChange={(event) => setSquad(event.target.value)}
                                >
                                    <option value="all">{t('schedule.direction.allSquads')}</option>
                                    {Object.entries(props.squadNamesById).map(([id, name]) => (
                                        <option key={id} value={id}>
                                            {name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </>
                    )}
                    {filtered && (
                        <button type="button" className="schedule-direction-reset" onClick={reset}>
                            {t('schedule.direction.reset')}
                        </button>
                    )}
                </div>
            </div>
            {props.notices}
            <ScheduleWeekBoard
                days={props.days}
                events={events}
                trainingEvents={events}
                view={display}
                calendarContent={display === 'calendar' ? props.calendarContent(events) : undefined}
                canCreate={props.canCreate && !props.busy}
                onCreate={props.onCreate}
                onCreateTraining={props.supportsTrainingPlan === false ? undefined : props.onCreateTraining}
                onSelect={props.onSelect}
                squadNamesById={props.squadNamesById}
                hasActiveFilters={filtered}
                onResetFilters={reset}
                showTraining={props.showTraining}
                hideInspector={props.hideInspector}
            />
        </div>
    );
}
import { SelectionIndicator } from '../ui/SelectionIndicator';
