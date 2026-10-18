import { EmptyState } from '../../../components/ui/EmptyState';
import { MailOpen } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { isCurrentAuthSession } from '../../../utils/authStorage';
import { emitNotificationsChanged } from '../../../utils/notifications';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { OrganizationInvitationInbox } from './OrganizationInvitationInbox';
import { getTeam, updateTeam, readInvitationDraft, saveInvitationDraft, type InvitationDraft, type Team } from './invitationsApi';
import { useInvitationCopy } from './invitationCopy';
import './setup.css';

export function OrganizationTeam({ id }: { id: number }) {
  const { sessionId, user } = useAuth();
  return <TeamPanel key={`${sessionId}:${user?.id}:${id}`} id={id} draftKey={`org-invite:${sessionId}:${user?.id}:${id}:team`} />;
}
function TeamPanel({ id, draftKey }: { id: number; draftKey: string }) {
  const { sessionId } = useAuth();
  const t = useInvitationCopy();
  const [saved] = useState(() => readInvitationDraft(draftKey));
  const [team, setTeam] = useState<Team | null>(null), [email, setEmail] = useState(saved?.email ?? ''), [role, setRole] = useState(saved?.role ?? 'STAFF');
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(0);
  const [removing, setRemoving] = useState<Team['members'][number] | null>(null);
  const active = useRef(false), submitting = useRef(false), command = useRef<InvitationDraft | null>(saved);
  const current = () => active.current && isCurrentAuthSession(sessionId);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    void getTeam(id, controller.signal).then(value => { if (!controller.signal.aborted && isCurrentAuthSession(sessionId)) setTeam(value); })
      .catch(failure => { if (!controller.signal.aborted && isCurrentAuthSession(sessionId)) setError(extractApiErrorMessage(failure, '') || 'Could not load the team.'); });
    return () => controller.abort();
  }, [id, attempt, sessionId]);
  async function mutate(path: string, payload?: object) {
    if (submitting.current || !current()) return;
    submitting.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const value = await updateTeam(id, path, payload);
      if (current()) {
        setTeam(value); setRemoving(null);
        if (path === 'invitations') { setEmail(''); command.current = null; saveInvitationDraft(draftKey, null); }
        setMessage(path === 'invitations' ? 'Invitation sent. They can respond in My organizations.' : 'Team access updated.');
        window.dispatchEvent(new Event('requests-updated')); emitNotificationsChanged();
      }
    } catch (failure) { if (current()) { setTeam(null); setRemoving(null); setError(extractApiErrorMessage(failure, '') || 'Could not update the team.'); } }
    finally { submitting.current = false; if (current()) setBusy(false); }
  }
  function invite(event: FormEvent) {
    event.preventDefault(); if (submitting.current) return;
    const normalized = email.trim();
    const previous = command.current;
    const next = previous?.email === normalized && previous.role === role ? previous : { email: normalized, role, requestId: crypto.randomUUID() };
    command.current = next; saveInvitationDraft(draftKey, next);
    void mutate('invitations', next);
  }
  const label = (value: string) => t(value.toLowerCase().replaceAll('_', ' '));
  return <section className="org-setup-card org-team-panel"><h2>{t('Team')}</h2>
    {error && <p role="alert">{t(error)} <button type="button" disabled={busy} onClick={() => { setError(''); setAttempt(v => v + 1); }}>{t('Retry')}</button></p>}
    {message && <p role="status">{t(message)}</p>}
    {!team ? !error && <p role="status">{t('Loading team…')}</p> : <>
      <form onSubmit={invite}><fieldset disabled={busy} className="org-setup-fields"><label>{t('Email')}<input type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label><label>{t('Responsibility')}<select value={role} onChange={e => setRole(e.target.value)}><option value="STAFF">{t('Staff · organize tournaments')}</option>{team.canInviteAdmin && <option value="ADMIN">{t('Administrator · manage this organization')}</option>}</select></label><button className="org-setup-primary" disabled={role === 'ADMIN' && !team.canInviteAdmin}>{t('Invite team member')}</button></fieldset></form>
      <div className="org-setup-table"><table><thead><tr><th>{t('Member')}</th><th>{t('Responsibility')}</th><th>{t('Access')}</th></tr></thead><tbody>{team.members.map(member => <tr key={member.id}><td>{member.name || t('Member')}</td><td>{label(member.role)}</td><td>{member.canRemove ? <button type="button" disabled={busy} onClick={() => setRemoving(member)}>{t('Remove access')}</button> : t('Active')}</td></tr>)}</tbody></table></div>
      {removing && <section className="org-setup-notice" aria-label={t('Confirm removal')}><h3>{t('Remove {name}’s organization access?', { name: removing.name || t('this member') })}</h3><p>{t('They will no longer be able to use this responsibility to manage the organization.')}</p><div className="org-setup-actions"><button type="button" disabled={busy} onClick={() => void mutate(`members/${removing.id}/remove`)}>{t('Remove access')}</button><button type="button" disabled={busy} onClick={() => setRemoving(null)}>{t('Keep access')}</button></div></section>}
      <h3>{t('Invitations')}</h3>{!team.invitations.length && <EmptyState compact icon={MailOpen} title={t('No invitations yet.')} description={t('Invite a registered team member using the form above. You choose their responsibility; access starts after they accept.')} />}
      {team.invitations.map(invite => <div key={invite.id} className="org-setup-actions"><span>{invite.recipientName || t('Registered member')} · {label(invite.role)} · {label(invite.status)}</span>{invite.status === 'PENDING' && (invite.role !== 'ADMIN' || team.canInviteAdmin) && <button type="button" disabled={busy} onClick={() => void mutate(`invitations/${invite.id}/cancel`)}>{t('Cancel invitation')}</button>}</div>)}
    </>}
  </section>;
}
export const OrganizationTeamInvitations = OrganizationInvitationInbox;
