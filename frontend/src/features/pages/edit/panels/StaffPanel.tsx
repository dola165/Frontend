import { useId, useState } from 'react';
import { Check, Copy, MessageCircle } from 'lucide-react';
import { Avatar, Button, List, ListRow } from '../../../../design/primitives';
import type { StaffRole } from '../../api';
import { usePagesCopy } from '../../copy';
import { usePageEdit } from '../context';
import { SplitPanel } from '../SplitPanel';

const ROLES: [StaffRole, string][] = [['COACH', 'Coach'], ['ASSISTANT', 'Assistant'], ['ADMIN', 'Admin']];
const ROLE_WORD: Record<StaffRole, string> = { COACH: 'Coach', ASSISTANT: 'Assistant coach', ADMIN: 'Club administrator' };
const digits = (value: string) => value.replace(/[^\d]/g, '');

/**
 * Coaches and staff by phone or link: no account needed first. An invitation is a link; sent in WhatsApp to their
 * number, or copied. Their role is suggested from the squad they are invited to. Who joined shows on the right.
 */
export function StaffPanel() {
  const t = usePagesCopy();
  const { page, saveBox, closePanel } = usePageEdit();
  const [draft, setDraft] = useState<{ name: string; phone: string; role: StaffRole; squadId: number | null }>({ name: '', phone: '', role: 'COACH', squadId: null });
  const [copied, setCopied] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  if (!page) return null;
  const invites = page.boxes.staff.invites, members = page.boxes.staff.members, squads = page.boxes.squads.items;
  const club = page.kind === 'CLUB';
  const url = (code: string) => `${window.location.origin}/invite/${code}`;
  const add = async () => {
    if (draft.name.trim().length < 2) return;
    setBusy(true);
    try {
      const ok = await saveBox('staff', { invites: [...invites.map(invite => ({ id: invite.id, name: invite.name, role: invite.role, squadId: invite.squadId })), { name: draft.name.trim(), phone: draft.phone, role: draft.role, squadId: draft.squadId }] }, { label: t('Invitation ready: send the link'), undoable: false });
      if (ok) setDraft({ name: '', phone: '', role: draft.role, squadId: draft.squadId });
    } finally { setBusy(false); }
  };
  const copy = async (invite: { id: number; code: string }) => { try { await navigator.clipboard.writeText(url(invite.code)); setCopied(invite.id); window.setTimeout(() => setCopied(null), 2000); } catch { setCopied(null); } };
  const message = (invite: { name: string; role: StaffRole; code: string; squadId: number | null }) => {
    const squad = squads.find(item => item.id === invite.squadId)?.name;
    return encodeURIComponent(t('{page} invites you to join as {role}{squad}: {url}', { page: page.identity.name, role: t(ROLE_WORD[invite.role]).toLowerCase(), squad: squad ? ` (${squad})` : '', url: url(invite.code) }));
  };
  return (
    <SplitPanel title={t(club ? 'Invite coaches & staff' : 'Who runs it with you?')} description={t('An invitation is a link. They need no account first.')} onClose={closePanel}
      footer={<Button variant="primary" onClick={closePanel}>{t('Done')}</Button>}
      preview={<div className="gk-boxedit">
        <p className="gk-field__label">{t('In the team')}</p>
        <List label={t('In the team')}>{members.map(member => <ListRow key={member.userId} lead={<Avatar src={member.avatarUrl} name={member.fullName} size={32} />} title={member.fullName} meta={t(member.title)} />)}</List>
      </div>}>
      <div className="gk-boxedit">
        <div className="gk-boxedit__row">
          <input className="gk-input" value={draft.name} placeholder={t('Name')} aria-label={t('Name')} maxLength={80} autoFocus onChange={event => setDraft({ ...draft, name: event.target.value })} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void add(); } }} />
          <input className="gk-input" type="tel" inputMode="tel" value={draft.phone} placeholder="+995 5__ __ __ __" aria-label={t('Phone')} maxLength={20} onChange={event => setDraft({ ...draft, phone: event.target.value })} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void add(); } }} />
        </div>
        <div className="gk-ctowns" role="group" aria-label={t('Role')}>
          {ROLES.map(([role, word]) => <button key={role} type="button" className="gk-chip" aria-pressed={draft.role === role} onClick={() => setDraft({ ...draft, role })}>{t(word)}</button>)}
          {squads.length > 0 && <select className="gk-input" style={{ width: 'auto', minHeight: 32 }} aria-label={t('Team')} value={draft.squadId ?? ''} onChange={event => setDraft({ ...draft, squadId: event.target.value ? Number(event.target.value) : null, role: event.target.value ? 'COACH' : draft.role })}>
            <option value="">{t('Whole club')}</option>{squads.map(squad => <option key={squad.id} value={squad.id}>{squad.name}</option>)}
          </select>}
        </div>
        <div className="gk-boxedit__foot"><Button size="sm" variant="primary" disabled={busy || draft.name.trim().length < 2} onClick={() => void add()}>{t('Make the invitation')}</Button></div>
        {invites.length > 0 && <>
          <p className="gk-field__label" id={`${id}-invites`}>{t('Invitations')}</p>
          <List label={t('Invitations')}>{invites.map(invite => (
            <li key={invite.id} className="gk-boxedit__row">
              <div className="gk-list-row" style={{ flex: 1 }}><Avatar name={invite.name || invite.phone} size={32} /><span className="gk-list-row__main"><span className="gk-list-row__title">{invite.name || invite.phone}</span><span className="gk-list-row__meta">{[t(ROLE_WORD[invite.role]), squads.find(item => item.id === invite.squadId)?.name, invite.status === 'JOINED' ? t('Joined') : t('Waiting')].filter(Boolean).join(' · ')}</span></span></div>
              {invite.status !== 'JOINED' && <>
                <Button size="sm" iconOnly aria-label={t('Copy link')} title={t('Copy link')} onClick={() => void copy(invite)}>{copied === invite.id ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}</Button>
                <a className="gk-btn gk-btn--secondary gk-btn--sm" href={`https://wa.me/${digits(invite.phone)}?text=${message(invite)}`} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />WhatsApp</a>
              </>}
            </li>
          ))}</List>
        </>}
      </div>
    </SplitPanel>
  );
}
