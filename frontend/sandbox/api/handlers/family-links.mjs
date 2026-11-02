// Synthetic API: family links and joining two cards (owner, 2 November 2026: one child, one card).
// One invented link of each kind, a look-alike pair for the parent view, and claims that answer like the server
// (V440, parents/links and parents/merge). Everything is in memory; a restart resets it.
import { del, get, post, reply } from '../router.mjs';

const code = kind => `${kind.toLowerCase().replace(/_/g, '-')}-${'x'.repeat(43)}`.slice(0, 43);
const expires = () => new Date(Date.now() + 14 * 86_400_000).toISOString();
const links = {
  ADD_PARENT: { id: 1, kind: 'ADD_PARENT', personId: 31, personName: 'Luka Kapanadze', askedBy: 'Luka', clubId: null, clubName: null, selfPossible: false },
  ANOTHER_PARENT: { id: 2, kind: 'ANOTHER_PARENT', personId: 41, personName: 'Saba Gelashvili', askedBy: 'Luka', clubId: null, clubName: null, selfPossible: false },
  CLUB_CARD: { id: 3, kind: 'CLUB_CARD', personId: 51, personName: 'Nino Beridze', askedBy: 'Koba', clubId: 1, clubName: 'FC Dinamo Tbilisi Academy', selfPossible: false },
};
const claimed = new Set();
const view = link => ({ id: link.id, kind: link.kind, code: code(link.kind), path: `/family-link/${code(link.kind)}`, expiresAt: expires(), personId: link.personId, personName: link.personName });
const byCode = value => Object.values(links).find(link => code(link.kind) === value);

post('/auth/parent-approval/link', () => view(links.ADD_PARENT));
post('/family/children/:cid/link', () => view(links.ANOTHER_PARENT));
post('/clubs/:club/players/:user/family-link', () => view(links.CLUB_CARD));
del('/family-links/:id', () => reply(204));
get('/family-links/:code', ({ params }) => {
  const link = byCode(params.code);
  if (!link) return reply(404, { message: 'This link is unavailable.' });
  return { kind: link.kind, state: claimed.has(link.kind) ? 'CLAIMED' : 'ACTIVE', personName: link.personName.split(' ')[0], askedBy: link.askedBy, clubId: link.clubId, clubName: link.clubName, clubLogoUrl: null, selfPossible: link.selfPossible, expiresAt: expires() };
});
post('/family-links/:code/claim', ({ params, body }) => {
  const link = byCode(params.code);
  if (!link) return reply(404, { message: 'This link is unavailable.' });
  if (link.kind === 'CLUB_CARD' && (!body?.birthDate || !String(body.birthDate).startsWith('2017')))
    return reply(409, { code: 'FAMILY_LINK_BIRTH_DATE', message: 'Enter the exact birth date. It must fit the year on the club’s card.' });
  claimed.add(link.kind);
  return { outcome: body?.childId ? 'JOINED' : 'LINKED', personId: link.personId, personName: link.personName, mergeId: body?.childId ? 7 : null };
});
post('/family/me/cases/:id/remind-parents', () => reply(204));

// Two cards for one child, in the parent view: a look-alike pair, then the join with Undo.
let joined = null;
get('/person-merges/look-alikes', () => joined ? [] : [{ personId: 41, personName: 'Saba Gelashvili', otherId: 42, otherName: 'Saba Gelashvili' }]);
get('/person-merges', () => joined ? [joined] : []);
post('/person-merges', ({ body }) => {
  joined = { id: 7, status: 'DONE', source: 'FAMILY', keptId: body.personId, keptName: 'Saba Gelashvili', joinedId: body.otherId, joinedName: 'Saba Gelashvili', clubName: null, proposedByName: 'Luka', waitingForMe: false, undoUntil: new Date(Date.now() + 30 * 86_400_000).toISOString() };
  return joined;
});
post('/person-merges/:id/undo', () => { const undone = { ...joined, status: 'UNDONE', undoUntil: null }; joined = null; return undone; });
post('/person-merges/:id/answer', () => joined);
