// Saving one box of a page, written through to the club records (squads, sponsors, honours) the app already reads;
// join links that let each parent add their own child; invite links for staff. Each box keeps its own version, so
// two people editing different boxes never clash and two editing the same box get "Someone just changed this".
//
// BACKEND NEEDED (PAGE_CREATION.md section 6): PUT …/page/boxes/:key with { version, data } → 409 with the current box.
import * as W from './world.mjs';
import * as C from './world-club.mjs';
import { pitchById } from './pages-seed.mjs';
import { AGE_GROUPS, squadsOf, squadName, groundFromPitch, groundsFor, syncClub, viewerName, ageOf } from './pages-data.mjs';
import { INVOLVED_PARTS } from '../../src/features/pages/model/kinds.ts';

const text = (value, max) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
const number = value => (value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value));
const GENDERS = ['MALE', 'FEMALE', 'MIXED'];
const SURFACES = ['GRASS', 'ARTIFICIAL', 'HYBRID', 'INDOOR'];
const SIZES = ['5v5', '7v7', '9v9', '11v11'];
const CURRENCIES = ['GEL', 'USD', 'EUR'];
const formatFor = age => { const n = age === 'SENIOR' ? 99 : Number(age.slice(1)); return n <= 8 ? '5v5' : n <= 10 ? '7v7' : n <= 12 ? '9v9' : '11v11'; };
const code = () => Math.random().toString(36).slice(2, 10);
const fail = (status, message, extra = {}) => ({ error: { status, body: { status, message, ...extra } } });

const savers = {
  grounds(page, data) {
    const items = Array.isArray(data?.items) ? data.items.slice(0, 8) : null;
    if (!items) return fail(400, 'Send the grounds as a list.');
    const current = new Map(groundsFor(page).map(g => [g.id, g]));
    const next = [];
    for (const item of items) {
      const pitch = item?.pitchId ? pitchById(item.pitchId) : null;
      const latitude = number(item?.latitude ?? pitch?.latitude), longitude = number(item?.longitude ?? pitch?.longitude);
      if (latitude == null || longitude == null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return fail(400, 'Every ground needs a place on the map.');
      const base = current.get(item?.id) ?? (pitch ? groundFromPitch(pitch) : { id: C.nextId(), pitchId: null, venueId: null });
      next.push({ ...base, name: text(item?.name, 120) || base.name || 'Our ground', address: text(item?.address, 200) || base.address || '', town: text(item?.town, 80) || base.town || page.identity.town.name,
        latitude, longitude, surface: SURFACES.includes(item?.surface) ? item.surface : base.surface ?? 'ARTIFICIAL', size: SIZES.includes(item?.size) ? item.size : base.size ?? '7v7', indoor: Boolean(item?.indoor ?? base.indoor) });
    }
    page.boxes.grounds.items = next;
    page.boxes.grounds.fromPage = true;
    syncClub(page);
    return {};
  },

  squads(page, data, viewer) {
    if (!page.clubId) return fail(400, 'Only a club has squads.');
    const items = Array.isArray(data?.items) ? data.items.slice(0, 30) : null;
    if (!items) return fail(400, 'Send the squads as a list.');
    const existing = squadsOf(page), keep = new Set(), seen = new Set();
    for (const item of items) {
      const age = AGE_GROUPS.includes(item?.ageGroup) ? item.ageGroup : null, gender = GENDERS.includes(item?.gender) ? item.gender : null;
      if (!age || !gender) return fail(400, 'Each squad needs an age group and boys, girls or mixed.');
      const days = Array.isArray(item?.days) ? [...new Set(item.days.map(Number).filter(d => d >= 1 && d <= 7))].sort() : [];
      const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(item?.time ?? '') ? item.time : null;
      const groundId = item?.groundId != null && groundsFor(page).some(g => g.id === Number(item.groundId)) ? Number(item.groundId) : null;
      let squad = item?.id != null ? existing.find(s => s.id === Number(item.id)) : existing.find(s => s.ageGroup === age && s.gender === gender && !keep.has(s.id));
      if (seen.has(`${age}:${gender}`) && !squad) continue;
      seen.add(`${age}:${gender}`);
      if (!squad) {
        squad = { id: W.newId(), clubId: page.clubId, name: '', ageGroup: age, gender, headCoachId: page.ownerId === viewer ? viewer : null, playerIds: [], format: formatFor(age), trainingDays: [], trainingTime: null, groundId: null };
        W.squads.push(squad);
      }
      Object.assign(squad, { name: text(item?.name, 60) || squad.name || squadName(age, gender), ageGroup: age, gender, format: formatFor(age), trainingDays: days, trainingTime: time, groundId });
      keep.add(squad.id);
    }
    const leaving = existing.filter(s => !keep.has(s.id));
    const busy = leaving.find(s => s.playerIds.length > 0);
    if (busy) return fail(409, `${busy.name} has players. Move them to another squad first.`, { code: 'SQUAD_HAS_PLAYERS', squadId: busy.id });
    for (const squad of leaving) W.squads.splice(W.squads.indexOf(squad), 1);
    for (const squad of squadsOf(page)) if (!page.boxes.players.links[squad.id]) page.boxes.players.links[squad.id] = code();
    syncClub(page);
    return {};
  },

  fees(page, data) {
    const band = data?.band;
    if (band === null) { page.boxes.fees.band = null; return {}; }
    const min = number(band?.min), max = number(band?.max);
    const free = ['NONE', 'SOME', 'ALL'].includes(band?.free) ? band.free : 'NONE';
    if (free !== 'ALL' && (min == null || max == null || min < 0 || max > 5000 || min > max)) return fail(400, 'Choose a fee from and to, or Free.');
    page.boxes.fees.band = { min: free === 'ALL' ? 0 : min, max: free === 'ALL' ? 0 : max, currency: CURRENCIES.includes(band?.currency) ? band.currency : 'GEL', period: 'MONTH', free };
    return {};
  },

  staff(page, data) {
    const invites = Array.isArray(data?.invites) ? data.invites.slice(0, 40) : null;
    if (!invites) return fail(400, 'Send the invitations as a list.');
    const current = new Map(page.boxes.staff.invites.map(invite => [invite.id, invite]));
    page.boxes.staff.invites = invites.map(item => {
      const found = current.get(item?.id);
      const squadId = item?.squadId != null && squadsOf(page).some(s => s.id === Number(item.squadId)) ? Number(item.squadId) : null;
      return found ? { ...found, name: text(item?.name, 80) || found.name, role: ['COACH', 'ASSISTANT', 'ADMIN'].includes(item?.role) ? item.role : found.role, squadId }
        : { id: C.nextId(), name: text(item?.name, 80), phone: String(item?.phone ?? '').replace(/[^\d+]/g, '').slice(0, 20), role: ['COACH', 'ASSISTANT', 'ADMIN'].includes(item?.role) ? item.role : 'COACH',
          squadId, status: 'INVITED', code: code(), at: new Date().toISOString() };
    });
    return {};
  },

  players(page, data) {
    if (data?.shared !== undefined) page.boxes.players.shared = Boolean(data.shared) || page.boxes.players.shared;
    return {};
  },

  sponsors(page, data) {
    const items = Array.isArray(data?.items) ? data.items.slice(0, 20) : null;
    if (!items) return fail(400, 'Send the sponsors as a list.');
    const clean = items.filter(item => text(item?.name, 120)).map(item => ({ id: number(item?.id) ?? C.nextId(), name: text(item.name, 120), logoUrl: typeof item?.logoUrl === 'string' && item.logoUrl.startsWith('/') ? item.logoUrl : null,
      websiteUrl: /^https?:\/\//.test(item?.websiteUrl ?? '') ? text(item.websiteUrl, 300) : null, organizationId: number(item?.organizationId), published: true }));
    if (page.clubId) C.presentations.get(page.clubId).sponsors = clean; else page.boxes.sponsors.items = clean;
    return {};
  },

  honours(page, data) {
    if (!page.clubId) return fail(400, 'Only a club has honours.');
    const items = Array.isArray(data?.items) ? data.items.slice(0, 30) : null;
    if (!items) return fail(400, 'Send the honours as a list.');
    C.honours[page.clubId] = items.filter(item => text(item?.title, 120) && number(item?.year)).map(item => ({ id: number(item.id) ?? C.nextId(), title: text(item.title, 120), yearWon: Number(item.year), description: null }));
    return {};
  },

  involved(page, data) {
    const parts = Array.isArray(data?.parts) ? data.parts.filter(part => INVOLVED_PARTS.includes(part)) : null;
    if (!parts) return fail(400, 'Send the parts as a list.');
    page.boxes.involved.parts = INVOLVED_PARTS.filter(part => parts.includes(part));
    return {};
  },
};

/** Saves one box when the version matches; otherwise says so with the current state. */
export function saveBox(page, key, body, viewer) {
  const saver = savers[key], box = page.boxes[key];
  if (!saver || !box) return { error: { status: 404, body: { status: 404, message: 'This box has nothing to save.' } } };
  if (body?.version != null && Number(body.version) !== box.version) return { error: { status: 409, body: { status: 409, code: 'VERSION_CONFLICT', message: 'Someone just changed this.' } } };
  const outcome = saver(page, body?.data ?? {}, viewer);
  if (outcome.error) return outcome;
  box.version++;
  return {};
}

// ---------------------------------------------------------------- join links (players) and invite links (staff)

/** A parent opening a squad's join link: which club, which squad, and the age it is for. */
export function joinLinkFor(pagesList, codeValue) {
  for (const page of pagesList) {
    const entry = Object.entries(page.boxes.players.links).find(([, value]) => value === codeValue);
    if (entry) { const squad = W.squadById(entry[0]); if (squad && squad.clubId === page.clubId) return { page, squad }; }
  }
  return null;
}
/** The squad a child fits by birth year: the link's own squad when it fits, else the youngest group of their age and team. */
export function squadForBirthYear(page, birthDate, linked, childGender = null) {
  const age = ageOf(birthDate);
  if (age == null) return linked;
  const limit = s => (s.ageGroup === 'SENIOR' ? 99 : Number(s.ageGroup.slice(1)));
  const ageFits = s => (s.ageGroup === 'SENIOR' ? age >= 18 : age < limit(s) && age >= limit(s) - 2);
  const teamFits = s => !childGender || s.gender === 'MIXED' || s.gender === childGender;
  if (ageFits(linked) && teamFits(linked)) return linked;
  return squadsOf(page).filter(s => ageFits(s) && teamFits(s)).sort((a, b) => limit(a) - limit(b))[0] ?? linked;
}
export function addArrival(page, squad, guardian, body) {
  const first = text(body?.childFirstName, 60), last = text(body?.childLastName, 60), birthDate = String(body?.birthDate ?? '');
  if (!first || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return fail(400, 'Add your child’s first name and date of birth.');
  if (body?.consent !== true) return fail(400, 'Only a parent or guardian can add a child.');
  const age = ageOf(birthDate);
  if (age == null || age < 3 || age > 19) return fail(400, 'Check the date of birth.');
  const fit = squadForBirthYear(page, birthDate, squad, ['MALE', 'FEMALE'].includes(body?.childGender) ? body.childGender : null);
  const arrival = { id: C.nextId(), childFirstName: first, childLastName: last, childGender: ['MALE', 'FEMALE'].includes(body?.childGender) ? body.childGender : null, birthDate, birthYear: Number(birthDate.slice(0, 4)), squadId: fit.id, linkSquadId: squad.id,
    guardianId: guardian, guardianName: viewerName(guardian), status: 'WAITING', at: new Date().toISOString(),
    // An existing card the guardian chose (checked as theirs in squad-page.mjs): approving joins that card, no duplicate.
    playerId: Number.isSafeInteger(body?.playerId) ? body.playerId : null };
  page.arrivals.push(arrival);
  page.boxes.players.shared = true;
  return { arrival };
}
/** The coach says yes: the child joins the squad as a private player card linked to the guardian who added them. */
export function decideArrival(page, arrivalId, action, squadId) {
  const arrival = page.arrivals.find(a => a.id === Number(arrivalId) && a.status === 'WAITING');
  if (!arrival) return fail(404, 'This child was already answered.');
  if (action === 'DECLINE') { arrival.status = 'DECLINED'; return { arrival }; }
  const squad = squadsOf(page).find(s => s.id === Number(squadId ?? arrival.squadId)) ?? squadsOf(page)[0];
  if (!squad) return fail(400, 'Add a squad first.');
  const existing = arrival.playerId && W.personById(arrival.playerId);
  const person = existing || { id: arrival.playerId ?? W.newId(), firstName: arrival.childFirstName, lastName: arrival.childLastName, fullName: `${arrival.childFirstName} ${arrival.childLastName}`.trim(), username: null, gender: arrival.childGender ?? (squad.gender === 'FEMALE' ? 'FEMALE' : 'MALE'),
    role: 'PLAYER', birthYear: arrival.birthYear, city: page.identity.town.name, clubId: page.clubId, position: null, headline: null, avatarUrl: null, squadId: squad.id, guardianId: arrival.guardianId, isPrivate: true };
  if (!existing) W.people.push(person);
  if (!squad.playerIds.includes(person.id)) squad.playerIds.push(person.id);
  Object.assign(arrival, { status: 'APPROVED', squadId: squad.id, playerId: person.id });
  return { arrival };
}
/** The fallback when parents are not on WhatsApp: names pasted one per line become private player cards. */
export function pastePlayers(page, squadId, names) {
  const squad = squadsOf(page).find(s => s.id === Number(squadId));
  if (!squad) return fail(400, 'Choose a squad.');
  const list = (Array.isArray(names) ? names : []).map(name => text(name, 80)).filter(name => name.length >= 2).slice(0, 60);
  if (!list.length) return fail(400, 'Paste at least one name.');
  for (const name of list) {
    const [first, ...rest] = name.split(' ');
    const existing = arrival.playerId && W.personById(arrival.playerId);
  const person = existing || { id: arrival.playerId ?? W.newId(), firstName: first, lastName: rest.join(' '), fullName: name, username: null, gender: squad.gender === 'FEMALE' ? 'FEMALE' : 'MALE', role: 'PLAYER', birthYear: null,
      city: page.identity.town.name, clubId: page.clubId, position: null, headline: null, avatarUrl: null, squadId: squad.id, isPrivate: true, invitePending: true };
    W.people.push(person);
    squad.playerIds.push(person.id);
  }
  page.boxes.players.shared = true;
  return { added: list.length };
}

export function inviteFor(pagesList, codeValue) {
  for (const page of pagesList) { const invite = page.boxes.staff.invites.find(i => i.code === codeValue); if (invite) return { page, invite }; }
  return null;
}
export function acceptInvite(page, invite, viewer) {
  if (invite.status === 'JOINED') return invite.userId === viewer ? {} : fail(409, 'This invitation was already used.');
  if (page.ownerId === viewer) return fail(409, 'You already run this page.');
  page.staff.set(viewer, invite.role === 'ADMIN' ? 'ADMIN' : 'COACH');
  Object.assign(invite, { status: 'JOINED', userId: viewer, name: invite.name || viewerName(viewer) });
  const squad = invite.squadId ? W.squadById(invite.squadId) : null;
  if (squad && invite.role === 'COACH' && (!squad.headCoachId || squad.headCoachId === page.ownerId)) squad.headCoachId = viewer;
  return {};
}
