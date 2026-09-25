import { useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, Plus, SlidersHorizontal, TriangleAlert, X } from 'lucide-react';
import { formatDate, formatTime } from '../../utils/formatting';
import type { ScheduleEventType } from '../../features/schedule/api';
import { useDialogFocus } from '../workspace/useDialogFocus';
import { StandingSchedule } from './StandingSchedule';
import { EVENT_TYPES, eventTypeCopy, type Notice, type ScheduleWorkspaceEvent, type WorkspaceSurface, type WorkspaceView } from './workspaceTypes';
import './mobile-schedule.css';

interface MobileScheduleWorkspaceProps {
    surface: WorkspaceSurface;
    clubName: string;
    canOpenClub: boolean;
    canCreate: boolean;
    view: WorkspaceView;
    date: Date;
    rangeLabel: string;
    events: ScheduleWorkspaceEvent[];
    routines: ScheduleWorkspaceEvent[];
    eventTypes: ScheduleEventType[];
    publicOnly: boolean;
    busy: boolean;
    notices: Notice[];
    onSurface: (surface: WorkspaceSurface) => void;
    onView: (view: WorkspaceView) => void;
    onDate: (date: Date) => void;
    onPrevious: () => void;
    onNext: () => void;
    onToday: () => void;
    onCreate: () => void;
    onCreateTraining?: () => void;
    onOpenEvent: (event: ScheduleWorkspaceEvent) => void;
    onToggleType: (type: ScheduleEventType) => void;
    onPublicOnly: () => void;
    onResetFilters: () => void;
}

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function MobileScheduleWorkspace(props: MobileScheduleWorkspaceProps) {
    const [filtersOpen, setFiltersOpen] = useState(false);
    const filtersRef = useRef<HTMLDivElement>(null);
    useDialogFocus(filtersOpen, filtersRef, () => setFiltersOpen(false));
    const filtered = props.eventTypes.length !== EVENT_TYPES.length || (props.surface === 'CLUB_SCHEDULE' && props.publicOnly);
    const grouped = useMemo(() => {
        const days = new Map<string, { date: Date; events: ScheduleWorkspaceEvent[] }>();
        for (const event of props.events) {
            const date = new Date(event.startsAt);
            const key = dateKey(date);
            const day = days.get(key) ?? { date, events: [] };
            day.events.push(event);
            days.set(key, day);
        }
        return Array.from(days.values());
    }, [props.events]);

    return <div className="mobile-schedule">
        <header className="mobile-schedule-header">
            <div className="mobile-schedule-title-row">
                <div>
                    <h1 title={props.surface === 'CLUB_SCHEDULE' ? props.clubName : 'My schedule'}>{props.surface === 'CLUB_SCHEDULE' ? props.clubName : 'My schedule'}</h1>
                </div>
                {props.canCreate && <button type="button" className="mobile-schedule-primary" onClick={props.onCreate} disabled={props.busy}>
                    <Plus aria-hidden="true" size={18} /> New event
                </button>}
            </div>
            {props.canOpenClub && <div className="mobile-schedule-segments" aria-label="Schedule owner">
                <button type="button" aria-pressed={props.surface === 'MY_SCHEDULE'} onClick={() => props.onSurface('MY_SCHEDULE')}>My schedule</button>
                <button type="button" aria-pressed={props.surface === 'CLUB_SCHEDULE'} onClick={() => props.onSurface('CLUB_SCHEDULE')}>Club schedule</button>
            </div>}
            <div className="mobile-schedule-tools">
                <div className="mobile-schedule-segments" aria-label="Schedule range">
                    <button type="button" aria-pressed={props.view === 'week'} onClick={() => props.onView('week')}>Agenda</button>
                    <button type="button" aria-pressed={props.view === 'day'} onClick={() => props.onView('day')}>Day</button>
                    <button type="button" aria-pressed={props.view === 'month'} onClick={() => props.onView('month')}>Month</button>
                </div>
                <button type="button" className="mobile-schedule-filter-button" aria-label={filtered ? 'Filters, active' : 'Filters'} aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>
                    <SlidersHorizontal aria-hidden="true" size={18} /> Filters{filtered && <span className="mobile-schedule-filter-dot" />}
                </button>
            </div>
            <div className="mobile-schedule-date-navigation">
                <button type="button" aria-label="Previous period" onClick={props.onPrevious}><ChevronLeft aria-hidden="true" size={20} /></button>
                <label className="mobile-schedule-date-picker">
                    <span>Jump to date</span>
                    <input aria-label="Jump to date" type="date" value={dateKey(props.date)} onChange={event => {
                        const value = event.target.value;
                        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
                        const date = new Date(`${value}T12:00:00`);
                        if (!Number.isNaN(date.getTime())) props.onDate(date);
                    }} />
                </label>
                <button type="button" onClick={props.onToday}>Today</button>
                <button type="button" aria-label="Next period" onClick={props.onNext}><ChevronRight aria-hidden="true" size={20} /></button>
            </div>
        </header>

        <div className="mobile-schedule-scroll" aria-busy={props.busy}>
            <div className="mobile-schedule-range-heading">
                <h2>{props.rangeLabel}</h2>
                <p role="status">{props.busy ? 'Updating schedule…' : `${props.events.length} ${props.events.length === 1 ? 'event' : 'events'}`}</p>
            </div>
            {props.notices.map((notice, index) => <p key={index} className="mobile-schedule-notice" role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.message}</p>)}
            {props.events.length === 0 ? <div className="mobile-schedule-empty">
                <CalendarDays aria-hidden="true" size={32} />
                <h3>{filtered ? 'No events match your filters' : 'Nothing planned in this period'}</h3>
                <p>{filtered ? 'Show all event types to see the full schedule.' : 'Choose another date to see what is coming up.'}</p>
                {filtered ? <button type="button" onClick={props.onResetFilters}>Reset filters</button> : props.canCreate && <button type="button" onClick={props.onCreate}>Add an event</button>}
            </div> : <div className="mobile-schedule-agenda">
                {grouped.map(group => <section key={dateKey(group.date)} aria-label={formatDate(group.date, { weekday: 'long', month: 'long', day: 'numeric' })}>
                    <h3 className="mobile-schedule-day-heading">{formatDate(group.date, { weekday: 'long', month: 'short', day: 'numeric' })}</h3>
                    {group.events.map(event => {
                        const meta = eventTypeCopy[event.eventType];
                        const Icon = meta.icon;
                        const past = new Date(event.startsAt).getTime() < Date.now();
                        const overnight = dateKey(new Date(event.startsAt)) !== dateKey(new Date(event.endsAt));
                        return <button key={event.id} type="button" className="mobile-schedule-event" onClick={() => props.onOpenEvent(event)} style={{ borderInlineStartColor: meta.accent }}>
                            <span className="mobile-schedule-event-type"><Icon size={15} aria-hidden="true" />{meta.label}{event.recurring ? event.recurrence && event.recurrence.intervalValue > 1 ? ` · Every ${event.recurrence.intervalValue} weeks` : ' · Repeats weekly' : ''}{past ? ' · Past' : ''}</span>
                            <span className="mobile-schedule-event-title">{event.title}</span>
                            {event.subtitle && <span>{event.subtitle}</span>}
                            <span className="mobile-schedule-event-detail"><Clock3 size={15} aria-hidden="true" />{formatTime(event.startsAt)} – {overnight ? `${formatDate(event.endsAt, { month: 'short', day: 'numeric' })}, ` : ''}{formatTime(event.endsAt)}</span>
                            {event.locationText && <span className="mobile-schedule-event-detail"><MapPin size={15} aria-hidden="true" />{event.locationText}</span>}
                            {event.conflict && <span className="mobile-schedule-event-conflict"><TriangleAlert size={16} aria-hidden="true" />{event.conflict.explanation}</span>}
                            <span className="mobile-schedule-event-action">{props.canCreate && !past ? 'View or edit event' : 'View event'}<ChevronRight size={16} aria-hidden="true" /></span>
                        </button>;
                    })}
                </section>)}
            </div>}
        </div>

        {filtersOpen && <div className="mobile-schedule-sheet-backdrop" onClick={() => setFiltersOpen(false)}>
            <div ref={filtersRef} role="dialog" aria-modal="true" aria-labelledby="schedule-filters-title" className="mobile-schedule-sheet" onClick={event => event.stopPropagation()}>
                <header><h2 id="schedule-filters-title">Filters & routines</h2><button type="button" aria-label="Close filters" onClick={() => setFiltersOpen(false)}><X size={22} /></button></header>
                <div className="mobile-schedule-sheet-content">
                    <h3>Event types</h3>
                    {EVENT_TYPES.map(type => {
                        const Icon = eventTypeCopy[type].icon;
                        return <label key={type} className="mobile-schedule-filter-row"><Icon aria-hidden="true" size={19} /><span>{eventTypeCopy[type].label}</span><input type="checkbox" checked={props.eventTypes.includes(type)} onChange={() => props.onToggleType(type)} /></label>;
                    })}
                    {props.surface === 'CLUB_SCHEDULE' && <label className="mobile-schedule-filter-row"><span>Public events only</span><input type="checkbox" checked={props.publicOnly} onChange={props.onPublicOnly} /></label>}
                    <button type="button" onClick={props.onResetFilters}>Reset filters</button>
                    <div className="mobile-schedule-routines"><StandingSchedule events={props.routines} onSelect={event => { setFiltersOpen(false); props.onOpenEvent(event); }} onCreateTraining={props.canCreate && props.onCreateTraining ? () => { setFiltersOpen(false); props.onCreateTraining?.(); } : undefined} /></div>
                </div>
                <footer><button type="button" className="mobile-schedule-primary" onClick={() => setFiltersOpen(false)}>Show schedule</button></footer>
            </div>
        </div>}
    </div>;
}
