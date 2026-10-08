export type ClubPreviewKind = 'club' | 'person' | 'venue' | 'post' | 'product' | 'campaign' | 'job' | 'match' | 'event' | 'history';
export interface ClubPreviewTarget { kind: ClubPreviewKind; id: number; path: string; title: string; fullPageLabel: string }

const tabs: Record<string, string> = { overview: 'Club overview', teams: 'Training & teams', facilities: 'Venues & facilities', people: 'Coaches & staff', schedule: 'Schedule', events: 'Events', honours: 'Honours', media: 'Photos & videos', business: 'Opportunities', contact: 'Contact' };

/** Only known read destinations become previews. Editors, sign-in and explicit workspaces retain navigation. */
export function clubPreviewTarget(href: string, base: string): ClubPreviewTarget | null {
  let url: URL;
  try { url = new URL(href, base); } catch { return null; }
  if (url.origin !== new URL(base).origin || !['http:', 'https:'].includes(url.protocol)) return null;
  const path = url.pathname + url.search + url.hash;
  const club = /^\/clubs\/([1-9]\d*)(?:\/(store|campaigns))?\/?$/.exec(url.pathname);
  if (club) {
    if (!Number.isSafeInteger(Number(club[1])) || url.searchParams.has('managementTab') || url.searchParams.has('enquire')) return null;
    const tab = club[2] || url.searchParams.get('tab') || 'overview';
    const title = tab === 'store' ? 'Club store' : tab === 'campaigns' ? 'Club campaigns' : tab === 'schedule' && /^[1-9]\d*$/.test(url.searchParams.get('squad') || '') ? 'Squad schedule' : tabs[tab];
    if (!title) return null;
    return { kind: 'club', id: Number(club[1]), path, title, fullPageLabel: club[2] ? `Open ${title.toLowerCase()}` : `Go to ${title} tab` };
  }
  const patterns: Array<[RegExp, ClubPreviewKind, string, string]> = [
    [/^\/profile\/([1-9]\d*)\/?$/, 'person', 'Profile', 'Open full profile'],
    [/^\/stadiums\/([1-9]\d*)\/?$/, 'venue', 'Venue details', 'Open venue page'],
    [/^\/posts\/([1-9]\d*)\/?$/, 'post', 'Club update', 'Open full post'],
    [/^\/store\/products\/([1-9]\d*)\/?$/, 'product', 'Product details', 'Open product page'],
    [/^\/campaigns\/([1-9]\d*)\/?$/, 'campaign', 'Campaign details', 'Open campaign page'],
    [/^\/jobs\/([1-9]\d*)\/?$/, 'job', 'Role details', 'Open role page to apply'],
    [/^\/match-exchange\/([1-9]\d*)\/?$/, 'match', 'Match & result', 'Open match page'],
  ];
  for (const [pattern, kind, title, fullPageLabel] of patterns) {
    const match = pattern.exec(url.pathname);
    if (match && Number.isSafeInteger(Number(match[1]))) return { kind, id: Number(match[1]), path, title, fullPageLabel };
  }
  if (url.pathname === '/calendar' && /^[1-9]\d*$/.test(url.searchParams.get('eventId') || '') && Number.isSafeInteger(Number(url.searchParams.get('eventId'))))
    return { kind: 'event', id: Number(url.searchParams.get('eventId')), path, title: 'Event details', fullPageLabel: 'Open schedule' };
  if (url.pathname === '/match-history') return { kind: 'history', id: 0, path, title: 'Results & history', fullPageLabel: 'Open match history' };
  return null;
}
