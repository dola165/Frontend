/**
 * The page DNA every page shares: an identity (name, crest, cover, town, contact, about) plus boxes switched on per page.
 * Facebook serves infinite kinds of pages; GrassKickZ serves about five, all built from these parts, and the page type
 * only decides which boxes start switched on.
 *
 * Pure data with no imports, so the sandbox API reads this very file (Node strips the types): one catalogue for the
 * screens and the stand-in backend.
 */

export const PAGE_KINDS = ['CLUB', 'FAN_CLUB', 'BUSINESS', 'PAGE', 'VENUE'] as const;
export type PageKind = typeof PAGE_KINDS[number];
/** The start sheet's four tiles. Venues are designed in (their boxes exist) but have no tile while venues are out of the app. */
export const CREATABLE_KINDS: readonly PageKind[] = ['CLUB', 'FAN_CLUB', 'BUSINESS', 'PAGE'];
export const isPageKind = (value: unknown): value is PageKind => typeof value === 'string' && (PAGE_KINDS as readonly string[]).includes(value);

/** The backend's organisation types stay; a page kind only picks one. A business says later, inside the page, what kind it is. */
export const ORGANIZATION_TYPE: Record<PageKind, 'CLUB' | 'PARTNER' | 'COMPANY' | 'OTHER'> = { CLUB: 'CLUB', FAN_CLUB: 'PARTNER', BUSINESS: 'COMPANY', PAGE: 'OTHER', VENUE: 'OTHER' };
export const BUSINESS_KINDS = ['COMPANY', 'SPONSOR', 'MEDIA', 'HEALTHCARE'] as const;
export type BusinessKind = typeof BUSINESS_KINDS[number];
/** Club categories the page offers (the backend has more). Inferred from the age groups until the owner says otherwise. */
export const CLUB_CATEGORIES = ['COMMUNITY_CLUB', 'PRIVATE_ACADEMY', 'SCHOOL_CLUB', 'AMATEUR_CLUB'] as const;
export type ClubCategory = typeof CLUB_CATEGORIES[number];
/** Smart default before anything is known: most new clubs are grassroots community clubs. */
export const DEFAULT_CLUB_CATEGORY: ClubCategory = 'COMMUNITY_CLUB';

/**
 * Every kind of page is for adults (owner, 26 October 2026): under 18 a person is invited to one, never creates one.
 * The app asks `isAdult` (utils/age); this number is for the sandbox's server rules.
 */
export const PAGE_MINIMUM_AGE = 18;

// ---------------------------------------------------------------- boxes

export const BOX_KEYS = ['contact', 'fees', 'grounds', 'squads', 'posts', 'involved', 'staff', 'events', 'sponsors', 'honours', 'bookings'] as const;
export type BoxKey = typeof BOX_KEYS[number];
export const isBoxKey = (value: unknown): value is BoxKey => typeof value === 'string' && (BOX_KEYS as readonly string[]).includes(value);
export type Column = 'left' | 'main' | 'right';
export const COLUMNS: readonly Column[] = ['left', 'main', 'right'];

/** Where each box lives. Rearranging moves a box only within its own column: no free canvas. */
export const BOX_COLUMN: Record<BoxKey, Column> = {
  contact: 'left', fees: 'left', grounds: 'left', squads: 'left',
  posts: 'main',
  involved: 'right', staff: 'right', events: 'right', sponsors: 'right', honours: 'right', bookings: 'right',
};

/** Store, jobs and fundraising sit together in one box ("Get involved"); each part is switched on by itself. */
export const INVOLVED_PARTS = ['store', 'jobs', 'fundraising'] as const;
export type InvolvedPart = typeof INVOLVED_PARTS[number];

/** "on": switched on from the start. "add": waiting in "+ Add a box". Absent: not for this type. */
type Availability = 'on' | 'add';
export const BOX_DEFAULTS: Record<PageKind, Partial<Record<BoxKey, Availability>>> = {
  CLUB: { contact: 'on', fees: 'on', grounds: 'on', squads: 'on', posts: 'on', involved: 'add', staff: 'on', events: 'on', sponsors: 'add', honours: 'add' },
  FAN_CLUB: { contact: 'on', fees: 'on', grounds: 'on', posts: 'on', involved: 'add', staff: 'on' },
  BUSINESS: { contact: 'on', posts: 'on', involved: 'add', staff: 'on', sponsors: 'on' },
  PAGE: { contact: 'on', posts: 'on', involved: 'add' },
  VENUE: { contact: 'on', fees: 'on', grounds: 'on', posts: 'on', staff: 'on', events: 'on', bookings: 'on' },
};

/** The fixed, good order of a new page: visitors always find contact and fees in the same place, as on Facebook. */
export const BOX_ORDER: readonly BoxKey[] = ['contact', 'fees', 'grounds', 'squads', 'posts', 'involved', 'staff', 'events', 'sponsors', 'honours', 'bookings'];

/** Boxes that hold the page's identity: they can be moved but never hidden. */
export const FIXED_BOXES: readonly BoxKey[] = ['contact', 'posts'];

export interface PageLayout { columns: Record<Column, BoxKey[]>; hidden: BoxKey[] }

export const boxAvailable = (kind: PageKind, key: BoxKey) => Boolean(BOX_DEFAULTS[kind][key]);

/** A new page's layout: the boxes that start "on", in the fixed order, each in its column. `extra` switches more on (an existing club's sponsors). */
export function defaultLayout(kind: PageKind, extra: readonly BoxKey[] = []): PageLayout {
  const columns: Record<Column, BoxKey[]> = { left: [], main: [], right: [] };
  for (const key of BOX_ORDER) {
    const availability = BOX_DEFAULTS[kind][key];
    if (availability === 'on' || (availability && extra.includes(key))) columns[BOX_COLUMN[key]].push(key);
  }
  return { columns, hidden: [] };
}

/** Boxes the tray offers: available for the type and not on the page (hidden ones come back with their data). */
export function addableBoxes(kind: PageKind, layout: PageLayout): BoxKey[] {
  const placed = new Set(COLUMNS.flatMap(column => layout.columns[column]));
  return BOX_ORDER.filter(key => boxAvailable(kind, key) && !placed.has(key));
}

/** Where a box added from the tray lands when no drop position is given: its place in the fixed order. */
export function insertionIndex(layout: PageLayout, key: BoxKey): number {
  const column = layout.columns[BOX_COLUMN[key]];
  const rank = BOX_ORDER.indexOf(key);
  const after = column.findIndex(other => BOX_ORDER.indexOf(other) > rank);
  return after === -1 ? column.length : after;
}

/** A layout read from storage or the network, repaired: unknown or misplaced boxes dropped, duplicates removed, fixed boxes kept. */
export function normalizeLayout(kind: PageKind, value: unknown): PageLayout {
  const fallback = defaultLayout(kind);
  if (!value || typeof value !== 'object') return fallback;
  const raw = value as { columns?: Partial<Record<Column, unknown>>; hidden?: unknown };
  const seen = new Set<BoxKey>();
  const columns: Record<Column, BoxKey[]> = { left: [], main: [], right: [] };
  for (const column of COLUMNS) {
    const list = Array.isArray(raw.columns?.[column]) ? raw.columns[column] as unknown[] : [];
    for (const key of list) if (isBoxKey(key) && BOX_COLUMN[key] === column && boxAvailable(kind, key) && !seen.has(key)) { seen.add(key); columns[column].push(key); }
  }
  for (const key of FIXED_BOXES) if (boxAvailable(kind, key) && !seen.has(key)) { seen.add(key); columns[BOX_COLUMN[key]].splice(insertionIndex({ columns, hidden: [] }, key), 0, key); }
  const hidden = (Array.isArray(raw.hidden) ? raw.hidden : []).filter((key): key is BoxKey => isBoxKey(key) && !seen.has(key) && boxAvailable(kind, key) && !FIXED_BOXES.includes(key));
  return { columns, hidden: [...new Set(hidden)] };
}

// ---------------------------------------------------------------- setup and going live

export const SETUP_KEYS = ['name', 'crest', 'grounds', 'squads', 'contact', 'fees', 'players', 'staff', 'posts', 'about', 'sponsors'] as const;
export type SetupKey = typeof SETUP_KEYS[number];

/**
 * What the setup ring counts, per type, in the order the next ghost box is highlighted. The name is not a step (it is
 * given when the page is made and is all that is needed), so a new page starts at 0; a club counts seven, all optional.
 */
export const SETUP_ITEMS: Record<PageKind, readonly SetupKey[]> = {
  CLUB: ['crest', 'about', 'grounds', 'squads', 'contact', 'fees', 'players'],
  FAN_CLUB: ['crest', 'grounds', 'contact', 'fees', 'staff', 'posts'],
  BUSINESS: ['crest', 'about', 'contact', 'sponsors', 'posts'],
  PAGE: ['crest', 'about', 'contact', 'posts'],
  VENUE: ['crest', 'grounds', 'contact', 'fees', 'staff', 'posts'],
};

/** The facts the ring and Go live are worked out from; the server and the screen each derive them from what they hold. */
export interface PageFacts {
  kind: PageKind;
  name: string;
  /** A designed crest, an uploaded one, or the generated crest the owner chose to keep. */
  crestKept: boolean;
  grounds: number;
  squads: number;
  contact: boolean;
  fees: boolean;
  /** A join link shared, or players already in a squad. */
  players: boolean;
  staff: number;
  posts: number;
  about: boolean;
  sponsors: number;
}

const done: Record<SetupKey, (facts: PageFacts) => boolean> = {
  name: facts => facts.name.trim().length >= 2,
  crest: facts => facts.crestKept,
  grounds: facts => facts.grounds > 0,
  squads: facts => facts.squads > 0,
  contact: facts => facts.contact,
  fees: facts => facts.fees,
  players: facts => facts.players,
  staff: facts => facts.staff > 0,
  posts: facts => facts.posts > 0,
  about: facts => facts.about,
  sponsors: facts => facts.sponsors > 0,
};

export interface SetupState { items: { key: SetupKey; done: boolean }[]; done: number; total: number; next: SetupKey | null; complete: boolean }

export function setupState(facts: PageFacts): SetupState {
  const items = SETUP_ITEMS[facts.kind].map(key => ({ key, done: done[key](facts) }));
  const count = items.filter(item => item.done).length;
  return { items, done: count, total: items.length, next: items.find(item => !item.done)?.key ?? null, complete: count === items.length };
}

/**
 * Go live needs only a name (owner, 16 October): everything else is optional, the town too, though a page without a town
 * cannot be found by a town filter. What is missing is said.
 */
export function goLiveCheck(facts: PageFacts): { ready: boolean; missing: 'name'[] } {
  const missing: 'name'[] = done.name(facts) ? [] : ['name'];
  return { ready: missing.length === 0, missing };
}

// ---------------------------------------------------------------- verification unlocks, never blocks

/**
 * What an unverified page cannot do yet. Everything else (profile, posts, squads, schedule, inviting parents and coaches,
 * arranging friendlies) works from the first minute. Verification is asked only when one of these is tried.
 */
export const LOCKED_ACTIONS = ['TAKE_PAYMENTS', 'SELL', 'FUNDRAISE', 'PUBLIC_MINORS', 'PUBLIC_TRIALS', 'VERIFIED_BADGE'] as const;
export type LockedAction = typeof LOCKED_ACTIONS[number];
export type VerificationState = 'NONE' | 'REQUESTED' | 'VERIFIED';

export const isLocked = (action: LockedAction, verification: VerificationState) => verification !== 'VERIFIED' && (LOCKED_ACTIONS as readonly string[]).includes(action);

