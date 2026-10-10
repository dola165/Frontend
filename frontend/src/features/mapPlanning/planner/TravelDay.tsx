import { useId, useState } from 'react';
import { Badge, Button, EmptyNote, Field, List, Section } from '../../../design/primitives';
import type { Plan } from '../api';

const NEXT: Record<string, string[]> = { PLANNED: ['BOARDED'], BOARDED: ['ARRIVED'], ARRIVED: ['RETURNED'] };
const STEP_LABEL: Record<string, string> = { BOARDED: 'Boarded', ARRIVED: 'Arrived', RETURNED: 'Back home', READY: 'Mark travel ready', DEPARTED: 'Record departure' };
const STATUS_LABEL: Record<string, string> = { PLANNED: 'Planned', BOARDED: 'On board', ARRIVED: 'Arrived', RETURNED: 'Back home', CANCELLED: 'Not travelling' };

/**
 * On the day: the trip record shared with Club operations, team milestones and each
 * passenger's boarding. Staff record these; families see the latest status.
 */
export function TravelDay({ plan, busy, command }: { plan: Plan; busy: boolean; command: (path: string, extra?: Record<string, unknown>) => Promise<boolean> }) {
    const [absent, setAbsent] = useState<number | null>(null);
    const [reason, setReason] = useState('');
    const reasonId = useId();
    const travel = plan.rights.travel;
    return (
        <Section title="On the day" hint={plan.trip ? `Trip ${plan.trip.status.toLowerCase().replaceAll('_', ' ')}` : undefined}
            action={plan.trip ? { label: 'Open the travel record', to: `/clubs/${plan.club_id}/workspace?tab=travel&record=${plan.trip.id}` } : undefined}>
            {!plan.trip ? (
                <EmptyNote title="Travel records not connected" action={travel ? <Button size="sm" disabled={busy} onClick={() => void command('connect-trip')}>Connect travel records</Button> : undefined}>
                    Connect the published itinerary to a trip so boarding and arrival can be recorded on the day.
                </EmptyNote>
            ) : (
                <>
                    <div className="gk-row gk-plan-wrap">
                        {plan.trip.transitions.filter(step => ['READY', 'DEPARTED', 'RETURNED'].includes(step)).map(step => (
                            <Button key={step} size="sm" disabled={busy || !travel} onClick={() => void command('milestones', { status: step, note: 'Recorded from the journey plan.' })}>{step === 'RETURNED' ? 'Record team return' : STEP_LABEL[step]}</Button>
                        ))}
                        {travel && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void command('connect-trip')}>Update connection</Button>}
                    </div>
                    <List label="Passengers" className="gk-plan-list">
                        {plan.passengers.map(passenger => (
                            <li key={passenger.id}>
                                <div className="gk-list-row">
                                    <span className="gk-list-row__main"><span className="gk-list-row__title">{passenger.name}</span></span>
                                    <span className="gk-list-row__trail">
                                        <Badge tone={passenger.status === 'CANCELLED' ? 'danger' : passenger.status === 'PLANNED' ? 'neutral' : 'accent'}>{STATUS_LABEL[passenger.status] ?? passenger.status.toLowerCase()}</Badge>
                                        {travel && (NEXT[passenger.status] ?? []).map(step => <Button key={step} size="sm" disabled={busy} onClick={() => void command('passengers', { passengerId: passenger.id, status: step })}>{STEP_LABEL[step]}</Button>)}
                                        {travel && passenger.status === 'PLANNED' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setAbsent(passenger.id)}>Not travelling</Button>}
                                    </span>
                                </div>
                                {absent === passenger.id && (
                                    <form className="gk-plan-editor" onSubmit={event => { event.preventDefault(); void command('passengers', { passengerId: passenger.id, status: 'CANCELLED', note: reason }); setAbsent(null); setReason(''); }}>
                                        <Field label="Reason" htmlFor={reasonId}><input id={reasonId} className="gk-input" required maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} /></Field>
                                        <div className="gk-plan-editor__actions"><Button type="submit" size="sm" variant="primary">Record absence</Button><Button size="sm" variant="ghost" onClick={() => setAbsent(null)}>Cancel</Button></div>
                                    </form>
                                )}
                            </li>
                        ))}
                    </List>
                    {!plan.passengers.length && <p className="gk-faint">No passengers on the trip yet. Update the connection after choosing players.</p>}
                </>
            )}
        </Section>
    );
}
