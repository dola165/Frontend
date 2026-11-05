import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Clock, MapPin, Pencil, Shield, Trophy, X } from 'lucide-react';
import { Button, ButtonLink } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { useCan } from '../../../hooks/useCan';
import { mySquadsEn } from '../../../locales/mySquadsDesign';
import { SessionRegister } from '../../clubOperations/SessionRegister';
import { SessionHelpers } from '../../helpers/SessionHelpers';
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
 * match), everyone on the squad sees the same summary; Edit opens the editor that entry belongs to. A training
 * session also carries its register (for whoever takes attendance) and who helps at it (Add and Remove for whoever may
 * add helpers).
 */
export function ActivitySummary({ event, data, editTo, onEdit, onCancel, onClose }: {
    event: CoachEvent; data: CoachData; editTo?: string; onEdit?: () => void; onCancel?: () => void; onClose: () => void;
}) {
    const copy = useCopy('coachHub', coachHubEn);
    const words = useCopy('mySquads', mySquadsEn);
    const [registering, setRegistering] = useState(false);
    const training = Boolean(event.session) && event.kind === 'TRAINING' && !event.cancelled;
    const manageHelpers = useCan(training ? `squad:${event.squadId}` : null).decide('add_helper', false).allowed;
    const attendance = data.boot?.modules.find(module => module.id === 'ATTENDANCE');
    const register = training && Boolean(attendance?.globalWrite || attendance?.writeSquads.includes(event.squadId));
    const start = event.start.toISOString(), end = event.end.toISOString();
    const title = event.opponent ? copy('matchTitle', { home: event.squad, away: event.opponent.name }) : event.title;
    // A match arranged with another club has its own page (offers, result); the session or calendar entry points to it.
    const linked = event.event ?? data.events.find(item => eventSquadId(item) === event.squadId && Math.abs(new Date(item.startsAt).getTime() - event.start.getTime()) < 60_000);
    const matchPage = linked ? scheduleDestination(linked) : null;
    const notes = event.session?.description ?? event.event?.description ?? null;
    const future = event.start.getTime() > data.now;
    // The register opens over the summary, closing back to it; a player's record opens in the attendance tool.
    if (registering && data.boot) return <Dialog open size="lg" title={words('whoCame')} description={`${event.title} · ${event.squad}`} onClose={() => setRegistering(false)}>
        <SessionRegister boot={{ ...data.boot, peopleBySquad: data.roles.people }} session={event.session!.id} squad={event.squadId}
            onRecord={record => data.openWork('attendance', { squad: String(event.squadId), session: String(event.session!.id), record: String(record.id) })} />
    </Dialog>;
    return <Dialog open size="sm" title={title} description={[kindNames[event.kind], event.opponent ? null : event.squad].filter(Boolean).join(' · ')} onClose={onClose}
        footer={<>
            {onCancel && future && !event.cancelled && <Button variant="ghost" className="ch-summary__cancel" onClick={onCancel}><X aria-hidden="true" />{copy('cancelSession')}</Button>}
            {register && <Button variant="secondary" onClick={() => setRegistering(true)}><ClipboardList aria-hidden="true" />{words('register')}</Button>}
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
        {training && future && <SessionHelpers squad={event.squadId} squadName={event.squad} session={event.session!} canManage={manageHelpers} />}
    </Dialog>;
}
