import { useState } from 'react';
import { CheckCircle2, CircleAlert, Eye } from 'lucide-react';
import { Badge, Button, EmptyNote, List, ListRow, Section, StatTile } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { dateTime, type Plan, type PlanDraft } from '../api';
import { ChangeReview } from '../ChangeReview';
import { familyChanges, publishChecks } from './changes';
import { draftStops, stopClock } from './itinerary';
import { replySummary } from './replies';

/**
 * Sharing the journey with families: what has changed since they last saw it, the checks,
 * the replies so far, and publishing a new version. Publishing is the region's one action.
 */
export function ShareTab({ draft, plan, dirty, busy, command, received, onPreview }: {
    draft: PlanDraft; plan: Plan | null; dirty: boolean; busy: boolean;
    command: (path: string, extra?: Record<string, unknown>) => Promise<boolean>; received: (plan: Plan) => void; onPreview: (source: 'draft' | 'journey') => void;
}) {
    const [confirm, setConfirm] = useState(false);
    if (!plan) return <div className="gk-plan-body"><EmptyNote title="Save the plan first">Once it is saved to your club you can check it and share it with families.</EmptyNote></div>;
    const shared = plan.published_version > 0;
    const changes = shared ? familyChanges(plan.published, draft) : [];
    const checks = publishChecks(draft);
    const missing = checks.filter(check => !check.ok);
    const blocking = plan.issues.filter(issue => issue.severity === 'BLOCKING');
    const replies = shared ? replySummary(plan) : null;
    const publishedAt = plan.history.find(entry => entry.action === 'PUBLISHED')?.created_at;
    const canPublish = plan.rights.publish && !dirty && !busy && !blocking.length && (!shared || changes.length > 0 || plan.published_revision !== plan.revision);
    const stops = draftStops(draft).filter(stop => stop.kind === 'activity');
    return (
        <div className="gk-plan-body">
            <Section title={shared ? `Families have version ${plan.published_version}` : 'Not shared yet'}
                action={<Button size="sm" variant="ghost" onClick={() => onPreview(shared ? 'journey' : 'draft')}><Eye aria-hidden="true" />{shared ? 'What they see' : 'Preview'}</Button>}>
                {shared && publishedAt && <p className="gk-faint">Published {dateTime(publishedAt, draft.timezone)}</p>}
                {shared ? (
                    changes.length ? (
                        <div className="gk-plan-changes">
                            <p><Badge tone="warning">{changes.length} {changes.length === 1 ? 'change' : 'changes'} not shared</Badge></p>
                            <ul>{changes.map(item => <li key={item}>{item}</li>)}</ul>
                        </div>
                    ) : <p className="gk-muted">Families have the latest itinerary. Private notes and costs are never shared.</p>
                ) : <p className="gk-muted">This plan is private to the planning staff. Families see it, and can reply, once you publish.</p>}
            </Section>
            {replies && (
                <Section title="Replies" hint={`${replies.players} players`}>
                    <div className="gk-stats">
                        <StatTile label="Going" value={replies.GOING} tone="good" />
                        <StatTile label="Can’t go" value={replies.NOT_GOING} />
                        <StatTile label="No reply yet" value={replies.PENDING + replies.RECONFIRM} tone={replies.PENDING + replies.RECONFIRM ? 'attention' : undefined} hint={replies.RECONFIRM ? `${replies.RECONFIRM} asked again after a change` : undefined} />
                    </div>
                    {replies.families > 0 && <p className="gk-faint">{replies.read} of {replies.families} families have read this version · {replies.permitted} gave travel permission</p>}
                </Section>
            )}
            <Section title="Before you publish">
                <ul className="gk-plan-checks">
                    {checks.map(check => <li key={check.label} data-ok={check.ok || undefined}>{check.ok ? <CheckCircle2 aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}{check.label}</li>)}
                    {plan.issues.map((issue, index) => <li key={`${issue.code}-${index}`} data-blocking={issue.severity === 'BLOCKING' || undefined}><CircleAlert aria-hidden="true" />{issue.message}</li>)}
                </ul>
                {plan.rights.edit && plan.issues.some(issue => issue.code === 'SCHEDULE_CHANGED') && <ChangeReview plan={plan} busy={busy || dirty} onApplied={received} />}
            </Section>
            <div className="gk-plan-publish">
                <Button variant="primary" disabled={!canPublish} onClick={() => setConfirm(true)}>{shared ? `Publish version ${plan.published_version + 1}` : 'Publish to families'}</Button>
                {plan.rights.edit && <Button variant="ghost" disabled={busy || dirty} onClick={() => void command('request-review', { note: 'Please review this journey, its costs and what families will see.' })}>Ask a colleague to review</Button>}
                <p className="gk-faint">{!plan.rights.publish ? 'A colleague with family coordination access publishes this plan.' : dirty ? 'Save your changes before publishing.' : blocking.length ? 'Resolve the blocking checks first.' : shared && !changes.length && plan.published_revision === plan.revision ? 'Nothing new to publish.' : missing.length ? `${missing.length} ${missing.length === 1 ? 'check is' : 'checks are'} open. You can still publish.` : 'Families are notified and asked to reply.'}</p>
            </div>
            {plan.history.length > 0 && (
                <details className="gk-plan-more">
                    <summary>History</summary>
                    <List label="History">{plan.history.map(entry => <ListRow key={entry.id} title={entry.action.toLowerCase().replaceAll('_', ' ').replace(/^\w/, c => c.toUpperCase())} meta={`${entry.actor} · ${dateTime(entry.created_at, draft.timezone)}${entry.note ? ` · ${entry.note}` : ''}`} />)}</List>
                </details>
            )}
            <Dialog open={confirm} title={shared ? `Publish version ${plan.published_version + 1}?` : 'Publish to families?'} onClose={() => setConfirm(false)}
                description="Families of the chosen players get the itinerary in their schedule and are asked to reply. Changed details start a new version and a new travel permission request."
                footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>Keep editing</Button><Button variant="primary" disabled={busy} onClick={() => void command('publish').then(ok => { if (ok) setConfirm(false); })}>{busy ? 'Publishing…' : 'Publish'}</Button></>}>
                <dl className="gk-plan-facts">
                    <dt>When</dt><dd>{dateTime(draft.startsAt, draft.timezone)} – {dateTime(draft.endsAt, draft.timezone)}</dd>
                    <dt>Meet</dt><dd>{draft.meetingPoint || 'Not set'}</dd>
                    <dt>Collect</dt><dd>{draft.collectionPoint || 'Not set'}</dd>
                    <dt>Contact</dt><dd>{draft.supervisionContact || 'Not set'}</dd>
                    <dt>Players</dt><dd>{draft.participants.length}</dd>
                </dl>
                {stops.length > 0 && <ul className="gk-plan-mini">{stops.map(stop => <li key={stop.id}><span className="gk-num">{stopClock(stop.startsAt, draft.timezone).time}</span>{stop.title}</li>)}</ul>}
                {changes.length > 0 && <p className="gk-muted">{changes.length} {changes.length === 1 ? 'change' : 'changes'} since version {plan.published_version}.</p>}
            </Dialog>
        </div>
    );
}
