import { useState } from 'react';
import { Check, CircleHelp, UserX } from 'lucide-react';
import { Badge, Button, GkRoot } from '../../design/primitives';
import type { SquadSession } from './api';
import { availability, type AttendancePerson } from './attendance';
import './session-availability.css';

type Response = 'GOING' | 'NOT_GOING' | 'UNSURE';
type Reply = (person: AttendancePerson, response: Response, reason?: string) => void;
/** The coach turning confirmation on or off. `review` holds the notification count to confirm before families are asked. */
export interface AskControl { review: { recipients: number } | null; onAsk: (asking: boolean) => void; onConfirm: () => void; onCancel: () => void }

const answer = (response?: string | null) => response === 'GOING' ? 'coming' : response === 'NOT_GOING' ? 'can’t come' : response === 'UNSURE' ? 'not sure' : 'no answer';
const firstName = (name: string) => name.split(' ')[0];

/**
 * Attendance, opt-out: everyone invited is expected. A family taps "Can't come" when needed;
 * only when the coach asks (matches, trips, limited places) do people confirm.
 */
export function SessionAvailability({ session, canManage, playerId, busy, ended, pending, onReply, ask }: {
    session: SquadSession; canManage: boolean; playerId?: number; busy: boolean; ended: boolean;
    /** People with an earlier reply that may not have been saved; their buttons wait for recovery. */
    pending: Set<number>;
    onReply: Reply; ask?: AskControl;
}) {
    const value = availability(session);
    const people = session.attendance.filter(person => playerId == null || person.id === playerId);
    return <GkRoot className="gk-availability">
        {canManage ? <CoachView value={value} busy={busy} ended={ended} pending={pending} onReply={onReply} ask={ask} />
            : people.map(person => <FamilyReply key={person.id} person={person} asking={value.asking} busy={busy || pending.has(person.id)} ended={ended} onReply={onReply} />)}
    </GkRoot>;
}

function FamilyReply({ person, asking, busy, ended, onReply }: { person: AttendancePerson; asking: boolean; busy: boolean; ended: boolean; onReply: Reply }) {
    const [reason, setReason] = useState<string | null>(null);
    if (person.active === false) return <p className="gk-availability__line">{person.name} is no longer invited to this event.</p>;
    const first = firstName(person.name);
    const reconfirm = person.response === 'RECONFIRMATION_REQUIRED';
    const cant = person.response === 'NOT_GOING';
    const unsure = person.response === 'UNSURE';
    const needsAnswer = reconfirm || unsure || (asking && person.response === 'UNANSWERED');
    const status = cant ? `${person.name} can’t come` : reconfirm ? 'The event changed. Please confirm again.' : unsure ? `${person.name} is not sure yet` : needsAnswer ? 'The coach asked everyone to confirm.'
        : person.response === 'GOING' ? `${person.name} is coming` : `${person.name} is expected`;
    const Icon = cant ? UserX : needsAnswer ? CircleHelp : Check;
    return <section className="gk-availability__family" aria-label={`Attendance for ${person.name}`} data-state={cant ? 'out' : needsAnswer ? 'ask' : 'in'}>
        <p className="gk-availability__line"><Icon aria-hidden="true" size={18} /><span><strong>{status}</strong>
            {cant && person.reason && <span className="gk-muted"> · {person.reason}</span>}
            {reconfirm && person.previous_response && <span className="gk-muted"> Previous answer: {answer(person.previous_response)}.</span>}
            {!cant && !needsAnswer && person.response !== 'GOING' && !ended && <span className="gk-muted"> No need to reply. Let the coach know only if {first} can’t make it.</span>}
        </span></p>
        {ended ? null : reason !== null ? <form className="gk-availability__reason" onSubmit={event => { event.preventDefault(); onReply(person, 'NOT_GOING', reason.trim() || undefined); setReason(null); }}>
            <label className="gk-field"><span className="gk-field__label">Reason for the coach (optional)</span>
                <input className="gk-input" maxLength={140} value={reason} onChange={event => setReason(event.target.value)} placeholder="For example: school trip, injured" autoFocus /></label>
            <div className="gk-row"><Button type="submit" size="sm" variant="primary" disabled={busy || !reason.trim()}>Send reason</Button><Button size="sm" variant="ghost" onClick={() => setReason(null)}>Skip</Button></div>
        </form> : <div className="gk-row gk-availability__actions">
            {cant ? <>
                <Button size="sm" disabled={busy} onClick={() => onReply(person, 'GOING')}>{first} can come after all</Button>
                {!person.reason && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setReason('')}>Add a reason</Button>}
            </> : <>
                {needsAnswer && <Button size="sm" variant="primary" disabled={busy} onClick={() => onReply(person, 'GOING')}>Coming</Button>}
                <Button size="sm" disabled={busy} onClick={() => { onReply(person, 'NOT_GOING'); setReason(''); }}>Can’t come</Button>
            </>}
        </div>}
        {person.recorded_by && person.response !== 'UNANSWERED' && <p className="gk-faint">{person.recorded_by === 'COACH' ? 'Recorded by the coach' : person.recorded_by === 'GUARDIAN' ? 'Answered by a parent or guardian' : 'Answered by the player'}</p>}
    </section>;
}

function CoachView({ value, busy, ended, pending, onReply, ask }: { value: ReturnType<typeof availability>; busy: boolean; ended: boolean; pending: Set<number>; onReply: Reply; ask?: AskControl }) {
    const [recording, setRecording] = useState('');
    const person = value.invited.find(item => String(item.id) === recording);
    const blocked = busy || !person || pending.has(person.id);
    return <section className="gk-availability__coach" aria-label="Availability">
        <div className="gk-availability__summary">
            <p><strong className="gk-num">{value.expected}</strong> of {value.invited.length} expected</p>
            <div className="gk-chips">
                {value.cantCome.length > 0 && <Badge tone="warning">{value.cantCome.length} can’t come</Badge>}
                {value.unsure.length > 0 && <Badge>{value.unsure.length} not sure</Badge>}
                {(value.asking || value.toConfirm.length > 0) && <Badge tone={value.toConfirm.length ? 'warning' : 'accent'}>{value.toConfirm.length ? `${value.toConfirm.length} to confirm` : 'Everyone answered'}</Badge>}
                {!value.asking && !value.cantCome.length && !value.unsure.length && !value.toConfirm.length && <Badge tone="accent">Everyone coming</Badge>}
            </div>
        </div>
        {value.cantCome.length > 0 && <ul className="gk-availability__people" aria-label="Can’t come">{value.cantCome.map(item => <li key={item.id}><strong>{item.name}</strong>{item.reason ? <span className="gk-muted"> · {item.reason}</span> : null}</li>)}</ul>}
        {value.toConfirm.length > 0 && <details className="gk-availability__more"><summary>Waiting for {value.toConfirm.length}</summary><p className="gk-muted">{value.toConfirm.map(item => item.name).join(', ')}</p></details>}
        {!ended && ask && <div className="gk-availability__ask">
            {ask.review ? <>
                <p>Ask {ask.review.recipients} {ask.review.recipients === 1 ? 'family' : 'families'} to confirm? They get one notification and can answer coming or can’t come.</p>
                <div className="gk-row"><Button size="sm" variant="ghost" disabled={busy} onClick={ask.onCancel}>Cancel</Button><Button size="sm" variant="primary" disabled={busy} onClick={ask.onConfirm}>Send request</Button></div>
            </> : value.asking ? <><p className="gk-muted">Families are asked to confirm this event.</p><Button size="sm" variant="ghost" disabled={busy} onClick={() => ask.onAsk(false)}>Stop asking</Button></>
                : <><p className="gk-muted">Everyone is expected unless they say they can’t come. For matches, trips or limited places, ask families to confirm.</p><Button size="sm" disabled={busy} onClick={() => ask.onAsk(true)}>Ask for confirmation</Button></>}
        </div>}
        {!ended && value.invited.length > 0 && <details className="gk-availability__more">
            <summary>Record an answer for a player</summary>
            <div className="gk-availability__record">
                <label className="gk-field"><span className="gk-field__label">Player</span>
                    <select className="gk-input" value={recording} onChange={event => setRecording(event.target.value)}>
                        <option value="">Choose a player</option>
                        {value.invited.map(item => <option key={item.id} value={item.id}>{item.name} · {answer(item.response)}</option>)}
                    </select></label>
                <div className="gk-row">
                    <Button size="sm" disabled={blocked} onClick={() => person && onReply(person, 'GOING')}>Coming</Button>
                    <Button size="sm" disabled={blocked} onClick={() => person && onReply(person, 'NOT_GOING')}>Can’t come</Button>
                    <Button size="sm" disabled={blocked} onClick={() => person && onReply(person, 'UNSURE')}>Not sure</Button>
                </div>
                <p className="gk-faint">Answers you record are labelled as recorded by the coach.</p>
            </div>
        </details>}
    </section>;
}
