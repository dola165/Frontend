import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { handleApi } from '../router.mjs';
import * as V from '../viewer.mjs';
import * as W from '../world.mjs';
import * as P from '../pages-data.mjs';

const account = name => V.createAccount({ fullName: name, dateOfBirth: '1990-01-01' });
const headers = (actor, parent = false) => ({ cookie: `gk-sandbox-user=${actor.id}${parent ? '; gk-sandbox-family=1' : ''}` });
const call = (path, actorHeaders = {}, method = 'GET', body, query = {}) => handleApi({ method, path, headers: actorHeaders, query: new URLSearchParams(query), body });
const events = async (clubId, actorHeaders) => (await call(`/schedule/clubs/${clubId}/events`, actorHeaders)).body.events;
// Exact saved-series shape from lane04's squad-training.mjs. Its canonical reader owns these cards.
const invitation = (clubId, squadId, invitedPlayerIds = []) => ({ id: W.newId(), clubId, squadId, type: 'TRAINING', title: 'Private training invitation',
  start: new Date(Date.now() + 172800000), end: new Date(Date.now() + 178200000), venueId: null, location: 'Private school ground',
  revision: 1, seriesId: `squad-training-${randomUUID()}`, invitedPlayerIds, invitationPlan: true, visibility: 'PRIVATE', publicationState: 'PRIVATE' });
const normal = (clubId, squadId, visibility = 'PRIVATE') => ({ ...invitation(clubId, squadId), invitationPlan: false, seriesId: null, title: 'Normal calendar training', visibility, publicationState: visibility });

async function newClub(name) {
  const owner = account(`${name} owner`);
  const created = await call('/organizations/setup', headers(owner), 'POST', { pageKind: 'CLUB', displayName: name, location: { city: 'Tbilisi' }, requestId: randomUUID() });
  assert.equal(created.status, 200);
  const clubId = created.body.clubId;
  assert.equal((await call(`/clubs/${clubId}/page/boxes/squads`, headers(owner), 'PUT', { data: { items: [{ ageGroup: 'U14', gender: 'MIXED', days: [2], time: '17:30' }] } })).status, 200);
  return { owner, clubId, squad: W.squads.find(squad => squad.clubId === clubId), page: P.clubPage(clubId) };
}

test('a draft timetable is private for its owner and absent for outsiders; LIVE preserves legacy public rows', async () => {
  const { owner, clubId, squad, page } = await newClub('Draft timetable privacy'), outsider = account('Timetable outsider');
  const saved = normal(clubId, squad.id, 'PUBLIC'), privateSession = normal(clubId, squad.id);
  W.events.push(saved, privateSession);
  try {
    assert.equal(page.status, 'DRAFT');
    const draft = (await events(clubId, headers(owner))).filter(event => event.eventType === 'TRAINING');
    assert.ok(draft.some(event => event.recurring), 'owner can preview the legacy timetable');
    assert.ok(draft.every(event => event.visibility === 'PRIVATE' && !event.publicNow));
    assert.equal((await events(clubId, headers(outsider, true))).some(event => event.eventType === 'TRAINING'), false);
    assert.equal((await call(`/schedule/events/${saved.id}`, headers(outsider))).status, 404);
    // Explicit fixture transition; the separate page publication workflow is outside this test.
    page.status = 'LIVE';
    const live = (await events(clubId, headers(outsider))).filter(event => event.eventType === 'TRAINING');
    assert.ok(live.some(event => event.recurring && event.visibility === 'PUBLIC' && event.publicNow));
    assert.ok(live.some(event => event.eventId === saved.id));
    assert.equal(live.some(event => event.eventId === privateSession.id), false, 'a live page does not publish a private normal session');
    assert.ok((await events(clubId, headers(owner))).some(event => event.eventId === privateSession.id && !event.publicNow));
    page.status = 'DRAFT';
    assert.equal((await events(clubId, headers(outsider))).some(event => event.eventType === 'TRAINING'), false);
  } finally { W.events.splice(W.events.indexOf(saved), 2); }
});

test('public training discovery filters draft/empty sources before its sample limit and keeps seeded public timetables', async () => {
  const { clubId, squad, page } = await newClub('Discovery timetable privacy'), outsider = account('Discovery outsider');
  const original = [...W.squads];
  const empty = { ...squad, id: W.newId(), trainingDays: [], trainingTime: null };
  W.squads.splice(0, W.squads.length, squad, empty, ...original.filter(row => row !== squad));
  const discover = async () => (await call('/tournaments/discovery', headers(outsider), 'GET', undefined, { activity: 'TRAINING', size: '100' })).body.items;
  try {
    const draft = await discover();
    assert.ok(draft.some(row => row.kind === 'SESSION' && row.context === 'Weekly public timetable'), 'existing public legacy timetables remain');
    assert.equal(draft.some(row => row.destination === `/clubs/${clubId}?tab=teams&squad=${squad.id}`), false);
    page.status = 'LIVE';
    const live = await discover();
    assert.ok(live.some(row => row.destination === `/clubs/${clubId}?tab=teams&squad=${squad.id}`));
    assert.equal(live.some(row => row.destination === `/clubs/${clubId}?tab=teams&squad=${empty.id}`), false);
  } finally { W.squads.splice(0, W.squads.length, ...original); }
});

test('invitation plans never mirror into club calendars or detail, while normal authorized calendar items remain', async () => {
  const { owner, clubId, squad } = await newClub('Canonical invitation privacy');
  const invited = W.newId(), other = W.newId(), invitedGuardian = account('Invited calendar guardian'), otherGuardian = account('Uninvited calendar guardian');
  squad.playerIds.push(invited, other); invitedGuardian.children = [{ id: invited }]; otherGuardian.children = [{ id: other }];
  const plan = invitation(clubId, squad.id, [invited]), ordinary = normal(clubId, squad.id), seeded = invitation(1, 103, [W.squadById(103).playerIds[0]]);
  W.events.push(plan, ordinary, seeded);
  try {
    for (const actorHeaders of [headers(owner), headers(invitedGuardian), headers(otherGuardian, true)]) {
      const rows = await events(clubId, actorHeaders);
      assert.equal(rows.some(event => event.eventId === plan.id || event.occurrenceId === `squad:${squad.id}:${plan.id}`), false, 'cannot replace the canonical SQUAD_SESSION card during merge');
      assert.ok(rows.some(event => event.eventId === ordinary.id), 'normal private calendar access is preserved');
      assert.equal((await call(`/schedule/events/${plan.id}`, actorHeaders)).status, 404);
    }
    assert.equal((await events(1, {})).some(event => event.eventId === seeded.id), false);
    assert.equal((await call(`/schedule/events/${seeded.id}`)).status, 404);
    assert.equal((await call('/schedule/public-events')).body.events.some(event => [plan.id, seeded.id].includes(event.eventId)), false);
    const discovery = await call('/tournaments/discovery', headers(otherGuardian), 'GET', undefined, { size: '100' });
    assert.equal(discovery.body.items.some(event => [plan.id, seeded.id].includes(event.id)), false);
  } finally { W.events.splice(W.events.indexOf(plan), 3); }
});

test('private invitation audience and child membership do not confer staff planning context', async () => {
  await call('/match-exchange/squads');
  const squad = W.squadById(103), players = [...squad.playerIds], invited = W.newId(), sibling = W.newId(), other = W.newId();
  const guardian = account('Planning invited guardian'), outsider = account('Planning uninvited guardian');
  guardian.children = [{ id: invited }, { id: sibling }]; outsider.children = [{ id: other }]; squad.playerIds.push(invited, sibling, other);
  const people = [invited, sibling, other].map(id => ({ id, fullName: `Planning child ${id}` }));
  W.people.push(...people);
  const plan = invitation(1, squad.id, [invited]), staffOnly = invitation(1, squad.id), ordinary = normal(1, squad.id);
  // Put the audience fixture inside the cap; the following test separately checks filtering before the cap.
  W.events.unshift(plan, staffOnly, ordinary);
  const contextIds = async actorHeaders => (await call('/map/plans/context', actorHeaders)).body.flatMap(context => context.sessions.map(session => session.id));
  try {
    const staff = await contextIds({});
    assert.ok(staff.includes(plan.id) && staff.includes(staffOnly.id) && staff.includes(ordinary.id));
    const own = await contextIds(headers(guardian));
    assert.deepEqual(own, []);
    assert.equal(own.includes(staffOnly.id), false);
    const unrelated = await contextIds(headers(outsider, true));
    assert.equal(unrelated.includes(plan.id) || unrelated.includes(staffOnly.id), false);
    assert.deepEqual(unrelated, [], 'family calendar access does not grant private staff context');
    guardian.children = [{ id: sibling }];
    assert.equal((await contextIds(headers(guardian))).includes(plan.id), false, 'an uninvited sibling grants no invitation');
    guardian.children = [{ id: invited }]; squad.playerIds = squad.playerIds.filter(id => id !== invited);
    assert.equal((await contextIds(headers(guardian))).includes(plan.id), false, 'a stale child roster link grants no invitation');
  } finally {
    squad.playerIds = players; W.events.splice(W.events.indexOf(plan), 3);
    for (const person of people) W.people.splice(W.people.indexOf(person), 1);
  }
});

test('planning context filters unauthorized rows before the forty-session cap', async () => {
  const { clubId, squad } = await newClub('Other club private planning');
  const privateRows = Array.from({ length: 45 }, () => invitation(clubId, squad.id));
  const ours = normal(1, 103), published = normal(1, 103, 'PUBLIC'), original = [...W.events];
  W.events.splice(0, W.events.length, ...privateRows, ours, published, ...original);
  try {
    const staff = (await call('/map/plans/context')).body.flatMap(context => context.sessions);
    assert.ok(staff.some(session => session.id === ours.id));
    assert.ok(staff.some(session => session.id === published.id));
    assert.equal(staff.some(session => privateRows.some(event => event.id === session.id)), false);
    assert.ok(staff.length <= 40);
    const outsider = (await call('/map/plans/context', headers(account('Context outsider'), true))).body.flatMap(context => context.sessions);
    assert.deepEqual(outsider, [], 'a public session is not a staff planning responsibility');
    assert.equal(outsider.some(session => session.id === ours.id || privateRows.some(event => event.id === session.id)), false);
  } finally { W.events.splice(0, W.events.length, ...original); }
});
