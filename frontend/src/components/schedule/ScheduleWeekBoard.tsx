import { memo, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowDown, ArrowRight, Clock3, MapPin, Plus, Repeat2, TriangleAlert, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DayOfWeek } from '../../features/schedule/api';
import { formatDate, formatTime } from '../../utils/formatting';
import { eventTypeCopy, type ScheduleWorkspaceEvent } from './workspaceTypes';
import './schedule-week-board.css';
import { ScheduleScore } from '../../features/matchHistory/ScheduleResult';

export type ScheduleBoardView = 'board' | 'agenda' | 'calendar';

export interface ScheduleWeekBoardProps {
    days: Date[];
    events: ScheduleWorkspaceEvent[];
    trainingEvents?: ScheduleWorkspaceEvent[];
    view: ScheduleBoardView;
    calendarContent?: ReactNode;
    canCreate?: boolean;
    onCreate?: (day: Date) => void;
    onCreateTraining?: () => void;
    onSelect: (event: ScheduleWorkspaceEvent) => void;
    squadNamesById?: Readonly<Record<number, string>>;
    hasActiveFilters?: boolean;
    onResetFilters?: () => void;
    showTraining?: boolean;
    hideInspector?: boolean;
}

const WEEKDAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const DAY_FALLBACKS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const localDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const sameDay = (first: Date, second: Date) => localDay(first).getTime() === localDay(second).getTime();
const validEvent = (event: ScheduleWorkspaceEvent) =>
    Number.isFinite(Date.parse(event.startsAt)) && Number.isFinite(Date.parse(event.endsAt));
const cancelled = (event: ScheduleWorkspaceEvent) => event.status.toUpperCase() === 'CANCELLED';
const overlapsDay = (event: ScheduleWorkspaceEvent, day: Date) => {
    const start = localDay(day);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return new Date(event.startsAt) < end && new Date(event.endsAt) > start;
};

const timeRange = (event: ScheduleWorkspaceEvent) => {
    if (sameDay(new Date(event.startsAt), new Date(event.endsAt)))
        return `${formatTime(event.startsAt)} – ${formatTime(event.endsAt)}`;
    return `${formatDate(event.startsAt, { day: 'numeric', month: 'short' })}, ${formatTime(event.startsAt)} – ${formatDate(event.endsAt, { day: 'numeric', month: 'short' })}, ${formatTime(event.endsAt)}`;
};

const ScheduleBoardEvent = memo(function ScheduleBoardEvent({
    event,
    squad,
    onSelect,
    labels,
}: {
    event: ScheduleWorkspaceEvent;
    squad?: string | null;
    onSelect: (event: ScheduleWorkspaceEvent) => void;
    labels: { types: Record<string, string>; recurring: string; cancelled: string; overlap: string };
}) {
    const { t } = useTranslation();
    const meta = eventTypeCopy[event.eventType];
    return (
        <button
            type="button"
            key={event.id}
            className={`swb-event${cancelled(event) ? ' is-cancelled' : ''}`}
            style={
                {
                    '--swb-event-color': event.eventType === 'ACTIVITY' ? 'var(--swb-muted)' : meta.accent,
                } as CSSProperties
            }
            onClick={() => onSelect(event)}
        >
            <span className="swb-event-top">
                <span>{labels.types[event.eventType]}</span>
                {event.recurring && <Repeat2 size={13} aria-label={labels.recurring} />}
            </span>
            {squad && <span className="swb-event-squad">{squad}</span>}
            <strong>{event.title}</strong>
            {event.subtitle && <span className="swb-event-squad">{event.subtitle}</span>}
            <ScheduleScore event={event} />
            <span className="swb-event-time">
                <Clock3 size={12} aria-hidden="true" />
                {timeRange(event)}
            </span>
            {event.locationText && (
                <span className="swb-event-place">
                    <MapPin size={12} aria-hidden="true" />
                    <span>{event.locationText}</span>
                </span>
            )}
            {cancelled(event) && <span className="swb-event-status">{labels.cancelled}</span>}
            {!cancelled(event) && event.responseSummary && event.responseSummary.total > 0 && <span className="swb-event-response">
                <Users size={13} aria-hidden="true"/>{t('schedule.direction.availabilityCount', { defaultValue: '{{going}}/{{total}} going', ...event.responseSummary })}
                {event.responseSummary.pending > 0 && <small>{t('schedule.direction.pendingReplies', { defaultValue: '{{count}} awaiting reply', count: event.responseSummary.pending })}</small>}
            </span>}
            {event.conflict && (
                <span className="swb-event-conflict">
                    <TriangleAlert size={12} aria-hidden="true" />
                    {labels.overlap}
                </span>
            )}
        </button>
    );
});

/** Render actual API occurrences. Recurrence rules describe plans; they never synthesize calendar events here. */
export const ScheduleWeekBoard = ({
    days,
    events,
    trainingEvents = events,
    view,
    calendarContent,
    canCreate = false,
    onCreate,
    onCreateTraining,
    onSelect,
    squadNamesById,
    hasActiveFilters = false,
    onResetFilters,
    showTraining = true,
    hideInspector = false,
}: ScheduleWeekBoardProps) => {
    const { t, i18n } = useTranslation();
    const labels = useMemo(
        () => ({
            types: Object.fromEntries(
                Object.entries(eventTypeCopy).map(([type, meta]) => [
                    type,
                    t(`schedule.event.${type.toLowerCase()}`, { defaultValue: meta.label }),
                ]),
            ),
            recurring: t('schedule.direction.recurring', { defaultValue: 'Repeating event' }),
            cancelled: t('schedule.direction.cancelled', { defaultValue: 'Cancelled' }),
            overlap: t('schedule.direction.overlap', { defaultValue: 'Schedule overlap' }),
            language: i18n.resolvedLanguage,
        }),
        [t, i18n.resolvedLanguage],
    );
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 60_000);
        return () => window.clearInterval(timer);
    }, []);
    const trainingRef = useRef<HTMLElement>(null);
    const trainingId = useId();
    const visible = useMemo(
        () => events.filter(validEvent).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
        [events],
    );
    const groupedDays = useMemo(
        () =>
            days.map((day) => ({
                day,
                events: visible.filter((event) => overlapsDay(event, day)),
            })),
        [days, visible],
    );
    const plans = useMemo(() => {
        const series = new Map<string | number, ScheduleWorkspaceEvent>();
        for (const event of trainingEvents) {
            if (!validEvent(event) || cancelled(event) || !event.recurring || event.eventType !== 'TRAINING') continue;
            const seriesKey = event.seriesId ?? event.eventId;
            const existing = series.get(seriesKey);
            const start = Date.parse(event.startsAt);
            const previous = existing ? Date.parse(existing.startsAt) : NaN;
            // Open the next real occurrence, or the latest past one when browsing history.
            if (
                !existing ||
                (start >= now && (previous < now || start < previous)) ||
                (start < now && previous < now && start > previous)
            ) {
                series.set(seriesKey, event);
            }
        }
        return [...series.values()].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    }, [now, trainingEvents]);
    const available = visible.filter((event) => !cancelled(event));
    const next = available.find((event) => Date.parse(event.endsAt) > now) ?? available[0];
    const nextIsFuture = next && Date.parse(next.startsAt) > now;
    const nextIsCurrent = next && Date.parse(next.startsAt) <= now && Date.parse(next.endsAt) > now;
    const dayLabel = (day: Date, long = false) => {
        const index = (day.getDay() + 6) % 7;
        return t(`schedule.editor.weekdays.${WEEKDAYS[index]}.${long ? 'long' : 'short'}`, {
            defaultValue: DAY_FALLBACKS[index],
        });
    };
    const squadName = (event: ScheduleWorkspaceEvent) =>
        (event.hostSquadId != null ? squadNamesById?.[event.hostSquadId] : undefined) || event.hostSquadName;
    const countLabel = (count: number) =>
        t('schedule.direction.eventCount', { count, defaultValue: `${count} ${count === 1 ? 'event' : 'events'}` });
    const renderAdd = (day: Date) =>
        canCreate && onCreate && localDay(day).getTime() >= localDay(new Date(now)).getTime() ? (
            <button
                type="button"
                className="swb-add-slot"
                onClick={() => onCreate(new Date(day))}
                aria-label={t('schedule.direction.addOn', {
                    date: `${dayLabel(day, true)}, ${formatDate(day)}`,
                    defaultValue: 'Add event on {{date}}',
                })}
            >
                <Plus size={15} aria-hidden="true" />
                <span>{t('schedule.direction.addEvent', { defaultValue: 'Add event' })}</span>
            </button>
        ) : null;
    return (
        <div className="swb-root">
            {showTraining && (plans.length > 0 || (canCreate && onCreateTraining)) && (
                <button
                    type="button"
                    className="swb-mobile-plans"
                    aria-controls={trainingId}
                    onClick={() => {
                        trainingRef.current?.scrollIntoView({
                            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                            block: 'start',
                        });
                        trainingRef.current?.focus({ preventScroll: true });
                    }}
                >
                    <Repeat2 size={15} aria-hidden="true" />
                    {t('schedule.direction.weeklyTraining', { defaultValue: 'Weekly training' })}
                    <span>
                        {t('schedule.direction.planCount', { count: plans.length, defaultValue: '{{count}} plans' })}
                    </span>
                    <ArrowDown size={14} aria-hidden="true" />
                </button>
            )}
            <div className={`swb-workbench swb-view-${view}${hideInspector || (!next && !plans.length) ? ' swb-without-rail' : ''}`}>
                <section
                    className="swb-board-region"
                    aria-label={t(`schedule.direction.${view}`, {
                        defaultValue: view === 'board' ? 'Week board' : view === 'agenda' ? 'Agenda' : 'Calendar',
                    })}
                >
                    {view === 'calendar' && <div className="swb-calendar-content">{calendarContent}</div>}
                    <div hidden={view === 'calendar'}>
                        <div className={view === 'board' ? 'swb-week-board' : 'swb-agenda'}>
                            {groupedDays.map(({ day, events: dayEvents }) => {
                                return (
                                    <section
                                        className="swb-day-column"
                                        key={localDay(day).getTime()}
                                        aria-label={`${dayLabel(day, true)}, ${formatDate(day)}`}
                                    >
                                        <header className={sameDay(day, new Date(now)) ? 'is-today' : undefined}>
                                            <div>
                                                <span>{dayLabel(day)}</span>
                                                <strong>{String(day.getDate()).padStart(2, '0')}</strong>
                                            </div>
                                            {view === 'board' && (
                                                <span>
                                                    {dayEvents.length
                                                        ? countLabel(dayEvents.length)
                                                        : t('schedule.direction.openDay', { defaultValue: 'Open day' })}
                                                </span>
                                            )}
                                        </header>
                                        <div className="swb-day-events">
                                            {dayEvents.map((event) => (
                                                <ScheduleBoardEvent
                                                    key={event.id}
                                                    event={event}
                                                    squad={squadName(event)}
                                                    labels={labels}
                                                    onSelect={onSelect}
                                                />
                                            ))}
                                            {view === 'agenda' && dayEvents.length === 0 && (
                                                <p className="swb-open-day">
                                                    {t('schedule.direction.noDayEvents', {
                                                        defaultValue: 'No events planned',
                                                    })}
                                                </p>
                                            )}
                                            {renderAdd(day)}
                                        </div>
                                    </section>
                                );
                            })}
                        </div>
                    </div>
                    {visible.length === 0 && view !== 'calendar' && (
                        <div className="swb-no-matches">
                            <p>
                                {hasActiveFilters
                                    ? t('schedule.direction.noMatches', {
                                          defaultValue: 'No events match these filters.',
                                      })
                                    : t('schedule.direction.clearWeek', {
                                          defaultValue:
                                              'A clear week. Start with one event or a regular training plan.',
                                      })}
                            </p>
                            {hasActiveFilters && onResetFilters ? (
                                <button type="button" onClick={onResetFilters}>
                                    {t('schedule.direction.resetFilters', { defaultValue: 'Reset filters' })}
                                    <ArrowRight size={14} aria-hidden="true" />
                                </button>
                            ) : (
                                canCreate &&
                                onCreate && (
                                    <button type="button" onClick={() => onCreate(new Date())}>
                                        {t('schedule.direction.planEvent', { defaultValue: 'Plan an event' })}
                                        <Plus size={14} aria-hidden="true" />
                                    </button>
                                )
                            )}
                        </div>
                    )}
                    <footer className="swb-board-caption">
                        <span>
                            <i aria-hidden="true" />
                            {t('schedule.direction.timezone', { defaultValue: 'Times shown in {{timezone}}', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
                        </span>
                        <span>{t('schedule.direction.openCard', { defaultValue: 'Select a card for details' })}</span>
                    </footer>
                </section>
                {!hideInspector && (next || plans.length > 0) && <aside className={`swb-rail${showTraining ? '' : ' without-training'}`}>
                    <section className="swb-next">
                        <span className="swb-section-label">
                            {nextIsFuture
                                ? t('schedule.direction.upNext', { defaultValue: 'Up next' })
                                : nextIsCurrent
                                  ? t('schedule.direction.happeningNow', { defaultValue: 'Happening now' })
                                  : t('schedule.direction.firstInView', { defaultValue: 'First in view' })}
                            <ArrowDown size={13} aria-hidden="true" />
                        </span>
                        {next ? (
                            <>
                                <div className="swb-next-date">
                                    <strong>{String(new Date(next.startsAt).getDate()).padStart(2, '0')}</strong>
                                    <span>
                                        {dayLabel(new Date(next.startsAt), true)}
                                        <b>
                                            {formatDate(next.startsAt, { month: 'short' })} ·{' '}
                                            {formatTime(next.startsAt)}
                                        </b>
                                    </span>
                                </div>
                                <h2>{next.title}</h2>
                                {(squadName(next) || next.ownerLabel) && (
                                    <p>
                                        <Users size={14} aria-hidden="true" />
                                        <span>{squadName(next) || next.ownerLabel}</span>
                                    </p>
                                )}
                                <p>
                                    <MapPin size={14} aria-hidden="true" />
                                    <span>
                                        {next.locationText ||
                                            t('schedule.direction.locationPending', {
                                                defaultValue: 'Location to be confirmed',
                                            })}
                                    </span>
                                </p>
                                <button type="button" onClick={() => onSelect(next)}>
                                    {t('schedule.direction.viewEvent', { defaultValue: 'View event' })}
                                    <ArrowRight size={15} aria-hidden="true" />
                                </button>
                            </>
                        ) : (
                            <p className="swb-muted">
                                {t('schedule.direction.nextEmpty', {
                                    defaultValue: 'Your next event will appear here.',
                                })}
                            </p>
                        )}
                    </section>
                    {showTraining && (
                        <section
                            className="swb-training"
                            ref={trainingRef}
                            id={trainingId}
                            tabIndex={-1}
                            data-tutorial="calendar-standing-schedule"
                        >
                            <header>
                                <h2 className="swb-section-label">
                                    {t('schedule.direction.weeklyTraining', { defaultValue: 'Weekly training' })}
                                </h2>
                                {canCreate && onCreateTraining && (
                                    <button
                                        type="button"
                                        onClick={onCreateTraining}
                                        aria-label={t('schedule.direction.addTraining', {
                                            defaultValue: 'Add weekly training',
                                        })}
                                    >
                                        <Plus size={16} aria-hidden="true" />
                                    </button>
                                )}
                            </header>
                            <p className="swb-rail-hint">
                                {t('schedule.direction.rhythm', { defaultValue: 'The rhythm behind your week.' })}
                            </p>
                            {plans.map((plan) => {
                                const recurrence = plan.recurrence;
                                return (
                                    <button
                                        type="button"
                                        className="swb-plan"
                                        key={plan.eventId}
                                        onClick={() => onSelect(plan)}
                                    >
                                        <span>
                                            {squadName(plan) ||
                                                plan.ownerLabel ||
                                                t('schedule.direction.clubTraining', { defaultValue: 'Club training' })}
                                            <ArrowRight size={14} aria-hidden="true" />
                                        </span>
                                        <strong>{plan.title}</strong>
                                        {recurrence && (
                                            <>
                                                <span
                                                    className="swb-week-markers"
                                                    aria-label={WEEKDAYS.filter((day) =>
                                                        recurrence.daysOfWeek.includes(day),
                                                    )
                                                        .map((day) =>
                                                            t(`schedule.editor.weekdays.${day}.long`, {
                                                                defaultValue: DAY_FALLBACKS[WEEKDAYS.indexOf(day)],
                                                            }),
                                                        )
                                                        .join(', ')}
                                                >
                                                    {WEEKDAYS.map((day, index) => (
                                                        <span
                                                            key={day}
                                                            className={
                                                                recurrence.daysOfWeek.includes(day)
                                                                    ? 'selected'
                                                                    : undefined
                                                            }
                                                        >
                                                            {t(`schedule.editor.weekdays.${day}.short`, {
                                                                defaultValue: DAY_FALLBACKS[index],
                                                            })}
                                                        </span>
                                                    ))}
                                                </span>
                                                <small title={recurrence.timezone ?? undefined}>
                                                    <Clock3 size={12} aria-hidden="true" />
                                                    {recurrence.startTime.slice(0, 5)} –{' '}
                                                    {recurrence.endTime.slice(0, 5)}
                                                </small>
                                                {recurrence.intervalValue > 1 && (
                                                    <small>
                                                        <Repeat2 size={12} aria-hidden="true" />
                                                        {t('schedule.direction.everyWeeks', {
                                                            count: recurrence.intervalValue,
                                                            defaultValue: 'Every {{count}} weeks',
                                                        })}
                                                    </small>
                                                )}
                                            </>
                                        )}
                                        {plan.locationText && (
                                            <small>
                                                <MapPin size={12} aria-hidden="true" />
                                                {plan.locationText}
                                            </small>
                                        )}
                                    </button>
                                );
                            })}
                            {plans.length === 0 && (
                                <p className="swb-muted">
                                    {t('schedule.direction.noPlans', {
                                        defaultValue: 'No weekly training in this view.',
                                    })}
                                </p>
                            )}
                            {canCreate && onCreateTraining && (
                                <button type="button" className="swb-new-plan" onClick={onCreateTraining}>
                                    <Plus size={15} aria-hidden="true" />
                                    {t('schedule.direction.createPlan', { defaultValue: 'Create a training plan' })}
                                    <ArrowRight size={14} aria-hidden="true" />
                                </button>
                            )}
                        </section>
                    )}
                </aside>}
            </div>
        </div>
    );
};
