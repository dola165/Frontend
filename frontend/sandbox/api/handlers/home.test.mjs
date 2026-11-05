import assert from 'node:assert/strict';
import test from 'node:test';
import { handleApi } from '../router.mjs';
import * as S from '../world-social.mjs';
import * as V from '../viewer.mjs';
import { factsOf } from '../feed-rank.mjs';

// Home, step 7: the sandbox answers as the server does (backend TwoFeedIntegrationTest, DiscoverRulesIntegrationTest,
// RecordPostsIntegrationTest, ClubPostingIntegrationTest).
const as = persona => ({ cookie: persona ? `gk-sandbox-persona=${persona}` : '' });
const newcomer = (town, name = `New ${town}`) => {
  const account = V.createAccount({ fullName: name, email: `${name.replace(/\W/g, '').toLowerCase()}-${Date.now()}@example.test`, password: 'SyntheticOnly-2026', dateOfBirth: '1990-04-02', town });
  return { authorization: `Bearer ${V.accessToken(account.id)}` };
};
const request = async (headers, method, path, body) => {
  const url = new URL(path, 'http://sandbox.test');
  return structuredClone(await handleApi({ method, path: url.pathname, query: url.searchParams, body, headers }));
};
const discover = async (headers, limit = 50) => (await request(headers, 'GET', `/posts/feed/for-you?limit=${limit}`)).body.posts;
/** Every page of Discover, following the cursor as the app does. */
async function everyPage(headers, limit, between = () => {}) {
  const seen = [];
  let cursor = null;
  for (let page = 0; page < 40; page++) {
    const query = cursor ? `&cursor=${cursor.id}&cursorTime=${encodeURIComponent(cursor.time)}&cursorTier=${cursor.tier}` : '';
    const body = (await request(headers, 'GET', `/posts/feed/for-you?limit=${limit}${query}`)).body;
    seen.push(...body.posts);
    if (body.nextCursor == null) return seen;
    const last = body.posts.at(-1);
    cursor = { id: body.nextCursor, time: last.createdAt, tier: body.nextCursorTier };
    between(page);
  }
  throw new Error('Discover never ended.');
}
const inOrder = posts => posts.every((post, i) => i === 0 || posts[i - 1].why.tier < post.why.tier
  || (posts[i - 1].why.tier === post.why.tier && (posts[i - 1].createdAt > post.createdAt || (posts[i - 1].createdAt === post.createdAt && posts[i - 1].id > post.id))));

test('Discover reads in tiers, newest first in each; a coach’s own club comes first', async () => {
  const posts = await everyPage(as(null), 7);
  assert.ok(inOrder(posts));
  assert.equal(new Set(posts.map(p => p.id)).size, posts.length);
  const first = posts.filter(p => p.why.tier === 1);
  assert.ok(first.length > 0 && first.every(p => p.clubId === 1 || (p.authorId === 1 && !p.record)));
  assert.ok(first.some(p => p.record), 'the club’s written posts are its own football too');
});

test('a parent who follows nobody still reads their child’s club first; a newcomer is never empty, and Batumi is near Batumi', async () => {
  const parent = await discover(as('kitparent'));
  assert.equal(parent[0].why.kind, 'LINKED');
  assert.ok(!parent.some(p => p.why.kind === 'FOLLOWING'));
  const tbilisi = await discover(newcomer('Tbilisi'));
  assert.ok(tbilisi.length >= 10);
  assert.ok(!tbilisi.some(p => p.why.tier <= 2));
  const batumi = await discover(newcomer('Batumi'));
  const near = batumi.filter(p => p.why.tier === 3);
  assert.ok(near.length > 0 && near.every(p => p.why.distanceKm <= 120));
  assert.ok(near.some(p => p.place?.city === 'Batumi'));
  assert.ok(!batumi.some(p => p.why.tier === 3 && p.place?.city === 'Tbilisi'));
});

test('posts arriving while someone reads never repeat or skip one on the next pages', async () => {
  const reader = newcomer('Tbilisi', 'Paging Reader');
  const before = (await everyPage(reader, 50)).map(p => p.id);
  const arrived = [];
  const read = await everyPage(reader, 4, page => {
    if (page > 2) return;
    // A nearby club posts meanwhile: it ranks in a tier the reader may already have passed.
    const p = { id: S.newPostId(), authorId: null, clubId: 4, squadId: null, content: `Saturday session ${page} under the lights`, createdAt: new Date(), mediaUrls: [], isPublic: true,
      editedAt: null, sharedPostId: null, shares: 0, reactions: new Map(), comments: [], hiddenBy: new Set() };
    S.posts.push(p);
    arrived.push(p.id);
  });
  const ids = read.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length, 'no post twice');
  assert.deepEqual(ids.filter(id => !arrived.includes(id)), before, 'every earlier post once, in its order');
  for (const p of arrived) S.posts.splice(S.posts.findIndex(x => x.id === p), 1);
});

test('the club’s records write its posts, and the record decides what they show', async () => {
  const posts = await discover(as(null));
  const kinds = new Set(posts.filter(p => p.record).map(p => p.record.kind));
  for (const kind of ['TRIAL', 'SQUAD', 'JOB', 'PROJECT']) assert.ok(kinds.has(kind), kind);
  const trial = posts.find(p => p.record?.kind === 'TRIAL' && p.clubId === 1);
  assert.equal(trial.record.action, 'APPLY');
  assert.equal(trial.canEdit, false);
  assert.equal(trial.record.canChange, true);
  // Every written post is the club's: it names no child and is never someone's own.
  assert.ok(posts.filter(p => p.record).every(p => p.authorId === null && p.why.kind !== 'OWN'));
});

test('staff add a line or hide a written post; a stale change is refused and others get a plain 404', async () => {
  const trial = (await discover(as(null))).find(p => p.record?.kind === 'TRIAL' && p.clubId === 1);
  const change = (persona, body) => request(as(persona), 'PUT', `/posts/${trial.id}/record`, body);
  assert.equal(trial.squadName, 'U14 Girls');
  // The coach of U14 Boys and U16 Boys doesn't change U14 Girls' trial; nor does someone with no posting job.
  assert.equal((await change('headcoach', { line: 'Bring boots', hidden: false, version: trial.record.version })).status, 404);
  assert.equal((await change('analyst', { line: 'Bring boots', hidden: false, version: trial.record.version })).status, 404);
  const added = await change('media', { line: 'Bring boots and water', hidden: false, version: trial.record.version });
  assert.equal(added.status, 200);
  assert.equal(added.body.record.line, 'Bring boots and water');
  assert.equal((await change('media', { line: 'Late', hidden: false, version: trial.record.version })).status, 409);
  const hidden = await change(null, { line: added.body.record.line, hidden: true, version: added.body.record.version });
  assert.equal(hidden.body.record.hidden, true);
  const stranger = newcomer('Tbilisi', 'Hidden Check');
  assert.ok(!(await discover(stranger)).some(p => p.id === trial.id));
  assert.ok((await request(as(null), 'GET', '/posts/club/1?limit=50')).body.posts.some(p => p.id === trial.id && p.record.hidden));
  assert.equal((await request(stranger, 'GET', `/posts/${trial.id}`)).status, 404);
  await change(null, { line: added.body.record.line, hidden: false, version: hidden.body.record.version });
  assert.equal((await request(as(null), 'DELETE', `/posts/${trial.id}`)).status, 409);
});

test('who posts as the club: admins and the media officer for all of it; coaches and team managers for their squads', async () => {
  const post = (persona, body) => request(as(persona), 'POST', '/posts', { content: 'Great session tonight', ...body });
  assert.equal((await post('headcoach', { squadId: 103 })).status, 201);
  assert.equal((await post('headcoach', { squadId: 102 })).status, 403);
  assert.equal((await post('headcoach', { clubId: 1 })).status, 403);
  assert.equal((await post('teammanager', { squadId: 105 })).status, 201);
  assert.equal((await post('teammanager', { squadId: 103 })).status, 403);
  assert.equal((await post('media', { clubId: 1 })).status, 201);
  assert.equal((await post('kit', { clubId: 1 })).status, 403);
  assert.equal((await post(null, { clubId: 2, squadId: 103 })).status, 400);
  const authors = (await request(as('headcoach'), 'GET', '/posts/authors')).body;
  assert.deepEqual(authors.map(a => a.squadId), [103, 105]);
  const created = (await post('headcoach', { squadId: 105 })).body.postId;
  const shown = (await request(as('headcoach'), 'GET', `/posts/${created}`)).body;
  assert.equal(shown.squadName, 'U16 Boys');
  assert.equal(shown.clubId, 1);
  assert.equal(shown.canEdit, true);
  assert.equal((await request(as('teammanager'), 'GET', `/posts/${created}`)).body.canEdit, true);
  assert.equal((await request(as('gkcoach'), 'DELETE', `/posts/${created}`)).status, 403);
});

test('a children’s club keeps its photos for its followers and its people; an adult squad’s travel', async () => {
  const withPhoto = S.posts.find(p => p.clubId === 1 && !p.squadId && p.mediaUrls.length);
  assert.ok(withPhoto, 'a Dinamo post with a photo');
  const stranger = newcomer('Tbilisi', 'Photo Stranger');
  const seen = (await request(stranger, 'GET', `/posts/${withPhoto.id}`)).body;
  assert.deepEqual(seen.mediaUrls, []);
  assert.equal(seen.content, withPhoto.content);
  assert.ok((await request(as(null), 'GET', `/posts/${withPhoto.id}`)).body.mediaUrls.length > 0);
  // Following the club brings the photos back.
  const follower = newcomer('Batumi', 'Photo Follower');
  await request(follower, 'POST', '/clubs/1/follow');
  assert.ok((await request(follower, 'GET', `/posts/${withPhoto.id}`)).body.mediaUrls.length > 0);
  const adult = { ...withPhoto, id: S.newPostId(), squadId: 101, reactions: new Map(), comments: [], hiddenBy: new Set() };
  S.posts.push(adult);
  assert.ok((await request(stranger, 'GET', `/posts/${adult.id}`)).body.mediaUrls.length > 0, 'First Team is adults');
  S.posts.splice(S.posts.indexOf(adult), 1);
});

test('one switch per kind for whoever posts for the whole club; a stale save is refused', async () => {
  assert.equal((await request(as('headcoach'), 'GET', '/clubs/1/record-posts')).status, 404);
  const current = (await request(as('media'), 'GET', '/clubs/1/record-posts')).body;
  assert.ok(current.kinds.every(kind => kind.on));
  const saved = await request(as('media'), 'PUT', '/clubs/1/record-posts', { off: ['JOB'], version: current.version });
  assert.equal(saved.body.kinds.find(kind => kind.kind === 'JOB').on, false);
  assert.equal((await request(as(null), 'PUT', '/clubs/1/record-posts', { off: [], version: current.version })).status, 409);
  await request(as(null), 'PUT', '/clubs/1/record-posts', { off: [], version: saved.body.version });
});

// Fix round 1.
test('every personal post stays with its followers, seeded overrides included; only a player search travels', async () => {
  const personal = S.posts.filter(p => !p.clubId && !p.organizationId && !p.record);
  assert.ok(personal.some(p => p.id === 907), 'the seeded advice override is a personal post');
  for (const p of personal) {
    const { topic, reach } = factsOf(p);
    assert.ok(reach === 'FOLLOWERS' || (topic === 'PLAYER_SEARCH' && reach === 'REGIONAL'), `${p.id} ${topic} ${reach}`);
  }
  const stranger = await discover(newcomer('Tbilisi', 'Personal Stranger'));
  assert.ok(stranger.filter(p => !p.clubId && !p.organizationId).every(p => p.topic === 'PLAYER_SEARCH'));
});

test('only the club’s Owner and Admins choose Club leadership; coaches and the Media officer post publicly', async () => {
  const posted = await request(as('headcoach'), 'POST', '/posts', { content: 'Squad notes', squadId: 103 });
  assert.equal(posted.status, 201);
  const id = posted.body.postId;
  const edit = (persona, isPublic) => request(as(persona), 'PUT', `/posts/${id}`, { content: 'Squad notes', isPublic, expectedContent: 'Squad notes' });
  assert.equal((await edit('headcoach', false)).status, 403);
  assert.equal((await request(as('headcoach'), 'GET', `/posts/${id}`)).body.isPublic, true, 'refused before saving');
  assert.equal((await request(as('media'), 'POST', '/posts', { content: 'Leadership only', clubId: 1, isPublic: false })).status, 403);
  assert.equal((await edit(null, false)).status, 200);
  const authors = persona => request(as(persona), 'GET', '/posts/authors').then(r => r.body.find(a => !a.squadId)?.leadership);
  assert.equal(await authors(null), true);
  assert.equal(await authors('media'), false);
});

test('staff adding a photo keep the ones already on a written post', async () => {
  const trial = (await discover(as(null))).find(p => p.record?.kind === 'TRIAL' && p.clubId === 1);
  const upload = async () => (await request(as(null), 'POST', '/media/upload?context=post')).body.id;
  const first = await upload();
  const once = await request(as(null), 'PUT', `/posts/${trial.id}/record`, { line: null, mediaIds: [first], hidden: false, version: trial.record.version });
  assert.deepEqual(once.body.record.photoIds, [first]);
  const second = await upload();
  const twice = await request(as(null), 'PUT', `/posts/${trial.id}/record`, { line: null, mediaIds: [...once.body.record.photoIds, second], hidden: false, version: once.body.record.version });
  assert.deepEqual(twice.body.record.photoIds, [first, second]);
  assert.equal(twice.body.mediaUrls.length, 2);
  assert.equal((await request(newcomer('Tbilisi', 'Photo Ids'), 'GET', `/posts/${trial.id}`)).body.record.photoIds, null, 'only staff get the ids');
  await request(as(null), 'PUT', `/posts/${trial.id}/record`, { line: null, mediaIds: [], hidden: false, version: twice.body.record.version });
});
