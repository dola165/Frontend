import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../api/axiosConfig';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { useAuth } from '../../../context/AuthContext';
import { clearDeparture, loadDeparture, storeDeparture, type OrganizationDeparture } from './departureRecovery';

interface Lifecycle {
  role: string; canLeave: boolean; canTransfer: boolean; departureSnapshot: string | null;
  recipients: { id: number; name: string }[];
  transfers: { id: number; recipient_name: string; status: string; expires_at: string; can_respond: boolean }[];
}
export function OrganizationLifecycle({ id, onChanged }: { id: number; onChanged: () => void }) {
  const { user } = useAuth();
  return <OrganizationLifecycleActor key={`${user?.id ?? 'anonymous'}:${id}`} id={id} actorId={user?.id ?? null} onChanged={onChanged} />;
}
function OrganizationLifecycleActor({ id, actorId, onChanged }: { id: number; actorId: number | null; onChanged: () => void }) {
  const [data, setData] = useState<Lifecycle | null>(null), [recipient, setRecipient] = useState('');
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [leaving, setLeaving] = useState(false), [attempt, setAttempt] = useState(0);
  const submitting = useRef(false), navigate = useNavigate();
  const { refreshNavigationCapabilities } = useAuth();
  const [pending, setPending] = useState<OrganizationDeparture | null>(() => loadDeparture(actorId, id));
  const [reviewed, setReviewed] = useState<{ snapshot: string; role: string } | null>(null);
  useEffect(() => { const controller = new AbortController(); void apiClient.get<Lifecycle>(`/organizations/${id}/lifecycle`, { signal: controller.signal }).then(r => { if (!controller.signal.aborted) setData(r.data); }).catch(e => { if (!controller.signal.aborted) setError(extractApiErrorMessage(e, 'Could not load membership and ownership.')); }); return () => controller.abort(); }, [id, attempt]);
  async function run(path: string, payload?: object) {
    if (submitting.current) return; submitting.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const response = await apiClient.post<Lifecycle>(`/organizations/${id}/${path}`, payload);
      if (path === 'leave') { if (actorId !== null) clearDeparture(actorId, id); setPending(null); await refreshNavigationCapabilities(); navigate('/my-organizations', { replace: true }); return; }
      setData(response.data); setNotice('Ownership decision recorded. Access follows current responsibilities.');
      await refreshNavigationCapabilities(); onChanged();
    } catch (e) { setError(extractApiErrorMessage(e, 'Could not update your membership.')); setAttempt(n => n + 1); }
    finally { submitting.current = false; setBusy(false); }
  }
  function propose(e: FormEvent) { e.preventDefault(); void run('ownership-transfers', { recipientId: Number(recipient) }); }
  function depart() {
    if (actorId === null || submitting.current) return;
    const command = pending ?? (reviewed ? { requestId: crypto.randomUUID(), snapshot: reviewed.snapshot } : null);
    if (!command) return;
    try { storeDeparture(actorId, id, command); }
    catch { setError('Could not save this departure for retry. Enable session storage and try again.'); return; }
    setPending(command); void run('leave', command);
  }
  function reviewCurrent() {
    if (actorId !== null) clearDeparture(actorId, id);
    setPending(null); setLeaving(false); setReviewed(null); setData(null); setError(''); setAttempt(n => n + 1);
  }
  return <section className="org-setup-card" aria-label="Membership and ownership"><h2>Membership and ownership</h2>
    {error && <p role="alert">{error} <button disabled={busy} onClick={() => { setError(''); setAttempt(n => n + 1); }}>Reload</button></p>}{notice && <p role="status">{notice}</p>}
    {pending && <div><p>An earlier departure needs a result. Retry it to check that outcome, or review your current membership before making a new decision.</p><button disabled={busy} onClick={depart}>Retry earlier departure</button><button disabled={busy} onClick={reviewCurrent}>Review current membership</button></div>}
    {!data ? <p role="status">Loading membership…</p> : <><p>Your responsibility: {data.role.toLowerCase().replaceAll('_', ' ')}.</p>
      {data.canTransfer && <form onSubmit={propose}><p>Choose a current member to accept ownership. You remain an administrator after acceptance. Bookings and organization duties stay with the organization; pending invitations you issued are cancelled.</p><fieldset disabled={busy}><label>New owner<select required value={recipient} onChange={e => setRecipient(e.target.value)}><option value="">Choose a member</option>{data.recipients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button disabled={!recipient}>Propose ownership transfer</button></fieldset></form>}
      {data.transfers.map(t => <article key={t.id}><p>Ownership to {t.recipient_name}: {t.status.toLowerCase()}. Response deadline: {new Date(t.expires_at).toLocaleDateString()}.</p>
        {t.can_respond && <div className="org-setup-actions"><button disabled={busy} onClick={() => void run(`ownership-transfers/${t.id}/response`, { action: 'ACCEPT' })}>Accept ownership</button><button disabled={busy} onClick={() => void run(`ownership-transfers/${t.id}/response`, { action: 'DECLINE' })}>Decline ownership</button></div>}
        {data.canTransfer && t.status === 'PENDING' && <button disabled={busy} onClick={() => void run(`ownership-transfers/${t.id}/cancel`)}>Cancel transfer</button>}
      </article>)}
      {!pending && (data.canLeave ? <><p>Leaving ends your organization access and its tournament staff assignments. Assign another administrator first if you are the last administrator of an unfinished tournament.</p>{leaving ? <div className="org-setup-actions"><p>End your reviewed {reviewed?.role.toLowerCase()} responsibility.</p><button disabled={busy || !reviewed} onClick={depart}>Confirm departure</button><button disabled={busy} onClick={() => { setLeaving(false); setReviewed(null); }}>Keep membership</button></div> : <button disabled={busy || actorId === null || !data.departureSnapshot} onClick={() => { if (data.departureSnapshot) setReviewed({ snapshot: data.departureSnapshot, role: data.role }); setLeaving(true); }}>Leave organization</button>}</> : <p>Accept an ownership handover before the current owner can leave.</p>)}
    </>}
  </section>;
}
