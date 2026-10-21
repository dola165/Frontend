import { useId, useState, type KeyboardEvent } from 'react';
import { Check, Globe, Instagram, Mail, Phone } from 'lucide-react';
import { Button, List } from '../../../design/primitives';
import { SideBlock } from '../../../design/profile/ProfileLayout';
import { usePagesCopy } from '../copy';
import { EditPencil } from '../edit/EditPencil';
import { usePageEdit } from '../edit/context';
import type { BoxProps } from '../edit/boxRegistry';
import { useKeepOnLeave } from '../edit/useKeepOnLeave';
import { phoneDisplay } from '../model/phone';
import '../edit/edit.css';

const digits = (value: string) => value.replace(/[^\d+]/g, '');
const site = (value: string) => { try { const url = new URL(/^https?:\/\//.test(value) ? value : `https://${value}`); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; } };
const handle = (value: string) => value.replace(/^@/, '').replace(/^https?:\/\/(?:www\.)?instagram\.com\//, '').replace(/\/.*$/, '');

/** How to reach the page: the phone (which is also the WhatsApp button), the email, the website and Instagram. Edited in place. */
export function ContactBox({ page, editing, open, onEdit, onClose }: BoxProps) {
  const t = usePagesCopy();
  const { saveIdentity } = usePageEdit();
  const { phone, email } = page.identity.contact, { website, instagram } = page.identity.social;
  const persist = (next: Draft) => saveIdentity({ contact: { phone: next.phone.trim(), email: next.email.trim() }, social: { ...page.identity.social, website: next.website.trim(), instagram: handle(next.instagram.trim()) } }, { label: t('Contact saved') });
  const save = async (next: Draft) => { if (await persist(next)) onClose(); };
  const web = site(website);
  return (
    <SideBlock title={t('Contact')} hint={t('Phone and email')} action={editing && !open ? <EditPencil onClick={onEdit} /> : undefined}>
      {open ? <ContactEditor initial={{ phone, email, website, instagram }} suggestions={page.suggestions} onSave={save} onKeep={next => void persist(next)} onCancel={onClose} />
        : <List label={t('Contact details')}>
          {phone && <li><a className="gk-list-row" href={`https://wa.me/${digits(phone).replace('+', '')}`} target="_blank" rel="noopener noreferrer"><span className="gk-list-row__lead"><span className="gk-club-icon"><Phone aria-hidden="true" /></span></span><span className="gk-list-row__main"><span className="gk-list-row__title">{phoneDisplay(phone)}</span><span className="gk-list-row__meta">{t('Phone and WhatsApp')}</span></span></a></li>}
          {email && <li><a className="gk-list-row" href={`mailto:${email}`}><span className="gk-list-row__lead"><span className="gk-club-icon"><Mail aria-hidden="true" /></span></span><span className="gk-list-row__main"><span className="gk-list-row__title gk-club-email">{email}</span><span className="gk-list-row__meta">{t('Email')}</span></span></a></li>}
          {web && <li><a className="gk-list-row" href={web} target="_blank" rel="noopener noreferrer"><span className="gk-list-row__lead"><span className="gk-club-icon"><Globe aria-hidden="true" /></span></span><span className="gk-list-row__main"><span className="gk-list-row__title">{website.replace(/^https?:\/\/(www\.)?/, '')}</span><span className="gk-list-row__meta">{t('Website')}</span></span></a></li>}
          {instagram && <li><a className="gk-list-row" href={`https://instagram.com/${encodeURIComponent(handle(instagram))}`} target="_blank" rel="noopener noreferrer"><span className="gk-list-row__lead"><span className="gk-club-icon"><Instagram aria-hidden="true" /></span></span><span className="gk-list-row__main"><span className="gk-list-row__title">@{handle(instagram)}</span><span className="gk-list-row__meta">Instagram</span></span></a></li>}
        </List>}
    </SideBlock>
  );
}

interface Draft { phone: string; email: string; website: string; instagram: string }
function ContactEditor({ initial, suggestions, onSave: done, onKeep, onCancel: cancel }: { initial: Draft; suggestions: { phone: string; email: string } | null; onSave: (next: Draft) => Promise<void>; onKeep: (next: Draft) => void; onCancel: () => void }) {
  const t = usePagesCopy();
  const [draft, setDraft] = useState(initial);
  const [more, setMore] = useState(Boolean(initial.website || initial.instagram));
  // Opening another box saves what was typed here; only Cancel (or Escape) drops it.
  const settle = useKeepOnLeave(draft, next => (Object.keys(next) as (keyof Draft)[]).some(key => next[key].trim() !== initial[key].trim()), onKeep);
  const onSave = (next: Draft) => { settle(); return done(next); };
  const onCancel = () => { settle(); cancel(); };
  const id = useId();
  const onKey = (event: KeyboardEvent) => { if (event.key === 'Enter') { event.preventDefault(); void onSave(draft); } if (event.key === 'Escape') onCancel(); };
  const offerPhone = suggestions?.phone && digits(suggestions.phone) !== digits(draft.phone), offerEmail = suggestions?.email && suggestions.email !== draft.email;
  // The phone's own contact book, where the browser offers it (Android Chrome): one tap, the person picks, nothing is read otherwise.
  const contacts = (navigator as Navigator & { contacts?: { select: (fields: string[], options?: { multiple?: boolean }) => Promise<{ tel?: string[]; email?: string[] }[]> } }).contacts;
  const pick = async () => {
    try { const [chosen] = await contacts!.select(['tel', 'email'], { multiple: false }); if (chosen) setDraft({ ...draft, phone: chosen.tel?.[0] ?? draft.phone, email: chosen.email?.[0] ?? draft.email }); } catch { /* the person closed the picker */ }
  };
  return (
    <form className="gk-boxedit" onKeyDown={onKey} onSubmit={event => { event.preventDefault(); void onSave(draft); }}>
      <div>
        <label className="gk-field__label" htmlFor={`${id}-phone`}>{t('Phone')}</label>
        <input id={`${id}-phone`} className="gk-input" type="tel" inputMode="tel" autoComplete="tel" autoFocus value={draft.phone} placeholder="+995 5__ __ __ __" maxLength={20} onChange={event => setDraft({ ...draft, phone: event.target.value })} />
        {offerPhone && <button type="button" className="gk-tap" style={{ marginTop: 6 }} onClick={() => setDraft({ ...draft, phone: suggestions.phone })}><Check aria-hidden="true" />{t('Use {phone} for calls and WhatsApp', { phone: suggestions.phone })}</button>}
      </div>
      <div>
        <label className="gk-field__label" htmlFor={`${id}-email`}>{t('Email')}</label>
        <input id={`${id}-email`} className="gk-input" type="email" inputMode="email" autoComplete="email" value={draft.email} maxLength={254} onChange={event => setDraft({ ...draft, email: event.target.value })} />
        {offerEmail && <button type="button" className="gk-tap" style={{ marginTop: 6 }} onClick={() => setDraft({ ...draft, email: suggestions.email })}><Check aria-hidden="true" />{t('Use {email}', { email: suggestions.email })}</button>}
      </div>
      {contacts && <button type="button" className="gk-tap" onClick={() => void pick()}><Check aria-hidden="true" />{t('Pick from my contacts')}</button>}
      {more ? <>
        <div><label className="gk-field__label" htmlFor={`${id}-web`}>{t('Website')}</label><input id={`${id}-web`} className="gk-input" type="url" inputMode="url" autoComplete="url" value={draft.website} placeholder="rustavi-lions.ge" maxLength={300} onChange={event => setDraft({ ...draft, website: event.target.value })} /></div>
        <div><label className="gk-field__label" htmlFor={`${id}-ig`}>Instagram</label><input id={`${id}-ig`} className="gk-input" autoComplete="off" value={draft.instagram} placeholder="@rustavi.lions" maxLength={300} onChange={event => setDraft({ ...draft, instagram: event.target.value })} /></div>
      </> : <button type="button" className="gk-cmatch__no" onClick={() => setMore(true)}>{t('Website and Instagram')}</button>}
      <div className="gk-boxedit__foot">
        <Button size="sm" variant="primary" onClick={() => void onSave(draft)}>{t('Done')}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>{t('Cancel')}</Button>
      </div>
    </form>
  );
}
