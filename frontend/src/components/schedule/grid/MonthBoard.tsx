import { Plus } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import type { ScheduleWorkspaceEvent } from '../workspaceTypes';
import { DraggableMonthEvent, StaticMonthEvent } from './ScheduleEventChips';
import { eventStyle, formatDay, formatTime, isPast, monthGrid, sameDay, toDateKey } from './scheduleGridLayout';
import '../schedule-grid.css';

// The month board: a 7 x 6 grid of days. MonthBoardDnd is the edit-mode version whose upcoming events can be dragged to another day.
export const DroppableDayCell = ({
    date,
    inMonth,
    activeDay,
    children,
    canCreate,
    onSelectDate,
    onCreateAt,
}: {
    date: Date;
    inMonth: boolean;
    activeDay: boolean;
    children: React.ReactNode;
    canCreate: boolean;
    onSelectDate: (date: Date) => void;
    onCreateAt: (date: Date) => void;
}) => {
    const { setNodeRef, isOver } = useDroppable({
        id: `day-${toDateKey(date)}`,
        data: { date },
    });

    return (
        <div
            ref={setNodeRef}
            onClick={() => canCreate && onCreateAt(date)}
            className={`flex min-h-[120px] flex-col border-b border-r border-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)] px-2.5 py-2.5 last:border-r-0 ${
                inMonth ? 'schedule-board-cell' : 'schedule-board-cell--muted'
            } ${canCreate ? 'cursor-pointer' : ''}`}
            style={isOver ? { backgroundColor: 'var(--accent-primary-soft, color-mix(in srgb, var(--color-accent) 15%, transparent))', outline: '2px solid var(--accent-primary, var(--color-accent))', outlineOffset: -2 } : undefined}
        >
            <div className="mb-2 flex items-center justify-between gap-2">
                <button
                    type="button"
                    aria-label={`Select ${formatDay(date)}`}
                    onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onSelectDate(date);
                    }}
                    className={`schedule-interactive schedule-tone-blue inline-flex h-7 w-7 items-center justify-center rounded-[4px] text-[11px] font-semibold ${
                        activeDay ? 'bg-elevated text-current' : 'text-[var(--color-secondary)]'
                    }`}
                    data-active={activeDay}
                >
                    {date.getDate()}
                </button>

                {canCreate ? (
                    <button
                        type="button"
                        aria-label={`Create event on ${formatDay(date)}`}
                        onClick={(clickEvent) => {
                            clickEvent.stopPropagation();
                            onCreateAt(date);
                        }}
                        className="schedule-interactive schedule-tone-green inline-flex h-7 w-7 items-center justify-center rounded-[4px] text-[var(--color-secondary)]"
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </button>
                ) : null}
            </div>

            {children}
        </div>
    );
};

export const MonthBoard = ({
    cursorDate,
    monthEvents,
    onSelectDate,
    onEditEvent,
    onOpenPastEvent,
    canCreate,
    onCreateAt
}: {
    cursorDate: Date;
    monthEvents: Record<string, ScheduleWorkspaceEvent[]>;
    onSelectDate: (date: Date) => void;
    onEditEvent: (event: ScheduleWorkspaceEvent) => void;
    onOpenPastEvent: (event: ScheduleWorkspaceEvent) => void;
    canCreate: boolean;
    onCreateAt: (date: Date) => void;
}) => (
    <div className="schedule-scroll-surface h-full overflow-auto bg-[color:var(--schedule-board-cell)]">
        <div className="schedule-board-head sticky top-0 z-10 grid min-w-[840px] grid-cols-7 border-b border-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)]">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((label) => (
                <div key={label} className="border-r border-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)] px-3 py-2 text-[10px] font-semibold text-[var(--color-secondary)] last:border-r-0">
                    {label}
                </div>
            ))}
        </div>

        <div className="grid min-w-[840px] grid-cols-7">
            {monthGrid(cursorDate).map(({ date, inMonth }) => {
                const dayEvents = monthEvents[toDateKey(date)] ?? [];
                const activeDay = sameDay(date, cursorDate);

                return (
                    <div
                        key={toDateKey(date)}
                        onClick={() => canCreate && onCreateAt(date)}
                        className={`flex min-h-[120px] flex-col border-b border-r border-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)] px-2.5 py-2.5 last:border-r-0 ${
                            inMonth ? 'schedule-board-cell' : 'schedule-board-cell--muted'
                        } ${canCreate ? 'cursor-pointer' : ''}`}
                    >
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <button
                                type="button"
                                aria-label={`Select ${formatDay(date)}`}
                                onClick={(clickEvent) => {
                                    clickEvent.stopPropagation();
                                    onSelectDate(date);
                                }}
                                className={`schedule-interactive schedule-tone-blue inline-flex h-7 w-7 items-center justify-center rounded-[4px] text-[11px] font-semibold ${
                                    activeDay ? 'bg-elevated text-current' : 'text-[var(--color-secondary)]'
                                }`}
                                data-active={activeDay}
                            >
                                {date.getDate()}
                            </button>

                            {canCreate ? (
                                <button
                                    type="button"
                                    aria-label={`Create event on ${formatDay(date)}`}
                                    onClick={(clickEvent) => {
                                        clickEvent.stopPropagation();
                                        onCreateAt(date);
                                    }}
                                    className="schedule-interactive schedule-tone-green inline-flex h-7 w-7 items-center justify-center rounded-[4px] text-[var(--color-secondary)]"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                </button>
                            ) : null}
                        </div>

                        <div className="flex flex-col gap-1">
                            {dayEvents.slice(0, 4).map((event) => (
                                <button
                                    key={event.id}
                                    type="button"
                                    onClick={(clickEvent) => {
                                        clickEvent.stopPropagation();
                                        (isPast(event.startsAt) ? onOpenPastEvent : onEditEvent)(event);
                                    }}
                                    className="rounded-[4px] border px-2 py-1.5 text-left transition-transform duration-150 hover:-translate-y-px hover:shadow-[0_8px_18px_color-mix(in_srgb,_var(--color-shadow)_18%,_transparent)]"
                                    style={eventStyle(event, false)}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="truncate text-[10px] font-semibold text-[var(--color-text)]">{event.title}</span>
                                        <span className="shrink-0 text-[10px] font-semibold text-[var(--color-secondary)]">{formatTime(event.startsAt)}</span>
                                    </div>
                                </button>
                            ))}
                            {dayEvents.length > 4 ? (
                                <div className="text-[10px] font-semibold text-[var(--color-secondary)]">+{dayEvents.length - 4} more</div>
                            ) : null}
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
);

export const MonthBoardDnd = ({
    cursorDate,
    monthEvents,
    onSelectDate,
    canCreate,
    onCreateAt,
    onOpenPastEvent,
    onEditEvent,
}: {
    cursorDate: Date;
    monthEvents: Record<string, ScheduleWorkspaceEvent[]>;
    onSelectDate: (date: Date) => void;
    canCreate: boolean;
    onCreateAt: (date: Date) => void;
    onOpenPastEvent: (event: ScheduleWorkspaceEvent) => void;
    onEditEvent: (event: ScheduleWorkspaceEvent) => void;
}) => (
    <div className="schedule-scroll-surface h-full overflow-auto bg-[color:var(--schedule-board-cell)]">
        <div className="schedule-board-head sticky top-0 z-10 grid min-w-[840px] grid-cols-7 border-b border-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)]">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((label) => (
                <div key={label} className="border-r border-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)] px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--fc-accent)] last:border-r-0">
                    {label}
                </div>
            ))}
        </div>

        <div className="grid min-w-[840px] grid-cols-7">
            {monthGrid(cursorDate).map(({ date, inMonth }) => {
                const dayEvents = monthEvents[toDateKey(date)] ?? [];
                const activeDay = sameDay(date, cursorDate);

                return (
                    <DroppableDayCell
                        key={toDateKey(date)}
                        date={date}
                        inMonth={inMonth}
                        activeDay={activeDay}
                        canCreate={canCreate}
                        onSelectDate={onSelectDate}
                        onCreateAt={onCreateAt}
                    >
                        <div className="flex flex-col gap-1">
                            {dayEvents.map((event) => (
                                isPast(event.startsAt) ? (
                                    <StaticMonthEvent key={event.id} event={event} onOpenPastEvent={onOpenPastEvent} />
                                ) : (
                                    <DraggableMonthEvent
                                        key={event.id}
                                        event={event}
                                        selected={false}
                                        onEdit={onEditEvent}
                                    />
                                )
                            ))}
                        </div>
                    </DroppableDayCell>
                );
            })}
        </div>
    </div>
);
