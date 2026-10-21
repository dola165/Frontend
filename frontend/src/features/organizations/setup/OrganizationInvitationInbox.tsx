import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../../api/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { usePagesCopy } from '../../pages/copy';
import './setup.css';
import '../../journey/components/relationship-actions.css';

interface Invitation { id: number; organizationId: number; organizationName: string; role: string; status: string; canRespond?: boolean; recipient?: boolean; kind: 'team' | 'venue' }
const roleCaptions: Record<string, string> = { ADMIN: 'admin', STAFF: 'staff', VENUE_OPERATOR: 'venue operator' };
const statusCaptions: Record<string, string> = { PENDING: 'pending', ACCEPTED: 'accepted', DECLINED: 'declined', CANCELLED: 'cancelled', EXPIRED: 'expired' };
type InboxError = { message: string; ownCopy: boolean };
const invitationError = (error: unknown, fallback: string): InboxError => {
  const message = extractApiErrorMessage(error, '');
  return { message: message || fallback, ownCopy: !message };
};
export function OrganizationInvitationInbox({ onAccepted }: { onAccepted?: () => void }) {
  const { refreshNavigationCapabilities } = useAuth();
  const pc = usePagesCopy();
  const caption = (value: string, known: Record<string, string>) => Object.hasOwn(known, value) ? pc(known[value]) : value;
  const [search] = useSearchParams();
  const target = search.get('itemId');
  const [rows, setRows] = useState<Invitation[]>([]), [receipt, setReceipt] = useState<Invitation | null>(null);
  const [error, setError] = useState<InboxError | null>(null), [message, setMessage] = useState(''), [attempt, setAttempt] = useState(0), [busy, setBusy] = useState(false);
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
      if (results.some(r => r.status === 'rejected' && r.reason?.response?.status !== 403)) setError({ message: 'Some invitations could not be loaded. Retry to check for pending invitations.', ownCopy: true });
      if (target && /^[1-9]\d*$/.test(target)) {
        try {
          const result = await apiClient.get<Invitation>(`/organizations/invitation-notices/${target}`, { signal: controller.signal });
          if (!controller.signal.aborted) setReceipt(result.data);
        } catch (e) { if (!controller.signal.aborted) setError(invitationError(e, 'This invitation is unavailable.')); }
      } else setReceipt(null);
    };
    void load(); return () => controller.abort();
  }, [attempt, target]);
  async function respond(invitation: Invitation, action: 'ACCEPT' | 'DECLINE') {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError(null); setMessage('');
    try {
      const family = invitation.kind === 'venue' ? 'invitations' : 'team-invitations';
      await apiClient.post(`/organizations/${family}/${invitation.id}/response`, { action });
      setAttempt(v => v + 1); setMessage(action === 'ACCEPT' ? 'Responsibility accepted. Your workspace is ready in My organizations.' : 'Invitation declined. The sender has been notified.');
      if (action === 'ACCEPT') { onAccepted?.(); await refreshNavigationCapabilities().catch(() => setError({ message: 'Invitation accepted. Reload to refresh your navigation.', ownCopy: true })); }
    } catch (e) { setError(invitationError(e, 'Could not respond to this invitation.')); setAttempt(v => v + 1); }
    finally { submitting.current = false; setBusy(false); }
  }
  const pending = rows.filter(row => row.status === 'PENDING');
  if (!pending.length && !receipt && !error && !message) return null;
  return <section className="relationship-panel" aria-label={pc('Organization invitations')} tabIndex={-1} ref={panel}>
    <h2>{pc('Organization invitations')} {pending.length > 0 && `(${pending.length})`}</h2>
    {error && <p role="alert">{error.ownCopy ? pc(error.message) : error.message} <button type="button" onClick={() => { setError(null); setAttempt(v => v + 1); }}>{pc('Retry')}</button></p>}
    {message && <p role="status">{pc(message)} <Link to="/my-organizations">{pc('My organizations')}</Link></p>}
    {receipt && !pending.some(i => i.id === receipt.id) && <article className="org-setup-notice"><h3>{receipt.organizationName}</h3><p>{pc('Invitation {status}.', { status: caption(receipt.status, statusCaptions) })} {receipt.status === 'EXPIRED' ? pc('Ask the organization’s leadership for a new invitation.') : receipt.status === 'ACCEPTED' ? pc('Workspace access depends on your current responsibilities.') : ''}</p><Link to="/my-organizations">{pc('My organizations')}</Link></article>}
    {pending.sort((a,b) => Number(b.id === Number(target)) - Number(a.id === Number(target))).map(invitation => <article key={invitation.id} className="sd-panel rc-journey-card">
      <h3>{invitation.organizationName}</h3><p>{pc('Invited as {role}', { role: caption(invitation.role, roleCaptions) })}</p>
      {invitation.canRespond ? <div className="relationship-actions"><button type="button" className="relationship-primary" disabled={busy} onClick={() => void respond(invitation, 'ACCEPT')}>{pc('Accept responsibility')}</button><button type="button" disabled={busy} onClick={() => void respond(invitation, 'DECLINE')}>{pc('Decline')}</button></div> : <p>{pc('This invitation no longer grants access. Contact the organization’s leadership for a new invitation.')}</p>}
    </article>)}
  </section>;
}
