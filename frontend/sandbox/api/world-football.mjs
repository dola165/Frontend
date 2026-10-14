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
  // A boys' or girls' side is never a squad of the other: without one, the club's side is a guest squad.
  const fit = exact.find(s => ageGroup === 'SENIOR' || s.name.includes(word) || s.name.includes('Mixed'));
  if (fit || (exact.length && gender === 'MIXED')) return fit || exact[0];
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
  { id: 306, name: 'Georgian Youth Cup U16', format: 'KNOCKOUT', ageGroup: 'U16', gender: 'MALE', teamFormat: '11v11', organizerClubId: null, organizerOrgId: 801, start: day(-13), end: day(6, 20), entryDeadline: day(-30), status: 'IN_PROGRESS', teams: [1, 4, 5, 11, 16, 3, 13, 10], city: 'Tbilisi', venueId: 203, fee: 150, description: 'National knockout cup for U16 academy sides. Quarter-finals and semi-finals at home grounds, final at Mikheil Meskhi Stadium.' },
  { id: 307, name: 'Rustavi Community Cup', format: 'GROUPS_KNOCKOUT', ageGroup: 'SENIOR', gender: 'MIXED', teamFormat: '7v7', organizerClubId: 10, start: day(16, 10), end: day(16, 19), entryDeadline: day(10), status: 'REGISTRATION', teams: [10, 6, 15, 9, 8], city: 'Rustavi', venueId: 208, fee: 60, description: 'One-day seven-a-side cup with a family fan zone. Proceeds support the club’s girls’ programme.' },
  { id: 308, name: 'Tbilisi Futsal Ladder', format: 'LADDER', ageGroup: 'SENIOR', gender: 'MIXED', teamFormat: '5v5', organizerClubId: 8, start: day(-40), end: day(80), entryDeadline: day(30), status: 'IN_PROGRESS', teams: [8, 9, 15, 3, 6], city: 'Tbilisi', venueId: 204, fee: 0, description: 'Challenge any team up to three places above you. Weeknight futsal at the Isani hall.' },
  { id: 309, name: 'Mtskheta Grassroots Festival U10', format: 'FESTIVAL', ageGroup: 'U10', gender: 'MIXED', teamFormat: '5v5', organizerClubId: 14, start: day(2, 10), end: day(2, 15), entryDeadline: day(0), status: 'REGISTRATION', teams: [14, 6, 7, 3, 1], city: 'Mtskheta', venueId: 214, fee: 0, description: 'No scores, no tables. Every child plays every game by the river.' },
  { id: 312, name: 'Isani Walking Football Morning', format: 'FESTIVAL', ageGroup: 'SENIOR', gender: 'MIXED', teamFormat: '5v5', organizerClubId: 8, start: day(19, 10), end: day(19, 13), entryDeadline: day(16), status: 'REGISTRATION', teams: [], players: ['Zurab Beridze', 'Manana Kiknadze', 'Gela Tsiklauri', 'Nodar Abuladze', 'Lia Chkheidze', 'Temur Mamulashvili'], city: 'Tbilisi', venueId: 204, fee: 15, feeBasis: 'PLAYER', discipline: 'WALKING', description: 'Walking football for adults of any age: sign up on your own and the organiser makes the teams on the morning.' },
  // A tournament from before the competition engine: no published rules, its stages built by hand (groups, then finals).
  { id: 310, name: 'Batumi Beach Cup U14', legacy: true, format: 'GROUPS_KNOCKOUT', ageGroup: 'U14', gender: 'MIXED', teamFormat: '5v5', organizerClubId: 12, start: day(-120, 10), end: day(-119, 18), entryDeadline: day(-130), status: 'COMPLETED', teams: [12, 10, 1, 4, 6, 11, 3, 16], city: 'Batumi', venueId: 210, fee: 40, description: 'Two days of beach five-a-side by the boulevard, from last summer.' },
];
export const tournamentList = [...W.tournaments, ...extraTournaments];
const STATUS = { IN_PROGRESS: 'ACTIVE', REGISTRATION: 'PLANNING', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED' };
const FAMILY = { LEAGUE: 'LEAGUE', KNOCKOUT: 'CUP', GROUPS_KNOCKOUT: 'CUP', FESTIVAL: 'FESTIVAL', LADDER: 'LADDER' };
const STRUCTURE = { LEAGUE: 'ROUND_ROBIN', KNOCKOUT: 'KNOCKOUT', GROUPS_KNOCKOUT: 'GROUPS_KNOCKOUT', FESTIVAL: 'ROTATION', LADDER: 'LADDER' };
/** The community league is played home and away. */
export const structureOf = t => t.structure ?? (t.id === 301 ? 'HOME_AWAY' : STRUCTURE[t.format]);
/** Who enters (clubs unless said) and how entries are taken (as they come unless said). */
const SCOPE = { 303: 'SQUAD', 312: 'PLAYER' };
const POLICY = { 301: 'APPROVAL_ONLY', 302: 'APPROVAL_ONLY', 304: 'APPROVAL_ONLY', 307: 'INVITE_ONLY' };
export const scopeOf = t => t.scope ?? SCOPE[t.id] ?? 'CLUB';
export const policyOf = t => t.policy ?? POLICY[t.id] ?? 'OPEN';

export const tournamentState = new Map(); // id -> { entries, stages, fixtures, staff, routes, phases, plan, overrides }
let entrySeq = 6000, fixtureSeq = 7000, stageSeq = 6800;
// As the backend sends entries: the squad's name, no display name for a club's entry.
const entryFor = (t, clubId, status = 'ACTIVE') => {
  const c = clubById(clubId), squad = squadFor(clubId, t.ageGroup, t.gender);
  return { id: ++entrySeq, clubId, clubName: c.name, squadId: squad?.id ?? null, squadName: squad?.name ?? null, userId: null, displayName: null, status, seed: null,
    requestedBy: clubId === DINAMO ? W.ME_ID : null, decidedBy: status === 'PENDING' ? null : W.ME_ID, decidedAt: iso(day(-40)), confirmedAt: status === 'ACTIVE' ? iso(day(-35)) : null, withdrawnAt: null, withdrawalReason: null, draftTeamId: null };
};
/** A fixture's side as the backend labels it: "Squad (Club)", the club alone when the entry names no squad. */
export const entryLabel = e => !e ? null : e.displayName || (e.squadName ? `${e.squadName} (${e.clubName})` : e.clubName);
const score = () => [fint(0, 4), fint(0, 3)];
/** Days from today's midnight, exactly (a tournament's days never round to the day before). */
const offsetOf = d => Math.round((d.getTime() - day(0).getTime()) / 86400000);

function buildTournament(t) {
  const status = STATUS[t.status];
  // Dinamo is invited to the festival (303) and the girls' cup (304), so it has not entered them.
  const extra = t.id === 302 ? [4, 10, 15] : t.id === 304 ? [11, 3, 16] : t.id === 303 ? [5, 14] : [];
  const ids = [...new Set([...t.teams, ...extra])];
  const entries = ids.map((clubId, i) => entryFor(t, clubId, status === 'PLANNING' && i >= ids.length - 2 && t.id !== 309 ? 'PENDING' : status === 'PLANNING' && i >= ids.length - 3 && t.id === 304 ? 'APPROVED' : 'ACTIVE'));
  // A players' tournament: people enter themselves.
  (t.players ?? []).forEach((player, i) => entries.push({ id: ++entrySeq, clubId: null, clubName: null, squadId: null, squadName: null, userId: 8100 + i, displayName: player, status: 'ACTIVE', seed: null,
    requestedBy: 8100 + i, decidedBy: null, decidedAt: iso(day(-10 + i)), confirmedAt: iso(day(-10 + i)), withdrawnAt: null, withdrawalReason: null, draftTeamId: null }));
  entries.forEach((e, i) => { e.seed = i + 1; });
  if (t.id === 301) entries.forEach(e => { if (e.clubId === DINAMO) { e.squadId = 101; e.squadName = W.squadById(101)?.name ?? e.squadName; } });
  const stages = [], fixtures = [], routes = [], phases = new Map();
  let plan = null;
  const fixture = (stage, round, order, home, away, when, played, overrides = {}) => {
    const [hs, as] = played ? score() : [null, null];
    const f = { id: ++fixtureSeq, stageId: stage.id, stageName: stage.name, homeEntryId: home?.id ?? null, homeLabel: entryLabel(home), awayEntryId: away?.id ?? null, awayLabel: entryLabel(away),
      winnerEntryId: null, homeScore: hs, awayScore: as, roundNumber: round, fixtureOrder: order, scheduledAt: when ? local(when) : null, locationId: t.venueId, status: played ? 'COMPLETED' : 'SCHEDULED', linkedMatchId: null, venueReservation: null, ...overrides };
    if (played && home && away) f.winnerEntryId = hs > as ? home.id : as > hs ? away.id : null;
    fixtures.push(f); return f;
  };
  // The engine makes ROUND_ROBIN and KNOCKOUT stages with no advance count; legacy tournaments used GROUP stages by hand.
  const stage = (name, stageType, order, { phase = 1, title = false, advanceCount = 0 } = {}) => {
    const s = { id: ++stageSeq, parentStageId: null, name, stageType, stageOrder: order, status: status === 'COMPLETED' ? 'COMPLETED' : status === 'ACTIVE' ? 'ACTIVE' : 'PLANNING', advanceCount };
    stages.push(s); if (!t.legacy) phases.set(s.id, { phase, title_route: title, carry_results: false }); return s;
  };
  const drawPlan = (startsAt, daysBetweenRounds) => ({ startsAt: iso(startsAt), daysBetweenRounds, groupCount: 2, qualifiers: 1, routes: 1, thirdPlace: false, twoLegged: false, aggregateResolution: 'PENALTIES', carryResults: false, splitCut: 2, divisionLinks: '' });
  const active = entries.filter(e => e.status === 'ACTIVE');
  const startDay = offsetOf(t.start);
  // A tournament just created has no draw yet: its organiser makes it in the workspace once entries close.
  if (t.created) {
    // Nothing drawn.
  } else if (t.legacy) {
    // Groups of four by hand, then semi-finals and a final paired by order (no routes): the shape before the engine.
    const groups = [active.slice(0, 4), active.slice(4, 8)];
    const winners = groups.map((group, g) => {
      const s = stage(`Group ${'AB'[g]}`, 'GROUP', 1, { advanceCount: 2 });
      let n = 0;
      for (let a = 0; a < group.length; a++) for (let b = a + 1; b < group.length; b++) { n++; fixture(s, Math.ceil(n / 2), n, group[a], group[b], at(startDay, 10 + Math.floor((n - 1) / 2), ((n - 1) % 2) * 30), true); }
      return standingsFor({ entries, fixtures }, s.id).slice(0, 2).map(row => entries.find(e => e.id === row.entryId));
    });
    const finals = stage('Finals', 'KNOCKOUT', 2);
    const semis = [fixture(finals, 1, 1, winners[0][0], winners[1][1], at(startDay + 1, 11), true), fixture(finals, 1, 2, winners[1][0], winners[0][1], at(startDay + 1, 12), true)];
    for (const f of semis) if (!f.winnerEntryId) { f.homeScore += 1; f.winnerEntryId = f.homeEntryId; }
    const finalist = f => entries.find(e => e.id === f.winnerEntryId);
    const final = fixture(finals, 2, 1, finalist(semis[0]), finalist(semis[1]), at(startDay + 1, 16), true);
    if (!final.winnerEntryId) { final.homeScore += 1; final.winnerEntryId = final.homeEntryId; }
  } else if (structureOf(t) === 'ROUND_ROBIN' || structureOf(t) === 'HOME_AWAY') {
    const s = stage('League', 'ROUND_ROBIN', 1, { title: true });
    const teams = [...active]; if (teams.length % 2) teams.push(null);
    const legs = structureOf(t) === 'HOME_AWAY' ? 2 : 1, rounds = (teams.length - 1) * legs;
    for (let r = 0; r < rounds; r++) {
      const rot = [teams[0], ...teams.slice(1).slice(-(r % (teams.length - 1))), ...teams.slice(1).slice(0, teams.length - 1 - (r % (teams.length - 1)))];
      for (let i = 0; i < teams.length / 2; i++) {
        let home = rot[i], away = rot[teams.length - 1 - i];
        if (!home || !away) continue;
        if (r >= teams.length - 1 || (r + i) % 2) [home, away] = [away, home];
        const when = at(startDay + 3 + r * 7, 15 + i * 2);
        const f = fixture(s, r + 1, i + 1, home, away, when, when.getTime() < Date.now() - 3 * 3600000);
        // The academy reserves are having a good autumn.
        if (t.id === 301 && f.status === 'COMPLETED' && (home.clubId === DINAMO || away.clubId === DINAMO)) {
          if (home.clubId === DINAMO) f.homeScore = f.awayScore + 1 + (r % 2); else f.awayScore = f.homeScore + (r % 3 === 0 ? 0 : 1);
          f.winnerEntryId = f.homeScore > f.awayScore ? home.id : f.awayScore > f.homeScore ? away.id : null;
        }
      }
    }
    plan = drawPlan(at(startDay + 3, 15), 7);
  } else if (t.format === 'LADDER') {
    // A ladder has no draw: each accepted challenge becomes a fixture (round 1, in the order challenges were made).
    const s = stage('Ladder', 'ROUND_ROBIN', 1, { title: true });
    for (let n = 0; n < 6; n++) {
      const challenger = active[(n + 2) % active.length], target = active[n % active.length];
      if (challenger.id === target.id) continue;
      fixture(s, 1, 7590 + n, challenger, target, at(startDay + 4 + n * 6, 20), true);
    }
  } else if (t.format === 'KNOCKOUT') {
    // The engine's cup: seeds folded (1 v 8, 2 v 7…), a bye wherever a seed has no opponent, each later tie fed by routes.
    const s = stage('Cup', 'KNOCKOUT', 1, { title: true });
    const seeded = t.id === 306 ? [...active.filter(e => [DINAMO, 13].includes(e.clubId)), ...active.filter(e => ![DINAMO, 13].includes(e.clubId))] : active;
    let size = 2; while (size < seeded.length) size *= 2;
    let current = Array.from({ length: size }, (_, i) => ({ entry: seeded[i] ?? null, source: null }));
    // The U12 cup is one morning on Vake Park's three pitches, as the engine's clock lays it out (40 minutes and 10 to rest).
    const roundTime = (round, order) => t.id === 306 ? at([-12, -5, 6][round - 1], round === 3 ? 18 : 15) : plusMin(at(startDay, 10), [0, 100, 150][round - 1] + Math.floor((order - 1) / 3) * 50);
    for (let round = 1; current.length > 1; round++) {
      const games = current.length / 2, next = [];
      for (let i = 0; i < games; i++) {
        const h = current[i], a = current[current.length - 1 - i];
        const winnerOf = slot => slot.entry ?? (slot.source?.winnerEntryId ? entries.find(e => e.id === slot.source.winnerEntryId) : null);
        const home = winnerOf(h), away = winnerOf(a), bye = !h.source && !a.source && (!h.entry || !a.entry);
        const when = roundTime(round, i + 1);
        const played = !bye && Boolean(home && away && when.getTime() < Date.now());
        const f = fixture(s, round, i + 1, home, away, when, played, { locationId: round === 3 || t.id !== 306 ? t.venueId : clubById(home?.clubId)?.venueId ?? t.venueId });
        if (h.source) routes.push({ target_fixture_id: f.id, slot: 'HOME', source_fixture_id: h.source.id, outcome: 'WINNER' });
        if (a.source) routes.push({ target_fixture_id: f.id, slot: 'AWAY', source_fixture_id: a.source.id, outcome: 'WINNER' });
        // A bye is completed at the draw, its one side going through.
        if (bye) Object.assign(f, { status: 'COMPLETED', winnerEntryId: (home ?? away)?.id ?? null });
        if (played && f.homeScore === f.awayScore) { f.homeScore += 1; f.winnerEntryId = home.id; }
        if (t.id === 306 && played && (home.clubId === DINAMO || away.clubId === DINAMO)) { const dinamoHome = home.clubId === DINAMO; f.homeScore = dinamoHome ? 3 : 1; f.awayScore = dinamoHome ? 1 : 2; f.winnerEntryId = (dinamoHome ? home : away).id; }
        next.push({ entry: null, source: f });
      }
      current = next;
    }
    for (const f of fixtures) if (f.status === 'COMPLETED' && f.homeEntryId && f.awayEntryId) { const loser = f.winnerEntryId === f.homeEntryId ? f.awayEntryId : f.homeEntryId; const e = entries.find(x => x.id === loser); if (e && status === 'ACTIVE') e.status = 'ELIMINATED'; }
    plan = drawPlan(roundTime(1, 1), t.id === 306 ? 7 : 0);
  }
  // Groups and finals, and festivals, are drawn (or their rounds made) once entries close: these two are still taking entries.
  // One recent league result is still waiting for the referee's report.
  if (t.id === 301) { const pending = fixtures.filter(f => f.status === 'COMPLETED' && ![f.homeEntryId, f.awayEntryId].includes(entries.find(e => e.clubId === DINAMO)?.id)).at(-1); if (pending) Object.assign(pending, { status: 'SCHEDULED', homeScore: null, awayScore: null, winnerEntryId: null }); }
  if (status === 'COMPLETED') fixtures.forEach(f => { if (f.status !== 'COMPLETED' && f.homeEntryId && f.awayEntryId) { const [h, a] = score(); Object.assign(f, { status: 'COMPLETED', homeScore: h, awayScore: a, winnerEntryId: h > a ? f.homeEntryId : a > h ? f.awayEntryId : null }); } });
  // Dinamo staff run the league they host; Luka coordinates it and the U16 cup.
  const staff = [];
  if ([301, 306].includes(t.id)) staff.push({ id: 6900 + t.id, userId: W.ME_ID, fullName: W.me.fullName, role: 'ADMIN', status: 'ACTIVE', assignedBy: W.ME_ID, createdAt: iso(day(-45)) });
  const refs = referees.slice(t.id % 4, t.id % 4 + 2);
  refs.forEach((r, i) => staff.push({ id: 6950 + t.id * 2 + i, userId: r.id, fullName: r.fullName, role: 'REFEREE', status: 'ACTIVE', assignedBy: W.ME_ID, createdAt: iso(day(-30)) }));
  const st = { entries, stages, fixtures, staff, routes, phases, plan, status, revision: 4, invitations: [] };
  if (status === 'COMPLETED') {
    const final = fixtures.filter(f => stages.find(s => s.id === f.stageId)?.stageType === 'KNOCKOUT').sort((a, b) => b.roundNumber - a.roundNumber)[0];
    const championId = final?.winnerEntryId ?? standingsFor(st, stages[0]?.id)[0]?.entryId ?? null;
    const champion = entries.find(e => e.id === championId);
    st.championEntryId = champion?.id ?? null; st.championName = champion ? entryLabel(champion) : null;
  }
  tournamentState.set(t.id, st);
}
/** A table as the backend computes it: club names, points, goal difference, goals scored. */
export function standingsFor(st, stageId) {
  const rows = new Map();
  const ids = new Set(st.fixtures.filter(f => !stageId || f.stageId === stageId).flatMap(f => [f.homeEntryId, f.awayEntryId]).filter(Boolean));
  for (const e of st.entries.filter(e => ids.has(e.id) || (!stageId && e.status === 'ACTIVE'))) rows.set(e.id, { entryId: e.id, label: e.clubName ?? e.displayName, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 });
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
  if (t.rules) return t.rules;
  const side = Number(t.teamFormat.split('v')[0]);
  return {
    family: FAMILY[t.format], structure: structureOf(t), discipline: t.discipline ?? (side === 5 && t.venueId === 204 ? 'FUTSAL' : 'ASSOCIATION'), sideSize: side, ageGroup: t.ageGroup,
    eligibilityCategory: t.gender === 'FEMALE' ? 'Girls' : t.gender === 'MALE' ? (t.ageGroup === 'SENIOR' ? 'Open' : 'Boys') : 'Open', playingLevel: t.ageGroup === 'U10' ? 'DEVELOPMENT' : t.format === 'FESTIVAL' ? 'RECREATIONAL' : 'COMPETITIVE',
    country: 'Georgia', city: t.city, timezone: TZ, ruleset: RULESET[t.format], jurisdiction: t.ageGroup === 'SENIOR' ? '' : 'Organiser-run youth competition', ageCutoff: t.ageGroup === 'SENIOR' ? null : local(t.start).slice(0, 10),
    matchMinutes: side >= 11 ? (t.ageGroup === 'SENIOR' ? 90 : 80) : side >= 7 ? 40 : 24, restMinutes: side >= 11 ? 30 : 10, pitches: t.venueId === 205 ? 3 : 1, rounds: 3,
    tiebreaks: ['POINTS', 'GOAL_DIFFERENCE', 'GOALS_FOR', 'SEED'], challengeRange: 3, challengeExpiryDays: 7, maxConsecutiveStays: 2, standings: t.format !== 'FESTIVAL',
    entryFee: t.fee, currency: 'GEL', feeBasis: t.feeBasis ?? 'TEAM', seasonPolicy: t.format === 'LEAGUE' ? 'Double round-robin, autumn to winter. Points: 3 win, 1 draw.' : 'Single event; results stand once confirmed by the organiser.',
  };
};
// A tournament from before the engine has no published rules.
export const competitionProfile = t => t.legacy ? { rules: null, revision: 0, legacy: true } : { rules: competitionRules(t), revision: 3, legacy: false };
export const organizerOf = t => t.organizerOrgId ? organizationById(t.organizerOrgId) : { id: 900 + t.organizerClubId, name: clubById(t.organizerClubId).name, logoUrl: clubById(t.organizerClubId).logoUrl, clubId: t.organizerClubId };
/** When entries open and close. The girls' cup opens in two days, so "Opens …" has an example. */
export const registrationWindow = t => ({ opens: t.opens ?? (t.created ? new Date(0) : t.id === 304 ? day(2, 9) : day(-60)), closes: t.entryDeadline });
/** As the backend counts places taken: approved and active entries, and those that played on or went out. */
export const placesTaken = st => st.entries.filter(e => ['APPROVED', 'ACTIVE', 'COMPLETED', 'ELIMINATED'].includes(e.status)).length;
// As the backend sends them: times are the venue's wall clock without a zone (Georgian time).
export const tournamentSummary = t => {
  const st = tournamentState.get(t.id), org = organizerOf(t), host = t.organizerClubId ? clubById(t.organizerClubId) : null, window = registrationWindow(t);
  return {
    id: t.id, name: t.name, description: t.description, status: st.status, organizerOrganizationId: org.id, organizerName: org.name, hostClubId: host?.id ?? null, hostClubName: host?.name ?? null,
    participantScope: scopeOf(t), visibility: t.visibility ?? 'PUBLIC', startDate: local(t.start), endDate: local(t.end), registrationOpensAt: local(window.opens), registrationClosesAt: local(window.closes),
    // The summary counts approved and active entries only (the list card counts those that played on or went out too).
    entryCount: st.entries.filter(e => ['ACTIVE', 'APPROVED'].includes(e.status)).length, incentives: t.created ? t.incentives : t.fee ? 'Trophies and medals for finalists' : 'Medals for every player', bannerImageUrl: t.created ? t.banner : photo(`tournament-${t.id}`),
  };
};
export const tournamentDetail = t => {
  const st = tournamentState.get(t.id);
  return { ...tournamentSummary(t), entryCap: t.cap ?? (t.format === 'LEAGUE' ? 10 : t.format === 'KNOCKOUT' ? 8 : 12), rules: t.created ? t.writtenRules : RULESET[t.format], registrationPolicy: policyOf(t), locationId: t.venueId,
    staffAssignments: st.staff, entries: st.entries, stages: st.stages, fixtures: st.fixtures, championEntryId: st.championEntryId ?? null, championName: st.championName ?? null, ...(st.overrides || {}) };
};
/** A `/competitions` card as the backend sends it: no entry window, host or organiser ids, visibility or prizes. */
export const competitionCard = t => {
  const { id, name, description, status, participantScope, organizerName, hostClubName, startDate, endDate, bannerImageUrl } = tournamentSummary(t);
  return { id, name, description, status, participantScope, organizerName, hostClubName, startDate, endDate, bannerImageUrl, entryCount: placesTaken(tournamentState.get(t.id)), entryCap: tournamentDetail(t).entryCap, profile: competitionProfile(t) };

};
// ============================================================== creating a tournament (as CompetitionService.create)
const FORMAT_OF = { KNOCKOUT: 'KNOCKOUT', GROUPS_KNOCKOUT: 'GROUPS_KNOCKOUT', ROUND_ROBIN: 'LEAGUE', HOME_AWAY: 'LEAGUE', SWISS: 'LEAGUE', SPLIT_LEAGUE: 'LEAGUE', LADDER: 'LADDER', ROTATION: 'FESTIVAL', KING_OF_PITCH: 'FESTIVAL' };
const createRequests = new Map(); // requestId -> { digest, id }
const wallDate = value => value ? new Date(`${value.length === 16 ? `${value}:00` : value}+04:00`) : null;
/** Creates a tournament as its organisation's staff, or says why not: `{ tournament }`, `{ replay }` or `{ refusal }`. */
export function createTournament(body) {
  const { identity = {}, rules = {}, requestId, policy, venueId } = body ?? {};
  if (!requestId) return { refusal: { status: 400, message: 'A request id is required.' } };
  const digest = JSON.stringify({ identity, rules, policy, venueId: venueId ?? null });
  const prior = createRequests.get(requestId);
  if (prior) return prior.digest === digest ? { replay: tournamentById(prior.id) } : { refusal: { status: 409, message: 'This creation request was already used with different details.' } };
  if (identity.organizerOrganizationId !== 901) return { refusal: { status: 403, message: 'You cannot create tournaments for this organisation.' } };
  if (!String(identity.name ?? '').trim()) return { refusal: { status: 400, message: 'Tournament name is required.' } };
  if (!String(rules.ruleset ?? '').trim() || !String(rules.seasonPolicy ?? '').trim()) return { refusal: { status: 400, message: 'State the ruleset and the season policy.' } };
  if (/^U\d+$/.test(rules.ageGroup ?? '') && !rules.ageCutoff) return { refusal: { status: 400, message: 'Youth eligibility requires an explicit age cutoff date.' } };
  if (identity.participantScope === 'PLAYER' && /^U\d+$/.test(rules.ageGroup ?? '') && Number(rules.ageGroup.slice(1)) <= 18) return { refusal: { status: 400, message: 'Youth competitions use supervised club or squad entries. Individual registration currently requires an adult player.' } };
  const start = wallDate(identity.startDate), end = wallDate(identity.endDate);
  if (!start || !end || start.getTime() <= Date.now() || end < start) return { refusal: { status: 400, message: 'Choose future dates, the end after the start.' } };
  const id = Math.max(...tournamentList.map(t => t.id)) + 1;
  // The organisation runs it; a host club only when one is named.
  const host = identity.hostClubId ? clubById(identity.hostClubId) : null;
  const t = {
    id, name: String(identity.name).trim(), created: true, format: FORMAT_OF[rules.structure] ?? 'KNOCKOUT', structure: rules.structure, ageGroup: rules.ageGroup, gender: 'MIXED', teamFormat: `${rules.sideSize}v${rules.sideSize}`,
    organizerClubId: host?.id ?? null, organizerOrgId: identity.organizerOrganizationId, start, end, entryDeadline: wallDate(identity.registrationClosesAt) ?? start, opens: wallDate(identity.registrationOpensAt), status: 'REGISTRATION', teams: [], city: rules.city, venueId: venueId ?? host?.venueId ?? null,
    fee: Number(rules.entryFee ?? 0), feeBasis: rules.feeBasis, discipline: rules.discipline, description: identity.description ?? '', rules, policy: identity.registrationPolicy ?? 'APPROVAL_ONLY', scope: identity.participantScope ?? 'CLUB',
    visibility: identity.visibility ?? 'PRIVATE', cap: identity.entryCap ?? null, incentives: identity.incentives ?? null, banner: identity.bannerImageUrl ?? null, writtenRules: identity.rules ?? null,
  };
  tournamentList.push(t);
  buildTournament(t);
  // The person who creates it runs it.
  tournamentState.get(id).staff.unshift({ id: W.newId(), userId: W.ME_ID, fullName: W.me.fullName, role: 'ADMIN', status: 'ACTIVE', assignedBy: W.ME_ID, createdAt: iso(new Date()) });
  createRequests.set(requestId, { digest, id });
  return { tournament: t };
}

// ============================================================== entering and invitations (as TournamentService)
/** One store of tournament invitations: the person's list, the organiser's, Requests, review, accept and decline read it. */
const firstTeam = DINAMO_SQUADS.find(s => s.ageGroup === 'SENIOR') ?? DINAMO_SQUADS[0];
const girlsU16 = DINAMO_SQUADS.find(s => s.ageGroup === 'U16' && /Girls/.test(s.name));
export const tournamentInvitations = [
  // The festival takes squads; Kutaisi invited the club as a whole, so whoever answers names the squad.
  { id: 6501, tournamentId: 303, clubId: DINAMO, squadId: null, status: 'PENDING', createdAt: day(-1, 9) },
  { id: 7704, tournamentId: 304, clubId: DINAMO, squadId: girlsU16?.id ?? null, status: 'PENDING', createdAt: day(-3, 14) },
  // The Rustavi cup is by invitation only.
  { id: 7707, tournamentId: 307, clubId: DINAMO, squadId: firstTeam?.id ?? null, status: 'PENDING', createdAt: day(-2, 11) },
  { id: 6503, tournamentId: 301, clubId: DINAMO, squadId: 101, status: 'ACCEPTED', createdAt: day(-40, 10), updatedAt: day(-35, 10) },
];
export const invitationView = inv => {
  const t = tournamentById(inv.tournamentId), c = clubById(inv.clubId), s = inv.squadId ? W.squadById(inv.squadId) : null;
  return { id: inv.id, clubId: inv.clubId, clubName: c?.name ?? null, squadId: inv.squadId, squadName: s?.name ?? null, status: inv.status, createdAt: iso(inv.createdAt), tournament: t };
};
const LIVE = ['PENDING', 'APPROVED', 'WAITLISTED', 'ACTIVE'];
// Places are held by entries waiting for the organiser too, as the backend counts them.
const HOLDS = ['PENDING', 'APPROVED', 'ACTIVE'];
/** As the backend decides it: entries are in at once only when the policy is open and they come from squads or players in an Open tournament (or the tournament has no rules). */
const takenAtOnce = t => {
  if (policyOf(t) !== 'OPEN') return false;
  const rules = competitionProfile(t).rules;
  return !rules || (['SQUAD', 'PLAYER'].includes(scopeOf(t)) && String(rules.eligibilityCategory ?? '').trim().toLowerCase() === 'open');
};
/** A tournament's entry rules, in the backend's order; null when the entry may be made, else the refusal. */
function entryRefusal(t, st, { clubId, userId, invited }) {
  const window = registrationWindow(t), now = Date.now();
  if (st.status !== 'PLANNING') return { status: 409, message: 'Entries are only taken while the tournament is being planned.' };
  if (window.opens.getTime() > now || window.closes.getTime() <= now) return { status: 409, message: 'Entries are closed for this tournament.' };
  if (policyOf(t) === 'INVITE_ONLY' && !invited) return { status: 403, message: 'This tournament takes entries by invitation only.' };
  if (clubId != null && st.entries.some(e => e.clubId === clubId && LIVE.includes(e.status))) return { status: 409, message: 'This club already has a live entry in this tournament.' };
  if (userId != null && st.entries.some(e => e.userId === userId && LIVE.includes(e.status))) return { status: 409, message: 'You are already registered in this tournament.' };
  return null;
}
/** How a new entry starts: on the waiting list once the places are taken, else in at once or waiting for the organiser. */
function startingStatus(t, st) {
  const cap = tournamentDetail(t).entryCap;
  if (cap && st.entries.filter(e => HOLDS.includes(e.status)).length >= cap) return 'WAITLISTED';
  return takenAtOnce(t) ? 'ACTIVE' : 'PENDING';
}
/** Makes an entry (a club's, a squad's or a player's) or says why not: `{ entry }` or `{ refusal }`. */
export function enterTournament(t, { clubId = null, squadId = null, userId = null, displayName = null, invited = false }) {
  const st = tournamentState.get(t.id);
  const refusal = entryRefusal(t, st, { clubId, userId, invited });
  if (refusal) return { refusal };
  const c = clubId != null ? clubById(clubId) : null, s = squadId != null ? W.squadById(squadId) : null;
  const status = startingStatus(t, st);
  const entry = { id: ++entrySeq, clubId: c?.id ?? null, clubName: c?.name ?? null, squadId: s?.id ?? null, squadName: s?.name ?? null, userId, displayName, status, seed: null,
    requestedBy: W.ME_ID, decidedBy: status === 'ACTIVE' ? W.ME_ID : null, decidedAt: status === 'ACTIVE' ? iso(new Date()) : null, confirmedAt: status === 'ACTIVE' ? iso(new Date()) : null, withdrawnAt: null, withdrawalReason: null, draftTeamId: null };
  st.entries.push(entry);
  // Entering while invited uses the invitation up.
  for (const inv of tournamentInvitations) if (inv.tournamentId === t.id && inv.clubId === clubId && inv.status === 'PENDING') Object.assign(inv, { status: 'ACCEPTED', updatedAt: new Date() });
  return { entry };
}
/** A withdrawal frees a place: the first entry on the waiting list moves up. */
export function withdrawEntry(t, entryId) {
  const st = tournamentState.get(t.id), entry = st.entries.find(e => e.id === Number(entryId));
  if (!entry || !LIVE.includes(entry.status)) return false;
  const held = HOLDS.includes(entry.status);
  Object.assign(entry, { status: 'WITHDRAWN', withdrawnAt: iso(new Date()) });
  const next = held && st.entries.find(e => e.status === 'WAITLISTED');
  // As promoteWaitlistedEntries: in at once under an open policy, else approved.
  if (next) next.status = policyOf(t) === 'OPEN' ? 'ACTIVE' : 'APPROVED';
  return true;
}

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
    clubName: c.name, clubLogoUrl: c.logoUrl, clubCityName: c.city, clubCountryName: 'Georgia',
    // Jobs for everyone (14 October): who posts, which way round, the pay, the hours and how to apply.
    // Fields the backend needs (docs/claude-sandbox/BACKEND_NEEDS.md, "Jobs").
    direction: 'HIRING', poster: { kind: 'CLUB', id: c.id, name: c.name, avatarUrl: c.logoUrl, city: c.city },
    pay: r.employment === 'FULL_TIME' ? 'GEL 1,800 / month' : r.employment === 'PART_TIME' ? 'GEL 700 / month' : r.employment === 'CONTRACT' ? 'By agreement' : null,
    hours: r.employment === 'FULL_TIME' ? 'FULL_TIME' : r.employment === 'PART_TIME' ? 'PART_TIME' : r.employment === 'CONTRACT' ? 'SESSIONS' : 'VOLUNTEER',
    licence: (r.requirements ?? []).find(x => /UEFA|licen|certificate/i.test(x)) ?? null,
    applyMethod: CATEGORY_BY_TITLE(r.title) === 'COACHING' ? 'IN_APP' : 'EMAIL', applyTarget: CATEGORY_BY_TITLE(r.title) === 'COACHING' ? null : `jobs@${c.short.toLowerCase()}.ge` };
};
export const jobApplications = new Map();

// Listings posted by people, not clubs: a parent hiring a coach for a child, a coach or referee saying they are available.
const personOf = (role, nth = 0) => W.people.filter(p => p.role === role)[nth];
const listingPlan = [
  ['PARENT', 0, 'HIRING', 'Personal trainer for a 12-year-old, twice a week', 'COACHING', 'PAID', 'SESSIONS', 'GEL 40 / session', 'Vake, after school. My son plays for a U12 squad and wants to work on first touch and speed. Patience with kids matters more than a licence.', -2],
  ['PARENT', 1, 'HIRING', 'Goalkeeper coaching for my daughter (U14), weekends', 'COACHING', 'PAID', 'SESSIONS', 'GEL 50 / session', 'Saturday or Sunday mornings in Saburtalo. She is the keeper of her club squad and wants extra work on positioning and distribution.', -5],
  ['PARENT', 2, 'HIRING', 'Football tutor for twin boys (8), afternoons', 'COACHING', 'PAID', 'SESSIONS', 'GEL 35 / session', 'Two eight-year-olds, Didube, weekday afternoons. Fun first; they are just starting.', -1],
  ['COACH', 1, 'OFFERING', 'UEFA B coach available for private sessions and small groups', 'COACHING', 'PAID', 'SESSIONS', 'GEL 60 / session', 'Ten years at academy level, U10 to U16. Technical work, finishing, small-group sessions up to six players. Tbilisi, evenings and weekends.', -3],
  ['COACH', 2, 'OFFERING', 'Goalkeeper coach, evenings, Saburtalo', 'COACHING', 'PAID', 'SESSIONS', 'GEL 45 / session', 'Former first-team keeper. Weekday evenings for keepers aged 10 and up, your pitch or mine.', -8],
  ['REFEREE', 2, 'OFFERING', 'Referee available for friendlies and youth tournaments, weekends', 'MATCHDAY', 'PAID', 'MATCHDAYS', 'GEL 50 / match', 'GFF regional referee. Weekends across Tbilisi; happy to take a whole tournament day.', -4],
  ['STAFF', 0, 'OFFERING', 'Match-day physio available', 'MEDICAL', 'PAID', 'MATCHDAYS', 'GEL 120 / match', 'Licensed physiotherapist, pitch-side cover for matches and tournaments, taping and first response. Own kit.', -6],
  ['STAFF', 1, 'OFFERING', 'Video analyst for youth squads, part time', 'FOOTBALL_OPERATIONS', 'FLEXIBLE', 'PART_TIME', 'By agreement', 'Filming, clips and a short report per match. Hudl and Wyscout. Two or three squads at a time.', -12],
];
export const jobListings = listingPlan.map(([role, nth, direction, title, category, engagementType, hours, pay, description, posted], i) => {
  const person = personOf(role, nth) ?? personOf(role, 0);
  return { id: 701 + i, personId: person.id, direction, title, category, engagementType, hours, pay, description, posted: day(posted), deadline: day(30 + i) };
});
/** A person's listing in the job shape: the poster is the person, the place is their town, applying is a message. */
export const jobListingView = l => {
  const person = W.personById(l.personId);
  return { version: 1, id: l.id, clubId: null, title: l.title, description: l.description, ageGroup: null, level: null, requiredRole: null, status: 'OPEN', createdAt: iso(l.posted), createdBy: person.id,
    applicationCount: (l.id * 3) % 7, category: l.category, engagementType: l.engagementType, clubName: null, clubLogoUrl: null, clubCityName: person.city ?? 'Tbilisi', clubCountryName: 'Georgia',
    direction: l.direction, poster: { kind: 'PERSON', id: person.id, name: person.fullName, avatarUrl: person.avatarUrl, city: person.city ?? 'Tbilisi' }, pay: l.pay, hours: l.hours, licence: null, applyMethod: 'MESSAGE', applyTarget: null };
};
/** Listings posted in this run (people or clubs), in the job shape already. */
export const postedListings = [];

// ---------------------------------------------------------------- store
// Two kinds of seller: GrassKickZ itself (basic equipment, no club behind it) and the clubs (kit, tickets, membership).
// `sellerKind` and `collection` (what groups GrassKickZ equipment on the storefront) are fields the backend needs
// (docs/claude-sandbox/BACKEND_NEEDS.md, "Store"). Pictures are drawn by media.mjs from the slug before the id.
const pictureFor = (name, category) => {
  const n = name.toLowerCase();
  for (const [word, pic] of [['hoodie', 'hoodie'], ['sock', 'socks'], ['bottle', 'bottle'], ['scarf', 'scarf'], ['cap', 'cap'], ['glove', 'glove'], ['shin', 'shin'], ['bib', 'bib'], ['ball', 'ball'], ['cone', 'cone'], ['marker', 'cone'], ['ladder', 'ladder'], ['goal', 'goal'], ['pump', 'pump'], ['armband', 'armband'], ['first aid', 'aid'], ['shoe', 'boot'], ['boot', 'boot'], ['ticket', 'ticket'], ['membership', 'card'], ['entry', 'ticket'], ['pack', 'pack'], ['shorts', 'shorts'], ['jacket', 'top'], ['top', 'top'], ['shirt', 'shirt']]) if (n.includes(word)) return pic;
  return category === 'SHIRT' ? 'shirt' : category === 'FOOTWEAR' ? 'boot' : category === 'TRAINING' ? 'top' : 'pack';
};
const productPictures = (id, name, category) => [`/sandbox-media/product/${pictureFor(name, category)}-${id}.svg`, `/sandbox-media/product/${pictureFor(name, category)}-${id}-b.svg`];
const ownPlan = [
  ['Match ball, size 5', 'EQUIPMENT', 'BALLS', 85, ['Size 5'], 'Thermally bonded match ball for grass and artificial turf. FIFA Quality.'],
  ['Training ball, size 4', 'EQUIPMENT', 'BALLS', 48, ['Size 4'], 'Durable machine-stitched ball for U10–U14 sessions.'],
  ['Futsal ball, size 4', 'EQUIPMENT', 'BALLS', 62, ['Size 4'], 'Low-bounce ball for indoor halls.'],
  ['Training ball bag, 10 balls', 'EQUIPMENT', 'BALLS', 390, ['10 × size 4', '10 × size 5'], 'Ten training balls in a mesh carry bag.'],
  ['Training cones, set of 50', 'EQUIPMENT', 'CONES', 42, ['Set of 50'], 'Mixed colours, 23 cm, with a carry stand.'],
  ['Flat markers, set of 40', 'EQUIPMENT', 'CONES', 24, ['Set of 40'], 'Four colours, flexible rubber, with a carrier.'],
  ['Agility ladder, 6 m', 'EQUIPMENT', 'CONES', 38, ['6 m'], 'Flat rungs with adjustable spacing.'],
  ['Training bibs, set of 10', 'EQUIPMENT', 'BIBS', 68, ['Junior', 'Senior'], 'Breathable mesh bibs. Choose the colour when you order.'],
  ['Shin guards', 'EQUIPMENT', 'SHIN_GUARDS', 32, ['XS', 'S', 'M', 'L'], 'Lightweight shell with ankle sleeves.'],
  ['Goalkeeper gloves', 'EQUIPMENT', 'GLOVES', 88, ['6', '7', '8', '9', '10'], 'Latex palm with finger protection.'],
  ['Pop-up goals, pair', 'EQUIPMENT', 'GOALS', 120, ['1.2 m', '1.8 m'], 'Fold flat, for small-sided games.'],
  ['Training top', 'TRAINING', 'TRAINING_WEAR', 58, ['XS', 'S', 'M', 'L', 'XL'], 'Quarter-zip training top in GrassKickZ green.'],
  ['Training shorts', 'TRAINING', 'TRAINING_WEAR', 35, ['XS', 'S', 'M', 'L', 'XL'], 'Lightweight shorts with a zip pocket.'],
  ['Water bottle carrier, 8 bottles', 'ACCESSORIES', 'ACCESSORIES', 55, ['8 bottles'], 'Eight 750 ml bottles in a carrier.'],
  ['Ball pump with needles', 'ACCESSORIES', 'ACCESSORIES', 14, ['One size'], 'Dual-action pump with two spare needles.'],
  ['Captain’s armband', 'ACCESSORIES', 'ACCESSORIES', 9, ['Junior', 'Senior'], 'Elastic armband; club colours on request.'],
  ['Touchline first aid kit', 'ACCESSORIES', 'ACCESSORIES', 45, ['One size'], 'Ice packs, tape and bandages in a belt bag.'],
];
const ownProducts = ownPlan.map(([name, category, collection, price, sizes, description], i) => {
  const id = 1201 + i;
  return { id, currency: 'GEL', version: 1, clubId: null, clubName: 'GrassKickZ', clubLogoUrl: '/brand/grasskickz-mark.svg', clubWhatsappNumber: null, clubEmail: 'shop@grasskickz.ge', sellerKind: 'GRASSKICKZ', collection,
    name, description, price, sizes, images: productPictures(id, name, category), active: true, createdAt: iso(day(-((i * 5) % 23) - 2)), category, clubCityName: null, clubCountryName: null,
    variants: sizes.map((label, k) => ({ id: id * 10 + k, label, stock: i === 3 ? 0 : (i + k) % 7 === 4 ? 2 : 6 + ((i * 5 + k) % 20) })) };
});
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
const clubProducts = productPlan.map(([clubId, name, category, price, sizes, description], i) => {
  const c = clubById(clubId), id = 1101 + i;
  return { id, currency: 'GEL', version: 1, clubId, clubName: c.name, clubLogoUrl: c.logoUrl, clubWhatsappNumber: `+995 599 ${String(20 + clubId).padStart(2, '0')} ${String(30 + i).padStart(2, '0')} 11`, clubEmail: `shop@${c.short.toLowerCase()}.ge`, sellerKind: 'CLUB', collection: null,
    name, description, price, sizes, images: productPictures(id, name, category), active: true, createdAt: iso(day(-i * 3 - 1)), category, clubCityName: c.city, clubCountryName: 'Georgia',
    variants: sizes.map((label, k) => ({ id: id * 10 + k, label, stock: (i + k) % 5 === 0 ? 0 : 3 + ((i * 7 + k) % 12) })) };
});
export const products = [...clubProducts, ...ownProducts];
/** A product's pictures for one a club adds in the sandbox (the backend stores uploads). */
export const picturesFor = productPictures;
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
// Donations are taken on GoFundMe (the club pastes its page); GrassKickZ shows the fundraiser and sends supporters there.
// `donateUrl` and `donations` are fields the backend needs (docs/claude-sandbox/BACKEND_NEEDS.md, "Fundraising").
campaigns.forEach((c, i) => { c.donateUrl = i === 2 ? null : `https://www.gofundme.com/f/${c.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`; c.donations = Math.round(c.reportedAmount / (35 + (i * 7) % 40)); });
export const campaignById = id => campaigns.find(c => c.id === Number(id));
