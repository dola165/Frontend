import { useSyncExternalStore } from 'react';
import { Badge, Button, EmptyNote, Panel, Skeleton } from '../../../design/primitives';
import { getAuthSessionId, subscribeAuthSession } from '../../../utils/authStorage';
import { label, type Bootstrap, type OperationRecord } from '../api';
import { useScopedSearchParams } from '../scopedParams';
import { guardWorkspaceNavigation } from '../workspaceGuard';
import { RecordDetail } from '../RecordDetail';
import { CareEditor } from './CareEditor';
import { usePrivateCare } from './usePrivateCare';
import './private-care.css';

export function PrivateCarePanel(props: { boot: Bootstrap; module: string; scope?: string; onRefresh: () => Promise<void> }) {
  const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
  const [params, setParams] = useScopedSearchParams(props.scope);
  const person = Number(params.get('person')), squad = Number(params.get('squad'));
  const permission = props.boot.modules.find(m => m.id === props.module);
  const squads = props.boot.squads.filter(s => permission?.globalRead || permission?.readSquads?.includes(s.id));
  if (!person || !squad) return <section className="private-care"><h2>Player file · {props.module === 'MEDICAL' ? 'Body' : 'Life'}</h2>
    <p>Choose a player in your current scope.</p>
    <form className="private-care__form" onSubmit={event => {
      event.preventDefault(); const values = new FormData(event.currentTarget), next = new URLSearchParams(params);
      next.set('squad', String(values.get('squad'))); next.set('person', String(values.get('person'))); setParams(next);
    }}>
      <label>Squad<select className="gk-input" name="squad" required>{squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Player<select className="gk-input" name="person" required><option value="">Choose a player</option>{props.boot.people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <Button type="submit" disabled={!squads.length || !props.boot.people.length}>Open player</Button>
    </form>
  </section>;
  return <CareSession key={`${props.boot.actorId}:${session}:${props.boot.clubId}:${person}:${squad}:${props.module}`} {...props} person={person} squad={squad} />;
}

function CareSession({ boot, module, scope, person, squad, onRefresh }: { boot: Bootstrap; module: string; scope?: string; person: number; squad: number; onRefresh: () => Promise<void> }) {
  const [params, setParams] = useScopedSearchParams(scope);
  const recordId = Number(params.get('record')) || null;
  const { data, selected, error, load } = usePrivateCare(boot.clubId, squad, person, module, recordId);
  const consentKind = `${module}_CONSENT`, noteKind = module === 'MEDICAL' ? 'CLINICAL_NOTE' : 'WELLBEING_NOTE';
  const mode = params.get('care');
  const writable = boot.modules.some(m => m.id === module && (m.globalWrite || m.writeSquads.includes(squad)));
  const usable = data?.usableConsents.filter(r => r.kind === consentKind && r.consentCurrent && r.created_by === boot.actorId) ?? [];
  const navigate = (record?: number, care?: string) => guardWorkspaceNavigation(() => {
    const next = new URLSearchParams(params); next.delete('record'); next.delete('care');
    if (record) next.set('record', String(record)); if (care) next.set('care', care); setParams(next);
  }, scope);
  const saved = async (record?: Pick<OperationRecord, 'id' | 'title'>) => {
    const next = new URLSearchParams(params); next.delete('care'); if (record) next.set('record', String(record.id)); setParams(next);
    await load(); await onRefresh();
  };
  const notice = error && <><p role="alert">{error}</p><Button onClick={() => void load()}>Try again</Button></>;
  if (error && !selected) return <div className="private-care">{notice}</div>;
  if (!data && !selected) return <div className="private-care" role="status" aria-label="Loading private care"><Skeleton height={80} /></div>;
  const definition = selected && boot.definitions.find(d => d.kind === selected.kind);
  const editKind = mode === 'edit' ? selected?.kind : !recordId && data ? mode : null;
  if (editKind && writable && [noteKind, consentKind, ...(module === 'MEDICAL' ? ['RESTRICTION', 'MEDICAL_APPOINTMENT'] : [])].includes(editKind) && (mode !== 'edit' || selected?.canEdit)) {
    return <div className="private-care">{notice}<CareEditor key={`${editKind}:${selected?.id ?? 'create'}`} boot={boot} squad={squad} person={person} kind={editKind}
      consents={usable} decisionMakers={data?.decisionMakers ?? []} record={mode === 'edit' ? selected ?? undefined : undefined} onCancel={() => navigate(selected?.id)} onSaved={saved} /></div>;
  }
  if (selected && definition) return <div className="private-care">{notice}<RecordDetail boot={{ ...boot, links: [...boot.links, ...(data?.records ?? []), ...(data?.usableConsents ?? [])] }} club={boot.clubId} record={selected} definition={definition}
    backLabel={data ? 'Player file' : 'Close record'} onClose={() => navigate()} onEdit={() => navigate(selected.id, 'edit')} onChanged={saved} /></div>;
  if (!data) return <div className="private-care">{notice}<EmptyNote title="This record type is unavailable in this care view." /></div>;
  return <section className="private-care" aria-label={module === 'MEDICAL' ? 'Player file: Body' : 'Player file: Life'}>
    <header><h2>{module === 'MEDICAL' ? 'Body' : 'Life'} <Badge>Private care</Badge></h2><p>{boot.people.find(p => p.id === person)?.name} · {boot.squads.find(s => s.id === squad)?.name}</p></header>
    {params.get('record') && <p role="alert">This record is unavailable under your current access and consent.</p>}
    <p>Only the named professional with current authority and consent can open private care records. Safeguarding has its own separate access.</p>
    {writable && <div className="private-care__actions">
      <Button onClick={() => navigate(undefined, consentKind)}>Request permission</Button>
      {!!usable.length && <><Button variant="primary" onClick={() => navigate(undefined, noteKind)}>Add private note</Button>
        {module === 'MEDICAL' && <><Button onClick={() => navigate(undefined, 'RESTRICTION')}>Set participation restriction</Button>
          <Button onClick={() => navigate(undefined, 'MEDICAL_APPOINTMENT')}>Record appointment</Button></>}</>}
    </div>}
    {!usable.length && <p className="gk-notice">A current recorded consent decision is needed before adding notes or changing participation. An unanswered request grants no access.</p>}
    <Panel padded title="Records and decisions">
      {data.records.length ? <ul className="private-care__records">{data.records.map(r => <li key={r.id}><button onClick={() => navigate(r.id)}><strong>{r.title}</strong><span>{label(r.status)}{r.kind.endsWith('_CONSENT') && !r.consentCurrent ? ' · Not valid for new care records' : ''}</span></button></li>)}</ul>
        : <EmptyNote title="No permitted records yet" />}
    </Panel>
    <details><summary>Earlier records and withdrawal</summary><p>{data.historyLimit}</p><p>Withdrawal stops access to the linked private notes and documents. Their retained history is not deleted or opened by a later permission.</p></details>
    <Button onClick={() => void load()}>Refresh current access</Button>
  </section>;
}
