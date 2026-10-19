import { useEffect, useRef } from 'react';
import type { ScheduleWorkspaceEvent } from '../workspaceTypes';
import { parseDate, SLOT_HEIGHT, toDateKey } from './scheduleGridLayout';

/** Opens a timeline at the earliest event of the range (or 08:00), once per range and before the viewer scrolls. */
export const useTimelineInitialScroll = (days: Date[], events: ScheduleWorkspaceEvent[]) => {
    const surface = useRef<HTMLDivElement>(null);
    const initialized = useRef<{ range: string; hasEvents: boolean; scrollTop: number } | null>(null);
    const range = days.map(toDateKey).join('|');
    useEffect(() => {
        const node = surface.current;
        if (!node) return;
        const hours = events.flatMap(event => {
            const start = parseDate(event.startsAt);
            return Number.isFinite(start.getTime()) && range.split('|').includes(toDateKey(start)) ? [start.getHours()] : [];
        });
        const scrollTop = Math.min(8, ...hours) * SLOT_HEIGHT;
        const previous = initialized.current;
        if (previous?.range !== range) {
            node.scrollTop = scrollTop;
            initialized.current = { range, hasEvents: hours.length > 0, scrollTop: node.scrollTop };
        } else if (!previous.hasEvents && hours.length > 0) {
            // A new date range may first render before its events arrive. Adjust once
            // for an early session, only if the viewer has not scrolled meanwhile.
            if (Math.abs(node.scrollTop - previous.scrollTop) < 1) node.scrollTop = scrollTop;
            initialized.current = { range, hasEvents: true, scrollTop: node.scrollTop };
        }
    }, [events, range]);
    return surface;
};
