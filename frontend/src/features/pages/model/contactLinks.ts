import { safePublicUrl } from '../../clubs/presentation';

/** How to reach a page or a club: the phone, the email and its web links. */
export interface ContactLinks { phone?: string | null; email?: string | null; website?: string | null; instagram?: string | null; facebook?: string | null }

/** An Instagram name from a name, "@name" or an instagram.com address; null when it isn't one. */
export const instagramName = (value?: string | null) => {
  const name = (value ?? '').trim().replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(name) ? name : null;
};

/** Whether any contact row would show. */
export const hasContact = (links: ContactLinks) =>
  Boolean(links.phone || links.email || safePublicUrl(links.website) || instagramName(links.instagram) || safePublicUrl(links.facebook));
