import type { CSSProperties } from 'react';
import { PencilLine, TriangleAlert } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { ScheduleWorkspaceEvent } from '../workspaceTypes';
import { eventStyle, eventTimelinePosition, formatTime, laneStyle, type Lane } from './scheduleGridLayout';

// Event chips on the boards: draggable ones for upcoming events in edit mode, read-only ones for the past, and the drag ghost.
export const DraggableMonthEvent = ({
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
            title={`${event.title}: drag to move, click for details`}
            onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                onEdit(event);
            }}
            className="rounded-[4px] border px-2 py-1.5 text-left"
            style={style}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[10px] font-semibold text-[var(--color-text)]">{event.title}</span>
                <span className="shrink-0 text-[10px] font-semibold text-[var(--color-secondary)]">{formatTime(event.startsAt)}</span>
            </div>
        </button>
    );
};

export const StaticMonthEvent = ({
    event,
    onOpenPastEvent,
}: {
    event: ScheduleWorkspaceEvent;
    onOpenPastEvent: (event: ScheduleWorkspaceEvent) => void;
}) => (
    <button
        type="button"
        onClick={() => onOpenPastEvent(event)}
        className="rounded-[4px] border px-2 py-1.5 text-left opacity-70"
        style={eventStyle(event, false)}
    >
        <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[10px] font-semibold text-[var(--color-text)]">{event.title}</span>
            <span className="shrink-0 text-[10px] font-semibold text-[var(--color-secondary)]">{formatTime(event.startsAt)}</span>
        </div>
    </button>
);

export const StaticTimelineEvent = ({
    event,
    place,
    onOpenPastEvent,
}: {
    event: ScheduleWorkspaceEvent;
    place?: Lane;
    onOpenPastEvent: (event: ScheduleWorkspaceEvent) => void;
}) => {
    const position = eventTimelinePosition(event);
    return (
        <button
            type="button"
            onClick={() => onOpenPastEvent(event)}
            className="absolute left-1.5 right-1.5 rounded-[4px] border px-2 py-1.5 text-left opacity-70"
            style={{ ...eventStyle(event, false), top: position.top + 2, height: position.height - 4, ...laneStyle(place) }}
        >
            <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-[var(--color-text)]">{event.title}</p>
                <p className="mt-1 truncate text-[10px] font-semibold text-[var(--color-secondary)]">
                    {formatTime(event.startsAt)} - {formatTime(event.endsAt)}
                </p>
            </div>
        </button>
    );
};

export const DraggableTimelineEvent = ({
    event,
    place,
    selected,
    onEdit,
}: {
    event: ScheduleWorkspaceEvent;
    place?: Lane;
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
        ...laneStyle(place),
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
            title={`${event.title}: drag to move, click for details`}
            aria-label={`${event.title}, ${formatTime(event.startsAt)} – ${formatTime(event.endsAt)}`}
            onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                onEdit(event);
            }}
            className="absolute left-1.5 right-1.5 rounded-[4px] border px-2 py-1.5 text-left"
            style={style}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-[var(--color-text)]">{event.title}</p>
                    <p className="mt-1 truncate text-[10px] font-semibold text-[var(--color-secondary)]">
                        {formatTime(event.startsAt)} - {formatTime(event.endsAt)}
                    </p>
                </div>
                {event.conflict ? <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-[color:var(--state-danger)]" /> : null}
                <PencilLine className="h-3 w-3 shrink-0 text-[var(--fc-accent)]" />
            </div>
        </button>
    );
};

export const DragGhost = ({ event }: { event: ScheduleWorkspaceEvent }) => (
    <div
        className="rounded-[4px] border-2 border-[var(--fc-accent)] px-2 py-1.5 opacity-90 shadow-2xl"
        style={{ ...eventStyle(event, false), minWidth: 120 }}
    >
        <span className="text-[10px] font-black uppercase">{event.title}</span>
    </div>
);
