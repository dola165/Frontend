// Football-activity extension of the synthetic world: venues and bookings, match exchange,
// tournaments and competitions, schedules and journeys, tryouts, admissions groups, roles,
// store and campaigns. Built on top of world.mjs; deterministic and entirely invented.
import * as W from './world.mjs';

const { day, iso, isoDate, local, clubs, venues, squads, matches, referees, clubById, venueById, personById } = W;

// ---------------------------------------------------------------- helpers
// Own seeded generator so football data never shifts the shared world sequence.
let fseed = 99173;
export const frand = () => { fseed = (fseed * 1103515245 + 12345) % 2147483648; return fseed / 2147483648; };
export const fpick = list => list[Math.floor(frand() * list.length)];
export const fint = (min, max) => min + Math.floor(frand() * (max - min + 1));
export const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export const TZ = 'Asia/Tbilisi';
export const DINAMO = 1;
export const at = (offset, hour = 0, minute = 0) => day(offset, hour, minute);
/** Days until the next given weekday (0 = Sunday), at least `min` days ahead. */
export const nextDow = (dow, min = 1) => { for (let o = min; o < min + 7; o++) if (day(o).getDay() === dow) return o; return min; };
export const plusMin = (d, minutes) => new Date(d.getTime() + minutes * 60000);
export const kmBetween = (lat1, lng1, lat2, lng2) => {
  const r = Math.PI / 180, a = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lng2 - lng1) * r / 2) ** 2;
  return Math.round(12742 * Math.asin(Math.sqrt(a)) * 10) / 10;
};
export const dateOnly = d => isoDate(d);
export const crest = id => `/sandbox-media/crest/${id}.svg`;
export const photo = key => `/sandbox-media/photo/${key}.svg`;
export const avatar = id => `/sandbox-media/avatar/${id}.svg`;
export const lower = s => String(s ?? '').toLowerCase();
export const matchesText = (q, ...fields) => !q || fields.some(f => lower(f).includes(lower(q).trim()));

// Pagination wrappers used by different API families.
export const slice = (list, page = 0, size = 20) => list.slice(page * size, page * size + size);
export const springPage = (list, page = 0, size = 20) => {
  const content = slice(list, page, size), totalPages = Math.max(1, Math.ceil(list.length / size));
  return { content, totalElements: list.length, totalPages, number: page, size, numberOfElements: content.length, first: page === 0, last: page >= totalPages - 1, empty: content.length === 0 };
};
export const pageResult = (list, page = 0, size = 20) => ({ content: slice(list, page, size), pageNumber: page, pageSize: size, totalElements: list.length, totalPages: Math.max(1, Math.ceil(list.length / size)) });
export const itemPage = (list, page = 0, size = 20) => ({ items: slice(list, page, size), total: list.length, page, size, pageSize: size, hasMore: (page + 1) * size < list.length });

export const DINAMO_SQUADS = squads.filter(s => s.clubId === DINAMO);
export const squadsOf = clubId => squads.filter(s => s.clubId === Number(clubId));
// Opponents sometimes field an age group the shared world does not list; those guest
// squads exist only in football views so fixtures never pair a U16 side with a senior team.
const guestSquads = [];
export const sq = id => W.squadById(id) || guestSquads.find(s => s.id === Number(id)) || null;
const squadById = sq;
/** The club's squad for an age group and gender, or a guest squad with a matching name. */
export const squadFor = (clubId, ageGroup, gender = 'MIXED') => {
  const ages = ageGroup === 'U19' ? ['U19', 'U18'] : ageGroup === 'U18' ? ['U18', 'U19'] : [ageGroup];
  const word = gender === 'FEMALE' ? 'Girls' : gender === 'MALE' ? 'Boys' : 'Mixed';
  const exact = squadsOf(clubId).filter(s => ages.includes(s.ageGroup));
  if (exact.length) return exact.find(s => ageGroup === 'SENIOR' || s.name.includes(word) || s.name.includes('Mixed')) || exact[0];
  let guest = guestSquads.find(s => s.clubId === Number(clubId) && s.ageGroup === ageGroup && s.gender === gender);
  if (!guest) {
    guest = { id: 9101 + guestSquads.length, clubId: Number(clubId), name: ageGroup === 'SENIOR' ? 'Senior team' : `${ageGroup} ${word}`, ageGroup, gender, headCoachId: null, playerIds: [], format: ['U8', 'U9', 'U10', 'U11', 'U12'].includes(ageGroup) ? '7v7' : ['U13', 'U14'].includes(ageGroup) ? '9v9' : '11v11', trainingDays: [2, 4], guest: true };
    guestSquads.push(guest);
  }
  return guest;
};
const COACH_NAMES = ['Irakli Tsiklauri', 'Giorgi Abashidze', 'Levan Kurdadze', 'Nino Japaridze', 'Shota Gogia', 'Tamar Bakradze', 'Rati Lomidze', 'Davit Chikovani', 'Otar Mchedlishvili', 'Eka Tsereteli', 'Vakhtang Nozadze', 'Ana Kakabadze', 'Archil Gvazava', 'Mate Shengelia', 'Keti Dolidze'];
export const clubCoachName = clubId => COACH_NAMES[(Number(clubId) * 7) % COACH_NAMES.length];
export const clubPhone = clubId => `+995 32 2${String(10 + clubId).padStart(2, '0')} ${String(40 + clubId * 3).padStart(2, '0')} ${String(11 + clubId * 5).padStart(2, '0')}`;

// ---------------------------------------------------------------- clubs as places
export const clubCategory = c => ({ ACADEMY: [3, 4].includes(c.id) ? 'PRIVATE_ACADEMY' : 'PROFESSIONAL_ACADEMY', PROFESSIONAL: 'PROFESSIONAL_CLUB', SEMI_PROFESSIONAL: 'SEMI_PROFESSIONAL_CLUB', GRASSROOTS: 'COMMUNITY_CLUB', SCHOOL: 'SCHOOL_CLUB', AMATEUR: 'AMATEUR_CLUB' })[c.type] || 'OTHER';
export const CATEGORY_LABEL = { PROFESSIONAL_CLUB: 'Professional club', SEMI_PROFESSIONAL_CLUB: 'Semi-professional club', PROFESSIONAL_ACADEMY: 'Professional academy', PRIVATE_ACADEMY: 'Private academy', SCHOOL_CLUB: 'School club', AMATEUR_CLUB: 'Amateur club', COMMUNITY_CLUB: 'Community club', OTHER: 'Football club' };
export const joinPolicy = c => c.joinPolicy === 'APPLICATION' ? 'APPLICATION_REQUIRED' : c.joinPolicy;
export const memberCount = c => squadsOf(c.id).reduce((n, s) => n + s.playerIds.length, 0) + (c.id === DINAMO ? W.staff.length : 4);
export const followerCount = c => c.id === DINAMO ? 2416 : c.id === 2 ? 18940 : 90 + hash(c.name) % 900;

// ---------------------------------------------------------------- venues
const kindLabel = { STADIUM: 'Stadium', TRAINING_GROUND: 'Training ground', INDOOR: 'Indoor arena', COMMUNITY: 'Community pitches' };
const baseRate = { 201: 1800, 202: 260, 207: 220 };
const surfaceKey = v => /Natural|Hybrid/.test(v.surface) ? 'NATURAL_GRASS' : /parquet/.test(v.surface) ? 'INDOOR' : 'ARTIFICIAL_GRASS';
const pitchFormat = (v, name) => v.kind === 'INDOOR' && /Court/.test(name) ? 'FUTSAL' : /5-a-side/.test(name) ? '5_A_SIDE' : /7-a-side|small-sided|Half|Small|Indoor hall|Dome/.test(name) ? '7_A_SIDE' : '11_A_SIDE';
const venueAmenities = v => [
  'Changing rooms', 'Floodlights', ...(v.kind !== 'COMMUNITY' ? ['Showers', 'First aid room'] : ['Drinking water']),
  ...(v.capacity >= 1000 ? ['Spectator stand'] : []), ...(v.kind === 'STADIUM' ? ['Media room', 'Parking'] : ['Free parking']), ...(v.id % 3 === 0 ? ['Café'] : []),
];
export const venueOwnerClub = v => clubs.find(c => c.venueId === v.id && (v.id !== 205 || c.id === 3)) || null;
for (const v of venues) {
  const full = v.hourly ?? baseRate[v.id] ?? 200;
  v.pitchList = v.pitches.map((name, i) => {
    const format = pitchFormat(v, name);
    const big = v.kind === 'STADIUM' || v.kind === 'TRAINING_GROUND';
    const scaled = big && format !== '11_A_SIDE' ? Math.round(full * 0.55 / 5) * 5 : !big && format === '5_A_SIDE' && v.pitches.some(n => /7-a-side|Main|Full/.test(n)) ? Math.round(full * 0.7 / 5) * 5 : full;
    return { id: v.id * 10 + i + 1, photoUrl: photo(`pitch-${v.id}-${i}`), revision: 1, name, format, surface: surfaceKey(v), covered: v.kind === 'INDOOR' || /Indoor|Dome/.test(name), pricePerHour: scaled, active: !(v.id === 201 && i > 0), resourceGroup: '', resourceUnits: [] };
  });
}
export const pitchById = id => venues.flatMap(v => v.pitchList).find(p => p.id === Number(id));
export const venueOfPitch = id => venues.find(v => v.pitchList.some(p => p.id === Number(id)));
export const venueView = v => {
  const owner = venueOwnerClub(v);
  return {
    id: v.id, revision: 3, displayName: v.name,
    description: `${kindLabel[v.kind]} in ${v.district}, ${v.city}. ${v.surface} surface${v.pitches.length > 1 ? `, ${v.pitches.length} bookable areas` : ''} and room for ${v.capacity.toLocaleString('en-GB')} spectators. Book online and pay at the venue.`,
    city: v.city, addressText: `${v.district}, ${v.city}`, latitude: v.lat, longitude: v.lng, timezone: TZ, currency: 'GEL',
    publicPhone: clubPhone(v.id - 190), publicEmail: `bookings@${v.name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')}.ge`, website: '',
    bookingMode: v.kind === 'STADIUM' ? 'REQUEST' : 'INSTANT', published: true, cancellationHours: 24, minBookingMinutes: 60, maxBookingMinutes: 180, slotMinutes: 30,
    amenities: venueAmenities(v), logoUrl: owner ? owner.logoUrl : null,
    photos: [{ url: photo(`venue-${v.id}`), caption: v.pitches[0] }, { url: photo(`venue-${v.id}-stand`), caption: 'Floodlights and stand' }, { url: photo(`venue-${v.id}-pitch`), caption: v.pitches.at(-1) }],
    openingHours: [1, 2, 3, 4, 5, 6, 7].map(d => ({ dayOfWeek: d, opensAt: d >= 6 ? '09:00' : '08:00', closesAt: '23:00' })),
    pitches: v.pitchList, canManage: false, verificationStatus: owner?.verified || v.kind === 'STADIUM' ? 'VERIFIED' : 'UNVERIFIED',
    organizations: owner ? [{ id: 900 + owner.id, displayName: owner.name, clubId: owner.id, logoUrl: owner.logoUrl, relationships: ['OPERATES'], declared: true }] : [],
  };
};
export const fromPrice = v => Math.min(...v.pitchList.filter(p => p.active).map(p => p.pricePerHour));

// Bookings: Luka's reservations plus other renters, all in memory.
export const bookings = [];
let bookingSeq = 1500;
export const addBooking = ({ venueId, pitchId, start, minutes, status = 'CONFIRMED', kind = 'RENTAL', contactName, contactPhone = '+995 599 12 34 56', note = '', userId = null, seriesId = null }) => {
  const pitch = pitchById(pitchId);
  const b = { id: ++bookingSeq, venueId, pitchId, start, end: plusMin(start, minutes), status, kind, contactName, contactPhone, note, userId, seriesId, created: new Date(), totalPrice: Math.round(pitch.pricePerHour * minutes / 60) };
  bookings.push(b); return b;
};
addBooking({ venueId: 205, pitchId: 2051, start: at(6, 19), minutes: 90, contactName: 'Luka Gelashvili', note: 'U14 Boys extra finishing session', userId: W.ME_ID });
addBooking({ venueId: 211, pitchId: 2111, start: at(3, 20), minutes: 60, status: 'PENDING', contactName: 'Luka Gelashvili', note: 'Staff five-a-side', userId: W.ME_ID });
addBooking({ venueId: 213, pitchId: 2131, start: at(13, 18, 30), minutes: 90, contactName: 'Luka Gelashvili', note: 'U16 Boys indoor session if the weather turns', userId: W.ME_ID });
addBooking({ venueId: 206, pitchId: 2061, start: at(-5, 18), minutes: 120, contactName: 'Luka Gelashvili', note: 'Friendly vs Gldani Juniors', userId: W.ME_ID });
addBooking({ venueId: 203, pitchId: 2032, start: at(-12, 17), minutes: 90, status: 'CANCELLED', contactName: 'Luka Gelashvili', note: 'Moved indoors', userId: W.ME_ID });
for (const v of venues) for (const p of v.pitchList) for (let d = -3; d < 16; d++) {
  const h = hash(`${p.id}:${d}`), weekend = [0, 6].includes(at(d).getDay());
  const renter = k => COACH_NAMES[(h + k) % COACH_NAMES.length];
  if (h % 3 !== 0) addBooking({ venueId: v.id, pitchId: p.id, start: at(d, 17 + (h % 3), h % 2 ? 30 : 0), minutes: 60 + 30 * (h % 3), status: h % 7 === 0 ? 'PENDING' : 'CONFIRMED', contactName: renter(0) });
  if (h % 5 < 3) addBooking({ venueId: v.id, pitchId: p.id, start: at(d, 21), minutes: 90, contactName: renter(3) });
  if (weekend || h % 4 === 0) addBooking({ venueId: v.id, pitchId: p.id, start: at(d, weekend ? 10 + (h % 3) : 13, 0), minutes: weekend ? 120 : 60, contactName: renter(5), kind: weekend && h % 2 ? 'ACADEMY' : 'RENTAL' });
}
export const bookingView = b => {
  const v = venueById(b.venueId), p = pitchById(b.pitchId);
  return {
    id: b.id, venueId: v.id, venueName: v.name, venueAddress: `${v.district}, ${v.city}`, venuePhone: clubPhone(v.id - 190), timezone: TZ,
    cancellationDeadline: iso(plusMin(b.start, -24 * 60)), pitchId: p.id, pitchName: p.name, startsAt: iso(b.start), endsAt: iso(b.end),
    status: b.status, kind: b.kind, totalPrice: b.totalPrice, currency: 'GEL', contactName: b.contactName, contactPhone: b.contactPhone, note: b.note,
    expiresAt: b.status === 'PENDING' ? iso(plusMin(b.created, 48 * 60)) : null, seriesId: b.seriesId,
    canCancel: ['PENDING', 'CONFIRMED'].includes(b.status) && b.start.getTime() - Date.now() > 24 * 3600000,
  };
};
/** Busy windows on a pitch: bookings plus academy trainings and matches held at the venue. */
export const pitchBlocks = (venueId, pitchId) => {
  const v = venueById(venueId), pitch = pitchById(pitchId), blocks = [];
  for (const b of bookings) if (b.pitchId === pitch.id && ['PENDING', 'CONFIRMED'].includes(b.status)) blocks.push({ start: b.start, end: b.end, status: b.status, kind: b.kind });
  for (const e of W.events) if (e.venueId === v.id && e.type === 'TRAINING' && e.pitch === pitch.name) blocks.push({ start: e.start, end: e.end, status: 'CONFIRMED', kind: 'ACADEMY' });
  for (const m of matches) if (m.venueId === v.id && pitch === v.pitchList[0]) blocks.push({ start: m.start, end: m.end, status: 'CONFIRMED', kind: 'ACADEMY' });
  return blocks;
};

// ---------------------------------------------------------------- referees
const QUAL = ['GFF National List referee', 'GFF Regional referee · Category 1', 'GFF Regional referee · Category 2', 'FIFA Assistant Referee', 'GFF Youth referee'];
export const refereeProfiles = referees.map((p, i) => ({
  user_id: p.id, full_name: p.fullName, published: true,
  biography: [
    `${8 + (i * 3) % 14} seasons refereeing youth and senior football across ${p.city === 'Tbilisi' ? 'Tbilisi and Mtskheta' : `${p.city} and the surrounding region`}. Calm match control and detailed match reports.`,
    `Former academy midfielder who moved into refereeing at nineteen. Enjoys development fixtures and explains decisions to young players after the whistle.`,
    `Regular appointments in the regional youth leagues and the Tbilisi Community League. Arrives early, checks the pitch and talks both coaches through the rules for the day.`,
    `Futsal and small-sided specialist, also available for 11-a-side youth matches. Holds a first-aid certificate and works well with volunteer assistant referees.`,
  ][i % 4],
  qualifications: QUAL[i % QUAL.length], formats: i % 3 === 0 ? '11_A_SIDE, 9_A_SIDE' : i % 3 === 1 ? '11_A_SIDE, 7_A_SIDE, FUTSAL' : '7_A_SIDE, 9_A_SIDE, 5_A_SIDE',
  languages: i % 2 ? 'Georgian, English' : i % 3 ? 'Georgian, Russian' : 'Georgian, English, Russian', service_area: p.city === 'Tbilisi' ? ['Tbilisi', 'Tbilisi and Mtskheta', 'Tbilisi and Rustavi'][i % 3] : p.city,
  travel_km: [25, 40, 60, 80, 120][i % 5], accepts_paid: i % 4 !== 3, accepts_volunteer: i % 2 === 0, fee: [60, 80, 100, 120, 150][i % 5], currency: 'GEL', timezone: TZ, revision: 2,
  career: [{ id: 3000 + i * 2, kind: 'REFEREE', title: QUAL[i % QUAL.length], organization: 'Georgian referee development programme', starts_on: `${2014 + (i % 6)}-03-01`, ends_on: null, description: 'Youth league and cup appointments.' }],
}));
// A referee's profile headline is their qualification, so People, the profile and the referee list agree.
referees.forEach((p, i) => { p.headline = refereeProfiles[i].qualifications; });
const formatsOf = r => r.formats.split(',').map(f => f.trim());
/** Referees who can take a match: they take its format and accept volunteer or paid work. */
export const refereesFitting = format => refereeProfiles.filter(r => formatsOf(r).includes(format) && (r.accepts_paid || r.accepts_volunteer));
// When each referee says they are free (Tbilisi time) for the next four weeks: weekends, weekend afternoons with a
// Wednesday evening, or weekday evenings with a Saturday morning. Referees who take no matches mark nothing.
// Saturday 12:00 (listing 5813) is covered by the first two patterns and not the third.
const WINDOWS = [
  [[6, 9, 20], [0, 9, 20]],
  [[6, 12, 19], [0, 12, 19], [3, 17, 21]],
  [[1, 16, 21], [2, 16, 21], [3, 16, 21], [4, 16, 21], [5, 16, 21], [6, 9, 12]],
];
export const refereeAvailability = new Map(refereeProfiles.map((r, i) => {
  const windows = [];
  if (r.accepts_paid || r.accepts_volunteer) for (let d = 0; d < 28; d++) for (const [dow, from, to] of WINDOWS[i % 3]) {
    if (at(d).getDay() === dow) windows.push({ id: r.user_id * 100 + windows.length, starts_at: at(d, from), ends_at: at(d, to) });
  }
  return [r.user_id, windows];
}));

// ---------------------------------------------------------------- tournaments & competitions
const ORG = {
  801: { id: 801, name: 'Tbilisi Community Football League', logoUrl: photo('org-801'), city: 'Tbilisi' },
  802: { id: 802, name: 'Imereti Youth Football Association', logoUrl: photo('org-802'), city: 'Kutaisi' },
  803: { id: 803, name: 'Black Sea Women’s Football Network', logoUrl: photo('org-803'), city: 'Batumi' },
};
export const organizationById = id => ORG[id] || (clubById(Number(id) - 900) && { id: Number(id), name: clubById(Number(id) - 900).name, logoUrl: clubById(Number(id) - 900).logoUrl, clubId: Number(id) - 900 });
const extraTournaments = [
  { id: 306, name: 'Georgian Youth Cup U16', format: 'KNOCKOUT', ageGroup: 'U16', gender: 'MALE', teamFormat: '11v11', organizerClubId: null, organizerOrgId: 801, start: day(-13), end: day(6), entryDeadline: day(-30), status: 'IN_PROGRESS', teams: [1, 4, 5, 11, 16, 3, 13, 10], city: 'Tbilisi', venueId: 203, fee: 150, description: 'National knockout cup for U16 academy sides. Quarter-finals and semi-finals at home grounds, final at Mikheil Meskhi Stadium.' },
  { id: 307, name: 'Rustavi Community Cup', format: 'GROUPS_KNOCKOUT', ageGroup: 'SENIOR', gender: 'MIXED', teamFormat: '7v7', organizerClubId: 10, start: day(16), end: day(16), entryDeadline: day(10), status: 'REGISTRATION', teams: [10, 6, 15, 9, 8], city: 'Rustavi', venueId: 208, fee: 60, description: 'One-day seven-a-side cup with a family fan zone. Proceeds support the club’s girls’ programme.' },
  { id: 308, name: 'Tbilisi Futsal Ladder', format: 'LADDER', ageGroup: 'SENIOR', gender: 'MIXED', teamFormat: '5v5', organizerClubId: 8, start: day(-40), end: day(80), entryDeadline: day(30), status: 'IN_PROGRESS', teams: [8, 9, 15, 3, 6], city: 'Tbilisi', venueId: 204, fee: 0, description: 'Challenge any team up to three places above you. Weeknight futsal at the Isani hall.' },
  { id: 309, name: 'Mtskheta Grassroots Festival U10', format: 'FESTIVAL', ageGroup: 'U10', gender: 'MIXED', teamFormat: '5v5', organizerClubId: 14, start: day(2), end: day(2), entryDeadline: day(0), status: 'REGISTRATION', teams: [14, 6, 7, 3, 1], city: 'Mtskheta', venueId: 214, fee: 0, description: 'No scores, no tables. Every child plays every game by the river.' },
];
export const tournamentList = [...W.tournaments, ...extraTournaments];
const STATUS = { IN_PROGRESS: 'ACTIVE', REGISTRATION: 'PLANNING', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED' };
const FAMILY = { LEAGUE: 'LEAGUE', KNOCKOUT: 'CUP', GROUPS_KNOCKOUT: 'CUP', FESTIVAL: 'FESTIVAL', LADDER: 'LADDER' };
const STRUCTURE = { LEAGUE: 'ROUND_ROBIN', KNOCKOUT: 'KNOCKOUT', GROUPS_KNOCKOUT: 'GROUPS_KNOCKOUT', FESTIVAL: 'ROTATION', LADDER: 'LADDER' };

export const tournamentState = new Map(); // id -> { entries, stages, fixtures, staff, overrides }
let entrySeq = 6000, fixtureSeq = 7000, stageSeq = 6800;
const entryFor = (t, clubId, status = 'ACTIVE') => {
  const c = clubById(clubId), squad = squadFor(clubId, t.ageGroup, t.gender);
  return { id: ++entrySeq, clubId, clubName: c.name, squadId: squad?.id ?? null, squadName: null, userId: null, displayName: c.name, status, seed: null,
    requestedBy: clubId === DINAMO ? W.ME_ID : null, decidedBy: status === 'PENDING' ? null : W.ME_ID, decidedAt: iso(day(-40)), confirmedAt: status === 'ACTIVE' ? iso(day(-35)) : null, withdrawnAt: null, withdrawalReason: null, draftTeamId: null };
};
const score = () => [fint(0, 4), fint(0, 3)];
function buildTournament(t) {
  const status = STATUS[t.status];
  const extra = t.id === 302 ? [4, 10, 15] : t.id === 304 ? [1, 11, 3, 16] : t.id === 303 ? [1, 5, 14] : [];
  const ids = [...new Set([...t.teams, ...extra])];
  const entries = ids.map((clubId, i) => entryFor(t, clubId, status === 'PLANNING' && i >= ids.length - 2 && t.id !== 309 ? 'PENDING' : status === 'PLANNING' && i >= ids.length - 3 && t.id === 304 ? 'APPROVED' : 'ACTIVE'));
  entries.forEach((e, i) => { e.seed = i + 1; });
  if (t.id === 301) entries.forEach(e => { if (e.clubId === DINAMO) e.squadId = 101; });
  const stages = [], fixtures = [];
  const venue = venueById(t.venueId);
  const fixture = (stage, round, order, home, away, when, played, overrides = {}) => {
    const [hs, as] = played ? score() : [null, null];
    const f = { id: ++fixtureSeq, stageId: stage.id, stageName: stage.name, homeEntryId: home?.id ?? null, homeLabel: home?.clubName ?? null, awayEntryId: away?.id ?? null, awayLabel: away?.clubName ?? null,
      winnerEntryId: null, homeScore: hs, awayScore: as, roundNumber: round, fixtureOrder: order, scheduledAt: when ? local(when) : null, locationId: t.venueId, status: played ? 'COMPLETED' : 'SCHEDULED', linkedMatchId: null, venueReservation: null, ...overrides };
    if (played && home && away) f.winnerEntryId = hs > as ? home.id : as > hs ? away.id : null;
    fixtures.push(f); return f;
  };
  const stage = (name, stageType, order, advanceCount = null) => { const s = { id: ++stageSeq, parentStageId: null, name, stageType, stageOrder: order, status: status === 'COMPLETED' ? 'COMPLETED' : status === 'ACTIVE' ? 'ACTIVE' : 'PLANNING', advanceCount }; stages.push(s); return s; };
  const active = entries.filter(e => e.status === 'ACTIVE');
  if (t.format === 'LEAGUE' || t.format === 'LADDER') {
    const s = stage(t.format === 'LADDER' ? 'Ladder' : 'League table', 'LEAGUE', 1);
    const teams = [...active]; if (teams.length % 2) teams.push(null);
    const rounds = (teams.length - 1) * (t.format === 'LEAGUE' ? 2 : 1);
    const firstOffset = Math.round((t.start.getTime() - W.NOW.getTime()) / 86400000) + 3;
    for (let r = 0; r < rounds; r++) {
      const rot = [teams[0], ...teams.slice(1).slice(-(r % (teams.length - 1))), ...teams.slice(1).slice(0, teams.length - 1 - (r % (teams.length - 1)))];
      for (let i = 0; i < teams.length / 2; i++) {
        let home = rot[i], away = rot[teams.length - 1 - i];
        if (!home || !away) continue;
        if (r >= teams.length - 1 || (r + i) % 2) [home, away] = [away, home];
        const when = at(firstOffset + r * (t.format === 'LADDER' ? 10 : 7), t.format === 'LADDER' ? 20 : 15 + i * 2);
        const f = fixture(s, r + 1, i + 1, home, away, when, when.getTime() < Date.now() - 3 * 3600000);
        // The academy reserves are having a good autumn.
        if (t.id === 301 && f.status === 'COMPLETED' && (home.clubId === DINAMO || away.clubId === DINAMO)) {
          if (home.clubId === DINAMO) f.homeScore = f.awayScore + 1 + (r % 2); else f.awayScore = f.homeScore + (r % 3 === 0 ? 0 : 1);
          f.winnerEntryId = f.homeScore > f.awayScore ? home.id : f.awayScore > f.homeScore ? away.id : null;
        }
      }
    }
  } else if (t.format === 'KNOCKOUT' || t.format === 'GROUPS_KNOCKOUT') {
    let qualifiers = t.id === 306 ? [...active.filter(e => [DINAMO, 13].includes(e.clubId)), ...active.filter(e => ![DINAMO, 13].includes(e.clubId))] : active;
    if (t.format === 'GROUPS_KNOCKOUT') {
      const half = Math.ceil(entries.length / 2);
      [entries.slice(0, half), entries.slice(half)].forEach((group, g) => {
        const s = stage(`Group ${'AB'[g]}`, 'GROUP', 1, 2);
        let n = 0;
        for (let a = 0; a < group.length; a++) for (let b = a + 1; b < group.length; b++) fixture(s, 1, ++n, group[a], group[b], status === 'PLANNING' ? null : at(Math.round((t.start - W.NOW) / 86400000), 10 + n), false);
      });
      qualifiers = [];
    }
    const ko = stage(t.format === 'GROUPS_KNOCKOUT' ? 'Knockout' : 'Cup bracket', 'KNOCKOUT', t.format === 'GROUPS_KNOCKOUT' ? 2 : 1);
    const size = t.format === 'GROUPS_KNOCKOUT' ? 4 : 8;
    const baseOffset = Math.round((t.start.getTime() - W.NOW.getTime()) / 86400000);
    const oneDay = t.start.toDateString() === t.end.toDateString() || t.id === 302;
    const roundTime = (round, order) => oneDay ? at(baseOffset, 10 + (round - 1) * 2, (order - 1) * 35 % 60) : at(t.id === 306 ? [-12, -5, 6][round - 1] : baseOffset + (round - 1) * 7, round === 3 ? 18 : 15, 0);
    let previous = [];
    for (let round = 1, count = size / 2; count >= 1; round++, count /= 2) {
      const current = [];
      for (let i = 0; i < count; i++) {
        const when = status === 'PLANNING' && t.id !== 302 ? null : roundTime(round, i + 1);
        let home = null, away = null;
        if (round === 1) { home = qualifiers[i * 2] ?? null; away = qualifiers[i * 2 + 1] ?? null; }
        else { const a = previous[i * 2], b = previous[i * 2 + 1]; home = entries.find(e => e.id === a?.winnerEntryId) ?? null; away = entries.find(e => e.id === b?.winnerEntryId) ?? null; }
        const played = Boolean(when && home && away && when.getTime() < Date.now());
        const f = fixture(ko, round, i + 1, home, away, when, played, { locationId: round === 3 || oneDay ? t.venueId : home ? clubById(home.clubId).venueId ?? t.venueId : t.venueId });
        if (played && f.homeScore === f.awayScore) { f.homeScore += 1; f.winnerEntryId = home.id; }
        if (t.id === 306 && played && (home.clubId === DINAMO || away.clubId === DINAMO)) { const dinamoHome = home.clubId === DINAMO; f.homeScore = dinamoHome ? 3 : 1; f.awayScore = dinamoHome ? 1 : 2; f.winnerEntryId = (dinamoHome ? home : away).id; }
        current.push(f);
      }
      previous = current;
    }
    if (t.id === 306) for (const f of fixtures) { if (f.status === 'COMPLETED') { const loser = f.winnerEntryId === f.homeEntryId ? f.awayEntryId : f.homeEntryId; const e = entries.find(x => x.id === loser); if (e) e.status = 'ELIMINATED'; } }
  } else if (t.format === 'FESTIVAL') {
    const s = stage('Festival rotation', 'ROUND_ROBIN', 1);
    const baseOffset = Math.round((t.start.getTime() - W.NOW.getTime()) / 86400000);
    let n = 0;
    for (let a = 0; a < active.length; a++) for (let b = a + 1; b < active.length; b++) { n++; fixture(s, Math.ceil(n / 2), n, active[a], active[b], at(baseOffset, 10 + Math.floor(n / 2), (n % 2) * 30), false); }
  }
  // One recent league result is still waiting for the referee's report.
  if (t.id === 301) { const pending = fixtures.filter(f => f.status === 'COMPLETED' && ![f.homeEntryId, f.awayEntryId].includes(entries.find(e => e.clubId === DINAMO)?.id)).at(-1); if (pending) Object.assign(pending, { status: 'SCHEDULED', homeScore: null, awayScore: null, winnerEntryId: null }); }
  if (status === 'COMPLETED') fixtures.forEach(f => { if (f.status !== 'COMPLETED' && f.homeEntryId && f.awayEntryId) { const [h, a] = score(); Object.assign(f, { status: 'COMPLETED', homeScore: h, awayScore: a, winnerEntryId: h > a ? f.homeEntryId : a > h ? f.awayEntryId : null }); } });
  // Dinamo staff run the league they host; Luka coordinates it and the U16 cup.
  const staff = [];
  if ([301, 306].includes(t.id)) staff.push({ id: 6900 + t.id, userId: W.ME_ID, fullName: W.me.fullName, role: 'ADMIN', status: 'ACTIVE', assignedBy: W.ME_ID, createdAt: iso(day(-45)) });
  const refs = referees.slice(t.id % 4, t.id % 4 + 2);
  refs.forEach((r, i) => staff.push({ id: 6950 + t.id * 2 + i, userId: r.id, fullName: r.fullName, role: 'REFEREE', status: 'ACTIVE', assignedBy: W.ME_ID, createdAt: iso(day(-30)) }));
  const st = { entries, stages, fixtures, staff, status, revision: 4, invitations: [] };
  if (status === 'COMPLETED') { const table = standingsFor(st, stages[0]?.id); const champion = table[0]; st.championEntryId = champion?.entryId ?? null; st.championName = champion?.label ?? null; }
  tournamentState.set(t.id, st);
}
export function standingsFor(st, stageId) {
  const rows = new Map();
  const ids = new Set(st.fixtures.filter(f => !stageId || f.stageId === stageId).flatMap(f => [f.homeEntryId, f.awayEntryId]).filter(Boolean));
  for (const e of st.entries.filter(e => ids.has(e.id) || (!stageId && e.status === 'ACTIVE'))) rows.set(e.id, { entryId: e.id, label: e.squadName || e.clubName, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 });
  for (const f of st.fixtures) {
    if (f.status !== 'COMPLETED' || (stageId && f.stageId !== stageId)) continue;
    const h = rows.get(f.homeEntryId), a = rows.get(f.awayEntryId); if (!h || !a) continue;
    h.played++; a.played++; h.goalsFor += f.homeScore; h.goalsAgainst += f.awayScore; a.goalsFor += f.awayScore; a.goalsAgainst += f.homeScore;
    if (f.homeScore > f.awayScore) { h.wins++; a.losses++; h.points += 3; } else if (f.homeScore < f.awayScore) { a.wins++; h.losses++; a.points += 3; } else { h.draws++; a.draws++; h.points++; a.points++; }
  }
  return [...rows.values()].sort((x, y) => y.points - x.points || (y.goalsFor - y.goalsAgainst) - (x.goalsFor - x.goalsAgainst) || y.goalsFor - x.goalsFor || x.label.localeCompare(y.label))
    .map((r, i) => ({ ...r, rank: i + 1, buchholz: 0, seed: i + 1, rating: 1500 + (r.points - r.losses) * 16 }));
}
for (const t of tournamentList) buildTournament(t);
export const tournamentById = id => tournamentList.find(t => t.id === Number(id));

const RULESET = { LEAGUE: 'IFAB Laws of the Game with GFF amateur competition regulations. Rolling substitutions.', LADDER: 'Futsal Laws of the Game. Challenges within three places; results confirmed by both captains.', KNOCKOUT: 'IFAB Laws of the Game. Level after full time: penalties, no extra time.', GROUPS_KNOCKOUT: 'Small-sided rules: rolling substitutions, kick-ins, no offside.', FESTIVAL: 'Grassroots festival rules: no scores recorded, every player plays half of each game.' };
export const competitionRules = t => {
  const side = Number(t.teamFormat.split('v')[0]);
  return {
    family: FAMILY[t.format], structure: STRUCTURE[t.format], discipline: side === 5 && t.venueId === 204 ? 'FUTSAL' : 'ASSOCIATION', sideSize: side, ageGroup: t.ageGroup,
    eligibilityCategory: t.gender === 'FEMALE' ? 'Girls' : t.gender === 'MALE' ? (t.ageGroup === 'SENIOR' ? 'Open' : 'Boys') : 'Open', playingLevel: t.ageGroup === 'U10' ? 'DEVELOPMENT' : t.format === 'FESTIVAL' ? 'RECREATIONAL' : 'COMPETITIVE',
    country: 'Georgia', city: t.city, timezone: TZ, ruleset: RULESET[t.format], jurisdiction: t.ageGroup === 'SENIOR' ? '' : 'Organiser-run youth competition', ageCutoff: t.ageGroup === 'SENIOR' ? null : `${W.NOW.getFullYear() - Number(t.ageGroup.slice(1))}-01-01`,
    matchMinutes: side >= 11 ? (t.ageGroup === 'SENIOR' ? 90 : 80) : side >= 7 ? 40 : 24, restMinutes: side >= 11 ? 30 : 10, pitches: t.venueId === 205 ? 3 : 1, rounds: 3,
    tiebreaks: ['POINTS', 'GOAL_DIFFERENCE', 'GOALS_FOR', 'SEED'], challengeRange: 3, challengeExpiryDays: 7, maxConsecutiveStays: 2, standings: t.format !== 'FESTIVAL',
    entryFee: t.fee, currency: 'GEL', feeBasis: 'TEAM', seasonPolicy: t.format === 'LEAGUE' ? 'Double round-robin, autumn to winter. Points: 3 win, 1 draw.' : 'Single event; results stand once confirmed by the organiser.',
  };
};
export const competitionProfile = t => ({ rules: competitionRules(t), revision: 3, legacy: false });
export const organizerOf = t => t.organizerOrgId ? ORG[t.organizerOrgId] : { id: 900 + t.organizerClubId, name: clubById(t.organizerClubId).name, logoUrl: clubById(t.organizerClubId).logoUrl, clubId: t.organizerClubId };
/** When entries open and close. The girls' cup opens in two days, so "Opens …" has an example. */
export const registrationWindow = t => ({ opens: t.id === 304 ? day(2, 9) : day(-60), closes: t.entryDeadline });
/** As the backend counts places taken: approved and active entries, and those that played on or went out. */
export const placesTaken = st => st.entries.filter(e => ['APPROVED', 'ACTIVE', 'COMPLETED', 'ELIMINATED'].includes(e.status)).length;
// As the backend sends them: times are the venue's wall clock without a zone (Georgian time).
export const tournamentSummary = t => {
  const st = tournamentState.get(t.id), org = organizerOf(t), host = t.organizerClubId ? clubById(t.organizerClubId) : null, window = registrationWindow(t);
  return {
    id: t.id, name: t.name, description: t.description, status: st.status, organizerOrganizationId: org.id, organizerName: org.name, hostClubId: host?.id ?? null, hostClubName: host?.name ?? null,
    participantScope: 'CLUB', visibility: 'PUBLIC', startDate: local(t.start), endDate: local(t.end), registrationOpensAt: local(window.opens), registrationClosesAt: local(window.closes),
    entryCount: placesTaken(st), incentives: t.fee ? 'Trophies and medals for finalists' : 'Medals for every player', bannerImageUrl: photo(`tournament-${t.id}`),
  };
};
export const tournamentDetail = t => {
  const st = tournamentState.get(t.id);
  return { ...tournamentSummary(t), entryCap: t.format === 'LEAGUE' ? 10 : t.format === 'KNOCKOUT' ? 8 : 12, rules: RULESET[t.format], registrationPolicy: t.id === 301 ? 'APPROVAL_ONLY' : 'OPEN', locationId: t.venueId,
    staffAssignments: st.staff, entries: st.entries, stages: st.stages, fixtures: st.fixtures, championEntryId: st.championEntryId ?? null, championName: st.championName ?? null, ...(st.overrides || {}) };
};
/** A `/competitions` card as the backend sends it: no entry window, host or organiser ids, visibility or prizes. */
export const competitionCard = t => {
  const { id, name, description, status, participantScope, organizerName, hostClubName, startDate, endDate, bannerImageUrl, entryCount } = tournamentSummary(t);
  return { id, name, description, status, participantScope, organizerName, hostClubName, startDate, endDate, bannerImageUrl, entryCount, entryCap: tournamentDetail(t).entryCap, profile: competitionProfile(t) };
};

// ---------------------------------------------------------------- match exchange
const LEVELS = ['DEVELOPMENT', 'RECREATIONAL', 'COMPETITIVE', 'ELITE'];
const FORMAT_BY_AGE = ag => ['U8', 'U9', 'U10'].includes(ag) ? '5_A_SIDE' : ['U11', 'U12'].includes(ag) ? '7_A_SIDE' : ['U13', 'U14'].includes(ag) ? '9_A_SIDE' : '11_A_SIDE';
const formatOfSquad = s => s.format === '7v7' ? '7_A_SIDE' : s.format === '9v9' ? '9_A_SIDE' : '11_A_SIDE';
export const exchange = []; // internal listing records
/** Open requests for referees to apply, by listing id (one per listing), shared by creating and arranging matches. */
export const officialRequests = new Map();
let proposalSeq = 8800;
const listing = ({ id = W.newId(), hostSquad, start, minutes = 90, venueId, title, description, level, venuePreference = 'HOME', refereeRequired = true, opponentSquad = null, status = 'OPEN', score = null, proposals = [], booked = false, referee = null, requestedClubId = null, kind = 'FRIENDLY' }) => {
  const host = clubById(hostSquad.clubId), v = venueById(venueId ?? host.venueId ?? 202);
  const rec = { id, hostSquadId: hostSquad.id, start, end: plusMin(start, minutes), venueId: v?.id ?? null, title, description, level, venuePreference, refereeRequired, opponentSquadId: opponentSquad?.id ?? null,
    status, score, proposals, booked, refereeId: referee, requestedClubId, kind, revision: 2, ageGroup: hostSquad.ageGroup === 'SENIOR' ? 'SENIOR' : hostSquad.ageGroup, format: formatOfSquad(hostSquad), created: plusMin(start, -9 * 24 * 60), history: [] };
  rec.history.push({ id: W.newId(), action: 'PUBLISHED', created_at: iso(rec.created), reason: null });
  // A match played at a rented ground holds a real reservation of it (the host's club's own ground needs none).
  if (booked && v && v.id !== host.venueId && v.pitchList?.length) {
    const pitch = v.pitchList.find(p => p.active && p.format === rec.format) ?? v.pitchList.find(p => p.active);
    rec.bookingId = addBooking({ venueId: v.id, pitchId: pitch.id, start, minutes, contactName: host.id === DINAMO ? W.me.fullName : clubCoachName(host.id), userId: host.id === DINAMO ? W.ME_ID : null }).id;
  }
  delete rec.booked;
  // An agreed match at the host's own ground was confirmed by its host (nothing settles a ground by itself).
  if (status === 'ARRANGED' && v && v.id === host.venueId) rec.externalConfirmed = true;
  if (opponentSquad) rec.history.push({ id: W.newId(), action: 'OPPONENT_AGREED', created_at: iso(plusMin(rec.created, 2 * 24 * 60)), reason: null });
  exchange.push(rec); return rec;
};
const proposal = (squad, note, status = 'PENDING') => ({ id: ++proposalSeq, squad_id: squad.id, squad_name: squad.name, club_name: clubById(squad.clubId).name, club_id: squad.clubId, note, status });
// Seeded referees fit their match: they take its format and accept some terms (the shared fixture list picks at random).
for (const m of matches) if (m.refereeId) {
  const fitting = refereesFitting(formatOfSquad(squadById(m.squadId)));
  if (fitting.length && !fitting.some(r => r.user_id === m.refereeId)) m.refereeId = fitting[m.id % fitting.length].user_id;
}
// One league fixture called off (the backend sends CANCELLED; the sandbox had none), never one a request points at.
const calledOff = matches.find(m => m.kind === 'LEAGUE' && m.status === 'SCHEDULED' && ![101, 103, 105].includes(m.squadId) && m.start.toDateString() === at(2).toDateString())
  ?? matches.find(m => m.kind === 'LEAGUE' && m.status === 'SCHEDULED' && ![101, 103, 105].includes(m.squadId) && m.start.getTime() > Date.now());
if (calledOff) calledOff.status = 'CANCELLED';
// (a) Dinamo friendlies from the shared fixture list, as arranged exchange matches.
for (const m of matches.filter(m => m.kind === 'FRIENDLY')) {
  const ours = squadById(m.squadId), theirs = squadFor(m.opponentClubId, ours.ageGroup, ours.gender);
  const host = m.home ? ours : theirs, guest = m.home ? theirs : ours;
  const played = m.status === 'COMPLETED';
  listing({ id: m.id, hostSquad: host, opponentSquad: guest, start: m.start, minutes: 105, venueId: m.venueId, title: `${ours.ageGroup === 'SENIOR' ? 'Senior' : ours.ageGroup} friendly: ${clubById(host.clubId).short} v ${clubById(guest.clubId).short}`,
    description: 'Two halves plus a short third period for rotation. Both squads bring their own match balls and bibs.', level: ours.ageGroup === 'SENIOR' ? 'COMPETITIVE' : 'DEVELOPMENT', venuePreference: m.home ? 'HOME' : 'AWAY',
    status: 'ARRANGED', score: played ? (m.home ? m.score : [m.score[1], m.score[0]]) : null, booked: true, referee: m.refereeId });
}
// (b) Open listings from other clubs looking for opponents.
const openPlan = [
  [112, nextDow(0, 1), 10, 'Riverside U14 want a Sunday morning friendly', 'DEVELOPMENT', 'HOME'], [115, nextDow(3, 2), 19, 'Saburtalo seniors: midweek friendly under the lights', 'COMPETITIVE', 'HOME'],
  [117, 4, 16, 'Locomotive U16 girls seek opponents before the league restart', 'COMPETITIVE', 'EITHER'], [118, 5, 11, 'Gldani Juniors U12 festival-style friendly', 'RECREATIONAL', 'HOME'],
  [129, 7, 13, 'Kutaisi City U14 girls travelling to Tbilisi', 'ELITE', 'AWAY'], [131, 8, 17, 'Batumi Seaside U16 pre-season friendly by the sea', 'COMPETITIVE', 'HOME'],
  [128, nextDow(0, 6), 12, 'Rustavi Community FC need a Sunday game', 'RECREATIONAL', 'EITHER'], [126, nextDow(4, 2), 20, 'Didube Stars need an opponent for Thursday night', 'RECREATIONAL', 'HOME'],
  [132, 9, 12, 'Telavi Valley U10 boys open to travel', 'DEVELOPMENT', 'AWAY'], [123, 10, 15, 'Vake Football School U12 mini-tournament guest', 'DEVELOPMENT', 'HOME'],
  [135, 1, 21, 'Five-a-side challenge at Lisi Lake', 'RECREATIONAL', 'HOME'], [142, 12, 12, 'Zugdidi U16 girls autumn tour, Tbilisi leg', 'COMPETITIVE', 'AWAY'],
  [133, 13, 11, 'Mtskheta Sharks U12 girls riverside friendly', 'RECREATIONAL', 'HOME'], [125, 4, 21, 'Isani futsal U16: friendly on Court A', 'COMPETITIVE', 'HOME'],
  [111, 15, 18, 'Riverside U16 boys looking for strong opposition', 'ELITE', 'EITHER'], [110, nextDow(6, 10), 10, 'Dinamo Tbilisi U12 boys Saturday fixture', 'DEVELOPMENT', 'HOME'],
];
for (const [squadId, offset, hour, title, level, pref] of openPlan) {
  const hostSquad = squadById(squadId), clubId = hostSquad.clubId, ageGroup = hostSquad.ageGroup;
  const rec = listing({ hostSquad, start: at(offset, hour, hour === 18 ? 30 : 0), minutes: ['U10', 'U12'].includes(ageGroup) ? 60 : 90, title, level, venuePreference: pref,
    description: `${clubById(clubId).name} ${hostSquad.name} ${pref === 'AWAY' ? 'will travel to you' : pref === 'EITHER' ? 'can host or travel' : 'host at their home ground'}. Squad of ${hostSquad.playerIds.length || 14}, ${level.toLowerCase()} level. Referee costs shared.`,
    venueId: pref === 'AWAY' ? null : clubById(clubId).venueId ?? 205, booked: pref === 'HOME' && offset % 2 === 0, refereeRequired: offset % 3 !== 0 });
  rec.format = clubId === 8 ? 'FUTSAL' : clubId === 15 ? '5_A_SIDE' : FORMAT_BY_AGE(ageGroup);
  if (pref === 'AWAY') rec.venueId = null;
  if (squadId === 111) rec.proposals.push(proposal(squadById(105), 'We can bring the full U16 squad. Happy to play 3×30 minutes.'));
  if (squadId === 117) rec.proposals.push(proposal(squadById(106), 'Available from 16:00, can host at Digomi if you prefer.'));
  if (squadId === 115) rec.proposals.push(proposal(squadById(101), 'First Team would welcome the game. Floodlit pitch at Digomi also possible.', 'DECLINED'));
}
// (c) Dinamo's own open listings with proposals waiting for Luka.
const u14 = listing({ hostSquad: squadById(103), start: at(nextDow(6, 5), 12), minutes: 80, venueId: 202, title: 'U14 Boys home friendly, Saturday midday', level: 'COMPETITIVE', description: '9v9 on Pitch 2 at Digomi. 2×35 minutes plus a 10-minute shoot-out practice. Referee provided by us.', booked: true });
u14.proposals.push(proposal(squadById(119), 'Gldani would love this game. 13 players available.'), proposal(squadById(122), 'Vake U14 boys are free that Saturday.'), proposal(squadById(130), 'We are in Tbilisi that weekend for our autumn tour.', 'DECLINED'));
const u16g = listing({ hostSquad: squadById(106), start: at(11, 17), minutes: 90, venueId: 202, title: 'U16 Girls looking for a friendly before the Black Sea Cup', level: 'DEVELOPMENT', description: 'Preparation match before the Black Sea Girls Cup. Happy to travel within Tbilisi or host at Digomi.', venuePreference: 'EITHER' });
u16g.proposals.push(proposal(squadById(134), 'Mtskheta U16 girls are free that evening.'), proposal(squadById(142), 'Zugdidi U16 girls will be in Tbilisi that week.'));
listing({ hostSquad: squadById(105), start: at(14, 18, 30), minutes: 90, venueId: 207, title: 'U16 Boys away friendly at Saburtalo', level: 'ELITE', description: 'Agreed with Saburtalo Youth. Kick-off 18:30, arrive by 17:30.', venuePreference: 'AWAY', opponentSquad: squadFor(4, 'U16', 'MALE'), status: 'ARRANGED', referee: refereesFitting('11_A_SIDE')[0].user_id });
// (d) Arranged matches in every state a coach meets: played without a result yet, a referee still needed, a referee
// invited who has not answered, one called off, and one on now by the schedule (it kicked off twenty minutes before the
// sandbox started).
const fittingReferee = format => refereesFitting(format)[0]?.user_id ?? null;
const friendly = (hostSquad, opponentSquad, start, minutes, extra = {}) => listing({ hostSquad, opponentSquad, start, minutes, venueId: 202, level: 'DEVELOPMENT', status: 'ARRANGED', booked: true,
  title: `${hostSquad.ageGroup === 'SENIOR' ? 'Senior' : hostSquad.ageGroup} friendly: ${clubById(hostSquad.clubId).short} v ${clubById(opponentSquad.clubId).short}`, description: 'Friendly arranged through Match exchange.', ...extra });
friendly(squadById(107), squadFor(9, 'U18', 'MALE'), at(-2, 11), 90, { referee: fittingReferee('11_A_SIDE') });
friendly(squadById(101), squadFor(3, 'SENIOR', 'MALE'), at(5, 19), 105, { level: 'COMPETITIVE', referee: null });
const refereeAsked = friendly(squadById(104), squadFor(5, 'U14', 'FEMALE'), at(6, 12), 80, { referee: fittingReferee('9_A_SIDE') });
if (refereeAsked.refereeId) refereeAsked.refereeInvite = { id: W.newId(), status: 'INVITED', duty: 'REFEREE', volunteer: false, fee: 80, currency: 'GEL' };
friendly(squadById(108), squadFor(4, 'U19', 'MALE'), at(3, 18), 90, { venueId: 207, venuePreference: 'AWAY', status: 'CANCELLED', booked: false, referee: null, description: 'Called off: the pitch at Saburtalo is being relaid.' });
friendly(squadById(106), squadFor(3, 'U16', 'FEMALE'), new Date(W.NOW.getTime() - 20 * 60_000), 90, { referee: fittingReferee('11_A_SIDE') });
export const listingById = id => exchange.find(l => l.id === Number(id));
export const bookingById = id => bookings.find(b => b.id === Number(id));
/** When a reservation the venue has not answered lapses (the backend expires it lazily; its stored status stays PENDING). */
const expiresAt = b => plusMin(b.created, 48 * 60);
/** A reservation's status as the backend shows it: a lapsed request reads EXPIRED. */
export const effectiveStatus = b => b.status === 'PENDING' && expiresAt(b).getTime() <= Date.now() ? 'EXPIRED' : b.status;
/**
 * The ground's state as the backend's CASE gives it: a held reservation that no longer fits the match needs attention, a
 * confirmed one covering it is booked, a request still open is pending; else the host's confirmation, else needed.
 */
const venueStatusOf = l => {
  const b = l.bookingId ? bookingById(l.bookingId) : null;
  if (b && ['PENDING', 'CONFIRMED'].includes(b.status)) {
    if (b.venueId !== l.venueId || b.start > l.start || b.end < l.end) return 'NEEDS_ATTENTION';
    if (b.status === 'CONFIRMED') return 'BOOKED';
    if (effectiveStatus(b) === 'PENDING') return 'PENDING';
  }
  return l.externalConfirmed ? 'HOST_CONFIRMED' : 'NEEDED';
};
// An invited referee has not answered yet (`refereeInvite`); one chosen from applications or seeded has accepted.
const refereeStatusOf = l => !l.refereeRequired ? 'NOT_REQUIRED' : l.refereeId ? (l.refereeInvite?.status ?? 'ACCEPTED') : 'NEEDED';
export { refereeStatusOf };
export const involvesDinamo = l => squadById(l.hostSquadId).clubId === DINAMO || l.requestedClubId === DINAMO || (l.opponentSquadId && squadById(l.opponentSquadId).clubId === DINAMO) || l.proposals.some(p => p.club_id === DINAMO);
export const listingView = (l, { detail = false } = {}) => {
  const host = squadById(l.hostSquadId), club = clubById(host.clubId), v = l.venueId ? venueById(l.venueId) : null, opp = l.opponentSquadId ? squadById(l.opponentSquadId) : null;
  const past = l.end.getTime() < Date.now(), mineHost = club.id === DINAMO, mineGuest = opp?.clubId === DINAMO;
  const eventStatus = l.status === 'CANCELLED' ? 'CANCELLED' : past && opp ? 'COMPLETED' : 'SCHEDULED';
  const listingStatus = l.status === 'OPEN' && past ? 'EXPIRED' : l.status;
  const head = mineHost ? personById(host.headCoachId) : null;
  const resultStatus = l.score ? l.resultStatus ?? 'CONFIRMED' : null, scored = resultStatus === 'CONFIRMED';
  const out = {
    requested_club_id: l.requestedClubId, requested_squad_id: l.requestedSquadId ?? null, external_referee_name: l.externalRefereeName ?? null, referee_responsibility: l.refereeResponsibility ?? 'HOST', hosting_choice: l.hostingChoice ?? l.venuePreference,
    can_respond: !mineHost && listingStatus === 'OPEN' && l.requestedClubId === DINAMO, can_arrange_official: (l.refereeResponsibility ?? 'HOST') === 'OPPONENT' ? mineGuest : mineHost,
    home_score: scored ? l.score[0] : null, away_score: scored ? l.score[1] : null, result_status: resultStatus, result_legacy: false,
    event_id: l.id, squad_id: host.id, squad_name: host.name, club_id: club.id, club_name: club.name, club_profile_kind: CATEGORY_LABEL[clubCategory(club)], club_logo_url: club.logoUrl, club_banner_url: club.bannerUrl,
    title: l.title, description: l.description, starts_at: local(l.start), ends_at: local(l.end), starts_at_iso: iso(l.start), ends_at_iso: iso(l.end), timezone: TZ,
    city: v?.city ?? l.place?.city ?? club.city, location_name: v ? v.name : l.place ? l.place.name : null,
    location_lat: v?.lat ?? l.place?.lat ?? (l.venuePreference === 'AWAY' ? null : club.lat), location_lng: v?.lng ?? l.place?.lng ?? (l.venuePreference === 'AWAY' ? null : club.lng),
    age_group: l.ageGroup, level: l.level, format: l.format, venue_preference: l.venuePreference, referee_required: l.refereeRequired, venue_id: v?.id ?? null, booking_id: l.bookingId ?? null,
    external_venue_confirmed: Boolean(l.externalConfirmed), revision: l.revision, listing_status: listingStatus, event_status: eventStatus, venue_status: venueStatusOf(l), referee_status: refereeStatusOf(l),
    opponent_name: opp ? clubById(opp.clubId).name : null, opponent_club_id: opp?.clubId ?? null, opponent_squad_name: opp?.name ?? null, target_squad_id: opp?.id ?? null,
    head_coach_id: head?.id ?? null, coach_name: head ? head.fullName : clubCoachName(club.id), can_manage: mineHost, can_arrange: mineHost || mineGuest, can_record_result: (mineHost || mineGuest) && past && !l.score,
  };
  if (detail) {
    out.proposals = mineHost ? l.proposals : l.proposals.filter(p => p.club_id === DINAMO);
    out.history = l.history;
    const ref = l.refereeId ? personById(l.refereeId) : null;
    out.appointments = [...(ref ? [appointmentView(l, ref)] : []), ...(l.assistants ?? []).map(official => appointmentView(l, personById(official.refereeId), official))];
    out.own_appointments = [];
    const b = l.bookingId ? bookingById(l.bookingId) : null;
    if (b) out.booking = { id: b.id, venue_id: b.venueId, pitch_id: b.pitchId, status: effectiveStatus(b), stored_status: b.status, starts_at: iso(b.start), ends_at: iso(b.end),
      expires_at: b.status === 'PENDING' ? iso(expiresAt(b)) : null };
  }
  return out;
};
/** The referee duty's appointment id: its invitation's, or a stable one for a referee seeded as accepted. */
export const refereeAppointmentId = l => l.refereeInvite?.id ?? 9000 + l.id % 1000;
/** One official on a listing: the referee duty (`refereeInvite`, or seeded as accepted) or an assistant (`official`). */
export const appointmentView = (l, ref, official = l.refereeInvite) => {
  const host = squadById(l.hostSquadId), club = clubById(host.clubId), v = l.venueId ? venueById(l.venueId) : null, opp = l.opponentSquadId ? squadById(l.opponentSquadId) : null;
  const profile = refereeProfiles.find(r => r.user_id === ref.id);
  const invite = official, volunteer = invite ? invite.volunteer : !profile?.accepts_paid;
  return { id: official?.id ?? refereeAppointmentId(l), event_id: l.id, referee_id: ref.id, full_name: ref.fullName, duty: invite?.duty ?? 'REFEREE', status: invite?.status ?? 'ACCEPTED', volunteer,
    fee: invite ? invite.fee : volunteer ? null : profile?.fee ?? null, currency: invite?.currency ?? 'GEL', report: null, report_submitted_at: null,
    title: l.title, starts_at: local(l.start), ends_at: local(l.end), timezone: TZ, event_status: 'SCHEDULED', starts_at_iso: iso(l.start), ends_at_iso: iso(l.end), club_name: club.name, opponent_name: opp ? clubById(opp.clubId).name : null, location_name: v?.name ?? '', invited_by_name: W.me.fullName, venue_status: 'BOOKED', allowed_actions: [], inbox_section: 'CURRENT' };
};

// ---------------------------------------------------------------- club calendar & personal schedule
const ACTIVITIES = [
  [0, 9, 30, 120, 'TRAINING', 'Goalkeeper clinic (all age groups)', 'Open goalkeeping session led by the academy goalkeeper coach. Bring gloves.', 202, 'Pitch 3 (small-sided)'],
  [0, 17, 30, 90, 'ACTIVITY', 'Parents’ information evening: U12 and U14', 'Season plan, travel to the Kutaisi festival and the new attendance replies in the app.', 202, 'Indoor hall'],
  [2, 10, 0, 60, 'ACTIVITY', 'Coaching staff meeting: autumn development review', 'Squad-by-squad review of player development plans and minutes played.', 202, 'Indoor hall'],
  [4, 15, 0, 120, 'ACTIVITY', 'Medical screening: U16 Boys and U16 Girls', 'Annual screening with the physiotherapy team. Bring the signed consent form.', 202, 'Indoor hall'],
  [7, 9, 30, 120, 'TRAINING', 'Goalkeeper clinic (all age groups)', 'Open goalkeeping session led by the academy goalkeeper coach. Bring gloves.', 202, 'Pitch 3 (small-sided)'],
  [9, 9, 0, 420, 'ACTIVITY', 'Autumn Cup U12 at Vake Park', 'U12 Mixed take part in Riverside Academy’s one-day cup. Meet at 08:15.', 205, null],
  [11, 16, 0, 120, 'TRYOUT', 'U14 Girls open trial', 'Trial for the U14 girls’ squad. Players born 2012–2013.', 202, 'Pitch 2'],
  [14, 9, 30, 120, 'TRAINING', 'Goalkeeper clinic (all age groups)', 'Open goalkeeping session led by the academy goalkeeper coach. Bring gloves.', 202, 'Pitch 3 (small-sided)'],
  [-1, 18, 0, 90, 'ACTIVITY', 'Kit distribution: new season training wear', 'Collect training kit by squad. Sizes confirmed by team managers.', 202, 'Indoor hall'],
  [-5, 10, 0, 60, 'ACTIVITY', 'Coaching staff meeting', 'Weekly staff meeting.', 202, 'Indoor hall'],
  [-7, 9, 30, 120, 'TRAINING', 'Goalkeeper clinic (all age groups)', 'Open goalkeeping session led by the academy goalkeeper coach.', 202, 'Pitch 3 (small-sided)'],
  [9, 10, 0, 60, 'ACTIVITY', 'Coaching staff meeting', 'Weekly staff meeting.', 202, 'Indoor hall'],
  [16, 10, 0, 60, 'ACTIVITY', 'Coaching staff meeting', 'Weekly staff meeting.', 202, 'Indoor hall'],
  [19, 18, 0, 90, 'ACTIVITY', 'Club open evening for new families', 'Tour of the academy, meet the coaches, Q&A on admissions.', 202, 'Indoor hall'],
];
/** Club calendar events anyone may see (the rest stay inside the club): trials, the goalkeeper clinic and the open evening. */
export const isPublicActivity = a => a.type === 'TRYOUT' || /Goalkeeper clinic|Club open evening/i.test(a.title);
export const clubActivities = ACTIVITIES.map(([offset, h, m, minutes, type, title, description, venueId, pitch]) => ({ id: W.newId(), type, title, description, start: at(offset, h, m), end: plusMin(at(offset, h, m), minutes), venueId, pitch, clubId: DINAMO, squadId: null, status: 'SCHEDULED' }));
export const personalEvents = [
  [1, 10, 0, 120, 'ACTIVITY', 'UEFA A licence: continuing education workshop', 'GFF coach education centre, Module 4: periodisation in youth football.', 'GFF Coach Education Centre, Saburtalo', 41.7286, 44.7466],
  [3, 15, 0, 60, 'ACTIVITY', 'One-to-one with the academy director', 'Quarterly review of the coaching department.', 'Dinamo Academy Training Centre', 41.7631, 44.7712],
  [6, 14, 30, 120, 'ACTIVITY', 'Scouting: Saburtalo Youth U16 v Locomotive', 'Watch Saburtalo’s number 9 and both full-backs.', 'Saburtalo Training Ground', 41.7357, 44.7356],
  [-2, 19, 0, 60, 'ACTIVITY', 'Analysis session with the performance analyst', 'U16 Boys: pressing triggers from the last two matches.', 'Dinamo Academy Training Centre', 41.7631, 44.7712],
  [10, 11, 0, 90, 'ACTIVITY', 'Guest session at Vake Football School', 'Coach-the-coach session for the after-school programme.', 'Vake Park Pitches', 41.7099, 44.7469],
  [-9, 12, 0, 90, 'ACTIVITY', 'Lunch with Kutaisi City Academy coaches', 'Festival logistics and a possible U14 exchange.', 'Vake, Tbilisi', 41.7090, 44.7570],
].map(([offset, h, m, minutes, type, title, description, locationName, lat, lng]) => ({ id: W.newId(), type, title, description, start: at(offset, h, m), end: plusMin(at(offset, h, m), minutes), locationName, lat, lng, userId: W.ME_ID, status: 'SCHEDULED' }));
export const attendanceReplies = new Map(); // eventId -> response

// ---------------------------------------------------------------- journeys (travel plans)
export const plans = [];
let planSeq = 700;
const loc = (name, address, lat, lng) => ({ name, address, latitude: lat, longitude: lng, photoUrl: photo(`place-${hash(name) % 1000}`) });
const academy = loc('Dinamo Academy Training Centre', 'Digomi, Tbilisi', 41.7631, 44.7712);
const venueLoc = v => loc(v.name, `${v.district}, ${v.city}`, v.lat, v.lng);
function makePlan({ squadId, title, start, end, destination, activities, arrangements, budgetMinor, familyMessage, published = true }) {
  const squad = squadById(squadId);
  const places = [
    { key: 'plan:meeting', name: academy.name, address: academy.address, latitude: academy.latitude, longitude: academy.longitude, type: 'CLUB', entityId: DINAMO, notes: 'Gate 2, by the car park', photoUrl: academy.photoUrl },
    { key: 'plan:destination', name: destination.name, address: destination.address, latitude: destination.latitude, longitude: destination.longitude, type: 'STADIUM', entityId: null, notes: '', photoUrl: destination.photoUrl },
    { key: 'plan:collection', name: academy.name, address: academy.address, latitude: academy.latitude, longitude: academy.longitude, type: 'CLUB', entityId: DINAMO, notes: 'Parents collect at Gate 2', photoUrl: academy.photoUrl },
    ...activities.filter(a => a.place).map((a, i) => ({ key: `place:${i}`, name: a.place.name, address: a.place.address, latitude: a.place.latitude, longitude: a.place.longitude, type: a.kind === 'MATCH' ? 'STADIUM' : 'MANUAL', entityId: null, notes: '', photoUrl: a.place.photoUrl })),
  ];
  const draft = {
    title, timezone: TZ, currency: 'GEL', budgetMinor, startsAt: iso(start), endsAt: iso(end), destination: destination.name, meetingPoint: `${academy.name}, Gate 2`, collectionPoint: `${academy.name}, Gate 2`,
    supervisionContact: `${W.me.fullName} · +995 599 12 34 56`, familyMessage, privateNotes: 'Two staff plus the team manager travel with the squad.', participants: squad.playerIds.slice(0, 16),
    places, activities: activities.map((a, i) => ({ key: `activity:${i}`, title: a.title, kind: a.kind, startsAt: iso(a.start), endsAt: iso(a.end), placeKey: a.place ? `place:${activities.filter(x => x.place).indexOf(a)}` : null, eventId: a.eventId ?? null, sessionId: null, notes: '' })),
    arrangements: arrangements.map((a, i) => ({ key: `arr:${i}`, kind: a.kind, title: a.title, placeKey: null, amountMinor: a.amountMinor, notes: '', financeRecordId: null })),
  };
  const p = { id: ++planSeq, club_id: DINAMO, squad_id: squadId, title, revision: 5, published_version: published ? 2 : 0, published_revision: published ? 5 : null, updated_at: iso(day(-2)), starts_at: iso(start), created_by: W.ME_ID, draft, suppliers: {}, totalMinor: arrangements.reduce((n, a) => n + a.amountMinor, 0), budgetApproved: published, approvedBy: published ? W.ME_ID : null,
    rights: { edit: true, travel: true, finance: true, publish: true, leadership: true }, issues: [], history: [{ id: W.newId(), revision: 5, action: 'PUBLISHED', note: 'Shared with families', created_at: iso(day(-2)), actor: W.me.fullName }], familyResponses: [], journeyResponses: [], playerResponses: [] };
  plans.push(p); return p;
}
{
  const u16 = squadById(105), next = matches.filter(m => m.squadId === 105 && m.status === 'SCHEDULED').sort((a, b) => a.start - b.start);
  const away = next.find(m => !m.home) || next[0];
  const v = venueById(away.venueId) || venueById(202);
  makePlan({ squadId: 105, title: `U16 Boys away day: ${clubById(away.opponentClubId).name}`, start: plusMin(away.start, -150), end: plusMin(away.end, 120), destination: venueLoc(v),
    activities: [
      { title: 'Team bus departs', kind: 'TRAVEL', start: plusMin(away.start, -150), end: plusMin(away.start, -90), place: academy },
      { title: 'Pre-match meal', kind: 'MEAL', start: plusMin(away.start, -90), end: plusMin(away.start, -60), place: loc('Café Sabuko', `${v.district}, ${v.city}`, v.lat + 0.003, v.lng - 0.004) },
      { title: `${clubById(away.opponentClubId).name} v FC Dinamo Tbilisi Academy`, kind: 'MATCH', start: away.start, end: away.end, place: venueLoc(v), eventId: away.id },
      { title: 'Return journey', kind: 'TRAVEL', start: away.end, end: plusMin(away.end, 120), place: null },
    ], arrangements: [{ kind: 'TRANSPORT', title: 'Minibus hire (20 seats)', amountMinor: 45000 }, { kind: 'MEALS', title: 'Pre-match meal for 20', amountMinor: 30000 }], budgetMinor: 90000,
    familyMessage: 'Bring the match-day kit and a packed snack. Phones away on the bus until after the warm-up.' });
  const cup = W.tournaments.find(t => t.id === 302);
  makePlan({ squadId: 102, title: 'U12 Mixed: Autumn Cup at Vake Park', start: at(9, 8, 15), end: at(9, 16, 30), destination: venueLoc(venueById(205)),
    activities: [
      { title: 'Meet at the academy', kind: 'TRAVEL', start: at(9, 8, 15), end: at(9, 8, 45), place: academy },
      { title: 'Autumn Cup U12: group games', kind: 'MATCH', start: at(9, 10), end: at(9, 12, 30), place: venueLoc(venueById(205)) },
      { title: 'Lunch in Vake Park', kind: 'MEAL', start: at(9, 12, 30), end: at(9, 13, 15), place: loc('Vake Park picnic area', 'Vake, Tbilisi', 41.7111, 44.7452) },
      { title: 'Autumn Cup U12: knockout rounds', kind: 'MATCH', start: at(9, 13, 30), end: at(9, 16), place: venueLoc(venueById(205)) },
    ], arrangements: [{ kind: 'TRANSPORT', title: 'Parent car-share rota', amountMinor: 0 }, { kind: 'OTHER', title: `Entry fee (${cup.fee} GEL)`, amountMinor: cup.fee * 100 }], budgetMinor: 20000,
    familyMessage: 'A full day of football. Sun cream, water bottle and two shirts, please.' });
  const kutaisi = venueById(209);
  makePlan({ squadId: 103, title: 'U14 Boys: Kutaisi Youth Festival trip', start: at(23, 7), end: at(25, 20), destination: venueLoc(kutaisi), published: false,
    activities: [
      { title: 'Bus to Kutaisi', kind: 'TRAVEL', start: at(23, 7), end: at(23, 11), place: academy },
      { title: 'Check in: Hotel Rioni', kind: 'STAY', start: at(23, 12), end: at(23, 13), place: loc('Hotel Rioni', 'Centre, Kutaisi', 42.2701, 42.7010) },
      { title: 'Festival day 1', kind: 'MATCH', start: at(23, 15), end: at(23, 19), place: venueLoc(kutaisi) },
      { title: 'Coaching clinic and festival day 2', kind: 'MATCH', start: at(24, 10), end: at(24, 18), place: venueLoc(kutaisi) },
      { title: 'Visit to Bagrati Cathedral', kind: 'ACTIVITY', start: at(25, 10), end: at(25, 12), place: loc('Bagrati Cathedral', 'Ukimerioni Hill, Kutaisi', 42.2771, 42.7044) },
      { title: 'Bus home', kind: 'TRAVEL', start: at(25, 15), end: at(25, 20), place: null },
    ], arrangements: [{ kind: 'TRANSPORT', title: 'Coach hire, three days', amountMinor: 210000 }, { kind: 'ACCOMMODATION', title: 'Hotel Rioni, 2 nights × 18', amountMinor: 324000 }, { kind: 'MEALS', title: 'Half board', amountMinor: 162000 }],
    budgetMinor: 750000, familyMessage: 'Draft itinerary. Final costs and the consent form follow next week.' });
}
export const planById = id => plans.find(p => p.id === Number(id));
export const planReplies = new Map(); // `${planId}:${subjectId}` -> response

// ---------------------------------------------------------------- tryouts
const extraTrials = [
  { id: 506, clubId: 4, squadName: 'U16 Boys', ageGroup: 'U16', date: day(8, 17), venueId: 207, spots: 18, taken: 11, description: 'Goalkeepers and centre-backs especially welcome. Bring boots for natural grass.' , position: 'Goalkeeper, centre-back' },
  { id: 507, clubId: 10, squadName: 'Women’s team', ageGroup: 'SENIOR', date: day(5, 18), venueId: 208, spots: 25, taken: 8, description: 'Open session for the new women’s team. All levels.', position: null },
  { id: 508, clubId: 12, squadName: 'U19 development squad', ageGroup: 'U19', date: day(19, 11), venueId: 210, spots: 22, taken: 20, description: 'Invitation-plus-open trial for the U19 development squad.', position: 'All positions' },
  { id: 509, clubId: 8, squadName: 'Futsal U16', ageGroup: 'U16', date: day(4, 19), venueId: 204, spots: 14, taken: 6, description: 'Futsal trial evening. Indoor shoes only.', position: null },
  { id: 510, clubId: 13, squadName: 'U16 Mixed', ageGroup: 'U16', date: day(-4, 16), venueId: 212, spots: 20, taken: 20, description: 'Autumn intake trial.', position: null, status: 'FILLED' },
  { id: 511, clubId: 5, squadName: 'U14 Boys', ageGroup: 'U14', date: day(13, 16, 30), venueId: 203, spots: 16, taken: 3, description: 'Second-year U14s for the league squad.', position: 'Wingers, strikers' },
];
export const trialList = [...W.trials, ...extraTrials];
export const tryoutView = t => {
  const c = clubById(t.clubId), v = venueById(t.venueId), status = t.status || (t.date.getTime() < Date.now() ? 'EXPIRED' : t.taken >= t.spots ? 'FILLED' : 'OPEN');
  return { id: t.id, title: `${t.squadName} open trial`, description: `${t.description} ${t.spots - t.taken > 0 ? `${t.spots - t.taken} places left.` : ''}`.trim(), position: t.position ?? null, ageGroup: t.ageGroup,
    gender: /Girls|Women/.test(t.squadName) ? 'FEMALE' : /Boys/.test(t.squadName) ? 'MALE' : null, tryoutDate: iso(t.date), deadline: iso(day(Math.round((t.date - W.NOW) / 86400000) - 2, 23, 59)),
    clubId: c.id, clubName: c.name, location: v ? `${v.name}, ${v.city}` : c.city, status, destination: `/tryouts/${t.id}` };
};
export const tryoutApplications = new Map(); // tryoutId -> receipt

// ---------------------------------------------------------------- admissions groups
const SCHEDULES = ['Mon, Wed, Fri 18:00–19:30', 'Tue, Thu 17:00–18:15', 'Tue, Thu 16:00–17:00 and Sat 10:00', 'Mon, Wed 19:00–20:30', 'Sat, Sun 10:00–11:30', 'Mon, Thu 17:30–19:00'];
const AVAIL = ['PLACES_AVAILABLE', 'APPLICATIONS_OPEN', 'INTRODUCTION_AVAILABLE', 'UPCOMING_ASSESSMENT', 'WAITLIST', 'PLACES_AVAILABLE'];
const METHOD = { PLACES_AVAILABLE: 'DIRECT', APPLICATIONS_OPEN: 'SELECTIVE', INTRODUCTION_AVAILABLE: 'INTRODUCTION', UPCOMING_ASSESSMENT: 'SELECTIVE', WAITLIST: 'DIRECT', CLOSED: 'DIRECT' };
const groupPlan = [
  [1, 'Beginners (born 2017–2019)', 2017, 2019, 'ANY', 'BEGINNER', 'INTRODUCTION_AVAILABLE', 120], [1, 'U12 development group', 2014, 2015, 'ANY', 'INTERMEDIATE', 'UPCOMING_ASSESSMENT', 150],
  [1, 'U14 Girls', 2012, 2013, 'FEMALE', 'INTERMEDIATE', 'APPLICATIONS_OPEN', 150], [3, 'Little Riverside (age 5–7)', 2019, 2021, 'ANY', 'BEGINNER', 'PLACES_AVAILABLE', 90],
  [3, 'U10 Mixed', 2016, 2017, 'ANY', 'BEGINNER', 'PLACES_AVAILABLE', 100], [3, 'U12 Mixed', 2014, 2015, 'ANY', 'INTERMEDIATE', 'WAITLIST', 110],
  [4, 'U10 Boys', 2016, 2017, 'MALE', 'BEGINNER', 'PLACES_AVAILABLE', 110], [4, 'U16 Boys', 2010, 2011, 'MALE', 'ADVANCED', 'APPLICATIONS_OPEN', 140],
  [5, 'U14 Boys', 2012, 2013, 'MALE', 'ADVANCED', 'UPCOMING_ASSESSMENT', 130], [6, 'Kids club (age 6–9)', 2017, 2020, 'ANY', 'BEGINNER', 'PLACES_AVAILABLE', 60],
  [6, 'U12 Mixed', 2014, 2015, 'ANY', 'BEGINNER', 'PLACES_AVAILABLE', 60], [7, 'After-school football (age 5–8)', 2018, 2021, 'ANY', 'BEGINNER', 'PLACES_AVAILABLE', 95],
  [7, 'After-school football (age 9–12)', 2014, 2017, 'ANY', 'BEGINNER', 'INTRODUCTION_AVAILABLE', 95], [8, 'Futsal U16', 2010, 2011, 'ANY', 'INTERMEDIATE', 'PLACES_AVAILABLE', 70],
  [8, 'Adult futsal (evenings)', 1980, 2008, 'ANY', 'INTERMEDIATE', 'PLACES_AVAILABLE', 50], [9, 'Senior squad', 1985, 2007, 'MALE', 'ADVANCED', 'APPLICATIONS_OPEN', 40],
  [10, 'Girls U12', 2014, 2015, 'FEMALE', 'BEGINNER', 'PLACES_AVAILABLE', 50], [10, 'Women’s team', 1985, 2008, 'FEMALE', 'INTERMEDIATE', 'PLACES_AVAILABLE', 30],
  [14, 'U8 Sharks', 2018, 2019, 'ANY', 'BEGINNER', 'PLACES_AVAILABLE', 60], [15, 'Weekend five-a-side league', 1975, 2008, 'ANY', 'RECREATIONAL', 'PLACES_AVAILABLE', 25],
  [13, 'U16 Mixed', 2010, 2011, 'ANY', 'INTERMEDIATE', 'INTRODUCTION_AVAILABLE', 60], [11, 'U12 Boys', 2014, 2015, 'MALE', 'INTERMEDIATE', 'UPCOMING_ASSESSMENT', 100],
  [12, 'U17 Academy', 2009, 2010, 'MALE', 'ADVANCED', 'WAITLIST', 160], [16, 'U13 Boys', 2013, 2014, 'MALE', 'INTERMEDIATE', 'APPLICATIONS_OPEN', 80],
];
export const admissionGroups = groupPlan.map(([clubId, name, from, to, gender, level, availability, fee], i) => {
  const c = clubById(clubId), v = venueById(c.venueId) || null, capacity = [16, 18, 20, 24][i % 4];
  return {
    id: 1301 + i, version: 2, organizationId: 900 + clubId, organizationName: c.name, clubId, name, squadId: squadsOf(clubId).find(s => s.ageGroup === `U${W.NOW.getFullYear() - from}`)?.id ?? null, intake: '2026-27', method: METHOD[availability],
    visibility: 'PUBLIC', published: true, intakeOpen: availability !== 'CLOSED', capacity, beginnerWelcome: level === 'BEGINNER' || level === 'RECREATIONAL', birthYearFrom: from, birthYearTo: to, referenceDate: `${W.NOW.getFullYear()}-09-01`, gender,
    location: { name: v ? v.name : `${c.name} ground`, address: v ? `${v.district}, ${v.city}` : `${c.city}, Georgia`, latitude: v ? v.lat : c.lat, longitude: v ? v.lng : c.lng },
    schedule: SCHEDULES[(clubId + i) % SCHEDULES.length], timezone: TZ,
    terms: { feesKnown: true, charges: [{ label: 'Training fee', amount: fee, currency: 'GEL', frequency: 'monthly' }, ...(i % 3 === 0 ? [{ label: 'Kit pack', amount: 120, currency: 'GEL', frequency: 'one-off' }] : [])],
      cancellation: 'One month’s notice to the club office. No refund for the current month.', participation: 'Attend agreed sessions with a registered emergency contact.', startDate: isoDate(day(2)), endDate: null, affiliationEffect: level === 'ADVANCED' ? 'PRIMARY_CHANGE' : 'NONE', requirements: level === 'ADVANCED' ? ['EMERGENCY_CONTACT', 'CURRENT_CLUB_PERMISSION'] : ['EMERGENCY_CONTACT'] },
    responsibleUserId: clubId === DINAMO ? W.ME_ID : null, waitlistEnabled: true, availability, remainingPlaces: availability === 'WAITLIST' ? 0 : 2 + (i * 5) % 9, destination: `/admissions/opportunities/${1301 + i}`, canManage: clubId === DINAMO,
    extraApprovalRequired: false, decisionUserId: null, city: c.city, country: 'GE', level, positions: [],
    verified: c.verified,
  };
});
export const groupById = id => admissionGroups.find(g => g.id === Number(id));

// ---------------------------------------------------------------- jobs & roles
const CATEGORY_BY_TITLE = t => /coach|Coach/.test(t) ? 'COACHING' : /analyst/i.test(t) ? 'FOOTBALL_OPERATIONS' : /psycholog|physio|medical|doctor/i.test(t) ? 'MEDICAL' : /volunteer|Matchday/i.test(t) ? 'MATCHDAY' : /Kit|equipment|groundsman/i.test(t) ? 'FACILITIES' : /media|photograph|social/i.test(t) ? 'MEDIA_COMMUNICATIONS' : 'ADMINISTRATION';
const extraRoles = [
  { id: 408, clubId: 12, title: 'Head of youth recruitment', kind: 'JOB', employment: 'FULL_TIME', city: 'Batumi', posted: day(-5), deadline: day(25), description: 'Build the scouting network for the U14–U19 pathway across Adjara and Guria.', requirements: ['Scouting experience', 'Driving licence'] },
  { id: 409, clubId: 1, title: 'Social media and match-day photographer', kind: 'JOB', employment: 'PART_TIME', city: 'Tbilisi', posted: day(-1), deadline: day(20), description: 'Weekend coverage of academy fixtures and weekly posts for families and supporters.', requirements: ['Portfolio', 'Child safeguarding training'] },
  { id: 410, clubId: 7, title: 'After-school coach (ages 5–8)', kind: 'JOB', employment: 'PART_TIME', city: 'Tbilisi', posted: day(-7), deadline: day(12), description: 'Fun, game-based sessions four afternoons a week.', requirements: ['UEFA C or Grassroots certificate'] },
  { id: 411, clubId: 14, title: 'Groundskeeping volunteer', kind: 'VOLUNTEER', employment: 'VOLUNTEER', city: 'Mtskheta', posted: day(-9), deadline: day(30), description: 'Line marking and goal checks before Saturday games.', requirements: [] },
  { id: 412, clubId: 11, title: 'Team doctor (match days)', kind: 'SERVICE', employment: 'CONTRACT', city: 'Kutaisi', posted: day(-3), deadline: day(28), description: 'Medical cover for home matches and the Kutaisi Youth Festival.', requirements: ['Licensed physician', 'Sports medicine experience'] },
  { id: 413, clubId: 9, title: 'Assistant manager', kind: 'VOLUNTEER', employment: 'VOLUNTEER', city: 'Tbilisi', posted: day(-2), deadline: day(15), description: 'Help run the Thursday night senior side: line-ups, kit and league admin.', requirements: [] },
];
export const roleList = [...W.roles, ...extraRoles];
/** Who posted a role: the first coach or staff member listed at its club (the hiring person on the role). */
const posterOf = clubId => W.people.find(p => p.clubId === clubId && (p.role === 'COACH' || p.role === 'STAFF'))?.id ?? null;
export const jobView = r => {
  const c = clubById(r.clubId);
  return { version: 1, id: r.id, clubId: c.id, title: r.title, description: `${r.description}${r.requirements?.length ? `\n\nWhat you need: ${r.requirements.join('; ')}.` : ''}\n\nApply by ${r.deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.`,
    ageGroup: /U1\d|U\d|ages/i.test(r.title) ? (r.title.match(/U\d+/)?.[0] ?? null) : null, level: r.employment === 'FULL_TIME' ? 'PROFESSIONAL' : null, requiredRole: CATEGORY_BY_TITLE(r.title) === 'COACHING' ? 'COACH' : null,
    status: 'OPEN', createdAt: iso(r.posted), createdBy: posterOf(c.id), applicationCount: 2 + r.id % 9, category: CATEGORY_BY_TITLE(r.title), engagementType: r.kind === 'VOLUNTEER' ? 'VOLUNTEER' : r.kind === 'SERVICE' ? 'FLEXIBLE' : 'PAID',
    clubName: c.name, clubLogoUrl: c.logoUrl, clubCityName: c.city, clubCountryName: 'Georgia' };
};
export const jobApplications = new Map();

// ---------------------------------------------------------------- store
const productPlan = [
  [1, 'Home shirt 2026/27', 'SHIRT', 95, ['XS', 'S', 'M', 'L', 'XL'], 'The academy home shirt in Dinamo blue, recycled polyester.'],
  [1, 'Training top with half zip', 'TRAINING', 75, ['S', 'M', 'L', 'XL'], 'Lightweight training top worn by all academy squads.'],
  [1, 'Academy scarf', 'ACCESSORIES', 30, ['One size'], 'Knitted blue and white scarf.'],
  [1, 'Season membership for families', 'MEMBERSHIP', 150, ['Family'], 'Priority seats at First Team home matches and a members’ evening.'],
  [1, 'Match ball, size 4', 'EQUIPMENT', 65, ['Size 4'], 'The ball used in U12–U14 matches.'],
  [2, 'Away shirt 2026/27', 'SHIRT', 140, ['S', 'M', 'L', 'XL', 'XXL'], 'First Team away shirt.'],
  [2, 'Home match ticket: Dinamo Arena', 'TICKETS', 15, ['East stand', 'West stand'], 'General admission for the next league home match.'],
  [3, 'Riverside training socks (3 pairs)', 'TRAINING', 25, ['Junior', 'Senior'], 'Green training socks.'],
  [3, 'Riverside water bottle', 'ACCESSORIES', 12, ['750 ml'], 'BPA-free bottle with the club crest.'],
  [4, 'Saburtalo Youth hoodie', 'TRAINING', 85, ['XS', 'S', 'M', 'L'], 'Warm-up hoodie in club red.'],
  [5, 'Locomotive retro shirt', 'SHIRT', 110, ['S', 'M', 'L', 'XL'], 'Heritage shirt celebrating the railway club’s history.'],
  [6, 'Gldani Juniors starter pack', 'EQUIPMENT', 55, ['Age 6–9', 'Age 10–14'], 'Shirt, shorts, socks and shin pads.'],
  [8, 'Futsal shoes, indoor sole', 'FOOTWEAR', 120, ['38', '39', '40', '41', '42', '43', '44'], 'Non-marking indoor shoes.'],
  [10, 'Rustavi Community Cup entry', 'EVENT', 60, ['Team entry'], 'Team entry for the one-day seven-a-side cup.'],
  [11, 'Kutaisi City goalkeeper gloves', 'EQUIPMENT', 70, ['6', '7', '8', '9', '10'], 'Latex palm gloves, junior and senior sizes.'],
  [12, 'Batumi Seaside cap', 'ACCESSORIES', 35, ['One size'], 'Embroidered cap in sea blue.'],
  [7, 'Vake Football School shin pads', 'EQUIPMENT', 28, ['XS', 'S', 'M'], 'Lightweight pads with ankle sleeves.'],
  [15, 'Lisi Lake five-a-side bib set', 'EQUIPMENT', 45, ['Set of 10'], 'Two-colour bibs for weekend games.'],
];
export const products = productPlan.map(([clubId, name, category, price, sizes, description], i) => {
  const c = clubById(clubId);
  return { id: 1101 + i, currency: 'GEL', version: 1, clubId, clubName: c.name, clubLogoUrl: c.logoUrl, clubWhatsappNumber: `+995 599 ${String(20 + clubId).padStart(2, '0')} ${String(30 + i).padStart(2, '0')} 11`, clubEmail: `shop@${c.short.toLowerCase()}.ge`,
    name, description, price, sizes, images: [photo(`product-${1101 + i}`), photo(`product-${1101 + i}-b`)], active: true, createdAt: iso(day(-i * 3 - 1)), category, clubCityName: c.city, clubCountryName: 'Georgia',
    variants: sizes.map((label, k) => ({ id: (1101 + i) * 10 + k, label, stock: (i + k) % 5 === 0 ? 0 : 3 + ((i * 7 + k) % 12) })) };
});
export const productById = id => products.find(p => p.id === Number(id));
export const variantById = id => products.flatMap(p => p.variants.map(v => ({ ...v, product: p }))).find(v => v.id === Number(id));

// ---------------------------------------------------------------- campaigns
const campaignPlan = [
  [1, 'New floodlights for Pitch 3', 'FACILITIES', 45000, 31250, 'Light the small-sided pitch so U12s can train after school in winter.', 'Installation of six LED floodlight masts on Pitch 3 at Digomi.', -40, 50],
  [3, 'Kit for every child at Riverside', 'EQUIPMENT', 8000, 6120, 'Boots and kit for families who cannot afford them.', 'Kit bank: boots, shin pads and training wear for 60 players.', -20, 25],
  [10, 'Rustavi girls to the Black Sea Cup', 'TRAVEL', 6500, 2380, 'Travel and accommodation for the U16 girls’ first coastal tournament.', 'Coach hire, two nights’ accommodation and meals for 18 players and staff.', -10, 30],
  [6, 'Gldani changing room renovation', 'FACILITIES', 12000, 11400, 'Warm, safe changing rooms for 200 local children.', 'Heating, showers and new benches for both changing rooms.', -60, 5],
  [14, 'Footballs for the Sharks', 'YOUTH', 1500, 1500, 'Fifty size 3 and size 4 balls for our youngest players.', 'Fifty training balls and two ball bags.', -50, -3],
  [13, 'Telavi Valley community pitch', 'COMMUNITY', 60000, 9800, 'Resurface the community pitch for the whole of Kakheti.', 'New artificial surface and fencing.', -15, 120],
  [7, 'After-school football bursaries', 'YOUTH', 9000, 4300, 'Free places for 30 children this season.', 'Covers monthly fees for 30 children for nine months.', -25, 60],
];
export const campaigns = campaignPlan.map(([clubId, title, category, goal, raised, summary, useOfFunds, startOffset, endOffset], i) => {
  const c = clubById(clubId), ended = endOffset < 0;
  return { id: 1201 + i, clubId, clubName: c.name, clubLogoUrl: c.logoUrl, country: 'Georgia', city: c.city, title, summary,
    description: `${summary}\n\n${c.name} has run this project with parents and local partners. Every contribution is reported on this page with a short update when the money is spent.`,
    beneficiary: `${c.name} players and families`, useOfFunds, category, currency: 'GEL', goalAmount: goal, reportedAmount: raised, reportedNote: 'Reported by the club treasurer from bank transfers and cash collections.', reportedAt: iso(day(-2 - i)),
    startsOn: isoDate(day(startOffset)), endsOn: isoDate(day(endOffset)), images: [photo(`campaign-${1201 + i}`), photo(`campaign-${1201 + i}-b`)], status: ended ? 'CLOSED' : 'PUBLISHED', phase: ended ? 'ENDED' : 'ACTIVE', version: 3,
    updatedAt: iso(day(-2 - i)), publishedAt: iso(day(startOffset)),
    updates: [{ id: 1250 + i * 2, title: 'Halfway there', body: `Thank you. We have reached ${Math.round(raised / goal * 100)}% of the goal.`, createdAt: iso(day(-3 - i)) }, { id: 1251 + i * 2, title: 'Campaign launched', body: summary, createdAt: iso(day(startOffset)) }] };
});
export const campaignById = id => campaigns.find(c => c.id === Number(id));
