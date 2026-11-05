import type { ReactNode } from 'react';
import { Facebook, Globe, Instagram, Mail, Phone } from 'lucide-react';
import { List } from '../../../design/primitives';
import { safePublicUrl } from '../../clubs/presentation';
import { usePagesCopy } from '../copy';
import { instagramName, type ContactLinks } from '../model/contactLinks';
import { phoneDisplay } from '../model/phone';

/**
 * The same rows wherever a club's contacts show (review, 28 October 2026): its Contact box while editing and the side
 * of its page for visitors. The phone calls with its country code; web links are http(s) only.
 */
export function ContactRows({ phone, email, website, instagram, facebook }: ContactLinks) {
  const t = usePagesCopy();
  const web = safePublicUrl(website), fb = safePublicUrl(facebook), name = instagramName(instagram);
  const row = (key: string, href: string, icon: ReactNode, title: string, meta: string, external: boolean, className = '') =>
    <li key={key}><a className="gk-list-row" href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      <span className="gk-list-row__lead"><span className="gk-club-icon">{icon}</span></span>
      <span className="gk-list-row__main"><span className={`gk-list-row__title ${className}`.trim()}>{title}</span><span className="gk-list-row__meta">{meta}</span></span>
    </a></li>;
  return <List label={t('Contact details')}>
    {phone && row('phone', `tel:${phoneDisplay(phone).replace(/[^+\d]/g, '')}`, <Phone aria-hidden="true" />, phoneDisplay(phone), t('Phone and WhatsApp'), false)}
    {email && row('email', `mailto:${email}`, <Mail aria-hidden="true" />, email, t('Email'), false, 'gk-club-email')}
    {web && row('website', web, <Globe aria-hidden="true" />, (website ?? '').replace(/^https?:\/\/(www\.)?/, ''), t('Website'), true)}
    {name && row('instagram', `https://www.instagram.com/${encodeURIComponent(name)}`, <Instagram aria-hidden="true" />, `@${name}`, 'Instagram', true)}
    {fb && row('facebook', fb, <Facebook aria-hidden="true" />, (facebook ?? '').replace(/^https?:\/\/(www\.)?/, ''), 'Facebook', true)}
  </List>;
}
