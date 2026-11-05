import { useRef, useState, type FormEvent } from 'react';
import { Button, Field, Panel } from '../../../design/primitives';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { assertCurrentAuthSession, getAuthSessionId } from '../../../utils/authStorage';
import type { Bootstrap, OperationRecord } from '../api';
import { useRegistrationCreation } from './useRegistrationCreation';
import { useClubEditorClose } from '../useClubEditorClose';
import type { RegistrationItem } from './api';
import './registration.css';

export function RegistrationEditor({ boot, person, squad, kind, source, credentials, onSaved, onClose }: {
  boot: Bootstrap; person: number; squad: number | null; kind: 'REGISTRATION' | 'CREDENTIAL'; source?: OperationRecord;
  credentials: RegistrationItem[]; onSaved: (record: OperationRecord) => Promise<void>; onClose: () => void;
}) {
  const [session] = useState(getAuthSessionId);
  const [title, setTitle] = useState(source?.title ?? (kind === 'REGISTRATION' ? 'Player registration' : 'Credential'));
  const [data, setData] = useState<Record<string, string>>(() => {
    const copied = { ...source?.data };
    for (const key of ['approvalReference', 'externalReference', 'reference', 'evidence', 'reviewNotes', 'issuedOn', 'expiresOn', 'issues', 'changeReason']) delete copied[key];
    if (source) { copied.changeType = 'RENEWAL'; copied.previousRevision = String(source.revision); }
    return copied;
  });
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState<OperationRecord | null>(null);
  const active = useRef(false), creation = useRegistrationCreation(boot, kind);
  const close = useClubEditorClose(dirty || creation.uncertain, busy, onClose);
  const definition = boot.definitions.find(d => d.kind === kind);
  const change = (key: string, value: string) => { setDirty(true); setData(old => ({ ...old, [key]: value })); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (active.current || saved) return; active.current = true; setBusy(true); setError('');
    try {
      assertCurrentAuthSession(session);
      const record = await creation.create({ kind, title, subjectUserId: person, squadId: squad, assignedUserId: null,
        eventId: source?.event_id ?? null, sessionId: null, relatedRecordId: source?.id ?? null, dueOn: null, data, revision: null });
      assertCurrentAuthSession(session);
      setSaved(record); setDirty(false);
      try { await onSaved(record); } catch { setError('Saved. The view could not refresh; open the saved record below.'); }
    } catch (e) { setError(extractApiErrorMessage(e, 'The save could not be confirmed. Your details remain here.')); }
    finally { active.current = false; setBusy(false); }
  };
  if (!definition) return <p role="alert">This record type is outside your current assignment.</p>;
  return <section className="registration"><Panel padded title={source ? 'Renew or correct the record' : kind === 'REGISTRATION' ? 'Add registration evidence' : 'Add a credential'}>
    <form className="registration__form" onSubmit={e => void submit(e)}>
      <p>Record actual outside evidence. Another authorised person reviews it. This does not apply to a federation or issue a licence.</p>
      {source && <p>Earlier record #{source.id} stays in history. A renewal preserves its current validity; a correction asks for review of it.</p>}
      {error && <p role="alert">{error}</p>}{creation.message && <p role="status">{creation.message}</p>}
      {creation.recovering && <Button type="button" disabled={busy} onClick={() => {
        if (active.current) return; active.current = true; setBusy(true); setError('');
        void creation.recover().then(async record => { assertCurrentAuthSession(session); setSaved(record); setDirty(false); await onSaved(record); })
          .catch(e => setError(extractApiErrorMessage(e, 'The saved outcome could not be recovered. Keep the previous request key.')))
          .finally(() => { active.current = false; setBusy(false); });
      }}>Open previous saved outcome</Button>}
      {saved && <p role="status">Saved: {saved.title} · #{saved.id}</p>}
      <fieldset disabled={busy || creation.uncertain || creation.blocked || !!saved} className="registration__fields">
        <Field label="Record title" htmlFor="registration-title"><input id="registration-title" className="gk-input" required maxLength={160} value={title} onChange={e => { setTitle(e.target.value); setDirty(true); }} /></Field>
        {definition.fields.filter(f => f.key !== 'previousRevision' && (source || !['changeType', 'changeReason'].includes(f.key))).map(f => {
          const id = `registration-${f.key}`, required = f.required || ['changeType', 'changeReason'].includes(f.key);
          if (f.key === 'requiredCredentialIds') return <Field key={f.key} label="Credential records required by these rules" htmlFor={id}>
            <select id={id} className="gk-input" multiple value={(data[f.key] || '').split(',').filter(Boolean)} onChange={e => change(f.key, Array.from(e.target.selectedOptions, o => o.value).join(','))}>
              {credentials.filter(c => c.kind === 'CREDENTIAL').map(c => <option key={c.id} value={c.id}>{c.title} · #{c.id}</option>)}
            </select><small>Select only records the actual requirements call for. Their review and expiry are calculated.</small></Field>;
          return <Field key={f.key} label={f.label} htmlFor={id}>{f.type === 'textarea'
            ? <textarea id={id} className="gk-input" required={required} maxLength={4000} value={data[f.key] || ''} onChange={e => change(f.key, e.target.value)} />
            : f.type === 'choice' ? <select id={id} className="gk-input" required={required} value={data[f.key] || ''} onChange={e => change(f.key, e.target.value)}><option value="">Choose</option>{f.options.map(value => <option key={value} value={value}>{value === 'CORRECTION' ? 'Correction' : 'Renewal'}</option>)}</select>
              : <input id={id} className="gk-input" type={f.type === 'date' ? 'date' : 'text'} maxLength={500} required={required} value={data[f.key] || ''} onChange={e => change(f.key, e.target.value)} />}</Field>;
        })}
      </fieldset>
      <div className="registration__actions"><Button type="submit" disabled={busy || creation.blocked || !!saved}>{busy ? 'Saving…' : creation.uncertain ? 'Retry the same save' : creation.recovering ? 'Resubmit under the previous key' : 'Save for review'}</Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={close.requestClose}>Back</Button>
        {saved && <Button type="button" onClick={() => void onSaved(saved)}>Open saved record</Button>}</div>
    </form>{close.confirmation}
  </Panel></section>;
}
