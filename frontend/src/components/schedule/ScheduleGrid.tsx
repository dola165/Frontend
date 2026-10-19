import { useState } from 'react';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
    type DragStartEvent,
    type DragEndEvent,
} from '@dnd-kit/core';
import type { ScheduleWorkspaceEvent, WorkspaceView } from './workspaceTypes';
import { MonthBoard, MonthBoardDnd } from './grid/MonthBoard';
import { TimelineBoard, TimelineBoardDnd } from './grid/TimelineBoard';
import { DragGhost } from './grid/ScheduleEventChips';
import { computeMonthDropTimes, computeTimelineDropTimes } from './grid/scheduleGridLayout';

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

/** The month and timeline boards of the one calendar. In edit mode upcoming events can be dragged; the drop becomes new start and end times. */
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
