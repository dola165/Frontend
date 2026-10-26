import { promptEmailConfirmation } from '../../../../components/auth/emailConfirmationPrompt';
import { useEffect, useId, useRef, useState } from 'react';
import { Check, Copy, MessageCircle } from 'lucide-react';
import { Avatar, Button, ButtonLink, List, ListRow } from '../../../../design/primitives';
import { fetchStaffCandidates, inviteStaff, type StaffRole } from '../../api';
import { extractApiErrorMessage } from '../../../../utils/apiError';
import { usePagesCopy } from '../../copy';
import { usePageEdit } from '../context';
import { SplitPanel } from '../SplitPanel';

const ROLES: [StaffRole, string][] = [['COACH', 'Coach'], ['ASSISTANT', 'Assistant'], ['ADMIN', 'Admin']];
const ROLE_WORD: Record<StaffRole, string> = { COACH: 'Coach', ASSISTANT: 'Assistant coach', ADMIN: 'Club administrator' };
const localToday = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const ENGAGEMENT: Record<string, string> = { EMPLOYEE: 'Employee', VOLUNTEER: 'Volunteer', CONTRACTOR: 'Contractor', SHARED_STAFF: 'Shared staff' };

/**
 * A real account receives a recorded proposal; its link keeps the recipient and team scope fixed.
 */
export function StaffPanel() {
  const t = usePagesCopy();
  const { page, replace, closePanel, openPanel } = usePageEdit();
  const [draft, setDraft] = useState<{ name: string; userId: number | null; role: StaffRole; squadId: number | null; engagement: string; startsOn: string }>({ name: '', userId: null, role: 'COACH', squadId: page?.boxes.squads.items[0]?.id ?? null, engagement: '', startsOn: localToday() });
  const [people, setPeople] = useState<{ id: number; name: string }[]>([]);
  const [error, setError] = useState('');
  const [looking, setLooking] = useState(false);
  const attempt = useRef<{ key: string; id: string } | null>(null);
  const clubId = page?.clubId;
  useEffect(() => {
    if (!clubId || draft.userId || draft.name.trim().length < 2) return;
    const controller = new AbortController();
    fetchStaffCandidates({ type: 'club', id: clubId }, draft.name, controller.signal).then(found => { if (!controller.signal.aborted) setPeople(found); })
      .catch(failure => { if (!controller.signal.aborted) setError(extractApiErrorMessage(failure, t('Could not find staff accounts. Try again.'))); })
      .finally(() => { if (!controller.signal.aborted) setLooking(false); });
    return () => controller.abort();
  }, [clubId, draft.name, draft.userId, t]);
  const [copied, setCopied] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  if (!page) return null;
  if (page.kind !== 'CLUB') return <SplitPanel title={t('Team')} onClose={closePanel}><ButtonLink to={`/organizations/${page.ref.id}/workspace?tab=team`}>{t('Manage your organization team')}</ButtonLink></SplitPanel>;
  if (page.status !== 'LIVE') return <SplitPanel title={t('Invite coaches & staff')} onClose={closePanel}><p>{t('Publish the club before sharing invitations.')}</p><Button onClick={() => openPanel('live')}>{t('Go live')}</Button></SplitPanel>;
  const invites = page.boxes.staff.invites, members = page.boxes.staff.members, squads = page.boxes.squads.items;
  const club = page.kind === 'CLUB';
  const url = (code: string) => `${window.location.origin}/invite/${code}`;
  const add = async () => {
    if (busy || !draft.userId || (draft.role !== 'ADMIN' && (!draft.engagement || !draft.startsOn))) return;
    const body = { userId: draft.userId, role: draft.role, squadId: draft.role === 'ADMIN' ? null : draft.squadId, engagement: draft.role === 'ADMIN' ? 'VOLUNTEER' : draft.engagement, startsOn: draft.startsOn };
    const key = JSON.stringify(body); if (attempt.current?.key !== key) attempt.current = { key, id: crypto.randomUUID() };
    setBusy(true); setError('');
    try {
      replace(await inviteStaff(page.ref, { ...body, requestId: attempt.current.id }));
      setDraft({ ...draft, name: '', userId: null }); setPeople([]); attempt.current = null;
    } catch (failure) { if (!promptEmailConfirmation(failure)) setError(extractApiErrorMessage(failure, t('Could not make the invitation. Try again.'))); } finally { setBusy(false); }
  };
  const copy = async (invite: { id: number; code: string }) => { try { await navigator.clipboard.writeText(url(invite.code)); setCopied(invite.id); window.setTimeout(() => setCopied(null), 2000); } catch { setCopied(null); } };
  const message = (invite: { name: string; role: StaffRole; code: string; squadId: number | null }) => {
    const squad = squads.find(item => item.id === invite.squadId)?.name;
    return encodeURIComponent(t('{page} invites you to join as {role}{squad}: {url}', { page: page.identity.name, role: t(ROLE_WORD[invite.role]).toLowerCase(), squad: squad ? ` (${squad})` : '', url: url(invite.code) }));
  };
  return (
    <SplitPanel title={t(club ? 'Invite coaches & staff' : 'Who runs it with you?')} description={t('Choose their account and responsibilities. They review and accept before access starts.')} onClose={closePanel}
      footer={<Button variant="primary" onClick={closePanel}>{t('Done')}</Button>}
      preview={<div className="gk-boxedit">
        <p className="gk-field__label">{t('In the team')}</p>
        <List label={t('In the team')}>{members.map(member => <ListRow key={member.userId} lead={<Avatar src={member.avatarUrl} name={member.fullName} size={32} />} title={member.fullName} meta={t(member.title)} />)}</List>
      </div>}>
      <div className="gk-boxedit">
        <div className="gk-boxedit__row">
          <input className="gk-input" value={draft.name} placeholder={t('Type their name')} aria-label={t('Find their account')} maxLength={80} autoFocus onChange={event => { const name = event.target.value; setDraft({ ...draft, name, userId: null }); setPeople([]); setError(''); setLooking(name.trim().length >= 2); }} />
        </div>
        {!draft.userId && draft.name.trim().length >= 2 && (looking ? <p role="status">{t('Looking for accounts…')}</p> : people.length ? <List label={t('Staff accounts')}>{people.map(person => <ListRow key={person.id} onClick={() => setDraft({ ...draft, name: person.name, userId: person.id })} title={person.name} />)}</List> : <p className="gk-muted">{t('No eligible account found. Ask them to sign up and verify their email, then search again.')}</p>)}
        {draft.userId && <p>{t('Inviting {name}', { name: draft.name })}</p>}
        <div className="gk-ctowns" role="group" aria-label={t('Role')}>
          {ROLES.map(([role, word]) => <button key={role} type="button" className="gk-chip" aria-pressed={draft.role === role} onClick={() => setDraft({ ...draft, role })}>{t(word)}</button>)}
          {squads.length > 0 && draft.role !== 'ADMIN' && <select className="gk-input" style={{ width: 'auto', minHeight: 44 }} aria-label={t('Team')} value={draft.squadId ?? ''} onChange={event => setDraft({ ...draft, squadId: event.target.value ? Number(event.target.value) : null })}>
            <option value="">{t('Whole club')}</option>{squads.map(squad => <option key={squad.id} value={squad.id}>{squad.name}</option>)}
          </select>}
        </div>
        {draft.role === 'ADMIN' ? <p>{t('Club administration covers the whole club.')}</p> : <>
          <p className="gk-muted">{t(draft.role === 'COACH' ? 'Attendance, development, readiness and match preparation; read availability and facilities.' : 'Attendance and development; read availability and facilities.')}</p>
          <label className="gk-field"><span className="gk-field__label">{t('Engagement')}</span><select className="gk-input" value={draft.engagement} onChange={event => setDraft({ ...draft, engagement: event.target.value })}><option value="">{t('Choose the engagement')}</option>{Object.entries(ENGAGEMENT).map(([value, word]) => <option key={value} value={value}>{t(word)}</option>)}</select></label>
          <label className="gk-field"><span className="gk-field__label">{t('Starts on')}</span><input className="gk-input" type="date" value={draft.startsOn} onChange={event => setDraft({ ...draft, startsOn: event.target.value })} /></label>
        </>}
        {error && <p role="alert" className="gk-notice gk-notice--warning">{error}</p>}
        <div className="gk-boxedit__foot"><Button size="sm" variant="primary" disabled={busy || !draft.userId || (draft.role !== 'ADMIN' && (!draft.engagement || !draft.startsOn))} onClick={() => void add()}>{t('Make the invitation')}</Button></div>
        {invites.length > 0 && <>
          <p className="gk-field__label" id={`${id}-invites`}>{t('Invitations')}</p>
          <List label={t('Invitations')}>{invites.map(invite => (
            <li key={invite.id} className="gk-boxedit__row">
              <div className="gk-list-row" style={{ flex: 1 }}><Avatar name={invite.name || invite.phone} size={32} /><span className="gk-list-row__main"><span className="gk-list-row__title">{invite.name || invite.phone}</span><span className="gk-list-row__meta">{[t(ROLE_WORD[invite.role]), squads.find(item => item.id === invite.squadId)?.name, t(invite.status === 'JOINED' ? 'Joined' : invite.status === 'INVITED' ? 'Waiting' : invite.status === 'EXPIRED' ? 'Expired' : 'Cancelled')].filter(Boolean).join(' · ')}</span></span></div>
              {invite.status === 'INVITED' && invite.code && <>
                <Button size="sm" iconOnly aria-label={t('Copy link')} title={t('Copy link')} onClick={() => void copy(invite)}>{copied === invite.id ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}</Button>
                <a className="gk-btn gk-btn--secondary gk-btn--sm" href={`https://wa.me/?text=${message(invite)}`} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />WhatsApp</a>
              </>}
            </li>
          ))}</List>
        </>}
      </div>
    </SplitPanel>
  );
}
