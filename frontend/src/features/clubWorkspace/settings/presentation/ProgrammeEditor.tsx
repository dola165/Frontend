import { Trash2 } from 'lucide-react';
import { Button, Chip, Field, Panel } from '../../../../design/primitives';
import type { TrainingProgramme } from '../../../clubs/presentation';
import '../../club-workspace.css';

const fees = [['trialAmount', 'Trial session fee'], ['joiningFee', 'Joining fee'], ['equipmentFee', 'Equipment fee']] as const;

/** One training programme: who it is for, how often, what it costs and which squads it covers. */
export function ProgrammeEditor({ programme: p, index, squads, onChange, onRemove }: {
    programme: TrainingProgramme; index: number; squads: { id: number; name: string }[];
    onChange: (value: Partial<TrainingProgramme>) => void; onRemove: () => void;
}) {
    const id = (key: string) => `programme-${index}-${key}`;
    const optional = <span className="rec-optional"> (optional)</span>;
    return <section aria-label={`Programme ${index + 1}`}>
        <Panel flush title={p.name ? `${p.name}` : `Programme ${index + 1}`} action={<Button size="sm" variant="ghost" onClick={onRemove}><Trash2 aria-hidden="true" />Remove programme</Button>}>
            <div className="rec-form__group">
                <div className="rec-fields">
                    <Field label="Programme name" htmlFor={id('name')}><input id={id('name')} className="gk-input" required maxLength={120} value={p.name} onChange={e => onChange({ name: e.target.value })} /></Field>
                    <Field label={<>Sessions per week{optional}</>} htmlFor={id('sessions')}><input id={id('sessions')} className="gk-input" type="number" min={1} max={14} value={p.sessionsPerWeek ?? ''} onChange={e => onChange({ sessionsPerWeek: e.target.value ? Number(e.target.value) : null })} /></Field>
                    <Field label={<>Minimum age{optional}</>} htmlFor={id('min')}><input id={id('min')} className="gk-input" type="number" min={0} max={99} value={p.ageMin ?? ''} onChange={e => onChange({ ageMin: e.target.value ? Number(e.target.value) : null })} /></Field>
                    <Field label={<>Maximum age{optional}</>} htmlFor={id('max')}><input id={id('max')} className="gk-input" type="number" min={p.ageMin ?? 0} max={99} value={p.ageMax ?? ''} onChange={e => onChange({ ageMax: e.target.value ? Number(e.target.value) : null })} /></Field>
                </div>
            </div>
            <div className="rec-form__group">
                <div className="rec-form__group-head"><h3>Fees</h3><p>All fees use the selected currency. Enter 0 for no charge; leave a fee blank when it has not been published.</p></div>
                <div className="rec-fields">
                    <Field label="Price status" htmlFor={id('price')}><select id={id('price')} className="gk-input" value={p.priceType} onChange={e => onChange({ priceType: e.target.value as TrainingProgramme['priceType'], amount: null })}>
                        <option value="FIXED">Fixed price</option><option value="FREE">Free training</option><option value="VARIES">Price varies</option><option value="UNPUBLISHED">Hide fees</option></select></Field>
                    {p.priceType === 'FIXED' && <Field label="Training amount" htmlFor={id('amount')}><input id={id('amount')} className="gk-input" required type="number" min="0.01" max="9999999999.99" step="0.01" value={p.amount ?? ''} onChange={e => onChange({ amount: e.target.value || null })} /></Field>}
                    <Field label="Currency" htmlFor={id('currency')}><select id={id('currency')} className="gk-input" required={p.priceType !== 'UNPUBLISHED' || p.trialAmount !== null || p.joiningFee !== null || p.equipmentFee !== null} value={p.currency} onChange={e => onChange({ currency: e.target.value })}>
                        <option value="">Choose currency</option>{Array.from(new Set(['GEL', 'EUR', 'GBP', 'USD', p.currency])).filter(Boolean).map(c => <option key={c}>{c}</option>)}</select></Field>
                    <Field label="Billing period" htmlFor={id('period')}><select id={id('period')} className="gk-input" value={p.billingPeriod} onChange={e => onChange({ billingPeriod: e.target.value as TrainingProgramme['billingPeriod'] })}>
                        <option value="MONTH">Per month</option><option value="SESSION">Per session</option><option value="TERM">Per term</option><option value="YEAR">Per year</option><option value="ONE_OFF">One-off</option></select></Field>
                    {fees.map(([key, text]) => <Field key={key} label={<>{text}{optional}</>} htmlFor={id(key)}><input id={id(key)} className="gk-input" type="number" min="0" max="9999999999.99" step="0.01" value={p[key] ?? ''} onChange={e => onChange({ [key]: e.target.value || null })} /></Field>)}
                    <Field label={<>Fee valid from{optional}</>} htmlFor={id('from')}><input id={id('from')} type="date" className="gk-input" value={p.validFrom ?? ''} onChange={e => onChange({ validFrom: e.target.value || null, squadIds: p.squadIds ?? [] })} /></Field>
                    <Field label={<>Fee valid until{optional}</>} htmlFor={id('until')}><input id={id('until')} type="date" min={p.validFrom ?? undefined} className="gk-input" value={p.validUntil ?? ''} onChange={e => onChange({ validUntil: e.target.value || null, squadIds: p.squadIds ?? [] })} /></Field>
                    <div className="rec-wide"><Field label={<>What is included and practical information{optional}</>} htmlFor={id('details')}><textarea id={id('details')} className="gk-input" rows={3} maxLength={2000} value={p.details ?? ''} onChange={e => onChange({ details: e.target.value || null })} /></Field></div>
                </div>
            </div>
            <div className="rec-form__group">
                <fieldset className="cw-scope"><legend className="gk-field__label">Squads in this programme</legend>
                    <div className="gk-chips">{squads.map(s => { const on = p.squadIds?.includes(s.id) ?? false; return <Chip key={s.id} pressed={on} onClick={() => onChange({ squadIds: on ? (p.squadIds ?? []).filter(x => x !== s.id) : [...(p.squadIds ?? []), s.id] })}>{s.name}</Chip>; })}</div>
                    <p className="gk-field__hint">Linked squads show their training days and times so families can compare before joining. Create separate programmes when fees differ.</p>
                </fieldset>
                <label className="rec-switch"><span><strong>Publish programme</strong><span>Shown on the club profile once saved.</span></span><input type="checkbox" className="gk-switch" checked={p.published} onChange={e => onChange({ published: e.target.checked })} /></label>
            </div>
        </Panel>
    </section>;
}
