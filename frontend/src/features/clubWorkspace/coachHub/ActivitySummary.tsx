import { Link } from 'react-router-dom';
import { Clock, MapPin, Pencil, Shield, Trophy, X } from 'lucide-react';
import { Button, ButtonLink } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { scheduleDestination } from '../../schedule/origin';
import { eventSquadId, dayLabel, timeLabel } from '../fixtures';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';
import { kindNames } from './useCoachData';
import { ActivityBadge } from './CoachVisuals';
import type { CoachEvent } from './coachEvents';
import type { CoachData } from './CoachWorkspace';
import './coach-hub.css';

/**
 * What an existing session, match or club event is, before anything changes: when, where, against whom and its
 * state, with Edit one press away. However the entry was made (a squad session, a calendar entry, an arranged
 * match), the coach sees the same summary; Edit opens the editor that entry belongs to.
 */
export function ActivitySummary({ event, data, editTo, onEdit, onCancel, onClose }: {
    event: CoachEvent; data: CoachData; editTo?: string; onEdit?: () => void; onCancel?: () => void; onClose: () => void;
}) {
    const copy = useCopy('coachHub', coachHubEn);
    const start = event.start.toISOString(), end = event.end.toISOString();
    const title = event.opponent ? `${event.squad} v ${event.opponent.name}` : event.title;
    // A match arranged with another club has its own page (offers, result); the session or calendar entry points to it.
    const linked = event.event ?? data.events.find(item => eventSquadId(item) === event.squadId && Math.abs(new Date(item.startsAt).getTime() - event.start.getTime()) < 60_000);
    const matchPage = linked ? scheduleDestination(linked) : null;
    const notes = event.session?.description ?? event.event?.description ?? null;
    const future = event.start.getTime() > data.now;
    return <Dialog open size="sm" title={title} description={[kindNames[event.kind], event.opponent ? null : event.squad].filter(Boolean).join(' · ')} onClose={onClose}
        footer={<>
            {onCancel && future && !event.cancelled && <Button variant="ghost" className="ch-summary__cancel" onClick={onCancel}><X aria-hidden="true" />{copy('cancelSession')}</Button>}
            {matchPage && <ButtonLink variant="secondary" to={matchPage}><Trophy aria-hidden="true" />{copy('matchPage')}</ButtonLink>}
            {editTo ? <ButtonLink variant="primary" to={editTo}><Pencil aria-hidden="true" />{copy('edit')}</ButtonLink>
                : onEdit ? <Button variant="primary" onClick={onEdit}><Pencil aria-hidden="true" />{copy('edit')}</Button> : null}
        </>}>
        <div className="ch-summary">
            <ActivityBadge kind={event.kind} size={44} />
            <ul className="ch-summary__facts">
                <li><Clock aria-hidden="true" /><span>{dayLabel(start, data.now)} · {timeLabel(start)}{end !== start ? `–${timeLabel(end)}` : ''}</span></li>
                {event.location && <li><MapPin aria-hidden="true" /><span>{event.location}</span></li>}
                {event.opponent?.id && <li><Shield aria-hidden="true" /><Link to={`/clubs/${event.opponent.id}`}>{event.opponent.name}</Link></li>}
                {event.cancelled && <li><span className="cw-dot cw-dot--danger" aria-hidden="true" /><span className="cw-status cw-status--danger">{copy('cancelled')}{event.session?.cancellation_reason ? ` · ${event.session.cancellation_reason}` : ''}</span></li>}
            </ul>
        </div>
        {notes && <p className="ch-summary__notes">{notes}</p>}
    </Dialog>;
}
