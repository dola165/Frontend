import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { handleApi } from './router.mjs';
import * as P from './pages-data.mjs';
import * as V from './viewer.mjs';
import * as W from './world.mjs';

const account = name => V.createAccount({ fullName: name, email: `${randomUUID()}@example.org`, password: 'synthetic-only', dateOfBirth: '1985-05-02', town: 'Rustavi' });
async function api(viewer, method, path, body) {
  const response = await handleApi({ method, path, body, headers: { cookie: `gk-sandbox-user=${viewer.id}` }, query: new URLSearchParams() });
  assert.ok(response, `Missing handler: ${method} ${path}`);
  assert.equal(response.status, 200, `${method} ${path}: ${JSON.stringify(response.body)}`);
  return response.body;
}
async function newClub() {
  const owner = account('Club owner');
  const created = await api(owner, 'POST', '/organizations/setup', { requestId: randomUUID(), pageKind: 'CLUB', displayName: `Identity FC ${randomUUID()}`, location: { city: 'Rustavi' } });
  const page = P.clubPage(created.clubId);
  return { owner, page, clubId: created.clubId };
}
const identity = (ageGroup = 'U12') => ({ name: `${ageGroup} Boys`, ageGroup, gender: 'MALE', days: [], time: null, groundId: null });
const savedIdentities = page => P.viewOf(page, page.ownerId).boxes.squads.items.map(({ id, name, ageGroup, gender, days, time, groundId }) => ({ id, name, ageGroup, gender, days, time, groundId }));
const saveTeams = (owner, page, items) => api(owner, 'PUT', `/clubs/${page.clubId}/page/boxes/squads`, { version: page.boxes.squads.version, data: { items } });
async function inviteCoach(owner, page, squad) {
  const coach = account('Invited coach');
  await api(owner, 'PUT', `/clubs/${page.clubId}/page/boxes/staff`, { version: page.boxes.staff.version, data: { invites: [{ name: coach.fullName, role: 'COACH', squadId: squad.id }] } });
  const invite = page.boxes.staff.invites.at(-1);
  await api(coach, 'POST', `/invite/${invite.code}/accept`);
  return coach;
}
const coachingLinks = user => user.navigationCapabilities.workspaces.filter(item => item.id === 'squad.workspace');

test('new-owner team identity creates no coaching appointment, role or My squads capability', async () => {
  const { owner, page, clubId } = await newClub();
  const before = await api(owner, 'GET', '/users/me');
  const rolesBefore = structuredClone(owner.roles);
  assert.equal(coachingLinks(before).length, 0);

  // Identity writes cannot appoint a coach, even if a caller includes a coach field.
  const saved = await saveTeams(owner, page, [{ ...identity(), headCoachId: owner.id }]);
  assert.equal(P.squadsOf(page)[0].headCoachId, null);
  assert.equal(saved.boxes.squads.items[0].coach, null);
  const directory = await api(owner, 'GET', `/clubs/${clubId}/staff-directory`);
  assert.deepEqual(directory.map(p => ({ userId: p.userId, role: p.role, responsibilities: p.responsibilities })), [{ userId: owner.id, role: 'OWNER', responsibilities: [] }]);

  const after = await api(owner, 'GET', '/users/me');
  assert.equal(after.role, before.role);
  assert.deepEqual(owner.roles, rolesBefore);
  assert.deepEqual(after.navigationCapabilities, before.navigationCapabilities);
  assert.equal(coachingLinks(after).length, 0, 'No squad.workspace capability: the My squads pin gate remains off');
  assert.equal(P.roleOf(page, owner.id), 'OWNER');
  assert.equal(P.canEdit(page, owner.id), true);
  assert.equal((await api(owner, 'GET', `/clubs/${clubId}/workspace-entry`)).canManageStaff, true);
});

test('accepted explicit coaching survives later team identification and another unassigned team', async () => {
  const { owner, page } = await newClub();
  await saveTeams(owner, page, [identity()]);
  const squad = P.squadsOf(page)[0];
  const coach = await inviteCoach(owner, page, squad);
  assert.equal(squad.headCoachId, coach.id);
  const before = await api(coach, 'GET', '/users/me');
  assert.deepEqual(coachingLinks(before).map(link => link.context.id), [squad.id]);

  const identities = savedIdentities(page);
  const saved = await saveTeams(owner, page, [{ ...identities[0], name: 'Lions U12', headCoachId: owner.id }, identity('U14')]);
  assert.equal(squad.headCoachId, coach.id, 'Identity edits do not replace a recorded coach');
  assert.equal(saved.boxes.squads.items.find(s => s.id === squad.id).coach.userId, coach.id);
  assert.equal(P.squadsOf(page).find(s => s.id !== squad.id).headCoachId, null);
  const directory = await api(owner, 'GET', `/clubs/${page.clubId}/staff-directory`);
  const recorded = directory.find(p => p.userId === coach.id);
  assert.equal(recorded.role, 'COACH');
  assert.deepEqual(recorded.responsibilities.map(r => ({ title: r.title, squadId: r.squadId, provenance: r.provenance })), [{ title: 'Head coach', squadId: squad.id, provenance: 'RECORDED_APPOINTMENT' }]);
  const after = coachingLinks(await api(coach, 'GET', '/users/me'));
  assert.deepEqual(after.map(link => link.context.id), coachingLinks(before).map(link => link.context.id));
  assert.equal(after[0].context.label, 'Lions U12');
  assert.deepEqual(coachingLinks(await api(owner, 'GET', '/users/me')), []);
  assert.equal(P.canEdit(page, owner.id), true);
});

test('an existing owner-coach appointment is retained when another coach accepts a staff invite', async () => {
  const { owner, page } = await newClub();
  await saveTeams(owner, page, [identity()]);
  const squad = P.squadsOf(page)[0];
  // Existing recorded assignment: this slice must not migrate or erase such appointments.
  squad.headCoachId = owner.id;
  const before = await api(owner, 'GET', '/users/me');
  const invited = await inviteCoach(owner, page, squad);
  assert.equal(squad.headCoachId, owner.id);
  assert.equal(P.roleOf(page, owner.id), 'OWNER');
  assert.equal(P.canEdit(page, owner.id), true);
  assert.equal(P.roleOf(page, invited.id), 'COACH');
  assert.deepEqual(coachingLinks(await api(owner, 'GET', '/users/me')), coachingLinks(before));
  const ownerEntry = P.staffOf(page).find(p => p.userId === owner.id);
  assert.equal(ownerEntry.role, 'OWNER');
  assert.deepEqual(ownerEntry.responsibilities.map(r => r.squadId), [squad.id]);
  assert.deepEqual(P.staffOf(page).find(p => p.userId === invited.id).responsibilities, []);
});

