import { useRef, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Badge, Button, EmptyNote, Field, List, PageFrame, PageHeader, Panel, Section } from '../../design/primitives';
import { ScopeChips } from './ScopeChips';
import type { StaffScopeSelection } from './StaffScopePicker';
import { useClubEditorClose } from './useClubEditorClose';
import { type RoleRequest, type RolesWorkspace, rolesRoot } from './useWorkspaceRoles';
import { appointmentScope, get, post, root, moduleNames, label, scopePayload, type Choice } from './api';
import { extractApiErrorMessage } from '../../utils/apiError';
import './records/records.css';

const tone = (status: string) => status === 'PENDING' ? 'warning' as const : status === 'APPROVED' ? 'accent' as const : status === 'DECLINED' ? 'danger' as const : 'neutral' as const;
const access = (permissions: string[]) => permissions.map(p => `${moduleNames[p.split(':')[0]] ?? label(p.split(':')[0])}${p.endsWith(':WRITE') ? '' : ' (view)'}`).join(', ');

/** Club leadership's view of staff responsibilities: assign a role, and decide on the changes staff ask for. */
export function WorkspaceRolesPanel({ club, data, onChanged }: { club: number; data: RolesWorkspace; onChanged: () => void }) {
  const [assigning, setAssigning] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState('');
  const [role, setRole] = useState(data.catalog[0]?.key ?? ''), [scope, setScope] = useState<StaffScopeSelection>({ clubWide: false, squadIds: [] }), [ends, setEnds] = useState('');
  const [query, setQuery] = useState(''), [matches, setMatches] = useState<Choice[]>([]), [person, setPerson] = useState('');
  const [decision, setDecision] = useState<{ request: RoleRequest; status: 'APPROVED' | 'DECLINED' } | null>(null), [reply, setReply] = useState('');
  const draft = JSON.stringify({ role, scope, ends, query, person }), initial = useRef(draft);
  const reset = () => { setAssigning(false); setRole(data.catalog[0]?.key ?? ''); setScope({ clubWide: false, squadIds: [] }); setEnds(''); setQuery(''); setMatches([]); setPerson(''); };
  const { requestClose, confirmation } = useClubEditorClose(assigning && draft !== initial.current, busy, reset);
  const selected = data.catalog.find(r => r.key === role);
  const run = async (work: () => Promise<unknown>, success: string) => {
    if (busy) return; setBusy(true); setError(''); setDone('');
    try { await work(); reset(); setDecision(null); setDone(success); onChanged(); }
    catch (e) { setError(extractApiErrorMessage(e, 'Could not update this role.')); }
    finally { setBusy(false); }
  };
  const assign = () => {
    if (!scope.clubWide && !scope.squadIds.length) { setError('Choose the whole club or at least one squad.'); return; }
    void run(() => post(`${rolesRoot(club)}/assignments`, { userId: Number(person), roleKey: role, ...scopePayload(scope), startsOn: new Date().toISOString().slice(0, 10), endsOn: ends || null }), 'Role invitation sent. The person accepts before any access starts.');
  };
  const waiting = data.requests.filter(r => r.status === 'PENDING' && r.user_id !== data.actorId);
  const others = data.requests.filter(r => !waiting.includes(r));
  const title = (r: RoleRequest) => data.catalog.find(c => c.key === r.role_key)?.title ?? label(r.role_key);
  const request = (r: RoleRequest, controls: boolean) => <li key={r.id}><div className="gk-list-row rec-request">
    <span className="gk-list-row__main">
      <span className="gk-list-row__title">{r.name} · {title(r)}</span>
      <span className="rec-request__text">{appointmentScope({ squad_id: r.squad_id ?? null, ...r }, data.requestSquads)}{r.replace_appointment_id ? ' · replaces an existing appointment after approval' : ''}</span>
      {r.note && <span className="rec-request__text">“{r.note}”</span>}
      {r.review_note && <span className="rec-request__text">Reply: {r.review_note}</span>}
      {r.unavailable_reason && <span className="rec-request__text">{r.unavailable_reason}</span>}
      <span className="rec-request__text gk-faint">Access: {access(r.permissions) || 'no club workspace tools'}</span>
    </span>
    <span className="gk-list-row__trail rec-trail-wrap">
      <Badge tone={tone(r.effective_status ?? r.status)}>{label(r.effective_status ?? r.status)}</Badge>
      {controls && r.status === 'PENDING' && r.user_id !== data.actorId && r.effective_status !== 'UNAVAILABLE' && <>
        <Button size="sm" disabled={busy} onClick={() => { setReply(''); setDecision({ request: r, status: 'APPROVED' }); }}>Review & approve</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setReply(''); setDecision({ request: r, status: 'DECLINED' }); }}>Decline</Button></>}
      {r.status === 'PENDING' && r.user_id === data.actorId && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => post(`${rolesRoot(club)}/requests/${r.id}`, { status: 'WITHDRAWN', revision: r.revision }), 'Request withdrawn.')}>Withdraw request</Button>}
    </span>
  </div></li>;

  return <PageFrame className="rec-page">
    <PageHeader title="Staff roles" subtitle="Assign responsibilities to your staff and decide on the changes they ask for. Nothing changes until the person or a club admin confirms."
      actions={!assigning && <Button variant="primary" onClick={() => { initial.current = draft; setAssigning(true); }}><Plus aria-hidden="true" />Assign a role</Button>} />
    <div className="gk-stack">
      {error && <div className="gk-notice gk-notice--danger" role="alert">{error}</div>}
      {done && <div className="gk-notice cw-notices__success" role="status">{done}</div>}
      {assigning && <Panel flush title="Assign a staff role">
        <form className="rec-form__group" onSubmit={e => { e.preventDefault(); assign(); }}><fieldset disabled={busy} className="gk-stack gk-stack--tight">
          <div className="rec-fields">
            <Field label="Find a person" htmlFor="role-person-search"><div className="gk-row"><input id="role-person-search" className="gk-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Name or username" />
              <Button disabled={query.trim().length < 2} onClick={() => { setError(''); void get<Choice[]>(`${root(club)}/staff-candidates?q=${encodeURIComponent(query)}`).then(setMatches).catch(e => setError(extractApiErrorMessage(e, 'Search failed.'))); }}><Search aria-hidden="true" />Search</Button></div></Field>
            <Field label="Person" htmlFor="role-person"><select id="role-person" className="gk-input" required value={person} onChange={e => setPerson(e.target.value)}><option value="">{matches.length ? 'Choose a person' : 'Search first'}</option>{matches.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field label="Role" htmlFor="role-key" hint={selected?.description}><select id="role-key" className="gk-input" required value={role} onChange={e => setRole(e.target.value)}>{data.catalog.map(r => <option key={r.key} value={r.key}>{r.title}</option>)}</select></Field>
            <Field label={<>End date <span className="rec-optional">(optional)</span></>} htmlFor="role-ends"><input id="role-ends" className="gk-input" type="date" min={new Date().toISOString().slice(0, 10)} value={ends} onChange={e => setEnds(e.target.value)} /></Field>
            <div className="rec-wide"><ScopeChips squads={data.requestSquads} value={scope} onChange={setScope} disabled={busy} /></div>
          </div>
          <p className="gk-muted">Includes: {access(selected?.permissions ?? []) || 'no club workspace tools'}. The person accepts before access starts. This creates a volunteer appointment; employment terms and custom access are set in Staff.</p>
          <div className="gk-row"><Button type="submit" variant="primary" disabled={busy}>{busy ? 'Sending…' : 'Send role invitation'}</Button><Button variant="ghost" disabled={busy} onClick={requestClose}>Cancel</Button></div>
          {confirmation}
        </fieldset></form>
      </Panel>}
      {decision && <Panel flush title={decision.status === 'APPROVED' ? 'Approve this role change?' : 'Decline this request?'}>
        <form className="rec-form__group" onSubmit={e => { e.preventDefault(); void run(() => post(`${rolesRoot(club)}/requests/${decision.request.id}`, { status: decision.status, revision: decision.request.revision, note: reply || null }), decision.status === 'APPROVED' ? 'Role change approved.' : 'Request declined.'); }}>
          <p className="gk-muted">{decision.status === 'APPROVED' ? `${decision.request.name} gets ${title(decision.request).toLowerCase()} access straight away. A replaced appointment ends.` : 'Their current access stays as it is.'}</p>
          <Field label={<>Reply <span className="rec-optional">(optional)</span></>} htmlFor="role-reply"><textarea id="role-reply" className="gk-input" value={reply} maxLength={1000} onChange={e => setReply(e.target.value)} /></Field>
          <div className="gk-row"><Button type="submit" variant={decision.status === 'APPROVED' ? 'primary' : 'danger'} disabled={busy}>{decision.status === 'APPROVED' ? 'Confirm approval' : 'Confirm decline'}</Button><Button variant="ghost" disabled={busy} onClick={() => setDecision(null)}>Go back</Button></div>
        </form>
      </Panel>}
      <Section title="Waiting for a decision" hint={waiting.length ? `${waiting.length}` : undefined}>
        <Panel flush>{waiting.length ? <List label="Waiting for a decision">{waiting.map(r => request(r, true))}</List> : <EmptyNote title="No role requests to review">Requests staff send for new responsibilities appear here.</EmptyNote>}</Panel>
      </Section>
      <Section title="Earlier requests">
        <Panel flush>{others.length ? <List label="Earlier requests">{others.map(r => request(r, false))}</List> : <EmptyNote title="No earlier requests" />}</Panel>
      </Section>
    </div>
  </PageFrame>;
}
