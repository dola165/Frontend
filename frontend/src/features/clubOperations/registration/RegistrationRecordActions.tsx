import { useState } from 'react';
import { Badge, Button, Panel } from '../../../design/primitives';
import type { Bootstrap, OperationRecord } from '../api';
import { eligibilityLabel } from './api';
import { useRegistration } from './useRegistration';
import { RegistrationEditor } from './RegistrationEditor';
import './registration.css';

export function RegistrationRecordActions({ boot, record, onSaved }: { boot: Bootstrap; record: OperationRecord; onSaved: (record: OperationRecord) => Promise<void> }) {
  const { data, error, load } = useRegistration(boot.clubId, record.subject_user_id!, record.squad_id);
  const [editing, setEditing] = useState(false);
  const item = data?.records.find(r => r.id === record.id);
  if (error) return <section className="registration"><p role="alert">{error}</p><Button onClick={() => void load()}>Retry eligibility</Button></section>;
  if (!item) return <p role="status">Checking current evidence…</p>;
  if (editing) return <RegistrationEditor boot={boot} person={record.subject_user_id!} squad={record.squad_id} kind={record.kind as 'REGISTRATION' | 'CREDENTIAL'} source={record}
    credentials={data!.records} onSaved={onSaved} onClose={() => setEditing(false)} />;
  return <section className="registration"><Panel padded title="Current evidence">
    <Badge>{eligibilityLabel(item.eligibility.state)}</Badge><p>{item.eligibility.reasons.join(' ')}</p>
    <p>{item.eligibility.expiresOn ? `Validity ends ${item.eligibility.expiresOn}.` : 'Validity date unknown.'} This is not federation verification.</p>
    {item.canReplace && <Button onClick={() => setEditing(true)}>Renew or correct</Button>}
  </Panel></section>;
}
