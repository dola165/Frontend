// Pages in the sandbox: every page's identity, boxes, layout and state (draft or live).
// What a club page holds is written through to the club records the rest of the app already reads, so a club
// created here shows in World, search, My Club, My squads, the feed and the workspace without special cases.
// The page model (boxes per type, setup, Go live, crests, name matching) is the app's own: imported from src.
//
// BACKEND NEEDED (docs/claude-sandbox/PAGE_CREATION.md, ROUND_2.md "Before release"): everything in this file.
import * as W from './world.mjs';
import * as C from './world-club.mjs';
import * as S from './world-social.mjs';
import * as V from './viewer.mjs';
import { pitchById, listedSeeds } from './pages-seed.mjs';
import { instagramUrl, savedLink, shownLink } from './public-links.mjs';
import { defaultLayout, normalizeLayout, setupState, goLiveCheck, isBoxKey, isPageKind, PAGE_MINIMUM_AGE, INVOLVED_PARTS, ORGANIZATION_TYPE, CLUB_CATEGORIES, BUSINESS_KINDS, DEFAULT_CLUB_CATEGORY } from '../../src/features/pages/model/kinds.ts';
import { normalizeCrest, defaultCrest, crestSvg } from '../../src/features/pages/model/crest.ts';
import { findSimilar, nameKey } from '../../src/features/pages/model/nameMatch.ts';
import { COVER_PHOTOS, isCoverPhoto, coverForColour } from '../../src/features/pages/model/photos.ts';
import { aboutSuggestion } from '../../src/features/pages/model/about.ts';

export { crestSvg };
export const pages = new Map(); // `club:<id>` | `organization:<id>` -> page
const pageKey = ref => `${ref.type}:${ref.id}`;
let nextOrgId = 7000, nextClubId = 400;
const now = () => new Date().toISOString();
const text = (value, max) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
/** A phone as the backend stores it: digits and a leading plus, no spacing; the screens group it for reading. */
const phoneText = value => String(value ?? '').trim().replace(/[\s()-]/g, '').slice(0, 24);
const digits = value => String(value ?? '').replace(/[^\d+]/g, '');

const TYPE_OF_CATEGORY = { COMMUNITY_CLUB: 'GRASSROOTS', PRIVATE_ACADEMY: 'ACADEMY', SCHOOL_CLUB: 'SCHOOL', AMATEUR_CLUB: 'AMATEUR' };
const CATEGORY_OF_TYPE = { GRASSROOTS: 'COMMUNITY_CLUB', ACADEMY: 'PRIVATE_ACADEMY', SCHOOL: 'SCHOOL_CLUB', AMATEUR: 'AMATEUR_CLUB', PROFESSIONAL: 'PROFESSIONAL_CLUB', SEMI_PROFESSIONAL: 'SEMI_PROFESSIONAL_CLUB' };
const PROFILE_KIND = { GRASSROOTS: 'COMMUNITY', SCHOOL: 'COMMUNITY', AMATEUR: 'COMMUNITY', ACADEMY: 'ACADEMY' };
export const AGE_GROUPS = ['U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'SENIOR'];
const formatFor = age => { const n = age === 'SENIOR' ? 99 : Number(age.slice(1)); return n <= 8 ? '5v5' : n <= 10 ? '7v7' : n <= 12 ? '9v9' : '11v11'; };
export const squadName = (age, gender) => `${age === 'SENIOR' ? 'Senior' : age} ${gender === 'MALE' ? (age === 'SENIOR' ? 'Men' : 'Boys') : gender === 'FEMALE' ? (age === 'SENIOR' ? 'Women' : 'Girls') : 'Mixed'}`;
export const townOf = name => { const record = V.townRecord(name) ?? V.townRecord('Tbilisi'); return record.latitude == null ? { ...V.townRecord('Tbilisi'), name: record.name } : record; };
export const ageOf = dob => { if (!dob) return null; const d = new Date(`${dob}T00:00:00`), today = new Date(); let age = today.getFullYear() - d.getFullYear(); if (today < new Date(today.getFullYear(), d.getMonth(), d.getDate())) age--; return age; };
/** Luka is the demo coach (an adult); registered accounts carry their own date of birth. */
export const viewerAge = viewer => viewer === W.ME_ID ? 38 : ageOf(V.account(viewer)?.dateOfBirth);
export const viewerName = viewer => viewer === W.ME_ID ? W.me.fullName : V.account(viewer)?.fullName ?? `Member #${viewer}`;

// ---------------------------------------------------------------- creating and finding pages

function registerClub(club) {
  W.clubs.push(club);
  C.followerCounts[club.id] = 0;
  C.clubPolicy.set(club.id, 'APPLICATION_REQUIRED');
  C.presentations.set(club.id, { profileKind: PROFILE_KIND[club.type] ?? 'COMMUNITY', revision: 1, programmes: [], sponsors: [], affiliations: [] });
  C.honours[club.id] = [];
  C.memberCountHooks.set(club.id, () => members(pages.get(`club:${club.id}`)));
}
const members = page => !page ? 0 : (page.ownerId ? 1 : 0) + [...page.staff.keys()].filter(id => id !== page.ownerId).length + squadsOf(page).reduce((n, s) => n + s.playerIds.length, 0);

function newPage({ kind, name, town, ownerId, status, clubId = null, organizationId = nextOrgId++, category = DEFAULT_CLUB_CATEGORY, crest, language = 'en' }) {
  const design = crest ? normalizeCrest(crest, name) : defaultCrest(name);
  const page = {
    ref: clubId ? { type: 'club', id: clubId } : { type: 'organization', id: organizationId }, organizationId, clubId, kind, organizationType: ORGANIZATION_TYPE[kind],
    ownerId, staff: new Map(ownerId ? [[ownerId, 'OWNER']] : []), status, verification: 'NONE', verificationFor: [],
    identity: { version: 1, name, tagline: '', about: '', aboutAuto: true, town: townOf(town), crest: { kind: 'generated', design, kept: Boolean(crest) }, language,
      cover: { kind: 'photo', photo: coverForColour(design.primary) }, contact: { phone: '', email: '' }, social: { website: '', instagram: '', facebook: '' },
      businessKind: kind === 'BUSINESS' ? 'COMPANY' : null, clubCategory: kind === 'CLUB' ? category : null },
    layout: { version: 1, ...defaultLayout(kind) },
    boxes: { grounds: { version: 1, items: [], fromPage: true }, squads: { version: 1 }, fees: { version: 1, band: null }, staff: { version: 1, invites: [] },
      players: { version: 1, shared: false, links: {} }, sponsors: { version: 1, items: [] }, honours: { version: 1 }, involved: { version: 1, parts: [] } },
    arrivals: [], managed: true, setupCompletedAt: null, createdAt: now(), liveAt: status === "LIVE" ? now() : null,
  };
  pages.set(pageKey(page.ref), page);
  return page;
}

/** An existing seed club's page, built the first time anyone asks: live, its identity and boxes read from the club. */
export function clubPage(clubId) {
  const id = Number(clubId), found = pages.get(`club:${id}`);
  if (found) return found;
  const club = W.clubById(id);
  if (!club) return null;
  const presentation = C.presentations.get(id), contact = C.contacts[id] ?? {};
  const extras = [...(presentation?.sponsors.length ? ['sponsors'] : []), ...(C.honours[id]?.length ? ['honours'] : []), 'involved'];
  const page = {
    ref: { type: 'club', id }, organizationId: id === C.CLUB_ID ? 901 : 900 + id, clubId: id, kind: 'CLUB', organizationType: 'CLUB',
    ownerId: id === C.CLUB_ID ? W.ME_ID : null, staff: new Map(id === C.CLUB_ID ? [[W.ME_ID, 'OWNER']] : []), status: 'LIVE',
    verification: club.verified ? 'VERIFIED' : 'NONE', verificationFor: [],
    identity: { version: 1, name: club.name, tagline: '', about: C.clubEdits.get(id)?.description ?? club.description ?? '', aboutAuto: false, town: townOf(club.city),
      crest: { kind: 'image', url: C.clubEdits.get(id)?.logoUrl ?? club.logoUrl, kept: true }, cover: club.bannerUrl ? { kind: 'image', url: C.clubEdits.get(id)?.bannerUrl ?? club.bannerUrl } : null,
      contact: { phone: contact.whatsappNumber ?? '', email: contact.email ?? '' }, social: { website: contact.websiteUrl ?? '', instagram: savedLink('instagram', contact.instagramUrl ?? '').value ?? '', facebook: contact.facebookUrl ?? '' },
      businessKind: null, clubCategory: CATEGORY_OF_TYPE[club.type] ?? null },
    layout: { version: 1, ...defaultLayout('CLUB', extras) },
    boxes: { grounds: { version: 1, items: [], fromPage: false }, squads: { version: 1 }, fees: { version: 1, band: bandFromProgrammes(presentation?.programmes ?? []) }, staff: { version: 1, invites: [] },
      players: { version: 1, shared: W.squads.some(s => s.clubId === id && s.playerIds.length), links: {} }, sponsors: { version: 1 }, honours: { version: 1 },
      involved: { version: 1, parts: [...INVOLVED_PARTS] } },
    arrivals: [], setupCompletedAt: now(), createdAt: now(), liveAt: now(),
  };
  pages.set(pageKey(page.ref), page);
  return page;
}
/** The lowest and highest published monthly fee as a band, and whether some groups train free. */
function bandFromProgrammes(programmes) {
  const current = programmes.filter(p => p.published);
  const priced = current.filter(p => p.priceType === 'FIXED' && p.amount != null).map(p => Number(p.amount));
  const free = current.some(p => p.priceType === 'FREE');
  if (!priced.length) return free ? { min: 0, max: 0, currency: 'GEL', period: 'MONTH', free: 'ALL' } : null;
  return { min: Math.min(...priced), max: Math.max(...priced), currency: current.find(p => p.currency)?.currency ?? 'GEL', period: 'MONTH', free: free ? 'SOME' : 'NONE' };
}
export const organizationPage = id => pages.get(`organization:${Number(id)}`) ?? null;
export const pageOf = ref => ref.type === 'club' ? clubPage(ref.id) : organizationPage(ref.id);
export const isPageClub = clubId => Boolean(pages.get(`club:${Number(clubId)}`)?.managed);
export const isDraftClub = clubId => pages.get(`club:${Number(clubId)}`)?.status === 'DRAFT';
export const ownedPages = viewer => [...pages.values()].filter(page => page.ownerId === viewer || page.staff.has(viewer));

/** The person's role on a page: the owner, someone who joined its staff, or nobody. */
export function roleOf(page, viewer) {
  if (!page || viewer == null) return null;
  if (page.ownerId === viewer) return 'OWNER';
  return page.staff.get(viewer) ?? null;
}
export const canEdit = (page, viewer) => ['OWNER', 'ADMIN'].includes(roleOf(page, viewer));
/** A club post may come from its owner or staff, as soon as they join. */
export const canPostForClub = (viewer, clubId) => { const page = pages.get(`club:${Number(clubId)}`); return Boolean(page && roleOf(page, viewer)); };

/** The one club a person is part of (owner or staff; Luka is Dinamo's), or null. One club per person; fan clubs are not clubs here. */
export function clubOf(viewer) {
  if (viewer === W.ME_ID) return { ref: { type: 'club', id: C.CLUB_ID }, name: W.clubById(C.CLUB_ID)?.name ?? 'your club' };
  const page = ownedPages(viewer).find(owned => owned.clubId);
  return page ? { ref: page.ref, name: page.identity.name } : null;
}
/** The answer when someone already in a club tries to start another: their club, to open instead. */
export const oneClubRefusal = club => ({ status: 409, body: { status: 409, code: 'ONE_CLUB', message: `You are already part of ${club.name}. One club per person: open it, or start a fan club.`, club } });

export function createPage(viewer, body) {
  const kind = isPageKind(body?.pageKind) ? body.pageKind : body?.organizationType === 'CLUB' ? 'CLUB' : body?.organizationType === 'PARTNER' ? 'FAN_CLUB' : ['COMPANY', 'SPONSOR', 'MEDIA', 'HEALTHCARE'].includes(body?.organizationType) ? 'BUSINESS' : 'PAGE';
  const name = text(body?.displayName, 120);
  if (name.length < 2) return { status: 400, body: { status: 400, message: 'Enter a name between 2 and 120 characters.' } };
  if (kind === 'VENUE') return { status: 400, body: { status: 400, message: 'Venues open later.' } };
  const age = viewerAge(viewer);
  if (age == null || age < PAGE_MINIMUM_AGE) return { status: 403, body: { status: 403, code: 'AGE', minimumAge: PAGE_MINIMUM_AGE, message: `Creating this page needs an account aged ${PAGE_MINIMUM_AGE} or over.` } };
  const current = kind === 'CLUB' ? clubOf(viewer) : null;
  if (current) return oneClubRefusal(current);
  const exact = similarPages(name, null, viewer).find(match => match.exact);
  if (exact) return { status: 409, body: { status: 409, code: 'PAGE_EXISTS', message: `${exact.name} is already on GrassKickZ.`, match: exact } };
  const town = body?.location?.city || V.account(viewer)?.preferences?.town?.name || 'Tbilisi';
  let clubId = null;
  if (kind === 'CLUB') {
    clubId = nextClubId++;
    const t = townOf(town), design = defaultCrest(name);
    registerClub({ id: clubId, name, short: design.initials, type: TYPE_OF_CATEGORY[DEFAULT_CLUB_CATEGORY], city: t.name, venueId: null, founded: null, color: null, verified: false,
      joinPolicy: 'APPLICATION', description: '', lat: t.latitude, lng: t.longitude, address: `${t.name}, Georgia`, logoUrl: null, bannerUrl: null, draft: true, crest: design });
  }
  const page = newPage({ kind, name, town, ownerId: viewer, status: 'DRAFT', clubId, language: body?.language === 'ka' ? 'ka' : 'en' });
  if (kind === 'BUSINESS' && BUSINESS_KINDS.includes(body?.organizationType)) page.identity.businessKind = body.organizationType;
  syncClub(page);
  return { status: 200, body: result(page) };
}
export const result = page => page.clubId
  ? { id: page.organizationId, clubId: page.clubId, profilePath: `/clubs/${page.clubId}`, workspacePath: `/clubs/${page.clubId}/workspace` }
  : { id: page.organizationId, clubId: null, profilePath: `/organizations/${page.organizationId}`, workspacePath: `/organizations/${page.organizationId}/workspace` };

/** Everything a duplicate could be: every club, plus pages that are not clubs. A draft counts only for its own owner. */
function knownPages(viewer) {
  const clubs = W.clubs.filter(club => !club.draft || pages.get(`club:${club.id}`)?.ownerId === viewer).map(club => {
    const page = pages.get(`club:${club.id}`);
    return { ref: { type: 'club', id: club.id }, name: club.name, town: club.city, kind: 'CLUB', crestUrl: crestUrlOf(page) ?? club.logoUrl, status: page?.status ?? 'LIVE', mine: Boolean(page && roleOf(page, viewer)) };
  });
  const others = [...pages.values()].filter(page => !page.clubId && (page.status === 'LIVE' || roleOf(page, viewer))).map(page => ({
    ref: page.ref, name: page.identity.name, town: page.identity.town.name, kind: page.kind, crestUrl: crestUrlOf(page), status: page.status, mine: Boolean(roleOf(page, viewer)),
  }));
  return [...clubs, ...others];
}
export function similarPages(name, town, viewer) {
  return findSimilar(name, knownPages(viewer), { town, limit: 4 }).map(({ candidate, exact }) => ({ ...candidate, exact }));
}

// ---------------------------------------------------------------- known clubs listed from public sources (nobody runs them yet)

function seedListings() {
  for (const seed of listedSeeds) {
    const t = townOf(seed.town), ground = pitchById(seed.ground), design = normalizeCrest(seed.crest, seed.name);
    registerClub({ id: seed.id, name: seed.name, short: seed.short, type: TYPE_OF_CATEGORY[seed.category], city: t.name, venueId: ground?.venueId ?? null, founded: seed.founded, color: null,
      verified: false, joinPolicy: 'APPLICATION', description: '', lat: ground?.latitude ?? t.latitude, lng: ground?.longitude ?? t.longitude, address: ground?.address ?? `${t.name}, Georgia`, logoUrl: null, bannerUrl: null, crest: design });
    const page = newPage({ kind: 'CLUB', name: seed.name, town: seed.town, ownerId: null, status: 'LIVE', clubId: seed.id, organizationId: 800 + seed.id - 300, category: seed.category, crest: design });
    if (ground) page.boxes.grounds.items.push(groundFromPitch(ground));
    for (const [age, gender] of seed.squads) W.squads.push({ id: W.newId(), clubId: seed.id, name: squadName(age, gender), ageGroup: age, gender, headCoachId: null, playerIds: [], format: formatFor(age), trainingDays: [], trainingTime: null, groundId: null });
    syncClub(page);
  }
}

// ---------------------------------------------------------------- reading a page

export const squadsOf = page => page?.clubId ? W.squads.filter(s => s.clubId === page.clubId) : [];
export function crestUrlOf(page) {
  if (!page) return null;
  const crest = page.identity.crest;
  if (crest.kind === 'image') return crest.url;
  return page.clubId ? `/sandbox-media/crest/${page.clubId}.svg?v=${page.identity.version}` : `/sandbox-media/crest/org-${page.organizationId}.svg?v=${page.identity.version}`;
}
export const coverUrlOf = page => !page?.identity.cover ? null : page.identity.cover.kind === 'photo' ? COVER_PHOTOS[page.identity.cover.photo] : page.identity.cover.url;
/** The crest design the media route draws: `400` is a club, `org-7001` a page that is not one. */
export function crestDesignFor(id) {
  const page = String(id).startsWith('org-') ? organizationPage(String(id).slice(4)) : pages.get(`club:${Number(id)}`);
  return page?.identity.crest.kind === 'generated' ? page.identity.crest.design : null;
}

function groundsOf(page) {
  if (page.boxes.grounds.fromPage || !page.clubId) return page.boxes.grounds.items;
  const club = W.clubById(page.clubId), venue = W.venueById(club?.venueId);
  return venue ? [{ id: -venue.id, name: venue.name, address: `${venue.district}, ${venue.city}`, town: venue.city, latitude: venue.lat, longitude: venue.lng, surface: venue.surface.includes('Indoor') ? 'INDOOR' : 'ARTIFICIAL', size: '11v11', indoor: venue.kind === 'INDOOR', pitchId: `v${venue.id}`, venueId: venue.id }] : [];
}
export const groundsFor = page => groundsOf(page);
export function groundFromPitch(pitch) {
  return { id: C.nextId(), name: pitch.name, address: pitch.address, town: pitch.town, latitude: pitch.latitude, longitude: pitch.longitude, surface: pitch.surface, size: pitch.size, indoor: pitch.indoor, pitchId: pitch.id, venueId: pitch.venueId };
}
const postsOf = page => S.posts.filter(post => (page.clubId ? post.clubId === page.clubId : post.organizationId === page.organizationId) && !post.removed).length;
function sponsorsOf(page) { return page.clubId ? (C.presentations.get(page.clubId)?.sponsors ?? []) : page.boxes.sponsors.items; }
function honoursOf(page) { return page.clubId ? (C.honours[page.clubId] ?? []) : []; }
/**
 * A page club's training for the next weeks, made from each squad's days and time: the one source for the club
 * calendar, Coming up and the public squad timetable. Days are 1 (Monday) to 7 (Sunday). The backend would keep these
 * as recurring sessions of the squad's schedule.
 */
export function trainingOf(page, squadId = null, days = 28) {
  const out = [], grounds = groundsOf(page);
  for (const s of squadsOf(page)) {
    if ((squadId != null && s.id !== Number(squadId)) || !s.trainingDays?.length || !s.trainingTime) continue;
    const [hour, minute] = String(s.trainingTime).split(':').map(Number);
    const ground = grounds.find(g => g.id === s.groundId) ?? grounds[0] ?? null;
    for (let d = 0; d < days; d++) {
      const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() + d);
      if (!s.trainingDays.includes(start.getDay() === 0 ? 7 : start.getDay())) continue;
      start.setHours(hour, minute || 0, 0, 0);
      out.push({ id: 900000 + s.id * 100 + d, squad: s, start, end: new Date(start.getTime() + 90 * 60000), ground });
    }
  }
  return out;
}
/** What most clubs in a town ask a month (the middle of their lowest and highest fees, rounded to 10); the whole country when the town has too few. */
function townFees(town, except) {
  const local = townBands(town, except);
  return local ? { ...local, town } : townBands(null, except);
}
function townBands(town, except) {
  const bands = W.clubs.filter(club => (town == null || club.city === town) && club.id !== except && !club.draft).map(club => pages.get(`club:${club.id}`)?.boxes.fees.band ?? bandFromProgrammes(C.presentations.get(club.id)?.programmes ?? []))
    .filter(band => band && band.free !== 'ALL' && band.max > 0);
  if (bands.length < 2) return null;
  const middle = values => { const sorted = [...values].sort((a, b) => a - b); return Math.round(sorted[Math.floor(sorted.length / 2)] / 10) * 10; };
  const min = middle(bands.map(band => band.min)), max = Math.max(min, middle(bands.map(band => band.max)));
  return { min, max, currency: 'GEL', town: null, clubs: bands.length };
}
export const feeBandOf = clubId => pages.get(`club:${Number(clubId)}`)?.boxes.fees.band ?? null;
/** What World's filters need from a page club that has no priced programmes: its fee band and its squads' ages. */
export function pageFilterFacts(clubId) {
  const page = pages.get(`club:${Number(clubId)}`);
  if (!page) return null;
  return { band: page.boxes.fees.band, ages: squadsOf(page).map(s => s.ageGroup === 'SENIOR' ? 18 : Number(s.ageGroup.slice(1)) - 1) };
}

export function factsOf(page) {
  const squads = squadsOf(page), id = page.identity;
  return {
    kind: page.kind, name: id.name, crestKept: Boolean(id.crest.kept), grounds: groundsOf(page).length, squads: squads.length,
    contact: Boolean(id.contact.phone || id.contact.email), fees: Boolean(page.boxes.fees.band) || (page.clubId != null && !page.boxes.grounds.fromPage && (C.presentations.get(page.clubId)?.programmes ?? []).some(p => p.published)),
    players: Boolean(page.boxes.players.shared) || squads.some(s => s.playerIds.length > 0),
    staff: [...page.staff.keys()].filter(staffId => staffId !== page.ownerId).length + page.boxes.staff.invites.length,
    posts: postsOf(page), about: Boolean(id.about.trim()) && !id.aboutAuto, sponsors: sponsorsOf(page).length,
  };
}

export function staffOf(page) {
  // A club from before pages lists the staff the world already knows; a page club lists who created or joined it.
  if (!page.managed && page.clubId) {
    return W.staff.filter(s => s.clubId === page.clubId).map(s => { const p = W.personById(s.personId); return { userId: s.personId, fullName: p?.fullName ?? `Member #${s.personId}`, avatarUrl: p?.avatarUrl ?? null, role: s.kind === 'ADMIN' ? 'CLUB_ADMIN' : 'COACH', title: s.title, bio: null, responsibilities: [] }; });
  }
  const list = [...page.staff.entries()].map(([userId, role]) => ({ userId, fullName: viewerName(userId), avatarUrl: userId === W.ME_ID ? W.me.avatarUrl : null, role: role === 'OWNER' ? 'OWNER' : role === 'ADMIN' ? 'CLUB_ADMIN' : 'COACH',
    title: role === 'OWNER' ? 'Runs the club' : role === 'ADMIN' ? 'Club administrator' : 'Coach', bio: null, qualifications: null,
    // The backend's PublicResponsibility: the club page's Coaches & staff tab reads every field of it.
    responsibilities: squadsOf(page).filter(s => s.headCoachId === userId).map(s => ({ title: 'Head coach', specialisations: ['HEAD_COACH'], squadId: s.id, squadName: s.name, squadIds: [s.id], squadNames: [s.name], clubWide: false, provenance: 'RECORDED_APPOINTMENT', startsOn: null, endsOn: null })) }));
  return list;
}

/** The page as one person sees it. Owners get everything, including the suggestions they may use with one tap. */
export function viewOf(page, viewer) {
  const role = roleOf(page, viewer), editor = ['OWNER', 'ADMIN'].includes(role);
  // Every squad has its own join link, ready to share the moment the squad exists.
  if (editor) for (const squad of squadsOf(page)) page.boxes.players.links[squad.id] ??= Math.random().toString(36).slice(2, 10);
  const facts = factsOf(page), setup = setupState(facts);
  if (setup.complete && !page.setupCompletedAt) page.setupCompletedAt = now();
  const id = page.identity, account = V.account(viewer);
  return {
    ref: page.ref, organizationId: page.organizationId, clubId: page.clubId, kind: page.kind, status: page.status,
    verification: page.verification,
    viewer: { role, canEdit: editor, editable: editor ? 'ALL' : role === 'COACH' ? ['squads', 'events', 'posts'] : [] },
    identity: { ...id, crest: { ...id.crest, url: crestUrlOf(page) }, cover: id.cover ? { ...id.cover, url: coverUrlOf(page) } : null,
      contact: editor || page.status === 'LIVE' ? id.contact : { phone: '', email: '' } },
    layout: { version: page.layout.version, columns: page.layout.columns, hidden: page.layout.hidden },
    boxes: {
      grounds: { version: page.boxes.grounds.version, items: groundsOf(page) },
      squads: { version: page.boxes.squads.version, items: squadsOf(page).map(s => ({ id: s.id, name: s.name, ageGroup: s.ageGroup, gender: s.gender, format: s.format, days: s.trainingDays ?? [], time: s.trainingTime ?? null,
        groundId: s.groundId ?? null, players: s.playerIds.length, coach: s.headCoachId ? { userId: s.headCoachId, name: viewerName(s.headCoachId), you: s.headCoachId === viewer } : null })) },
      fees: { version: page.boxes.fees.version, band: page.boxes.fees.band },
      staff: { version: page.boxes.staff.version, members: staffOf(page), invites: editor ? page.boxes.staff.invites : [] },
      players: { version: page.boxes.players.version, shared: page.boxes.players.shared, links: editor ? page.boxes.players.links : {}, waiting: editor ? page.arrivals.filter(a => a.status === 'WAITING').length : 0 },
      sponsors: { version: page.boxes.sponsors.version, items: sponsorsOf(page) },
      honours: { version: page.boxes.honours.version, items: honoursOf(page).map(h => ({ id: h.id, title: h.title, year: h.yearWon })) },
      involved: { version: page.boxes.involved.version, parts: page.boxes.involved.parts },
    },
    setup: { ...setup, completedAt: page.setupCompletedAt }, goLive: goLiveCheck(facts),
    links: result(page),
    suggestions: editor ? { ...(account ? { phone: account.phone ?? '', email: account.email ?? '' } : viewer === W.ME_ID ? { phone: '+995 599 12 34 56', email: W.me.email } : { phone: '', email: '' }), fees: page.kind === 'CLUB' ? townFees(id.town.name, page.clubId) : null } : null,
    createdAt: page.createdAt, liveAt: page.liveAt,
  };
}

// ---------------------------------------------------------------- writing through to the club

/** Copies the page's identity onto the club record, so every list, pin and search result shows the same club. */
export function syncClub(page) {
  // The About follows the page (its teams, its town) until the owner writes their own.
  if (page.identity.aboutAuto) page.identity.about = aboutSuggestion({ kind: page.kind, town: page.identity.town.name, squads: squadsOf(page) }, page.identity.language);
  if (!page.clubId) return;
  const club = W.clubById(page.clubId), id = page.identity, grounds = groundsOf(page);
  club.name = id.name;
  club.city = id.town.name;
  club.crest = id.crest.kind === 'generated' ? id.crest.design : null;
  club.short = club.crest?.initials ?? club.short;
  if (id.clubCategory && TYPE_OF_CATEGORY[id.clubCategory]) {
    club.type = TYPE_OF_CATEGORY[id.clubCategory];
    const presentation = C.presentations.get(club.id);
    if (presentation) presentation.profileKind = PROFILE_KIND[club.type] ?? presentation.profileKind;
  }
  if (page.boxes.grounds.fromPage) {
    const first = grounds[0];
    club.lat = first?.latitude ?? id.town.latitude; club.lng = first?.longitude ?? id.town.longitude;
    club.address = first ? first.address : `${id.town.name}, Georgia`; club.venueId = first?.venueId ?? null;
  }
  const edits = C.clubEdits.get(club.id) ?? {};
  club.logoUrl = crestUrlOf(page); club.bannerUrl = coverUrlOf(page);
  C.clubEdits.set(club.id, { ...edits, description: id.about, logoUrl: club.logoUrl, bannerUrl: club.bannerUrl ?? undefined });
  C.contacts[club.id] = { ...(C.contacts[club.id] ?? {}), email: id.contact.email || null, whatsappNumber: id.contact.phone || null,
    websiteUrl: shownLink(id.social.website), instagramUrl: instagramUrl(id.social.instagram), facebookUrl: shownLink(id.social.facebook),
    preferredCommunicationMethod: id.contact.phone ? 'WHATSAPP' : id.contact.email ? 'EMAIL' : null };
}

/** Identity fields a save may change, each cleaned. Unknown fields are ignored. Returns why a link is refused, if one is. */
export function applyIdentity(page, patch) {
  const id = page.identity;
  const links = {};
  for (const key of ['website', 'instagram', 'facebook']) {
    if (patch.social?.[key] === undefined) continue;
    const saved = savedLink(key, text(patch.social[key], 300));
    if (saved.error) return saved.error;
    links[key] = saved.value;
  }
  if (patch.name !== undefined) { const name = text(patch.name, 120); if (name.length >= 2) id.name = name; }
  if (patch.tagline !== undefined) id.tagline = text(patch.tagline, 80);
  if (patch.about !== undefined) id.about = String(patch.about ?? '').trim().slice(0, 600);
  if (patch.aboutAuto !== undefined) id.aboutAuto = Boolean(patch.aboutAuto);
  if (patch.town?.name) id.town = townOf(patch.town.name);
  if (patch.crest) {
    if (patch.crest.kind === 'image' && typeof patch.crest.url === 'string' && patch.crest.url.startsWith('/')) id.crest = { kind: 'image', url: patch.crest.url, kept: true };
    else if (patch.crest.kind === 'generated') id.crest = { kind: 'generated', design: normalizeCrest(patch.crest.design, id.name), kept: patch.crest.kept !== false };
  }
  if (patch.cover !== undefined) {
    if (patch.cover === null) id.cover = null;
    else if (patch.cover.kind === 'photo' && isCoverPhoto(patch.cover.photo)) id.cover = { kind: 'photo', photo: patch.cover.photo };
    else if (patch.cover.kind === 'image' && typeof patch.cover.url === 'string' && patch.cover.url.startsWith('/')) id.cover = { kind: 'image', url: patch.cover.url };
  }
  if (patch.contact) id.contact = { phone: patch.contact.phone !== undefined ? phoneText(patch.contact.phone) : id.contact.phone, email: patch.contact.email !== undefined ? text(patch.contact.email, 254) : id.contact.email };
  Object.assign(id.social, links);
  if (patch.businessKind !== undefined && page.kind === 'BUSINESS' && BUSINESS_KINDS.includes(patch.businessKind)) id.businessKind = patch.businessKind;
  if (patch.clubCategory !== undefined && page.kind === 'CLUB' && CLUB_CATEGORIES.includes(patch.clubCategory)) id.clubCategory = patch.clubCategory;
  id.version++;
  syncClub(page);
}

export const layoutFrom = (page, body) => normalizeLayout(page.kind, body);
export { isBoxKey, nameKey };

// ---------------------------------------------------------------- posts and the feed
/** Pages that are not clubs post as themselves: their owner and staff may, and the post shows the page's name and crest. */
export const canPostForOrganization = (viewer, organizationId) => { const page = organizationPage(organizationId); return Boolean(page && roleOf(page, viewer)); };
export const organizationAuthor = organizationId => { const page = organizationPage(organizationId); return page ? { name: page.identity.name, crestUrl: crestUrlOf(page), town: page.identity.town } : null; };
/** Clubs a person runs or coaches at: their posts are the person's own news on Home. */
export const linkedPageClubs = viewer => ownedPages(viewer).filter(page => page.clubId).map(page => page.clubId);

// Seeded last, once every helper above exists.
seedListings();

/** Cancelling a creation: a draft and everything it made (its club, its teams) are gone, as if never started. */
export function deleteDraft(page) {
  pages.delete(pageKey(page.ref));
  if (!page.clubId) return;
  const id = page.clubId;
  const without = (list, keep) => { for (let i = list.length - 1; i >= 0; i -= 1) if (!keep(list[i])) list.splice(i, 1); };
  without(W.clubs, club => club.id !== id);
  without(W.squads, squad => squad.clubId !== id);
  for (const map of [C.clubPolicy, C.presentations, C.memberCountHooks, C.clubEdits]) map?.delete?.(id);
  delete C.followerCounts[id];
  delete C.honours[id];
}
