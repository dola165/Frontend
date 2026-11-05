// Synthetic parents for Parent Hub, step 5. Each is a sandbox account of their own (`/__mode/parent2`,
// `/__mode/parent1`: the `gk-sandbox-user` cookie), a parent and nothing else: no job, no squad to coach. All fictional.
//   * Ana Beridze, two children: Giorgi (12) plays in U12 Mixed and plays up in U14 Boys (a child in two squads, with
//     one training this week cancelled and the club's real fees); Mariam (7) has no club yet (the finder, a first visit).
//   * Nika Kapanadze, one child: Dato (8) in Dinamo's Beginners.
// Beginners is a new Dinamo squad (coach Luka, so the head coach sees the visits and requests) with trainings on
// Tuesday and Thursday at 17:00 and Saturday at 10:00; the joining group "Beginners (born 2017–2019)" now fills it.
import * as W from './world.mjs';
import * as V from './viewer.mjs';
import * as F from './world-football.mjs';
import { statements } from './world-family.mjs';
import { COACHED } from './world-my-squads.mjs';
import { MY_SQUADS } from './world-social.mjs';
import { myCoaching } from './world-club.mjs';

const year = W.NOW.getFullYear();
export const BEGINNERS = 160, BEGINNERS_GROUP = 1301;
export const ANA = 9601, NIKA = 9602, GIORGI = 9611, MARIAM = 9612, DATO = 9613;

const child = (id, first, last, born, gender, positions = []) => ({ id, name: `${first} ${last}`, dateOfBirth: born, gender, positions });
const account = (id, first, last, email, children) => ({
  id, fullName: `${first} ${last}`, firstName: first, lastName: last, email, phone: null, password: 'sandbox', dateOfBirth: '1989-06-02', createdAt: new Date(W.NOW.getTime() - 200 * 86400000),
  preferences: { town: V.townRecord('Tbilisi'), topics: ['YOUTH'], activity: 'PARENT', updatedAt: null }, roles: [], clubFollows: new Set([1]), demoted: new Set(), events: [], children,
});
const person = (id, first, last, born, gender, extra = {}) => ({ id, firstName: first, lastName: last, fullName: `${first} ${last}`, username: null, gender, role: 'PLAYER', birthYear: Number(born.slice(0, 4)),
  city: 'Tbilisi', clubId: null, position: null, headline: null, avatarUrl: `/sandbox-media/avatar/${id}.svg`, ...extra });

if (!V.accounts.has(ANA)) {
  const giorgi = child(GIORGI, 'Giorgi', 'Beridze', `${year - 12}-03-21`, 'MALE', ['ST']), mariam = child(MARIAM, 'Mariam', 'Beridze', `${year - 7}-08-09`, 'FEMALE');
  const dato = child(DATO, 'Dato', 'Kapanadze', `${year - 8}-01-30`, 'MALE');
  V.accounts.set(ANA, account(ANA, 'Ana', 'Beridze', 'ana.beridze@sandbox.test', [giorgi, mariam]));
  V.accounts.set(NIKA, account(NIKA, 'Nika', 'Kapanadze', 'nika.kapanadze@sandbox.test', [dato]));
  W.parents.push({ parentId: ANA, childId: GIORGI }, { parentId: ANA, childId: MARIAM }, { parentId: NIKA, childId: DATO });
  W.people.push(person(GIORGI, 'Giorgi', 'Beridze', giorgi.dateOfBirth, 'MALE', { clubId: 1, position: 'ST', headline: 'Striker · FC Dinamo Tbilisi Academy', shirtNumber: 9, squadId: 102, preferredFoot: 'LEFT' }));
  W.people.push(person(MARIAM, 'Mariam', 'Beridze', mariam.dateOfBirth, 'FEMALE', { avatarUrl: null }));
  W.people.push(person(DATO, 'Dato', 'Kapanadze', dato.dateOfBirth, 'MALE', { clubId: 1, position: 'CM', shirtNumber: 7, squadId: BEGINNERS }));
  for (const id of [102, 103]) { const squad = W.squadById(id); if (!squad.playerIds.includes(GIORGI)) squad.playerIds.push(GIORGI); }
  // The child's existing U14 calendar match is the same event in the canonical match reader.
  const childMatch = W.matches.find(m => m.id === 5727 && m.squadId === 103);
  if (childMatch) {
    F.connectCalendarFixture(childMatch);
    // Conversion keeps the football event in W.matches/F.exchange, not a duplicate squad session.
    const placeholder = W.events.findIndex(e => e.id === childMatch.id);
    if (placeholder >= 0) W.events.splice(placeholder, 1);
  }

  // Beginners: eight more children born 2017–2019 and three trainings a week, a week back and four ahead.
  const kids = [['Luka', 'Tsiklauri'], ['Elene', 'Maisuradze'], ['Saba', 'Lomidze'], ['Nia', 'Chikovani'], ['Aleksandre', 'Japaridze'], ['Barbare', 'Kvaratskhelia'], ['Nikoloz', 'Gogia'], ['Keti', 'Abashidze']];
  const kidIds = kids.map(([first, last], i) => { const id = 9620 + i; W.people.push(person(id, first, last, `${year - 7 - (i % 3)}-0${1 + i}-1${i}`, i % 2 ? 'FEMALE' : 'MALE', { clubId: 1, position: ['GK', 'CB', 'CM', 'ST'][i % 4], shirtNumber: 10 + i, squadId: BEGINNERS })); return id; });
  W.squads.push({ id: BEGINNERS, clubId: 1, name: 'Beginners', ageGroup: 'U9', gender: 'MIXED', headCoachId: W.ME_ID, playerIds: [DATO, ...kidIds], format: '5v5', trainingDays: [2, 4, 6] });
  for (const list of [COACHED, MY_SQUADS, myCoaching.squad_ids]) if (!list.includes(BEGINNERS)) list.push(BEGINNERS);
  if (!myCoaching.squad_names.includes('Beginners')) myCoaching.squad_names.push('Beginners');
  const monday = new Date(W.NOW); monday.setUTCHours(0, 0, 0, 0); monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7) - 7);
  let id = 9700;
  for (let week = 0; week < 6; week++) for (const [weekday, hour] of [[1, 13], [3, 13], [5, 6]]) {
    const start = new Date(monday.getTime() + ((week * 7 + weekday) * 24 + hour) * 3600000);
    W.events.push({ id: id++, type: 'TRAINING', title: weekday === 5 ? 'Saturday games' : 'Beginners training', clubId: 1, squadId: BEGINNERS, start, end: new Date(start.getTime() + 75 * 60000), venueId: 202, pitch: 'Pitch 3', coachId: W.ME_ID,
      notes: 'Bring water, shin pads and trainers or boots.' });
  }
  const group = F.groupById(BEGINNERS_GROUP);
  if (group) { group.squadId = BEGINNERS; group.firstVisits = { places: 3, fee: null, currency: null }; }

  // One of Giorgi's trainings this week is cancelled with the coach's reason (the child's page shows it struck through).
  const next = W.events.filter(e => e.squadId === 102 && e.type === 'TRAINING' && e.start > W.NOW).sort((a, b) => a.start - b.start)[1];
  if (next) next.cancelled = 'Pitch closed for re-turfing. Back on the usual day next week.';

  // What the club recorded as due for Giorgi: the U12 fee this month, last month paid, and a tournament entry.
  const due = days => { const d = new Date(W.NOW); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
  statements.set(`${GIORGI}:1`, { status: 'DUE', amount: 150, currency: 'GEL', dueDate: due(6), period: 'November', lines: [
    { label: 'Training fee · U12 Mixed', amount: 150, currency: 'GEL', dueDate: due(6), status: 'DUE', period: 'November', squadId: 102 },
    { label: 'Tournament entry · Rustavi Cup', amount: 30, currency: 'GEL', dueDate: due(13), status: 'DUE', period: null, squadId: 103 },
    { label: 'Training fee · U12 Mixed', amount: 150, currency: 'GEL', dueDate: due(-24), status: 'PAID', period: 'October', squadId: 102 },
  ] });
}

/** The club's published price for a squad (Programmes and fees), as the child's page shows it. */
const PRICES = { 102: [150, 'U12 training'], 103: [170, 'U14 training'], [BEGINNERS]: [90, 'Beginners'] };
export const squadPrice = squadId => {
  const [amount, programme] = PRICES[squadId] ?? [];
  return amount ? { type: 'FIXED', amount, currency: 'GEL', period: 'MONTH', programme } : null;
};
