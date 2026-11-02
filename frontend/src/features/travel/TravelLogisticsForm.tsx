import { useId, useState } from 'react';
import { Button, Field } from '../../design/primitives';
import { useOwnedDraft } from '../../utils/ownedDraft';
import { getAuthSessionId } from '../../utils/authStorage';
import { localInput, zonedIso } from '../mapPlanning/api';
import type { TravelLogistics, TravelPlan } from './api';

export function TravelLogisticsForm({ plan, busy, save }: { plan: TravelPlan; busy: boolean; save: (value: TravelLogistics) => Promise<TravelPlan | undefined> }) {
    const id = useId(), d = plan.draft;
    const [error, setError] = useState('');
    const transport = d.arrangements.find(a => a.kind === 'TRANSPORT');
    const { draft, change, reset, clear } = useOwnedDraft(`travel:${getAuthSessionId()}:${plan.club_id}:${plan.id}`, {
        revision: plan.revision, startsAt: localInput(d.startsAt, d.timezone), endsAt: localInput(d.endsAt, d.timezone),
        meetingPoint: d.meetingPoint, collectionPoint: d.collectionPoint, supervisionContact: d.supervisionContact,
        transport: transport?.title ?? '', transportEvidence: transport?.notes ?? '', familyMessage: d.familyMessage,
        transportConfirmed: plan.suppliers?.travel?.status === 'CONFIRMED',
    });
    const fields = [['startsAt', 'Departure', 50], ['endsAt', 'Expected return', 50], ['meetingPoint', 'Pickup point', 400], ['collectionPoint', 'Return collection point', 400],
        ['supervisionContact', 'Responsible staff and contact', 400], ['transport', 'Outside transport arrangement', 160], ['transportEvidence', 'Outside confirmation reference or details', 2000], ['familyMessage', 'Message for these families', 2000]] as const;
    return <form className="gk-travel-form" onSubmit={event => {
        event.preventDefault();
        // Native datetime inputs have already checked their shape; the zone conversion also rejects skipped clock times.
        setError('');
        try { void save({ ...draft, startsAt: zonedIso(draft.startsAt, d.timezone), endsAt: zonedIso(draft.endsAt, d.timezone) }).then(saved => { if (saved) { clear(); change({ revision: saved.revision }); } }); }
        catch (cause) { setError(String(cause)); }
    }}>
        <p className="gk-muted">Times use {d.timezone}. Event time and ground come from the linked event. Transport and payment stay with your outside arrangement.</p>
        {error && <p role="alert">{error}</p>}
        {draft.revision !== plan.revision && <p role="status">The saved plan changed. Your draft is kept. Review current details, then discard this draft to edit the current version.</p>}
        {fields.map(([key, title, max]) => <Field key={key} label={title} htmlFor={`${id}-${key}`}><input id={`${id}-${key}`} className="gk-input"
            type={key === 'startsAt' || key === 'endsAt' ? 'datetime-local' : 'text'} required={key !== 'familyMessage' && (key !== 'transportEvidence' || draft.transportConfirmed)} maxLength={max}
            value={draft[key]} onChange={e => change({ [key]: e.target.value, ...(['transport', 'transportEvidence'].includes(key) ? { transportConfirmed: false } : {}) })} /></Field>)}
        <label className="gk-travel-confirm"><input type="checkbox" checked={draft.transportConfirmed} onChange={e => change({ transportConfirmed: e.target.checked })} /> Responsible staff have confirmed this arrangement outside GrassKickZ.</label>
        <p className="gk-muted">Unconfirmed arrangements can stay in the draft. They do not make travel ready.</p>
        <div className="gk-travel-actions"><Button type="submit" variant="primary" disabled={busy || draft.revision !== plan.revision}>Save logistics</Button>
            <Button disabled={busy} onClick={reset}>Discard draft and use current details</Button></div>
    </form>;
}
