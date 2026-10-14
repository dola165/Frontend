import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, MapPin, Plus, Trash2, Trophy, Users } from 'lucide-react';
import { Avatar, Button, List, ListRow } from '../../../design/primitives';
import { SideBlock } from '../../../design/profile/ProfileLayout';
import { Crest } from '../../world/Crest';
import { safePublicUrl } from '../../clubs/presentation';
import type { Honour, Sponsor } from '../api';
import { usePagesCopy } from '../copy';
import { EditPencil } from '../edit/EditPencil';
import { usePageEdit } from '../edit/context';
import type { BoxProps } from '../edit/boxRegistry';
import { INVOLVED_PARTS, type InvolvedPart } from '../model/kinds';
import '../edit/edit.css';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Where the page plays: each ground with its address, nearest to the page's town first. */
export function GroundsBox({ page, editing, onEdit }: BoxProps) {
  const t = usePagesCopy();
  const grounds = page.boxes.grounds.items;
  return (
    <SideBlock title={t(page.kind === 'FAN_CLUB' ? 'Meeting place' : 'Grounds')} hint={t(page.kind === 'FAN_CLUB' ? 'Where we meet' : 'Where we play and train')} action={editing ? <EditPencil onClick={onEdit} /> : undefined}>
      <List label={t('Grounds')}>
        {grounds.slice(0, 4).map(ground => <ListRow key={ground.id} to={page.clubId ? `/clubs/${page.clubId}?tab=facilities&place=${ground.id}` : undefined}
          lead={<span className="gk-club-icon"><MapPin aria-hidden="true" /></span>} title={ground.name} meta={[ground.address, ground.indoor ? t('Indoor') : null].filter(Boolean).join(' · ')} />)}
      </List>
    </SideBlock>
  );
}

/** The teams: one chip per age group with its players, each opening the squads. */
export function SquadsBox({ page, editing, onEdit }: BoxProps) {
  const t = usePagesCopy();
  const { openPanel } = usePageEdit();
  const squads = page.boxes.squads.items;
  return (
    <SideBlock title={t('Teams')} hint={t('Age groups and when they train')} action={editing ? <span className="gk-row"><button type="button" className="gk-section__action" onClick={() => openPanel('players')}>{t('Invite players')}</button><EditPencil onClick={onEdit} /></span> : undefined}>
      <List label={t('Teams')}>
        {squads.map(squad => <ListRow key={squad.id} to={page.clubId ? `/clubs/${page.clubId}?tab=teams&squad=${squad.id}` : undefined}
          lead={<span className="gk-club-icon"><Users aria-hidden="true" /></span>} title={squad.name}
          meta={[squad.days.length ? `${squad.days.map(day => t(DAYS[day - 1] ?? '')).join(' · ')}${squad.time ? ` ${squad.time}` : ''}` : t('Training times to come'), squad.players ? t('{n} players', { n: squad.players }) : null].filter(Boolean).join(' · ')} />)}
      </List>
    </SideBlock>
  );
}

/** The people behind the page as faces, with what each does. */
export function StaffBox({ page, editing, onEdit }: BoxProps) {
  const t = usePagesCopy();
  const members = page.boxes.staff.members, invites = page.boxes.staff.invites.filter(invite => invite.status === 'INVITED');
  return (
    <SideBlock title={t(page.kind === 'CLUB' ? 'Coaches and staff' : page.kind === 'FAN_CLUB' ? 'Committee' : 'Team')} hint={t('Who runs it')} action={editing ? <EditPencil onClick={onEdit} /> : undefined}>
      <List label={t('People')}>
        {members.map(member => <ListRow key={member.userId} to={`/profile/${member.userId}`} lead={<Avatar src={member.avatarUrl} name={member.fullName} size={32} />} title={member.fullName} meta={t(member.title)} />)}
        {editing && invites.map(invite => <ListRow key={`invite-${invite.id}`} lead={<Avatar name={invite.name} size={32} />} title={invite.name || invite.phone} meta={t('Invited · waiting')} />)}
      </List>
    </SideBlock>
  );
}

/** Who backs the page: logos and names, each a link to the sponsor's own page or site. Edited in place. */
export function SponsorsBox({ page, editing, open, onEdit, onClose }: BoxProps) {
  const t = usePagesCopy();
  const { saveBox } = usePageEdit();
  const sponsors = page.boxes.sponsors.items;
  const business = page.kind === 'BUSINESS';
  const save = async (items: Sponsor[]) => { await saveBox('sponsors', { items }, { label: t(business ? 'Clubs saved' : 'Sponsors saved') }); onClose(); };
  return (
    <SideBlock title={t(business ? 'Clubs we back' : 'Sponsors')} hint={t(business ? 'Who we support' : 'Backing the club')} action={editing && !open ? <EditPencil onClick={onEdit} /> : undefined}>
      {open ? <NamesEditor rows={sponsors.map(sponsor => ({ id: sponsor.id, name: sponsor.name, extra: sponsor.websiteUrl ?? '' }))} extraLabel={t('Website')} extraPlaceholder="kartuli-bank.ge" addLabel={t(business ? 'Add a club' : 'Add a sponsor')}
        onSave={rows => save(rows.map(row => ({ id: row.id, name: row.name, websiteUrl: /^https?:\/\//.test(row.extra) ? row.extra : row.extra ? `https://${row.extra}` : null, logoUrl: sponsors.find(sponsor => sponsor.id === row.id)?.logoUrl ?? null, organizationId: sponsors.find(sponsor => sponsor.id === row.id)?.organizationId ?? null })))} onCancel={onClose} />
        : <List label={t('Sponsors')}>{sponsors.map(sponsor => {
          const website = safePublicUrl(sponsor.websiteUrl);
          const body = <><Crest src={sponsor.logoUrl} name={sponsor.name} size={36} /><span className="gk-list-row__main"><span className="gk-list-row__title">{sponsor.name}</span></span>{website && <ArrowUpRight aria-hidden="true" className="gk-faint" size={16} />}</>;
          return <li key={sponsor.id}>{sponsor.organizationId ? <Link className="gk-list-row" to={`/organizations/${sponsor.organizationId}`}>{body}</Link> : website ? <a className="gk-list-row" href={website} target="_blank" rel="noopener noreferrer">{body}</a> : <div className="gk-list-row">{body}</div>}</li>;
        })}</List>}
    </SideBlock>
  );
}

/** What the club has won, newest first. Edited in place. */
export function HonoursBox({ page, editing, open, onEdit, onClose }: BoxProps) {
  const t = usePagesCopy();
  const { saveBox } = usePageEdit();
  const honours = [...page.boxes.honours.items].sort((a, b) => b.year - a.year);
  const save = async (items: Honour[]) => { await saveBox('honours', { items }, { label: t('Honours saved') }); onClose(); };
  return (
    <SideBlock title={t('Honours')} hint={t('What the club has won')} action={editing && !open ? <EditPencil onClick={onEdit} /> : undefined}>
      {open ? <NamesEditor rows={honours.map(honour => ({ id: honour.id, name: honour.title, extra: String(honour.year) }))} extraLabel={t('Year')} extraPlaceholder={String(new Date().getFullYear())} extraType="number" addLabel={t('Add an honour')}
        onSave={rows => save(rows.filter(row => /^\d{4}$/.test(row.extra)).map(row => ({ id: row.id, title: row.name, year: Number(row.extra) })))} onCancel={onClose} />
        : <List label={t('Honours')}>{honours.map(honour => <ListRow key={honour.id} lead={<span className="gk-club-icon"><Trophy aria-hidden="true" /></span>} title={honour.title} meta={String(honour.year)} />)}</List>}
    </SideBlock>
  );
}

/** The page's store, jobs and fundraising, each one line, switched on by itself. */
export function InvolvedBox({ page, editing, open, onEdit, onClose }: BoxProps) {
  const t = usePagesCopy();
  const { saveBox } = usePageEdit();
  const parts = page.boxes.involved.parts;
  const club = page.clubId;
  const link: Record<InvolvedPart, string> = { store: club ? `/clubs/${club}/store` : '/store', jobs: club ? `/clubs/${club}/jobs` : '/jobs/new', fundraising: club ? `/clubs/${club}/campaigns` : '/campaigns/new' };
  const words: Record<InvolvedPart, [string, string]> = { store: ['Club store', 'Kit and merchandise'], jobs: ['Club jobs', 'Jobs and volunteering'], fundraising: ['Club fundraising', 'Support a project'] };
  const [draft, setDraft] = useState<InvolvedPart[]>(parts);
  return (
    <SideBlock title={t('Get involved')} hint={t('Shop, work or give')} action={editing && !open ? <EditPencil onClick={onEdit} /> : undefined}>
      {open ? <div className="gk-boxedit">
        <div className="gk-ctowns" role="group" aria-label={t('Get involved')}>
          {INVOLVED_PARTS.map(part => <button key={part} type="button" className="gk-chip" aria-pressed={draft.includes(part)} onClick={() => setDraft(current => (current.includes(part) ? current.filter(item => item !== part) : [...current, part]))}>{t(words[part][0])}</button>)}
        </div>
        <div className="gk-boxedit__foot"><Button size="sm" variant="primary" onClick={() => void saveBox('involved', { parts: draft }, { label: t('Saved') }).then(onClose)}>{t('Done')}</Button><Button size="sm" variant="ghost" onClick={onClose}>{t('Cancel')}</Button></div>
      </div>
        : <List label={t('Ways to get involved')}>{parts.map(part => <ListRow key={part} to={link[part]} lead={<span className="gk-club-icon" data-kind={part === 'fundraising' ? 'campaigns' : part}><ArrowUpRight aria-hidden="true" /></span>} title={t(words[part][0])} meta={t(words[part][1])} />)}</List>}
    </SideBlock>
  );
}

interface Row { id: number; name: string; extra: string }
/** A short list edited in place: a name and one more thing per row, add and remove, Done. */
function NamesEditor({ rows: initial, extraLabel, extraPlaceholder, extraType = 'text', addLabel, onSave, onCancel }: { rows: Row[]; extraLabel: string; extraPlaceholder: string; extraType?: 'text' | 'number'; addLabel: string; onSave: (rows: Row[]) => Promise<void>; onCancel: () => void }) {
  const t = usePagesCopy();
  const [rows, setRows] = useState<Row[]>(initial.length ? initial : [{ id: -1, name: '', extra: '' }]);
  const update = (index: number, patch: Partial<Row>) => setRows(current => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <div className="gk-boxedit">
      {rows.map((row, index) => (
        <div key={row.id} className="gk-boxedit__row">
          <input className="gk-input" value={row.name} placeholder={t('Name')} aria-label={t('Name')} maxLength={120} autoFocus={index === rows.length - 1 && !row.name} onChange={event => update(index, { name: event.target.value })} />
          <input className="gk-input" type={extraType} value={row.extra} placeholder={extraPlaceholder} aria-label={extraLabel} maxLength={300} style={{ maxWidth: extraType === 'number' ? 90 : 160 }} onChange={event => update(index, { extra: event.target.value })} />
          <Button size="sm" variant="ghost" iconOnly aria-label={t('Remove')} onClick={() => setRows(current => current.filter((_, i) => i !== index))}><Trash2 aria-hidden="true" /></Button>
        </div>
      ))}
      <div className="gk-boxedit__foot">
        <Button size="sm" variant="ghost" onClick={() => setRows(current => [...current, { id: -Date.now(), name: '', extra: '' }])}><Plus aria-hidden="true" />{addLabel}</Button>
        <Button size="sm" variant="primary" onClick={() => void onSave(rows.filter(row => row.name.trim()).map(row => ({ ...row, id: row.id < 0 ? -1 : row.id })))}>{t('Done')}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>{t('Cancel')}</Button>
      </div>
    </div>
  );
}
