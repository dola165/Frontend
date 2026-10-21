import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as W from './world.mjs';
import * as V from './viewer.mjs';
import { createPage, ownedPages } from './pages-data.mjs';
import { squadAccess } from './squad-access.mjs';
import { handleApi } from './router.mjs';

const account = name => V.createAccount({ fullName: name, email: `${name.replaceAll(' ', '.')}@example.test`, dateOfBirth: '1990-01-01' });
const headers = actor => ({ authorization: `Bearer ${V.accessToken(actor.id)}`, cookie: `gk-sandbox-user=${actor.id}` });
const assign = (squad, actor, body) => handleApi({ method: 'PUT', path: `/squad-communication/${squad.id}/coach`, headers: headers(actor), query: new URLSearchParams(), body });
function fixture() {
  const owner = account('Assignment owner');
  assert.equal(createPage(owner.id, { pageKind: 'CLUB', displayName: `Assignment club ${owner.id}` }).status, 200);
  const page = ownedPages(owner.id).find(page => page.clubId);
  const current = account('Assignment current coach'), eligible = account('Assignment eligible coach'), admin = account('Assignment admin');
  page.staff.set(current.id, 'COACH'); page.staff.set(eligible.id, 'COACH'); page.staff.set(admin.id, 'ADMIN');
  for (const actor of [current, eligible]) W.staff.push({ personId: actor.id, clubId: page.clubId, kind: 'COACH', title: 'Coach' });
  const squad = { id: W.newId(), clubId: page.clubId, name: 'Assignment fixture U12', ageGroup: 'U12', headCoachId: current.id, playerIds: [] };
  W.squads.push(squad);
  return { owner, admin, current, eligible, page, squad };
}
function membershipSnapshot(f) {
  return JSON.stringify({ staff: W.staff, roles: [...f.page.staff.entries()], owner: f.page.ownerId, accounts: [...V.accounts.values()].map(a => ({ id: a.id, roles: a.roles })) });
}

test('a managing head coach cannot reassign or clear the appointment', async () => {
  const f = fixture();
  assert.equal(squadAccess(f.squad, headers(f.current)).canManage, true);
  assert.equal(squadAccess(f.squad, headers(f.current)).canAssignCoach, false);
  const before = membershipSnapshot(f);
  for (const userId of [f.eligible.id, null]) {
    const result = await assign(f.squad, f.current, { userId });
    assert.equal(result.status, 403); assert.equal(f.squad.headCoachId, f.current.id);
    assert.equal(membershipSnapshot(f), before);
  }
});

for (const role of ['owner', 'admin']) test(`current page ${role} can appoint an eligible club coach and explicitly clear without changing roles`, async () => {
  const f = fixture(), actor = f[role], before = membershipSnapshot(f);
  assert.equal(squadAccess(f.squad, headers(actor)).canAssignCoach, true);
  const saved = await assign(f.squad, actor, { userId: f.eligible.id });
  assert.equal(saved.status, 200); assert.equal(saved.body.head_coach_id, f.eligible.id);
  assert.equal(saved.body.can_assign_coach, true);
  assert.ok(saved.body.available_coaches.some(c => c.user_id === f.eligible.id));
  assert.equal(f.squad.headCoachId, f.eligible.id); assert.equal(membershipSnapshot(f), before);
  const cleared = await assign(f.squad, actor, { userId: null });
  assert.equal(cleared.status, 200); assert.equal(cleared.body.head_coach_id, null);
  assert.equal(f.squad.headCoachId, null); assert.equal(membershipSnapshot(f), before);
});

test('leadership cannot appoint a coach from another club', async () => {
  const f = fixture(), other = fixture(), before = membershipSnapshot(f);
  const result = await assign(f.squad, f.owner, { userId: other.eligible.id });
  assert.equal(result.status, 400); assert.equal(f.squad.headCoachId, f.current.id);
  assert.equal(membershipSnapshot(f), before);
});

test('an existing account or public coach identity does not grant club eligibility', async () => {
  const f = fixture(), outsider = account('Assignment public coach'); outsider.roles = [{ role: 'COACH', published: true }];
  const before = membershipSnapshot(f);
  const result = await assign(f.squad, f.owner, { userId: outsider.id });
  assert.equal(result.status, 400); assert.equal(f.squad.headCoachId, f.current.id);
  assert.equal(membershipSnapshot(f), before);
});

test('invalid target values and omitted userId cannot silently clear or change the appointment', async () => {
  const f = fixture(), before = membershipSnapshot(f);
  for (const body of [{}, null, { userId: undefined }, { userId: 0 }, { userId: -1 }, { userId: 1.5 }, { userId: Number.MAX_SAFE_INTEGER + 1 }, { userId: 'not-a-coach' }, { userId: String(f.eligible.id) }, { userId: false }, { userId: [] }, { userId: 987654321 }]) {
    const result = await assign(f.squad, f.owner, body);
    assert.equal(result.status, 400, JSON.stringify(body)); assert.equal(f.squad.headCoachId, f.current.id);
    assert.equal(membershipSnapshot(f), before);
  }
});

test('eligibility is rechecked after the candidate leaves the current club coach list', async () => {
  const f = fixture();
  const initial = await assign(f.squad, f.owner, { userId: f.current.id });
  assert.equal(initial.status, 200); assert.ok(initial.body.available_coaches.some(c => c.user_id === f.eligible.id));
  W.staff.splice(W.staff.findIndex(row => row.personId === f.eligible.id && row.clubId === f.squad.clubId), 1);
  f.page.staff.delete(f.eligible.id); const before = membershipSnapshot(f);
  const result = await assign(f.squad, f.owner, { userId: f.eligible.id });
  assert.equal(result.status, 400); assert.equal(f.squad.headCoachId, f.current.id);
  assert.equal(membershipSnapshot(f), before);
});

test('a former administrator with remaining squad management cannot reuse an old assignment grant', async () => {
  const f = fixture(); f.squad.headCoachId = f.admin.id;
  assert.equal(squadAccess(f.squad, headers(f.admin)).canAssignCoach, true);
  f.page.staff.set(f.admin.id, 'COACH');
  assert.equal(squadAccess(f.squad, headers(f.admin)).canManage, true);
  assert.equal(squadAccess(f.squad, headers(f.admin)).canAssignCoach, false);
  const before = membershipSnapshot(f), result = await assign(f.squad, f.admin, { userId: f.eligible.id });
  assert.equal(result.status, 403); assert.equal(f.squad.headCoachId, f.admin.id);
  assert.equal(membershipSnapshot(f), before);
});

test('seeded legitimate leadership can still appoint a current seeded coach on an isolated squad', async () => {
  const original = W.squadById(103).headCoachId, candidate = W.staff.find(row => row.clubId === 1 && row.kind === 'COACH');
  const squad = { ...W.squadById(103), id: W.newId(), playerIds: [] }; W.squads.push(squad);
  const before = JSON.stringify(W.staff), result = await assign(squad, { id: W.ME_ID }, { userId: candidate.personId });
  assert.equal(result.status, 200); assert.equal(squad.headCoachId, candidate.personId);
  assert.equal(result.body.can_assign_coach, true); assert.equal(JSON.stringify(W.staff), before);
  assert.equal(W.squadById(103).headCoachId, original);
});
