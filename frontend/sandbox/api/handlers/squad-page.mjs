// Synthetic API: joining a squad from its squad page (the coach's side of refinement 2, SQUAD_PAGE_AND_FAMILY.md).
// Joining needs both sides: the coach shares the squad's join link (or a family asks through a group) and approves;
// neither side adds a child alone. Registered before pages.mjs so the academy's squads get join links too
// (pages.mjs answers the links of clubs created as pages).
//   GET  /squad-communication/:id/join-link        the squad's link for the parents' WhatsApp group
//   GET  /squad-communication/:id/join-requests    children waiting for the coach (from the link or a group request)
//   POST /squad-communication/:id/join-requests/:rid { action: APPROVE | DECLINE }
//   GET/POST /join/:code                            the link itself, for codes of the form sq<squad>k<key>
import { get, post, reply, handleApi } from '../router.mjs';
import { familyOf } from '../world-family.mjs';
import { squadAccess } from '../squad-access.mjs';
import * as V from '../viewer.mjs';
import './squad-training.mjs';
import * as W from '../world.mjs';
import * as C from '../world-club.mjs';
import * as F from '../world-football.mjs';

const codeOf = squadId => `sq${squadId}k${((squadId * 7919) % 46656).toString(36).padStart(3, '0')}`;
const squadOfCode = code => { const m = /^sq(\d+)k([0-9a-z]+)$/.exec(String(code)); const squad = m && W.squadById(m[1]); return squad && codeOf(squad.id) === code ? squad : null; };
const coachable = id => { const squad = W.squadById(id); return squad && squad.clubId === 1 ? squad : null; };
const PASS = 'x-sandbox-join-pass'; // set once the chosen child is checked as the guardian's (below)
const arrivals = []; // { id, squadId, childFirstName, childLastName, birthDate, gender, guardianName, playerId, createdAt, status }
let nextArrival = 88001;
const year = new Date().getFullYear();
// A join-code request the assistant coach said Not now to yesterday: Want to join keeps it for two weeks, saying so.
arrivals.push({ id: nextArrival++, squadId: 105, childFirstName: 'Luka', childLastName: 'Chkheidze', birthDate: `${year - 15}-04-02`, gender: 'MALE', guardianName: 'Tamar Chkheidze', playerId: null,
  createdAt: C.at(-3, 19, 40), status: 'DECLINED', answeredBy: C.name(C.STAFF.assistant), answeredAt: '11:05 yesterday', answeredIso: C.at(-1, 11, 5) });

get('/squad-communication/:id/join-link', ({ params, headers }) => {
  const squad = coachable(params.id);
  if (squad && !squadAccess(squad, headers)?.canManage) return reply(403, { status: 403, message: 'Only the squad staff invite players.' });
  return squad ? { code: codeOf(squad.id), path: `/join/${codeOf(squad.id)}`, squadName: squad.name } : undefined;
});

get('/join/:code', ({ params }) => {
  const squad = squadOfCode(params.code); if (!squad) return undefined;
  const club = W.clubById(squad.clubId);
  return { code: params.code, page: { ref: { kind: 'club', id: club.id }, name: club.name, town: club.city, crestUrl: club.logoUrl, profilePath: `/clubs/${club.id}`, live: true },
    squad: { id: squad.id, name: squad.name, ageGroup: squad.ageGroup, gender: squad.gender } };
});

post('/join/:code', ({ params, body, headers }) => {
  const squad = squadOfCode(params.code); if (!squad) return undefined;
  if (body?.playerId != null && !headers[PASS]) return undefined; // the guardian check below answers first
  const first = String(body?.childFirstName ?? '').trim(), birthDate = String(body?.birthDate ?? '');
  if (!first || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return reply(400, { status: 400, message: 'Add the child’s name and date of birth.' });
  const arrival = { id: nextArrival++, squadId: squad.id, childFirstName: first, childLastName: String(body?.childLastName ?? '').trim(), birthDate, gender: body?.childGender ?? null, guardianName: V.account(V.viewerId(headers))?.fullName ?? W.me.fullName, playerId: body?.playerId ?? null, createdAt: new Date().toISOString(), status: 'WAITING' };
  arrivals.push(arrival);
  return reply(201, { id: arrival.id, status: arrival.status, squadName: squad.name });
});

// Waiting children: link arrivals plus requests sent through a group tied to this squad.
const groupRequests = squad => C.admissionCases.filter(c => c.stage === 'REQUEST_RECEIVED' && F.groupById(c.groupId)?.squadId === squad.id);
get('/squad-communication/:id/join-requests', ({ params, headers, query }) => {
  const squad = coachable(params.id); if (!squad) return undefined;
  if (!squadAccess(squad, headers)?.canManage) return reply(403, { status: 403, message: 'Only the squad staff review requests.' });
  // The real shape (SquadJoinLinkModels.Request): the squad's joining groups to route into, and where joining is set up.
  const groups = F.admissionGroups.filter(g => g.squadId === squad.id).map(g => ({ id: g.id, version: g.version, name: g.name, method: g.method }));
  const shape = row => ({ version: 1, playerId: row.playerId ?? 0, message: null, destination: `/my-squads?squad=${squad.id}&tab=players`, groups, setup: { canConfigure: true, destination: groups.length ? null : '/admissions/manage' }, possibleDuplicateOf: null, ...row });
  return [
    ...arrivals.filter(a => a.squadId === squad.id && a.status === 'WAITING').map(a => shape({ id: a.id, source: 'LINK', playerId: a.playerId, childName: `${a.childFirstName} ${a.childLastName}`.trim(), birthYear: Number(a.birthDate.slice(0, 4)), guardianName: a.guardianName, createdAt: a.createdAt, caseId: null })),
    ...groupRequests(squad).map(c => shape({ id: c.id, source: 'ENQUIRY', childName: c.playerName, birthYear: Number(String(c.dateOfBirth).slice(0, 4)) || null, guardianName: c.history[0]?.actorName ?? null, createdAt: c.submittedAt, caseId: c.id })),
    // With `answered`, those answered in the last two weeks, with who answered first and when, and nothing to do.
    ...(query.get('answered') === 'true' ? arrivals.filter(a => a.squadId === squad.id && a.status !== 'WAITING' && a.answeredIso && Date.now() - new Date(a.answeredIso).getTime() < 14 * 864e5)
      .map(a => shape({ id: a.id, source: 'LINK', playerId: a.playerId, childName: `${a.childFirstName} ${a.childLastName}`.trim(), birthYear: Number(a.birthDate.slice(0, 4)), guardianName: a.guardianName, createdAt: a.createdAt, caseId: null,
        groups: [], answeredBy: a.answeredBy, answeredAt: a.answeredIso })) : []),
  ];
});

post('/squad-communication/:id/join-requests/:rid', ({ params, body, headers }) => {
  const squad = coachable(params.id); if (!squad) return undefined;
  if (!squadAccess(squad, headers)?.canManage) return reply(403, { status: 403, message: 'Only the squad staff decide requests.' });
  const approve = body?.action === 'APPROVE', rid = Number(params.rid);
  // The first answer counts: a later one is told who answered and when, as on the server.
  const answered = arrivals.find(a => a.id === rid && a.squadId === squad.id && a.status !== 'WAITING' && a.answeredBy);
  if (answered) return reply(409, { status: 409, code: 'ALREADY_ANSWERED', message: `${answered.answeredBy} already answered this request at ${answered.answeredAt}.` });
  const arrival = arrivals.find(a => a.id === rid && a.squadId === squad.id && a.status === 'WAITING');
  const request = !arrival && groupRequests(squad).find(c => c.id === rid);
  if (!arrival && !request) return reply(404, { status: 404, message: 'This request was already answered.' });
  if (arrival) {
    arrival.status = approve ? 'APPROVED' : 'DECLINED';
    arrival.answeredBy = W.personById(V.viewerId(headers))?.fullName ?? W.me.fullName;
    arrival.answeredAt = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Tbilisi', hour: '2-digit', minute: '2-digit', hour12: false })
      + ' on ' + new Date().toLocaleString('en-GB', { timeZone: 'Asia/Tbilisi', day: 'numeric', month: 'long' });
    arrival.answeredIso = new Date().toISOString();
    if (approve) {
      // The card is the family's; joining puts it in the squad.
      const id = arrival.playerId ?? 96000 + arrival.id % 1000;
      if (!W.personById(id)) W.people.push({ id, firstName: arrival.childFirstName, lastName: arrival.childLastName, fullName: `${arrival.childFirstName} ${arrival.childLastName}`.trim(), username: `child${id}`, gender: arrival.gender ?? 'MALE', role: 'PLAYER', birthYear: Number(arrival.birthDate.slice(0, 4)) || year - 10, city: 'Tbilisi', clubId: squad.clubId, position: null, headline: null, avatarUrl: null, shirtNumber: null, squadId: squad.id });
      if (!squad.playerIds.includes(id)) squad.playerIds.push(id);
    }
  } else {
    request.stage = approve ? 'ENROLLED' : 'CLOSED'; request.version += 1; request.updatedAt = new Date().toISOString();
    request.nextAction = approve ? { code: 'ENROLLED', owner: 'NONE', label: 'Enrolled', dueAt: null } : { code: 'CLOSED', owner: 'NONE', label: 'Closed', dueAt: null };
    if (approve && !squad.playerIds.includes(request.playerId)) squad.playerIds.push(request.playerId);
  }
  return { status: approve ? 'APPROVED' : 'DECLINED' };
});

// A parent picks a child they already look after: the server checks the card is theirs (never someone else's child),
// fills in the card's own name and birth date, and passes the join on with the playerId (academy codes above, pages'
// codes in pages.mjs).
post('/join/:code', async req => {
  if (req.headers[PASS] || req.body?.playerId == null) return undefined;
  const child = familyOf(req.headers)?.find(c => c.id === Number(req.body.playerId)) ?? null;
  if (!child) return reply(403, { status: 403, message: 'You can only add a child you look after.' });
  const [first, ...rest] = child.name.split(' ');
  const body = { ...req.body, playerId: child.id, childFirstName: first, childLastName: rest.join(' '), childGender: child.gender, birthDate: child.dateOfBirth };
  const result = await handleApi({ ...req, body, headers: { ...req.headers, [PASS]: '1' } });
  return result ? reply(result.status, result.body) : undefined;
});
