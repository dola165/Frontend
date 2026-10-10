import { CalendarDays, MapPin } from 'lucide-react';
import { Badge, ButtonLink } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { visibilityCopy, type ScheduleWorkspaceEvent } from '../../../components/schedule/workspaceTypes';
import { JourneyLauncher } from '../../mapPlanning/JourneyLauncher';
import { ScheduleScore } from '../../matchHistory/ScheduleResult';
import { formatDate, formatTime } from '../../../utils/formatting';
import { kindOf } from './scheduleEvents';
import './schedule-board.css';

const visibility = (value: ScheduleWorkspaceEvent['visibility']) => value === 'CLUB_ONLY' ? 'Club members' : value === 'SCHEDULED_PUBLICATION' ? 'Published later' : visibilityCopy[value];

/** A read-only look at a calendar event for people who can see it but not change it. */
export function EventDetailsDialog({ event, onClose }: { event: ScheduleWorkspaceEvent; onClose: () => void }) {
    const kind = kindOf(event);
    const match = event.eventType === 'MATCH' || event.eventType === 'FRIENDLY';
    return <Dialog open title={event.title} description={event.subtitle ?? undefined} onClose={onClose} closeLabel="Close event details"
        footer={event.matchExchangeId ? <ButtonLink variant="primary" to={`/match-exchange/${event.matchExchangeId}`}>Open match page</ButtonLink> : undefined}>
        <div className="gk-event-details">
            <div className="gk-chips"><Badge tone={kind.badge}>{kind.label}</Badge><Badge>{visibility(event.visibility)}</Badge>{event.status.toLowerCase() === 'cancelled' && <Badge tone="danger">Cancelled</Badge>}</div>
            <p className="gk-row"><CalendarDays size={18} aria-hidden="true" /><span>{formatDate(event.startsAt, { weekday: 'long', day: 'numeric', month: 'long' })}, {formatTime(event.startsAt)}–{formatTime(event.endsAt)}</span></p>
            {event.locationText && <p className="gk-row"><MapPin size={18} aria-hidden="true" /><span>{event.locationText}</span></p>}
            {match && <ScheduleScore event={event} />}
            {event.description && <p className="gk-event-details__notes">{event.description}</p>}
            {match && event.status.toLowerCase() !== 'cancelled' && <JourneyLauncher eventId={event.eventId} />}
            <p className="gk-faint">{event.ownerLabel}</p>
        </div>
    </Dialog>;
}
