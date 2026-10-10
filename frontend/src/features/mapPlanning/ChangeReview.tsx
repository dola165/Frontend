import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Button, List, ListRow } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { dateTime, planGet, planPost, type Plan, type PlanDraft } from './api';

interface Proposal {
    revision: number; fingerprint: string; draft: PlanDraft;
    changes: { activity: string; oldStart: string; newStart: string; oldEnd: string; newEnd: string; location: string }[];
    consequences: string[];
}

/**
 * When a linked fixture or session moves, this shows the change and what follows from it,
 * and applies it to the draft only when the coach agrees. Nothing is published.
 */
export function ChangeReview({ plan, busy, onApplied }: { plan: Plan; busy: boolean; onApplied: (plan: Plan) => void }) {
    const [proposal, setProposal] = useState<Proposal | null>(null);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState('');
    const zone = plan.draft.timezone;
    const load = async () => {
        setWorking(true); setError('');
        try { setProposal(await planGet<Proposal>(`/${plan.id}/changes`)); }
        catch (cause) { setError(extractApiErrorMessage(cause, 'The schedule changes could not load.')); }
        finally { setWorking(false); }
    };
    const apply = async () => {
        if (!proposal) return;
        setWorking(true); setError('');
        try { onApplied(await planPost(`/${plan.id}/apply-changes`, { revision: proposal.revision, fingerprint: proposal.fingerprint })); setProposal(null); }
        catch (cause) { setError(extractApiErrorMessage(cause, 'These changes are no longer current. Review them again.')); }
        finally { setWorking(false); }
    };
    return (
        <>
            <Button size="sm" disabled={busy || working} onClick={() => void load()}><RefreshCw aria-hidden="true" />{working && !proposal ? 'Checking the calendar…' : 'Review schedule changes'}</Button>
            {error && !proposal && <p className="gk-field__error" role="alert">{error}</p>}
            <Dialog open={Boolean(proposal)} title="Schedule changes" description="The draft and the version families have stay as they are until you apply." onClose={() => setProposal(null)}
                footer={<><Button variant="ghost" onClick={() => setProposal(null)}>Keep the draft</Button><Button variant="primary" disabled={working || !proposal?.changes.length} onClick={() => void apply()}>Apply to the draft</Button></>}>
                {proposal?.changes.length ? (
                    <List label="Changes">
                        {proposal.changes.map((change, index) => <ListRow key={index} title={change.activity} meta={`${dateTime(change.oldStart, zone)} → ${dateTime(change.newStart, zone)}${change.location ? ` · ${change.location}` : ''}`} />)}
                    </List>
                ) : <p className="gk-muted">No timing or ground change can be applied. A cancelled or missing entry needs replacing or removing by hand.</p>}
                {proposal && proposal.consequences.length > 0 && <ul className="gk-plan-consequences">{proposal.consequences.map(item => <li key={item}>{item}</li>)}</ul>}
                {error && <div className="gk-notice gk-notice--danger" role="alert">{error}</div>}
                <p className="gk-faint">Applying does not confirm suppliers, approve costs or publish to families.</p>
            </Dialog>
        </>
    );
}
