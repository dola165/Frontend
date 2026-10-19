import { eventsForDay } from './segments';
import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import type { ScheduleWorkspaceEvent, WorkspaceView } from './workspaceTypes';
import { formatDate as formatAppDate } from '../../utils/formatting';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
    useDroppable,
    type DragStartEvent,
    type DragEndEvent,
} from '@dnd-kit/core';
import { computeMonthDropTimes, computeTimelineDropTimes, eventStyle, eventTimelinePosition, formatDay, formatTime, HOURS, isPast, laneLayout, laneStyle, pad, resolveSlotDate, TIMELINE_GUTTER_WIDTH, timelineDayMinWidth, toDateKey } from './grid/scheduleGridLayout';
import { MonthBoard, MonthBoardDnd } from './grid/MonthBoard';
import { DragGhost, DraggableTimelineEvent, StaticTimelineEvent } from './grid/ScheduleEventChips';
import { useTimelineInitialScroll } from './grid/useTimelineInitialScroll';
import './schedule-grid.css';

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
            className="relative border-r border-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)] last:border-r-0"
            style={isOver ? { backgroundColor: 'var(--accent-primary-soft, color-mix(in srgb, var(--color-accent) 15%, transparent))', outline: '2px solid var(--accent-primary, var(--color-accent))', outlineOffset: -2 } : undefined}
        >
            {children}
        </div>
    );
};

interface ScheduleGridProps {
    viewMode: WorkspaceView;
    cursorDate: Date;
    monthEvents: Record<string, ScheduleWorkspaceEvent[]>;
    days: Date[];
    events: ScheduleWorkspaceEvent[];
    onSelectDate: (date: Date) => void;
    onEditEvent: (event: ScheduleWorkspaceEvent) => void;
    onOpenPastEvent: (event: ScheduleWorkspaceEvent) => void;
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
    onOpenPastEvent,
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
            const pointerY = (evt.activatorEvent && 'clientY' in evt.activatorEvent
                ? (evt.activatorEvent as PointerEvent).clientY
                : dragPointerY) + evt.delta.y;
            const times = computeTimelineDropTimes(draggedEvent, dateKey, pointerY, over.rect as DOMRect);
            newStartsAt = times.newStartsAt;
            newEndsAt = times.newEndsAt;
        }

        onEventDragEnd(draggedEvent.eventId, newStartsAt, newEndsAt);
    };

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
                        onOpenPastEvent={onOpenPastEvent}
                        onEditEvent={onEditEvent}
                    />
                ) : (
                    <TimelineBoardDnd
                        days={days}
                        events={events}
                        canCreate={canCreate}
                        onCreateAt={onCreateAt}
                        onOpenPastEvent={onOpenPastEvent}
                        onEditEvent={onEditEvent}
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
            onOpenPastEvent={onOpenPastEvent}
            canCreate={canCreate}
            onCreateAt={onCreateAt}
        />
    ) : (
        <TimelineBoard
            days={days}
            events={events}
            onEditEvent={onEditEvent}
            onOpenPastEvent={onOpenPastEvent}
            canCreate={canCreate}
            onCreateAt={onCreateAt}
        />
    );
};

// ============================================================
// Existing (non-edit) MonthBoard / TimelineBoard

const TimelineBoard = ({
    days,
    events,
    onEditEvent,
    onOpenPastEvent,
    canCreate,
    onCreateAt
}: {
    days: Date[];
    events: ScheduleWorkspaceEvent[];
    onEditEvent: (event: ScheduleWorkspaceEvent) => void;
    onOpenPastEvent: (event: ScheduleWorkspaceEvent) => void;
    canCreate: boolean;
    onCreateAt: (date: Date) => void;
}) => {
    const scrollSurface = useTimelineInitialScroll(days, events);
    return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[color:var(--schedule-board-cell)]">
        {/* Sticky day headers */}
        <div className="sticky top-0 z-10 grid shrink-0 border-b border-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)] bg-[color:var(--schedule-board-head)]" style={{ gridTemplateColumns: `${TIMELINE_GUTTER_WIDTH}px repeat(${days.length}, minmax(${timelineDayMinWidth(days.length)}px, 1fr))`, minWidth: 1008 }}>
            <div className="border-r border-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)]" />
            {days.map((day) => (
                <div key={toDateKey(day)} className="border-r border-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)] px-3 py-2 last:border-r-0">
                    <p className="text-[10px] font-semibold text-[var(--color-secondary)]">
                        {formatAppDate(day, { weekday: 'short' })}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text)]">
                        {formatAppDate(day, { month: 'short', day: 'numeric' })}
                    </p>
                </div>
            ))}
        </div>

        {/* Scrollable body */}
        <div ref={scrollSurface} className="schedule-scroll-surface min-h-0 flex-1 overflow-auto">
            <div style={{ display: 'grid', gridTemplateColumns: `${TIMELINE_GUTTER_WIDTH}px repeat(${days.length}, minmax(${timelineDayMinWidth(days.length)}px, 1fr))`, minWidth: 1008 }}>
                {/* Time gutter */}
                <div className="relative border-r border-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)]">
                    {HOURS.map((hour) => (
                        <div key={hour} className="flex h-[40px] items-start justify-end border-b border-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)] px-2.5 pt-1 text-[10px] font-semibold text-[var(--color-secondary)]">
                            {pad(hour)}:00
                        </div>
                    ))}
                </div>

                {/* Day columns */}
                {days.map((day) => {
                    const dayEvents = eventsForDay(events,day);
                    const lanes = laneLayout(dayEvents);
                    const dayDescription = formatDay(day);

                    return (
                        <div key={toDateKey(day)} className="relative border-r border-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)] last:border-r-0">
                            {HOURS.map((hour) =>
                                canCreate ? (
                                    <button
                                        key={`${toDateKey(day)}-${hour}`}
                                        type="button"
                                        aria-label={`Create event on ${dayDescription} at ${pad(hour)}:00`}
                                        onClick={(clickEvent) => onCreateAt(resolveSlotDate(day, hour, clickEvent))}
                                        className="schedule-slot-button block h-[40px] w-full border-b border-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)] text-transparent"
                                    >
                                        slot
                                    </button>
                                ) : (
                                    <div key={`${toDateKey(day)}-${hour}`} className="schedule-board-cell h-[40px] border-b border-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)]" />
                                )
                            )}

                            {dayEvents.map((event) => {
                                const position = eventTimelinePosition(event);
                                return (
                                    <button
                                        key={event.id}
                                        type="button"
                                        onClick={() => (isPast(event.startsAt) ? onOpenPastEvent(event) : onEditEvent(event))}
                                        className="absolute left-1.5 right-1.5 rounded-[4px] border px-2 py-1.5 text-left transition-transform duration-150 hover:-translate-y-px hover:shadow-[0_8px_18px_color-mix(in_srgb,_var(--color-shadow)_18%,_transparent)]"
                                        style={{ ...eventStyle(event, false), top: position.top + 2, height: position.height - 4, ...laneStyle(lanes.get(event.id)) }}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="truncate text-[11px] font-semibold text-[var(--color-text)]">{event.title}</p>
                                                <p className="mt-1 truncate text-[10px] font-semibold text-[var(--color-secondary)]">
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
};

// ============================================================
// DnD variants — MonthBoardDnd / TimelineBoardDnd

const TimelineBoardDnd = ({
    days,
    events,
    canCreate,
    onCreateAt,
    onOpenPastEvent,
    onEditEvent,
}: {
    days: Date[];
    events: ScheduleWorkspaceEvent[];
    canCreate: boolean;
    onCreateAt: (date: Date) => void;
    onOpenPastEvent: (event: ScheduleWorkspaceEvent) => void;
    onEditEvent: (event: ScheduleWorkspaceEvent) => void;
}) => {
    const scrollSurface = useTimelineInitialScroll(days, events);
    return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[color:var(--schedule-board-cell)]">
        {/* Sticky day headers */}
        <div className="sticky top-0 z-10 grid shrink-0 border-b border-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)] bg-[color:var(--schedule-board-head)]" style={{ gridTemplateColumns: `${TIMELINE_GUTTER_WIDTH}px repeat(${days.length}, minmax(${timelineDayMinWidth(days.length)}px, 1fr))`, minWidth: 1008 }}>
            <div className="border-r border-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)]" />
            {days.map((day) => (
                <div key={toDateKey(day)} className="border-r border-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)] px-3 py-2 last:border-r-0">
                    <p className="text-[10px] font-semibold text-[var(--color-secondary)]">
                        {formatAppDate(day, { weekday: 'short' })}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text)]">
                        {formatAppDate(day, { month: 'short', day: 'numeric' })}
                    </p>
                </div>
            ))}
        </div>

        {/* Scrollable body */}
        <div ref={scrollSurface} className="schedule-scroll-surface min-h-0 flex-1 overflow-auto">
            <div style={{ display: 'grid', gridTemplateColumns: `${TIMELINE_GUTTER_WIDTH}px repeat(${days.length}, minmax(${timelineDayMinWidth(days.length)}px, 1fr))`, minWidth: 1008 }}>
                {/* Time gutter */}
                <div className="relative border-r border-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)]">
                    {HOURS.map((hour) => (
                        <div key={hour} className="flex h-[40px] items-start justify-end border-b border-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)] px-2.5 pt-1 text-[10px] font-semibold text-[var(--color-secondary)]">
                            {pad(hour)}:00
                        </div>
                    ))}
                </div>

                {/* Day columns */}
                {days.map((day) => {
                    const dayEvents = eventsForDay(events,day);
                    const lanes = laneLayout(dayEvents);
                    const dayDescription = formatDay(day);

                    return (
                        <DroppableDayColumn key={toDateKey(day)} day={day}>
                            {HOURS.map((hour) =>
                                canCreate ? (
                                    <button
                                        key={`${toDateKey(day)}-${hour}`}
                                        type="button"
                                        aria-label={`Create event on ${dayDescription} at ${pad(hour)}:00`}
                                        onClick={(clickEvent) => onCreateAt(resolveSlotDate(day, hour, clickEvent))}
                                        className="schedule-slot-button block h-[40px] w-full border-b border-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)] text-transparent"
                                    >
                                        slot
                                    </button>
                                ) : (
                                    <div key={`${toDateKey(day)}-${hour}`} className="schedule-board-cell h-[40px] border-b border-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)]" />
                                )
                            )}

                            {dayEvents.map((event) => (
                                isPast(event.startsAt) ? (
                                    <StaticTimelineEvent key={event.id} event={event} place={lanes.get(event.id)} onOpenPastEvent={onOpenPastEvent} />
                                ) : (
                                    <DraggableTimelineEvent
                                        key={event.id}
                                        event={event}
                                        place={lanes.get(event.id)}
                                        selected={false}
                                        onEdit={onEditEvent}
                                    />
                                )
                            ))}
                        </DroppableDayColumn>
                    );
                })}
            </div>
        </div>
    </div>
    );
};
