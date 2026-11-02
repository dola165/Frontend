import assert from 'node:assert/strict';
import test from 'node:test';
import { handleApi } from '../router.mjs';
import * as W from '../world.mjs';
import * as F from '../world-football.mjs';
import * as V from '../viewer.mjs';
import * as H from '../world-home.mjs';
import { PERSONA_JOBS } from '../world-my-squads.mjs';
import { collectMatchMoments, matchRecordView, matchAdditionsReadable } from '../home-match-moments.mjs';
import { partiallyRecordedRegister } from '../home-pending.mjs';
import { helpers } from './my-squads.mjs';
import { STAFF_CHOOSER } from '../home-staff-choice.mjs';
import { ANA, GIORGI } from '../world-parents.mjs';

const as = persona => ({ cookie: `gk-sandbox-persona=${persona}` });
const user = id => ({ authorization: `Bearer ${V.accessToken(id)}` });
const call = (headers, method, path, body) => {
    const url = new URL(path, 'http://sandbox.test');
    return handleApi({ method, path: url.pathname, query: url.searchParams, headers, body });
};
const restore = (record, saved) => { for (const key of Object.keys(record)) delete record[key]; Object.assign(record, saved); };

test('H-B1: an optional empty or EXPECTED-only register is not a task; saved partial work is', () => {
    assert.equal(partiallyRecordedRegister([{ register: null }, { register: null }]), false);
    assert.equal(partiallyRecordedRegister([{ register: 'EXPECTED' }, { register: null }]), false);
    assert.equal(partiallyRecordedRegister([{ register: 'ARRIVED' }, { register: null }]), true);
    assert.equal(partiallyRecordedRegister([{ register: 'ABSENT' }, { register: 'EXPECTED' }]), true);
    assert.equal(partiallyRecordedRegister([{ register: 'ARRIVED' }, { register: 'ABSENT' }]), false);
});

test('H-B5: late FINALIZE or correction cannot backfill the original pre-rollout 48-hour moment', () => {
    const match = F.listingById(5721), saved = structuredClone(match), immediate = F.listingById(5726), immediateSaved = structuredClone(immediate), posts = [];
    const now = new Date(), report = new Date(+now - 3 * 864e5).toISOString();
    const create = (kind, clubId, moment) => { const p = { clubId, record: { kind, moment, eventIds: [], version: 0 } }; posts.push(p); return p; };
    try {
        match.resultStatus = 'FINAL'; match.resultHistory = [{ action: 'REPORT', created_at: report }, { action: 'CORRECT', created_at: now.toISOString() }, { action: 'FINALIZE', created_at: now.toISOString() }];
        collectMatchMoments(posts, create, () => ({ off: new Set() }), now);
        assert.equal(posts.filter(p => p.record.kind === 'RESULTS').length, 0);
        match.resultStatus = 'REPORTED';
        match.resultHistory = [{ action: 'REPORT', created_at: new Date(+now - 48 * 3600e3 + 1000).toISOString() }];
        collectMatchMoments(posts, create, () => ({ off: new Set() }), new Date(+now + 1001));
        assert.ok(posts.some(p => p.record.kind === 'RESULTS' && p.record.eventIds.includes(match.id)));
        immediate.resultStatus = 'FINAL'; immediate.resultHistory = [{ action: 'REPORT', created_at: now.toISOString() }];
        collectMatchMoments(posts, create, () => ({ off: new Set() }), now);
        assert.ok(posts.some(p => p.record.kind === 'RESULTS' && p.record.eventIds.includes(immediate.id)), 'a no-responder FINAL stands at its actual report time');
    } finally { restore(match, saved); restore(immediate, immediateSaved); }
});

test('H-B3: U11/listing ages, both current families/staff, revocation and mixed additions follow the server rule', () => {
    const match = F.listingById(5729), home = F.sq(match.hostSquadId), away = F.sq(match.opponentSquadId);
    const saved = structuredClone(match), homeSaved = structuredClone(home), jobs = structuredClone(PERSONA_JOBS.gkcoach);
    const account = name => V.createAccount({ fullName: name, email: `${name}@sandbox.test`, password: 'synthetic', dateOfBirth: '1989-01-01' });
    const outsider = account('outsider'), family = account('homefamily'), awayFamily = account('awayfamily'), unrelated = account('unrelatedfamily');
    family.children = [{ id: home.playerIds[0] }]; awayFamily.children = [{ id: away.playerIds[0] }];
    unrelated.children = [{ id: W.squadById(102).playerIds.find(id => !home.playerIds.includes(id) && !away.playerIds.includes(id)) }];
    const post = { id: 990001, clubId: home.clubId, record: { kind: 'RESULTS', eventIds: [match.id], moment: '2026-10-30' } };
    const base = { line: 'Child Secret addition', photoIds: [990002] };
    const view = (id, headers = user(id)) => matchRecordView(post, base, id, headers);
    try {
        Object.assign(match, { start: new Date(Date.now() - 3 * 3600e3), end: new Date(Date.now() - 3600e3), score: [2, 1], resultStatus: 'CONFIRMED', resultHistory: [{ action: 'CONFIRM', created_at: new Date().toISOString() }], title: 'Child Secret match title', ageGroup: 'U14' });
        home.category = 'U11'; home.name = 'Child Secret squad';
        assert.equal(view(outsider.id), null);
        outsider.clubFollows.add(home.clubId); assert.equal(view(outsider.id), null, 'a follow gives no family access');
        assert.equal(view(unrelated.id), null);
        for (const person of [family, awayFamily]) {
            assert.equal(view(person.id).matches[0].homeScore, 2);
            assert.equal(matchAdditionsReadable(post, person.id, user(person.id)), true);
        }
        assert.equal(view(W.ME_ID, as('gkcoach')).matches[0].homeSquad, 'U11');
        PERSONA_JOBS.gkcoach = []; assert.equal(view(W.ME_ID, as('gkcoach')), null);
        family.children = []; assert.equal(view(family.id), null);
        assert.equal(matchAdditionsReadable(post, family.id, user(family.id)), false);
        family.children = [{ id: home.playerIds[0] }]; home.playerIds = home.playerIds.slice(1);
        assert.equal(view(family.id), null, 'current roster loss also revokes access');
        home.category = 'U14'; match.ageGroup = 'Under 11';
        assert.equal(view(outsider.id), null, 'the canonical listing age is protected even with older squads');
        const calendar = W.events.find(e => e.id === match.id), priorAge = calendar.ageGroup;
        try {
            match.ageGroup = null; calendar.ageGroup = 'U11';
            assert.equal(view(outsider.id), null, 'calendar age is used when the listing age is absent');
        } finally { if (priorAge === undefined) delete calendar.ageGroup; else calendar.ageGroup = priorAge; match.ageGroup = 'Under 11'; }
        const publicMatch = F.listingById(5721); post.record.eventIds.push(publicMatch.id);
        const mixed = view(outsider.id);
        assert.deepEqual(mixed.matches.map(m => m.eventId), [publicMatch.id]);
        assert.equal(mixed.line, null); assert.equal(mixed.photoIds, null);
        assert.equal(H.photosShown(post, outsider.id, new Set([home.clubId]), user(outsider.id)), false);
        assert.ok(!JSON.stringify(mixed).includes('Child Secret'));
    } finally {
        restore(match, saved); restore(home, homeSaved); PERSONA_JOBS.gkcoach = jobs;
        for (const a of [outsider, family, awayFamily, unrelated]) V.accounts.delete(a.id);
    }
});

test('accepted helper 9703 opens its actual session/register, while empty optional work stays out of pending', async () => {
    const helper = helpers.find(h => h.id === 9703), saved = structuredClone(helper);
    try {
        assert.equal((await call(as('helper'), 'POST', '/me/helping/9703/accept')).status, 204);
        const sessions = (await call(as('helper'), 'GET', '/me/helping')).body;
        const accepted = sessions.find(s => s.helperId === 9703);
        assert.equal(accepted.sessionId, 77003); assert.equal(accepted.squadId, 103);
        assert.ok(accepted.players.every(p => p.register == null));
        const pending = (await call(as('helper'), 'GET', '/requests/pending')).body;
        assert.equal(pending.complete, true);
        assert.ok(!pending.items.some(i => i.family === 'SESSION_HELPER_WORK' && i.id === 77003));
        assert.equal((await call(as('helper'), 'GET', '/me/helping/sessions/77003/register')).status, 200);
        assert.equal((await call(as('media'), 'GET', '/me/helping/sessions/77003/register')).status, 404);
        assert.equal((await call(as('media'), 'DELETE', '/me/helping/9703')).status, 404);
        assert.equal((await call(as('headcoach'), 'DELETE', '/squad-communication/103/helpers/9703')).status, 204);
        assert.ok(!(await call(as('helper'), 'GET', '/me/helping')).body.some(s => s.helperId === 9703));
        assert.equal((await call(as('helper'), 'GET', '/me/helping/sessions/77003/register')).status, 404);
    } finally { restore(helper, saved); }
});

test('declining the actual helper invitation removes it without accepting or removing another session', async () => {
    const helper = helpers.find(h => h.id === 9703), saved = structuredClone(helper);
    try {
        assert.equal((await call(as('helper'), 'DELETE', '/me/helping/9703')).status, 204);
        const pending = (await call(as('helper'), 'GET', '/requests/pending')).body;
        assert.ok(!pending.items.some(i => i.family === 'SESSION_HELPER' && i.id === 9703));
        assert.ok((await call(as('helper'), 'GET', '/me/helping')).body.some(s => s.helperId === 9701));
    } finally { restore(helper, saved); }
});

test('staff choice uses current eligible jobs, clears pending, and keeps the first choice on retry', async () => {
    const headers = user(STAFF_CHOOSER);
    const before = await call(headers, 'GET', '/me/staff-club');
    assert.equal(before.body.needed, true); assert.equal(before.body.clubs.length, 2);
    assert.ok((await call(headers, 'GET', '/requests/pending')).body.items.some(i => i.family === 'STAFF_CLUB_CHOICE'));
    assert.equal((await call(user(ANA), 'POST', '/me/staff-club', { clubId: 1 })).status, 404);
    assert.equal((await call(headers, 'POST', '/me/staff-club', { clubId: 999999 })).status, 404);
    const chosen = await call(headers, 'POST', '/me/staff-club', { clubId: 1 });
    assert.equal(chosen.body.chosenClubId, 1); assert.equal(chosen.body.ended.length, 1);
    assert.deepEqual((await call(headers, 'POST', '/me/staff-club', { clubId: 1 })).body, chosen.body);
    assert.equal((await call(headers, 'POST', '/me/staff-club', { clubId: 16 })).status, 409);
    assert.equal((await call(headers, 'GET', '/me/staff-club')).body.needed, false);
    assert.ok(!(await call(headers, 'GET', '/requests/pending')).body.items.some(i => i.family === 'STAFF_CLUB_CHOICE'));
    assert.equal(W.staff.filter(s => s.personId === STAFF_CHOOSER && s.status === 'ACTIVE').length, 1);
});

test('generic private requests are scoped to current actor/persona, including resolved history', async () => {
    for (const headers of [as('helper'), as('media'), as('kit'), user(ANA)]) for (const view of ['INCOMING', 'HISTORY']) {
        const result = await call(headers, 'GET', `/requests?view=${view}&size=50`);
        assert.equal(result.status, 200);
        assert.ok(!result.body.items.some(i => ['CLUB_APPLICATION', 'TRYOUT_APPLICATION', 'STAFF_ROLE_REQUEST', 'STAFF_APPOINTMENT'].includes(i.family)));
        assert.deepEqual(result.body.unavailableSources, []);
    }
});

test('the existing child roster links one canonical fixture from schedule to match and only its own family call-up', async () => {
    const headers = user(ANA), path = '/match-arrangements/squads/103/fixtures?from=2026-10-30T00:00:00Z&to=2026-11-06T23:59:59Z';
    const fixtures = await call(headers, 'GET', path);
    assert.ok(fixtures.body.some(f => f.eventId === 5727 && f.origin === 'MATCH_EXCHANGE'));
    assert.ok(W.matches.some(m => m.id === 5727), 'the original football identity is retained');
    const sessions = await call(headers, 'GET', '/squad-communication/103/sessions?playerId=9611&from=2026-10-30T00:00:00Z&to=2026-11-06T23:59:59Z');
    assert.ok(!sessions.body.some(s => s.id === 5727), 'the converted match is not also an old squad-session button');
    const match = await call(headers, 'GET', '/match-exchange/5727'); assert.equal(match.status, 200);
    const participants = await call(headers, 'GET', '/match-arrangements/5727/participants');
    assert.deepEqual(participants.body.flatMap(t => t.players.map(p => p.id)), [GIORGI]);
    const unrelated = await call(user(9602), 'GET', '/match-arrangements/5727/participants');
    assert.ok(!unrelated.body.some(t => t.players.some(p => p.id === GIORGI)));
});
