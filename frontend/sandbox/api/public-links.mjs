// Invented sandbox data only. A page's public links as the server keeps them (item 22, 28 October 2026): a bare domain
// as https, Instagram as the account's name, Facebook as an address or from the page's name; anything but http(s) is
// refused. The club read shows the same links.
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const httpOnly = value => { try { const url = new URL(value); return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname && !url.username ? value : null; } catch { return null; } };

function website(typed) {
  const value = String(typed ?? '').trim();
  if (!value) return { value: '' };
  if (!SCHEME.test(value)) {
    const host = (() => { try { return new URL(`https://${value}`).hostname; } catch { return ''; } })();
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/i.test(host)) return { error: 'Website must be an HTTP or HTTPS address.' };
    return { value: `https://${value}` };
  }
  return httpOnly(value) ? { value } : { error: 'Website must be an HTTP or HTTPS address.' };
}
function instagram(typed) {
  const value = String(typed ?? '').trim().replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '');
  if (!value) return { value: '' };
  return /^[A-Za-z0-9._]{1,30}$/.test(value) ? { value } : { error: 'Enter the Instagram name, such as @rustavi.lions.' };
}
function facebook(typed) {
  const value = String(typed ?? '').trim().replace(/^@/, '');
  if (!value) return { value: '' };
  if (/^[A-Za-z0-9.-]{2,80}$/.test(value) && !/facebook\./i.test(value)) return { value: `https://www.facebook.com/${value}` };
  return website(value);
}

/** The saved form of one Contact box link, or the reason it is refused. */
export const savedLink = (key, typed) => key === 'instagram' ? instagram(typed) : key === 'facebook' ? facebook(typed) : website(typed);
/** As the club page shows a saved address: http(s) only. */
export const shownLink = value => (value ? httpOnly(value) : null);
export const instagramUrl = name => (name && /^[A-Za-z0-9._]{1,30}$/.test(name) ? `https://www.instagram.com/${name}` : null);
