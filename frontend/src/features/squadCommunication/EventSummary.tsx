import type { CSSProperties } from 'react';
import { Clock3, MapPin, Pencil } from 'lucide-react';
import { formatDate, formatTime } from '../../utils/formatting';
import { activityColors, activityIcons } from '../schedule/activityIcons';
import { SessionDialog } from './SquadSessionDialog';
import { useJourneyCopy } from './journeyCopy';
import type { SquadCalendarEvent } from './useSquadSchedule';
import './event-summary.css';

/**
 * What an existing calendar entry is before anything changes (F29): when, where, its state and notes, with Edit one
 * press away. However the entry was made, opening it reads the same; only Edit opens its editor.
 */
export function EventSummary({ event, onEdit, onClose }: { event: SquadCalendarEvent; onEdit: () => void; onClose: () => void }) {
    const copy = useJourneyCopy();
    const Icon = activityIcons[event.eventType] ?? activityIcons.ACTIVITY;
    const sameDay = new Date(event.startsAt).toDateString() === new Date(event.endsAt).toDateString();
    return <SessionDialog title={event.title} onClose={onClose} detail>
        <div className="event-summary" style={{ '--tone': activityColors[event.eventType] ?? activityColors.ACTIVITY } as CSSProperties}>
            <span className="event-summary__icon" aria-hidden="true"><Icon /></span>
            <ul className="event-summary__facts">
                <li><Clock3 aria-hidden="true" /><span>{formatDate(event.startsAt, { weekday: 'long', day: 'numeric', month: 'long' })} · {formatTime(event.startsAt)}{sameDay ? `–${formatTime(event.endsAt)}` : ''}</span></li>
                {event.locationText && <li><MapPin aria-hidden="true" /><span>{event.locationText}</span></li>}
                {event.status === 'CANCELLED' && <li className="event-summary__cancelled"><span className="event-summary__dot" aria-hidden="true" />{copy('Cancelled', 'გაუქმებულია')}</li>}
            </ul>
        </div>
        {event.description && <p className="event-summary__notes">{event.description}</p>}
        <div className="event-summary__foot"><button type="button" className="event-summary__edit" onClick={onEdit}><Pencil aria-hidden="true" />{copy('Edit', 'რედაქტირება')}</button></div>
    </SessionDialog>;
}
