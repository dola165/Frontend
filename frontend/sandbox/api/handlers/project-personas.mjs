// The Projects personas outside Projects: each is its own person with what the server would give that job. Commercial
// (Irakli) and the facilities coordinator (Levan) hold a job with no page of its own, so Club office and no squads, as
// the physio persona has; the project coach is Luka as a head coach who is not an admin, as the headcoach persona;
// the kit parent (Nana) is a U12 parent with no club tabs, only Parent Hub. Registered first, so every other handler
// answers these personas as the job they stand for; Projects, fundraisers and media keep the real persona.
import { first, handleApi, reply } from '../router.mjs';
import * as V from '../viewer.mjs';
import * as J from '../world-projects.mjs';

const ACTS_AS = { commercial: 'physio', facilities: 'physio', projectcoach: 'headcoach' };
const WHO = { commercial: J.irakli, facilities: J.levan, kitparent: J.nana };
const OWN_PERSONA = /^\/(projects|clubs\/\d+\/projects|campaigns|media|sandbox-media)(\/|$)/;

const asPersona = (headers, persona) => ({
  ...headers,
  cookie: String(headers?.cookie ?? '').replace(/gk-sandbox-persona=[a-z]*/, `gk-sandbox-persona=${persona}`),
});
const identity = (projection, person) => ({
  ...projection, id: person.id, username: null, email: `${person.firstName.toLowerCase()}@dinamo.example`, fullName: person.fullName,
  name: person.fullName, avatarUrl: person.avatarUrl ?? null,
});
const refusal = (action, reason, message) => ({ action, allowed: false, reason, message, because: null });

// Who is signed in: their own name; their tabs are their job's (or, for the kit parent, Parent Hub alone).
first('GET', '/users/me', async req => {
  const persona = V.personaOf(req.headers);
  if (!WHO[persona] && !ACTS_AS[persona]) return undefined;
  if (persona === 'kitparent') {
    const me = (await handleApi({ ...req, headers: asPersona(req.headers, '') })).body;
    return { ...identity(me, J.nana), navigationCapabilities: { version: 1, workspaces: [
      { id: 'parent.hub', context: { type: 'user', id: J.nana.id, label: J.nana.fullName } }] } };
  }
  const me = (await handleApi({ ...req, headers: asPersona(req.headers, ACTS_AS[persona]) })).body;
  return WHO[persona] ? identity(me, WHO[persona]) : me;
});

// A parent belongs to no club: no membership, and at a club only what any adult may do there.
first('GET', '/clubs/my-membership-context', ({ headers }) => V.personaOf(headers) === 'kitparent'
  ? { hasClubMembership: false, canCreateClub: true, clubId: null, clubName: null, myRole: null } : undefined);
first('GET', '/me/results-waiting', ({ headers }) => V.personaOf(headers) === 'kitparent' ? [] : undefined);
first('GET', '/access/me', ({ headers }) => V.personaOf(headers) === 'kitparent'
  ? { allowed: ['start_club', 'add_child', 'join_squad', 'follow'], refused: [
    refusal('arrange_match', 'ONLY_SQUAD_MATCH_STAFF', 'Only a squad’s coaches arrange its matches.'),
    refusal('report_score', 'ONLY_SQUAD_MATCH_STAFF', 'Only a squad’s coaches report its scores.'),
    refusal('invite_staff', 'ONLY_ADMINS', 'Only the club’s admins invite staff.')] } : undefined);
first('GET', '/access/clubs/:id', ({ params, headers }) => V.personaOf(headers) === 'kitparent'
  ? { clubId: Number(params.id), squadId: null, allowed: ['add_child', 'follow'], refused: [
    refusal('see_staff', 'ONLY_CLUB_STAFF', 'Staff is for the club’s staff.')], admins: [] } : undefined);
first('GET', '/access/squads/:id', ({ params, headers }) => V.personaOf(headers) === 'kitparent'
  ? { squadId: Number(params.id), allowed: ['join_squad', 'add_child', 'follow'], refused: [
    refusal('arrange_match', 'ONLY_SQUAD_COACHES', 'Only this squad’s coaches can do this.')] } : undefined);

// Everything else about the club: the job the persona stands for. A parent has no club workspace.
for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
  first(method, '/.*', async req => {
    const persona = V.personaOf(req.headers);
    if (OWN_PERSONA.test(req.path) || req.path === '/users/me') return undefined;
    if (persona === 'kitparent' && /^\/(clubs\/\d+\/(workspace|office|operations|management)|squads\/\d+\/workspace)/.test(req.path))
      return reply(404, { message: 'Not found' });
    if (!ACTS_AS[persona]) return undefined;
    return handleApi({ ...req, headers: asPersona(req.headers, ACTS_AS[persona]) }).then(answer => answer
      ? reply(answer.status, answer.body, answer.headers) : undefined);
  });
