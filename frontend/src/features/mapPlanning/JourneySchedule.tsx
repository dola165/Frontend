import { useId, useState } from 'react';
import { MapPin, Route } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Badge, Button, ButtonLink, Field } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { dateTime } from './api';
import { replyToJourney, type JourneyEntry } from './journeyScheduleData';
import './journey-schedule.css';

const LABEL: Record<string, string> = { GOING: 'Going', NOT_GOING: 'Not going', RECONFIRMATION_REQUIRED: 'Please confirm the updated journey' };

/**
 * A journey stop in someone's schedule: when and where, and a reply for each child (or
 * yourself) for the whole journey. Replies belong to one journey and one published version.
 */
export function JourneyEventDetails({ entries, onClose, onSaved }: { entries: JourneyEntry[]; onClose: () => void; onSaved?: () => void }) {
    const [picked, setPicked] = useState(entries[0].id);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState<Record<string, string>>({});
    const pickId = useId();
    const entry = entries.find(item => item.id === picked) ?? entries[0];
    const reply = async (subject: number, response: 'GOING' | 'NOT_GOING') => {
        if (busy) return;
        setBusy(true); setError('');
        try {
            await replyToJourney(entry, subject, response);
            setSaved(current => ({ ...current, [`${entry.planId}:${entry.version}:${subject}`]: response }));
            onSaved?.();
        } catch (cause) {
            setError(extractApiErrorMessage(cause, 'Your reply was not saved. Try again.'));
        } finally {
            setBusy(false);
        }
    };
    const child = entry.subjects[0]?.id;
    const journeyLink = entry.staff
        ? `/world/map?plans=staff&plan=${entry.planId}&club=${entry.clubId}&squad=${entry.squadId}&view=journey`
        : `/world/map?plans=family&journey=${entry.planId}${child ? `&journeyChild=${child}` : ''}`;
    return (
        <Dialog open title={entry.title} description={`${entry.clubName} · ${entry.squadName} · part of ${entry.journeyTitle}`} onClose={onClose}
            footer={<ButtonLink variant="primary" to={journeyLink}><Route aria-hidden="true" />See the whole journey</ButtonLink>}>
            {entries.length > 1 && (
                <Field label="Journey" htmlFor={pickId}>
                    <select id={pickId} className="gk-input" value={picked} onChange={event => setPicked(event.target.value)}>
                        {entries.map(item => <option key={item.id} value={item.id}>{item.journeyTitle}</option>)}
                    </select>
                </Field>
            )}
            <dl className="gk-journey-event__facts">
                <dt>When</dt><dd>{dateTime(entry.startsAt, entry.timezone)} – {dateTime(entry.endsAt, entry.timezone)}</dd>
                {entry.place && <><dt>Where</dt><dd><MapPin aria-hidden="true" />{entry.place.name}{entry.place.address ? ` · ${entry.place.address}` : ''}</dd></>}
            </dl>
            {entry.status === 'CANCELLED' && <div className="gk-notice gk-notice--danger" role="alert">The linked event was cancelled. Contact your club about the rest of the travel arrangements.</div>}
            {entry.sourceChanged && <div className="gk-notice gk-notice--warning" role="status">The fixture changed. These are its current times; your club is reviewing the rest of the journey.</div>}
            {entry.staff && <p className="gk-muted"><strong className="gk-num">{entry.attendance.going}</strong> of {entry.attendance.total} going · {entry.attendance.pending} yet to reply</p>}
            {entry.subjects.map(subject => {
                const answer = saved[`${entry.planId}:${entry.version}:${subject.id}`] ?? subject.response;
                return (
                    <section className="gk-journey-event__reply" key={subject.id} aria-label={`${subject.name}, whole journey`}>
                        <div className="gk-row"><strong>{subject.name}</strong><span className="gk-faint">whole journey</span></div>
                        <p role="status"><Badge tone={answer === 'GOING' ? 'accent' : answer === 'NOT_GOING' ? 'danger' : 'warning'}>{LABEL[answer] ?? 'Awaiting your reply'}</Badge></p>
                        {subject.guardian && <p className="gk-faint">Attendance and travel permission are separate. Review any permission request in the journey.</p>}
                        {subject.canRespond && entry.status !== 'CANCELLED' && (
                            <div className="gk-row">
                                <Button size="sm" variant="primary" disabled={busy} onClick={() => void reply(subject.id, 'GOING')}>I am going</Button>
                                <Button size="sm" disabled={busy} onClick={() => void reply(subject.id, 'NOT_GOING')}>I cannot go</Button>
                            </div>
                        )}
                    </section>
                );
            })}
            {busy && <p className="gk-faint" role="status">Saving your reply…</p>}
            {error && <div className="gk-notice gk-notice--danger" role="alert">{error}</div>}
            {(entry.eventId || entry.sessionId) && (
                <ButtonLink size="sm" variant="ghost" to={entry.sessionId ? `/calendar?scope=squad&squadId=${entry.squadId}&sessionId=${entry.sessionId}` : `/calendar?scope=personal&eventId=${entry.eventId}`}>
                    Open the linked {entry.sessionId ? 'training session' : 'fixture'}
                </ButtonLink>
            )}
        </Dialog>
    );
}
