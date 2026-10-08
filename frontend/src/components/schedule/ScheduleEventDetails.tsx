import { useRef } from 'react';
import { JourneyLauncher } from '../../features/mapPlanning/JourneyLauncher';
import { CalendarDays, MapPin, X } from 'lucide-react';
import { formatDate, formatTime } from '../../utils/formatting';
import { useDialogFocus } from '../workspace/useDialogFocus';
import { eventTypeCopy, visibilityCopy, type ScheduleWorkspaceEvent } from './workspaceTypes';

/** Club members can inspect the whole event without entering an editor they cannot save. */
export function ScheduleEventDetails({ event, onClose }: { event: ScheduleWorkspaceEvent; onClose: () => void }) {
    const dialog = useRef<HTMLDivElement>(null);
    useDialogFocus(true, dialog, onClose);
    return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[color:var(--color-overlay)]/60 p-4" onClick={onClose}>
        <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="schedule-event-detail-title" className="schedule-event-detail-content max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="text-sm text-[var(--fc-text-secondary)]">{eventTypeCopy[event.eventType].label} · {visibilityCopy[event.visibility]}</p><h2 id="schedule-event-detail-title" className="mt-2 text-xl font-semibold">{event.title}</h2></div>
                <button type="button" aria-label="Close event details" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" onClick={onClose}><X size={22} /></button>
            </div>
            {event.subtitle && <p className="mt-3">{event.subtitle}</p>}
            <div className="mt-5 flex items-start gap-3"><CalendarDays size={20} className="shrink-0" /><p>{formatDate(event.startsAt, { weekday: 'long', month: 'long', day: 'numeric' })}<br />{formatTime(event.startsAt)} – {formatTime(event.endsAt)}</p></div>
            {event.locationText && <p className="mt-4 flex gap-3"><MapPin size={20} className="shrink-0" />{event.locationText}</p>}
            {event.description && <p className="mt-5 whitespace-pre-wrap leading-6">{event.description}</p>}
            {['MATCH','FRIENDLY'].includes(event.eventType) && event.status !== 'CANCELLED' && <JourneyLauncher eventId={event.eventId}/>}
            <p className="mt-5 border-t border-[var(--fc-border)] pt-4 text-sm text-[var(--fc-text-secondary)]">{event.ownerLabel} · {event.status}</p>
        </div>
    </div>;
}
