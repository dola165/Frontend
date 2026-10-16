// Synthetic family: two children the coach acts for as a parent. Shown only to a browser that
// carries the `gk-sandbox-family=1` cookie, so the coach's own views stay as they are. All fictional.
//   * Saba (12) plays in U12 Mixed (Koba Gvazava's squad; Luka is only a parent there) and plays up in U14 Boys,
//     which Luka coaches: a child in two squads and a parent who is also the coach.
//   * Nino (9) has no club yet: the joining path.
//   * Tamar is the second guardian of both, seeing everything.
// Saba is a real player in both rosters for everyone; only the guardian link is parent-mode.
import * as W from './world.mjs';

const year = new Date().getFullYear();
export const FAMILY = [
  { id: 9101, name: 'Nino Gelashvili', dateOfBirth: `${year - 9}-05-14`, gender: 'FEMALE', positions: [] },
  { id: 9102, name: 'Saba Gelashvili', dateOfBirth: `${year - 12}-02-03`, gender: 'MALE', positions: ['CM'] },
];
export const SECOND_GUARDIAN = { id: 9150, name: 'Tamar Gelashvili' };
export const SABA = 9102;
export const U12 = 102, U14 = 103;
export const familyRequest = headers => /(?:^|;\s*)gk-sandbox-family=1(?:;|$)/.test(String(headers?.cookie ?? ''));

if (!W.personById(SABA)) {
  W.people.push({ id: SABA, firstName: 'Saba', lastName: 'Gelashvili', fullName: 'Saba Gelashvili', username: 'saba.gelashvili', gender: 'MALE', role: 'PLAYER', birthYear: year - 12, city: 'Tbilisi', clubId: 1, position: 'CM', headline: 'Central midfielder · FC Dinamo Tbilisi Academy', avatarUrl: `/sandbox-media/avatar/${SABA}.svg`, shirtNumber: 14, squadId: U12, preferredFoot: 'RIGHT' });
  W.people.push({ id: SECOND_GUARDIAN.id, firstName: 'Tamar', lastName: 'Gelashvili', fullName: SECOND_GUARDIAN.name, username: 'tamar.gelashvili', gender: 'FEMALE', role: 'PARENT', birthYear: 1990, city: 'Tbilisi', clubId: null, position: null, headline: null, avatarUrl: `/sandbox-media/avatar/${SECOND_GUARDIAN.id}.svg` });
  for (const id of [U12, U14]) { const squad = W.squadById(id); if (!squad.playerIds.includes(SABA)) squad.playerIds.push(SABA); }
}

/**
 * What the club has recorded as due for a child (F38). Where the real amount comes from is an open owner decision
 * (`ROUND_2.md` Before release); the shape says "not recorded" by leaving the statement out, never by a zero.
 */
const due = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
export const statements = new Map([
  [`${SABA}:1`, { status: 'DUE', amount: 120, currency: 'GEL', dueDate: due(9), period: 'MONTHLY', lines: [
    { label: 'Monthly training fee · U12 Mixed', amount: 120, currency: 'GEL', dueDate: due(9), status: 'DUE' },
    { label: 'Monthly training fee · U12 Mixed', amount: 120, currency: 'GEL', dueDate: due(-21), status: 'PAID' },
    { label: 'Autumn kit', amount: 85, currency: 'GEL', dueDate: due(-40), status: 'PAID' },
  ] }],
]);
