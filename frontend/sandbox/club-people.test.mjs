import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleApi } from './api/router.mjs';
const call = (method, path, body, headers = {}) => handleApi({ method, path, body, headers, query: new URLSearchParams() });
test('Dinamo People and staff links expose invented step 1 jobs and isolate access', async () => {
  const people = await call('GET', '/clubs/1/people');
  assert.equal(people.status, 200);
  for (const [job, title] of [['SPECIALIST_COACH', 'Goalkeeper coach'], ['HEAD_OF_COACHING', 'Head of coaching'], ['TRAVEL_COORDINATOR', 'Travel coordinator']])
    assert.ok(people.body.people.some(p => p.jobs.some(j => j.job === job && j.title === title)));
  const links = await call('GET', '/clubs/1/staff-links');
  assert.equal(links.status, 200); assert.equal(links.body.length, 1);
  assert.equal(links.body[0].job, 'HEAD_COACH');
  assert.equal((await call('GET', '/clubs/1/people', null, { cookie: 'gk-sandbox-persona=member' })).status, 403);
  assert.equal((await call('GET', '/clubs/1/staff-links', null, { cookie: 'gk-sandbox-persona=analyst' })).status, 403);
  assert.equal((await call('GET', '/clubs/99/people')).status, 403);
});
test('synthetic invites retain the saved title and bulk links allow only the four main jobs', async () => {
  const invite = await call('POST', '/clubs/1/people/invites', { name: 'Synthetic colleague', email: 'colleague@example.test', job: 'SPECIALIST_COACH', title: 'Technique and goalkeepers', squadIds: [103] });
  assert.equal(invite.status, 200);
  const people = (await call('GET', '/clubs/1/people')).body.people;
  assert.equal(people.find(p => p.userId === invite.body.userId).jobs[0].title, 'Technique and goalkeepers');
  for (const job of ['HEAD_OF_COACHING', 'DOCTOR', 'WELFARE_OFFICER', 'CUSTOM', 'ADMIN'])
    assert.equal((await call('POST', '/clubs/1/staff-links', { job, clubWide: true, requestId: job })).status, 400);
  assert.equal((await call('POST', '/clubs/1/staff-links', { job: 'HEAD_COACH', squadIds: [999], requestId: 'wrong-club' })).status, 400);
  const body = { job: 'ASSISTANT_COACH', squadIds: [103], requestId: 'same-request' };
  const made = await call('POST', '/clubs/1/staff-links', body);
  assert.equal(made.status, 200);
  assert.equal((await call('POST', '/clubs/1/staff-links', body)).body.id, made.body.id);
  assert.equal((await call('DELETE', '/clubs/1/staff-links/' + made.body.id)).body.status, 'REVOKED');
});
const as = persona => ({ cookie: `gk-sandbox-persona=${persona}` });
test('every job holder reads Staff with what each colleague shares, and changes nothing', async () => {
  for (const persona of ['headcoach', 'physio', 'analyst']) {
    const staff = await call('GET', '/clubs/1/people', null, as(persona));
    assert.equal(staff.status, 200, persona);
    assert.equal(staff.body.viewer.leader, false);
    assert.ok(staff.body.people.every(p => p.jobs.every(j => !j.canChange && !j.canEnd)), persona);
    const giorgi = staff.body.people.find(p => p.name === 'Giorgi Abashidze');
    assert.equal(giorgi.phone, null, 'Giorgi hides his phone');
    assert.equal(giorgi.email, 'giorgi.jobs@example.test');
    assert.ok(giorgi.jobs.every(j => !j.tools.length && j.addedById === null), 'a colleague’s job is the job and where only');
    // Tamar is invited for U12: no colleague of this persona coaches it, so her invitation isn’t theirs to see.
    assert.equal(staff.body.people.some(p => p.name === 'Tamar Lomidze'), false, persona);
    assert.equal((await call('POST', '/clubs/1/people/jobs/97000/end', {}, as(persona))).status, 403);
  }
  const physio = (await call('GET', '/clubs/1/people', null, as('physio'))).body.people.find(p => p.userId === 1);
  assert.deepEqual(physio.jobs.map(j => [j.job, j.clubWide, j.tools]), [['PHYSIOTHERAPIST', true, ['MEDICAL:WRITE', 'AVAILABILITY:WRITE']]]);
  const coach = (await call('GET', '/clubs/1/people', null, as('headcoach'))).body;
  assert.deepEqual(coach.viewer.headCoachSquads, [103, 105]);
  assert.ok(!coach.people.find(p => p.userId === 1).jobs.some(j => j.kind === 'OWNER'), 'in a persona Luka is not the Owner');
});
test('without a birth date Staff asks for it first, as on the server, and opens once it is given', async () => {
  const { accountProfile } = await import('./api/world-social.mjs');
  const dob = accountProfile.dob;
  accountProfile.dob = null;
  try {
    const staff = await call('GET', '/clubs/1/people');
    assert.equal(staff.status, 403);
    assert.equal(staff.body.code, 'BIRTH_DATE_NEEDED');
    const access = (await call('GET', '/access/clubs/1')).body;
    assert.deepEqual(access.allowed, ['follow']);
    assert.ok(access.refused.some(r => r.action === 'see_staff' && r.reason === 'BIRTH_DATE_NEEDED'));
    assert.equal((await call('PUT', '/users/me', { dateOfBirth: '1988-04-12' })).status, 200);
    assert.equal((await call('GET', '/clubs/1/people')).status, 200);
    assert.ok((await call('GET', '/access/clubs/1')).body.allowed.includes('see_staff'));
  } finally { accountProfile.dob = dob; }
});
test('your own choice of what colleagues see is kept, and admins still see emails', async () => {
  assert.equal((await call('PUT', '/clubs/1/people/me/contact', { hideEmail: true, hidePhone: false }, as('physio'))).status, 200);
  assert.equal((await call('GET', '/clubs/1/people', null, as('physio'))).body.viewer.hideEmail, true);
  assert.equal((await call('PUT', '/clubs/1/people/me/contact', { hideEmail: false, hidePhone: false }, as('member'))).status, 403);
  const admin = (await call('GET', '/clubs/1/people')).body.people.find(p => p.name === 'Giorgi Abashidze');
  assert.equal(admin.email, 'giorgi.jobs@example.test');
  assert.equal(admin.phone, null);
  const tamar = (await call('GET', '/clubs/1/people')).body.people.find(p => p.name === 'Tamar Lomidze');
  assert.equal(tamar.phone, null, 'nobody sees an invitee’s phone');
});
test('the phone you add on your profile is yours to read, and Staff shows it to colleagues', async () => {
  const own = () => call('GET', '/clubs/1/people').then(staff => staff.body.people.find(p => p.userId === staff.body.viewer.userId));
  assert.equal((await own()).phone, null, 'nobody’s phone shows until they add it');
  assert.equal((await call('PUT', '/users/me', { phone: 'call me' })).status, 400);
  const saved = await call('PUT', '/users/me', { phone: '+995 555 00 11 22' });
  assert.equal(saved.body.phone, '+995 555 00 11 22');
  assert.equal((await own()).phone, '+995 555 00 11 22');
  assert.equal((await call('PUT', '/users/me', { phone: '' })).body.phone, null);
  assert.equal((await own()).phone, null);
});
test('Staff shows today’s duty on the physio’s row and the club’s outside specialists', async () => {
  const staff = (await call('GET', '/clubs/1/people')).body;
  const duty = staff.people.flatMap(p => p.onDuty).find(d => d.title.startsWith('First aid cover · U14'));
  assert.ok(duty && duty.location === 'Pitch 1');
  assert.ok(staff.specialists.some(s => s.specialisation === 'Sports psychologist' && s.contact));
});
test('the physio’s job opens only the medical tools; a head coach adds helpers on sessions, not through Staff', async () => {
  const boot = (await call('GET', '/clubs/1/operations', null, as('physio'))).body;
  assert.deepEqual(boot.modules.map(m => m.id).sort(), ['AVAILABILITY', 'MEDICAL']);
  const access = (await call('GET', '/access/clubs/1', null, as('physio'))).body;
  assert.ok(access.allowed.includes('see_staff'));
  assert.ok(access.refused.some(r => r.action === 'invite_staff' && r.reason === 'ONLY_ADMINS'));
  // Jobs are the admins' (step 3): a head coach's Invite is refused, and their helpers are added on a session.
  assert.equal((await call('POST', '/clubs/1/people/invites', { name: 'Synthetic helper', email: 'helper@example.test', job: 'TEAM_MANAGER', squadIds: [103] }, as('headcoach'))).status, 403);
  const added = await call('POST', '/squad-communication/103/sessions/5623/helpers', { name: 'Synthetic helper', email: 'helper@example.test', repeating: false, requestId: 'b4d1c2a0-0000-4000-8000-000000000001' }, as('headcoach'));
  assert.equal(added.body.name, 'Synthetic helper');
  assert.ok(added.body.link);
  assert.ok((await call('GET', '/clubs/1/helpers')).body.some(h => h.name === 'Synthetic helper' && h.squadId === 103));
  assert.equal((await call('POST', '/squad-communication/103/sessions/5623/helpers', { name: 'Other', email: 'other@example.test', repeating: false }, as('gkcoach'))).status, 403);
});
