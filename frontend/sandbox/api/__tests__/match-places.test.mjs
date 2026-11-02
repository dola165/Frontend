import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleApi } from '../router.mjs';
import * as F from '../world-football.mjs';

// Step 6, part B as the backend answers it: Luka refereeing (the `referee` persona), who played, and competition
// fixtures as matches.
const call = (path, headers = {}, method = 'GET', body = null, query = {}) => handleApi({ method, path, headers, query: new URLSearchParams(query), body });
const referee = { cookie: 'gk-sandbox-persona=referee' };

test('a referee has My matches: his appointments between other clubs, each his own on the match page', async () => {
  const me = (await call('/users/me', referee)).body;
  assert.deepEqual(me.navigationCapabilities.workspaces.map(w => w.id), ['referee.workspace']);
  const hub = (await call('/referees/me', referee)).body;
  assert.deepEqual(hub.appointments.map(a => a.status), ['INVITED', 'ACCEPTED', 'ACCEPTED', 'ACCEPTED']);
  assert.equal(hub.appointments.filter(a => a.report_submitted_at).length, 1, 'one refereed and reported');
  const page = (await call(`/match-exchange/${hub.appointments[0].event_id}`, referee)).body;
  assert.equal(page.own_appointments.length, 1);
  assert.equal(page.can_arrange, false, 'a referee, not a club');
  assert.equal((await call('/referees/me')).body.profile, null, 'the coach has no referee profile');
  // He answers his invitation from the match page.
  const invited = hub.appointments.find(a => a.status === 'INVITED');
  assert.deepEqual(invited.allowed_actions, ['ACCEPT', 'DECLINE']);
  const accepted = await call(`/referees/me/appointments/${invited.id}/decision`, referee, 'POST', { action: 'ACCEPT' });
  assert.equal(accepted.body.status, 'ACCEPTED');
  assert.equal((await call(`/referees/me/appointments/${invited.id}/decision`, referee, 'POST', { action: 'DECLINE' })).status, 409);
});

test('an offer to referee is pending until the club chooses, and can be withdrawn', async () => {
  const [open] = (await call('/match-arrangements/official-requests', referee)).body;
  await call(`/match-arrangements/${open.event_id}/official-request/apply`, referee, 'POST', { revision: open.revision });
  let mine = (await call('/match-arrangements/official-requests', referee)).body.find(r => r.event_id === open.event_id);
  assert.equal(mine.application_status, 'PENDING');
  await call(`/match-arrangements/${open.event_id}/official-request/withdraw`, referee, 'POST', {});
  mine = (await call('/match-arrangements/official-requests', referee)).body.find(r => r.event_id === open.event_id);
  assert.equal(mine.application_status, 'WITHDRAWN');
});

test('who played is the call-ups saved at kick-off; staff change it for 48 hours, the other side confirms an added player', async () => {
  const live = F.exchange.find(l => l.status === 'ARRANGED' && l.opponentSquadId && l.start.getTime() <= Date.now() && l.end.getTime() > Date.now() && F.involves(l, [F.DINAMO]));
  const upcoming = F.exchange.find(l => l.status === 'ARRANGED' && l.opponentSquadId && l.start.getTime() > Date.now() && F.involves(l, [F.DINAMO]));
  assert.deepEqual((await call(`/match-arrangements/${upcoming.id}/who-played`)).body.teams, [], 'nothing before kick-off');
  // Six of the squad were called up (one family said she can't come), so others are left to add.
  const squad = [live.hostSquadId, live.opponentSquadId].map(id => F.sq(id)).find(s => s.clubId === F.DINAMO);
  await call(`/match-arrangements/${live.id}/squads/${squad.id}/participants`, {}, 'POST', { playerIds: squad.playerIds.slice(0, 6), revision: live.revision });
  const list = (await call(`/match-arrangements/${live.id}/who-played`)).body;
  const ours = list.teams[0];
  assert.equal(ours.players.filter(p => !p.played).length, 1, 'the one who said they can’t come');
  const noShow = ours.players.find(p => p.played);
  const change = { playerId: noShow.id, played: false, revision: list.revision, requestId: 'take-off-1' };
  const after = (await call(`/match-arrangements/${live.id}/squads/${ours.squadId}/who-played`, {}, 'POST', change)).body;
  assert.equal(after.teams[0].players.find(p => p.id === noShow.id).played, false);
  // A retry of the same change is the change already made; a change made on the old list is refused (fix round 1).
  assert.equal((await call(`/match-arrangements/${live.id}/squads/${ours.squadId}/who-played`, {}, 'POST', change)).body.revision, after.revision);
  const stale = await call(`/match-arrangements/${live.id}/squads/${ours.squadId}/who-played`, {}, 'POST', { ...change, played: true, requestId: 'put-back-1' });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.code, 'WHO_PLAYED_CHANGED');
  const added = (await call(`/match-arrangements/${live.id}/squads/${ours.squadId}/who-played/additions`, {}, 'POST', { playerId: ours.others[0].id, requestId: 'add-1' })).body;
  const ourAddition = added.additions.find(a => a.squadId === ours.squadId);
  assert.equal(ourAddition.status, 'PENDING', 'the other club confirms it');
  assert.equal(ourAddition.confirmer, 'OTHER_CLUB');
  const theirs = added.additions.find(a => a.canDecide);
  assert.ok(!theirs.playerName.includes(' ') || /^\S+ \S\.$/.test(theirs.playerName), 'the other side reads a child-safe name');
  const confirmed = (await call(`/match-arrangements/${live.id}/who-played/additions/${theirs.id}`, {}, 'POST', { action: 'CONFIRM' })).body;
  assert.equal(confirmed.additions.some(a => a.id === theirs.id), false, 'answered');
  const old = F.exchange.find(l => l.status === 'ARRANGED' && l.opponentSquadId && l.start.getTime() < Date.now() - 49 * 3600e3 && F.involves(l, [F.DINAMO]));
  const team = (await call(`/match-arrangements/${old.id}/who-played`)).body.teams[0];
  const closed = await call(`/match-arrangements/${old.id}/squads/${team.squadId}/who-played`, {}, 'POST', { playerId: team.players[0].id, played: false });
  assert.equal(closed.status, 409);
});

test('a competition fixture between two squads is one match: in the squad’s week, opened from the competition, its result the organiser’s', async () => {
  const fixture = F.tournamentState.get(301).fixtures.find(f => f.matchId && F.listingById(f.matchId).hostSquadId === 101 && new Date(f.scheduledAt).getTime() > Date.now());
  const match = F.listingById(fixture.matchId);
  assert.equal(match.origin, 'COMPETITION');
  const page = (await call(`/match-exchange/${match.id}`)).body;
  assert.equal(page.competition_name, 'Tbilisi Community League');
  const week = (await call('/match-arrangements/squads/101/fixtures', {}, 'GET', null, { from: new Date().toISOString(), to: new Date(Date.now() + 40 * 864e5).toISOString() })).body;
  assert.ok(week.some(o => o.eventId === match.id || o.originId === match.id), 'in the squad’s week');
  const listed = (await call('/match-history', {}, 'GET', null, { tournamentId: '301', period: 'UPCOMING', size: '50' })).body.items;
  assert.equal(listed.filter(h => h.detailPath === `/matches/${match.id}`).length, 1, 'listed once, opening the match');
  const all = (await call('/match-history', {}, 'GET', null, { period: 'ALL', size: '100' })).body.items;
  assert.equal(all.filter(h => h.source === 'MATCH_EXCHANGE' && h.sourceId === match.id).length, 0, 'never twice');
});

test('a past match is a match of its own: the club’s own final score, no who played', async () => {
  const added = await call('/match-history/import', {}, 'POST', { homeSquadId: 103, outsideOpponent: 'Old Town FC', startsAt: new Date(Date.now() - 3 * 864e5).toISOString(), endsAt: new Date(Date.now() - 3 * 864e5 + 90 * 6e4).toISOString(), homeScore: 2, awayScore: 1, requestId: '00000000-0000-4000-8000-000000000001' });
  assert.equal(added.status, 201);
  assert.equal(added.body.detailPath, `/matches/${added.body.eventId}`);
  const page = (await call(`/match-exchange/${added.body.eventId}`)).body;
  assert.equal(page.origin, 'PAST');
  const score = (await call(`/match-exchange/${added.body.eventId}/result`)).body;
  assert.equal(score.status, 'FINAL');
  assert.equal(score.reported.side, 'HOME');
  assert.deepEqual((await call(`/match-arrangements/${added.body.eventId}/who-played`)).body.teams, [], 'no call-ups, no who played');
  assert.equal((await call(`/match-arrangements/${added.body.eventId}/squads/103/who-played/additions`, {}, 'POST', { playerId: 1 })).status, 409);
});
