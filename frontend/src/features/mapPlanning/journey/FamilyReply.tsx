import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Badge, Button, Section } from '../../../design/primitives';
import { dateTime, permissionDecision, planPost, type FamilyPlan } from '../api';

const RESPONSE: Record<string, string> = { GOING: 'Going', NOT_GOING: 'Not going', RECONFIRMATION_REQUIRED: 'Please confirm the updated journey' };

/**
 * A family's or player's answers for one published version: going or not, "I have read
 * it", and the separate travel permission. Each is its own request; none implies another.
 */
export function FamilyReply({ journey: p, busy, act }: { journey: FamilyPlan; busy: boolean; act: (run: () => Promise<unknown>) => Promise<void> }) {
    const [now, setNow] = useState(Date.now);
    useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
    const travelAt = p.travel.passenger?.updated_at || p.travel.updated_at;
    const stale = travelAt && p.travel.status === 'DEPARTED' && now - Date.parse(travelAt) > 3600000;
    const player = p.viewer === 'PLAYER';
    const permission = p.permission, permissionId = p.permission_id;
    const reply = (response: 'GOING' | 'NOT_GOING') => act(() => player
        ? planPost(`/${p.plan_id}/my-response`, { version: p.version, response })
        : planPost(`/${p.plan_id}/journey-response`, { version: p.version, subjectId: p.child_id, response }));
    return (
        <Section title={player ? 'Your reply' : `${p.child_name}’s reply`} hint={`Version ${p.version}`}>
            <div className="gk-plan-reply">
                <p role="status"><Badge tone={p.response?.status === 'GOING' ? 'accent' : p.response?.status === 'NOT_GOING' ? 'danger' : 'warning'}>{RESPONSE[p.response?.status ?? ''] ?? 'Waiting for your reply'}</Badge>{player && p.response?.acknowledged && <span className="gk-faint"> · Update read</span>}</p>
                {p.canRespond ? (
                    <div className="gk-row gk-plan-wrap">
                        <Button variant="primary" disabled={busy || p.response?.status === 'GOING'} onClick={() => void reply('GOING')}>{player ? 'I’m going' : 'Going'}</Button>
                        <Button disabled={busy || p.response?.status === 'NOT_GOING'} onClick={() => void reply('NOT_GOING')}>{player ? 'I can’t go' : 'Can’t go'}</Button>
                    </div>
                ) : <p className="gk-faint">Replies are closed for this version, or need a guardian. Contact the supervision lead if something changed.</p>}
                <p className="gk-faint">Attendance is for the whole journey. Boarding and arrival are recorded by staff on the day.</p>
            </div>
            {player ? (!p.response?.acknowledged && <Button disabled={busy} onClick={() => void act(() => planPost(`/${p.plan_id}/my-response`, { version: p.version, response: 'READ' }))}>I have read this itinerary</Button>) : (
                <>
                    <div className="gk-plan-reply">
                        <p className="gk-plan-reply__title">Read the update</p>
                        {p.acknowledged_at ? <p className="gk-plan-ok"><Check aria-hidden="true" />Read {dateTime(p.acknowledged_at, p.itinerary.timezone)}</p>
                            : <Button disabled={busy} onClick={() => void act(() => planPost(`/${p.plan_id}/acknowledge`, { version: p.version, childId: p.child_id }))}>I have read this itinerary</Button>}
                    </div>
                    <div className="gk-plan-reply">
                        <p className="gk-plan-reply__title">Travel permission <Badge>{permission ? permission.status.toLowerCase().replaceAll('_', ' ') : 'Not recorded'}</Badge></p>
                        {typeof permission?.data?.wording === 'string' && <p className="gk-muted">{permission.data.wording}</p>}
                        {!permission && <p className="gk-muted">Ask the club to record the travel permission. Reading or replying to this itinerary does not grant it.</p>}
                        <div className="gk-row gk-plan-wrap">
                            {permission && permissionId != null && permission.transitions.filter(step => ['GRANTED', 'DECLINED', 'REVOKED'].includes(step)).map(step => (
                                <Button key={step} variant={step === 'GRANTED' ? 'primary' : 'secondary'} disabled={busy} onClick={() => void act(() => permissionDecision(p.club_id, permissionId, permission.revision, step))}>
                                    {step === 'GRANTED' ? 'Give travel permission' : step === 'REVOKED' ? 'Withdraw permission' : 'Decline permission'}
                                </Button>
                            ))}
                        </div>
                    </div>
                </>
            )}
            <div className="gk-plan-reply">
                <p className="gk-plan-reply__title">Travel status</p>
                <p>{(p.travel.passenger?.status || p.travel.status).toLowerCase().replaceAll('_', ' ')}{p.travel.source ? ` · ${p.travel.source}` : ''}{travelAt ? ` · updated ${dateTime(travelAt, p.itinerary.timezone)}` : ''}</p>
                {stale && <p className="gk-faint">No staff update for over an hour. Contact the supervision lead if you need help.</p>}
            </div>
        </Section>
    );
}
