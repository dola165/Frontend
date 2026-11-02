import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Field } from '../../../design/primitives';
import { apiClient, type AuthSessionRequestConfig } from '../../../api/axiosConfig';
import { assertCurrentAuthSession, getAuthSessionId } from '../../../utils/authStorage';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { root, type Bootstrap, type Choice, type OperationRecord } from '../api';
import { useRecordCreation } from '../useRecordCreation';
import { useClubEditorClose } from '../useClubEditorClose';
import { RecordField } from '../records/recordFields';
import type { CareRecord } from './usePrivateCare';

export function CareEditor({ boot, squad, person, kind, consents, decisionMakers, record: initialRecord, onSaved, onCancel }: {
  boot: Bootstrap; squad: number; person: number; kind: string; consents: CareRecord[]; decisionMakers: Choice[];
  record?: CareRecord; onSaved: (record: OperationRecord) => Promise<void>; onCancel: () => void;
}) {
  // A refresh must not rebase this private draft onto another revision or consent.
  const [record] = useState(initialRecord);
  const consent = kind.endsWith('_CONSENT'), restriction = kind === 'RESTRICTION', appointment = kind === 'MEDICAL_APPOINTMENT';
  const appointmentDefinition = appointment ? boot.definitions.find(d => d.kind === kind) : undefined;
  const [data, setData] = useState<Record<string, string>>(record?.data ?? {});
  const [chosen, setChosen] = useState(String(record?.related_record_id ?? consents[0]?.id ?? ''));
  const [decider, setDecider] = useState(String(decisionMakers.length === 1 ? decisionMakers[0].id : ''));
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [receipt, setReceipt] = useState<OperationRecord | null>(null);
  const [session] = useState(getAuthSessionId), locked = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const creation = useRecordCreation(boot, kind);
  const initial = useRef(JSON.stringify({ data, chosen, decider }));
  const dirty = !receipt && initial.current !== JSON.stringify({ data, chosen, decider });
  const { confirmation, requestClose } = useClubEditorClose(dirty || creation.uncertain, busy, onCancel);
  const professional = boot.staff.find(p => p.id === boot.actorId)?.name ?? 'Appointed professional';
  const update = (key: string, value: string) => setData(old => ({ ...old, [key]: value }));
  const title = record?.title ?? (consent ? kind === 'MEDICAL_CONSENT' ? 'Medical records consent' : 'Wellbeing records consent'
    : restriction ? 'Participation' : appointment ? 'Medical appointment' : kind === 'WELLBEING_NOTE' ? 'Private wellbeing note' : 'Clinical note');
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (locked.current || creation.blocked) return;
    locked.current = true; setBusy(true); setError('');
    try {
      assertCurrentAuthSession(session);
      if (receipt) { await onSaved(receipt); return; }
      if (record && (!record.squad_id || !record.subject_user_id || !record.assigned_user_id || !record.related_record_id)) {
        throw new Error('The original care scope and consent reference are required. Refresh this record before editing.');
      }
      const body = { kind: record?.kind ?? kind, title, squadId: record ? record.squad_id : squad,
        subjectUserId: record ? record.subject_user_id : person, assignedUserId: record ? record.assigned_user_id : consent ? Number(decider) : boot.actorId,
        relatedRecordId: record ? record.related_record_id : consent ? null : Number(chosen), data: !consent && kind !== 'WELLBEING_NOTE' ? { ...data, professional } : data,
        revision: record?.revision ?? null };
      const config: AuthSessionRequestConfig = { _authSessionId: session };
      const saved = record ? (await apiClient.put<OperationRecord>(`${root(boot.clubId)}/records/${record.id}`, body, config)).data : await creation.create(body);
      assertCurrentAuthSession(session);
      if (!mounted.current) return;
      setReceipt(saved);
      await onSaved(saved);
    } catch (failure) { if (mounted.current) setError(extractApiErrorMessage(failure, 'Save was not confirmed. Keep these details and check the current record before retrying.')); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  };
  const field = (key: string, label: string, type = 'text', required = true) => <Field key={key} htmlFor={`care-${key}`} label={label}>
    {type === 'textarea' ? <textarea id={`care-${key}`} className="gk-input" value={data[key] ?? ''} required={required} rows={5}
      maxLength={restriction ? 500 : 4000} onChange={e => update(key, e.target.value)} />
      : <input id={`care-${key}`} className="gk-input" type={type} maxLength={500} value={data[key] ?? ''} required={required} onChange={e => update(key, e.target.value)} />}
  </Field>;
  return <form className="private-care__form" onSubmit={event => void save(event)} aria-label={title}>
    <h3>{title}</h3>{confirmation}
    {error && <p role="alert" className="gk-notice gk-notice--danger">{error}</p>}
    {creation.message && <p role="alert">{creation.message}</p>}
    {receipt && <p role="status">Saved. Refresh the saved record if its view did not load.</p>}
    <fieldset disabled={busy || !!receipt || creation.uncertain || creation.blocked}>
      {consent ? <>
        <p>Permission is for new {kind === 'MEDICAL_CONSENT' ? 'medical' : 'wellbeing'} records held by {professional}, for this player and squad. Previous notes stay locked. Only short participation information is shared with authorised staff and the family.</p>
        <Field htmlFor="care-decider" label="Person deciding"><select id="care-decider" className="gk-input" required value={decider} onChange={e => setDecider(e.target.value)}>
          <option value="">Choose a current guardian or adult player</option>{decisionMakers.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}
        </select></Field>
        {!decisionMakers.length && <p>No eligible decision maker is connected. Confirm the existing family relationship first.</p>}
        {field('wording', 'Exact permission requested', 'textarea')}{field('version', 'Wording version')}{field('expiresOn', 'Valid until', 'date')}
        <p>Use the permission wording agreed with the person. This request is not consent until they record their own decision.</p>
      </> : <>
        <Field htmlFor="care-consent" label="Recorded consent">{record
          ? <input id="care-consent" className="gk-input" readOnly value={String(record.related_record_id ?? '')} />
          : <select id="care-consent" className="gk-input" required value={chosen} onChange={e => setChosen(e.target.value)}>
            <option value="">Choose valid consent</option>{consents.map(c => <option value={c.id} key={c.id}>Consent #{c.id} · valid until {c.data.expiresOn}</option>)}
          </select>}</Field>
        {record && <p>The original consent reference stays with this record. It cannot be replaced here.</p>}
        {appointmentDefinition ? appointmentDefinition.fields.filter(f => f.key !== 'professional').map(f => <RecordField key={f.key} boot={boot} definition={appointmentDefinition} field={f} value={data[f.key] ?? ''} onChange={value => update(f.key, value)} />)
          : <>{field(restriction ? 'restrictions' : 'notes', restriction ? 'What the player may do (shared with coaches and family)' : 'Private notes', 'textarea')}
        {restriction && <p>Keep this short. Leave diagnoses, treatment details and private circumstances in the private note.</p>}
        {field('reviewOn', 'Review date', 'date', restriction)}
        {restriction && record && field('clearanceReference', 'Professional clearance evidence reference', 'text', false)}</>}
      </>}
    </fieldset>
    <div className="gk-row"><Button type="submit" variant="primary" disabled={busy || creation.blocked || consent && !decisionMakers.length}>{busy ? 'Saving…' : receipt ? 'Refresh saved record' : creation.uncertain ? 'Retry same request' : consent ? 'Request permission' : 'Save'}</Button>
      <Button disabled={busy} onClick={() => requestClose()}>Cancel</Button></div>
  </form>;
}
