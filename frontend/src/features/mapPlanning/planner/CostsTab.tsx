import { useId, useRef, useState, useSyncExternalStore } from 'react';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Button, EmptyNote, Field, List, Section, StatTile } from '../../../design/primitives';
import { dateTime, money, type Plan, type PlanArrangement, type PlanContext, type PlanDraft } from '../api';
import { getAuthSessionId, subscribeAuthSession } from '../../../utils/authStorage';

const KINDS: Record<PlanArrangement['kind'], string> = { TRANSPORT: 'Transport', ACCOMMODATION: 'Accommodation', MEALS: 'Meals', VENUE: 'Venue', OTHER: 'Other' };
const SUPPLIER: Record<string, { label: string; tone: 'accent' | 'warning' | 'danger' | 'neutral' }> = { CONFIRMED: { label: 'Confirmed', tone: 'accent' }, PENDING: { label: 'Awaiting reply', tone: 'warning' }, DECLINED: { label: 'Declined', tone: 'danger' }, REVIEW_REQUIRED: { label: 'Needs review', tone: 'warning' } };

function ArrangementForm({ value: initial, draft, context, squad, onSave, onCancel, onRemove }: {
    value: PlanArrangement; draft: PlanDraft; context?: PlanContext; squad: number; onSave: (value: PlanArrangement) => void; onCancel: () => void; onRemove?: () => void;
}) {
    const [value, setValue] = useState(initial);
    const ids = { title: useId(), kind: useId(), amount: useId(), place: useId(), notes: useId(), finance: useId() };
    return (
        <form className="gk-plan-editor" onSubmit={event => { event.preventDefault(); if (value.title.trim()) onSave(value); }}>
            <Field label="Arrangement" htmlFor={ids.title}><input id={ids.title} className="gk-input" required maxLength={160} value={value.title} placeholder="Minibus hire, 20 seats" onChange={event => setValue({ ...value, title: event.target.value })} /></Field>
            <div className="gk-plan-grid">
                <Field label="Kind" htmlFor={ids.kind}><select id={ids.kind} className="gk-input" value={value.kind} onChange={event => setValue({ ...value, kind: event.target.value as PlanArrangement['kind'] })}>{Object.entries(KINDS).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></Field>
                <Field label={`Estimate (${draft.currency})`} htmlFor={ids.amount}><input id={ids.amount} className="gk-input" type="number" min={0} step="0.01" required value={value.amountMinor / 100} onChange={event => setValue({ ...value, amountMinor: Math.round(Number(event.target.value) * 100) })} /></Field>
            </div>
            <Field label="Place" htmlFor={ids.place}><select id={ids.place} className="gk-input" value={value.placeKey ?? ''} onChange={event => setValue({ ...value, placeKey: event.target.value || null })}><option value="">No place</option>{draft.places.map(place => <option key={place.key} value={place.key}>{place.name}</option>)}</select></Field>
            <Field label="Terms and notes" htmlFor={ids.notes}><textarea id={ids.notes} className="gk-input" rows={2} maxLength={2000} value={value.notes} onChange={event => setValue({ ...value, notes: event.target.value })} /></Field>
            <Field label="Finance record" htmlFor={ids.finance} hint="Approval and payment stay in Finance.">
                <select id={ids.finance} className="gk-input" value={value.financeRecordId ?? ''} onChange={event => setValue({ ...value, financeRecordId: event.target.value ? Number(event.target.value) : null })}>
                    <option value="">Not linked</option>
                    {value.financeRecordId && !context?.financeRecords?.some(record => record.id === value.financeRecordId) && <option value={value.financeRecordId}>Linked record (finance access needed)</option>}
                    {context?.financeRecords?.filter(record => record.squad_id === squad).map(record => <option key={record.id} value={record.id}>{record.title} · {record.status.toLowerCase().replaceAll('_', ' ')}</option>)}
                </select>
            </Field>
            <div className="gk-plan-editor__actions">
                <Button type="submit" variant="primary" size="sm">Keep arrangement</Button>
                <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
                {onRemove && <Button size="sm" variant="danger" className="gk-plan-editor__remove" onClick={onRemove}>Remove</Button>}
            </div>
        </form>
    );
}

function EvidenceForm({ onSubmit, onSaved, busy }: { onSubmit: (status: string, source: string, evidence: string) => Promise<boolean>; onSaved: () => void; busy: boolean }) {
    const ids = { status: useId(), source: useId(), evidence: useId() };
    const [status, setStatus] = useState('CONFIRMED'), [source, setSource] = useState(''), [evidence, setEvidence] = useState('');
    const [submitting, setSubmitting] = useState(false), [unconfirmed, setUnconfirmed] = useState(false);
    const pending = useRef(false);
    const locked = busy || submitting;
    const submit = async () => {
        if (busy || pending.current) return;
        pending.current = true; setSubmitting(true); setUnconfirmed(false);
        try { if (await onSubmit(status, source, evidence)) onSaved(); else setUnconfirmed(true); }
        catch { setUnconfirmed(true); }
        finally { pending.current = false; setSubmitting(false); }
    };
    return (
        <form className="gk-plan-editor" onSubmit={event => { event.preventDefault(); void submit(); }}>
            <Field label="Supplier’s answer" htmlFor={ids.status}><select id={ids.status} className="gk-input" disabled={locked} value={status} onChange={event => setStatus(event.target.value)}><option value="CONFIRMED">Confirmed</option><option value="PENDING">Awaiting reply</option><option value="DECLINED">Declined</option></select></Field>
            <Field label="Who confirmed, and when" htmlFor={ids.source}><input id={ids.source} className="gk-input" disabled={locked} required maxLength={160} value={source} placeholder="Supplier contact, date" onChange={event => setSource(event.target.value)} /></Field>
            <Field label="Reference or evidence" htmlFor={ids.evidence}><textarea id={ids.evidence} className="gk-input" disabled={locked} required rows={2} maxLength={2000} value={evidence} onChange={event => setEvidence(event.target.value)} /></Field>
            <div className="gk-plan-editor__actions"><Button type="submit" size="sm" variant="primary" disabled={locked} aria-busy={submitting}>{submitting ? 'Recording…' : 'Record the answer'}</Button></div>
            {unconfirmed && <p className="gk-field__error" role="alert">Saving wasn’t confirmed. Your entries are kept here.</p>}
        </form>
    );
}

/** Estimates against the budget, supplier answers and finance approval, each kept as its own record. */
interface CostsProps {
    draft: PlanDraft; plan: Plan | null; context?: PlanContext; squad: number; canEdit: boolean; busy: boolean; dirty: boolean;
    change: (patch: Partial<PlanDraft>) => void; command: (path: string, extra?: Record<string, unknown>) => Promise<boolean>;
}
export function CostsTab(props: CostsProps) {
    const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    return <CostsEditor key={JSON.stringify([session, props.plan?.id ?? null])} {...props} />;
}

function CostsEditor({ draft, plan, context, squad, canEdit, busy, dirty, change, command }: CostsProps) {
    const [editing, setEditing] = useState<PlanArrangement | null>(null);
    const [evidence, setEvidence] = useState<string | null>(null);
    const budgetId = useId(), currencyId = useId();
    const total = draft.arrangements.reduce((sum, item) => sum + item.amountMinor, 0);
    const over = total > draft.budgetMinor;
    const save = (value: PlanArrangement) => { change({ arrangements: draft.arrangements.some(item => item.key === value.key) ? draft.arrangements.map(item => item.key === value.key ? value : item) : [...draft.arrangements, value] }); setEditing(null); };
    return (
        <div className="gk-plan-body">
            <div className="gk-stats">
                <StatTile label="Estimated" value={money(total, draft.currency)} tone={over ? 'attention' : undefined} hint={draft.budgetMinor ? `${money(Math.abs(draft.budgetMinor - total), draft.currency)} ${over ? 'over budget' : 'left'}` : 'No budget set'} />
                <StatTile label="Approval" value={total === 0 ? '—' : plan?.budgetApproved && !dirty ? 'Approved' : 'Pending'} tone={plan?.budgetApproved && !dirty ? 'good' : undefined} hint={total === 0 ? 'Nothing to approve' : 'By someone with finance access'} />
            </div>
            <div className="gk-plan-grid">
                <Field label="Budget" htmlFor={budgetId}><input id={budgetId} className="gk-input" type="number" min={0} step="0.01" disabled={!canEdit} value={draft.budgetMinor / 100} onChange={event => change({ budgetMinor: Math.round(Number(event.target.value) * 100) })} /></Field>
                <Field label="Currency" htmlFor={currencyId}><select id={currencyId} className="gk-input" disabled={!canEdit} value={draft.currency} onChange={event => change({ currency: event.target.value })}>{[...new Set([draft.currency, 'GEL', 'EUR', 'USD', 'GBP'])].map(code => <option key={code}>{code}</option>)}</select></Field>
            </div>
            {plan?.rights.finance && !plan.budgetApproved && total > 0 && (
                <Button disabled={busy || dirty} onClick={() => void command('approve-budget', { note: 'Reviewed from the journey plan.' })}>Approve these costs</Button>
            )}
            <Section title="Arrangements" action={canEdit && !editing ? <Button size="sm" onClick={() => setEditing({ key: crypto.randomUUID(), title: '', kind: 'TRANSPORT', amountMinor: 0, placeKey: null, notes: '', financeRecordId: null })}><Plus aria-hidden="true" />Add arrangement</Button> : undefined}>
                {editing && !draft.arrangements.some(item => item.key === editing.key) && <ArrangementForm value={editing} draft={draft} context={context} squad={squad} onSave={save} onCancel={() => setEditing(null)} />}
                {draft.arrangements.length ? (
                    <List label="Arrangements" className="gk-plan-list">
                        {draft.arrangements.map(item => {
                            const supplier = plan?.suppliers[item.key];
                            return (
                                <li key={item.key}>
                                    <button type="button" className="gk-list-row" disabled={!canEdit} onClick={() => setEditing(item)}>
                                        <span className="gk-list-row__main"><span className="gk-list-row__title">{item.title}</span><span className="gk-list-row__meta">{[KINDS[item.kind], draft.places.find(place => place.key === item.placeKey)?.name, item.notes].filter(Boolean).join(' · ') || 'No terms recorded'}</span></span>
                                        <span className="gk-list-row__trail"><Badge tone={SUPPLIER[supplier?.status ?? '']?.tone ?? 'neutral'}>{SUPPLIER[supplier?.status ?? '']?.label ?? 'No supplier answer'}</Badge><span className="gk-num gk-plan-amount">{money(item.amountMinor, draft.currency)}</span></span>
                                    </button>
                                    {editing?.key === item.key && <ArrangementForm value={item} draft={draft} context={context} squad={squad} onSave={save} onCancel={() => setEditing(null)} onRemove={() => { change({ arrangements: draft.arrangements.filter(other => other.key !== item.key) }); setEditing(null); }} />}
                                    <div className="gk-plan-arrangement-foot">
                                        {supplier && <span className="gk-faint">{supplier.source} · {dateTime(supplier.at, draft.timezone)}</span>}
                                        {plan?.rights.travel && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEvidence(evidence === item.key ? null : item.key)}>Record supplier answer</Button>}
                                        {item.financeRecordId && plan && <Link className="gk-section__action" to={`/clubs/${plan.club_id}/workspace?tab=finance&record=${item.financeRecordId}`}>Finance record</Link>}
                                    </div>
                                    {evidence === item.key && <EvidenceForm busy={busy} onSubmit={(status, source, text) => command('supplier', { arrangementKey: item.key, status, source, evidence: text })} onSaved={() => setEvidence(null)} />}
                                </li>
                            );
                        })}
                    </List>
                ) : !editing && <EmptyNote title="No arrangements yet">Transport, meals, a hotel or an entry fee. Estimates only; nothing is booked or paid from here.</EmptyNote>}
            </Section>
        </div>
    );
}
