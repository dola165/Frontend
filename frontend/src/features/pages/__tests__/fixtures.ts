import type { PageView } from '../api';
import { defaultLayout, goLiveCheck, setupState, type PageFacts, type PageKind } from '../model/kinds';

/** A page as `GET …/page` answers it, for tests: a draft fan club its owner may edit, with nothing filled in yet. */
export function makePage(over: Partial<PageView> & { kind?: PageKind } = {}): PageView {
  const kind = over.kind ?? 'FAN_CLUB';
  const base: PageView = {
    ref: { type: 'organization', id: 7002 }, organizationId: 7002, clubId: null, kind, status: 'DRAFT', verification: 'NONE',
    viewer: { role: 'OWNER', canEdit: true, editable: 'ALL' },
    identity: { version: 1, name: 'Rustavi Ultras', tagline: '', about: '', aboutAuto: true, town: { name: 'Rustavi', latitude: 41.5495, longitude: 45.0012 },
      crest: { kind: 'generated', design: { shape: 'shield', primary: 'red', secondary: 'white', initials: 'RU' }, kept: false, url: '/sandbox-media/crest/org-7002.svg' },
      cover: { kind: 'photo', photo: 'pitch-sun', url: '/venue-demo/pitch-sun.jpg' }, contact: { phone: '', email: '' }, social: { website: '', instagram: '', facebook: '' }, businessKind: null, clubCategory: null },
    layout: { version: 1, ...defaultLayout(kind) },
    boxes: { grounds: { version: 1, items: [] }, squads: { version: 1, items: [] }, fees: { version: 1, band: null }, staff: { version: 1, members: [{ userId: 9500, fullName: 'Giorgi Beridze', avatarUrl: null, role: 'OWNER', title: 'Runs the club' }], invites: [] },
      players: { version: 1, shared: false, links: {}, waiting: 0 }, sponsors: { version: 1, items: [] }, honours: { version: 1, items: [] }, involved: { version: 1, parts: [] } },
    setup: { items: [], done: 0, total: 0, next: null, complete: false, completedAt: null }, goLive: { ready: false, missing: [] },
    links: { id: 7002, clubId: null, profilePath: '/organizations/7002', workspacePath: '/organizations/7002/workspace' },
    suggestions: { phone: '+995 599 12 34 56', email: 'giorgi@example.org' }, createdAt: '2026-10-15T10:00:00Z', liveAt: null,
  };
  const page: PageView = { ...base, ...over, identity: { ...base.identity, ...(over.identity ?? {}) }, boxes: { ...base.boxes, ...(over.boxes ?? {}) }, viewer: { ...base.viewer, ...(over.viewer ?? {}) } };
  return withSetup(page);
}

/** The setup ring and the Go-live rule as the server would work them out from the page's content. */
export function withSetup(page: PageView): PageView {
  const facts: PageFacts = {
    kind: page.kind, name: page.identity.name, crestKept: page.identity.crest.kept, grounds: page.boxes.grounds.items.length, squads: page.boxes.squads.items.length,
    contact: Boolean(page.identity.contact.phone || page.identity.contact.email), fees: page.boxes.fees.band !== null, players: page.boxes.players.shared,
    staff: page.boxes.staff.members.length - 1 + page.boxes.staff.invites.length, posts: 0, about: Boolean(page.identity.about.trim()), sponsors: page.boxes.sponsors.items.length,
  };
  const state = setupState(facts);
  return { ...page, setup: { ...state, completedAt: state.complete ? '2026-10-15T10:00:00Z' : null }, goLive: goLiveCheck(facts) };
}
