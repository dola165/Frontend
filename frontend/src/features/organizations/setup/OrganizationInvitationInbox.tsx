import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../../api/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import './setup.css';
import '../../journey/components/relationship-actions.css';

interface Invitation { id: number; organizationId: number; organizationName: string; role: string; status: string; canRespond?: boolean; recipient?: boolean; kind: 'team' | 'venue' }
export function OrganizationInvitationInbox({ onAccepted }: { onAccepted?: () => void }) {
  const { refreshNavigationCapabilities } = useAuth();
  const [search] = useSearchParams();
  const target = search.get('itemId');
  const [rows, setRows] = useState<Invitation[]>([]), [receipt, setReceipt] = useState<Invitation | null>(null);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [attempt, setAttempt] = useState(0), [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const panel = useRef<HTMLElement>(null), focused = useRef<string | null>(null);
  useEffect(() => {
    if (target && focused.current !== target && (receipt?.id === Number(target) || rows.some(r => r.id === Number(target)))) {
      focused.current = target;
      panel.current?.focus({ preventScroll: true });
      panel.current?.scrollIntoView?.({ block: 'center' });
    }
  }, [receipt, rows, target]);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const results = await Promise.allSettled([
        apiClient.get<Invitation[]>('/organizations/team-invitations/mine', { signal: controller.signal }),
        apiClient.get<Invitation[]>('/organizations/invitations/mine', { signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      setRows(results.flatMap((r, index) => r.status === 'fulfilled' ? r.value.data.map(v => ({ ...v, role: index ? 'VENUE_OPERATOR' : v.role, kind: index ? 'venue' as const : 'team' as const })) : []));
      // These responsibilities require an eligible adult; other accounts still use the club journey.
      if (results.some(r => r.status === 'rejected' && r.reason?.response?.status !== 403)) setError('Some invitations could not be loaded. Retry to check for pending invitations.');
      if (target && /^[1-9]\d*$/.test(target)) {
        try {
          const result = await apiClient.get<Invitation>(`/organizations/invitation-notices/${target}`, { signal: controller.signal });
          if (!controller.signal.aborted) setReceipt(result.data);
        } catch (e) { if (!controller.signal.aborted) setError(extractApiErrorMessage(e, 'This invitation is unavailable.')); }
      } else setReceipt(null);
    };
    void load(); return () => controller.abort();
  }, [attempt, target]);
  async function respond(invitation: Invitation, action: 'ACCEPT' | 'DECLINE') {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const family = invitation.kind === 'venue' ? 'invitations' : 'team-invitations';
      await apiClient.post(`/organizations/${family}/${invitation.id}/response`, { action });
      setAttempt(v => v + 1); setMessage(action === 'ACCEPT' ? 'Responsibility accepted. Your workspace is ready in My organizations.' : 'Invitation declined. The sender has been notified.');
      if (action === 'ACCEPT') { onAccepted?.(); await refreshNavigationCapabilities().catch(() => setError('Invitation accepted. Reload to refresh your navigation.')); }
    } catch (e) { setError(extractApiErrorMessage(e, 'Could not respond to this invitation.')); setAttempt(v => v + 1); }
    finally { submitting.current = false; setBusy(false); }
  }
  const pending = rows.filter(row => row.status === 'PENDING');
  if (!pending.length && !receipt && !error && !message) return null;
  return <section className="relationship-panel" aria-label="Organization invitations" tabIndex={-1} ref={panel}>
    <h2>Organization invitations {pending.length > 0 && `(${pending.length})`}</h2>
    {error && <p role="alert">{error} <button type="button" onClick={() => { setError(''); setAttempt(v => v + 1); }}>Retry</button></p>}
    {message && <p role="status">{message} <Link to="/my-organizations">My organizations</Link></p>}
    {receipt && !pending.some(i => i.id === receipt.id) && <article className="org-setup-notice"><h3>{receipt.organizationName}</h3><p>Invitation {receipt.status.toLowerCase()}. {receipt.status === 'EXPIRED' ? 'Ask the organization’s leadership for a new invitation.' : receipt.status === 'ACCEPTED' ? 'Workspace access depends on your current responsibilities.' : ''}</p><Link to="/my-organizations">My organizations</Link></article>}
    {pending.sort((a,b) => Number(b.id === Number(target)) - Number(a.id === Number(target))).map(invitation => <article key={invitation.id} className="sd-panel rc-journey-card">
      <h3>{invitation.organizationName}</h3><p>Invited as {invitation.role.toLowerCase().replaceAll('_', ' ')}</p>
      {invitation.canRespond ? <div className="relationship-actions"><button type="button" className="relationship-primary" disabled={busy} onClick={() => void respond(invitation, 'ACCEPT')}>Accept responsibility</button><button type="button" disabled={busy} onClick={() => void respond(invitation, 'DECLINE')}>Decline</button></div> : <p>This invitation no longer grants access. Contact the organization’s leadership for a new invitation.</p>}
    </article>)}
  </section>;
}
