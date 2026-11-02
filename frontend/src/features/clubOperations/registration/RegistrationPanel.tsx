import { useState, useSyncExternalStore } from 'react';
import { Badge, Button, ButtonLink, EmptyNote, Field, PageHeader, Panel } from '../../../design/primitives';
import { getAuthSessionId, subscribeAuthSession } from '../../../utils/authStorage';
import { officeToolPath } from '../../clubOffice/officeLinks';
import type { Bootstrap, OperationRecord } from '../api';
import { useScopedSearchParams } from '../scopedParams';
import { guardWorkspaceNavigation } from '../workspaceGuard';
import { eligibilityLabel, type RegistrationProfile } from './api';
import { useRegistration } from './useRegistration';
import { RegistrationEditor } from './RegistrationEditor';
import './registration.css';

export function RegistrationPanel({ boot, scope }: { boot: Bootstrap; scope?: string }) {
  const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
  const [params, setParams] = useScopedSearchParams(scope);
  const person = Number(params.get('person')) || null, squad = Number(params.get('squad')) || null;
  const permission = boot.modules.find(m => m.id === 'REGISTRATION');
  const squads = boot.squads.filter(s => permission?.globalRead || permission?.globalWrite || permission?.readSquads?.includes(s.id) || permission?.writeSquads.includes(s.id));
  const records = () => { const next = new URLSearchParams(params); next.set('registration', 'records'); guardWorkspaceNavigation(() => setParams(next), scope); };
  return <section className="registration">
    <PageHeader title="Registration" subtitle="Player eligibility and recorded evidence" actions={<Button onClick={records}>All records and history</Button>} />
    <form className="registration__context" onSubmit={event => {
      event.preventDefault(); const values = new FormData(event.currentTarget), next = new URLSearchParams(params);
      next.set('person', String(values.get('person'))); const value = String(values.get('squad') || '');
      if (value) next.set('squad', value); else next.delete('squad');
      guardWorkspaceNavigation(() => setParams(next), scope);
    }}>
      <Field label="Club scope" htmlFor="registration-scope"><select id="registration-scope" name="squad" className="gk-input" title={squads.find(s => s.id === squad)?.name} defaultValue={squad ?? ''}>
        {(permission?.globalRead || permission?.globalWrite) && <option value="">Whole club records</option>}{squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select></Field>
      <Field label="Player" htmlFor="registration-person"><select id="registration-person" name="person" className="gk-input" title={boot.people.find(p => p.id === person)?.name} required defaultValue={person ?? ''}>
        <option value="">Choose a player</option>{boot.people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select></Field><Button type="submit">Open eligibility</Button>
    </form>
    {person ? <RegistrationSession key={`${boot.actorId}:${session}:${boot.clubId}:${person}:${squad}`} boot={boot} person={person} squad={squad} scope={scope} />
      : <EmptyNote title="Choose a player to check their records">Current club links, required credentials and validity dates are checked together. No record means eligibility is unknown.</EmptyNote>}
  </section>;
}

function RegistrationSession({ boot, person, squad, scope }: { boot: Bootstrap; person: number; squad: number | null; scope?: string }) {
  const { data, error, load } = useRegistration(boot.clubId, person, squad);
  const [kind, setKind] = useState<'REGISTRATION' | 'CREDENTIAL' | null>(null);
  const [params, setParams] = useScopedSearchParams(scope);
  const open = (id: number) => { const next = new URLSearchParams(params); next.set('record', String(id)); next.set('from', 'list'); setParams(next); };
  const saved = async (record: OperationRecord) => { open(record.id); };
  if (error) return <div role="alert"><p>{error}</p><Button onClick={() => void load()}>Try again</Button></div>;
  if (!data) return <p role="status">Loading registration records…</p>;
  if (kind) return <RegistrationEditor boot={boot} person={person} squad={squad} kind={kind} credentials={data.records} onSaved={saved} onClose={() => setKind(null)} />;
  const credentials = boot.modules.find(m => m.id === 'CREDENTIALS');
  const canCredential = data.currentPlayer && boot.settings.enabled_modules.includes('CREDENTIALS') && (credentials?.globalWrite || squad !== null && credentials?.writeSquads.includes(squad));
  return <>
    <div className="registration__actions">{data.canCreate && <Button onClick={() => setKind('REGISTRATION')}>Add registration evidence</Button>}
      {canCredential && <Button onClick={() => setKind('CREDENTIAL')}>Add required credential</Button>}</div>
    <RegistrationSummary data={data} onOpen={open} />
    <Panel padded title="Leaving and retained history"><p>A registration decision does not end a playing relationship. Use the existing player or family departure flow; the player keeps their career and the club retains its work.</p>
      <div className="registration__actions">{data.departurePath ? <ButtonLink to={data.departurePath}>Open playing relationship</ButtonLink> : <p>A club leader or the player’s current adult decision maker handles leaving through the existing relationship flow.</p>}
        {boot.modules.some(m => m.id === 'DEPARTURES') && <ButtonLink to={officeToolPath(boot.clubId, 'departures', { person: String(person), ...(squad ? { squad: String(squad) } : {}) })}>Departure work and history</ButtonLink>}</div></Panel>
  </>;
}

export function RegistrationSummary({ data, onOpen }: { data: RegistrationProfile; onOpen?: (id: number) => void }) {
  return <div className="registration__summary">
    <p className="gk-muted">As of {data.asOf}. This describes recorded evidence; it is not federation verification or permission to play in every competition.</p>
    {!data.currentPlayer && <p role="status">No current playing relationship is confirmed for this scope. Earlier records remain available.</p>}
    {!!data.affiliations.length && <details><summary>Playing relationship history</summary><ul>{data.affiliations.map(a => <li key={a.id}>{a.status.toLowerCase()} · joined {a.joinedOn}{a.endedOn ? ` · ended ${a.endedOn}` : ''}</li>)}</ul></details>}
    {!data.records.length && <EmptyNote title="Eligibility unknown">No registration evidence is recorded in this scope. Add the actual requirements when this tool is needed.</EmptyNote>}
    {data.records.map(record => <Panel key={record.id} padded title={record.title} action={record.canOpen && onOpen ? <Button onClick={() => onOpen(record.id)}>Open record #{record.id}</Button> : undefined}>
      <div className="registration__status"><Badge tone={record.eligibility.state === 'RECORDED_CURRENT' ? 'accent' : record.eligibility.state === 'EXPIRED' ? 'danger' : 'neutral'}>{eligibilityLabel(record.eligibility.state)}</Badge>
        <span>{record.kind === 'CREDENTIAL' ? 'Credential' : 'Registration'} · #{record.id}{record.eligibility.expiresOn ? ` · Validity ends ${record.eligibility.expiresOn}` : ' · Validity date unknown'}</span></div>
      {!!record.eligibility.reasons.length && <ul>{record.eligibility.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
      {record.requirements && <p><strong>Required records and approvals:</strong> {record.requirements}</p>}
      {record.requirementsSource && <p><strong>Rules source:</strong> {record.requirementsSource}</p>}
      {!!record.eligibility.credentialIds.length && <p>Required credential records: {record.eligibility.credentialIds.map(id => `#${id}`).join(', ')}</p>}
      {record.previousId && <p>Renews or corrects record #{record.previousId}.</p>}
      <details><summary>Outcome history</summary>{record.history.length ? <ol>{record.history.map(event => <li key={event.id}>
        <strong>{event.action.toLowerCase().replaceAll('_', ' ')}{event.status ? ` · ${event.status.toLowerCase().replaceAll('_', ' ')}` : ''}</strong>
        <p>{event.actor} · <time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time></p>{event.note && <p>{event.note}</p>}
      </li>)}</ol> : <p>No recorded changes available.</p>}</details>
    </Panel>)}
  </div>;
}

/** Shared shell/Parent Hub adapter: no global route or inbox is introduced by this domain. */
export function PersonalRegistration({ club, person, squad }: { club: number; person: number; squad: number | null }) {
  const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
  return <PersonalSession key={`${session}:${club}:${person}:${squad}`} club={club} person={person} squad={squad} />;
}
function PersonalSession({ club, person, squad }: { club: number; person: number; squad: number | null }) {
  const { data, error, load } = useRegistration(club, person, squad);
  return <section className="registration">{error ? <div role="alert"><p>{error}</p><Button onClick={() => void load()}>Try again</Button></div>
    : data ? <RegistrationSummary data={data} /> : <p role="status">Loading registration records…</p>}</section>;
}
