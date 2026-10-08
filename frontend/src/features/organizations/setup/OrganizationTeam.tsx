import { EmptyState } from '../../../components/ui/EmptyState';
import { MailOpen } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { OrganizationInvitationInbox } from './OrganizationInvitationInbox';
import { apiClient } from '../../../api/axiosConfig';
import { extractApiErrorMessage } from '../../../utils/apiError';
interface Invitation { id: number; organizationId: number; organizationName: string; recipientName: string | null; role: string; status: string; canRespond: boolean }
interface Team { members: { id: number; userId: number; name: string | null; role: string; canRemove: boolean }[]; invitations: Invitation[]; canInviteAdmin: boolean }
export function OrganizationTeam({ id }: { id: number }) {
  const [team, setTeam] = useState<Team | null>(null), [email, setEmail] = useState(''), [role, setRole] = useState('STAFF');
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(0);
  const [removing, setRemoving] = useState<Team['members'][number] | null>(null);
  const active = useRef(true), submitting = useRef(false);
  useEffect(() => { const controller = new AbortController(); active.current = true; void apiClient.get<Team>(`/organizations/${id}/team`, { signal: controller.signal }).then(r => { if (!controller.signal.aborted) setTeam(r.data); }).catch(e => { if (!controller.signal.aborted) setError(extractApiErrorMessage(e, 'Could not load the team.')); }); return () => { controller.abort(); active.current = false; }; }, [id, attempt]);
  async function mutate(path: string, payload?: object) {
    if (submitting.current) return; submitting.current = true; setBusy(true); setError(''); setMessage('');
    try { const response = await apiClient.post<Team>(`/organizations/${id}/team/${path}`, payload); if (active.current) { setTeam(response.data); setEmail(''); setRemoving(null); setMessage(path === 'invitations' ? 'Invitation sent. They can respond from the notification or their account.' : 'Team access updated.'); } }
    catch (err) { if (active.current) setError(extractApiErrorMessage(err, 'Could not update the team.')); }
    finally { submitting.current = false; if (active.current) setBusy(false); }
  }
  function invite(event: FormEvent) { event.preventDefault(); void mutate('invitations', { email: email.trim(), role }); }
  return <section className="org-setup-card"><h2>Team and access</h2><p>Invite an existing registered adult. They receive access after accepting the responsibility you approve.</p>{error && <p role="alert">{error} {!team && <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry</button>}</p>}{message && <p role="status">{message}</p>}
    {!team ? <p role="status">Loading team…</p> : <><form onSubmit={invite}><fieldset disabled={busy} className="org-setup-fields"><label>Email<input type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label><label>Responsibility<select value={role} onChange={e => setRole(e.target.value)}><option value="STAFF">Staff · organize tournaments</option>{team.canInviteAdmin && <option value="ADMIN">Administrator · manage this organization</option>}</select></label><button className="org-setup-primary">Invite team member</button></fieldset></form>
      <div className="org-setup-table"><table><thead><tr><th>Member</th><th>Responsibility</th><th>Access</th></tr></thead><tbody>{team.members.map(member => <tr key={member.id}><td>{member.name || 'Member'}</td><td>{member.role}</td><td>{member.canRemove ? <button type="button" disabled={busy} onClick={() => setRemoving(member)}>Remove access</button> : 'Active'}</td></tr>)}</tbody></table></div>
      {removing && <section className="org-setup-notice" aria-label="Confirm removal"><h3>Remove {removing.name || 'this member'}’s organization access?</h3><p>They will no longer be able to use this responsibility to manage the organization.</p><div className="org-setup-actions"><button type="button" disabled={busy} onClick={() => void mutate(`members/${removing.id}/remove`)}>Remove access</button><button type="button" disabled={busy} onClick={() => setRemoving(null)}>Keep access</button></div></section>}
      <h3>Invitations</h3>{!team.invitations.length && <EmptyState compact icon={MailOpen} title="No invitations yet." description="Invite a registered team member using the form above. You choose their responsibility; access starts after they accept."/>}{team.invitations.map(invite => <div key={invite.id} className="org-setup-actions"><span>{invite.recipientName || 'Registered member'} · {invite.role} · {invite.status}</span>{invite.status === 'PENDING' && (invite.role !== 'ADMIN' || team.canInviteAdmin) && <button type="button" disabled={busy} onClick={() => void mutate(`invitations/${invite.id}/cancel`)}>Cancel invitation</button>}</div>)}
    </>}
  </section>;
}
export const OrganizationTeamInvitations = OrganizationInvitationInbox;
