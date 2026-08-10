import { type CSSProperties, type MouseEvent as ReactMouseEvent, useState } from 'react';
import { CalendarDays, PencilLine, Plus, TriangleAlert } from 'lucide-react';
import { eventTypeCopy, type ScheduleWorkspaceEvent, type WorkspaceView } from './workspaceTypes';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
    useDraggable,
    useDroppable,
    type DragStartEvent,
    type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

const SLOT_HEIGHT = 40;
const TIMELINE_GUTTER_WIDTH = 64;
const HOURS = Array.from({ length: 24 }, (_, index) => index);

const pad = (value: number) => String(value).padStart(2, '0');
const toDateKey = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
const parseDate = (value: string) => new Date(value.includes('T') ? value : `${value}T00:00:00`);
const sameDay = (left: Date, right: Date) => toDateKey(left) === toDateKey(right);
const timelineDayMinWidth = (dayCount: number) => {
    if (dayCount === 1) return 520;
    if (dayCount >= 7) return 136;
    if (dayCount >= 5) return 150;
    return 176;
};

const monthGrid = (cursorDate: Date) => {
    const firstDay = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1);
    const start = new Date(firstDay);
    const offset = (firstDay.getDay() + 6) % 7;
    start.setDate(firstDay.getDate() - offset);

    return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        return { date, inMonth: date.getMonth() === cursorDate.getMonth() };
    });
};

const formatTime = (value: string) =>
    parseDate(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const eventStyle = (event: ScheduleWorkspaceEvent, selected: boolean): CSSProperties => {
    const tone = event.conflict
        ? { accent: 'var(--state-danger)', soft: 'var(--state-danger-soft)' }
        : { accent: eventTypeCopy[event.eventType].accent, soft: eventTypeCopy[event.eventType].soft };

    return {
        borderColor: tone.accent,
        backgroundColor: tone.soft,
        boxShadow: selected ? `inset 0 0 0 1px ${tone.accent}` : undefined
    };
};

const eventTimelinePosition = (event: ScheduleWorkspaceEvent) => {
    const start = parseDate(event.startsAt);
    const end = parseDate(event.endsAt);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const top = (startMinutes / 60) * SLOT_HEIGHT;
    const height = Math.max(((endMinutes - startMinutes) / 60) * SLOT_HEIGHT, SLOT_HEIGHT * 0.8);
    return { top, height };
};

const resolveSlotDate = (day: Date, hour: number, event: ReactMouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offset = event.clientY - rect.top;
    const minutes = offset >= rect.height / 2 ? 30 : 0;
    const next = new Date(day);
    next.setHours(hour, minutes, 0, 0);
    return next;
};

// --- Drag computation helpers ---

const computeMonthDropTimes = (
    event: ScheduleWorkspaceEvent,
    targetDateKey: string
): { newStartsAt: string; newEndsAt: string } => {
    const origStart = parseDate(event.startsAt);
    const origEnd = parseDate(event.endsAt);
    const durationMs = origEnd.getTime() - origStart.getTime();

    const [y, m, d] = targetDateKey.split('-').map(Number);
    const newStart = new Date(y, m - 1, d, origStart.getHours(), origStart.getMinutes(), 0, 0);
    const newEnd = new Date(newStart.getTime() + durationMs);

    const toIso = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:00`;
    return { newStartsAt: toIso(newStart), newEndsAt: toIso(newEnd) };
};

const computeTimelineDropTimes = (
    event: ScheduleWorkspaceEvent,
    targetDateKey: string,
    pointerY: number,
    overRect: DOMRect
): { newStartsAt: string; newEndsAt: string } => {
    const origStart = parseDate(event.startsAt);
    const origEnd = parseDate(event.endsAt);
    const durationMs = origEnd.getTime() - origStart.getTime();

    const relativeY = pointerY - overRect.top;
    const fractionOfDay = relativeY / overRect.height;
    const totalMinutes = Math.round(fractionOfDay * 24 * 60 / 15) * 15;
    const clampedMinutes = Math.max(0, Math.min(totalMinutes, 1439));

    const [y, m, d] = targetDateKey.split('-').map(Number);
    const newStart = new Date(y, m - 1, d, 0, 0, 0, 0);
    newStart.setMinutes(clampedMinutes);
    const newEnd = new Date(newStart.getTime() + durationMs);

    const toIso = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:00`;
    return { newStartsAt: toIso(newStart), newEndsAt: toIso(newEnd) };
};

// --- DnD sub-components for month view ---

const DraggableMonthEvent = ({
    event,
    selected,
    onEdit,
}: {
    event: ScheduleWorkspaceEvent;
    selected: boolean;
    onEdit: (event: ScheduleWorkspaceEvent) => void;
}) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: event.id,
        data: event,
    });

    const style: CSSProperties = {
        ...eventStyle(event, selected),
        ...(transform ? { transform: CSS.Translate.toString(transform) } : {}),
        opacity: isDragging ? 0.4 : 1,
        cursor: 'grab',
        zIndex: isDragging ? 999 : 1,
        position: 'relative',
    };

    return (
        <button
            ref={setNodeRef}
            type="button"
            {...listeners}
            {...attributes}
            className="rounded-[4px] border px-2 py-1.5 text-left"
            style={style}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[10px] font-semibold text-[#f4f4f5]">{event.title}</span>
                <span className="shrink-0 text-[10px] font-semibold text-[#a1a1aa]">{formatTime(event.startsAt)}</span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.18em] text-[var(--fc-accent)]">
                <PencilLine className="h-2.5 w-2.5" />
                Drag to move
            </div>
        </button>
    );
};

const DroppableDayCell = ({
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
            className={`flex min-h-[120px] flex-col border-b border-r border-[#ffffff0d] px-2.5 py-2.5 last:border-r-0 ${
                inMonth ? 'schedule-board-cell' : 'schedule-board-cell--muted'
            } ${canCreate ? 'cursor-pointer' : ''}`}
            style={isOver ? { backgroundColor: 'var(--accent-primary-soft, rgba(34,197,94,0.15))', outline: '2px solid var(--accent-primary, #22c55e)', outlineOffset: -2 } : undefined}
        >
            <div className="mb-2 flex items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onSelectDate(date);
                    }}
                    className={`schedule-interactive schedule-tone-blue inline-flex h-7 w-7 items-center justify-center rounded-[4px] text-[11px] font-semibold ${
                        activeDay ? 'bg-elevated text-current' : 'text-[#a1a1aa]'
                    }`}
                    data-active={activeDay}
                >
                    {date.getDate()}
                </button>

                {canCreate ? (
                    <button
                        type="button"
                        onClick={(clickEvent) => {
                            clickEvent.stopPropagation();
                            onCreateAt(date);
                        }}
                        className="schedule-interactive schedule-tone-green inline-flex h-7 w-7 items-center justify-center rounded-[4px] text-[#a1a1aa]"
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </button>
                ) : null}
            </div>

            {children}
        </div>
    );
};

// --- DnD sub-components for timeline view ---

const DraggableTimelineEvent = ({
    event,
    selected,
    onEdit,
}: {
    event: ScheduleWorkspaceEvent;
    selected: boolean;
    onEdit: (event: ScheduleWorkspaceEvent) => void;
}) => {
    const position = eventTimelinePosition(event);
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: event.id,
        data: event,
    });

    const style: CSSProperties = {
        ...eventStyle(event, selected),
        top: position.top + 2,
        height: position.height - 4,
        ...(transform ? { transform: CSS.Translate.toString(transform) } : {}),
        opacity: isDragging ? 0.4 : 1,
        cursor: 'grab',
        zIndex: isDragging ? 999 : 10,
    };

    return (
        <button
            ref={setNodeRef}
            type="button"
            {...listeners}
            {...attributes}
            className="absolute left-1.5 right-1.5 rounded-[4px] border px-2 py-1.5 text-left"
            style={style}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f4f4f5]">{event.title}</p>
                    <p className="mt-1 truncate text-[10px] font-semibold text-[#a1a1aa]">
                        {formatTime(event.startsAt)} - {formatTime(event.endsAt)}
                    </p>
                </div>
                {event.conflict ? <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-[color:var(--state-danger)]" /> : null}
                <PencilLine className="h-3 w-3 shrink-0 text-[var(--fc-accent)]" />
            </div>
        </button>
    );
};

const DroppableDayColumn = ({
    day,
    children,
}: {
    day: Date;
    children: React.ReactNode;
}) => {
    const { setNodeRef, isOver } = useDroppable({
        id: `timeline-${toDateKey(day)}`,
        data: { day },
    });

    return (
        <div
            ref={setNodeRef}
            className="relative border-r border-[#ffffff0d] last:border-r-0"
            style={isOver ? { backgroundColor: 'var(--accent-primary-soft, rgba(34,197,94,0.15))', outline: '2px solid var(--accent-primary, #22c55e)', outlineOffset: -2 } : undefined}
        >
            {children}
        </div>
    );
};

// --- Drag overlay ghost ---

const DragGhost = ({ event }: { event: ScheduleWorkspaceEvent }) => (
    <div
        className="rounded-[4px] border-2 border-[var(--fc-accent)] px-2 py-1.5 opacity-90 shadow-2xl"
        style={{ ...eventStyle(event, false), minWidth: 120 }}
    >
        <span className="text-[10px] font-black uppercase">{event.title}</span>
    </div>
);

// --- Main props ---

interface ScheduleGridProps {
    viewMode: WorkspaceView;
    cursorDate: Date;
    monthEvents: Record<string, ScheduleWorkspaceEvent[]>;
    days: Date[];
    events: ScheduleWorkspaceEvent[];
    onSelectDate: (date: Date) => void;
    onEditEvent: (event: ScheduleWorkspaceEvent) => void;
    canCreate: boolean;
    onCreateAt: (date: Date) => void;
    editMode: boolean;
    onEventDragEnd: (eventId: number, newStartsAt: string, newEndsAt: string) => void;
}

export const ScheduleGrid = ({
    viewMode,
    cursorDate,
    monthEvents,
    days,
    events,
    onSelectDate,
    onEditEvent,
    canCreate,
    onCreateAt,
    editMode,
    onEventDragEnd,
}: ScheduleGridProps) => {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        })
    );

    const [activeDragEvent, setActiveDragEvent] = useState<ScheduleWorkspaceEvent | null>(null);
    const [dragPointerY, setDragPointerY] = useState(0);

    const handleDragStart = (evt: DragStartEvent) => {
        const dragged = events.find((e) => e.id === evt.active.id);
        setActiveDragEvent(dragged ?? null);
        if (evt.activatorEvent && 'clientY' in evt.activatorEvent) {
            setDragPointerY((evt.activatorEvent as PointerEvent).clientY);
        }
    };

    const handleDragEnd = (evt: DragEndEvent) => {
        setActiveDragEvent(null);
        const { active, over } = evt;
        if (!over) return;

        const draggedEvent = events.find((e) => e.id === active.id);
        if (!draggedEvent) return;

        const overId = over.id as string;
        let newStartsAt: string;
        let newEndsAt: string;

        if (viewMode === 'month') {
            // Month view: extract date from "day-YYYY-MM-DD"
            const dateKey = overId.startsWith('day-') ? overId.slice(4) : overId;
            const times = computeMonthDropTimes(draggedEvent, dateKey);
            newStartsAt = times.newStartsAt;
            newEndsAt = times.newEndsAt;
        } else {
            // Timeline view: extract date from "timeline-YYYY-MM-DD", compute time from pointer position
            const dateKey = overId.startsWith('timeline-') ? overId.slice(9) : overId;
            const pointerY = evt.activatorEvent && 'clientY' in evt.activatorEvent
                ? (evt.activatorEvent as PointerEvent).clientY
                : dragPointerY;
            const times = computeTimelineDropTimes(draggedEvent, dateKey, pointerY, over.rect as DOMRect);
            newStartsAt = times.newStartsAt;
            newEndsAt = times.newEndsAt;
        }

        onEventDragEnd(draggedEvent.eventId, newStartsAt, newEndsAt);
    };

    if (events.length === 0) {
        return (
            <div className="flex h-full items-center justify-center px-6 text-center">
                <div className="max-w-md">
                    <CalendarDays className="mx-auto h-10 w-10 text-[#a1a1aa]" />
                    <h2 className="mt-4 text-lg font-semibold text-[#f4f4f5]">No Schedule Items In View</h2>
                    <p className="mt-3 text-sm leading-6 text-[#a1a1aa]">
                        Adjust the current filters, date window, or view mode to reveal schedule items.
                    </p>
                </div>
            </div>
        );
    }

    if (editMode) {
        return (
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                {viewMode === 'month' ? (
                    <MonthBoardDnd
                        cursorDate={cursorDate}
                        monthEvents={monthEvents}
                        onSelectDate={onSelectDate}
                        canCreate={canCreate}
                        onCreateAt={onCreateAt}
                    />
                ) : (
                    <TimelineBoardDnd
                        days={days}
                        events={events}
                        canCreate={canCreate}
                        onCreateAt={onCreateAt}
                    />
                )}
                <DragOverlay dropAnimation={null}>
                    {activeDragEvent ? <DragGhost event={activeDragEvent} /> : null}
                </DragOverlay>
            </DndContext>
        );
    }

    return viewMode === 'month' ? (
        <MonthBoard
            cursorDate={cursorDate}
            monthEvents={monthEvents}
            onSelectDate={onSelectDate}
            onEditEvent={onEditEvent}
            canCreate={canCreate}
            onCreateAt={onCreateAt}
        />
    ) : (
        <TimelineBoard
            days={days}
            events={events}
            onEditEvent={onEditEvent}
            canCreate={canCreate}
            onCreateAt={onCreateAt}
        />
    );
};

// ============================================================
// Existing (non-edit) MonthBoard / TimelineBoard
// ============================================================

const MonthBoard = ({
    cursorDate,
    monthEvents,
    onSelectDate,
    onEditEvent,
    canCreate,
    onCreateAt
}: {
    cursorDate: Date;
    monthEvents: Record<string, ScheduleWorkspaceEvent[]>;
    onSelectDate: (date: Date) => void;
    onEditEvent: (event: ScheduleWorkspaceEvent) => void;
    canCreate: boolean;
    onCreateAt: (date: Date) => void;
}) => (
    <div className="schedule-scroll-surface h-full overflow-auto bg-[color:var(--schedule-board-cell)]">
        <div className="schedule-board-head sticky top-0 z-10 grid min-w-[840px] grid-cols-7 border-b border-[#ffffff0d]">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((label) => (
                <div key={label} className="border-r border-[#ffffff0d] px-3 py-2 text-[10px] font-semibold text-[#a1a1aa] last:border-r-0">
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
                        className={`flex min-h-[120px] flex-col border-b border-r border-[#ffffff0d] px-2.5 py-2.5 last:border-r-0 ${
                            inMonth ? 'schedule-board-cell' : 'schedule-board-cell--muted'
                        } ${canCreate ? 'cursor-pointer' : ''}`}
                    >
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={(clickEvent) => {
                                    clickEvent.stopPropagation();
                                    onSelectDate(date);
                                }}
                                className={`schedule-interactive schedule-tone-blue inline-flex h-7 w-7 items-center justify-center rounded-[4px] text-[11px] font-semibold ${
                                    activeDay ? 'bg-elevated text-current' : 'text-[#a1a1aa]'
                                }`}
                                data-active={activeDay}
                            >
                                {date.getDate()}
                            </button>

                            {canCreate ? (
                                <button
                                    type="button"
                                    onClick={(clickEvent) => {
                                        clickEvent.stopPropagation();
                                        onCreateAt(date);
                                    }}
                                    className="schedule-interactive schedule-tone-green inline-flex h-7 w-7 items-center justify-center rounded-[4px] text-[#a1a1aa]"
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
                                        onEditEvent(event);
                                    }}
                                    className="rounded-[4px] border px-2 py-1.5 text-left transition-transform duration-150 hover:-translate-y-px hover:shadow-[0_8px_18px_rgba(0,0,0,0.18)]"
                                    style={eventStyle(event, false)}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="truncate text-[10px] font-semibold text-[#f4f4f5]">{event.title}</span>
                                        <span className="shrink-0 text-[10px] font-semibold text-[#a1a1aa]">{formatTime(event.startsAt)}</span>
                                    </div>
                                </button>
                            ))}
                            {dayEvents.length > 4 ? (
                                <div className="text-[10px] font-semibold text-[#a1a1aa]">+{dayEvents.length - 4} more</div>
                            ) : null}
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
);

const TimelineBoard = ({
    days,
    events,
    onEditEvent,
    canCreate,
    onCreateAt
}: {
    days: Date[];
    events: ScheduleWorkspaceEvent[];
    onEditEvent: (event: ScheduleWorkspaceEvent) => void;
    canCreate: boolean;
    onCreateAt: (date: Date) => void;
}) => (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[color:var(--schedule-board-cell)]">
        {/* Sticky day headers */}
        <div className="sticky top-0 z-10 grid shrink-0 border-b border-[#ffffff0d] bg-[color:var(--schedule-board-head)]" style={{ gridTemplateColumns: `${TIMELINE_GUTTER_WIDTH}px repeat(${days.length}, minmax(${timelineDayMinWidth(days.length)}px, 1fr))`, minWidth: 1008 }}>
            <div className="border-r border-[#ffffff0d]" />
            {days.map((day) => (
                <div key={toDateKey(day)} className="border-r border-[#ffffff0d] px-3 py-2 last:border-r-0">
                    <p className="text-[10px] font-semibold text-[#a1a1aa]">
                        {day.toLocaleDateString(undefined, { weekday: 'short' })}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] font-semibold uppercase tracking-[0.12em] text-[#f4f4f5]">
                        {day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                </div>
            ))}
        </div>

        {/* Scrollable body */}
        <div className="schedule-scroll-surface min-h-0 flex-1 overflow-auto">
            <div style={{ display: 'grid', gridTemplateColumns: `${TIMELINE_GUTTER_WIDTH}px repeat(${days.length}, minmax(${timelineDayMinWidth(days.length)}px, 1fr))`, minWidth: 1008 }}>
                {/* Time gutter */}
                <div className="relative border-r border-[#ffffff0d]">
                    {HOURS.map((hour) => (
                        <div key={hour} className="flex h-[40px] items-start justify-end border-b border-[#ffffff0d] px-2.5 pt-1 text-[10px] font-semibold text-[#a1a1aa]">
                            {pad(hour)}:00
                        </div>
                    ))}
                </div>

                {/* Day columns */}
                {days.map((day) => {
                    const dayEvents = events.filter((event) => sameDay(parseDate(event.startsAt), day));

                    return (
                        <div key={toDateKey(day)} className="relative border-r border-[#ffffff0d] last:border-r-0">
                            {HOURS.map((hour) =>
                                canCreate ? (
                                    <button
                                        key={`${toDateKey(day)}-${hour}`}
                                        type="button"
                                        onClick={(clickEvent) => onCreateAt(resolveSlotDate(day, hour, clickEvent))}
                                        className="schedule-slot-button block h-[40px] w-full border-b border-[#ffffff0d] text-transparent"
                                    >
                                        slot
                                    </button>
                                ) : (
                                    <div key={`${toDateKey(day)}-${hour}`} className="schedule-board-cell h-[40px] border-b border-[#ffffff0d]" />
                                )
                            )}

                            {dayEvents.map((event) => {
                                const position = eventTimelinePosition(event);
                                return (
                                    <button
                                        key={event.id}
                                        type="button"
                                        onClick={() => onEditEvent(event)}
                                        className="absolute left-1.5 right-1.5 rounded-[4px] border px-2 py-1.5 text-left transition-transform duration-150 hover:-translate-y-px hover:shadow-[0_8px_18px_rgba(0,0,0,0.18)]"
                                        style={{ ...eventStyle(event, false), top: position.top + 2, height: position.height - 4 }}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f4f4f5]">{event.title}</p>
                                                <p className="mt-1 truncate text-[10px] font-semibold text-[#a1a1aa]">
                                                    {formatTime(event.startsAt)} - {formatTime(event.endsAt)}
                                                </p>
                                            </div>
                                            {event.conflict ? <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-[color:var(--state-danger)]" /> : null}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    </div>
);

// ============================================================
// DnD variants — MonthBoardDnd / TimelineBoardDnd
// ============================================================

const MonthBoardDnd = ({
    cursorDate,
    monthEvents,
    onSelectDate,
    canCreate,
    onCreateAt,
}: {
    cursorDate: Date;
    monthEvents: Record<string, ScheduleWorkspaceEvent[]>;
    onSelectDate: (date: Date) => void;
    canCreate: boolean;
    onCreateAt: (date: Date) => void;
}) => (
    <div className="schedule-scroll-surface h-full overflow-auto bg-[color:var(--schedule-board-cell)]">
        <div className="schedule-board-head sticky top-0 z-10 grid min-w-[840px] grid-cols-7 border-b border-[#ffffff0d]">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((label) => (
                <div key={label} className="border-r border-[#ffffff0d] px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--fc-accent)] last:border-r-0">
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
                                <DraggableMonthEvent
                                    key={event.id}
                                    event={event}
                                    selected={false}
                                    onEdit={() => {}}
                                />
                            ))}
                        </div>
                    </DroppableDayCell>
                );
            })}
        </div>
    </div>
);

const TimelineBoardDnd = ({
    days,
    events,
    canCreate,
    onCreateAt,
}: {
    days: Date[];
    events: ScheduleWorkspaceEvent[];
    canCreate: boolean;
    onCreateAt: (date: Date) => void;
}) => (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[color:var(--schedule-board-cell)]">
        {/* Sticky day headers */}
        <div className="sticky top-0 z-10 grid shrink-0 border-b border-[#ffffff0d] bg-[color:var(--schedule-board-head)]" style={{ gridTemplateColumns: `${TIMELINE_GUTTER_WIDTH}px repeat(${days.length}, minmax(${timelineDayMinWidth(days.length)}px, 1fr))`, minWidth: 1008 }}>
            <div className="border-r border-[#ffffff0d]" />
            {days.map((day) => (
                <div key={toDateKey(day)} className="border-r border-[#ffffff0d] px-3 py-2 last:border-r-0">
                    <p className="text-[10px] font-semibold text-[#a1a1aa]">
                        {day.toLocaleDateString(undefined, { weekday: 'short' })}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] font-semibold uppercase tracking-[0.12em] text-[#f4f4f5]">
                        {day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                </div>
            ))}
        </div>

        {/* Scrollable body */}
        <div className="schedule-scroll-surface min-h-0 flex-1 overflow-auto">
            <div style={{ display: 'grid', gridTemplateColumns: `${TIMELINE_GUTTER_WIDTH}px repeat(${days.length}, minmax(${timelineDayMinWidth(days.length)}px, 1fr))`, minWidth: 1008 }}>
                {/* Time gutter */}
                <div className="relative border-r border-[#ffffff0d]">
                    {HOURS.map((hour) => (
                        <div key={hour} className="flex h-[40px] items-start justify-end border-b border-[#ffffff0d] px-2.5 pt-1 text-[10px] font-semibold text-[#a1a1aa]">
                            {pad(hour)}:00
                        </div>
                    ))}
                </div>

                {/* Day columns */}
                {days.map((day) => {
                    const dayEvents = events.filter((event) => sameDay(parseDate(event.startsAt), day));

                    return (
                        <DroppableDayColumn key={toDateKey(day)} day={day}>
                            {HOURS.map((hour) =>
                                canCreate ? (
                                    <button
                                        key={`${toDateKey(day)}-${hour}`}
                                        type="button"
                                        onClick={(clickEvent) => onCreateAt(resolveSlotDate(day, hour, clickEvent))}
                                        className="schedule-slot-button block h-[40px] w-full border-b border-[#ffffff0d] text-transparent"
                                    >
                                        slot
                                    </button>
                                ) : (
                                    <div key={`${toDateKey(day)}-${hour}`} className="schedule-board-cell h-[40px] border-b border-[#ffffff0d]" />
                                )
                            )}

                            {dayEvents.map((event) => (
                                <DraggableTimelineEvent
                                    key={event.id}
                                    event={event}
                                    selected={false}
                                    onEdit={() => {}}
                                />
                            ))}
                        </DroppableDayColumn>
                    );
                })}
            </div>
        </div>
    </div>
);
