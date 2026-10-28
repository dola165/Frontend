// Club-domain data for the sandbox: memberships, applications, squads, the club workspace
// (operations records, staff appointments, roles) and admissions. Built on world.mjs and
// deterministic; mutations from the club handlers change these structures in memory.
import * as W from './world.mjs';
// The football domain owns public tryouts, roles, admission groups, the store and campaigns;
// the club workspace manages the same records so public pages and management stay in step.
import * as F from './world-football.mjs';
import * as S from './world-social.mjs';
export { F };

const { day, iso, isoDate, personById, clubById, squadById, venueById } = W;

// Own generator so this module's data never depends on the import order of other domains.
let seed = 1925;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = list => list[Math.floor(rnd() * list.length)];
const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));

let counter = 90000;
export const nextId = () => ++counter;
export const date = offset => isoDate(day(offset));
export const at = (offset, hour = 12, minute = 0) => iso(day(offset, hour, minute));
export const nowIso = () => new Date().toISOString();

export const CLUB_ID = 1;
export const ME = 1;
export const TIMEZONE = 'Asia/Tbilisi';
export const club = clubById(CLUB_ID);
export const name = id => personById(id)?.fullName ?? `Member #${id}`;
/** Adds a person referenced by club records (applicants, invitees) when the shared world lacks them. */
export function ensurePerson({ id, first, last, ...rest }) {
  const existing = personById(id) ?? W.people.find(p => p.fullName === `${first} ${last}`);
  if (existing) return existing;
  const p = { id, firstName: first, lastName: last, fullName: `${first} ${last}`, username: `${first}.${last}`.toLowerCase(), gender: 'MALE', city: 'Tbilisi', clubId: null, position: null, avatarUrl: `/sandbox-media/avatar/${id}.svg`, role: 'PLAYER', ...rest };
  W.people.push(p); return p;
}

// ---------------------------------------------------------------- positions & ages
export const POSITION_CODE = { GK: 'GOALKEEPER', RB: 'RIGHT_BACK', CB: 'CENTER_BACK', LB: 'LEFT_BACK', DM: 'DEFENSIVE_MIDFIELDER', CM: 'CENTRAL_MIDFIELDER', AM: 'ATTACKING_MIDFIELDER', RW: 'RIGHT_WINGER', LW: 'LEFT_WINGER', ST: 'STRIKER' };
export const ROSTER_GROUP = { GK: 'Goalkeepers', RB: 'Defenders', CB: 'Defenders', LB: 'Defenders', DM: 'Midfielders', CM: 'Midfielders', AM: 'Midfielders', RW: 'Forwards', LW: 'Forwards', ST: 'Forwards' };
// One date of birth for the whole sandbox (world-social loads first and owns it).
export const birthDate = p => p ? S.birthDate(p) : null;
export const ageOf = p => p ? S.ageOf(p) : null;
export const ageGroupFor = p => { const a = ageOf(p); if (a == null) return null; if (a >= 19) return 'SENIOR'; for (const g of [8, 10, 12, 14, 16, 18, 19]) if (a < g) return `U${g}`; return 'SENIOR'; };

// ---------------------------------------------------------------- squads & players
export const squads = W.squads.filter(s => s.clubId === CLUB_ID);
export const squadName = id => squadById(id)?.name ?? null;
export const SQUAD_SEASON = { 101: 'Tbilisi Community League', 102: 'GFF U12 Youth League', 103: 'GFF U14 Youth League', 104: 'GFF U14 Youth League', 105: 'GFF U16 Youth League', 106: 'GFF U16 Youth League', 107: 'GFF U18 Youth League', 108: 'GFF U19 Development League' };
/** player id -> squad ids at club 1 (Dinamo Youth A shares six U18 players). */
export const playerSquads = new Map();
for (const sq of squads) for (const id of sq.playerIds) playerSquads.set(id, [...(playerSquads.get(id) ?? []), sq.id]);
export const playerIds = [...playerSquads.keys()];
export const primarySquad = id => playerSquads.get(id)?.[0] ?? null;
export const isMinor = p => (ageOf(p) ?? 30) < 18;
export const guardianOf = childId => W.parents.find(l => l.childId === childId)?.parentId ?? null;
export const childrenOf = parentId => W.parents.filter(l => l.parentId === parentId).map(l => l.childId);
const squadPlayers = id => squadById(id)?.playerIds.map(personById) ?? [];
export const U14 = squadPlayers(103), U16 = squadPlayers(105), U18 = squadPlayers(107), FIRST = squadPlayers(101), U12 = squadPlayers(102), U14G = squadPlayers(104), U16G = squadPlayers(106);

// ---------------------------------------------------------------- staff
export const staffIds = W.staff.filter(s => s.clubId === CLUB_ID).map(s => s.personId);
export const staffTitle = id => W.staff.find(s => s.personId === id)?.title ?? null;
const staffBy = title => W.staff.find(s => s.clubId === CLUB_ID && s.title === title)?.personId;
export const STAFF = {
  headOfCoaching: ME, headCoach: staffBy('Head coach'), assistant: staffBy('Assistant coach'), goalkeeper: staffBy('Goalkeeper coach'),
  fitness: staffBy('Fitness coach'), analyst: staffBy('Performance analyst'), nutritionist: staffBy('Nutritionist'), physio: staffBy('Physiotherapist'),
  psychologist: staffBy('Sports psychologist'), director: staffBy('Academy director'), teamManager: staffBy('Team manager'), kit: staffBy('Kit manager'),
  welfare: staffBy('Welfare officer'), scout: staffBy('Scout'), youthCoach: staffBy('Youth coach'),
};
const independents = W.people.filter(p => p.role === 'SPECIALIST' && !p.clubId);
const independent = profession => independents.find(p => p.profession === profession)?.id;
export const EXTERNAL = { psychologist: independent('Sports psychologist'), physio: independent('Physiotherapist'), analyst: independent('Video analyst'), photographer: independent('Football photographer'), nutritionist: independent('Sports nutritionist'), strength: independent('Strength & conditioning coach'), lawyer: independent('Sports lawyer'), doctor: independent('Team doctor') };

/** Management memberships (the legacy club role model). Specialists hold appointments only. */
export const members = [
  { userId: ME, role: 'OWNER', publicTitle: 'Head of Coaching', clubBio: 'Leads the academy coaching programme from U12 to the reserve team. Former Dinamo youth player.', qualifications: 'UEFA A licence · GFF Youth Diploma', isPublic: true },
  { userId: STAFF.director, role: 'CLUB_ADMIN', publicTitle: 'Academy director', clubBio: 'Responsible for academy operations, admissions and partnerships with schools.', qualifications: 'MSc Sports Management', isPublic: true },
  { userId: STAFF.teamManager, role: 'CLUB_ADMIN', publicTitle: 'Team manager', clubBio: 'Match-day logistics, travel and competition registration.', qualifications: null, isPublic: true },
  { userId: STAFF.headCoach, role: 'COACH', publicTitle: 'Head coach · First Team', clubBio: null, qualifications: 'UEFA A licence', isPublic: true },
  { userId: STAFF.assistant, role: 'COACH', publicTitle: 'Assistant coach · U18 & Youth A', clubBio: null, qualifications: 'UEFA B licence', isPublic: true },
  { userId: STAFF.goalkeeper, role: 'COACH', publicTitle: 'Goalkeeper coach', clubBio: 'Works with every academy goalkeeper twice a week.', qualifications: 'UEFA Goalkeeper B', isPublic: true },
  { userId: STAFF.fitness, role: 'COACH', publicTitle: 'Fitness coach', clubBio: null, qualifications: 'BSc Sports Science', isPublic: true },
  { userId: STAFF.analyst, role: 'COACH', publicTitle: 'Performance analyst', clubBio: null, qualifications: null, isPublic: true },
  { userId: STAFF.scout, role: 'COACH', publicTitle: 'Scout', clubBio: null, qualifications: null, isPublic: false },
  { userId: STAFF.youthCoach, role: 'COACH', publicTitle: 'Youth coach · U16 Girls', clubBio: 'Coaches the U16 girls and the Saturday development group.', qualifications: 'UEFA C licence', isPublic: true },
];
export const memberRole = userId => members.find(m => m.userId === userId)?.role ?? null;

// ---------------------------------------------------------------- club profile extras
export const honours = {
  1: [
    { id: 11, title: 'GFF U17 Championship', yearWon: 2025, description: 'Unbeaten through the final round in Tbilisi.' },
    { id: 12, title: 'GFF U15 Cup', yearWon: 2024, description: 'Won 2–1 against Saburtalo Youth FC in the final.' },
    { id: 13, title: 'Tbilisi Youth Festival — Fair Play Award', yearWon: 2024, description: null },
    { id: 14, title: 'GFF U19 Championship', yearWon: 2022, description: null },
    { id: 15, title: 'Academy of the Year (GFF Awards)', yearWon: 2021, description: 'For player development and the number of graduates reaching senior football.' },
  ],
  2: [{ id: 21, title: 'Erovnuli Liga', yearWon: 2022, description: null }, { id: 22, title: 'Georgian Super Cup', yearWon: 2021, description: null }],
  3: [{ id: 31, title: 'Tbilisi Grassroots Festival — Best Organised Club', yearWon: 2025, description: null }],
  4: [{ id: 41, title: 'GFF U14 Cup runners-up', yearWon: 2025, description: null }],
  11: [{ id: 111, title: 'Imereti Youth League U16', yearWon: 2025, description: null }],
};
export const contacts = {
  1: { email: 'academy@dinamo-academy.ge', websiteUrl: 'https://dinamo-academy.ge', instagramUrl: 'https://instagram.com/dinamo.academy', whatsappNumber: '+995 32 224 11 25', preferredCommunicationMethod: 'EMAIL' },
  3: { email: 'hello@riverside-academy.ge', websiteUrl: 'https://riverside-academy.ge', instagramUrl: 'https://instagram.com/riverside.academy', whatsappNumber: '+995 599 41 22 18', preferredCommunicationMethod: 'WHATSAPP' },
};
const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export const followerCounts = Object.fromEntries(W.clubs.map(c => [c.id, c.id === 1 ? 2416 : c.id === 2 ? 18940 : 90 + hash(c.name) % 900]));
export const followed = new Set([1, 2, 3, 5, 11]);
const policyMap = { APPLICATION: 'APPLICATION_REQUIRED', OPEN_TRIAL: 'OPEN_TRIAL', INVITE_ONLY: 'INVITE_ONLY' };
export const clubPolicy = new Map(W.clubs.map(c => [c.id, policyMap[c.joinPolicy] ?? 'APPLICATION_REQUIRED']));
export const clubEdits = new Map(); // id -> partial profile edits (logo/banner/description)
const levelLabel = { PROFESSIONAL: 'Professional', SEMI_PROFESSIONAL: 'Semi-professional', ACADEMY: 'Youth academy', GRASSROOTS: 'Grassroots', SCHOOL: 'Football school', AMATEUR: 'Amateur' };
const typeLabel = { PROFESSIONAL: 'PROFESSIONAL', SEMI_PROFESSIONAL: 'SEMI_PROFESSIONAL', ACADEMY: 'ACADEMY', GRASSROOTS: 'GRASSROOTS', SCHOOL: 'SCHOOL', AMATEUR: 'AMATEUR' };
/** Clubs created as pages count their own members (the owner, staff who joined, players), never an invented number. */
export const memberCountHooks = new Map(); // club id -> () => count
export const memberCount = id => {
  if (memberCountHooks.has(id)) return memberCountHooks.get(id)();
  if (id === CLUB_ID) return playerIds.length + staffIds.length;
  return W.squads.filter(s => s.clubId === id).reduce((n, s) => n + s.playerIds.length, 0) + 3;
};

// ---------------------------------------------------------------- public presentation (programmes, sponsors, affiliations)
const presentationSeed = id => {
  const c = clubById(id);
  if (id === CLUB_ID) return {
    profileKind: 'ACADEMY', revision: 4,
    programmes: [
      { id: 61, name: 'Foundation (U8–U10)', ageMin: 6, ageMax: 9, sessionsPerWeek: 2, priceType: 'FIXED', amount: '120', currency: 'GEL', billingPeriod: 'MONTH', trialAmount: '0', joiningFee: '50', equipmentFee: '90', details: 'Two sessions a week at Digomi. Training kit included in the equipment fee.', published: true, squadIds: [], validFrom: `${new Date().getFullYear()}-09-01`, validUntil: null },
      { id: 62, name: 'Development (U12–U14)', ageMin: 10, ageMax: 13, sessionsPerWeek: 3, priceType: 'FIXED', amount: '150', currency: 'GEL', billingPeriod: 'MONTH', trialAmount: '0', joiningFee: '50', equipmentFee: '120', details: 'Three sessions a week plus league fixtures on Saturdays.', published: true, squadIds: [102, 103, 104], validFrom: `${new Date().getFullYear()}-09-01`, validUntil: null },
      { id: 63, name: 'Performance (U16–U19)', ageMin: 14, ageMax: 18, sessionsPerWeek: 4, priceType: 'FREE', amount: null, currency: 'GEL', billingPeriod: 'MONTH', trialAmount: null, joiningFee: null, equipmentFee: null, details: 'Selected squads train free of charge. Entry by assessment only.', published: true, squadIds: [105, 106, 107, 108], validFrom: null, validUntil: null },
      { id: 64, name: 'Goalkeeper school', ageMin: 9, ageMax: 16, sessionsPerWeek: 1, priceType: 'FIXED', amount: '60', currency: 'GEL', billingPeriod: 'MONTH', trialAmount: '0', joiningFee: null, equipmentFee: null, details: 'Wednesday evenings in the indoor hall.', published: true, squadIds: [], validFrom: null, validUntil: null },
    ],
    sponsors: [
      { id: 71, name: 'Kartuli Bank', logoUrl: '/sandbox-media/photo/sponsor-kartuli-bank.svg', websiteUrl: 'https://kartuli-bank.ge', organizationId: null, published: true },
      { id: 72, name: 'Borjomi Springs', logoUrl: '/sandbox-media/photo/sponsor-borjomi.svg', websiteUrl: null, organizationId: null, published: true },
      { id: 73, name: 'Tbilisi Sports Clinic', logoUrl: null, websiteUrl: null, organizationId: null, published: true },
    ],
    affiliations: [{ id: 81, clubId: 2, name: 'FC Dinamo Tbilisi', logoUrl: '/sandbox-media/crest/2.svg', profileKind: 'PROFESSIONAL', status: 'ACTIVE', canRespond: false, profileManagementEnabled: false, canManageProfile: false }],
  };
  return {
    profileKind: c.type === 'PROFESSIONAL' || c.type === 'SEMI_PROFESSIONAL' ? 'PROFESSIONAL' : c.type === 'ACADEMY' ? 'ACADEMY' : 'COMMUNITY', revision: 1,
    programmes: c.type === 'PROFESSIONAL' ? [] : [{ id: 600 + id, name: c.type === 'ACADEMY' ? 'Academy training' : 'Weekly sessions', ageMin: c.type === 'AMATEUR' ? 16 : 6, ageMax: c.type === 'AMATEUR' ? null : 16, sessionsPerWeek: 2, priceType: id % 3 === 0 ? 'FREE' : 'FIXED', amount: id % 3 === 0 ? null : String(60 + (id % 5) * 15), currency: 'GEL', billingPeriod: 'MONTH', trialAmount: '0', joiningFee: null, equipmentFee: null, details: null, published: true, squadIds: [], validFrom: null, validUntil: null }],
    sponsors: [], affiliations: id === 2 ? [{ id: 81, clubId: 1, name: 'FC Dinamo Tbilisi Academy', logoUrl: '/sandbox-media/crest/1.svg', profileKind: 'ACADEMY', status: 'ACTIVE', canRespond: false }] : [],
  };
};
export const presentations = new Map(W.clubs.map(c => [c.id, presentationSeed(c.id)]));

export function clubProfile(id) {
  const c = clubById(id); if (!c) return null;
  const mine = id === CLUB_ID;
  const edits = clubEdits.get(id) ?? {};
  const pres = presentations.get(id);
  return {
    id: c.id, name: c.name, description: edits.description ?? c.description, type: typeLabel[c.type] ?? 'OTHER', isOfficial: c.verified, statusLabel: 'Active',
    followerCount: followerCounts[id] + (followed.has(id) && id !== 1 ? 0 : 0), memberCount: memberCount(id), isFollowedByMe: followed.has(id),
    isStaffMember: mine, isMember: mine, myRole: mine ? 'OWNER' : null,
    playerJoinPolicy: clubPolicy.get(id), playerAffiliationStatus: null, relationshipState: mine ? 'ACTIVE' : 'NONE',
    pendingApplicationId: null, pendingApplicationRole: null, pendingApplicationJobId: null,
    addressText: c.address, cityName: c.city, countryName: 'Georgia', logoUrl: edits.logoUrl ?? c.logoUrl, bannerUrl: edits.bannerUrl ?? c.bannerUrl,
    email: contacts[id]?.email ?? null, websiteUrl: contacts[id]?.websiteUrl ?? null, instagramUrl: contacts[id]?.instagramUrl ?? null,
    whatsappNumber: contacts[id]?.whatsappNumber ?? null, facebookMessengerUrl: null, preferredCommunicationMethod: contacts[id]?.preferredCommunicationMethod ?? null,
    foundedYear: c.founded, level: levelLabel[c.type] ?? null, category: c.type, latitude: c.lat, longitude: c.lng,
    trustedByClubs: mine ? [{ clubId: 2, clubName: 'FC Dinamo Tbilisi' }, { clubId: 11, clubName: 'Kutaisi City Academy' }] : [],
    honours: honours[id] ?? [], opportunities: [],
    presentation: pres ? { ...pres, canEdit: mine, canManageAffiliations: mine } : null,
  };
}
export function directoryItem(id) {
  const p = clubProfile(id);
  return { id: p.id, name: p.name, description: p.description, type: p.type, isOfficial: p.isOfficial, followerCount: p.followerCount, memberCount: p.memberCount,
    isFollowedByMe: p.isFollowedByMe, addressText: p.addressText, cityName: p.cityName, countryName: p.countryName, logoUrl: p.logoUrl,
    // As the real directory sends it: the join policy under its own name, membership but no relationship state.
    playerJoinPolicy: p.playerJoinPolicy, isMember: p.isMember, isStaffMember: p.isStaffMember, relationshipState: null,
    latitude: p.latitude, longitude: p.longitude, presentation: p.presentation, foundedYear: p.foundedYear };
}

// ---------------------------------------------------------------- player affiliations
const otherClubYouth = (ageGroup, gender) => W.squads.filter(s => s.clubId !== CLUB_ID && s.ageGroup === ageGroup).flatMap(s => s.playerIds.map(personById)).filter(p => !gender || p.gender === gender);
const consentStatus = (p, i) => !isMinor(p) ? null : i % 11 === 3 ? 'PENDING' : i % 17 === 5 ? 'EXPIRED' : 'CONFIRMED';
export const affiliations = [];
playerIds.forEach((id, i) => {
  const p = personById(id); const minor = isMinor(p); const g = guardianOf(id);
  affiliations.push({ userId: id, status: 'ACTIVE', primary: true, source: i % 5 === 0 ? 'application' : i % 7 === 0 ? 'tryout' : 'invited',
    joinedAt: at(-30 * (1 + (i % 40)) - 10), endedAt: null, position: POSITION_CODE[p.position] ?? null, jerseyNumber: p.shirtNumber ?? null,
    requiresParentalConsent: minor, parentalConsentStatus: consentStatus(p, i), parentalConsentAt: minor && consentStatus(p, i) === 'CONFIRMED' ? at(-200 + i) : null,
    parentEmail: g ? `${personById(g).username.replace(/\d+$/, '')}@mail.ge` : null, trialEndsOn: null });
});
const trialists = [otherClubYouth('U14', 'MALE')[2] ?? otherClubYouth('U14')[2], otherClubYouth('U16')[1], personById(5573) ?? otherClubYouth('U16')[4], otherClubYouth('U12')[3]].filter(Boolean);
export const trialistIds = trialists.map(p => p.id);
trialists.forEach((p, i) => affiliations.push({ userId: p.id, status: 'TRIALIST', primary: false, source: i === 2 ? 'application' : 'tryout', joinedAt: at(-12 + i * 3),
  endedAt: null, position: POSITION_CODE[p.position] ?? null, jerseyNumber: null, requiresParentalConsent: isMinor(p), parentalConsentStatus: isMinor(p) ? (i === 1 ? 'PENDING' : i === 3 ? null : 'CONFIRMED') : null,
  parentalConsentAt: null, parentEmail: isMinor(p) ? `family.${p.lastName.toLowerCase()}@mail.ge` : null, trialEndsOn: date(i === 0 ? -2 : 5 + i * 4) }));
const pastPeople = [5569, 5571, 5572, 5576, 5578, 5570].map(personById).filter(Boolean).concat(otherClubYouth('U16').slice(6, 9));
pastPeople.forEach((p, i) => affiliations.push({ userId: p.id, status: 'PAST', primary: false, source: 'invited', joinedAt: at(-900 - i * 60), endedAt: at(-60 - i * 20),
  position: POSITION_CODE[p.position] ?? null, jerseyNumber: null, requiresParentalConsent: false, parentalConsentStatus: null, parentalConsentAt: null, parentEmail: null, trialEndsOn: null }));
const removedPerson = otherClubYouth('U18')[0] ?? otherClubYouth('SENIOR')[0];
if (removedPerson) affiliations.push({ userId: removedPerson.id, status: 'REMOVED', primary: false, source: 'application', joinedAt: at(-400), endedAt: at(-150), position: POSITION_CODE[removedPerson.position] ?? null, jerseyNumber: null, requiresParentalConsent: false, parentalConsentStatus: null, parentalConsentAt: null, parentEmail: null, trialEndsOn: null });
export const affiliationView = a => { const p = personById(a.userId); return { ...a, fullName: p?.fullName ?? null, username: p?.username ?? null, avatarUrl: p?.avatarUrl ?? null }; };

// ---------------------------------------------------------------- membership applications
const applicant = (p, extra) => ({ userId: p.id, fullName: p.fullName, username: p.username, avatarUrl: p.avatarUrl, age: ageOf(p), preferredFoot: p.preferredFoot ?? 'RIGHT',
  heightCm: 150 + ((p.id * 7) % 40), currentClubName: p.clubId ? clubById(p.clubId)?.name ?? null : null, isMinor: isMinor(p), position: POSITION_CODE[p.position] ?? null, ageGroup: ageGroupFor(p), ...extra });
const appMessages = [
  'I play every weekend for my school team and would love to train with the academy. I can attend all three sessions.',
  'My son has been playing for four years and is ready for a more competitive environment. He is available Monday, Wednesday and Friday.',
  'Left-footed winger, quick and comfortable on both flanks. Happy to attend an assessment session.',
  'Goalkeeper looking for regular coaching. I have played two seasons in the regional league.',
  'We moved to Digomi in the summer and are looking for a club close to home.',
  'Central midfielder. My coach recommended I apply for the U16 assessment.',
];
const u14Applicants = otherClubYouth('U14'), u16Applicants = otherClubYouth('U16'), u12Applicants = otherClubYouth('U12');
export const applications = [
  { id: 8101, ...applicant(u14Applicants[5] ?? u14Applicants[0], {}), role: 'PLAYER', status: 'PENDING', message: appMessages[1], createdAt: at(-1, 19, 20), jobId: null, jobTitle: null, currentConsentStatus: 'PENDING' },
  { id: 8102, ...applicant(u16Applicants[3] ?? u16Applicants[0], {}), role: 'PLAYER', status: 'PENDING', message: appMessages[5], createdAt: at(-2, 17, 5), jobId: null, jobTitle: null, currentConsentStatus: 'CONFIRMED' },
  { id: 8103, ...applicant(u14Applicants[9] ?? u14Applicants[1], {}), role: 'PLAYER', status: 'PENDING', message: appMessages[2], createdAt: at(-3, 10, 40), jobId: null, jobTitle: null, currentConsentStatus: null },
  { id: 8104, ...applicant(personById(5574), {}), role: 'PLAYER', status: 'PENDING', message: 'Centre-back, 18. Two seasons in the regional league and looking to step up to the U19 group.', createdAt: at(-4, 21, 15), jobId: null, jobTitle: null, currentConsentStatus: 'PENDING', currentClubName: null },
  { id: 8105, ...applicant(u12Applicants[6] ?? u12Applicants[0], {}), role: 'PLAYER', status: 'PENDING', message: appMessages[4], createdAt: at(-6, 9, 0), jobId: null, jobTitle: null, currentConsentStatus: 'CONFIRMED' },
  { id: 8106, ...applicant(personById(EXTERNAL.analyst), { position: null, ageGroup: null, preferredFoot: null, heightCm: null, careerHistoryCount: 3 }), role: 'COACH', status: 'PENDING', message: 'Video analyst with four seasons at regional level. I can support the U12 group three evenings a week and I am completing my UEFA C.', createdAt: at(-2, 12, 30), jobId: 401, jobTitle: 'U12 assistant coach', currentConsentStatus: null, isMinor: false },
  { id: 8107, ...applicant(personById(5570), {}), role: 'PLAYER', status: 'DECLINED', message: appMessages[0], createdAt: at(-20), jobId: null, jobTitle: null, currentConsentStatus: null },
  { id: 8108, ...applicant(u16Applicants[7] ?? u16Applicants[2], {}), role: 'PLAYER', status: 'ACCEPTED', message: appMessages[5], createdAt: at(-35), jobId: null, jobTitle: null, currentConsentStatus: 'CONFIRMED' },
  { id: 8109, ...applicant(u14Applicants[11] ?? u14Applicants[2], {}), role: 'PLAYER', status: 'CANCELLED', message: null, createdAt: at(-15), jobId: null, jobTitle: null, currentConsentStatus: null },
].map(a => ({ careerHistoryCount: 1 + (a.userId % 4), ...a }));

// ---------------------------------------------------------------- management invitations
export const invitations = [];
export const invitationView = i => { const p = personById(i.userId); return { ...i, fullName: p?.fullName, username: p?.username, avatarUrl: p?.avatarUrl }; };

// ---------------------------------------------------------------- tryouts (club postings + applicants)
const trials = F.trialList ?? W.trials;
if (!trials.some(t => t.id === 8301)) trials.push(
  { id: 8301, clubId: CLUB_ID, squadName: 'U16 Boys', ageGroup: 'U16', date: day(6, 17), venueId: 202, spots: 20, taken: 13, description: 'Assessment day for players born 2010–2011: technical circuit, small-sided games and an 11v11 half.', position: null },
  { id: 8302, clubId: CLUB_ID, squadName: 'Goalkeepers (U12–U16)', ageGroup: 'U14', date: day(18, 18), venueId: 202, spots: 8, taken: 2, description: 'Specialist session with the academy goalkeeper coach in the indoor hall.', position: 'GOALKEEPER' },
  { id: 8303, clubId: CLUB_ID, squadName: 'U12 Mixed', ageGroup: 'U12', date: day(-75, 11), venueId: 202, spots: 16, taken: 16, description: 'Summer intake for the U12 mixed group.', position: null, status: 'FILLED' });
/** Club postings in the management shape (tryoutId), read from the shared tryout list. */
export const tryoutPostings = () => trials.filter(t => t.clubId === CLUB_ID).map(t => {
  const status = t.status ?? (t.date.getTime() < Date.now() ? 'EXPIRED' : t.taken >= t.spots ? 'FILLED' : 'OPEN');
  return { tryoutId: t.id, clubId: t.clubId, title: t.title ?? `${t.squadName} open trial`, description: t.description, position: t.position ?? null, ageGroup: t.ageGroup, tryoutDate: iso(t.date), deadline: iso(day(Math.round((t.date - Date.now()) / 864e5) - 2, 23, 59)), status };
});
export const addTrial = t => { trials.push(t); return t; };
export const trialById = id => trials.find(t => t.id === Number(id) && t.clubId === CLUB_ID);
const scoreAttrs = i => ({ pace: 55 + (i * 7) % 40, technique: 60 + (i * 11) % 35, vision: 50 + (i * 13) % 45, stamina: 58 + (i * 5) % 38 });
export const tryoutApplicants = [
  ...otherClubYouth('U16').slice(10, 14).map((p, i) => ({ id: 8401 + i, userId: p.id, name: p.fullName, position: POSITION_CODE[p.position], ageGroup: 'U16', status: ['PENDING', 'SHORTLISTED', 'PENDING', 'ACCEPTED'][i], profilePictureUrl: p.avatarUrl, matchScore: 62 + i * 8, attributes: scoreAttrs(i) })),
  ...otherClubYouth('U14', 'FEMALE').concat(U14G.slice(0, 0)).slice(0, 3).map((p, i) => ({ id: 8411 + i, userId: p.id, name: p.fullName, position: POSITION_CODE[p.position], ageGroup: 'U14', status: ['PENDING', 'PENDING', 'DECLINED'][i], profilePictureUrl: p.avatarUrl, matchScore: 55 + i * 9, attributes: scoreAttrs(i + 4) })),
  ...[personById(5573)].filter(Boolean).map(p => ({ id: 8421, userId: p.id, name: p.fullName, position: 'GOALKEEPER', ageGroup: 'U18', status: 'SHORTLISTED', profilePictureUrl: p.avatarUrl, matchScore: 81, attributes: scoreAttrs(9) })),
];

// ---------------------------------------------------------------- jobs
const roleList = F.roleList ?? W.roles;
if (!roleList.some(r => r.id === 8501)) roleList.push(
  { id: 8501, clubId: CLUB_ID, title: 'Match-day volunteers (home fixtures)', kind: 'VOLUNTEER', employment: 'VOLUNTEER', city: 'Tbilisi', posted: day(-9), deadline: day(30), description: 'Help with set-up, the team sheet table and first aid cover at Digomi on Saturday mornings. Training and a club jacket provided.', requirements: [] },
  { id: 8502, clubId: CLUB_ID, title: 'Physiotherapist (part-time)', kind: 'JOB', employment: 'PART_TIME', city: 'Tbilisi', posted: day(-16), deadline: day(21), description: 'Two evenings a week and Saturday fixtures with the academy squads.', requirements: ['Licensed physiotherapist', 'Youth sports experience'] });
const CATEGORY = t => /coach/i.test(t) ? 'COACHING' : /analyst/i.test(t) ? 'FOOTBALL_OPERATIONS' : /physio|medical|doctor/i.test(t) ? 'MEDICAL' : /volunteer|match-day/i.test(t) ? 'MATCHDAY' : /photograph|media/i.test(t) ? 'MEDIA_COMMUNICATIONS' : /driver|kit/i.test(t) ? 'FACILITIES' : 'ADMINISTRATION';
const jobState = new Map(); // id -> { status, version, createdBy } overrides for shared roles
/** Club jobs in the management shape, built from the shared roles list plus club-only drafts and closed posts. */
export const clubOnlyJobs = [
  { id: 8503, version: 3, clubId: CLUB_ID, title: 'Bus driver for away fixtures', description: 'Filled for the season — thank you to everyone who applied.', ageGroup: null, level: null, requiredRole: null, status: 'CLOSED', createdAt: at(-80), createdBy: STAFF.teamManager, applicationCount: 0, category: 'FACILITIES', engagementType: 'PAID' },
];
export const jobs = () => [...roleList.filter(r => r.clubId === CLUB_ID && !jobState.get(r.id)?.deleted).map(r => {
  const base = F.jobView ? F.jobView(r) : { id: r.id, title: r.title, description: r.description };
  const st = jobState.get(r.id) ?? {};
  return { ...base, version: st.version ?? base.version ?? 1, clubId: CLUB_ID, title: st.title ?? base.title, description: st.description ?? base.description, ageGroup: st.ageGroup ?? base.ageGroup ?? null, level: st.level ?? base.level ?? null, requiredRole: st.requiredRole ?? base.requiredRole ?? null,
    category: st.category ?? base.category ?? CATEGORY(r.title), engagementType: st.engagementType ?? base.engagementType ?? (r.kind === 'VOLUNTEER' ? 'VOLUNTEER' : 'PAID'), status: st.status ?? 'OPEN', createdBy: r.id === 409 ? STAFF.director : ME };
}), ...clubOnlyJobs];
export const jobOverride = (id, values) => { const r = roleList.find(x => x.id === id && x.clubId === CLUB_ID); if (!r) return false; jobState.set(id, { ...(jobState.get(id) ?? {}), ...values }); return true; };
export const addRole = r => roleList.push(r);
export const jobApplications = [
  { id: 8106, jobId: 401 },
  { id: 8601, jobId: 401, userId: EXTERNAL.strength, role: 'COACH', status: 'PENDING', message: 'UEFA C (2025). Currently coaching at Vake Football School on Tuesdays and Thursdays.', createdAt: at(-1, 9) },
  { id: 8602, jobId: 8501, userId: W.parents[4]?.parentId, role: 'COACH', status: 'PENDING', message: 'I am a parent in the U12 group and a trained first-aider. Happy to help on Saturdays.', createdAt: at(-4, 20) },
  { id: 8603, jobId: 8501, userId: W.parents[9]?.parentId, role: 'COACH', status: 'PENDING', message: 'Available for home fixtures in October and November.', createdAt: at(-2, 18) },
  { id: 8604, jobId: 8502, userId: EXTERNAL.physio, role: 'COACH', status: 'PENDING', message: 'Licensed physiotherapist, six years with youth and amateur teams.', createdAt: at(-5, 13) },
];

// ---------------------------------------------------------------- player cards (players without accounts)
export const playerCards = [
  { id: 8701, clubId: 1, userId: 908701, fullName: 'Demetre Nozadze', birthYear: new Date().getFullYear() - 11, position: 'CENTRAL_MIDFIELDER', jerseyNumber: 14, photoUrl: null, parentEmail: 'nozadze.family@mail.ge', guardianUserId: null, squadId: 102, claimed: false, registered: false },
  { id: 8702, clubId: 1, userId: 908702, fullName: 'Nutsa Kapanadze', birthYear: new Date().getFullYear() - 13, position: 'STRIKER', jerseyNumber: 9, photoUrl: null, parentEmail: 'n.kapanadze.parent@mail.ge', guardianUserId: null, squadId: 104, claimed: false, registered: false },
  { id: 8704, clubId: 1, userId: 908704, fullName: 'Lazare Abashidze', birthYear: new Date().getFullYear() - 10, position: 'WINGER', jerseyNumber: 7, photoUrl: null, parentEmail: 'abashidze.lazare.family@mail.ge', guardianUserId: null, squadId: 102, claimed: false, registered: false },
  { id: 8705, clubId: 1, userId: 908705, fullName: 'Ana Mamardashvili', birthYear: new Date().getFullYear() - 15, position: 'DEFENDER', jerseyNumber: 4, photoUrl: null, parentEmail: 'mamardashvili.home@mail.ge', guardianUserId: null, squadId: 106, claimed: true, registered: false },
  { id: 8703, clubId: 1, userId: 908703, fullName: 'Andria Bakradze', birthYear: new Date().getFullYear() - 15, position: 'GOALKEEPER', jerseyNumber: 23, photoUrl: null, parentEmail: 'bakradze.home@mail.ge', guardianUserId: null, squadId: 105, claimed: true, registered: false },
];

// ---------------------------------------------------------------- squad details
export const squadPolicies = new Map(squads.map((s, i) => [s.id, { cutoffOn: s.ageGroup === 'SENIOR' ? null : `${new Date().getFullYear()}-01-01`, revision: 1 + (i % 2) }]));
export const squadRoles = new Map(); // `${squad}:${user}` -> { squadRole, jerseyNumber }
squads.forEach(s => { const captain = s.playerIds[Math.min(5, s.playerIds.length - 1)]; if (captain) squadRoles.set(`${s.id}:${captain}`, { squadRole: 'CAPTAIN' }); });

// ================================================================ club operations (workspace modules)
const f = (key, label, type = 'text', required = false, options = []) => ({ key, label, type, required, options });
const money = [f('amount', 'Amount', 'money', true), f('currency', 'Currency', 'currency', true)];
export const definitions = [
  { module: 'STAFF', kind: 'DUTY', label: 'Staff duty', states: ['ASSIGNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'], fields: [f('duty', 'Duty', 'choice', true, ['MATCH_DAY_SUPERVISOR', 'FIRST_AID', 'TRANSPORT', 'KIT', 'GATE_AND_REGISTRATION', 'SESSION_COVER']), f('startsAt', 'Starts', 'datetime', true), f('endsAt', 'Ends', 'datetime'), f('location', 'Location'), f('instructions', 'Instructions', 'textarea'), f('cover', 'Cover arrangements')] },
  { module: 'STAFF', kind: 'STAFF_AVAILABILITY', label: 'Staff availability', states: ['RECORDED', 'ARCHIVED'], fields: [f('availability', 'Availability', 'choice', true, ['AWAY', 'LIMITED', 'AVAILABLE']), f('startsOn', 'From', 'date', true), f('endsOn', 'Until', 'date'), f('cover', 'Cover arrangements'), f('notes', 'Notes', 'textarea')] },
  { module: 'CREDENTIALS', kind: 'CREDENTIAL', label: 'Qualification', states: ['SUBMITTED', 'CLUB_CHECKED', 'ARCHIVED'], fields: [f('credentialType', 'Type', 'choice', true, ['COACHING_LICENCE', 'FIRST_AID', 'SAFEGUARDING', 'POLICE_CHECK', 'MEDICAL_LICENCE', 'REFEREE_LICENCE', 'OTHER']), f('issuer', 'Issued by', 'text', true), f('reference', 'Reference'), f('issuedOn', 'Issued on', 'date'), f('expiresOn', 'Expires on', 'date'), f('evidence', 'Evidence'), f('notes', 'Notes', 'textarea')] },
  { module: 'SPECIALISTS', kind: 'ENGAGEMENT', label: 'Specialist engagement', states: ['PROPOSED', 'APPROVED', 'ACTIVE', 'ENDED'], fields: [f('specialist', 'Specialist', 'text', true), f('service', 'Service', 'choice', true, ['PSYCHOLOGY', 'NUTRITION', 'PHYSIOTHERAPY', 'VIDEO_ANALYSIS', 'STRENGTH_CONDITIONING', 'MEDICAL', 'LEGAL', 'PHOTOGRAPHY', 'OTHER']), f('startsOn', 'Starts', 'date'), f('endsOn', 'Ends', 'date'), f('cost', 'Agreed fee', 'money'), f('currency', 'Currency', 'currency'), f('period', 'Fee basis', 'choice', false, ['SESSION', 'MONTH', 'SEASON', 'ONE_OFF']), f('contact', 'Contact'), f('notes', 'Notes', 'textarea')] },
  { module: 'FACILITIES', kind: 'FACILITY', label: 'Venue or facility', states: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], fields: [f('placeType', 'Location type', 'choice', true, ['VENUE', 'FACILITY']), f('address', 'Address', 'text', true), f('relationship', 'How the club uses it', 'choice', false, ['OWNED', 'RENTED', 'SHARED', 'REGULAR_USE']), f('description', 'Description', 'textarea'), f('venueId', 'Existing venue', 'integer'), f('latitude', 'Entrance latitude', 'latitude'), f('longitude', 'Entrance longitude', 'longitude'), f('photos', 'Photos', 'urls'), f('arrival', 'Arrival & meeting point', 'textarea'), f('transport', 'Parking & transport', 'textarea'), f('accessibility', 'Accessibility', 'textarea'), f('amenities', 'Amenities', 'textarea'), f('whatToBring', 'What to bring', 'textarea'), f('contact', 'Contact at this location'), f('collection', 'Parents & collection', 'textarea')] },
  { module: 'READINESS', kind: 'EMERGENCY_PLAN', label: 'Emergency plan', states: ['DRAFT', 'APPROVED', 'ARCHIVED'], fields: [f('venueId', 'Existing venue', 'integer'), f('emergencyAccess', 'Emergency vehicle access', 'textarea', true), f('nearestHospital', 'Nearest emergency department', 'text', true), f('defibrillator', 'Defibrillator location'), f('firstAidKit', 'First aid kit location'), f('responsible', 'Responsible on site'), f('reviewOn', 'Review on', 'date'), f('notes', 'Notes', 'textarea')] },
  { module: 'READINESS', kind: 'COMPETITION_REQUIREMENTS', label: 'Competition requirements', states: ['DRAFT', 'APPROVED', 'ARCHIVED'], fields: [f('competition', 'Competition', 'text', true), f('organiser', 'Organiser'), f('matchFormat', 'Format', 'choice', false, ['5V5', '7V7', '9V9', '11V11']), f('squadSize', 'Match-day squad size', 'integer'), f('kitRules', 'Kit rules', 'textarea'), f('documents', 'Documents to bring', 'textarea'), f('reference', 'Reference'), f('notes', 'Notes', 'textarea')] },
  { module: 'READINESS', kind: 'MATCH_PREPARATION', label: 'Match preparation', states: ['PLANNED', 'READY', 'COMPLETED'], fields: [f('requirementsReference', 'Competition requirements'), f('meetAt', 'Meet at', 'datetime'), f('kit', 'Kit', 'choice', false, ['HOME', 'AWAY', 'THIRD']), f('officials', 'Officials'), f('checks', 'Pre-match checks', 'textarea'), f('notes', 'Notes', 'textarea')] },
  { module: 'GUARDIANS', kind: 'CONSENT', label: 'Guardian permission', states: ['PENDING', 'GRANTED', 'DECLINED', 'REVOKED'], fields: [f('purpose', 'Purpose', 'choice', true, ['TRAVEL', 'TOURNAMENT', 'OVERNIGHT_STAY', 'PHOTOGRAPHY', 'MEDICAL_TREATMENT', 'OTHER']), f('wording', 'Permission wording', 'textarea', true), f('version', 'Terms version', 'text', true), f('expiresOn', 'Valid until', 'date')] },
  { module: 'GUARDIANS', kind: 'COLLECTION', label: 'Collection authorisation', states: ['PENDING', 'GRANTED', 'DECLINED', 'REVOKED'], fields: [f('collector', 'Authorised collector', 'text', true), f('relationship', 'Relationship to the child', 'text', true), f('contact', 'Contact', 'text', true), f('instructions', 'Instructions', 'textarea'), f('expiresOn', 'Valid until', 'date')] },
  { module: 'GUARDIANS', kind: 'EMERGENCY_CONTACT', label: 'Emergency contact', states: ['RECORDED', 'ARCHIVED'], fields: [f('contactName', 'Name', 'text', true), f('relationship', 'Relationship'), f('phone', 'Phone', 'text', true), f('priority', 'Call order', 'integer', true), f('notes', 'Notes', 'textarea')] },
  { module: 'ATTENDANCE', kind: 'ATTENDANCE', label: 'Attendance and collection', states: ['EXPECTED', 'ARRIVED', 'ABSENT', 'COLLECTED'], fields: [f('absenceReason', 'Absence reason', 'choice', false, ['ILLNESS', 'INJURY', 'SCHOOL', 'FAMILY', 'NOT_GIVEN']), f('collectionReference', 'Collection authorisation'), f('collectedBy', 'Collected by'), f('notes', 'Notes', 'textarea')] },
  { module: 'WELFARE', kind: 'CONCERN', label: 'Welfare concern', states: ['OPEN', 'IN_REVIEW', 'REFERRED', 'CLOSED'], fields: [f('description', 'What happened', 'textarea', true), f('immediateAction', 'Immediate action taken', 'textarea'), f('followUp', 'Follow-up', 'textarea'), f('outcome', 'Outcome', 'textarea')] },
  { module: 'MEDICAL', kind: 'MEDICAL_APPOINTMENT', label: 'Medical appointment', states: ['SCHEDULED', 'ATTENDED', 'CLEARED', 'CANCELLED'], fields: [f('provider', 'Clinician or clinic', 'text', true), f('startsAt', 'Appointment time', 'datetime', true), f('purpose', 'Purpose'), f('clearanceReference', 'Clearance reference'), f('notes', 'Notes', 'textarea')] },
  { module: 'MEDICAL', kind: 'CLINICAL_NOTE', label: 'Clinical note', states: ['RECORDED', 'ARCHIVED'], fields: [f('diagnosis', 'Assessment', 'textarea', true), f('treatment', 'Treatment plan', 'textarea'), f('reviewOn', 'Review on', 'date')] },
  { module: 'AVAILABILITY', kind: 'RESTRICTION', label: 'Participation restriction', states: ['ACTIVE', 'CLEARED', 'ENDED'], fields: [f('restrictions', 'What the player can and cannot do', 'textarea', true), f('startsOn', 'From', 'date', true), f('reviewOn', 'Review on', 'date'), f('issuedBy', 'Advised by'), f('notes', 'Notes', 'textarea')] },
  { module: 'DEVELOPMENT', kind: 'GOAL', label: 'Development goal', states: ['DRAFT', 'AGREED', 'ACHIEVED', 'ARCHIVED'], fields: [f('goal', 'Goal', 'textarea', true), f('measure', 'How progress is assessed', 'textarea'), f('reviewOn', 'Review on', 'date'), f('progress', 'Progress', 'textarea')] },
  { module: 'DEVELOPMENT', kind: 'OBSERVATION', label: 'Coach observation', states: ['DRAFT', 'SHARED', 'ARCHIVED'], fields: [f('observation', 'Observation', 'textarea', true), f('nextSteps', 'Next steps', 'textarea')] },
  { module: 'DEVELOPMENT', kind: 'REVIEW', label: 'Player review', states: ['PLANNED', 'COMPLETED'], fields: [f('reviewOn', 'Review date', 'date', true), f('feedback', 'Player feedback', 'textarea'), f('outcome', 'Agreed outcome', 'textarea')] },
  { module: 'EDUCATION', kind: 'EDUCATION_ABSENCE', label: 'Education absence', states: ['RECORDED', 'ARCHIVED'], fields: [f('reason', 'Reason', 'choice', true, ['EXAMS', 'SCHOOL', 'STUDY', 'OTHER']), f('startsOn', 'First day', 'date', true), f('endsOn', 'Last day', 'date', true), f('notes', 'Scheduling information', 'textarea')] },
  { module: 'EDUCATION', kind: 'EDUCATION_CONTACT', label: 'School contact', states: ['RECORDED', 'ARCHIVED'], fields: [f('school', 'School', 'text', true), f('contactName', 'Contact name'), f('contact', 'Phone or email'), f('purpose', 'Agreed purpose', 'textarea', true)] },
  { module: 'REGISTRATION', kind: 'REGISTRATION', label: 'Registration', states: ['IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'DECLINED'], fields: [f('body', 'Registering body', 'choice', true, ['GFF', 'TBILISI_FOOTBALL_ASSOCIATION', 'SCHOOL_LEAGUE', 'TOURNAMENT_ORGANISER']), f('competition', 'Competition'), f('outstanding', 'Outstanding items', 'textarea'), f('externalReference', 'Registration number'), f('approvalReference', 'Approval reference'), f('notes', 'Notes', 'textarea')] },
  { module: 'EQUIPMENT', kind: 'ASSET', label: 'Club equipment', states: ['AVAILABLE', 'IN_MAINTENANCE', 'RETIRED'], fields: [f('quantity', 'Total quantity', 'integer', true), f('location', 'Storage location'), f('condition', 'Condition', 'choice', false, ['NEW', 'GOOD', 'WORN', 'DAMAGED']), f('supplier', 'Supplier'), f('notes', 'Notes', 'textarea')] },
  { module: 'EQUIPMENT', kind: 'EQUIPMENT_ISSUE', label: 'Equipment issue', states: ['ISSUED', 'RETURNED', 'LOST'], fields: [f('items', 'Items', 'text', true), f('quantity', 'Quantity', 'integer', true), f('size', 'Size'), f('notes', 'Notes', 'textarea')] },
  { module: 'EQUIPMENT', kind: 'MAINTENANCE', label: 'Maintenance', states: ['PLANNED', 'COMPLETED'], fields: [f('work', 'Work needed', 'textarea', true), f('contractor', 'Contractor'), f('cost', 'Estimated cost', 'money'), f('currency', 'Currency', 'currency')] },
  { module: 'FINANCE', kind: 'BUDGET', label: 'Budget', states: ['DRAFT', 'APPROVED', 'CLOSED'], fields: [...money, f('period', 'Period', 'text', true), f('notes', 'Notes', 'textarea')] },
  { module: 'FINANCE', kind: 'PURCHASE', label: 'Purchase request', states: ['DRAFT', 'SUBMITTED', 'APPROVED', 'DECLINED', 'PAID'], fields: [...money, f('payee', 'Supplier', 'text', true), f('purpose', 'Purpose', 'textarea', true), f('notes', 'Notes', 'textarea')] },
  { module: 'FINANCE', kind: 'REIMBURSEMENT', label: 'Expense reimbursement', states: ['SUBMITTED', 'APPROVED', 'DECLINED', 'PAID'], fields: [...money, f('payee', 'Pay to', 'text', true), f('purpose', 'Purpose', 'textarea', true), f('evidence', 'Receipt')] },
  { module: 'FINANCE', kind: 'INSTALMENT', label: 'Membership instalment', states: ['DUE', 'PAID', 'WAIVED'], fields: [...money, f('period', 'Period', 'text', true), f('notes', 'Notes', 'textarea')] },
  { module: 'FINANCE', kind: 'FINANCIAL_SUPPORT', label: 'Financial support', states: ['APPROVED', 'ENDED'], fields: [f('discount', 'Agreed support', 'text', true), f('startsOn', 'From', 'date'), f('endsOn', 'Until', 'date'), f('notes', 'Notes', 'textarea')] },
  { module: 'TRAVEL', kind: 'TRIP', label: 'Trip', states: ['PLANNED', 'CONFIRMED', 'DEPARTED', 'RETURNED', 'CANCELLED'], fields: [f('destination', 'Destination', 'text', true), f('departureAt', 'Departure', 'datetime', true), f('returnAt', 'Return', 'datetime', true), f('transport', 'Transport', 'choice', true, ['COACH', 'MINIBUS', 'CARS', 'TRAIN', 'FLIGHT']), f('meetingPoint', 'Meeting point'), f('permissionReference', 'Guardian permission'), f('cost', 'Cost', 'money'), f('currency', 'Currency', 'currency'), f('notes', 'Notes', 'textarea')] },
  { module: 'TRAVEL', kind: 'PASSENGER', label: 'Passenger', states: ['EXPECTED', 'BOARDED', 'ARRIVED', 'RETURNED'], fields: [f('permissionReference', 'Guardian permission'), f('seat', 'Seat or vehicle'), f('notes', 'Notes', 'textarea')] },
  { module: 'DEPARTURES', kind: 'DEPARTURE', label: 'Player departure', states: ['OPEN', 'COMPLETED'], fields: [f('leavingOn', 'Last day', 'date', true), f('destination', 'Moving to'), f('equipmentReturned', 'Equipment returned', 'choice', false, ['YES', 'NO', 'NOT_APPLICABLE']), f('accessRemoved', 'Access removed', 'choice', false, ['YES', 'NO']), f('notes', 'Notes', 'textarea')] },
];
export const definitionFor = kind => definitions.find(d => d.kind === kind);
export const MODULES = ['STAFF', 'CREDENTIALS', 'SPECIALISTS', 'GUARDIANS', 'ATTENDANCE', 'REGISTRATION', 'DEPARTURES', 'DEVELOPMENT', 'EDUCATION', 'FACILITIES', 'READINESS', 'EQUIPMENT', 'FINANCE', 'TRAVEL', 'AVAILABILITY', 'MEDICAL', 'WELFARE'];
const NEXT = {
  DUTY: { ASSIGNED: ['CONFIRMED', 'CANCELLED'], CONFIRMED: ['COMPLETED', 'CANCELLED'] },
  STAFF_AVAILABILITY: { RECORDED: ['ARCHIVED'] },
  CREDENTIAL: { SUBMITTED: ['CLUB_CHECKED', 'ARCHIVED'], CLUB_CHECKED: ['ARCHIVED'] },
  ENGAGEMENT: { PROPOSED: ['APPROVED', 'ENDED'], APPROVED: ['ACTIVE', 'ENDED'], ACTIVE: ['ENDED'] },
  FACILITY: { DRAFT: ['PUBLISHED', 'ARCHIVED'], PUBLISHED: ['DRAFT', 'ARCHIVED'] },
  EMERGENCY_PLAN: { DRAFT: ['APPROVED'], APPROVED: ['ARCHIVED'] },
  COMPETITION_REQUIREMENTS: { DRAFT: ['APPROVED'], APPROVED: ['ARCHIVED'] },
  MATCH_PREPARATION: { PLANNED: ['READY'], READY: ['COMPLETED'] },
  CONSENT: {}, COLLECTION: {},
  EMERGENCY_CONTACT: { RECORDED: ['ARCHIVED'] },
  ATTENDANCE: { EXPECTED: ['ARRIVED', 'ABSENT'], ARRIVED: ['COLLECTED', 'EXPECTED'], ABSENT: ['EXPECTED'], COLLECTED: ['EXPECTED'] },
  CONCERN: { OPEN: ['IN_REVIEW', 'REFERRED', 'CLOSED'], IN_REVIEW: ['REFERRED', 'CLOSED'], REFERRED: ['CLOSED'] },
  MEDICAL_APPOINTMENT: { SCHEDULED: ['ATTENDED', 'CANCELLED'], ATTENDED: ['CLEARED'] },
  CLINICAL_NOTE: { RECORDED: ['ARCHIVED'] },
  RESTRICTION: { ACTIVE: ['CLEARED', 'ENDED'] },
  GOAL: { DRAFT: ['AGREED', 'ARCHIVED'], AGREED: ['ACHIEVED', 'ARCHIVED'], ACHIEVED: ['ARCHIVED'] },
  OBSERVATION: { DRAFT: ['SHARED', 'ARCHIVED'], SHARED: ['ARCHIVED'] },
  REVIEW: { PLANNED: ['COMPLETED'] },
  EDUCATION_ABSENCE: { RECORDED: ['ARCHIVED'] }, EDUCATION_CONTACT: { RECORDED: ['ARCHIVED'] },
  REGISTRATION: { IN_PROGRESS: ['SUBMITTED'], SUBMITTED: ['APPROVED', 'DECLINED'], DECLINED: ['IN_PROGRESS'] },
  ASSET: { AVAILABLE: ['IN_MAINTENANCE', 'RETIRED'], IN_MAINTENANCE: ['AVAILABLE', 'RETIRED'] },
  EQUIPMENT_ISSUE: { ISSUED: ['RETURNED', 'LOST'] },
  MAINTENANCE: { PLANNED: ['COMPLETED'] },
  BUDGET: { DRAFT: ['APPROVED'], APPROVED: ['CLOSED'] },
  PURCHASE: { DRAFT: ['SUBMITTED'], SUBMITTED: ['APPROVED', 'DECLINED'], APPROVED: ['PAID'] },
  REIMBURSEMENT: { SUBMITTED: ['APPROVED', 'DECLINED'], APPROVED: ['PAID'] },
  INSTALMENT: { DUE: ['PAID', 'WAIVED'] },
  FINANCIAL_SUPPORT: { APPROVED: ['ENDED'] },
  TRIP: { PLANNED: ['CONFIRMED', 'CANCELLED'], CONFIRMED: ['DEPARTED', 'CANCELLED'], DEPARTED: ['RETURNED'] },
  PASSENGER: { EXPECTED: ['BOARDED'], BOARDED: ['ARRIVED'], ARRIVED: ['RETURNED'] },
  DEPARTURE: { OPEN: ['COMPLETED'] },
};
export const transitionsFor = (kind, status) => NEXT[kind]?.[status] ?? [];
const CLOSED = new Set(['COMPLETED', 'CANCELLED', 'ARCHIVED', 'RETURNED', 'PAID', 'CLOSED', 'ENDED', 'DECLINED', 'COLLECTED', 'ACHIEVED', 'CLEARED', 'WAIVED', 'LOST', 'RETIRED', 'REVOKED']);
export const isOpen = r => !CLOSED.has(r.status) && !(r.kind === 'REGISTRATION' && r.status === 'APPROVED') && !(['FACILITY', 'EMERGENCY_PLAN', 'COMPETITION_REQUIREMENTS', 'EMERGENCY_CONTACT', 'EDUCATION_CONTACT', 'CLINICAL_NOTE', 'STAFF_AVAILABILITY', 'EDUCATION_ABSENCE'].includes(r.kind) && !r.due_on && !r.data.reviewOn && !r.data.expiresOn);

// ---------------------------------------------------------------- operation records
export const records = [];
export const history = new Map(); // record id -> History[]
export const documents = new Map(); // record id -> Document[]
let recordSeq = 70000;
export const nextRecordId = () => ++recordSeq;
export function addRecord({ module, kind, title, status, squad = null, subject = null, assigned = null, event = null, session = null, related = null, due = null, data = {}, created = -20, restricted = false, mapPlan = null, by = ME }) {
  const def = definitionFor(kind);
  const r = { id: nextRecordId(), club_id: CLUB_ID, module: module ?? def.module, kind, title, status: status ?? def.states[0], squad_id: squad, subject_user_id: subject, assigned_user_id: assigned,
    event_id: event, session_id: session, related_record_id: related, due_on: due == null ? null : date(due), data, revision: 1 + Math.abs(created % 3), created_at: at(created, 10 + Math.abs(created % 8), 15), updated_at: at(Math.min(-1, created + Math.floor(-created / 3)), 8 + (recordSeq % 11), (recordSeq * 7) % 60), restricted, map_plan_id: mapPlan };
  records.push(r);
  const actor = name(by);
  const h = [{ id: r.id * 10 + 1, action: 'CREATED', from_status: null, to_status: def.states[0], note: null, actor, created_at: r.created_at }];
  if (r.status !== def.states[0]) h.push({ id: r.id * 10 + 2, action: 'STATUS_CHANGED', from_status: def.states[0], to_status: r.status, note: null, actor: name(assigned ?? by), created_at: r.updated_at });
  history.set(r.id, h);
  return r;
}
const nm = p => p.fullName;
const trainingEvents = W.events.filter(e => e.type === 'TRAINING' && e.clubId === CLUB_ID);
export const upcomingSessions = () => trainingEvents.filter(e => e.start.getTime() > Date.now() - 2 * 3600e3 && e.start.getTime() < Date.now() + 14 * 864e5).sort((a, b) => a.start - b.start);
const pastSessions = sq => trainingEvents.filter(e => e.squadId === sq && e.start.getTime() < Date.now()).sort((a, b) => b.start - a.start);
const upcomingMatch = (sq, home) => W.matches.filter(m => m.squadId === sq && m.status === 'SCHEDULED' && (home == null || m.home === home)).sort((a, b) => a.start - b.start)[0];
export const matchTitle = m => m.home ? `${club.name} vs ${m.opponentName}` : `${m.opponentName} vs ${club.name}`;
const daysUntil = d => Math.round((new Date(d).setHours(12) - new Date().setHours(12)) / 864e5);

// --- Facilities (published ones appear on the public profile)
const fac1 = addRecord({ kind: 'FACILITY', title: 'Dinamo Academy Training Centre', status: 'PUBLISHED', assigned: STAFF.teamManager, created: -400, data: { placeType: 'VENUE', address: '12 Digomi Massif, Tbilisi 0159', relationship: 'OWNED', venueId: '202', description: 'Home of the academy: three hybrid-grass pitches, a small-sided pitch and an indoor hall used in winter.', latitude: '41.7631', longitude: '44.7712', arrival: 'Enter through the Digomi gate (Gate 2). Players meet coaches at the blue container next to Pitch 1 fifteen minutes before training.', transport: 'Free parking inside Gate 2. Buses 306 and 335 stop on Digomi Avenue, a five-minute walk.', accessibility: 'Step-free route from Gate 2 to the stand and the accessible toilet beside the changing rooms.', amenities: 'Changing rooms with showers, covered stand for 800, water refill points, physio room, café on match days.', whatToBring: 'Water bottle, shin pads, firm-ground and turf boots, academy training top.', contact: 'Academy office · +995 32 224 11 25', collection: 'Parents collect from the covered stand. Players stay inside the gate until a recorded collector arrives.' } });
const fac2 = addRecord({ kind: 'FACILITY', title: 'Indoor hall (Digomi)', status: 'PUBLISHED', assigned: STAFF.kit, created: -380, related: null, data: { placeType: 'FACILITY', address: '12 Digomi Massif, Tbilisi 0159', relationship: 'OWNED', venueId: '202', description: 'Heated hall with a 40 × 20 m artificial surface used for goalkeeper school and winter sessions.', arrival: 'Use the side door next to the café.', amenities: 'Two changing rooms, seating for 60 parents.', whatToBring: 'Indoor or turf shoes only — no studs.' } });
const fac3 = addRecord({ kind: 'FACILITY', title: 'Saburtalo Training Ground (shared)', status: 'PUBLISHED', assigned: STAFF.teamManager, created: -300, squad: 107, data: { placeType: 'VENUE', address: 'Saburtalo Training Ground, Tbilisi', relationship: 'SHARED', venueId: '207', description: 'Tuesday evening sessions for the U18 Boys while Pitch 1 at Digomi is re-seeded.', arrival: 'Main gate on Pekini Avenue.', transport: 'Metro Delisi, ten minutes on foot.' } });
addRecord({ kind: 'FACILITY', title: 'Strength & conditioning room', status: 'DRAFT', assigned: STAFF.fitness, created: -6, data: { placeType: 'FACILITY', address: '12 Digomi Massif, Tbilisi 0159', relationship: 'OWNED', description: 'New gym for U16–U19 squads, opening after the equipment delivery.', amenities: 'Racks, free weights, bikes, recovery area.' } });
addRecord({ kind: 'FACILITY', title: 'Medical & physio room', status: 'PUBLISHED', assigned: STAFF.physio, created: -350, data: { placeType: 'FACILITY', address: '12 Digomi Massif, Tbilisi 0159', relationship: 'OWNED', description: 'Treatment room beside the changing rooms. Defibrillator on the wall by the door.', accessibility: 'Ground floor, step-free.' } });

// --- Readiness
const plan1 = addRecord({ kind: 'EMERGENCY_PLAN', title: 'Digomi training centre emergency plan', status: 'APPROVED', assigned: STAFF.teamManager, related: fac1.id, created: -150, data: { venueId: '202', emergencyAccess: 'Ambulances use Gate 1 on Digomi Avenue; the gate code is held by the duty coach and the security post.', nearestHospital: 'Tbilisi Central Hospital, 14 minutes by road', defibrillator: 'Physio room door and the stand entrance', firstAidKit: 'Each coach bag; full kit in the physio room', responsible: 'Duty coach, then the team manager', reviewOn: date(12) } });
const plan2 = addRecord({ kind: 'EMERGENCY_PLAN', title: 'Ramaz Shengelia Stadium (away) emergency plan', status: 'DRAFT', assigned: STAFF.teamManager, created: -2, data: { venueId: '209', emergencyAccess: 'Confirm access route with Kutaisi City Academy before travel.', nearestHospital: 'Kutaisi Regional Hospital', firstAidKit: 'Travelling kit with the physio' } });
const reqs = addRecord({ kind: 'COMPETITION_REQUIREMENTS', title: 'GFF Youth League 2026/27 match requirements', status: 'APPROVED', assigned: STAFF.teamManager, created: -60, data: { competition: 'GFF U14–U18 Youth Leagues', organiser: 'Georgian Football Federation', matchFormat: '11V11', squadSize: '18', kitRules: 'Numbered shirts matching the registered team sheet. Goalkeeper colours must differ from both teams.', documents: 'Player passes or ID, team sheet signed by the coach, medical clearance for each player.', reference: 'GFF-YL-2026' } });
const m105 = W.matches.find(m => m.squadId === 105 && m.status === 'SCHEDULED' && !m.home && m.opponentClubId === 11) ?? upcomingMatch(105, false);
const m103 = upcomingMatch(103, false), m101 = upcomingMatch(101, true), m107 = upcomingMatch(107, true);
if (m103) addRecord({ kind: 'MATCH_PREPARATION', title: `U14 Boys at ${clubById(m103.opponentClubId)?.name ?? m103.opponentName}`, status: 'PLANNED', squad: 103, event: m103.id, assigned: ME, related: plan1.id, due: daysUntil(m103.start) - 1, created: -4, data: { requirementsReference: String(reqs.id), meetAt: iso(new Date(m103.start.getTime() - 75 * 60000)), kit: 'AWAY', officials: name(m103.refereeId), checks: 'Player passes · signed team sheet · first aid bag · two sets of bibs' } });
if (m101) addRecord({ kind: 'MATCH_PREPARATION', title: `First Team vs ${m101.opponentName}`, status: 'READY', squad: 101, event: m101.id, assigned: STAFF.teamManager, related: plan1.id, due: daysUntil(m101.start), created: -6, data: { requirementsReference: String(reqs.id), meetAt: iso(new Date(m101.start.getTime() - 90 * 60000)), kit: 'HOME', officials: name(m101.refereeId), checks: 'Pitch 1 lines marked · ball boys from U14 · stewards briefed' } });
if (m107) addRecord({ kind: 'MATCH_PREPARATION', title: `U18 Boys vs ${m107.opponentName}`, status: 'PLANNED', squad: 107, event: m107.id, assigned: STAFF.assistant, related: plan1.id, due: daysUntil(m107.start), created: -3, data: { requirementsReference: String(reqs.id), kit: 'HOME' } });

// --- Credentials
const cred = (person, type, issuer, title, expires, status = 'CLUB_CHECKED', extra = {}) => addRecord({ kind: 'CREDENTIAL', title: `${title} — ${name(person)}`, status, subject: person, assigned: STAFF.director, created: -300 + person % 200, data: { credentialType: type, issuer, reference: `${type.slice(0, 2)}-${100000 + (person * 37) % 899999}`, issuedOn: date(expires - 3 * 365), expiresOn: expires == null ? '' : date(expires), evidence: 'Certificate copy attached', ...extra } });
cred(STAFF.assistant, 'COACHING_LICENCE', 'UEFA / Georgian Football Federation', 'UEFA B licence', 6);
cred(STAFF.teamManager, 'FIRST_AID', 'Georgian Red Cross', 'First aid certificate', -5);
cred(ME, 'COACHING_LICENCE', 'UEFA / Georgian Football Federation', 'UEFA A licence', 640);
cred(ME, 'SAFEGUARDING', 'GFF Safeguarding Programme', 'Child safeguarding certificate', 290);
cred(STAFF.headCoach, 'COACHING_LICENCE', 'UEFA / Georgian Football Federation', 'UEFA A licence', 410);
cred(STAFF.goalkeeper, 'COACHING_LICENCE', 'UEFA / Georgian Football Federation', 'UEFA Goalkeeper B licence', 210);
cred(STAFF.youthCoach, 'COACHING_LICENCE', 'Georgian Football Federation', 'UEFA C licence', 520);
cred(STAFF.youthCoach, 'SAFEGUARDING', 'GFF Safeguarding Programme', 'Child safeguarding certificate', 24);
cred(STAFF.physio, 'MEDICAL_LICENCE', 'Ministry of Health of Georgia', 'Physiotherapy practising licence', 380);
cred(STAFF.welfare, 'SAFEGUARDING', 'GFF Safeguarding Programme', 'Designated safeguarding lead training', 160);
cred(STAFF.fitness, 'FIRST_AID', 'Georgian Red Cross', 'First aid certificate', 95);
cred(STAFF.kit, 'POLICE_CHECK', 'Ministry of Internal Affairs', 'Criminal record check', 330, 'SUBMITTED');
cred(STAFF.scout, 'SAFEGUARDING', 'GFF Safeguarding Programme', 'Child safeguarding certificate', null, 'SUBMITTED', { evidence: 'Awaiting certificate upload' });

// --- Staff duties & availability
const sat = (() => { const d = day(0); return (6 - d.getDay() + 7) % 7 || 7; })();
addRecord({ kind: 'DUTY', title: 'Match-day supervisor · home fixtures', status: 'ASSIGNED', assigned: STAFF.teamManager, due: sat, created: -5, data: { duty: 'MATCH_DAY_SUPERVISOR', startsAt: at(sat, 9, 30), endsAt: at(sat, 15), location: 'Dinamo Academy Training Centre, Gate 2', instructions: 'Open the changing rooms, collect team sheets, brief stewards.' } });
addRecord({ kind: 'DUTY', title: 'First aid cover · U12 and U14 Girls home games', status: 'CONFIRMED', assigned: STAFF.physio, due: 1, created: -7, data: { duty: 'FIRST_AID', startsAt: at(1, 10), endsAt: at(1, 14), location: 'Pitch 2 and Pitch 3' } });
// Today's duty, so Staff shows who is on duty.
addRecord({ kind: 'DUTY', title: 'First aid cover · U14 Boys training', status: 'CONFIRMED', assigned: STAFF.physio, squad: 103, due: 0, created: -2, data: { duty: 'FIRST_AID', startsAt: at(0, 17), endsAt: at(0, 19), location: 'Pitch 1' } });
addRecord({ kind: 'DUTY', title: 'Session cover · U16 Girls Wednesday', status: 'ASSIGNED', squad: 106, assigned: STAFF.fitness, due: 4, created: -2, data: { duty: 'SESSION_COVER', startsAt: at(4, 18), endsAt: at(4, 19, 30), location: 'Pitch 2', cover: `Covering for ${name(STAFF.youthCoach)} (coaching course)` } });
addRecord({ kind: 'DUTY', title: 'Kit check before the Kutaisi trip', status: 'ASSIGNED', squad: 105, assigned: STAFF.kit, due: 8, created: -1, data: { duty: 'KIT', startsAt: at(8, 17), location: 'Kit room' } });
addRecord({ kind: 'STAFF_AVAILABILITY', title: `${name(STAFF.youthCoach)} · UEFA B course`, status: 'RECORDED', assigned: STAFF.youthCoach, due: 3, created: -10, data: { availability: 'AWAY', startsOn: date(3), endsOn: date(5), cover: `${name(STAFF.fitness)} covers U16 Girls` } });
addRecord({ kind: 'STAFF_AVAILABILITY', title: `${name(STAFF.headCoach)} · annual leave`, status: 'RECORDED', assigned: STAFF.headCoach, due: 27, created: -25, data: { availability: 'AWAY', startsOn: date(27), endsOn: date(34), cover: `${name(STAFF.analyst)} leads First Team sessions` } });

// --- Specialists
addRecord({ kind: 'ENGAGEMENT', title: 'Sports psychology workshops (U16–U19)', status: 'ACTIVE', assigned: STAFF.director, created: -70, due: 21, data: { specialist: name(EXTERNAL.psychologist), service: 'PSYCHOLOGY', startsOn: date(-70), endsOn: date(21), cost: '350', currency: 'GEL', period: 'SESSION', contact: `${personById(EXTERNAL.psychologist)?.username}@mail.ge`, notes: 'Monthly group workshops; individual sessions by referral from the welfare officer.' } });
addRecord({ kind: 'ENGAGEMENT', title: 'Match video analysis — First Team', status: 'APPROVED', assigned: STAFF.analyst, squad: 101, created: -12, data: { specialist: name(EXTERNAL.analyst), service: 'VIDEO_ANALYSIS', startsOn: date(2), endsOn: date(120), cost: '900', currency: 'GEL', period: 'MONTH' } });
addRecord({ kind: 'ENGAGEMENT', title: 'Nutrition sessions for parents', status: 'PROPOSED', assigned: STAFF.nutritionist, created: -3, data: { specialist: name(EXTERNAL.nutritionist), service: 'NUTRITION', cost: '200', currency: 'GEL', period: 'SESSION', notes: 'Two evening talks for U12–U14 families in November.' } });
addRecord({ kind: 'ENGAGEMENT', title: 'Season photography', status: 'ENDED', assigned: STAFF.director, created: -200, data: { specialist: name(EXTERNAL.photographer), service: 'PHOTOGRAPHY', startsOn: date(-200), endsOn: date(-40), cost: '1500', currency: 'GEL', period: 'SEASON' } });

// --- Guardians & permissions
const guardianOfP = p => guardianOf(p.id);
const consentWording = 'I give permission for my child to travel with academy staff by club coach to Kutaisi for the U16 fixture, including a packed lunch stop, and to return the same evening. Staff may arrange first aid if needed.';
U16.forEach((p, i) => { const g = guardianOfP(p); if (!g) return; addRecord({ kind: 'CONSENT', title: 'Travel to Kutaisi (U16 away fixture)', status: i < 6 ? 'GRANTED' : i < 9 ? 'PENDING' : 'DECLINED', squad: 105, subject: p.id, assigned: g, due: 7, created: -5, event: m105?.id ?? null, data: { purpose: 'TRAVEL', wording: consentWording, version: 'Kutaisi trip v1', expiresOn: date(10) } }); });
U14.slice(0, 5).forEach((p, i) => { const g = guardianOfP(p); if (!g) return; addRecord({ kind: 'CONSENT', title: 'Photography on club channels (season 2026/27)', status: i === 2 ? 'PENDING' : 'GRANTED', squad: 103, subject: p.id, assigned: g, created: -40, data: { purpose: 'PHOTOGRAPHY', wording: 'Team and match photographs may appear on the academy website and social channels. Names are shown without dates of birth.', version: 'Season 2026', expiresOn: date(260) } }); });
U14.slice(0, 3).forEach((p, i) => { const g = guardianOfP(p); if (!g) return; addRecord({ kind: 'COLLECTION', title: `Collection by ${['grandmother', 'uncle', 'family friend'][i]}`, status: i === 2 ? 'PENDING' : 'GRANTED', squad: 103, subject: p.id, assigned: g, created: -30 + i, data: { collector: `${['Nana', 'Levan', 'Keti'][i]} ${['Beridze', p.lastName, 'Lomidze'][i]}`, relationship: ['Grandmother', 'Uncle', 'Family friend'][i], contact: `+995 5${55 + i} ${10 + i}2 ${30 + i}4 ${70 + i}`, instructions: 'Collect from the covered stand after Monday and Wednesday sessions.', expiresOn: date(180) } }); });
[...U14, ...U16].slice(0, 14).forEach((p, i) => { const g = guardianOfP(p); if (!g) return; addRecord({ kind: 'EMERGENCY_CONTACT', title: `${name(g)} (parent)`, status: 'RECORDED', squad: primarySquad(p.id), subject: p.id, created: -200 + i, data: { contactName: name(g), relationship: personById(g)?.gender === 'FEMALE' ? 'Mother' : 'Father', phone: `+995 5${90 + (i % 9)} ${20 + i} ${40 + i} ${11 + i}`, priority: '1' } }); });

// --- Attendance (registers for recent sessions)
const ATT = ['COLLECTED', 'COLLECTED', 'COLLECTED', 'ABSENT', 'COLLECTED', 'COLLECTED', 'COLLECTED', 'COLLECTED', 'COLLECTED', 'COLLECTED', 'ABSENT', 'COLLECTED'];
for (const sq of [103, 105]) {
  for (const [n, ev] of pastSessions(sq).slice(0, 2).entries()) {
    squadById(sq).playerIds.forEach((pid, i) => { const status = n === 0 ? ATT[i % ATT.length] : ATT[(i + 3) % ATT.length]; addRecord({ kind: 'ATTENDANCE', title: `${name(pid)} · ${ev.title}`, status, squad: sq, subject: pid, session: ev.id, assigned: ME, created: Math.round((ev.start - Date.now()) / 864e5), data: status === 'ABSENT' ? { absenceReason: i % 2 ? 'SCHOOL' : 'ILLNESS' } : status === 'COLLECTED' ? { collectedBy: name(guardianOf(pid) ?? pid) } : {} }); });
  }
}

// --- Participation restrictions & medical (clinical detail stays in Medical)
const injured = [U16[3], U14[6], FIRST[4], U16G[2]].filter(Boolean);
const restr = [
  ['Hamstring strain — return-to-play plan', 'No sprinting or shooting drills. Light jogging and technical work up to 45 minutes. No match involvement this week.', 3],
  ['Ankle sprain — modified training', 'Ball work and passing drills only. No contact, no jumping. Strapping before every session.', 6],
  ['Concussion protocol — graduated return', 'Stage 3 of 6: non-contact training only. No heading until cleared by the club doctor.', 2],
  ['Growth-related knee pain (Osgood–Schlatter)', 'Limit sessions to 60 minutes; avoid repeated jumping. Ice after training.', 14],
];
injured.forEach((p, i) => addRecord({ kind: 'RESTRICTION', title: restr[i][0], status: 'ACTIVE', squad: primarySquad(p.id), subject: p.id, assigned: STAFF.physio, created: -6 - i * 3, data: { restrictions: restr[i][1], startsOn: date(-6 - i * 3), reviewOn: date(restr[i][2]), issuedBy: name(STAFF.physio) } }));
addRecord({ kind: 'RESTRICTION', title: 'Wrist fracture — no goalkeeping', status: 'CLEARED', squad: 103, subject: U14[0].id, assigned: STAFF.physio, created: -60, data: { restrictions: 'Outfield work only, no diving.', startsOn: date(-60), reviewOn: date(-12), issuedBy: 'Tbilisi Sports Clinic' } });
injured.forEach((p, i) => addRecord({ kind: 'MEDICAL_APPOINTMENT', title: `${['Physio review', 'Physio review', 'Return-to-play assessment', 'Sports medicine consultation'][i]} — ${nm(p)}`, status: 'SCHEDULED', squad: primarySquad(p.id), subject: p.id, assigned: STAFF.physio, due: [1, 4, 2, 9][i], created: -4 - i, data: { provider: i === 2 ? name(EXTERNAL.doctor) : i === 3 ? 'Tbilisi Sports Clinic' : name(STAFF.physio), startsAt: at([1, 4, 2, 9][i], 17, 30), purpose: 'Progress check and training plan update' } }));
injured.slice(0, 3).forEach((p, i) => addRecord({ kind: 'CLINICAL_NOTE', title: `Initial assessment — ${nm(p)}`, status: 'RECORDED', squad: primarySquad(p.id), subject: p.id, assigned: STAFF.physio, created: -6 - i * 3, restricted: true, data: { diagnosis: ['Grade 1 hamstring strain, left leg.', 'Lateral ankle sprain, grade 1–2.', 'Mild concussion after aerial challenge; symptom-free after 72 hours.'][i], treatment: 'Progressive loading programme; reassess at review.', reviewOn: date(restr[i][2]) } }));

// --- Welfare (restricted to the appointed welfare team)
addRecord({ kind: 'CONCERN', title: 'Confidential welfare case', status: 'IN_REVIEW', squad: null, subject: U14G[3]?.id ?? null, assigned: STAFF.welfare, due: 5, created: -9, restricted: true, data: { description: 'Restricted', immediateAction: 'Restricted' } });
addRecord({ kind: 'CONCERN', title: 'Behaviour on the team bus (resolved)', status: 'CLOSED', squad: 107, assigned: STAFF.welfare, created: -45, data: { description: 'Report of name-calling on the return journey from Rustavi.', immediateAction: 'Players separated; parents informed the same evening.', outcome: 'Restorative conversation held; no further incidents.' } });

// --- Development
const goals = ['Use the weaker (left) foot in build-up at least five times per half', 'Scan before receiving: check shoulder twice before each pass in midfield', 'Lead the defensive line — communicate the offside line on every set piece', 'Improve 1v1 defending: stay on the feet and show the attacker outside', 'Finishing: hit the target with 7 of 10 shots in the weekly finishing drill'];
[...U16.slice(0, 6), ...U14.slice(0, 5)].forEach((p, i) => addRecord({ kind: 'GOAL', title: `${['Weaker foot in build-up', 'Scanning before receiving', 'Leading the defensive line', '1v1 defending', 'Finishing accuracy'][i % 5]} — ${p.fullName}`, status: i % 4 === 3 ? 'ACHIEVED' : i % 5 === 1 ? 'DRAFT' : 'AGREED', squad: primarySquad(p.id), subject: p.id, assigned: ME, created: -50 + i * 2, data: { goal: goals[i % goals.length], measure: 'Coach observation in two training sessions and one match per fortnight.', reviewOn: date(7 + i * 3), progress: i % 4 === 3 ? 'Achieved in the last three fixtures.' : 'Clear improvement in training; less consistent under match pressure.' } }));
U16.slice(0, 4).forEach((p, i) => addRecord({ kind: 'OBSERVATION', title: `Observation · ${p.fullName} · ${new Date(day(-2 - i)).toLocaleDateString('en-GB')}`, status: i === 0 ? 'DRAFT' : 'SHARED', squad: 105, subject: p.id, assigned: ME, created: -2 - i, data: { observation: ['Excellent scanning in the rondo; first touch away from pressure every time.', 'Strong in duels but late to recover shape after losing the ball.', 'Leadership visible — organised the press without prompting.', 'Tired after 60 minutes; discuss sleep and hydration with family.'][i], nextSteps: ['Move to the 6 in Wednesday’s game.', 'Transition drill focus on Friday.', 'Captain the side on Saturday.', 'Check in with the fitness coach.'][i] } }));
U14.slice(0, 3).forEach((p, i) => addRecord({ kind: 'REVIEW', title: `Mid-season review — ${p.fullName}`, status: 'PLANNED', squad: 103, subject: p.id, assigned: ME, created: -8, data: { reviewOn: date(7 + i) } }));

// --- Education
addRecord({ kind: 'EDUCATION_ABSENCE', title: `National exams — ${U18[1]?.fullName ?? 'U18 player'}`, status: 'RECORDED', squad: 107, subject: U18[1]?.id ?? null, created: -6, data: { reason: 'EXAMS', startsOn: date(8), endsOn: date(12), notes: 'Can train Friday only during the exam week.' } });
addRecord({ kind: 'EDUCATION_ABSENCE', title: `School trip — ${U14[4]?.fullName}`, status: 'RECORDED', squad: 103, subject: U14[4]?.id ?? null, created: -3, data: { reason: 'SCHOOL', startsOn: date(14), endsOn: date(16) } });
addRecord({ kind: 'EDUCATION_CONTACT', title: 'Public School No. 161 (Digomi)', status: 'RECORDED', created: -120, data: { school: 'Public School No. 161', contactName: 'Eka Lomidze, deputy director', contact: '+995 32 252 16 10', purpose: 'Coordinate exam timetables and match-day absences for academy pupils.' } });

// --- Registration
addRecord({ kind: 'REGISTRATION', title: 'GFF autumn registration — U16 Boys', status: 'SUBMITTED', squad: 105, assigned: STAFF.teamManager, due: 2, created: -12, data: { body: 'GFF', competition: 'GFF U16 Youth League', outstanding: 'Medical certificates for two players; one passport photo.', externalReference: 'GFF-U16-2026-0417' } });
addRecord({ kind: 'REGISTRATION', title: 'GFF autumn registration — U14 Boys', status: 'APPROVED', squad: 103, assigned: STAFF.teamManager, created: -30, data: { body: 'GFF', competition: 'GFF U14 Youth League', externalReference: 'GFF-U14-2026-0233', approvalReference: 'Approval letter 02/10' } });
addRecord({ kind: 'REGISTRATION', title: 'Black Sea Girls Cup entry — U16 Girls', status: 'IN_PROGRESS', squad: 106, assigned: STAFF.youthCoach, due: 18, created: -4, data: { body: 'TOURNAMENT_ORGANISER', competition: 'Black Sea Girls Cup U16', outstanding: 'Entry fee (250 GEL) and squad list.' } });
trialists.slice(0, 2).forEach(p => addRecord({ kind: 'REGISTRATION', title: `Player registration — ${p.fullName}`, status: 'IN_PROGRESS', squad: ageGroupFor(p) === 'U16' ? 105 : 103, subject: p.id, assigned: STAFF.teamManager, due: 10, created: -5, data: { body: 'GFF', outstanding: 'International transfer certificate not required; awaiting birth certificate copy.' } }));

// --- Equipment
const balls = addRecord({ kind: 'ASSET', title: 'Match balls (size 5)', status: 'AVAILABLE', assigned: STAFF.kit, created: -180, data: { quantity: '60', location: 'Kit room, shelf A', condition: 'GOOD', supplier: 'Sportmaster Georgia' } });
const bibs = addRecord({ kind: 'ASSET', title: 'Training bibs (four colours)', status: 'AVAILABLE', assigned: STAFF.kit, created: -240, data: { quantity: '120', location: 'Kit room, crates 1–4', condition: 'WORN' } });
const goalsAsset = addRecord({ kind: 'ASSET', title: 'Portable 5-a-side goals', status: 'IN_MAINTENANCE', assigned: STAFF.kit, created: -500, data: { quantity: '6', location: 'Pitch 3 store', condition: 'DAMAGED', notes: 'Two frames need new nets and wheel brackets.' } });
const gps = addRecord({ kind: 'ASSET', title: 'GPS vests', status: 'AVAILABLE', assigned: STAFF.fitness, created: -90, data: { quantity: '25', location: 'Performance office', condition: 'NEW' } });
addRecord({ kind: 'EQUIPMENT_ISSUE', title: 'Training bibs and cones — U18 Boys', status: 'ISSUED', squad: 107, assigned: STAFF.kit, related: bibs.id, due: -3, created: -20, data: { items: 'Bibs (red and yellow), 40 cones', quantity: '24' } });
addRecord({ kind: 'EQUIPMENT_ISSUE', title: 'Match balls — U16 Boys away kit bag', status: 'ISSUED', squad: 105, assigned: STAFF.kit, related: balls.id, due: 9, created: -2, data: { items: 'Size 5 match balls', quantity: '10' } });
addRecord({ kind: 'EQUIPMENT_ISSUE', title: `GPS vest — ${FIRST[2]?.fullName}`, status: 'ISSUED', squad: 101, subject: FIRST[2]?.id ?? null, assigned: STAFF.fitness, related: gps.id, due: 30, created: -10, data: { items: 'GPS vest', quantity: '1', size: 'M' } });
U14.slice(0, 4).forEach((p, i) => addRecord({ kind: 'EQUIPMENT_ISSUE', title: `Academy training kit — ${p.fullName}`, status: 'ISSUED', squad: 103, subject: p.id, assigned: STAFF.kit, created: -38 + i, data: { items: 'Training top, shorts, socks', quantity: '1', size: ['S', 'M', 'S', 'M'][i] } }));
addRecord({ kind: 'MAINTENANCE', title: 'Repair portable goals (nets and wheels)', status: 'PLANNED', assigned: STAFF.kit, related: goalsAsset.id, due: 6, created: -7, data: { work: 'Replace nets on two frames and fit new wheel brackets.', contractor: 'Gldani Sports Services', cost: '420', currency: 'GEL' } });

// --- Finance (GEL)
addRecord({ kind: 'BUDGET', title: 'Academy operating budget 2026/27', status: 'APPROVED', assigned: STAFF.director, created: -60, data: { amount: '186000', currency: 'GEL', period: 'Season 2026/27', notes: 'Covers staff, travel, equipment and pitch maintenance.' } });
addRecord({ kind: 'BUDGET', title: 'Travel budget — autumn round', status: 'APPROVED', assigned: STAFF.teamManager, created: -40, data: { amount: '9500', currency: 'GEL', period: 'September–December' } });
addRecord({ kind: 'PURCHASE', title: 'Match balls (size 5 × 20)', status: 'SUBMITTED', assigned: STAFF.kit, due: 5, created: -3, data: { amount: '1840', currency: 'GEL', payee: 'Sportmaster Georgia', purpose: 'Replace worn match balls before the winter indoor block.' } });
addRecord({ kind: 'PURCHASE', title: 'Coach hire — Kutaisi away fixture', status: 'APPROVED', squad: 105, assigned: STAFF.teamManager, due: 8, created: -6, data: { amount: '1150', currency: 'GEL', payee: 'Imereti Bus Company', purpose: 'Return coach Tbilisi–Kutaisi for the U16 Boys fixture.' } });
addRecord({ kind: 'PURCHASE', title: 'Gym equipment (S&C room)', status: 'PAID', assigned: STAFF.fitness, created: -30, data: { amount: '7200', currency: 'GEL', payee: 'FitPro Tbilisi', purpose: 'Racks, plates and two bikes for the new strength room.' } });
addRecord({ kind: 'REIMBURSEMENT', title: 'Fuel — scouting visits to Rustavi', status: 'SUBMITTED', assigned: STAFF.scout, created: -4, due: 6, data: { amount: '86.40', currency: 'GEL', payee: name(STAFF.scout), purpose: 'Two scouting visits to Rustavi Community FC fixtures.', evidence: 'Fuel receipts (2)' } });
addRecord({ kind: 'REIMBURSEMENT', title: 'First aid supplies', status: 'PAID', assigned: STAFF.physio, created: -18, data: { amount: '142.00', currency: 'GEL', payee: name(STAFF.physio), purpose: 'Strapping tape and cold packs.', evidence: 'Pharmacy receipt' } });
[...U12.slice(0, 5), ...U14.slice(0, 4)].forEach((p, i) => addRecord({ kind: 'INSTALMENT', title: `October membership — ${p.fullName}`, status: i === 1 || i === 6 ? 'DUE' : 'PAID', squad: primarySquad(p.id), subject: p.id, assigned: STAFF.director, due: i === 1 ? -1 : i === 6 ? 5 : null, created: -15, data: { amount: primarySquad(p.id) === 102 ? '150' : '150', currency: 'GEL', period: 'October 2026' } }));
addRecord({ kind: 'FINANCIAL_SUPPORT', title: `Scholarship — ${U16[7]?.fullName}`, status: 'APPROVED', squad: 105, subject: U16[7]?.id ?? null, assigned: STAFF.director, created: -100, data: { discount: '100% of monthly fees', startsOn: date(-100), endsOn: date(260), notes: 'Academy scholarship for the 2026/27 season.' } });
addRecord({ kind: 'FINANCIAL_SUPPORT', title: `Sibling discount — ${U12[2]?.lastName ?? ''} family`, status: 'APPROVED', squad: 102, subject: U12[2]?.id ?? null, assigned: STAFF.director, created: -80, data: { discount: '25% on the second child', startsOn: date(-80) } });

// --- Travel
const tripDepart = m105 ? new Date(m105.start.getTime() - 4 * 3600e3) : day(9, 6, 30);
const trip = addRecord({ kind: 'TRIP', title: 'U16 Boys to Kutaisi (away fixture)', status: 'PLANNED', squad: 105, event: m105?.id ?? null, assigned: STAFF.teamManager, due: 4, created: -6, data: { destination: 'Ramaz Shengelia Stadium, Kutaisi', departureAt: iso(tripDepart), returnAt: iso(new Date(tripDepart.getTime() + 13 * 3600e3)), transport: 'COACH', meetingPoint: 'Digomi Gate 2 car park', cost: '1150', currency: 'GEL', notes: 'Packed lunch stop in Khashuri. Physio travels with the team.' } });
U16.forEach((p, i) => addRecord({ kind: 'PASSENGER', title: `${p.fullName} · Kutaisi trip`, status: 'EXPECTED', squad: 105, subject: p.id, related: trip.id, created: -5, data: { seat: `Coach seat ${i + 4}` } }));
addRecord({ kind: 'TRIP', title: 'U14 Boys to Saburtalo (local away)', status: 'CONFIRMED', squad: 103, event: m103?.id ?? null, assigned: ME, due: m103 ? daysUntil(m103.start) : 2, created: -5, data: { destination: 'Saburtalo Training Ground, Tbilisi', departureAt: m103 ? iso(new Date(m103.start.getTime() - 90 * 60000)) : at(2, 9), returnAt: m103 ? iso(new Date(m103.start.getTime() + 3 * 3600e3)) : at(2, 14), transport: 'MINIBUS', meetingPoint: 'Digomi Gate 2', cost: '180', currency: 'GEL' } });
addRecord({ kind: 'TRIP', title: 'U18 Boys to Rustavi', status: 'RETURNED', squad: 107, assigned: STAFF.assistant, created: -14, data: { destination: 'Rustavi Community Pitches', departureAt: at(-13, 8), returnAt: at(-13, 15), transport: 'MINIBUS', cost: '220', currency: 'GEL' } });

// --- Departures
addRecord({ kind: 'DEPARTURE', title: `${U18[9]?.fullName ?? 'U18 player'} — family moving to Batumi`, status: 'OPEN', squad: 107, subject: U18[9]?.id ?? null, assigned: STAFF.director, due: 14, created: -3, data: { leavingOn: date(14), destination: 'Batumi Seaside FC (trial arranged)', equipmentReturned: 'NO', accessRemoved: 'NO' } });
addRecord({ kind: 'DEPARTURE', title: `${name(5571)} — released at end of contract`, status: 'COMPLETED', squad: 101, subject: 5571, assigned: STAFF.director, created: -60, data: { leavingOn: date(-60), destination: 'Free agent', equipmentReturned: 'YES', accessRemoved: 'YES' } });

// Documents for a few records
for (const r of records.filter(r => ['CREDENTIAL', 'REGISTRATION', 'PURCHASE', 'REIMBURSEMENT'].includes(r.kind)).slice(0, 18)) documents.set(r.id, [{ id: r.id * 10 + 7, file_name: `${r.kind.toLowerCase()}-${r.id}.pdf`, bytes: 84000 + (r.id % 7) * 21000, created_at: r.created_at }]);

export const attentionDate = r => r.data.expiresOn || r.data.reviewOn || r.due_on || null;

// ---------------------------------------------------------------- settings
export const settings = { setting: 'CLUB_ACADEMY', playing_level: 'MIXED', currency: 'GEL', country_code: 'GE', timezone: TIMEZONE, legal_name: 'Dinamo Tbilisi Football Academy LLC', registration_reference: '404 563 918', enabled_modules: [...MODULES], revision: 6 };

// ---------------------------------------------------------------- staff appointments
const all = (access, mods) => mods.map(m => `${m}:${access}`);
export const SPECIALISATIONS = ['HEAD_COACH', 'ASSISTANT_COACH', 'GOALKEEPER_COACH', 'FITNESS_COACH', 'PERFORMANCE_ANALYST', 'NUTRITIONIST', 'PHYSIOTHERAPIST', 'DOCTOR', 'PSYCHOLOGIST', 'WELFARE_OFFICER', 'TEAM_MANAGER', 'KIT_MANAGER', 'CLUB_SECRETARY', 'SCOUT', 'REFEREE', 'DRIVER', 'OTHER'];
const coachPerms = [...all('WRITE', ['ATTENDANCE', 'DEVELOPMENT', 'READINESS']), ...all('READ', ['AVAILABILITY', 'GUARDIANS', 'EDUCATION', 'EQUIPMENT', 'TRAVEL'])];
// Head coaches also read their squads' registration (V231, 28 October 2026).
const headCoachPerms = [...coachPerms, 'REGISTRATION:READ'];
let apptSeq = 7100;
export const appointments = [];
export function addAppointment({ user, title, specialisations, squads: sq = [], engagement = 'EMPLOYEE', permissions = [], starts = -400, ends = null, status = 'ACTIVE', published = true, expires = null, provenance = 'CLUB_APPOINTMENT' }) {
  if (status !== 'ACTIVE') published = false;
  const a = { id: ++apptSeq, club_id: CLUB_ID, club_name: club.name, user_id: user, name: name(user), title, specialisations, engagement, permissions,
    squad_id: sq[0] ?? null, squad_name: sq[0] ? squadName(sq[0]) : null, squad_ids: sq, squad_names: sq.map(squadName), club_wide: !sq.length,
    starts_on: typeof starts === 'number' ? date(starts) : starts, ends_on: ends == null ? null : date(ends), status, revision: 1 + (user % 3), published, timezone: TIMEZONE,
    expires_at: expires == null ? undefined : at(expires, 23, 59), provenance, unavailable_reason: null };
  appointments.push(a); return a;
}
export const myCoaching = addAppointment({ user: ME, title: 'Head of Coaching · U14 & U16 Boys', specialisations: ['HEAD_COACH'], squads: [103, 105], permissions: headCoachPerms, starts: -760 });
addAppointment({ user: STAFF.headCoach, title: 'Head coach · First Team', specialisations: ['HEAD_COACH'], squads: [101], permissions: headCoachPerms, starts: -540 });
addAppointment({ user: STAFF.assistant, title: 'Assistant coach · U18 & Youth A', specialisations: ['ASSISTANT_COACH'], squads: [107, 108], permissions: coachPerms, starts: -300 });
addAppointment({ user: STAFF.goalkeeper, title: 'Goalkeeper coach · U12 Mixed lead', specialisations: ['GOALKEEPER_COACH', 'HEAD_COACH'], squads: [102, 103, 104, 105, 106, 107], permissions: coachPerms, starts: -420, engagement: 'CONTRACTOR' });
addAppointment({ user: STAFF.fitness, title: 'Fitness coach', specialisations: ['FITNESS_COACH'], squads: [], permissions: [...all('WRITE', ['DEVELOPMENT', 'EQUIPMENT']), ...all('READ', ['AVAILABILITY', 'ATTENDANCE'])], starts: -365 });
addAppointment({ user: STAFF.analyst, title: 'Performance analyst · First Team & U14 Girls', specialisations: ['PERFORMANCE_ANALYST', 'HEAD_COACH'], squads: [101, 104], permissions: coachPerms, starts: -200 });
addAppointment({ user: STAFF.nutritionist, title: 'Nutritionist', specialisations: ['NUTRITIONIST'], squads: [], engagement: 'CONTRACTOR', permissions: all('READ', ['DEVELOPMENT', 'AVAILABILITY']), starts: -344, ends: 21, published: false });
addAppointment({ user: STAFF.physio, title: 'Physiotherapist', specialisations: ['PHYSIOTHERAPIST'], squads: [], permissions: [...all('WRITE', ['MEDICAL', 'AVAILABILITY']), ...all('READ', ['ATTENDANCE', 'GUARDIANS'])], starts: -610 });
addAppointment({ user: STAFF.psychologist, title: 'Sports psychologist', specialisations: ['PSYCHOLOGIST'], squads: [105, 106, 107, 108], engagement: 'CONTRACTOR', permissions: [...all('READ', ['WELFARE', 'DEVELOPMENT'])], starts: -150 });
addAppointment({ user: STAFF.director, title: 'Academy director', specialisations: ['CLUB_SECRETARY'], squads: [], permissions: all('WRITE', ['STAFF', 'CREDENTIALS', 'REGISTRATION', 'FINANCE', 'DEPARTURES', 'SPECIALISTS', 'EDUCATION']), starts: -900 });
addAppointment({ user: STAFF.teamManager, title: 'Team manager · competitions & travel', specialisations: ['TEAM_MANAGER'], squads: [], permissions: all('WRITE', ['TRAVEL', 'READINESS', 'REGISTRATION', 'FACILITIES', 'EQUIPMENT']), starts: -720 });
addAppointment({ user: STAFF.kit, title: 'Kit manager', specialisations: ['KIT_MANAGER'], squads: [], permissions: all('WRITE', ['EQUIPMENT']), starts: -260 });
addAppointment({ user: STAFF.welfare, title: 'Welfare officer (designated safeguarding lead)', specialisations: ['WELFARE_OFFICER'], squads: [], permissions: [...all('WRITE', ['WELFARE', 'GUARDIANS']), ...all('READ', ['ATTENDANCE', 'EDUCATION'])], starts: -480, published: false });
addAppointment({ user: STAFF.scout, title: 'Scout · Tbilisi & Kvemo Kartli', specialisations: ['SCOUT'], squads: [], engagement: 'VOLUNTEER', permissions: [], starts: -120, published: false });
addAppointment({ user: STAFF.youthCoach, title: 'Youth coach · U16 Girls', specialisations: ['HEAD_COACH'], squads: [106], permissions: coachPerms, starts: -330, ends: -1 , status: 'ENDED' });
addAppointment({ user: STAFF.youthCoach, title: 'Youth coach · U16 Girls', specialisations: ['HEAD_COACH'], squads: [106], permissions: coachPerms, starts: 0, status: 'INVITED', expires: 9 }).id = 6301;
addAppointment({ user: EXTERNAL.strength, title: 'Strength & conditioning coach · U16–U19', specialisations: ['FITNESS_COACH'], squads: [105, 106, 107, 108], engagement: 'CONTRACTOR', permissions: [...all('WRITE', ['DEVELOPMENT']), ...all('READ', ['AVAILABILITY'])], starts: 7, status: 'INVITED', published: false, expires: 11 });
addAppointment({ user: EXTERNAL.physio, title: 'Physiotherapist (match days)', specialisations: ['PHYSIOTHERAPIST'], squads: [], engagement: 'CONTRACTOR', permissions: all('WRITE', ['MEDICAL']), starts: -500, ends: -70, status: 'ENDED', published: false });
addAppointment({ user: W.referees[1].id, title: 'Club referee · friendlies', specialisations: ['REFEREE'], squads: [], engagement: 'CONTRACTOR', permissions: all('READ', ['FACILITIES']), starts: -90 });
// A second club referee, for the younger squads' 7- and 9-a-side friendlies (volunteer or paid).
addAppointment({ user: W.referees[2].id, title: 'Club referee · U12–U14 friendlies', specialisations: ['REFEREE'], squads: [102, 103, 104], engagement: 'VOLUNTEER', permissions: all('READ', ['FACILITIES']), starts: -45 });
export const activeStaffIds = () => [...new Set([...staffIds, ...appointments.filter(a => a.status === 'ACTIVE' && staffIds.includes(a.user_id)).map(a => a.user_id)])];

// ---------------------------------------------------------------- workspace roles (catalog, views, requests)
export const catalog = [
  { family: 'Coaching', key: 'HEAD_COACH', title: 'Squad head coach', description: 'Runs training and matches for the selected squads: attendance, development and match preparation.', permissions: coachPerms },
  { family: 'Coaching', key: 'ASSISTANT_COACH', title: 'Assistant coach', description: 'Supports the head coach with sessions, registers and observations.', permissions: [...all('WRITE', ['ATTENDANCE', 'DEVELOPMENT']), ...all('READ', ['AVAILABILITY', 'READINESS'])] },
  { family: 'Coaching', key: 'GOALKEEPER_COACH', title: 'Goalkeeper coach', description: 'Specialist sessions and development notes for goalkeepers in the selected squads.', permissions: [...all('WRITE', ['DEVELOPMENT']), ...all('READ', ['ATTENDANCE', 'AVAILABILITY'])] },
  { family: 'Coaching', key: 'FITNESS_COACH', title: 'Fitness coach', description: 'Physical development, load monitoring and equipment for conditioning.', permissions: [...all('WRITE', ['DEVELOPMENT', 'EQUIPMENT']), ...all('READ', ['AVAILABILITY'])] },
  { family: 'Coaching', key: 'PERFORMANCE_ANALYST', title: 'Performance analyst', description: 'Match analysis and development reviews for the selected squads.', permissions: [...all('WRITE', ['DEVELOPMENT']), ...all('READ', ['READINESS'])] },
  { family: 'Medical & care', key: 'PHYSIOTHERAPIST', title: 'Physiotherapist', description: 'Medical coordination and participation restrictions. Clinical notes stay in the restricted medical record.', permissions: [...all('WRITE', ['MEDICAL', 'AVAILABILITY']), ...all('READ', ['ATTENDANCE'])] },
  { family: 'Medical & care', key: 'DOCTOR', title: 'Club doctor', description: 'Clinical records, clearances and restrictions.', permissions: all('WRITE', ['MEDICAL', 'AVAILABILITY']) },
  { family: 'Medical & care', key: 'PSYCHOLOGIST', title: 'Sports psychologist', description: 'Workshops and referrals; read access to welfare follow-ups assigned to them.', permissions: all('READ', ['WELFARE', 'DEVELOPMENT']) },
  { family: 'Medical & care', key: 'WELFARE_OFFICER', title: 'Welfare officer', description: 'Confidential concerns, guardian permissions and collection arrangements.', permissions: [...all('WRITE', ['WELFARE', 'GUARDIANS']), ...all('READ', ['ATTENDANCE', 'EDUCATION'])] },
  { family: 'Operations', key: 'TEAM_MANAGER', title: 'Team manager', description: 'Competition registration, match preparation, equipment and travel.', permissions: all('WRITE', ['TRAVEL', 'READINESS', 'REGISTRATION', 'EQUIPMENT']) },
  { family: 'Operations', key: 'TRAVEL_COORDINATOR', title: 'Travel coordinator', description: 'Trips, passenger lists and guardian travel permissions.', permissions: [...all('WRITE', ['TRAVEL']), ...all('READ', ['GUARDIANS'])] },
  { family: 'Operations', key: 'KIT_MANAGER', title: 'Kit manager', description: 'Club inventory, issues and returns.', permissions: all('WRITE', ['EQUIPMENT']) },
  { family: 'Operations', key: 'FACILITIES_COORDINATOR', title: 'Facilities coordinator', description: 'Venues, facilities and emergency plans.', permissions: all('WRITE', ['FACILITIES', 'READINESS']) },
  { family: 'Administration', key: 'CLUB_SECRETARY', title: 'Club secretary', description: 'Staff records, credentials, registration and finance administration.', permissions: all('WRITE', ['STAFF', 'CREDENTIALS', 'REGISTRATION', 'FINANCE']) },
  { family: 'Administration', key: 'REFEREE', title: 'Club referee', description: 'Receives match invitations for club friendlies in the referee workspace.', permissions: all('READ', ['FACILITIES']) },
];
let reqSeq = 7300;
export const roleRequests = [
  { id: ++reqSeq, user_id: STAFF.youthCoach, role_key: 'ASSISTANT_COACH', squad_ids: [104], note: 'I can help Tako with the U14 Girls on Mondays while the U16 Girls do gym work.', status: 'PENDING', created: -2 },
  { id: 6401, user_id: STAFF.teamManager, role_key: 'TRAVEL_COORDINATOR', squad_ids: [], note: 'Access to travel planning so I can build the passenger lists for the Kutaisi trip.', status: 'PENDING', created: -6 },
  { id: ++reqSeq, user_id: STAFF.fitness, role_key: 'FITNESS_COACH', squad_ids: [105, 107], note: null, status: 'APPROVED', review_note: 'Approved — thanks Ketevan.', created: -40 },
  { id: ++reqSeq, user_id: ME, role_key: 'HEAD_COACH', squad_ids: [103, 105], note: 'Taking the U14 and U16 Boys for the new season alongside the head of coaching role.', status: 'APPROVED', review_note: 'Approved by the academy director.', created: -48 },
  { id: ++reqSeq, user_id: STAFF.kit, role_key: 'FACILITIES_COORDINATOR', squad_ids: [], note: 'To keep the facility pages up to date.', status: 'DECLINED', review_note: 'Beka already covers facilities; let’s revisit in January.', created: -25 },
].map(r => ({ ...r, revision: 1, replace_appointment_id: null, review_note: r.review_note ?? null }));
export const roleRequestView = r => ({ ...r, name: name(r.user_id), squad_id: r.squad_ids[0] ?? null, squad_name: r.squad_ids[0] ? squadName(r.squad_ids[0]) : null, squad_names: r.squad_ids.map(squadName), clubWide: !r.squad_ids.length,
  permissions: catalog.find(c => c.key === r.role_key)?.permissions ?? [], effective_status: r.status, unavailable_reason: null, created_at: at(r.created) });

// ---------------------------------------------------------------- agent approaches (player-approved introductions)
const approach = (id, agent, player, scope, status, message, created, updated, version = 1) => ({ id, clubId: CLUB_ID, clubName: club.name, agentId: agent.id, agentName: agent.fullName, playerId: player, playerName: name(player), scope, status, version, message, createdAt: at(created, 11), updatedAt: at(updated, 15),
  allowedActions: status === 'PENDING_CLUB' ? ['ACCEPT', 'DECLINE'] : status === 'ACTIVE' ? ['END'] : [] });
export const approaches = [
  approach(9601, W.agents[0], 5574, 'TRIAL', 'PENDING_CLUB', 'Luka is a strong centre-back looking for a U19 environment. He is available for a trial week in November.', -3, -1, 2),
  approach(9602, W.agents[2], 5575, 'INFORMATION', 'PENDING_CLUB', 'Barbare plays right wing and is interested in the U16 Girls programme for next season.', -6, -6),
  approach(9604, W.agents[3], 5572, 'TRIAL', 'ACTIVE', 'Nikoloz is training with the reserve group for two weeks with the player’s agreement.', -15, -9, 3),
  approach(9603, W.agents[1], 5569, 'TRANSFER', 'DECLINED', 'Introduction for a senior winger.', -40, -35, 3),
];
export const approachMessages = new Map([
  [9601, [{ id: 96011, authorId: W.agents[0].id, authorName: W.agents[0].fullName, kind: 'MESSAGE', body: 'Happy to send match footage from the regional league.', createdAt: at(-3, 11, 5) }, { id: 96012, authorId: ME, authorName: name(ME), kind: 'MESSAGE', body: 'Thank you — please send two full matches. We will discuss with the U19 coach on Monday.', createdAt: at(-1, 15) }]],
  [9602, [{ id: 96021, authorId: W.agents[2].id, authorName: W.agents[2].fullName, kind: 'MESSAGE', body: 'Barbare can attend the U14 Girls trial on the 21st if helpful.', createdAt: at(-6, 10, 5) }]],
  [9603, []],
  [9604, [{ id: 96041, authorId: ME, authorName: name(ME), kind: 'MESSAGE', body: 'Nikoloz trains Monday and Wednesday with the Youth A group. Review on Friday.', createdAt: at(-9, 16) }]],
]);

// ---------------------------------------------------------------- store & campaigns (management views)
// Published products and campaigns live in the football domain's catalogue; the club keeps
// unpublished drafts here until they are activated.
export const products = F.products ?? [];
if (!products.some(p => p.id === 9805)) products.push({ id: 9805, currency: 'GEL', version: 1, clubId: CLUB_ID, clubName: club.name, clubLogoUrl: club.logoUrl, clubWhatsappNumber: '+995 32 224 11 25', clubEmail: 'shop@dta.ge', name: 'Winter match jacket', description: 'Padded touchline jacket in academy blue. Pre-orders open in November.', price: 160, sizes: ['YM', 'YL', 'S', 'M'], images: [], active: false, createdAt: at(-4), category: 'TRAINING', clubCityName: 'Tbilisi', clubCountryName: 'Georgia', variants: ['YM', 'YL', 'S', 'M'].map((label, i) => ({ id: 98050 + i, label, stock: 0 })) });
export const clubProducts = () => products.filter(p => p.clubId === CLUB_ID);
export const campaigns = F.campaigns ?? [];
const draftCampaign = { id: 9904, clubId: CLUB_ID, clubName: club.name, clubLogoUrl: club.logoUrl, country: 'Georgia', city: 'Tbilisi', title: 'Girls’ football kit bank', summary: 'Boots and shin pads for girls joining the academy.', description: 'A kit bank so no girl misses the U14 Girls trial because of equipment.', beneficiary: 'New U14 and U16 Girls players', useOfFunds: 'Boots in all sizes, shin pads and training socks.', category: 'YOUTH', currency: 'GEL', goalAmount: 2500, reportedAmount: null, reportedNote: '', reportedAt: null, startsOn: null, endsOn: null, images: [], status: 'DRAFT', phase: 'DRAFT', version: 1, updatedAt: at(-1), publishedAt: null, updates: [] };
if (!campaigns.some(c => c.id === 9904)) campaigns.push(draftCampaign);
export const clubCampaigns = () => campaigns.filter(c => c.clubId === CLUB_ID);

// ---------------------------------------------------------------- items other domains refer to
// The social domain's club notifications and request centre point at these records by id.
const davit = ensurePerson({ id: 6911, first: 'Davit', last: 'Kvirikashvili', birthYear: 2012, position: 'CM', clubId: 4, headline: 'Central midfielder · Saburtalo Youth FC' });
const elene = ensurePerson({ id: 6912, first: 'Elene', last: 'Jishkariani', gender: 'FEMALE', birthYear: 2013, position: 'LW', clubId: 6, headline: 'Winger · Gldani Juniors' });
const irakli = ensurePerson({ id: 6913, first: 'Irakli', last: 'Gorgadze', role: 'COACH', birthYear: 1994, headline: 'Youth coach · UEFA C (in progress)' });
const tamaz = ensurePerson({ id: 6914, first: 'Tamaz', last: 'Kharaishvili', role: 'COACH', birthYear: 1990, headline: 'Goalkeeper coach' });
tamaz.licences = ['UEFA Goalkeeper B licence'];
const bolkvadze = ensurePerson({ id: 6915, first: 'Giorgi', last: 'Bolkvadze', birthYear: 2012, position: 'RB', clubId: 1, headline: 'Right back · FC Dinamo Tbilisi Academy' });
applications.unshift({ id: 6101, ...applicant(davit, {}), ageGroup: 'U14', role: 'PLAYER', status: 'PENDING', message: 'Davit has played three seasons at Saburtalo and wants to join the U14 Boys. He is available for all three weekly sessions.', createdAt: new Date(Date.now() - 38 * 60000).toISOString(), jobId: null, jobTitle: null, currentConsentStatus: 'PENDING', careerHistoryCount: 2 });
if (personById(30)) applications.push({ id: 6102, ...applicant(personById(30), {}), ageGroup: 'U16', role: 'PLAYER', status: 'ACCEPTED', message: 'Saba is a left-footed striker looking for a stronger league.', createdAt: at(-61, 18), jobId: null, jobTitle: null, currentConsentStatus: 'CONFIRMED', careerHistoryCount: 2, currentClubName: null });
tryoutApplicants.unshift({ id: 6201, userId: elene.id, name: elene.fullName, position: 'LEFT_WINGER', ageGroup: 'U14', status: 'PENDING', profilePictureUrl: elene.avatarUrl, matchScore: 77, attributes: scoreAttrs(12) });
invitations.unshift({ id: 6801, userId: irakli.id, role: 'COACH', status: 'PENDING', createdAt: at(-2, 21), expiresAt: at(12, 21) });
invitations.push({ id: 6802, userId: tamaz.id, role: 'COACH', status: 'DECLINED', createdAt: at(-26), expiresAt: at(-12) });
affiliations.push({ userId: bolkvadze.id, status: 'TRIALIST', primary: false, source: 'invited', joinedAt: at(-2, 10), endedAt: null, position: 'RIGHT_BACK', jerseyNumber: null, requiresParentalConsent: true, parentalConsentStatus: 'PENDING', parentalConsentAt: null, parentEmail: 'bolkvadze.family@mail.ge', trialEndsOn: date(19) });
trialistIds.push(bolkvadze.id);

// ================================================================ admissions (joining arrangements)
const sharedGroups = F.admissionGroups ?? [];
export const ORG_ID = sharedGroups.find(g => g.clubId === CLUB_ID)?.organizationId ?? 1;
const loc = { name: 'Dinamo Academy Training Centre', address: '12 Digomi Massif, Tbilisi 0159', latitude: 41.7631, longitude: 44.7712 };
const year = new Date().getFullYear();
const clubGroup = (id, name, squadId, method, availability, capacity, remaining, from, to, gender, level, schedule, fee, positions = []) => ({ id, version: 2, organizationId: ORG_ID, organizationName: club.name, clubId: CLUB_ID, name, squadId,
  intake: '2026-27', method, visibility: 'PUBLIC', published: true, intakeOpen: true, capacity, beginnerWelcome: level === 'BEGINNER', birthYearFrom: from, birthYearTo: to, referenceDate: `${year}-09-01`, gender, location: loc, schedule, timezone: TIMEZONE,
  terms: { feesKnown: true, charges: fee ? [{ label: 'Training fee', amount: fee, currency: 'GEL', frequency: 'monthly' }] : [], cancellation: 'One month’s notice to the club office. No refund for the current month.', participation: 'Attend agreed sessions with a registered emergency contact.', startDate: date(2), endDate: null, affiliationEffect: level === 'ADVANCED' ? 'PRIMARY_CHANGE' : 'NONE', requirements: level === 'ADVANCED' ? ['EMERGENCY_CONTACT', 'CURRENT_CLUB_PERMISSION'] : ['EMERGENCY_CONTACT'] },
  responsibleUserId: ME, waitlistEnabled: true, availability, remainingPlaces: remaining, destination: `/admissions/opportunities/${id}`, canManage: true, extraApprovalRequired: method === 'SELECTIVE', decisionUserId: method === 'SELECTIVE' ? ME : null, city: 'Tbilisi', country: 'GE', level, positions, verified: true });
if (!sharedGroups.some(g => g.id === 1391)) sharedGroups.push(
  clubGroup(1391, 'U16 Boys — performance squad', 105, 'SELECTIVE', 'APPLICATIONS_OPEN', 20, 1, year - 16, year - 15, 'MALE', 'ADVANCED', 'Mon, Wed, Fri 18:00–19:30', 0),
  clubGroup(1392, 'Goalkeeper school', null, 'DIRECT', 'WAITLIST', 10, 0, year - 16, year - 9, 'ANY', 'INTERMEDIATE', 'Wed 19:30–20:30 (indoor hall)', 60, ['GOALKEEPER']));
const groupResponsible = { 1301: STAFF.goalkeeper, 1302: STAFF.goalkeeper, 1303: STAFF.analyst, 1391: ME, 1392: STAFF.goalkeeper };
/** The academy's joining groups, as published in admissions discovery. */
export const admissionGroups = () => sharedGroups.filter(g => g.clubId === CLUB_ID).map(g => { const { verified, ...rest } = g; void verified; return { ...rest, responsibleUserId: groupResponsible[g.id] ?? rest.responsibleUserId ?? ME, canManage: true }; });
const groupNamed = re => sharedGroups.find(g => g.clubId === CLUB_ID && re.test(g.name));
const g10 = groupNamed(/Beginners/) ?? sharedGroups.find(g => g.id === 1392), g12 = groupNamed(/U12/) ?? g10, g14g = groupNamed(/U14 Girls/) ?? g12, g16 = sharedGroups.find(g => g.id === 1391), ggk = sharedGroups.find(g => g.id === 1392);
const kids = [...W.squads.filter(s => [6, 7, 14].includes(s.clubId) && ['U10', 'U12'].includes(s.ageGroup)).flatMap(s => s.playerIds), ...W.squads.filter(s => [3, 4].includes(s.clubId) && ['U14', 'U16'].includes(s.ageGroup)).flatMap(s => s.playerIds)].map(personById);
const usedKids = new Set([...trialistIds, ...applications.map(a => a.userId)]);
const kid = (age, gender) => kids.find(p => !usedKids.has(p.id) && (ageOf(p) === age || ageOf(p) === age + 1) && (!gender || p.gender === gender)) ?? kids.find(p => !usedKids.has(p.id) && (!gender || p.gender === gender));
const useKid = (age, gender) => { const p = kid(age, gender); usedKids.add(p.id); return p; };
const ev = (id, action, message, actor, created) => ({ id, action, message, actorName: actor, createdAt: at(created, 10 + (id % 8)) });
let caseSeq = 1200;
const mkCase = (p, g, stage, next, extra = {}) => {
  const id = ++caseSeq, guardian = guardianOf(p.id), family = guardian ? name(guardian) : `${p.firstName}’s family`;
  return { id, version: extra.version ?? 3, playerId: p.id, playerName: p.fullName, dateOfBirth: birthDate(p), organizationId: ORG_ID, organizationName: club.name, clubId: CLUB_ID, groupId: g.id, groupName: g.name,
    intake: g.intake, method: g.method, stage, responsible: { id: groupResponsible[g.id] ?? g.responsibleUserId ?? ME, name: name(groupResponsible[g.id] ?? g.responsibleUserId ?? ME) }, nextAction: next, requirements: extra.requirements ?? [], sessions: extra.sessions ?? [], offer: extra.offer ?? null,
    enrollment: extra.enrollment ?? null, history: extra.history ?? [ev(id * 10 + 1, 'SUBMITTED', extra.message ?? 'Request received through the club profile.', family, extra.submitted ?? -6)],
    actions: extra.actions ?? ['MESSAGE', 'ASSIGN', 'INVITE_SESSION', 'OFFER', 'WAITLIST', 'DECLINE'], primaryAffiliation: p.clubId && p.clubId !== CLUB_ID ? { clubId: p.clubId, clubName: clubById(p.clubId).name } : null,
    previousCaseId: null, submittedAt: at(extra.submitted ?? -6, 19), updatedAt: at(extra.updated ?? -1, 12), assessments: extra.assessments ?? [], siblingConstraint: extra.sibling ?? null };
};
const sessionDetails = (title, offset, hour, extra = {}) => ({ id: nextId(), version: 1, title, startsAt: at(offset, hour), endsAt: at(offset, hour + 1, 30), timezone: TIMEZONE, location: loc, contact: `${name(extra.contact ?? STAFF.goalkeeper)} · +995 599 12 44 70`,
  preparation: 'Boots for grass, shin pads, water bottle. Arrive 15 minutes early at Gate 2.', cost: 'Free', capacity: 6, responseDeadline: at(offset - 1, 20), squadSessionId: null, noRegularPlaceGuaranteed: true, emergencyContact: extra.emergency ?? null, status: extra.status ?? 'INVITED' });
export const admissionCases = [
  mkCase(useKid(11), g12, 'REQUEST_RECEIVED', { code: 'CLUB_REVIEW', owner: 'CLUB', label: 'Review the request and arrange the next step', dueAt: at(1, 18) }, { submitted: -1, message: 'Our child has played two seasons at a school club and loves training. Could we join a session before deciding?' }),
  mkCase(useKid(13, 'FEMALE'), g14g, 'ARRANGING_PARTICIPATION', { code: 'ARRANGE_SESSION', owner: 'APPLICANT', label: 'Family to confirm the assessment session', dueAt: at(9, 20) }, { submitted: -5, sessions: [{ ...sessionDetails('U14 Girls assessment', 11, 16, { contact: STAFF.analyst }), squadSessionId: trainingEvents.find(e => e.squadId === 104 && e.start.getTime() > Date.now() + 864e5)?.id ?? null }] }),
  mkCase(useKid(15, 'MALE'), g16, 'INTRODUCTION_ASSESSMENT', { code: 'REVIEW_PARTICIPATION', owner: 'CLUB', label: 'Record the assessment outcome', dueAt: at(7, 12) }, { submitted: -9, sessions: [sessionDetails('U16 Boys assessment day', 6, 17, { contact: ME, status: 'CONFIRMED', emergency: 'Mother · +995 577 21 33 90' })],
    assessments: [{ id: 1301, kind: 'ASSESS', groupId: g16.id, note: 'Strong 1v1 defender, good recovery pace. Needs to see him in an 11v11 game.', actorName: name(STAFF.scout), createdAt: at(-4) }] }),
  mkCase(useKid(11), g12, 'PLACE_OFFERED', { code: 'RESPOND_OFFER', owner: 'APPLICANT', label: 'Family to accept or decline the place', dueAt: at(5, 23) }, { submitted: -14, offer: { id: 1401, version: 1, groupId: g12.id, groupName: g12.name, terms: g12.terms, location: loc, schedule: g12.schedule, status: 'PENDING', responseDeadline: at(5, 23), completionDeadline: at(12, 23) }, actions: ['MESSAGE', 'WITHDRAW_OFFER', 'EXTEND_OFFER'] }),
  mkCase(useKid(9), g10, 'COMPLETING_ENROLLMENT', { code: 'COMPLETE_REQUIREMENTS', owner: 'CLUB', label: 'Confirm the first payment', dueAt: at(3, 18) }, { submitted: -20, offer: { id: 1402, version: 2, groupId: g10.id, groupName: g10.name, terms: g10.terms, location: loc, schedule: g10.schedule, status: 'ACCEPTED', responseDeadline: at(-6), completionDeadline: at(4, 23) },
    requirements: [{ id: 1501, kind: 'EMERGENCY_CONTACT', owner: 'APPLICANT', status: 'COMPLETE', evidence: 'Father · +995 599 40 22 18' }, { id: 1502, kind: 'PAYMENT_CONFIRMATION', owner: 'CLUB', status: 'PENDING', evidence: null, canComplete: true }], actions: ['MESSAGE', 'COMPLETE_REQUIREMENT', 'CANCEL_ENROLLMENT'] }),
  mkCase(useKid(12), ggk, 'WAITLIST', { code: 'WAIT_FOR_PLACE', owner: 'NONE', label: 'Waiting for a place in the group', dueAt: null }, { submitted: -25, actions: ['MESSAGE', 'OFFER', 'DECLINE'] }),
  mkCase(useKid(11), g12, 'ENROLLED', { code: 'ENROLLED', owner: 'NONE', label: 'Enrolled', dueAt: null }, { submitted: -40, enrollment: { id: 1601, groupId: g12.id, groupName: g12.name, startDate: date(-21), endDate: null, status: 'ACTIVE', matchEligibility: 'NOT_GRANTED', scheduleDestination: '/calendar', squadId: 102, rosterDestination: '/clubs/1/workspace?tab=squads&squad=102' }, actions: ['MESSAGE', 'CANCEL_ENROLLMENT'] }),
  mkCase(useKid(15, 'MALE'), g16, 'CLOSED', { code: 'CLOSED', owner: 'NONE', label: 'Closed', dueAt: null }, { submitted: -50, actions: [] }),
];
const inquiryChild = useKid(12, 'FEMALE');
export const admissionInquiries = [
  { id: 1701, version: 1, playerId: inquiryChild?.id ?? null, playerName: inquiryChild?.fullName ?? null, organizationId: ORG_ID, organizationName: club.name, status: 'OPEN', groupId: ggk.id, programmeId: 64, squadId: null,
    message: 'My daughter is 12 and plays in goal at school. Is there a trial for the goalkeeper school, and do you provide gloves?', caseId: null, actions: ['MESSAGE', 'ROUTE', 'RESOLVE', 'DECLINE'],
    nextAction: { code: 'CLUB_REPLY', owner: 'CLUB', label: 'Reply to the family', dueAt: at(1, 18) }, history: [ev(17011, 'SUBMITTED', null, 'Family', -1)], createdAt: at(-1, 20), updatedAt: at(-1, 20), conversationDestination: null },
  { id: 1702, version: 2, playerId: null, playerName: null, organizationId: ORG_ID, organizationName: club.name, status: 'OPEN', groupId: null, programmeId: 61, squadId: null,
    message: 'Do you have Saturday morning sessions for six-year-olds? We live in Saburtalo.', caseId: null, actions: ['MESSAGE', 'RESOLVE', 'DECLINE', 'REQUEST_SETUP'],
    nextAction: { code: 'CLUB_REPLY', owner: 'CLUB', label: 'Reply to the family', dueAt: at(2, 18) }, history: [ev(17021, 'SUBMITTED', null, 'Family', -2)], createdAt: at(-2, 9), updatedAt: at(-2, 9), conversationDestination: null },
];
export const admissionSessions = () => W.events.filter(e => e.type === 'TRAINING' && e.clubId === CLUB_ID && e.start.getTime() > Date.now() && e.start.getTime() < Date.now() + 21 * 864e5)
  .map(e => ({ id: e.id, squadId: e.squadId, title: `${squadName(e.squadId)} · ${e.title}`, startsAt: iso(e.start), endsAt: iso(e.end), location: `${venueById(e.venueId)?.name} · ${e.pitch}`, revision: 1 }));

// ================================================================ club organization (activities, venue relationships)
export const organization = {
  id: ORG_ID, displayName: club.name, organizationType: 'CLUB', identityRevision: 3, clubId: CLUB_ID, membershipRole: 'OWNER', canManage: true, promotionBlocked: false,
  activities: { enabledActivities: ['PROFILE', 'VENUE', 'TOURNAMENT'], revision: 4 },
  venueRelationships: [
    { relationshipId: 9501, id: 202, relationship: 'OWNS', source: 'CLUB_RECORD', revision: 2, published: true },
    { relationshipId: 9502, id: 207, relationship: 'OPERATES', source: 'AGREEMENT', revision: 1, published: true },
  ],
  operators: [{ membershipId: 9511, userId: STAFF.teamManager, name: name(STAFF.teamManager), status: 'ACTIVE', startedAt: at(-300), endedAt: null }],
  operatorInvitations: [{ id: 9521, organizationId: ORG_ID, organizationName: club.name, recipientName: name(STAFF.kit), status: 'PENDING', expiresAt: at(9), canRespond: false, canOpenVenue: false }],
};
