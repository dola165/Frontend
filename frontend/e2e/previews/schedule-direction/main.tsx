import { useMemo, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import {
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    Check,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Columns3,
    List,
    MapPin,
    Plus,
    Repeat2,
    Shield,
    Users,
    X,
} from 'lucide-react';
import { EventCreationModal, type EventCreationFormValues } from '../../../src/components/schedule/EventCreationModal';
import { localDateISO, upcomingTrainingDates } from '../../../src/components/schedule/scheduleFormUtils';
import type { DayOfWeek, ScheduleEventType, ScheduleEventUpsertInput } from '../../../src/features/schedule/api';
import { apiClient } from '../../../src/api/axiosConfig';
import i18n from '../../../src/i18n';
import '../../../src/index.css';
import '../../../src/styles/product-identity.css';
import './style.css';

void i18n.changeLanguage('en');
document.documentElement.classList.add('dark');
const CLUB = 'FC Dinamo Tbilisi';
const squads = [
    { id: 11, name: 'Under 16' },
    { id: 12, name: 'First team' },
    { id: 13, name: 'Under 14' },
];
// Every request made by the real editor stays inside this design preview.
apiClient.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: config.url?.endsWith('/squads') ? squads : {},
});
const weekdays: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const metadata: Record<ScheduleEventType, { label: string; color: string }> = {
    TRAINING: { label: 'Training', color: '#38db8b' },
    MATCH: { label: 'Match', color: '#f1bf64' },
    FRIENDLY: { label: 'Friendly', color: '#e79eb9' },
    TRYOUT: { label: 'Tryout', color: '#86baff' },
    ACTIVITY: { label: 'Club activity', color: '#b1bdca' },
};
const dateObject = (key: string) => new Date(`${key}T12:00:00`);
const addDays = (key: string, n: number) => {
    const date = dateObject(key);
    date.setDate(date.getDate() + n);
    return localDateISO(date);
};
const nextMonday = new Date();
nextMonday.setHours(12, 0, 0, 0);
nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));
const initialWeek = localDateISO(nextMonday);
const formatDay = (
    key: string,
    options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' },
) => new Intl.DateTimeFormat('en-GB', options).format(dateObject(key));
const shortTime = (value: string) => value.slice(11, 16);
type Entry = ScheduleEventUpsertInput & { id: number };
type Occurrence = Entry & { key: string; day: string };
const training = (
    id: number,
    title: string,
    squad: number,
    days: DayOfWeek[],
    time: string,
    location: string,
): Entry => ({
    id,
    title,
    eventType: 'TRAINING',
    hostSquadId: squad,
    startsAt: `${initialWeek}T${time}:00`,
    endsAt: `${initialWeek}T${String(+time.slice(0, 2) + 1).padStart(2, '0')}:30:00`,
    locationName: location,
    description: 'Bring boots, shin pads and water. Meet at the pitch ten minutes before training.',
    visibility: 'PRIVATE',
    recurrence: {
        frequency: 'WEEKLY',
        intervalValue: 1,
        daysOfWeek: days,
        startDate: initialWeek,
        endDate: addDays(initialWeek, 55),
        startTime: `${time}:00`,
        endTime: `${String(+time.slice(0, 2) + 1).padStart(2, '0')}:30:00`,
        timezone: 'Asia/Tbilisi',
    },
});
const initialEvents: Entry[] = [
    training(1, 'Ball work & small-sided games', 11, ['MONDAY', 'WEDNESDAY', 'FRIDAY'], '17:00', 'Academy · Pitch 2'),
    training(2, 'Match preparation', 12, ['TUESDAY', 'THURSDAY'], '18:00', 'Training ground'),
    {
        id: 3,
        title: 'Home match',
        eventType: 'MATCH',
        hostSquadId: 11,
        startsAt: `${addDays(initialWeek, 5)}T15:00:00`,
        endsAt: `${addDays(initialWeek, 5)}T17:00:00`,
        locationName: 'Academy · Main pitch',
        visibility: 'PUBLIC',
        description: 'Meet at 14:15. Bring the home kit and shin pads.',
    },
    {
        id: 4,
        title: 'Coaches’ weekly catch-up',
        eventType: 'ACTIVITY',
        startsAt: `${addDays(initialWeek, 2)}T12:00:00`,
        endsAt: `${addDays(initialWeek, 2)}T12:45:00`,
        locationName: 'Clubhouse',
        visibility: 'PRIVATE',
    },
    {
        id: 5,
        title: 'Academy open session',
        eventType: 'TRYOUT',
        hostSquadId: null,
        startsAt: `${addDays(initialWeek, 6)}T10:00:00`,
        endsAt: `${addDays(initialWeek, 6)}T11:30:00`,
        locationName: 'Academy · Pitch 1',
        visibility: 'PUBLIC',
    },
];
const expand = (entry: Entry, week: string): Occurrence[] => {
    const end = addDays(week, 6),
        rule = entry.recurrence;
    const dates = rule
        ? upcomingTrainingDates(
              { ...rule, endDate: rule.endDate && rule.endDate < end ? rule.endDate : end, limit: 6 },
              week,
          )
        : [entry.startsAt.slice(0, 10)];
    if (rule && dates.length === 6 && dates[5] < end)
        dates.push(
            ...upcomingTrainingDates(
                { ...rule, endDate: rule.endDate && rule.endDate < end ? rule.endDate : end, limit: 6 },
                addDays(dates[5], 1),
            ),
        );
    return dates
        .filter((day) => day >= week && day <= end)
        .map((day) => ({
            ...entry,
            key: `${entry.id}:${day}`,
            day,
            startsAt: rule ? `${day}T${rule.startTime}` : entry.startsAt,
            endsAt: rule ? `${day}T${rule.endTime}` : entry.endsAt,
        }));
};
export default function Direction() {
    const [week, setWeek] = useState(initialWeek),
        [view, setView] = useState<'board' | 'calendar' | 'agenda'>(() =>
            window.innerWidth < 768 ? 'agenda' : 'board',
        );
    const [events, setEvents] = useState(initialEvents),
        [squad, setSquad] = useState('all'),
        [type, setType] = useState('all');
    const [editor, setEditor] = useState<{ values: EventCreationFormValues; id?: number } | null>(null),
        [notice, setNotice] = useState('');
    const days = Array.from({ length: 7 }, (_, index) => addDays(week, index));
    const allOccurrences = useMemo(
        () => events.flatMap((event) => expand(event, week)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
        [events, week],
    );
    const visible = allOccurrences.filter(
        (event) =>
            (squad === 'all' || event.hostSquadId === Number(squad)) && (type === 'all' || event.eventType === type),
    );
    const plans = events.filter(
        (event) =>
            event.recurrence &&
            (squad === 'all' || event.hostSquadId === Number(squad)) &&
            expand(event, week).length > 0,
    );
    const [now] = useState(() => Date.now());
    const next = visible.find((event) => Date.parse(event.startsAt) > now) ?? visible[0];
    const openNew = (day = week, recurring = false) => {
        let candidate = dateObject(day);
        candidate.setHours(18, 0, 0, 0);
        if (candidate.getTime() <= Date.now()) {
            candidate = new Date();
            candidate.setDate(candidate.getDate() + 1);
            candidate.setHours(18, 0, 0, 0);
        }
        const date = localDateISO(candidate);
        setEditor({
            values: {
                eventType: 'TRAINING',
                title: '',
                date,
                startTime: '18:00',
                endTime: '19:30',
                isRecurring: recurring,
                locationName: '',
                locationLat: '',
                locationLng: '',
                visibility: 'PRIVATE',
                publishAt: '',
                hostSquadId: squad === 'all' ? null : Number(squad),
                recurrenceDays: [weekdays[(dateObject(date).getDay() + 6) % 7]],
                recurrenceStartDate: date,
                recurrenceEndDate: '',
                recurrenceStartTime: recurring ? '18:00' : undefined,
                recurrenceEndTime: recurring ? '19:30' : undefined,
                recurrenceInterval: 1,
                recurrenceTimezone: 'Asia/Tbilisi',
            },
        });
    };
    const openEntry = (entry: Entry) => {
        const rule = entry.recurrence;
        setEditor({
            id: entry.id,
            values: {
                eventType: entry.eventType,
                title: entry.title,
                date: entry.startsAt.slice(0, 10),
                startTime: shortTime(entry.startsAt),
                endTime: shortTime(entry.endsAt),
                isRecurring: !!rule,
                locationName: entry.locationName ?? '',
                locationLat: entry.locationLat == null ? '' : String(entry.locationLat),
                locationLng: entry.locationLng == null ? '' : String(entry.locationLng),
                visibility: entry.visibility ?? 'PRIVATE',
                publishAt: entry.publishAt ?? '',
                description: entry.description ?? '',
                hostSquadId: entry.hostSquadId ?? null,
                recurrenceDays: rule?.daysOfWeek,
                recurrenceStartDate: rule?.startDate,
                recurrenceEndDate: rule?.endDate ?? '',
                recurrenceStartTime: rule?.startTime.slice(0, 5),
                recurrenceEndTime: rule?.endTime.slice(0, 5),
                recurrenceInterval: rule?.intervalValue,
                recurrenceTimezone: rule?.timezone,
            },
        });
    };
    const save = async (payload: ScheduleEventUpsertInput) => {
        const id = editor?.id ?? Math.max(0, ...events.map((event) => event.id)) + 1;
        setEvents((current) =>
            editor?.id
                ? current.map((event) => (event.id === id ? { ...payload, id } : event))
                : [...current, { ...payload, id }],
        );
        setEditor(null);
        setType('all');
        setSquad('all');
        const first = payload.recurrence
            ? upcomingTrainingDates({ ...payload.recurrence, limit: 1 })[0]
            : payload.startsAt.slice(0, 10);
        if (first) {
            const date = dateObject(first);
            date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
            setWeek(localDateISO(date));
        }
        setNotice(
            editor?.id
                ? 'Your plan has been updated in this preview.'
                : 'Added to your club week. This preview stays in this tab.',
        );
    };
    const openToday = () => {
        const date = new Date();
        date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
        setWeek(localDateISO(date));
    };
    const renderCard = (event: Occurrence, compact = false) => {
        const meta = metadata[event.eventType],
            name = squads.find((item) => item.id === event.hostSquadId)?.name;
        return (
            <button
                type="button"
                className={`cw-event${compact ? ' compact' : ''}`}
                key={event.key}
                style={{ '--event-color': meta.color } as CSSProperties}
                onClick={() => openEntry(event)}
                aria-label={`Open ${event.title}, ${formatDay(event.day)}, ${shortTime(event.startsAt)}`}
            >
                <span className="cw-event-top">
                    <span>{meta.label}</span>
                    {event.recurrence && <Repeat2 size={13} />}
                </span>
                {name && <span className="cw-event-squad">{name}</span>}
                <strong>{event.title}</strong>
                <span className="cw-event-time">
                    <Clock3 size={13} />
                    {shortTime(event.startsAt)}
                    <span>–</span>
                    {shortTime(event.endsAt)}
                </span>
                {!compact && (
                    <span className="cw-event-place">
                        <MapPin size={13} />
                        {event.locationName || 'Location to be confirmed'}
                    </span>
                )}
            </button>
        );
    };
    const earliest = Math.min(9, ...visible.map((event) => Number(shortTime(event.startsAt).slice(0, 2))));
    const latest = Math.max(
        21,
        ...visible.map((event) =>
            Math.ceil((+shortTime(event.endsAt).slice(0, 2) * 60 + +shortTime(event.endsAt).slice(3)) / 60),
        ),
    );
    const calendarHours = Array.from({ length: latest - earliest }, (_, index) => earliest + index);
    return (
        <div className="cw-root">
            <div className="cw-preview-strip">
                <span>
                    DESIGN EXPLORATION <b>02</b>
                    <span className="cw-strip-description">A more distinctive club week</span>
                </span>
                <a href="./schedule-preview.html?lang=en">
                    <ArrowLeft size={12} />
                    Compare with first version
                </a>
            </div>
            <header className="cw-topbar">
                <img src="/brand/grasskickz-main.png" alt="GrassKickZ" />
                <span className="cw-topbar-divider" />
                <span className="cw-workspace-label">
                    Club workspace <ChevronRight size={14} />
                    Schedule
                </span>
                <div className="cw-club">
                    <span className="cw-crest">
                        <Shield size={17} />
                    </span>
                    <span>
                        {CLUB}
                        <small>Club owner</small>
                    </span>
                </div>
            </header>
            <main className="cw-main">
                <section className="cw-page-heading">
                    <div>
                        <span className="cw-eyebrow">FC DINAMO TBILISI</span>
                        <h1>
                            Club schedule<span>.</span>
                        </h1>
                        <p>Training, matchdays and the plans in between.</p>
                    </div>
                    <button className="cw-primary" onClick={() => openNew()}>
                        <Plus size={19} />
                        New event
                    </button>
                </section>
                <div className="cw-weekbar">
                    <div className="cw-week-period">
                        <span className="cw-week-number">
                            {formatDay(week, { day: 'numeric' })}
                            <span>—</span>
                            {formatDay(addDays(week, 6), { day: 'numeric' })}
                        </span>
                        <div>
                            <strong>
                                {formatDay(week, { month: 'long', year: 'numeric' })}
                                {week.slice(5, 7) !== addDays(week, 6).slice(5, 7)
                                    ? ` / ${formatDay(addDays(week, 6), { month: 'short' })}`
                                    : ''}
                            </strong>
                            <small>
                                {visible.length} {visible.length === 1 ? 'event' : 'events'} this week
                            </small>
                        </div>
                        <div className="cw-period-controls">
                            <button aria-label="Previous week" onClick={() => setWeek(addDays(week, -7))}>
                                <ChevronLeft size={18} />
                            </button>
                            <button onClick={openToday}>Today</button>
                            <button aria-label="Next week" onClick={() => setWeek(addDays(week, 7))}>
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                    <div className="cw-view-switch" role="group" aria-label="Schedule view">
                        {(
                            [
                                { value: 'board', label: 'Week board', icon: Columns3 },
                                { value: 'calendar', label: 'Calendar', icon: CalendarDays },
                                { value: 'agenda', label: 'Agenda', icon: List },
                            ] as const
                        ).map(({ value, label, icon: Icon }) => (
                            <button key={value} aria-pressed={view === value} onClick={() => setView(value)}>
                                <Icon size={15} />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="cw-filters">
                    <div className="cw-type-filters" role="group" aria-label="Filter event type">
                        <button aria-pressed={type === 'all'} onClick={() => setType('all')}>
                            All events
                        </button>
                        {Object.entries(metadata).map(([value, meta]) => (
                            <button
                                key={value}
                                aria-pressed={type === value}
                                onClick={() => setType(type === value ? 'all' : value)}
                            >
                                <i style={{ background: meta.color }} />
                                {meta.label}
                            </button>
                        ))}
                    </div>
                    <label className="cw-squad-select">
                        <Users size={15} />
                        <select
                            aria-label="Filter squad"
                            value={squad}
                            onChange={(event) => setSquad(event.target.value)}
                        >
                            <option value="all">All squads</option>
                            {squads.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.name}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <button className="cw-mobile-plans-link" onClick={() => document.getElementById('cw-training-plans')?.scrollIntoView({behavior:'smooth',block:'start'})}><Repeat2 size={15}/>Weekly training <span>{plans.length} plans</span><ArrowDown size={14}/></button>
            {notice && (
                    <div className="cw-notice" role="status">
                        <Check size={16} />
                        {notice}
                        <button aria-label="Dismiss message" onClick={() => setNotice('')}>
                            <X size={15} />
                        </button>
                    </div>
                )}
                <div className={`cw-workbench ${view === 'calendar' ? 'is-calendar' : ''}`}>
                    <section
                        className="cw-board-region"
                        aria-label={
                            view === 'board'
                                ? 'Club week board'
                                : view === 'calendar'
                                  ? 'Hourly calendar'
                                  : 'Week agenda'
                        }
                    >
                        {view === 'board' && (
                            <div className="cw-week-board">
                                {days.map((day, index) => {
                                    const dayEvents = visible.filter((event) => event.day === day);
                                    return (
                                        <section
                                            className="cw-day-column"
                                            key={day}
                                            aria-label={formatDay(day, {
                                                weekday: 'long',
                                                day: 'numeric',
                                                month: 'long',
                                            })}
                                        >
                                            <header className={day === localDateISO() ? 'is-today' : ''}>
                                                <div>
                                                    <span>{labels[index]}</span>
                                                    <strong>{formatDay(day, { day: '2-digit' })}</strong>
                                                </div>
                                                <span>
                                                    {dayEvents.length
                                                        ? `${dayEvents.length} ${dayEvents.length === 1 ? 'event' : 'events'}`
                                                        : 'Open day'}
                                                </span>
                                            </header>
                                            <div className="cw-day-events">
                                                {dayEvents.map((event) => renderCard(event))}
                                                <button
                                                    className="cw-add-slot"
                                                    aria-label={`Add event on ${formatDay(day)}`}
                                                    onClick={() => openNew(day)}
                                                >
                                                    <Plus size={15} />
                                                    <span>Add event</span>
                                                </button>
                                            </div>
                                        </section>
                                    );
                                })}
                            </div>
                        )}
                        {view === 'agenda' && (
                            <div className="cw-agenda">
                                {days.map((day, index) => {
                                    const items = visible.filter((event) => event.day === day);
                                    return (
                                        <section key={day}>
                                            <header>
                                                <span>{labels[index]}</span>
                                                <strong>{formatDay(day, { day: '2-digit' })}</strong>
                                            </header>
                                            <div>
                                                {items.length ? (
                                                    items.map((event) => renderCard(event))
                                                ) : (
                                                    <p className="cw-open-day">No events planned</p>
                                                )}
                                                <button
                                                    className="cw-add-slot"
                                                    onClick={() => openNew(day)}
                                                    aria-label={`Add event on ${formatDay(day)}`}
                                                >
                                                    <Plus size={15} />
                                                    Add event
                                                </button>
                                            </div>
                                        </section>
                                    );
                                })}
                            </div>
                        )}
                        {view === 'calendar' && (
                            <div className="cw-calendar-scroll">
                                <div className="cw-calendar">
                                    <header>
                                        <span>Time</span>
                                        {days.map((day, index) => (
                                            <div key={day}>
                                                <span>{labels[index]}</span>
                                                <strong>{formatDay(day, { day: '2-digit' })}</strong>
                                            </div>
                                        ))}
                                    </header>
                                    <div className="cw-calendar-body" style={{ height: calendarHours.length * 58 }}>
                                        <div className="cw-hours">
                                            {calendarHours.map((hour) => (
                                                <span key={hour}>{String(hour).padStart(2, '0')}:00</span>
                                            ))}
                                        </div>
                                        {days.map((day) => (
                                            <div className="cw-timeline-day" key={day}>
                                                {calendarHours.map((hour) => (
                                                    <button
                                                        className="cw-time-slot"
                                                        key={hour}
                                                        aria-label={`Add event on ${formatDay(day)} at ${hour}:00`}
                                                        onClick={() => {
                                                            openNew(day);
                                                            setEditor((current) =>
                                                                current
                                                                    ? {
                                                                          ...current,
                                                                          values: {
                                                                              ...current.values,
                                                                              startTime: `${String(hour).padStart(2, '0')}:00`,
                                                                              endTime:
                                                                                  hour === 23
                                                                                      ? '23:59'
                                                                                      : `${String(hour + 1).padStart(2, '0')}:00`,
                                                                          },
                                                                      }
                                                                    : current,
                                                            );
                                                        }}
                                                    />
                                                ))}
                                                {visible
                                                    .filter((event) => event.day === day)
                                                    .map((event) => {
                                                        const start =
                                                                +shortTime(event.startsAt).slice(0, 2) * 60 +
                                                                +shortTime(event.startsAt).slice(3),
                                                            end =
                                                                +shortTime(event.endsAt).slice(0, 2) * 60 +
                                                                +shortTime(event.endsAt).slice(3);
                                                        return (
                                                            <div
                                                                className="cw-positioned-event"
                                                                key={event.key}
                                                                style={{
                                                                    top: (start / 60 - earliest) * 58,
                                                                    height: Math.max(42, ((end - start) / 60) * 58),
                                                                }}
                                                            >
                                                                {renderCard(event, true)}
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        {visible.length === 0 && (
                            <div className="cw-no-matches">
                                <p>
                                    {type !== 'all' || squad !== 'all'
                                        ? 'No events match these filters.'
                                        : 'A clear week. Start with one event or a regular training plan.'}
                                </p>
                                {type !== 'all' || squad !== 'all' ? (
                                    <button
                                        onClick={() => {
                                            setType('all');
                                            setSquad('all');
                                        }}
                                    >
                                        Reset filters <ArrowRight size={14} />
                                    </button>
                                ) : (
                                    <button onClick={() => openNew()}>
                                        Plan an event <Plus size={14} />
                                    </button>
                                )}
                            </div>
                        )}
                        <footer className="cw-board-caption">
                            <span>
                                <i />
                                All times shown as entered
                            </span>
                            <span>Click a card to view or edit</span>
                        </footer>
                    </section>
                    <aside className="cw-rail">
                        <section className="cw-next">
                            <span className="cw-section-label">
                                {next && Date.parse(next.startsAt) > now ? 'UP NEXT' : 'FIRST IN VIEW'}
                                <ArrowDown size={13} />
                            </span>
                            {next ? (
                                <>
                                    <div className="cw-next-date">
                                        <strong>{formatDay(next.day, { day: '2-digit' })}</strong>
                                        <span>
                                            {formatDay(next.day, { weekday: 'long' })}
                                            <b>
                                                {formatDay(next.day, { month: 'short' })} · {shortTime(next.startsAt)}
                                            </b>
                                        </span>
                                    </div>
                                    <h2>{next.title}</h2>
                                    <p>
                                        <Users size={14} />
                                        {squads.find((item) => item.id === next.hostSquadId)?.name ?? 'Club event'}
                                    </p>
                                    <p>
                                        <MapPin size={14} />
                                        {next.locationName || 'Location to be confirmed'}
                                    </p>
                                    <button onClick={() => openEntry(next)}>
                                        View session <ArrowRight size={15} />
                                    </button>
                                </>
                            ) : (
                                <p className="cw-muted">Your next session will appear here.</p>
                            )}
                        </section>
                        <section className="cw-training" id="cw-training-plans">
                            <header>
                                <span className="cw-section-label">WEEKLY TRAINING</span>
                                <button aria-label="Add weekly training" onClick={() => openNew(week, true)}>
                                    <Plus size={16} />
                                </button>
                            </header>
                            <p className="cw-rail-hint">The rhythm behind your week.</p>
                            {plans.map((plan) => (
                                <button className="cw-plan" key={plan.id} onClick={() => openEntry(plan)}>
                                    <span>
                                        {squads.find((item) => item.id === plan.hostSquadId)?.name ?? 'Club training'}
                                        <ArrowRight size={14} />
                                    </span>
                                    <strong>{plan.title}</strong>
                                    <div
                                        className="cw-week-markers"
                                        aria-label={plan.recurrence!.daysOfWeek.join(', ')}
                                    >
                                        {labels.map((day, index) => (
                                            <span
                                                key={day}
                                                className={
                                                    plan.recurrence!.daysOfWeek.includes(weekdays[index])
                                                        ? 'selected'
                                                        : ''
                                                }
                                            >
                                                {day.slice(0, 1)}
                                            </span>
                                        ))}
                                    </div>
                                    <small>
                                        <Clock3 size={12} />
                                        {plan.recurrence!.startTime.slice(0, 5)} –{' '}
                                        {plan.recurrence!.endTime.slice(0, 5)}
                                    </small>
                                </button>
                            ))}
                            {!plans.length && <p className="cw-muted">No weekly training in this view.</p>}
                            <button className="cw-new-plan" onClick={() => openNew(week, true)}>
                                <Repeat2 size={15} />
                                Create training plan
                                <Plus size={15} />
                            </button>
                        </section>
                        <p className="cw-rail-note">Training plans repeat on your selected weekdays.</p>
                    </aside>
                </div>
            </main>
            {editor && (
                <EventCreationModal
                    isOpen
                    mode={editor.id ? 'edit' : 'create'}
                    surface="CLUB_SCHEDULE"
                    initialValues={editor.values}
                    clubId={1}
                    targetEventId={editor.id}
                    targetEventClubId={1}
                    subjectLabel={CLUB}
                    onClose={() => setEditor(null)}
                    onSubmit={save}
                />
            )}
        </div>
    );
}
createRoot(document.getElementById('root')!).render(<Direction />);
