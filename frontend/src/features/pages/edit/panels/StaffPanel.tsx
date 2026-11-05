import { useState } from 'react';
import { Check, Copy, MessageCircle, UserPlus } from 'lucide-react';
import { Avatar, Button, ButtonLink, List, ListRow } from '../../../../design/primitives';
import type { StaffRole } from '../../api';
import { usePagesCopy } from '../../copy';
import { officePath } from '../../../clubOffice/officeLinks';
import { usePageEdit } from '../context';
import { SplitPanel } from '../SplitPanel';

const ROLE_WORD: Record<StaffRole, string> = { COACH: 'Coach', ASSISTANT: 'Assistant coach', ADMIN: 'Club administrator' };

/**
 * Who runs the club with you. A club's staff are invited in Club office › Staff, with the one Invite (step 2, 28 October
 * 2026), so this panel no longer makes codes of its own: it shows the team and opens Staff. Invitations already sent
 * from here stay listed with their link, and keep working.
 */
export function StaffPanel() {
  const t = usePagesCopy();
  const { page, closePanel } = usePageEdit();
  const [copied, setCopied] = useState<number | null>(null);
  if (!page) return null;
  if (page.kind !== 'CLUB') return <SplitPanel title={t('Team')} onClose={closePanel}><ButtonLink to={`/organizations/${page.ref.id}/workspace?tab=team`}>{t('Manage your organization team')}</ButtonLink></SplitPanel>;
  const invites = page.boxes.staff.invites.filter(invite => invite.status === 'INVITED' && invite.code), members = page.boxes.staff.members, squads = page.boxes.squads.items;
  const url = (code: string) => `${window.location.origin}/invite/${code}`;
  const copy = async (invite: { id: number; code: string }) => { try { await navigator.clipboard.writeText(url(invite.code)); setCopied(invite.id); window.setTimeout(() => setCopied(null), 2000); } catch { setCopied(null); } };
  const message = (invite: { name: string; role: StaffRole; code: string; squadId: number | null }) => {
    const squad = squads.find(item => item.id === invite.squadId)?.name;
    return encodeURIComponent(t('{page} invites you to join as {role}{squad}: {url}', { page: page.identity.name, role: t(ROLE_WORD[invite.role]).toLowerCase(), squad: squad ? ` (${squad})` : '', url: url(invite.code) }));
  };
  const staff = page.clubId ? officePath(page.clubId) : null;
  return (
    <SplitPanel title={t('Invite coaches & staff')} description={t('Invite them in Club office: one person by name, or a staff link for many.')} onClose={closePanel}
      footer={staff ? <ButtonLink variant="primary" to={officePath(page.clubId!, 'staff', { invite: '1' })}><UserPlus aria-hidden="true" />{t('Invite in Club office')}</ButtonLink> : <Button variant="primary" onClick={closePanel}>{t('Done')}</Button>}
      preview={<div className="gk-boxedit">
        <p className="gk-field__label">{t('In the team')}</p>
        <List label={t('In the team')}>{members.map(member => <ListRow key={member.userId} lead={<Avatar src={member.avatarUrl} name={member.fullName} size={32} />} title={member.fullName} meta={t(member.title)} />)}</List>
      </div>}>
      <div className="gk-boxedit">
        {staff && <p><ButtonLink to={staff}>{t('Open Staff')}</ButtonLink></p>}
        {invites.length > 0 && <>
          <p className="gk-field__label">{t('Invitations')}</p>
          <List label={t('Invitations')}>{invites.map(invite => (
            <li key={invite.id} className="gk-boxedit__row">
              <div className="gk-list-row" style={{ flex: 1 }}><Avatar name={invite.name || invite.phone} size={32} /><span className="gk-list-row__main"><span className="gk-list-row__title">{invite.name || invite.phone}</span><span className="gk-list-row__meta">{[t(ROLE_WORD[invite.role]), squads.find(item => item.id === invite.squadId)?.name, t('Waiting')].filter(Boolean).join(' · ')}</span></span></div>
              <Button size="sm" iconOnly aria-label={t('Copy link')} title={t('Copy link')} onClick={() => void copy({ id: invite.id, code: invite.code! })}>{copied === invite.id ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}</Button>
              <a className="gk-btn gk-btn--secondary gk-btn--sm" href={`https://wa.me/?text=${message({ ...invite, code: invite.code! })}`} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />WhatsApp</a>
            </li>
          ))}</List>
        </>}
      </div>
    </SplitPanel>
  );
}
