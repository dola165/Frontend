import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { isCurrentAuthSession } from '../../../utils/authStorage';
import { emitNotificationsChanged } from '../../../utils/notifications';
import { getInvitationReceipt, getTeamInvitations, getVenueInvitations, respondToOrganizationInvitation, type Invitation } from './invitationsApi';
import { useInvitationCopy } from './invitationCopy';
import './setup.css';
import '../../journey/components/relationship-actions.css';

const captions: Record<string, string> = { ADMIN: 'admin', STAFF: 'staff', VENUE_OPERATOR: 'venue operator', OWNER: 'owner', PENDING: 'pending', ACCEPTED: 'accepted', DECLINED: 'declined', CANCELLED: 'cancelled', EXPIRED: 'expired' };
type Load = { attempt: number; rows: Invitation[]; error: string };
export function OrganizationInvitationInbox({ onAccepted, targetId, standalone = false }: { onAccepted?: () => void; targetId?: string; standalone?: boolean }) {
  const { sessionId, user } = useAuth();
  const [search] = useSearchParams();
  const target = targetId ?? search.get('itemId') ?? '';
  return <Inbox key={`${sessionId}:${user?.id}:${target}`} target={target} standalone={standalone} onAccepted={onAccepted} />;
}
function Inbox({ target, standalone, onAccepted }: { target: string; standalone: boolean; onAccepted?: () => void }) {
  const { sessionId, refreshNavigationCapabilities } = useAuth();
  const pc = useInvitationCopy();
  const [result, setResult] = useState<Load | null>(null), [attempt, setAttempt] = useState(0);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const submitting = useRef(false), alive = useRef(false), focused = useRef(false), panel = useRef<HTMLElement>(null);
  const current = () => alive.current && isCurrentAuthSession(sessionId);
  const loaded = result?.attempt === attempt;
  const rows = loaded ? result?.rows ?? [] : [];
  const shown = target ? rows : rows.filter(row => row.status === 'PENDING');
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const refresh = () => { if (isCurrentAuthSession(sessionId)) setAttempt(v => v + 1); };
    window.addEventListener('focus', refresh); window.addEventListener('requests-updated', refresh); window.addEventListener('talanti:notifications-changed', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('requests-updated', refresh); window.removeEventListener('talanti:notifications-changed', refresh); };
  }, [sessionId]);
  useEffect(() => {
    const controller = new AbortController();
    const valid = () => !controller.signal.aborted && isCurrentAuthSession(sessionId);
    const load = async () => {
      if (target) {
        if (!/^[1-9]\d*$/.test(target) || !Number.isSafeInteger(Number(target))) { if (valid()) setResult({ attempt, rows: [], error: 'This invitation is unavailable.' }); return; }
        try { const receipt = await getInvitationReceipt(target, controller.signal); if (valid()) setResult({ attempt, rows: [receipt], error: '' }); }
        catch (failure) { if (valid()) setResult({ attempt, rows: [], error: extractApiErrorMessage(failure, '') || 'This invitation is unavailable.' }); }
      } else {
        const replies = await Promise.allSettled([getTeamInvitations(controller.signal), getVenueInvitations(controller.signal)]);
        if (valid()) setResult({ attempt, rows: replies.flatMap<Invitation>(r => r.status === 'fulfilled' ? r.value : []), error: replies.some(r => r.status === 'rejected' && r.reason?.response?.status !== 403) ? 'Some invitations could not be loaded. Retry to check for pending invitations.' : '' });
      }
    };
    void load(); return () => controller.abort();
  }, [attempt, target, sessionId]);
  useEffect(() => { if (target && loaded && shown.length && !focused.current) { focused.current = true; panel.current?.focus({ preventScroll: true }); } }, [target, loaded, shown.length]);
  async function respond(invitation: Invitation, action: 'ACCEPT' | 'DECLINE') {
    if (submitting.current || !current()) return;
    submitting.current = true; setBusy(true); setError(''); setMessage('');
    try {
      await respondToOrganizationInvitation(invitation, action);
      if (!current()) return;
      setMessage('Your response was saved. Check your current access below.');
      window.dispatchEvent(new Event('requests-updated')); emitNotificationsChanged();
      if (action === 'ACCEPT') {
        onAccepted?.();
        await refreshNavigationCapabilities().catch(() => { if (current()) setError('Invitation accepted. Reload to refresh your navigation.'); });
      }
    } catch (failure) { if (current()) setError(extractApiErrorMessage(failure, '') || 'Could not respond to this invitation.'); }
    finally { submitting.current = false; if (current()) { setBusy(false); setAttempt(v => v + 1); } }
  }
  const failure = error || (loaded ? result?.error ?? '' : '');
  if (!standalone && !target && !shown.length && !failure && !message) return null;
  return <section className="relationship-panel org-invitation-inbox" aria-label={pc('Organization invitations')} tabIndex={-1} ref={panel}>
    <h2>{pc('Organization invitations')}</h2>
    {!loaded && <p role="status">{pc('Loading invitations…')}</p>}
    {failure && <p role="alert">{pc(failure)} <button type="button" disabled={busy} onClick={() => { setError(''); setAttempt(v => v + 1); }}>{pc('Retry')}</button></p>}
    {message && <p role="status">{pc(message)} <Link to="/my-organizations">{pc('My organizations')}</Link></p>}
    {standalone && loaded && !shown.length && !failure && <p>{pc('No pending invitations.')}</p>}
    {shown.map(invitation => <article key={invitation.id} className="sd-panel rc-journey-card">
      <h3>{invitation.organizationName}</h3><p>{pc(invitation.recipient === false ? 'Invitation role: {role}' : 'Invited as {role}', { role: pc(captions[invitation.role] ?? invitation.role) })}</p>
      <p>{pc('Invitation {status}.', { status: pc(captions[invitation.status] ?? invitation.status) })}</p>
      {invitation.status === 'PENDING' && <>
        {invitation.recipient !== false && invitation.canRespond !== true && <p>{pc('This invitation no longer grants access. Contact the organization’s leadership for a new invitation.')}</p>}
        <div className="relationship-actions">
          {invitation.canRespond === true && <button type="button" className="relationship-primary" disabled={busy} onClick={() => void respond(invitation, 'ACCEPT')}>{pc('Accept responsibility')}</button>}
          {(invitation.canDecline ?? invitation.canRespond) === true && <button type="button" disabled={busy} onClick={() => void respond(invitation, 'DECLINE')}>{pc('Decline')}</button>}
        </div>
      </>}
      {invitation.status === 'ACCEPTED' && <p>{pc(invitation.recipient && invitation.canOpenWorkspace === false ? 'Organization access has ended. Ask the current leadership for a new invitation.' : 'Workspace access depends on your current responsibilities.')}</p>}
      {invitation.canOpenWorkspace && <Link to={`/organizations/${invitation.organizationId}/workspace?tab=team`}>{pc('Open workspace')}</Link>}
    </article>)}
    {standalone && <Link to="/my-organizations">{pc('My organizations')}</Link>}
  </section>;
}
