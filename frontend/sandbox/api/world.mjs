// Synthetic GrassKickZ world for the sandbox. Deterministic, entirely invented.
// Every person, club and event here is fictional. Dates are generated relative to "now"
// so the sandbox always shows a current week.

let seed = 20261010;
export const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
export const pick = list => list[Math.floor(rand() * list.length)];
export const int = (min, max) => min + Math.floor(rand() * (max - min + 1));

export const NOW = new Date();
export const day = (offset, hour = 0, minute = 0) => {
  const d = new Date(NOW); d.setHours(hour, minute, 0, 0); d.setDate(d.getDate() + offset); return d;
};
export const iso = d => d.toISOString();
export const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Local wall-clock ISO without zone, e.g. 2026-10-10T18:00:00 (Asia/Tbilisi intent). */
export const local = d => `${isoDate(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;

let nextId = 5000;
export const newId = () => ++nextId;

const FIRST_M = ['Giorgi', 'Luka', 'Nika', 'Saba', 'Dachi', 'Levan', 'Tornike', 'Irakli', 'Data', 'Sandro', 'Lasha', 'Beka', 'Zuka', 'Gabriel', 'Aleksandre', 'Andria', 'Demetre', 'Nikoloz', 'Tamaz', 'Otar', 'Vakhtang', 'Mate', 'Rati', 'Temo', 'Guram', 'Ilia', 'Shota', 'Koba', 'Davit', 'Archil'];
const FIRST_F = ['Nino', 'Mariam', 'Ana', 'Elene', 'Salome', 'Tamar', 'Keti', 'Natia', 'Mariami', 'Teona', 'Lika', 'Sopo', 'Barbare', 'Nutsa', 'Ketevan', 'Eka', 'Tako', 'Mako', 'Nana', 'Ia'];
const LAST = ['Beridze', 'Kapanadze', 'Gelashvili', 'Maisuradze', 'Lomidze', 'Tsiklauri', 'Kurdadze', 'Gvazava', 'Machavariani', 'Nozadze', 'Dolidze', 'Jgerenaia', 'Chikovani', 'Abashidze', 'Khvedelidze', 'Mchedlishvili', 'Tsereteli', 'Japaridze', 'Bakradze', 'Kvaratskhelia', 'Mamardashvili', 'Kiteishvili', 'Zivzivadze', 'Davitashvili', 'Lochoshvili', 'Kakabadze', 'Gogia', 'Shengelia', 'Gugeshashvili', 'Chakvetadze'];
const POSITIONS = ['GK', 'RB', 'CB', 'CB', 'LB', 'DM', 'CM', 'CM', 'AM', 'RW', 'LW', 'ST'];
const POSITION_LABEL = { GK: 'Goalkeeper', RB: 'Right back', CB: 'Centre back', LB: 'Left back', DM: 'Defensive midfielder', CM: 'Central midfielder', AM: 'Attacking midfielder', RW: 'Right winger', LW: 'Left winger', ST: 'Striker' };
export { POSITION_LABEL };

const avatar = (id) => `/sandbox-media/avatar/${id}.svg`;

// ---------------------------------------------------------------- places
export const cities = {
  Tbilisi: { lat: 41.7151, lng: 44.8271 }, Rustavi: { lat: 41.5495, lng: 45.0012 }, Kutaisi: { lat: 42.2679, lng: 42.6946 },
  Batumi: { lat: 41.6168, lng: 41.6367 }, Telavi: { lat: 41.9198, lng: 45.4732 }, Mtskheta: { lat: 41.8411, lng: 44.7067 }, Zugdidi: { lat: 42.5088, lng: 41.8709 },
};

export const venues = [
  { id: 201, name: 'Boris Paichadze Dinamo Arena', city: 'Tbilisi', district: 'Didube', lat: 41.7232, lng: 44.7898, surface: 'Natural grass', kind: 'STADIUM', capacity: 54549, pitches: ['Main pitch'], hourly: null },
  { id: 202, name: 'Dinamo Academy Training Centre', city: 'Tbilisi', district: 'Digomi', lat: 41.7631, lng: 44.7712, surface: 'Hybrid grass', kind: 'TRAINING_GROUND', capacity: 800, pitches: ['Pitch 1', 'Pitch 2', 'Pitch 3 (small-sided)', 'Indoor hall'], hourly: null },
  { id: 203, name: 'Mikheil Meskhi Stadium', city: 'Tbilisi', district: 'Vake-Saburtalo', lat: 41.7271, lng: 44.7553, surface: 'Natural grass', kind: 'STADIUM', capacity: 27223, pitches: ['Main pitch', 'Training pitch'], hourly: 400 },
  { id: 204, name: 'Isani Futsal Hall', city: 'Tbilisi', district: 'Isani', lat: 41.6936, lng: 44.8395, surface: 'Indoor parquet', kind: 'INDOOR', capacity: 600, pitches: ['Court A', 'Court B'], hourly: 50 },
  { id: 205, name: 'Vake Park Pitches', city: 'Tbilisi', district: 'Vake', lat: 41.7099, lng: 44.7469, surface: 'Artificial turf', kind: 'COMMUNITY', capacity: 200, pitches: ['7-a-side North', '7-a-side South', '5-a-side'], hourly: 80 },
  { id: 206, name: 'Gldani Sports Complex', city: 'Tbilisi', district: 'Gldani', lat: 41.7942, lng: 44.8169, surface: 'Artificial turf', kind: 'COMMUNITY', capacity: 1200, pitches: ['Full pitch', 'Half pitch A', 'Half pitch B'], hourly: 120 },
  { id: 207, name: 'Saburtalo Training Ground', city: 'Tbilisi', district: 'Saburtalo', lat: 41.7357, lng: 44.7356, surface: 'Hybrid grass', kind: 'TRAINING_GROUND', capacity: 500, pitches: ['Pitch 1', 'Pitch 2'], hourly: null },
  { id: 208, name: 'Rustavi Community Pitches', city: 'Rustavi', district: 'Centre', lat: 41.5521, lng: 45.0089, surface: 'Artificial turf', kind: 'COMMUNITY', capacity: 300, pitches: ['Main pitch', 'Small pitch'], hourly: 60 },
  { id: 209, name: 'Ramaz Shengelia Stadium', city: 'Kutaisi', district: 'Centre', lat: 42.2582, lng: 42.6838, surface: 'Natural grass', kind: 'STADIUM', capacity: 14700, pitches: ['Main pitch'], hourly: 300 },
  { id: 210, name: 'Batumi Seaside Arena', city: 'Batumi', district: 'New Boulevard', lat: 41.6337, lng: 41.6176, surface: 'Natural grass', kind: 'STADIUM', capacity: 20000, pitches: ['Main pitch', 'Training pitch'], hourly: 350 },
  { id: 211, name: 'Lisi Lake Mini-Pitches', city: 'Tbilisi', district: 'Lisi', lat: 41.7449, lng: 44.7393, surface: 'Artificial turf', kind: 'COMMUNITY', capacity: 100, pitches: ['5-a-side A', '5-a-side B'], hourly: 45 },
  { id: 212, name: 'Telavi Valley Ground', city: 'Telavi', district: 'Centre', lat: 41.9152, lng: 45.4851, surface: 'Natural grass', kind: 'COMMUNITY', capacity: 1500, pitches: ['Main pitch'], hourly: 70 },
  { id: 213, name: 'Didube Indoor Dome', city: 'Tbilisi', district: 'Didube', lat: 41.7383, lng: 44.7799, surface: 'Artificial turf (indoor)', kind: 'INDOOR', capacity: 250, pitches: ['Dome pitch'], hourly: 90 },
  { id: 214, name: 'Mtskheta Riverside Field', city: 'Mtskheta', district: 'Riverside', lat: 41.8453, lng: 44.7183, surface: 'Natural grass', kind: 'COMMUNITY', capacity: 400, pitches: ['Main pitch'], hourly: 55 },
];
export const venueById = id => venues.find(v => v.id === Number(id));

// ---------------------------------------------------------------- clubs
export const clubs = [
  { id: 1, name: 'FC Dinamo Tbilisi Academy', short: 'DTA', type: 'ACADEMY', city: 'Tbilisi', venueId: 202, founded: 1925, color: '#1d4ed8', verified: true, joinPolicy: 'APPLICATION', description: 'Youth academy of FC Dinamo Tbilisi: eight squads from U12 to the reserve team, with a pathway into professional football.' },
  { id: 2, name: 'FC Dinamo Tbilisi', short: 'DIN', type: 'PROFESSIONAL', city: 'Tbilisi', venueId: 201, founded: 1925, color: '#1e3a8a', verified: true, joinPolicy: 'INVITE_ONLY', description: 'Professional first team. Fixtures, news and the club’s academy network.' },
  { id: 3, name: 'Riverside Academy', short: 'RVA', type: 'ACADEMY', city: 'Tbilisi', venueId: 205, founded: 2014, color: '#0f766e', verified: true, joinPolicy: 'OPEN_TRIAL', description: 'Development-first academy near Vake Park. Small groups, licensed coaches, open trials every month.' },
  { id: 4, name: 'Saburtalo Youth FC', short: 'SAB', type: 'ACADEMY', city: 'Tbilisi', venueId: 207, founded: 1999, color: '#b91c1c', verified: true, joinPolicy: 'APPLICATION', description: 'Competitive youth football in Saburtalo with U10–U19 squads.' },
  { id: 5, name: 'Locomotive Tbilisi Academy', short: 'LOK', type: 'ACADEMY', city: 'Tbilisi', venueId: 203, founded: 1936, color: '#16a34a', verified: true, joinPolicy: 'APPLICATION', description: 'Historic railway club academy based at the Meskhi training pitch.' },
  { id: 6, name: 'Gldani Juniors', short: 'GLD', type: 'GRASSROOTS', city: 'Tbilisi', venueId: 206, founded: 2017, color: '#ea580c', verified: false, joinPolicy: 'OPEN_TRIAL', description: 'Neighbourhood club for kids aged 6–14. Everyone plays.' },
  { id: 7, name: 'Vake Football School', short: 'VFS', type: 'SCHOOL', city: 'Tbilisi', venueId: 205, founded: 2010, color: '#7c3aed', verified: true, joinPolicy: 'OPEN_TRIAL', description: 'After-school football programme for ages 5–12.' },
  { id: 8, name: 'Isani Futsal Club', short: 'ISF', type: 'AMATEUR', city: 'Tbilisi', venueId: 204, founded: 2012, color: '#0891b2', verified: false, joinPolicy: 'OPEN_TRIAL', description: 'Futsal for adults and youth, three nights a week.' },
  { id: 9, name: 'Didube Stars', short: 'DST', type: 'AMATEUR', city: 'Tbilisi', venueId: 213, founded: 2019, color: '#db2777', verified: false, joinPolicy: 'APPLICATION', description: 'Adult amateur side playing in the Tbilisi Community League.' },
  { id: 10, name: 'Rustavi Community FC', short: 'RCF', type: 'GRASSROOTS', city: 'Rustavi', venueId: 208, founded: 2016, color: '#ca8a04', verified: true, joinPolicy: 'OPEN_TRIAL', description: 'Community football for Rustavi, youth and women’s teams.' },
  { id: 11, name: 'Kutaisi City Academy', short: 'KCA', type: 'ACADEMY', city: 'Kutaisi', venueId: 209, founded: 2008, color: '#9333ea', verified: true, joinPolicy: 'APPLICATION', description: 'Western Georgia’s largest youth academy.' },
  { id: 12, name: 'Batumi Seaside FC', short: 'BSF', type: 'SEMI_PROFESSIONAL', city: 'Batumi', venueId: 210, founded: 2003, color: '#0284c7', verified: true, joinPolicy: 'INVITE_ONLY', description: 'Semi-professional club on the Black Sea coast.' },
  { id: 13, name: 'Telavi Valley FC', short: 'TVF', type: 'AMATEUR', city: 'Telavi', venueId: 212, founded: 2011, color: '#65a30d', verified: false, joinPolicy: 'OPEN_TRIAL', description: 'Kakheti’s community club, senior and U16 teams.' },
  { id: 14, name: 'Mtskheta Sharks', short: 'MSH', type: 'GRASSROOTS', city: 'Mtskheta', venueId: 214, founded: 2020, color: '#0d9488', verified: false, joinPolicy: 'OPEN_TRIAL', description: 'Young club by the river, U8–U14.' },
  { id: 15, name: 'Lisi Lake Football Club', short: 'LLF', type: 'AMATEUR', city: 'Tbilisi', venueId: 211, founded: 2021, color: '#4f46e5', verified: false, joinPolicy: 'OPEN_TRIAL', description: 'Five-a-side leagues and weekend kickabouts.' },
  { id: 16, name: 'Zugdidi Youth Academy', short: 'ZYA', type: 'ACADEMY', city: 'Zugdidi', venueId: null, founded: 2006, color: '#be123c', verified: true, joinPolicy: 'APPLICATION', description: 'Samegrelo’s talent pathway for U10–U17.' },
];
for (const c of clubs) {
  const v = venueById(c.venueId); const city = cities[c.city];
  c.lat = v ? v.lat : city.lat + (rand() - 0.5) * 0.02; c.lng = v ? v.lng : city.lng + (rand() - 0.5) * 0.02;
  c.address = v ? `${v.name}, ${c.city}` : `${c.city}, Georgia`;
  c.logoUrl = `/sandbox-media/crest/${c.id}.svg`; c.bannerUrl = `/sandbox-media/photo/club-${c.id}.svg`;
}
export const clubById = id => clubs.find(c => c.id === Number(id));

// ---------------------------------------------------------------- people
export const people = [];
const usedNames = new Set();
function makePerson({ id, female = false, first, last, role, birthYear, city = 'Tbilisi', clubId = null, position = null, headline = null, extra = {} }) {
  let fn = first, ln = last;
  for (let i = 0; !fn || !ln || usedNames.has(`${fn} ${ln}`); i++) { fn = first ?? pick(female ? FIRST_F : FIRST_M); ln = last ?? pick(LAST); if (i > 20) break; }
  usedNames.add(`${fn} ${ln}`);
  const p = { id: id ?? newId(), firstName: fn, lastName: ln, fullName: `${fn} ${ln}`, username: `${fn}.${ln}`.toLowerCase() + (id ?? ''), gender: female ? 'FEMALE' : 'MALE', role, birthYear, city, clubId, position, headline, avatarUrl: avatar(id ?? nextId), ...extra };
  people.push(p); return p;
}

export const ME_ID = 1;
export const me = makePerson({ id: ME_ID, first: 'Luka', last: 'Gelashvili', role: 'COACH', birthYear: 1988, clubId: 1, headline: 'Head of Coaching · FC Dinamo Tbilisi Academy · UEFA A licence', extra: { email: 'coach@talanti.ge', displayName: 'Coach Luka', licences: ['UEFA A', 'GFF Youth Diploma'] } });

const staffRoles = [
  ['Head coach', 'COACH'], ['Assistant coach', 'COACH'], ['Goalkeeper coach', 'COACH'], ['Fitness coach', 'COACH'], ['Performance analyst', 'COACH'],
  ['Nutritionist', 'COACH'], ['Physiotherapist', 'MEDICAL'], ['Sports psychologist', 'MEDICAL'], ['Academy director', 'ADMIN'], ['Team manager', 'ADMIN'],
  ['Kit manager', 'ADMIN'], ['Welfare officer', 'ADMIN'], ['Scout', 'COACH'], ['Youth coach', 'COACH'],
];
export const staff = [{ personId: ME_ID, clubId: 1, title: 'Head of Coaching', kind: 'COACH', responsibilities: ['CLUB_ADMINISTRATION', 'SQUAD_COACH'] }];
for (const [title, kind] of staffRoles) {
  const p = makePerson({ role: kind === 'MEDICAL' ? 'SPECIALIST' : kind === 'ADMIN' ? 'STAFF' : 'COACH', female: rand() < 0.3, birthYear: int(1965, 1996), clubId: 1, headline: `${title} · FC Dinamo Tbilisi Academy` });
  staff.push({ personId: p.id, clubId: 1, title, kind, responsibilities: [] });
}

export const squads = [];
const dinamoSquads = [
  ['First Team', 'SENIOR', 'MALE', 22], ['U12 Mixed', 'U12', 'MIXED', 12], ['U14 Boys', 'U14', 'MALE', 11], ['U14 Girls', 'U14', 'FEMALE', 10],
  ['U16 Boys', 'U16', 'MALE', 11], ['U16 Girls', 'U16', 'FEMALE', 9], ['U18 Boys', 'U18', 'MALE', 11], ['Dinamo Youth A', 'U19', 'MALE', 0],
];
let squadId = 100;
const coachPool = staff.filter(s => s.kind === 'COACH').map(s => s.personId);
for (const [name, ageGroup, gender, count] of dinamoSquads) {
  squads.push({ id: ++squadId, clubId: 1, name, ageGroup, gender, headCoachId: name === 'U16 Boys' || name === 'U14 Boys' ? ME_ID : pick(coachPool), playerIds: [], format: ageGroup === 'U12' ? '7v7' : ageGroup === 'U14' ? '9v9' : '11v11', trainingDays: [1, 3, 5] });
}
for (const c of clubs.filter(c => c.id !== 1)) {
  const n = c.type === 'PROFESSIONAL' ? 2 : int(1, 4);
  for (let i = 0; i < n; i++) {
    const ag = pick(['U10', 'U12', 'U14', 'U16', 'SENIOR']);
    squads.push({ id: ++squadId, clubId: c.id, name: ag === 'SENIOR' ? 'Senior team' : `${ag} ${pick(['Boys', 'Girls', 'Mixed'])}`, ageGroup: ag, gender: 'MIXED', headCoachId: null, playerIds: [], format: ag === 'U10' || ag === 'U12' ? '7v7' : '11v11', trainingDays: [2, 4] });
  }
}
export const squadById = id => squads.find(s => s.id === Number(id));
const birthYearFor = ag => ag === 'SENIOR' ? int(1995, 2005) : ag === 'U19' ? 2007 + int(0, 1) : NOW.getFullYear() - Number(ag.slice(1)) + int(0, 1);

export const parents = [];
for (const sq of squads) {
  const count = sq.clubId === 1 ? (dinamoSquads.find(d => d[0] === sq.name)?.[3] ?? 0) : int(8, 14);
  for (let i = 0; i < count; i++) {
    const female = sq.gender === 'FEMALE' || (sq.gender === 'MIXED' && rand() < 0.4);
    const pos = POSITIONS[i % POSITIONS.length];
    const p = makePerson({ role: 'PLAYER', female, birthYear: birthYearFor(sq.ageGroup), clubId: sq.clubId, position: pos, headline: `${POSITION_LABEL[pos]} · ${clubById(sq.clubId).name}`, extra: { shirtNumber: i + 1, squadId: sq.id, preferredFoot: rand() < 0.75 ? 'RIGHT' : 'LEFT' } });
    sq.playerIds.push(p.id);
    if (sq.ageGroup !== 'SENIOR' && sq.ageGroup !== 'U19' && sq.clubId === 1) {
      const parent = makePerson({ role: 'PARENT', female: rand() < 0.6, last: p.lastName, birthYear: int(1975, 1990), headline: 'Parent' });
      parents.push({ parentId: parent.id, childId: p.id });
    }
  }
}
// Dinamo Youth A takes the oldest U18s on loan to keep the sample coherent.
const youthA = squads.find(s => s.clubId === 1 && s.name === 'Dinamo Youth A');
youthA.playerIds = squads.find(s => s.clubId === 1 && s.name === 'U18 Boys').playerIds.slice(0, 6);

// Free agents, referees, agents, professionals for the People directory.
export const referees = [];
for (let i = 0; i < 9; i++) referees.push(makePerson({ role: 'REFEREE', female: i % 4 === 0, birthYear: int(1975, 1998), city: pick(['Tbilisi', 'Tbilisi', 'Rustavi', 'Kutaisi']), headline: `${pick(['FIFA', 'GFF National', 'GFF Regional', 'GFF Regional'])} referee` }));
export const agents = [];
for (let i = 0; i < 4; i++) agents.push(makePerson({ role: 'AGENT', birthYear: int(1970, 1990), headline: `Licensed football agent · ${pick(['Youth transfers', 'Women’s football', 'Eastern Europe'])}` }));
for (let i = 0; i < 10; i++) makePerson({ role: 'PLAYER', female: rand() < 0.3, birthYear: int(1996, 2008), city: pick(Object.keys(cities)), position: pick(POSITIONS), headline: 'Free agent · looking for a club', extra: { freeAgent: true } });
const professions = ['Sports psychologist', 'Physiotherapist', 'Video analyst', 'Football photographer', 'Sports nutritionist', 'Strength & conditioning coach', 'Sports lawyer', 'Team doctor'];
for (const prof of professions) makePerson({ role: 'SPECIALIST', female: rand() < 0.5, birthYear: int(1975, 1995), city: pick(['Tbilisi', 'Tbilisi', 'Batumi', 'Kutaisi']), headline: `${prof} · independent`, extra: { profession: prof } });

export const personById = id => people.find(p => p.id === Number(id));
export const personSummary = p => p && ({ id: p.id, userId: p.id, fullName: p.fullName, name: p.fullName, firstName: p.firstName, lastName: p.lastName, username: p.username, avatarUrl: p.avatarUrl, profilePictureUrl: p.avatarUrl, headline: p.headline, role: p.role });

// ---------------------------------------------------------------- events
export const events = [];
const sessionTitles = ['Possession and pressing', 'Finishing under pressure', 'Small-sided games', 'Build-up from the back', 'Transition drills', 'Set pieces', 'Recovery session', 'Defensive shape', '1v1 attacking', 'Match preparation'];
for (const sq of squads.filter(s => s.clubId === 1)) {
  for (let offset = -14; offset <= 21; offset++) {
    const d = day(offset); const dow = d.getDay();
    if (!sq.trainingDays.includes(dow)) continue;
    const hour = sq.ageGroup === 'SENIOR' ? 10 : sq.ageGroup === 'U12' ? 16 : 18;
    events.push({ id: newId(), type: 'TRAINING', title: pick(sessionTitles), clubId: 1, squadId: sq.id, start: day(offset, hour), end: day(offset, hour + 1, 30), venueId: 202, pitch: pick(venueById(202).pitches), coachId: sq.headCoachId, notes: 'Bring water, shin pads and both boots (firm ground and turf).' });
  }
}
export const matches = [];
const opponents = clubs.filter(c => c.id !== 1 && c.id !== 2);
for (const sq of squads.filter(s => s.clubId === 1 && s.playerIds.length)) {
  for (const offset of [-13, -6, 1, 8, 15]) {
    const opp = pick(opponents); const home = rand() < 0.5; const d = day(offset + (sq.id % 2), 11);
    const played = offset < 0;
    const m = { id: newId(), type: 'MATCH', kind: rand() < 0.6 ? 'LEAGUE' : 'FRIENDLY', clubId: 1, squadId: sq.id, opponentClubId: opp.id, opponentName: opp.name, home, start: d, end: new Date(d.getTime() + 105 * 60000), venueId: home ? 202 : opp.venueId ?? 202, status: played ? 'COMPLETED' : 'SCHEDULED', score: played ? [int(0, 4), int(0, 3)] : null, refereeId: pick(referees).id, competition: sq.ageGroup === 'SENIOR' ? 'Tbilisi Community League' : `GFF ${sq.ageGroup} Youth League` };
    matches.push(m); events.push({ ...m, title: `${home ? 'FC Dinamo Tbilisi Academy' : opp.name} vs ${home ? opp.name : 'FC Dinamo Tbilisi Academy'}`, eventType: 'MATCH' });
  }
}

// ---------------------------------------------------------------- tournaments
export const tournaments = [
  { id: 301, name: 'Tbilisi Community League', format: 'LEAGUE', ageGroup: 'SENIOR', gender: 'MALE', teamFormat: '11v11', organizerClubId: 2, start: day(-30), end: day(60), entryDeadline: day(5), status: 'IN_PROGRESS', teams: [1, 3, 4, 5, 9, 12], city: 'Tbilisi', venueId: 203, fee: 0, description: 'Weekly league for senior amateur and academy reserve sides.' },
  { id: 302, name: 'Autumn Cup U12', format: 'KNOCKOUT', ageGroup: 'U12', gender: 'MIXED', teamFormat: '7v7', organizerClubId: 3, start: day(9, 9), end: day(10, 18), entryDeadline: day(4), status: 'REGISTRATION', teams: [1, 3, 6, 7, 14], city: 'Tbilisi', venueId: 205, fee: 120, description: 'One-day 7-a-side cup in Vake Park. Every team plays at least four games.' },
  { id: 303, name: 'Kutaisi Youth Festival', format: 'FESTIVAL', ageGroup: 'U14', gender: 'MIXED', teamFormat: '9v9', organizerClubId: 11, start: day(23), end: day(25), entryDeadline: day(12), status: 'REGISTRATION', teams: [11, 16, 4], city: 'Kutaisi', venueId: 209, fee: 300, description: 'Three-day festival with accommodation partners and a coaching clinic.' },
  { id: 304, name: 'Black Sea Girls Cup U16', format: 'GROUPS_KNOCKOUT', ageGroup: 'U16', gender: 'FEMALE', teamFormat: '11v11', organizerClubId: 12, start: day(37), end: day(39), entryDeadline: day(20), status: 'REGISTRATION', teams: [12, 10], city: 'Batumi', venueId: 210, fee: 250, description: 'Groups and finals by the sea for U16 girls’ teams.' },
  { id: 305, name: 'Winter Futsal Series', format: 'LEAGUE', ageGroup: 'SENIOR', gender: 'MIXED', teamFormat: '5v5', organizerClubId: 8, start: day(-60), end: day(-5), entryDeadline: day(-70), status: 'COMPLETED', teams: [8, 9, 15], city: 'Tbilisi', venueId: 204, fee: 0, description: 'Last season’s indoor series.' },
];

// ---------------------------------------------------------------- opportunities
export const roles = [
  { id: 401, clubId: 1, title: 'U12 assistant coach', kind: 'JOB', employment: 'PART_TIME', city: 'Tbilisi', posted: day(-3), deadline: day(18), description: 'Support the U12 head coach three evenings a week. UEFA C or working towards it.', requirements: ['UEFA C (or enrolled)', 'Child safeguarding certificate'] },
  { id: 402, clubId: 3, title: 'Goalkeeper coach', kind: 'JOB', employment: 'PART_TIME', city: 'Tbilisi', posted: day(-6), deadline: day(10), description: 'Two sessions a week across U12–U16 keepers.', requirements: ['Goalkeeper coaching experience'] },
  { id: 403, clubId: 10, title: 'Matchday volunteers', kind: 'VOLUNTEER', employment: 'VOLUNTEER', city: 'Rustavi', posted: day(-1), deadline: day(7), description: 'Help with set-up, registration and first aid at the community cup.', requirements: [] },
  { id: 404, clubId: 11, title: 'Performance analyst', kind: 'JOB', employment: 'FULL_TIME', city: 'Kutaisi', posted: day(-10), deadline: day(21), description: 'Video and data analysis for academy squads.', requirements: ['Hudl or Wyscout experience'] },
  { id: 405, clubId: 2, title: 'Sports psychologist (consultant)', kind: 'SERVICE', employment: 'CONTRACT', city: 'Tbilisi', posted: day(-2), deadline: day(30), description: 'Monthly workshops for academy players and staff.', requirements: ['Licensed psychologist'] },
  { id: 406, clubId: 6, title: 'Kit and equipment helpers', kind: 'VOLUNTEER', employment: 'VOLUNTEER', city: 'Tbilisi', posted: day(-4), deadline: day(14), description: 'Saturday mornings, two hours.', requirements: [] },
  { id: 407, clubId: 4, title: 'Youth coach U10', kind: 'JOB', employment: 'PART_TIME', city: 'Tbilisi', posted: day(-8), deadline: day(9), description: 'Lead an U10 group twice a week.', requirements: ['UEFA C'] },
];
export const trials = [
  { id: 501, clubId: 3, squadName: 'U12 Mixed', ageGroup: 'U12', date: day(6, 17), venueId: 205, spots: 16, taken: 9, description: 'Open trial for players born 2014–2015.' },
  { id: 502, clubId: 1, squadName: 'U14 Girls', ageGroup: 'U14', date: day(11, 16), venueId: 202, spots: 12, taken: 4, description: 'Trial for the U14 girls’ squad.' },
  { id: 503, clubId: 6, squadName: 'Kids 6–9', ageGroup: 'U10', date: day(2, 11), venueId: 206, spots: 30, taken: 12, description: 'Bring trainers. Everyone welcome.' },
  { id: 504, clubId: 11, squadName: 'U16 Boys', ageGroup: 'U16', date: day(16, 15), venueId: 209, spots: 20, taken: 17, description: 'Regional trial day.' },
  { id: 505, clubId: 7, squadName: 'Under 8s', ageGroup: 'U8', date: day(3, 15), venueId: 205, spots: 20, taken: 5, description: 'Fun first session for new families.' },
];

// ---------------------------------------------------------------- posts
const postTexts = [
  ['U16 Boys finished the week with a sharp possession session. Proud of the intensity.', 1],
  ['Reminder for U14 parents: Saturday kick-off moved to 11:00. Meet at the Digomi gate at 10:15.', 1],
  ['Open trial for U12 on Thursday. Bring a friend.', 3],
  ['Huge thanks to the volunteers who painted the changing rooms this weekend.', 10],
  ['Matchday: Saburtalo Youth U16 vs Locomotive. Come and support at 15:00.', 4],
  ['Our girls’ team is looking for friendly matches in November. Get in touch.', 10],
  ['New floodlights at Gldani are on. Evening sessions start next week.', 6],
  ['What is the one drill you would keep if you could only keep one?', null],
  ['Three of our U18s have been called up for a regional development camp.', 1],
  ['Futsal series registration opens Monday.', 8],
];
export const posts = postTexts.map(([text, clubId], i) => ({ id: 900 + i, text, clubId, authorId: clubId ? (clubId === 1 ? ME_ID : null) : pick(people.filter(p => p.role === 'COACH')).id, created: new Date(NOW.getTime() - (i * 7 + 2) * 3600000), reactions: int(0, 40), comments: int(0, 8), imageUrl: null }));

export const summary = () => ({ people: people.length, clubs: clubs.length, squads: squads.length, events: events.length, matches: matches.length, venues: venues.length });
