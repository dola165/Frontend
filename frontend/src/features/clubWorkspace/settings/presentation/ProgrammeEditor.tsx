import { ChevronDown, Trash2 } from 'lucide-react';
import { Badge, Button, Chip, Field } from '../../../../design/primitives';
import type { TrainingProgramme } from '../../../clubs/presentation';
import '../../club-workspace.css';
import './presentation.css';

const fees = [['trialAmount', 'Trial session fee'], ['joiningFee', 'Joining fee'], ['equipmentFee', 'Equipment fee']] as const;
const periods: Record<TrainingProgramme['billingPeriod'], string> = { MONTH: 'per month', SESSION: 'per session', TERM: 'per term', YEAR: 'per year', ONE_OFF: 'one-off' };

/** A one-line description of a programme for its collapsed row: ages, sessions and price. */
function summary(p: TrainingProgramme) {
    const ages = p.ageMin != null && p.ageMax != null ? `Ages ${p.ageMin}–${p.ageMax}` : p.ageMin != null ? `Ages ${p.ageMin}+` : p.ageMax != null ? `Up to age ${p.ageMax}` : 'All ages';
    const sessions = p.sessionsPerWeek ? `${p.sessionsPerWeek} ${p.sessionsPerWeek === 1 ? 'session' : 'sessions'} a week` : null;
    const price = p.priceType === 'FREE' ? 'Free' : p.priceType === 'VARIES' ? 'Price varies' : p.priceType === 'UNPUBLISHED' ? 'Fees hidden'
        : p.amount ? `${p.amount} ${p.currency} ${periods[p.billingPeriod]}`.trim() : 'Price not set';
    return [ages, sessions, price].filter(Boolean).join(' · ');
}

/**
 * One training programme as a row that opens for editing: who it is for and how often, its price, optional
 * extra fees and dates, the squads it covers and whether it is published. New programmes open straight away.
 */
export function ProgrammeEditor({ programme: p, index, squads, onChange, onRemove }: {
    programme: TrainingProgramme; index: number; squads: { id: number; name: string }[];
    onChange: (value: Partial<TrainingProgramme>) => void; onRemove: () => void;
}) {
    const id = (key: string) => `programme-${index}-${key}`;
    const extras = fees.some(([key]) => p[key] != null) || Boolean(p.validFrom || p.validUntil || p.details);
    const name = p.name || `Programme ${index + 1}`;
    return <section className="pp-item" aria-label={`Programme ${index + 1}`}><details open={!p.id || undefined}>
        <summary className="pp-item__summary">
            <span className="pp-item__main"><span className="pp-item__name">{name}</span><span className="pp-item__meta">{summary(p)}</span></span>
            <span className="pp-item__trail"><Badge tone={p.published ? 'accent' : 'neutral'}>{p.published ? 'Published' : 'Not published'}</Badge><ChevronDown aria-hidden="true" className="pp-item__chevron" /></span>
        </summary>
        <div className="pp-item__body">
            <div className="pp-group">
                <h4 className="pp-group__title">Who it is for</h4>
                <div className="rec-fields">
                    <Field label="Programme name" htmlFor={id('name')}><input id={id('name')} className="gk-input" required maxLength={120} value={p.name} onChange={e => onChange({ name: e.target.value })} /></Field>
                    <Field label="Sessions per week" hint="Optional" htmlFor={id('sessions')}><input id={id('sessions')} className="gk-input" type="number" min={1} max={14} value={p.sessionsPerWeek ?? ''} onChange={e => onChange({ sessionsPerWeek: e.target.value ? Number(e.target.value) : null })} /></Field>
                    <Field label="Minimum age" hint="Optional" htmlFor={id('min')}><input id={id('min')} className="gk-input" type="number" min={0} max={99} value={p.ageMin ?? ''} onChange={e => onChange({ ageMin: e.target.value ? Number(e.target.value) : null })} /></Field>
                    <Field label="Maximum age" hint="Optional" htmlFor={id('max')}><input id={id('max')} className="gk-input" type="number" min={p.ageMin ?? 0} max={99} value={p.ageMax ?? ''} onChange={e => onChange({ ageMax: e.target.value ? Number(e.target.value) : null })} /></Field>
                </div>
            </div>
            <div className="pp-group">
                <h4 className="pp-group__title">Price</h4>
                <div className="rec-fields">
                    <Field label="Price status" htmlFor={id('price')}><select id={id('price')} className="gk-input" value={p.priceType} onChange={e => onChange({ priceType: e.target.value as TrainingProgramme['priceType'], amount: null })}>
                        <option value="FIXED">Fixed price</option><option value="FREE">Free training</option><option value="VARIES">Price varies</option><option value="UNPUBLISHED">Hide fees</option></select></Field>
                    {p.priceType === 'FIXED' && <Field label="Training amount" htmlFor={id('amount')}><input id={id('amount')} className="gk-input" required type="number" min="0.01" max="9999999999.99" step="0.01" value={p.amount ?? ''} onChange={e => onChange({ amount: e.target.value || null })} /></Field>}
                    <Field label="Currency" htmlFor={id('currency')}><select id={id('currency')} className="gk-input" required={p.priceType !== 'UNPUBLISHED' || p.trialAmount !== null || p.joiningFee !== null || p.equipmentFee !== null} value={p.currency} onChange={e => onChange({ currency: e.target.value })}>
                        <option value="">Choose currency</option>{Array.from(new Set(['GEL', 'EUR', 'GBP', 'USD', p.currency])).filter(Boolean).map(c => <option key={c}>{c}</option>)}</select></Field>
                    <Field label="Billing period" htmlFor={id('period')}><select id={id('period')} className="gk-input" value={p.billingPeriod} onChange={e => onChange({ billingPeriod: e.target.value as TrainingProgramme['billingPeriod'] })}>
                        <option value="MONTH">Per month</option><option value="SESSION">Per session</option><option value="TERM">Per term</option><option value="YEAR">Per year</option><option value="ONE_OFF">One-off</option></select></Field>
                </div>
                <details className="rec-disclosure" open={extras || undefined}>
                    <summary>Extra fees, dates and what is included</summary>
                    <div className="rec-disclosure__body">
                        <p className="rec-hint">Fees use the currency above. Enter 0 for no charge; leave a fee empty when it is not published.</p>
                        <div className="rec-fields">
                            {fees.map(([key, text]) => <Field key={key} label={text} hint="Optional" htmlFor={id(key)}><input id={id(key)} className="gk-input" type="number" min="0" max="9999999999.99" step="0.01" value={p[key] ?? ''} onChange={e => onChange({ [key]: e.target.value || null })} /></Field>)}
                            <Field label="Fee valid from" hint="Optional" htmlFor={id('from')}><input id={id('from')} type="date" className="gk-input" value={p.validFrom ?? ''} onChange={e => onChange({ validFrom: e.target.value || null, squadIds: p.squadIds ?? [] })} /></Field>
                            <Field label="Fee valid until" hint="Optional" htmlFor={id('until')}><input id={id('until')} type="date" min={p.validFrom ?? undefined} className="gk-input" value={p.validUntil ?? ''} onChange={e => onChange({ validUntil: e.target.value || null, squadIds: p.squadIds ?? [] })} /></Field>
                            <div className="rec-wide"><Field label="What is included and practical information" hint="Optional" htmlFor={id('details')}><textarea id={id('details')} className="gk-input" rows={3} maxLength={2000} value={p.details ?? ''} onChange={e => onChange({ details: e.target.value || null })} /></Field></div>
                        </div>
                    </div>
                </details>
            </div>
            <div className="pp-group">
                <fieldset className="cw-scope"><legend className="pp-group__title">Squads in this programme</legend>
                    {squads.length ? <div className="gk-chips">{squads.map(s => { const on = p.squadIds?.includes(s.id) ?? false; return <Chip key={s.id} pressed={on} onClick={() => onChange({ squadIds: on ? (p.squadIds ?? []).filter(x => x !== s.id) : [...(p.squadIds ?? []), s.id] })}>{s.name}</Chip>; })}</div>
                        : <p className="rec-hint">No squads yet.</p>}
                    <p className="gk-field__hint">Linked squads show their training days and times so families can compare. Create separate programmes when fees differ.</p>
                </fieldset>
                <label className="rec-switch"><span><strong>Publish programme</strong><span>Shown on the club profile once saved.</span></span><input type="checkbox" className="gk-switch" checked={p.published} onChange={e => onChange({ published: e.target.checked })} /></label>
            </div>
            <div className="pp-item__foot"><Button size="sm" variant="ghost" className="pp-danger" onClick={onRemove}><Trash2 aria-hidden="true" />Remove {p.name ? `“${p.name}”` : 'programme'}</Button></div>
        </div>
    </details></section>;
}
