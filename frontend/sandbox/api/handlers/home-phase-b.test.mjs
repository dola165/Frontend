import assert from 'node:assert/strict';
import test from 'node:test';
import { handleApi } from '../router.mjs';
import * as W from '../world.mjs';
import * as F from '../world-football.mjs';
import * as S from '../world-social.mjs';
import * as H from '../world-home.mjs';
import { weekendFriday } from '../home-match-moments.mjs';
const request = (persona, path) => handleApi({ method: 'GET', path: path.split('?')[0], query: new URLSearchParams(path.split('?')[1] ?? ''), headers: { cookie: `gk-sandbox-persona=${persona}` } });

test('canonical helper invitation is actionable in Inbox and accepted work is kept in history', async () => {
    const pending = await request('helper', '/requests?view=INCOMING&size=50');
    assert.equal(pending.status, 200);
    assert.ok(pending.body.items.some(i => i.family === 'SESSION_HELPER' && i.actionable && i.destination.startsWith('/home?helper=')));
    const history = await request('helper', '/requests?view=HISTORY&size=50');
    assert.ok(history.body.items.some(i => i.family === 'SESSION_HELPER' && !i.actionable && i.destination.startsWith('/home?helping=')));
});

test('read-only or unrelated jobs do not get match-result decisions', async () => {
    for (const persona of ['media', 'kit', 'gkcoach', 'helper']) {
        const pending = await request(persona, '/requests?view=INCOMING&size=50');
        assert.equal(pending.status, 200);
        assert.equal(pending.body.items.some(i => i.family === 'MATCH_RESULT'), false, persona);
    }
});

test('results grow from existing canonical scores without startup backfill and never duplicate', () => {
    const m = F.exchange.find(m => m.score && m.origin !== 'PAST' && m.opponentSquadId && m.status !== 'CANCELLED');
    const saved = structuredClone(m);
    try {
        H.sweepMatchMoments();
        assert.equal(S.posts.filter(p => p.record?.kind === 'RESULTS').length, 0);
        m.resultStatus = 'CONFIRMED'; m.resultHistory = [{ action: 'CONFIRM', created_at: new Date().toISOString() }];
        H.sweepMatchMoments();
        const posts = S.posts.filter(p => p.record?.kind === 'RESULTS' && p.record.eventIds.includes(m.id));
        assert.ok(posts.length > 0); const ids = posts.map(p => p.id);
        H.sweepMatchMoments(); assert.deepEqual(S.posts.filter(p => p.record?.kind === 'RESULTS').map(p => p.id), ids);
        const post = posts.find(p => p.clubId === W.squads.find(s => s.id === m.hostSquadId).clubId);
        const view = H.recordView(post, W.ME_ID, {}); assert.ok(view.matches.some(line => line.eventId === m.id));
        assert.equal(view.matches[0].homeScore, m.score[0]);
        m.resultStatus = 'DISPUTED'; assert.equal(H.recordView(post, W.ME_ID, {}), null);
    } finally { Object.assign(m, saved); }
});

test('Friday 09:00 is Asia/Tbilisi, with no Thursday or next-Monday issue', () => {
    assert.equal(weekendFriday(new Date('2026-10-30T04:59:59Z')), null);
    assert.equal(weekendFriday(new Date('2026-10-30T05:00:00Z')), '2026-10-30');
    assert.equal(weekendFriday(new Date('2026-11-02T05:00:00Z')), null);
});
