// Synthetic API: social domain — home feed and posts, profiles and follows, people search,
// notifications, the requests centre, chat, squad communication, Agent Dola and account
// pages. Data lives in world-social.mjs; every mutation is kept in memory.
// See sandbox/README.md for conventions.
import { get, post, put, patch, del, reply } from '../router.mjs';
import * as W from '../world.mjs';
import * as S from '../world-social.mjs';
import * as P from '../world-profile.mjs';
import * as F from '../world-football.mjs';
import * as V from '../viewer.mjs';
import { demotionKey, factsOf, rankFeed } from '../feed-rank.mjs';

const ME = W.ME_ID;
/** Posts, reactions and follows belong to whoever asks: Luka, or an account registered in the sandbox. */
const viewerOf = headers => V.viewerId(headers);
/** The club domain's live store (applications, tryouts, invitations, role requests, club inbox).
 * Loaded lazily so module load order is unaffected; decisions made in the club workspace then
 * show up in the requests centre and notifications. Absent store => this domain's own seeds. */
let clubWorld;
const clubStore = async () => (clubWorld ??= await import('../world-club.mjs').catch(() => false)) || null;
const iso = d => (d instanceof Date ? d.toISOString() : d);
const num = (query, key, fallback) => { const v = Number(query.get(key)); return query.has(key) && Number.isFinite(v) ? v : fallback; };
const notFound = (message = 'Not found.') => reply(404, { status: 404, message });
const forbidden = (message = 'You do not have access to this.') => reply(403, { status: 403, message });
const badRequest = message => reply(400, { status: 400, message });
const created = body => reply(201, body);
const noContent = () => reply(204);
const person = id => W.personById(id);
const displayName = id => person(id)?.fullName ?? 'GrassKickZ member';
const avatarOf = id => person(id)?.avatarUrl ?? null;
/** Spring-style page used by chat, notifications and connection lists. */
const pageOf = (list, query, defaultSize = 20) => {
  const page = Math.max(0, num(query, 'page', 0)), size = Math.max(1, Math.min(100, num(query, 'size', defaultSize)));
  return { content: list.slice(page * size, page * size + size), pageNumber: page, pageSize: size, totalElements: list.length };
};
const positionLabel = code => W.POSITION_LABEL[code] ?? code ?? null;
/** World roles map onto the frontend's FootballRole list; staff and specialists are CLUB_STAFF. */
const footballRole = p => (['STAFF', 'SPECIALIST'].includes(p.role) ? 'CLUB_STAFF' : p.role);

// ================================================================ posts
const uploads = new Map(); // mediaId -> url
let nextUploadId = 88001;

/** A post as the feed sends it, for one reader: their reaction, whether they may edit, and its topic, place and reach. */
function postDto(p, viewer = ME) {
  const club = p.clubId ? W.clubById(p.clubId) : null;
  const counts = {};
  for (const type of p.reactions.values()) counts[type] = (counts[type] ?? 0) + 1;
  const mine = p.reactions.get(viewer) ?? null;
  const { topic, tags, place, reach } = factsOf(p);
  return {
    id: p.id, content: p.content, createdAt: iso(p.createdAt), authorId: p.authorId,
    authorName: p.authorId ? displayName(p.authorId) : club?.name ?? 'GrassKickZ',
    authorAvatarUrl: club ? club.logoUrl : avatarOf(p.authorId),
    clubId: p.clubId, clubName: club?.name ?? null,
    myReaction: mine, reactionCount: p.reactions.size, reactionCounts: counts, likeCount: p.reactions.size, isLikedByMe: mine !== null,
    commentCount: p.comments.length, image: p.mediaUrls[0], mediaUrls: p.mediaUrls, isPublic: p.isPublic,
    canEdit: p.authorId === viewer, editedAt: p.editedAt ? iso(p.editedAt) : null,
    sharedPostId: p.sharedPostId, isReshare: p.sharedPostId != null, shareCount: p.shares,
    topic, tags, place, reach,
  };
}
const visible = (p, viewer) => !p.hiddenBy.has(viewer) && (p.isPublic || p.authorId === viewer);
const followsPost = (p, viewer) => (p.authorId && S.isFollowing(viewer, p.authorId)) || (p.clubId && V.clubFollowsOf(viewer).has(p.clubId));
const newestFirst = (a, b) => b.createdAt - a.createdAt || b.id - a.id;
const pageLimits = query => {
  const limit = num(query, 'limit', 20);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return { error: badRequest('Invalid feed limit.') };
  const cursor = query.has('cursor') ? num(query, 'cursor', NaN) : null;
  if (cursor !== null && !Number.isSafeInteger(cursor)) return { error: badRequest('Invalid feed cursor.') };
  return { limit, cursor };
};

/** Cursor feed, newest first: { posts, nextCursor } where nextCursor is the id of the last post returned. */
function feedPage(filter, query, viewer) {
  const { error, limit, cursor } = pageLimits(query);
  if (error) return error;
  const boundary = query.get('cursorTime') ? new Date(query.get('cursorTime')) : cursor !== null ? S.postById(cursor)?.createdAt : null;
  if (cursor !== null && !boundary) return badRequest('Feed cursor expired. Refresh the feed.');
  const sorted = S.posts.filter(p => visible(p, viewer) && filter(p)).sort(newestFirst);
  const remaining = cursor === null ? sorted : sorted.filter(p => p.createdAt < boundary || (+p.createdAt === +boundary && p.id < cursor));
  const page = remaining.slice(0, limit);
  return { posts: page.map(p => postDto(p, viewer)), nextCursor: remaining.length > limit ? page.at(-1).id : null };
}

/** What the ranking knows about a reader: links nobody else can give them, follows, where they are, what they chose to see. */
function readerProfile(viewer) {
  const prefs = V.preferencesOf(viewer), town = prefs?.town;
  const linkedClubs = new Set(), linkedPeople = new Set();
  if (viewer === ME) {
    // Luka's confirmed links: his club's staff, players and their families.
    linkedClubs.add(1);
    for (const p of W.people) if (p.clubId === 1) linkedPeople.add(p.id);
    for (const link of W.parents) if (W.personById(link.childId)?.clubId === 1) linkedPeople.add(link.parentId);
  }
  return {
    id: viewer, linkedClubs, linkedPeople, followedPeople: new Set(S.followingOf(viewer)), followedClubs: V.clubFollowsOf(viewer),
    home: town?.latitude != null ? { lat: town.latitude, lng: town.longitude } : { lat: W.cities.Tbilisi.lat, lng: W.cities.Tbilisi.lng },
    topics: prefs?.topics ?? [], demoted: V.demotedOf(viewer),
  };
}
/** Discover: the ranked feed, paged by position; the cursor is the last post shown. */
function rankedPage(query, viewer) {
  const { error, limit, cursor } = pageLimits(query);
  if (error) return error;
  const ranked = rankFeed(S.posts.filter(p => visible(p, viewer)), readerProfile(viewer));
  const start = cursor === null ? 0 : ranked.findIndex(item => item.post.id === cursor) + 1;
  if (cursor !== null && start === 0) return badRequest('Feed cursor expired. Refresh the feed.');
  const page = ranked.slice(start, start + limit);
  return { posts: page.map(item => ({ ...postDto(item.post, viewer), why: item.why })), nextCursor: ranked.length > start + limit ? page.at(-1).post.id : null };
}
for (const path of ['/posts/feed', '/posts/feed/for-you']) get(path, ({ query, headers }) => rankedPage(query, viewerOf(headers)));
get('/posts/feed/following', ({ query, headers }) => { const viewer = viewerOf(headers); return feedPage(p => p.authorId !== viewer && followsPost(p, viewer), query, viewer); });
get('/posts/user/:id', ({ params, query, headers }) => person(params.id) || V.account(params.id) ? feedPage(p => p.authorId === Number(params.id), query, viewerOf(headers)) : notFound('Profile not found.'));
get('/posts/club/:id', ({ params, query, headers }) => W.clubById(params.id) ? feedPage(p => p.clubId === Number(params.id), query, viewerOf(headers)) : notFound('Club not found.'));

// What people see, open, hide and ask less of, kept for the learning algorithm that comes later.
post('/feed/events', ({ body, headers }) => {
  const viewer = viewerOf(headers);
  const events = Array.isArray(body?.events) ? body.events : null;
  if (!events || events.length > 100) return badRequest('Send up to 100 events.');
  let accepted = 0;
  for (const event of events) {
    const postRecord = S.postById(event?.postId);
    if (!postRecord || !V.EVENT_TYPES.includes(event?.type)) continue;
    if (event.type === 'LESS') V.demotedOf(viewer).add(demotionKey(postRecord));
    if (event.type === 'UNDO_LESS') V.demotedOf(viewer).delete(demotionKey(postRecord));
    V.recordEvent(viewer, { type: event.type, postId: postRecord.id, topic: factsOf(postRecord).topic, ...(typeof event.at === 'string' ? { at: event.at } : {}) });
    accepted++;
  }
  return reply(202, { accepted });
});

const findPost = (id, viewer) => { const p = S.postById(id); return p && visible(p, viewer) ? p : null; };
get('/posts/:id', ({ params, headers }) => { const viewer = viewerOf(headers), p = findPost(params.id, viewer); return p ? postDto(p, viewer) : notFound('This post is no longer available.'); });

post('/posts', ({ body, headers }) => {
  const viewer = viewerOf(headers);
  const content = String(body?.content ?? '').trim();
  if (!content) return badRequest('Write something before publishing.');
  if (body?.clubId && !W.staff.some(s => s.personId === viewer && s.clubId === Number(body.clubId))) return forbidden('You cannot post for this club.');
  const media = (body?.mediaIds ?? []).map(id => uploads.get(Number(id))).filter(Boolean);
  const p = { id: S.newPostId(), authorId: viewer, clubId: body?.clubId ? Number(body.clubId) : null, content, createdAt: new Date(), mediaUrls: media, isPublic: body?.isPublic !== false, editedAt: null, sharedPostId: null, shares: 0, reactions: new Map(), comments: [], hiddenBy: new Set() };
  S.posts.push(p);
  return created({ message: 'Post created', postId: p.id });
});
put('/posts/:id', ({ params, body, headers }) => {
  const viewer = viewerOf(headers), p = findPost(params.id, viewer);
  if (!p) return notFound('This post is no longer available.');
  if (p.authorId !== viewer) return forbidden('Only the author can edit this post.');
  if (body?.expectedContent != null && body.expectedContent !== p.content) return reply(409, { status: 409, message: 'This post changed since you opened it. Reload and try again.' });
  p.content = String(body?.content ?? p.content).trim(); p.isPublic = body?.isPublic !== false; p.editedAt = new Date();
  return postDto(p, viewer);
});
del('/posts/:id', ({ params, headers }) => {
  const viewer = viewerOf(headers), p = findPost(params.id, viewer);
  if (!p) return notFound('This post is no longer available.');
  if (p.authorId !== viewer) return forbidden('Only the author can delete this post.');
  S.posts.splice(S.posts.indexOf(p), 1);
  return { message: 'Post deleted successfully' };
});
post('/posts/:id/hide', ({ params, headers }) => {
  const viewer = viewerOf(headers), p = S.postById(params.id);
  if (!p) return notFound();
  if (p.hiddenBy.has(viewer)) p.hiddenBy.delete(viewer); else p.hiddenBy.add(viewer);
  return { hidden: p.hiddenBy.has(viewer) };
});
put('/posts/:id/like', ({ params, body, headers }) => {
  const viewer = viewerOf(headers), p = findPost(params.id, viewer);
  if (!p) return notFound();
  if (body?.liked === false) p.reactions.delete(viewer); else p.reactions.set(viewer, p.reactions.get(viewer) ?? 'LIKE');
  return { isLiked: p.reactions.has(viewer) };
});
const REACTIONS = new Set(['LIKE', 'LOVE', 'HAHA', 'WOW', 'ANGRY', 'SAD', 'CARE']);
put('/posts/:id/reaction', ({ params, body, headers }) => {
  const viewer = viewerOf(headers), p = findPost(params.id, viewer);
  if (!p) return notFound();
  if (!REACTIONS.has(body?.reaction)) return badRequest('Choose a reaction.');
  p.reactions.set(viewer, body.reaction);
  return postDto(p, viewer);
});
del('/posts/:id/reaction', ({ params, headers }) => { const viewer = viewerOf(headers), p = findPost(params.id, viewer); if (!p) return notFound(); p.reactions.delete(viewer); return postDto(p, viewer); });
get('/posts/:id/reactions', ({ params, query, headers }) => {
  const p = findPost(params.id, viewerOf(headers));
  if (!p) return notFound();
  const filter = query.get('reaction');
  const all = [...p.reactions.entries()].reverse().map(([userId, reaction]) => ({ userId, name: displayName(userId), avatarUrl: avatarOf(userId), reaction }));
  const people = filter ? all.filter(r => r.reaction === filter) : all;
  const offset = Math.max(0, num(query, 'cursor', 0)), limit = Math.max(1, Math.min(50, num(query, 'limit', 20)));
  const reactionCounts = {};
  for (const r of all) reactionCounts[r.reaction] = (reactionCounts[r.reaction] ?? 0) + 1;
  const hasMore = offset + limit < people.length;
  return { people: people.slice(offset, offset + limit), totalCount: all.length, reactionCounts, availableCount: people.length, nextCursor: hasMore ? offset + limit : null, hasMore };
});

const commentDto = c => ({ id: c.id, authorId: c.authorId, authorName: displayName(c.authorId), authorAvatarUrl: avatarOf(c.authorId), content: c.content, createdAt: iso(c.createdAt) });
get('/posts/:id/comments', ({ params, headers }) => { const p = findPost(params.id, viewerOf(headers)); return p ? p.comments.map(commentDto) : notFound(); });
post('/posts/:id/comments', ({ params, body, headers }) => {
  const viewer = viewerOf(headers), p = findPost(params.id, viewer);
  if (!p) return notFound();
  const content = String(body?.content ?? '').trim();
  if (!content) return badRequest('Write a comment first.');
  const c = { id: S.newCommentId(), authorId: viewer, content, createdAt: new Date() };
  p.comments.push(c);
  return created(commentDto(c));
});
post('/posts/:id/shares', ({ params, body, headers }) => {
  const viewer = viewerOf(headers), original = findPost(params.id, viewer);
  if (!original) return notFound();
  const sourceId = original.sharedPostId ?? original.id;
  const p = { id: S.newPostId(), authorId: viewer, clubId: null, content: String(body?.content ?? '').trim(), createdAt: new Date(), mediaUrls: [], isPublic: body?.isPublic !== false, editedAt: null, sharedPostId: sourceId, shares: 0, reactions: new Map(), comments: [], hiddenBy: new Set() };
  S.posts.push(p); S.postById(sourceId).shares++;
  return created({ postId: p.id });
});
post('/media/upload', ({ query }) => {
  const id = nextUploadId++;
  const url = `/sandbox-media/photo/upload-${query.get('context') ?? 'post'}-${id}.svg`;
  uploads.set(id, url);
  return created({ id, url, mediaId: id });
});
let nextReportId = 91001;
post('/reports', ({ body }) => created({ id: nextReportId++, status: 'RECEIVED', targetType: body?.targetType ?? 'POST', targetId: body?.targetId ?? null, createdAt: iso(new Date()) }));

// ================================================================ people and profiles
const searchable = p => `${p.fullName} ${p.username} ${p.headline ?? ''} ${p.clubId ? W.clubById(p.clubId)?.name : ''}`.toLowerCase();
const searchResult = p => ({ id: p.id, fullName: p.fullName, username: p.username, position: positionLabel(p.position), userType: footballRole(p), avatarUrl: p.avatarUrl, isMinor: S.isMinor(p) });
get('/users/search', ({ query }) => {
  const q = String(query.get('query') ?? query.get('q') ?? '').trim().toLowerCase();
  if (q.length < 2) return pageOf([], query, 10);
  const rank = p => (p.fullName.toLowerCase().startsWith(q) ? 0 : p.lastName.toLowerCase().startsWith(q) ? 1 : 2) * 10 + (p.clubId === 1 ? 0 : 1);
  const matches = W.people.filter(p => searchable(p).includes(q)).sort((a, b) => rank(a) - rank(b) || a.fullName.localeCompare(b.fullName));
  return pageOf(matches.map(searchResult), query, 10);
});

/** Published club appointments of someone the club appoints without making them a member (a club referee). */
const clubAppointmentsOf = p => p.clubId ? [] : (clubWorld?.appointments ?? []).filter(a => a.user_id === p.id && a.status === 'ACTIVE' && a.published);
const appointmentFor = p => {
  const staff = W.staff.find(s => s.personId === p.id);
  const club = p.clubId ? W.clubById(p.clubId) : null;
  if (!club) return clubAppointmentsOf(p).map(a => ({ clubId: a.club_id, clubName: a.club_name, logoUrl: W.clubById(a.club_id)?.logoUrl ?? null, role: 'CLUB_STAFF', title: a.title, coaching: false,
    memberSince: a.starts_on, biography: null, qualifications: null, squads: a.squad_names }));
  const squads = W.squads.filter(s => s.clubId === club.id && (s.headCoachId === p.id || s.playerIds.includes(p.id))).map(s => s.name);
  const title = staff?.title ?? p.staffTitle ?? (p.role === 'PLAYER' ? `Player · #${p.shirtNumber ?? ''}`.replace(/ · #$/, '') : 'Member');
  return [{
    clubId: club.id, clubName: club.name, logoUrl: club.logoUrl, role: footballRole(p), title, coaching: p.role === 'COACH',
    memberSince: `${Math.max(club.founded, 2015 + (p.id % 9))}-0${1 + (p.id % 8)}-01`,
    biography: p.id === ME ? 'Leads the coaching curriculum from U12 to the reserve team and coaches the U16 and U14 Boys.' : null,
    qualifications: p.id === ME ? 'UEFA A licence · GFF Youth Diploma' : null, squads,
  }];
};
let nextCareerId = 12001;
const entry = (role, kind, title, organization, startsOn, endsOn = null, description = null) => ({ id: nextCareerId++, role, kind, title, organization, startsOn, endsOn, description, published: true });
const careerEntries = new Map([[ME, [
  entry('COACH', 'POSITION', 'Head of Coaching', 'FC Dinamo Tbilisi Academy', '2021-07-01', null, 'Coaching curriculum, staff development and the U16/U14 Boys programmes.'),
  entry('COACH', 'POSITION', 'U16 head coach', 'FC Dinamo Tbilisi Academy', '2019-07-01', '2021-06-30'),
  entry('COACH', 'POSITION', 'Youth coach (U12–U14)', 'Saburtalo Youth FC', '2014-08-01', '2019-06-30'),
  entry('COACH', 'QUALIFICATION', 'UEFA A licence', 'Georgian Football Federation', '2020-06-15', '2029-06-15'),
  entry('COACH', 'QUALIFICATION', 'GFF Youth Diploma', 'Georgian Football Federation', '2018-05-20'),
  entry('COACH', 'QUALIFICATION', 'UEFA B licence', 'Georgian Football Federation', '2016-05-10'),
  entry('COACH', 'ACHIEVEMENT', 'GFF U16 Youth League champions', 'FC Dinamo Tbilisi Academy', '2024-05-26', null, 'Unbeaten league season with the U16 Boys.'),
  entry('COACH', 'VOLUNTEERING', 'Grassroots coach mentor', 'Gldani Juniors', '2018-09-01', null, 'Monthly session-design workshops for volunteer coaches.'),
]], [S.FEATURED_PLAYER_ID, [
  entry('PLAYER', 'POSITION', 'Striker · U16 Boys', 'FC Dinamo Tbilisi Academy', '2023-08-01'),
  entry('PLAYER', 'POSITION', 'Forward', 'Gldani Juniors', '2016-09-01', '2023-06-30'),
  entry('PLAYER', 'ACHIEVEMENT', 'Top scorer, GFF U15 Youth League', 'FC Dinamo Tbilisi Academy', '2026-05-24', null, '17 goals in 20 league games.'),
  entry('PLAYER', 'ACHIEVEMENT', 'Tbilisi regional development camp', 'Georgian Football Federation', '2026-03-10'),
]]]);
function defaultCareer(p) {
  const role = footballRole(p), club = p.clubId ? W.clubById(p.clubId) : null, since = `${2016 + (p.id % 8)}-0${1 + (p.id % 9)}-01`;
  if (p.role === 'REFEREE') return [entry('REFEREE', 'POSITION', p.headline, 'Georgian Football Federation', since), entry('REFEREE', 'QUALIFICATION', 'GFF refereeing licence', 'Georgian Football Federation', `${2012 + (p.id % 6)}-04-01`)];
  if (p.role === 'AGENT') return [entry('AGENT', 'QUALIFICATION', 'Football agent licence', 'FIFA', `${2019 + (p.id % 4)}-10-01`)];
  if (p.role === 'PARENT' || !club && !p.profession && !p.freeAgent) return [];
  const org = club?.name ?? (p.profession ? 'Independent practice' : 'Tbilisi Community League');
  return [entry(role, 'POSITION', p.profession ?? (p.role === 'PLAYER' ? positionLabel(p.position) : W.staff.find(s => s.personId === p.id)?.title ?? p.staffTitle ?? role), org, since)];
}
const careerOf = p => { if (!careerEntries.has(p.id)) careerEntries.set(p.id, defaultCareer(p)); return careerEntries.get(p.id); };
const rolesOf = p => S.roleProfiles.get(p.id) ?? [{ role: footballRole(p), primary: true, published: true, headline: p.headline ?? null, specialties: p.profession ?? null, qualifications: p.licences?.join(' · ') ?? null, serviceArea: p.city ?? null }];
const footballProfileOf = p => ({ roles: [...new Set([...rolesOf(p).map(r => r.role), ...(clubAppointmentsOf(p).length ? ['CLUB_STAFF'] : [])])], appointments: p.role === 'PARENT' ? [] : appointmentFor(p), entries: careerOf(p).filter(e => e.published || p.id === ME) });
function careerHistory(p) {
  if (p.role !== 'PLAYER') return [];
  const season = y => `${y}/${String(y + 1).slice(2)}`, year = W.NOW.getFullYear() - (W.NOW.getMonth() < 7 ? 1 : 0);
  const age = W.NOW.getFullYear() - p.birthYear, club = W.clubById(p.clubId)?.name ?? 'Free agent';
  const featured = p.id === S.FEATURED_PLAYER_ID;
  const rows = [[season(year), `U${Math.min(19, age + 1)}`, featured ? 7 : 2 + (p.id % 6), featured ? 6 : p.id % 4, featured ? 2 : p.id % 3]];
  rows.push([season(year - 1), `U${Math.min(19, age)}`, featured ? 20 : 12 + (p.id % 10), featured ? 17 : p.id % 7, featured ? 5 : p.id % 5]);
  return rows.map(([s, category, appearances, goals, assists], i) => ({ id: p.id * 10 + i, clubName: featured && i === 1 ? 'FC Dinamo Tbilisi Academy' : club, season: s, category, appearances, goals: p.position === 'GK' ? 0 : goals, assists, cleanSheets: p.position === 'GK' ? 3 + (p.id % 5) : 0 }));
}
function bioOf(p) {
  if (p.id === ME) return S.accountProfile.bio;
  const club = p.clubId ? W.clubById(p.clubId).name : null;
  if (p.id === S.FEATURED_PLAYER_ID) return 'Left-footed striker in the FC Dinamo Tbilisi Academy U16 Boys. I love pressing from the front and scoring in big games.';
  if (p.freeAgent) return `${positionLabel(p.position)} based in ${p.city}, looking for a club for the coming season.`;
  if (p.role === 'PLAYER') return `${positionLabel(p.position)} at ${club}.`;
  if (p.role === 'PARENT') { const child = person(S.childOf(p.id)); return child ? `Football parent · ${child.firstName} plays for ${W.clubById(child.clubId)?.name}.` : 'Football parent.'; }
  if (p.role === 'REFEREE') return `${p.headline}. Officiating youth and amateur football across Georgia.`;
  if (p.profession) return `${p.profession} working with youth and amateur footballers in ${p.city}.`;
  return p.headline ?? null;
}
function profileDto(p) {
  const adult = !S.isMinor(p);
  return {
    id: p.id, username: p.id === ME ? 'coach.luka' : p.username, fullName: p.fullName, role: footballRole(p),
    position: positionLabel(p.position), secondaryPosition: p.id === S.FEATURED_PLAYER_ID ? 'Left winger' : null,
    preferredFoot: p.preferredFoot ? p.preferredFoot[0] + p.preferredFoot.slice(1).toLowerCase() : null,
    bio: bioOf(p), availabilityStatus: p.freeAgent ? 'Open to offers' : p.role === 'PLAYER' ? 'Available' : null,
    heightCm: p.role === 'PLAYER' ? 160 + (p.id % 25) : null, weightKg: p.role === 'PLAYER' ? 52 + (p.id % 22) : null,
    followerCount: S.followersOf(p.id).length, followingCount: S.followingOf(p.id).length, isFollowedByMe: S.isFollowing(ME, p.id),
    careerHistory: careerHistory(p), avatarUrl: p.avatarUrl, bannerUrl: p.id === ME ? S.accountProfile.bannerUrl : `/sandbox-media/photo/profile-banner-${p.id}.svg`,
    dateOfBirth: adult ? S.birthDate(p) : null, isPrivate: false,
    roleProfiles: rolesOf(p).filter(r => r.published || p.id === ME), footballProfile: footballProfileOf(p),
  };
}
const userParam = params => /^\d+$/.test(params.id) ? person(params.id) : undefined;
get('/users/:id', async ({ params }) => { if (!/^\d+$/.test(params.id)) return undefined; const p = userParam(params); if (!p) return notFound('Profile not found.'); await clubStore(); return profileDto(p); });
const connection = id => { const p = person(id); return { id, username: p.username, fullName: p.fullName, avatarUrl: p.avatarUrl, isFollowedByMe: S.isFollowing(ME, id) }; };
get('/users/:id/followers', ({ params, query }) => { const p = userParam(params); return p ? pageOf(S.followersOf(p.id).map(connection), query) : notFound(); });
get('/users/:id/following', ({ params, query }) => { const p = userParam(params); return p ? pageOf(S.followingOf(p.id).map(connection), query) : notFound(); });
post('/users/:id/follow', ({ params, headers }) => {
  const viewer = viewerOf(headers), p = userParam(params);
  if (!p) return notFound();
  if (p.id === viewer) return badRequest('You cannot follow yourself.');
  const following = S.toggleFollow(viewer, p.id);
  V.recordEvent(viewer, { type: following ? 'FOLLOWED' : 'UNFOLLOWED', userId: p.id });
  return { following, isFollowing: following, followerCount: S.followersOf(p.id).length };
});
del('/users/:id/follow', ({ params, headers }) => {
  const viewer = viewerOf(headers), p = userParam(params);
  if (!p) return notFound();
  if (S.isFollowing(viewer, p.id)) { S.toggleFollow(viewer, p.id); V.recordEvent(viewer, { type: 'UNFOLLOWED', userId: p.id }); }
  return { following: false, followerCount: S.followersOf(p.id).length };
});
const blocked = new Set();
get('/users/:id/personal-block', ({ params }) => ({ blocked: blocked.has(Number(params.id)) }));
put('/users/:id/personal-block', ({ params, body }) => { const id = Number(params.id); if (body?.blocked) blocked.add(id); else blocked.delete(id); return { blocked: blocked.has(id) }; });
get('/users/:id/coaching-career', ({ params }) => {
  const p = userParam(params);
  if (!p) return notFound();
  return appointmentFor(p).filter(a => a.coaching).map(a => ({ club_id: a.clubId, club_name: a.clubName, logo_url: a.logoUrl, title: a.title, biography: a.biography, qualifications: a.qualifications, member_since: a.memberSince, squads_json: JSON.stringify(W.squads.filter(s => s.clubId === a.clubId && s.headCoachId === p.id).map(s => ({ id: s.id, name: s.name }))) }));
});
// Representation only concerns agents and adult players; Luka is a coach, so profiles show no panel.
get('/representation-requests/profile/:id', ({ params }) => ({ relevant: false, canRequest: false, alreadyRepresented: false, reason: 'Representation connects licensed agents and adult players.', agentId: 0, playerId: Number(params.id), requests: [] }));
get('/representation-requests', () => []);
get('/representation-requests/history', ({ query }) => ({ items: [], page: num(query, 'page', 0), size: num(query, 'size', 50), total: 0, hasMore: false }));

// ---------------------------------------------------------------- account
const me = () => person(ME);
function accountDto() {
  const p = me();
  return {
    id: p.id, username: 'coach.luka', email: p.email, role: 'USER', displayName: p.displayName, emailVerified: true, emailVerifiedAt: iso(new Date(W.NOW.getTime() - 400 * 86400000)),
    passwordLoginEnabled: true, fullName: p.fullName, bio: S.accountProfile.bio, avatarUrl: p.avatarUrl, bannerUrl: S.accountProfile.bannerUrl, playerProfile: null,
    linkedAccounts: [{ provider: 'google', linkedAt: iso(new Date(W.NOW.getTime() - 210 * 86400000)) }],
    sessionsSupported: true, sessionRevocationSupported: true, accountDeletionSupported: true,
  };
}
get('/users/me/account', accountDto);
put('/users/me', ({ body }) => {
  const p = me();
  if (body?.fullName) { const parts = String(body.fullName).trim().split(/\s+/); p.fullName = parts.join(' '); p.firstName = parts[0]; p.lastName = parts.slice(1).join(' '); }
  if (body?.bio != null) S.accountProfile.bio = String(body.bio);
  if (body?.avatarUrl) p.avatarUrl = body.avatarUrl;
  if (body?.bannerUrl) S.accountProfile.bannerUrl = body.bannerUrl;
  return accountDto();
});
put('/users/me/profile', ({ body }) => { if (body?.bio != null) S.accountProfile.bio = String(body.bio); return accountDto(); });
get('/users/me/roles', () => S.roleProfiles.get(ME));
put('/users/me/roles', ({ body }) => {
  const profiles = Array.isArray(body?.profiles) ? body.profiles : [];
  if (!profiles.length) return badRequest('Choose at least one football role.');
  if (!profiles.some(r => r.primary)) profiles[0].primary = true;
  S.roleProfiles.set(ME, profiles.map(r => ({ role: r.role, primary: !!r.primary, published: !!r.published, headline: r.headline ?? null, specialties: r.specialties ?? null, qualifications: r.qualifications ?? null, serviceArea: r.serviceArea ?? null })));
  return S.roleProfiles.get(ME);
});
const careerPayload = body => ({ role: body?.role ?? 'COACH', kind: body?.kind ?? 'POSITION', title: String(body?.title ?? '').trim(), organization: body?.organization || null, startsOn: body?.startsOn, endsOn: body?.endsOn || null, description: body?.description || null, published: body?.published !== false });
post('/users/me/career', ({ body }) => { const data = careerPayload(body); if (!data.title || !data.startsOn) return badRequest('Add a title and a start date.'); careerOf(me()).unshift({ id: nextCareerId++, ...data }); return footballProfileOf(me()); });
put('/users/me/career/:id', ({ params, body }) => { const e = careerOf(me()).find(x => x.id === Number(params.id)); if (!e) return notFound(); Object.assign(e, careerPayload(body)); return footballProfileOf(me()); });
del('/users/me/career/:id', ({ params }) => { const list = careerOf(me()); const i = list.findIndex(x => x.id === Number(params.id)); if (i < 0) return notFound(); list.splice(i, 1); return footballProfileOf(me()); });
const sessions = [
  { id: 4101, current: true, status: 'ACTIVE', expiresAt: iso(new Date(W.NOW.getTime() + 29 * 86400000)) },
  { id: 4098, current: false, status: 'ACTIVE', expiresAt: iso(new Date(W.NOW.getTime() + 17 * 86400000)) },
  { id: 4090, current: false, status: 'ACTIVE', expiresAt: iso(new Date(W.NOW.getTime() + 6 * 86400000)) },
  { id: 4071, current: false, status: 'REVOKED', expiresAt: iso(new Date(W.NOW.getTime() - 12 * 86400000)) },
  { id: 4033, current: false, status: 'EXPIRED', expiresAt: iso(new Date(W.NOW.getTime() - 40 * 86400000)) },
];
const sessionSummary = () => ({ sessions, activeCount: sessions.filter(s => s.status === 'ACTIVE').length, revokedCount: sessions.filter(s => s.status === 'REVOKED').length, expiredCount: sessions.filter(s => s.status === 'EXPIRED').length });
get('/auth/sessions', sessionSummary);
post('/auth/sessions/revoke-others', () => { for (const s of sessions) if (!s.current && s.status === 'ACTIVE') s.status = 'REVOKED'; return { message: 'Other sessions were signed out.' }; });
get('/player-cards/mine', () => []);

// ================================================================ notifications
// Luka's personal and club items, plus the club domain's club inbox when it is loaded.
const notificationDto = ({ userId, createdAt, ...n }) => ({ ...n, createdAt: iso(createdAt) });
const allNotifications = async () => {
  const C = await clubStore();
  return C?.clubNotifications ? [...S.notifications, ...C.clubNotifications.map(n => ({ ...n, userId: ME, source: n }))] : S.notifications;
};
const notificationScope = query => {
  const scope = query.get('scope'), clubId = query.has('clubId') ? Number(query.get('clubId')) : null;
  return n => scope === 'personal' ? n.scope === 'PERSONAL' : scope === 'club' ? n.scope === 'CLUB' && (clubId == null || n.clubId === clubId) : true;
};
const myNotifications = async query => (await allNotifications()).filter(notificationScope(query)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
const publicNotification = ({ source, ...n }) => notificationDto(n);
const markRead = n => { n.isRead = true; if (n.source) n.source.isRead = true; };
get('/notifications', async ({ query }) => pageOf((await myNotifications(query)).map(publicNotification), query));
get('/notifications/unread-count', async ({ query }) => ({ unreadCount: (await myNotifications(query)).filter(n => !n.isRead).length }));
patch('/notifications/read-all', async ({ query }) => { const list = (await myNotifications(query)).filter(n => !n.isRead); list.forEach(markRead); return { count: list.length }; });
get('/notifications/:id', async ({ params }) => {
  if (!/^\d+$/.test(params.id)) return undefined;
  const n = (await allNotifications()).find(x => x.id === Number(params.id));
  return n ? publicNotification(n) : notFound('Notification not found.');
});
patch('/notifications/:id/read', async ({ params }) => {
  const n = (await allNotifications()).find(x => x.id === Number(params.id));
  if (!n) return notFound('Notification not found.');
  markRead(n);
  return { id: n.id, isRead: true };
});

// ================================================================ requests centre
const inView = view => item => view === 'HISTORY' ? S.historyStatuses.has(item.status) : !S.historyStatuses.has(item.status) && item.direction === view;
const CLUB_FAMILIES = new Set(['CLUB_APPLICATION', 'TRYOUT_APPLICATION', 'CLUB_INVITATION', 'STAFF_ROLE_REQUEST']);
const pretty = key => String(key ?? '').toLowerCase().replaceAll('_', ' ').replace(/^\w/, c => c.toUpperCase());
const requestItem = (family, id, values) => ({ key: `${family}:${id}`, family, id, actionLabel: 'Open request', ...values, updatedAt: iso(new Date(values.updatedAt)) });
/** Club-side requests read from the club domain's store, in the requests-centre projection. */
function clubRequests(C) {
  const club = W.clubById(1).name, workspace = tab => `/clubs/1/workspace?tab=${tab}`;
  const pendingApplication = new Set(['PENDING', 'SUBMITTED']), pendingTryout = new Set(['PENDING', 'SHORTLISTED']);
  return [
    ...C.applications.map(a => requestItem('CLUB_APPLICATION', a.id, {
      title: a.role === 'COACH' ? `Staff application · ${a.jobTitle ?? 'Coach'}` : `Membership application · ${a.ageGroup === 'SENIOR' ? 'Senior' : a.ageGroup ?? 'Academy'}`,
      context: `${a.fullName} · ${club}`, status: a.status === 'CANCELLED' ? 'WITHDRAWN' : a.status, direction: 'INCOMING', actionable: pendingApplication.has(a.status),
      updatedAt: a.decidedAt ?? a.createdAt, destination: `${workspace('applications')}&applicationId=${a.id}`, actionLabel: 'Review application',
    })),
    ...C.tryoutApplicants.map(t => requestItem('TRYOUT_APPLICATION', t.id, {
      title: `Tryout application · ${t.ageGroup} trial`, context: `${t.name} · ${pretty(t.position)}`, status: t.status, direction: 'INCOMING', actionable: pendingTryout.has(t.status),
      updatedAt: S.hoursAgo(5 + (t.id % 70)), destination: `${workspace('tryouts')}&applicationId=${t.id}`, actionLabel: 'Review application',
    })),
    ...C.invitations.map(C.invitationView).map(i => requestItem('CLUB_INVITATION', i.id, {
      title: `Club invitation · ${pretty(i.role)}`, context: `Sent to ${i.fullName} · ${club}`, status: i.status, direction: 'OUTGOING', actionable: false,
      updatedAt: i.createdAt, destination: workspace('invites'),
    })),
    ...C.roleRequests.map(C.roleRequestView).map(r => requestItem('STAFF_ROLE_REQUEST', r.id, {
      title: `Role request · ${pretty(r.role_key)}${r.squad_names?.length ? `, ${r.squad_names.join(', ')}` : ''}`, context: `${r.name} · ${club}`, status: r.status, direction: 'INCOMING', actionable: r.status === 'PENDING',
      updatedAt: r.created_at, destination: workspace('role-requests'), actionLabel: 'Review request',
    })),
  ];
}
/** The tournament invitations in Requests, from the one store: still to answer (incoming), else answered (history). */
const tournamentInvitationRequests = () => F.tournamentInvitations.filter(inv => inv.status !== 'CANCELLED').map(inv => {
  const v = F.invitationView(inv), summary = F.tournamentSummary(v.tournament);
  return { key: `TOURNAMENT_INVITATION:${inv.id}`, family: 'TOURNAMENT_INVITATION', id: inv.id, title: `Invitation · ${summary.name}`, context: `${summary.hostClubName ?? summary.organizerName} · ${v.squadName ?? v.clubName}`,
    status: inv.status, direction: 'INCOMING', actionable: inv.status === 'PENDING', updatedAt: iso(inv.updatedAt ?? inv.createdAt), destination: `/tournaments/${inv.tournamentId}`, actionLabel: 'Review invitation' };
});
async function allRequests() {
  const C = await clubStore();
  if (!C?.applications) return [...S.requestItems, ...tournamentInvitationRequests()];
  const appointment = id => C.appointments?.find(a => a.id === id);
  const own = S.requestItems.filter(i => !CLUB_FAMILIES.has(i.family)).map(i => {
    const a = i.family === 'STAFF_APPOINTMENT' && appointment(i.id);
    return a && a.status !== 'INVITED' ? { ...i, status: a.status === 'ACTIVE' ? 'ACCEPTED' : a.status, actionable: false } : i;
  });
  return [...own, ...tournamentInvitationRequests(), ...clubRequests(C)];
}
get('/requests', async ({ query }) => {
  const view = ['INCOMING', 'OUTGOING', 'HISTORY'].includes(query.get('view')) ? query.get('view') : 'INCOMING';
  const page = Math.max(0, num(query, 'page', 0)), size = Math.max(1, Math.min(50, num(query, 'size', 20)));
  const all = await allRequests();
  const items = all.filter(inView(view)).sort((a, b) => (b.actionable - a.actionable) || b.updatedAt.localeCompare(a.updatedAt));
  const incoming = all.filter(inView('INCOMING'));
  return {
    items: items.slice(page * size, page * size + size),
    counts: { incoming: incoming.length, actionable: incoming.filter(i => i.actionable).length, outgoing: all.filter(inView('OUTGOING')).length, history: all.filter(inView('HISTORY')).length },
    total: items.length, hasMore: (page + 1) * size < items.length, unavailableSources: [],
  };
});
// Tournament invitations come from the one store the lists and the tournament pane read (world-football).
const invitation = params => F.tournamentInvitations.find(i => i.id === Number(params.id) && i.tournamentId === Number(params.tid));
// As the backend: a tournament that takes squads needs one named when the invitation names none; the squads offered are the club's.
const reviewOf = inv => {
  const t = F.tournamentById(inv.tournamentId);
  return { requiresSquad: F.scopeOf(t) === 'SQUAD' && !inv.squadId, squads: W.squads.filter(s => s.clubId === inv.clubId).map(s => ({ id: s.id, name: s.name })), status: inv.status };
};
get('/tournaments/:tid/invitations/:id/review', ({ params }) => { const inv = invitation(params); return inv ? reviewOf(inv) : undefined; });
post('/tournaments/:tid/invitations/:id/decline', ({ params }) => {
  const inv = invitation(params);
  if (!inv) return undefined;
  if (inv.status !== 'PENDING') return reply(409, { status: 409, message: 'This invitation was already answered.' });
  Object.assign(inv, { status: 'DECLINED', updatedAt: new Date() });
  return { id: inv.id, status: inv.status, squadId: null };
});
// Accepting enters the club (or the squad) by the tournament's rules: one live entry per club, the window, the waiting list.
post('/tournaments/:tid/invitations/:id/accept', ({ params, body }) => {
  const inv = invitation(params);
  if (!inv) return undefined;
  if (inv.status !== 'PENDING') return reply(409, { status: 409, message: 'This invitation was already answered.' });
  const squadId = inv.squadId ?? (body?.squadId ? Number(body.squadId) : null);
  if (reviewOf(inv).requiresSquad && !squadId) return badRequest('Choose the team entering the tournament.');
  if (squadId && W.squadById(squadId)?.clubId !== inv.clubId) return badRequest('Choose a squad of the invited club.');
  const { refusal } = F.enterTournament(F.tournamentById(inv.tournamentId), { clubId: inv.clubId, squadId, invited: true });
  if (refusal) return reply(refusal.status, refusal);
  Object.assign(inv, { status: 'ACCEPTED', updatedAt: new Date() });
  return { id: inv.id, status: inv.status, squadId };
});

// ================================================================ chat
const lastMessageOf = c => S.chatMessages.filter(m => m.conversationId === c.id).at(-1) ?? null;
function conversationDto(c) {
  const last = lastMessageOf(c);
  const members = [...c.members.filter(id => id !== ME), ME];
  return {
    id: c.id, name: c.name, contextType: c.contextType, contextId: c.contextId,
    lastMessage: last?.content ?? null, lastMessageSenderId: last?.senderId ?? null, lastMessageSenderName: last ? displayName(last.senderId) : null, lastMessageAt: last ? iso(last.createdAt) : null,
    unreadCount: c.unread.get(ME) ?? 0, participantCount: members.length,
    participants: members.map(id => ({ userId: id, displayName: displayName(id), profilePictureUrl: avatarOf(id), role: c.contextType === 'DIRECT' ? null : id === c.creatorId ? 'CREATOR' : 'MEMBER' })),
  };
}
const messageDto = m => ({ id: m.id, conversationId: m.conversationId, senderId: m.senderId, senderName: displayName(m.senderId), content: m.content, createdAt: iso(m.createdAt) });
const myConversation = id => { const c = S.conversationById(id); return c && c.members.includes(ME) ? c : null; };
const threadOf = c => S.chatMessages.filter(m => m.conversationId === c.id);
get('/chat/conversations', ({ query }) => {
  const list = S.conversations.filter(c => c.members.includes(ME)).sort((a, b) => (lastMessageOf(b)?.createdAt ?? 0) - (lastMessageOf(a)?.createdAt ?? 0));
  return pageOf(list.map(conversationDto), query);
});
get('/chat/conversations/:id', ({ params }) => { const c = myConversation(params.id); return c ? conversationDto(c) : notFound('Conversation not found.'); });
get('/chat/conversations/:id/messages', ({ params, query }) => {
  const c = myConversation(params.id);
  if (!c) return notFound('Conversation not found.');
  const all = threadOf(c), page = Math.max(0, num(query, 'page', 0)), size = Math.max(1, Math.min(100, num(query, 'size', 50)));
  const end = Math.max(0, all.length - page * size);
  return { content: all.slice(Math.max(0, end - size), end).map(messageDto), pageNumber: page, pageSize: size, totalElements: all.length };
});
get('/chat/conversations/:id/messages/before', ({ params, query }) => {
  const c = myConversation(params.id);
  if (!c) return notFound();
  return threadOf(c).filter(m => m.id < num(query, 'beforeId', 0)).slice(-num(query, 'size', 50)).map(messageDto);
});
get('/chat/conversations/:id/messages/after', ({ params, query }) => {
  const c = myConversation(params.id);
  if (!c) return notFound();
  return threadOf(c).filter(m => m.id > num(query, 'afterId', 0)).slice(0, num(query, 'size', 100)).map(messageDto);
});
const sentByClientId = new Map();
post('/chat/conversations/:id/messages', ({ params, body }) => {
  const c = myConversation(params.id);
  if (!c) return notFound();
  const content = String(body?.content ?? '').trim();
  if (!content) return badRequest('Write a message first.');
  const key = `${c.id}:${body?.clientMessageId}`;
  if (body?.clientMessageId && sentByClientId.has(key)) return messageDto(sentByClientId.get(key));
  const m = { id: S.newMessageId(), conversationId: c.id, senderId: ME, content, createdAt: new Date() };
  S.chatMessages.push(m);
  if (body?.clientMessageId) sentByClientId.set(key, m);
  return created(messageDto(m));
});
post('/chat/conversations', ({ body }) => {
  const others = [...new Set((body?.participantIds ?? []).map(Number))].filter(id => id !== ME && person(id));
  if (!others.length) return badRequest('Choose at least one person.');
  if (body?.contextType !== 'GROUP') {
    const existing = S.conversations.find(c => c.contextType === 'DIRECT' && c.members.length === 2 && c.members.includes(ME) && c.members.includes(others[0]));
    if (existing) return conversationDto(existing);
  }
  const c = { id: Math.max(...S.conversations.map(x => x.id)) + 1, contextType: body?.contextType === 'GROUP' ? 'GROUP' : 'DIRECT', name: body?.contextType === 'GROUP' ? String(body?.name || 'New group') : null, contextId: null, members: [...others, ME], creatorId: ME, unread: new Map() };
  S.conversations.push(c);
  return created(conversationDto(c));
});
post('/chat/conversations/:id/participants', ({ params, body }) => {
  const c = myConversation(params.id);
  if (!c) return notFound();
  for (const id of (body?.userIds ?? []).map(Number)) if (person(id) && !c.members.includes(id)) c.members.push(id);
  return conversationDto(c);
});
del('/chat/conversations/:id/participants/:userId', ({ params }) => { const c = myConversation(params.id); if (!c) return notFound(); c.members = c.members.filter(id => id !== Number(params.userId)); return noContent(); });
del('/chat/conversations/:id/leave', ({ params }) => { const c = myConversation(params.id); if (!c) return notFound(); c.members = c.members.filter(id => id !== ME); return noContent(); });
post('/chat/conversations/:id/read', ({ params }) => { const c = myConversation(params.id); if (!c) return notFound(); c.unread.set(ME, 0); return { unreadCount: 0 }; });
get('/chat/conversations/:id/suggestions', ({ params }) => myConversation(params.id) ? [] : notFound());
post('/chat/conversations/:id/suggestions', ({ params, body }) => {
  const c = myConversation(params.id);
  if (!c) return notFound();
  const target = Number(body?.suggestedUserId);
  return created({ id: Date.now() % 100000, conversationId: c.id, suggestedBy: ME, suggestedByDisplayName: displayName(ME), suggestedUserId: target, suggestedUserDisplayName: displayName(target), profilePictureUrl: avatarOf(target), status: 'PENDING', createdAt: iso(new Date()) });
});
post('/chat/conversations/:id/block/:userId', ({ params }) => { const c = myConversation(params.id); if (!c) return notFound(); blocked.add(Number(params.userId)); c.members = c.members.filter(id => id !== Number(params.userId)); return noContent(); });
get('/joining/conversations/:id/enquiries', ({ params }) => (S.conversationById(params.id) ? [] : undefined));

// ================================================================ squad communication
const DINAMO = W.clubById(1);
const squadFor = id => { const s = W.squadById(id); return s && s.clubId === 1 ? s : null; };
const coachesOf = s => [...new Set([s.headCoachId, S.STAFF.assistant, S.STAFF.gk].filter(Boolean))];
const unreadFor = s => [...(S.squadUnread.get(s.id)?.values() ?? [])].reduce((a, b) => a + b, 0);
const spaceDto = s => ({ id: s.id, club_id: s.clubId, academy_name: DINAMO.name, name: s.name, category: s.ageGroup, can_manage: true, unread_count: unreadFor(s) });
const sessionEvents = s => W.events.filter(e => e.squadId === s.id && (e.type === 'TRAINING' || e.type === 'MATCH')).sort((a, b) => a.start - b.start);
const defaultResponse = (event, playerId) => {
  const h = (event.id * 31 + playerId * 17) % 20;
  if (event.start < W.NOW) return h < 18 ? 'GOING' : 'NOT_GOING';
  const days = (event.start - W.NOW) / 86400000;
  return days > 6 ? (h < 6 ? 'GOING' : 'UNANSWERED') : h < 16 ? 'GOING' : h < 18 ? 'NOT_GOING' : 'UNANSWERED';
};
// Opt-out attendance: where nobody was asked to confirm, families only ever say "can't come".
const optOutDefault = (event, playerId) => { const r = defaultResponse(event, playerId); return r === 'GOING' && !P.confirmationRequested(event) ? 'UNANSWERED' : r; };
const responseOf = (event, playerId) => S.sessionResponses.get(`${event.id}:${playerId}`) ?? optOutDefault(event, playerId);
function overviewDto(s) {
  const families = S.familiesOf(s.id);
  const coaches = coachesOf(s);
  const week = sessionEvents(s).filter(e => e.start > W.NOW && e.start - W.NOW < 7 * 86400000);
  const latestImportant = S.squadMessages.filter(m => m.squadId === s.id && m.kind === 'ANNOUNCEMENT' && m.important && !m.removed).sort((a, b) => b.createdAt - a.createdAt)[0];
  return {
    ...spaceDto(s), viewer_id: ME, member_count: s.playerIds.length + families.filter(id => !s.playerIds.includes(id)).length + coaches.length,
    notify_chat: S.squadNotify.get(s.id) ?? true, head_coach_id: s.headCoachId, can_assign_coach: true,
    available_coaches: W.staff.filter(x => x.kind === 'COACH').map(x => ({ user_id: x.personId, full_name: displayName(x.personId) })),
    coaches: coaches.map(id => ({ user_id: id, full_name: displayName(id) })),
    players: s.playerIds.map(id => ({ id, name: displayName(id) })),
    threads: families.map(id => ({ user_id: id, full_name: person(id).role === 'PARENT' ? `${displayName(id)} (${person(S.childOf(id))?.firstName ?? 'family'})` : displayName(id), unread_count: S.squadUnread.get(s.id)?.get(id) ?? 0 })),
    attention: {
      upcoming_sessions: week.length,
      replies_needed: week.filter(e => P.confirmationRequested(e)).reduce((n, e) => n + s.playerIds.filter(id => responseOf(e, id) === 'UNANSWERED').length, 0),
      acknowledgements_needed: latestImportant ? families.filter(id => !latestImportant.acknowledged.has(id)).length : 0,
    },
  };
}
const squadMessageDto = m => {
  const reactions = [...m.reactions.entries()].map(([user_id, reaction]) => ({ user_id, full_name: displayName(user_id), reaction }));
  return {
    id: m.id, author_id: m.authorId, author_name: displayName(m.authorId), thread_user_id: m.threadUserId, kind: m.kind, title: m.title, body: m.body, important: m.important,
    created_at: iso(m.createdAt), expires_at: m.expiresAt ? iso(m.expiresAt) : null, acknowledgement_requested: m.important && m.authorId !== ME, acknowledged_at: m.acknowledged.has(ME) ? iso(m.acknowledged.get(ME)) : null,
    acknowledged_by: [...m.acknowledged.entries()].map(([user_id, at]) => ({ user_id, full_name: displayName(user_id), acknowledged_at: iso(at) })),
    reactions, comment_count: m.comments.length,
  };
};
const withSquad = fn => ({ params, ...req }) => { const s = squadFor(params.id); return s ? fn(s, { params, ...req }) : forbidden('This squad space is not available to you.'); };
const findSquadMessage = (s, id) => S.squadMessages.find(m => m.squadId === s.id && m.id === Number(id) && !m.removed);

get('/squad-communication', () => S.MY_SQUADS.map(id => spaceDto(W.squadById(id))));
get('/squad-communication/:id', withSquad(s => overviewDto(s)));
get('/squad-communication/:id/messages', withSquad((s, { query }) => {
  const kind = query.get('kind') === 'CHAT' ? 'CHAT' : 'ANNOUNCEMENT';
  const thread = query.get('threadUserId') ? Number(query.get('threadUserId')) : null;
  const before = query.get('before') ? Number(query.get('before')) : Infinity;
  return S.squadMessages.filter(m => m.squadId === s.id && !m.removed && m.kind === kind && (kind === 'ANNOUNCEMENT' || m.threadUserId === thread) && m.id < before)
    .sort((a, b) => b.id - a.id).slice(0, 50).map(squadMessageDto);
}));
post('/squad-communication/:id/messages', withSquad((s, { body }) => {
  const text = String(body?.body ?? '').trim();
  if (!text) return badRequest('Write a message first.');
  const kind = body?.kind === 'CHAT' ? 'CHAT' : 'ANNOUNCEMENT';
  const expiresAt = kind === 'ANNOUNCEMENT' && body?.expiresAt ? new Date(body.expiresAt) : null;
  if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date())) return badRequest('Choose a pinned-until day from today on.');
  // A retried post with the same request id returns the first one.
  const repeat = body?.requestId && S.squadMessages.find(x => x.requestId === body.requestId);
  if (repeat) return created({ id: repeat.id });
  const m = { id: S.newSquadMessageId(), squadId: s.id, authorId: ME, threadUserId: body?.threadUserId ?? null, kind, title: body?.title ?? null, body: text, important: !!body?.important, createdAt: new Date(), expiresAt, requestId: body?.requestId ?? null, reactions: new Map(), comments: [], acknowledged: new Map() };
  S.squadMessages.push(m);
  return created({ id: m.id });
}));
post('/squad-communication/:id/read', withSquad((s, { body }) => { const thread = body?.threadUserId; if (thread != null) S.squadUnread.get(s.id)?.set(Number(thread), 0); return noContent(); }));
post('/squad-communication/:id/messages/:mid/acknowledge', withSquad((s, { params }) => { const m = findSquadMessage(s, params.mid); if (!m) return notFound(); m.acknowledged.set(ME, new Date()); return squadMessageDto(m); }));
del('/squad-communication/:id/messages/:mid', withSquad((s, { params }) => { const m = findSquadMessage(s, params.mid); if (!m) return notFound(); m.removed = true; return noContent(); }));
get('/squad-communication/:id/messages/:mid/receipts', withSquad((s, { params }) => {
  const m = findSquadMessage(s, params.mid);
  if (!m) return notFound();
  return S.familiesOf(s.id).map(id => ({ user_id: id, full_name: displayName(id), acknowledged_at: m.acknowledged.has(id) ? iso(m.acknowledged.get(id)) : null }));
}));
put('/squad-communication/:id/messages/:mid/reactions', withSquad((s, { params, body }) => {
  const m = findSquadMessage(s, params.mid);
  if (!m) return notFound();
  if (body?.active) m.reactions.set(ME, body.reaction); else if (m.reactions.get(ME) === body?.reaction) m.reactions.delete(ME);
  return squadMessageDto(m);
}));
const updateCommentDto = c => ({ id: c.id, author_id: c.authorId, author_name: displayName(c.authorId), body: c.body, created_at: iso(c.createdAt) });
get('/squad-communication/:id/messages/:mid/comments', withSquad((s, { params, query }) => {
  const m = findSquadMessage(s, params.mid);
  if (!m) return notFound();
  const before = query.get('before') ? Number(query.get('before')) : Infinity;
  return m.comments.filter(c => c.id < before && !c.removed).slice(-50).map(updateCommentDto);
}));
post('/squad-communication/:id/messages/:mid/comments', withSquad((s, { params, body }) => {
  const m = findSquadMessage(s, params.mid);
  if (!m) return notFound();
  const c = { id: S.newCommentId(), authorId: ME, body: String(body?.body ?? '').trim(), createdAt: new Date() };
  if (!c.body) return badRequest('Write a comment first.');
  m.comments.push(c);
  return created(updateCommentDto(c));
}));
del('/squad-communication/:id/messages/:mid/comments/:cid', withSquad((s, { params }) => { const m = findSquadMessage(s, params.mid); const c = m?.comments.find(x => x.id === Number(params.cid)); if (!c) return notFound(); c.removed = true; return noContent(); }));
put('/squad-communication/:id/preferences', withSquad((s, { body }) => { S.squadNotify.set(s.id, !!body?.notifyChat); return { notifyChat: S.squadNotify.get(s.id) }; }));
put('/squad-communication/:id/coach', withSquad((s, { body }) => { s.headCoachId = body?.userId ? Number(body.userId) : null; return overviewDto(s); }));
function sessionDto(s, e) {
  const venue = W.venueById(e.venueId);
  return {
    id: e.id, title: e.type === 'MATCH' ? e.title : e.title, event_type: e.type, description: e.type === 'MATCH' ? `${e.competition} · ${e.kind === 'LEAGUE' ? 'League match' : 'Friendly'}` : e.notes ?? null,
    starts_at: W.local(e.start), ends_at: W.local(e.end), location: venue ? `${venue.name}${e.pitch ? ` · ${e.pitch}` : ''}` : null,
    status: e.cancelled ? 'CANCELLED' : 'SCHEDULED', cancellation_reason: e.cancelled ?? null, revision: e.revision ?? 1, response_revision: 1, response_kind: 'INTENT',
    response_requested: P.confirmationRequested(e), series_id: e.type === 'TRAINING' ? `squad-${s.id}-training` : null,
    attendance: s.playerIds.map(id => ({ id, name: displayName(id), response: responseOf(e, id), reason: responseOf(e, id) === 'NOT_GOING' ? P.replyReasons.get(`${e.id}:${id}`) ?? (S.sessionResponses.has(`${e.id}:${id}`) ? null : P.defaultReason(e.id, id)) : null, active: true, response_status: 'CURRENT', response_valid: true, previous_response: null, recorded_by: responseOf(e, id) === 'UNANSWERED' ? null : 'PLAYER', responded_at: null })),
    venue_reservation: null, introductory_visitors: [],
  };
}
get('/squad-communication/:id/sessions', withSquad((s, { query }) => {
  const from = query.get('from') ? new Date(query.get('from')) : new Date(W.NOW.getTime() - 7 * 86400000);
  const to = query.get('to') ? new Date(query.get('to')) : new Date(W.NOW.getTime() + 28 * 86400000);
  return sessionEvents(s).filter(e => e.end >= from && e.start <= to).map(e => sessionDto(s, e));
}));
put('/squad-communication/:id/sessions/:sid/attendance', withSquad((s, { params, body }) => {
  const e = sessionEvents(s).find(x => x.id === Number(params.sid));
  if (!e) return notFound('Session not found.');
  if (!s.playerIds.includes(Number(body?.playerId))) return badRequest('This player is not in the squad.');
  S.sessionResponses.set(`${e.id}:${Number(body.playerId)}`, body?.response === 'NOT_GOING' ? 'NOT_GOING' : body?.response === 'GOING' ? 'GOING' : body?.response === 'UNSURE' ? 'UNSURE' : 'UNANSWERED');
  if (body?.response === 'NOT_GOING' && body?.reason) P.replyReasons.set(`${e.id}:${Number(body.playerId)}`, String(body.reason).trim().slice(0, 140)); else if (body?.response !== 'NOT_GOING') P.replyReasons.delete(`${e.id}:${Number(body.playerId)}`);
  return sessionDto(s, e);
}));
post('/squad-communication/:id/sessions/:sid/cancel', withSquad((s, { params, body }) => {
  const e = sessionEvents(s).find(x => x.id === Number(params.sid));
  if (!e) return notFound('Session not found.');
  e.cancelled = String(body?.reason ?? 'Cancelled by the coach'); e.revision = (e.revision ?? 1) + 1;
  return sessionDto(s, e);
}));
post('/squad-communication/:id/sessions/:sid/cancel/preview', withSquad((s, { params }) => {
  const e = sessionEvents(s).find(x => x.id === Number(params.sid));
  return e ? { revision: e.revision ?? 1, material: true, responsePolicy: 'INVALIDATE', affectedParticipants: s.playerIds.length, affectedResponses: s.playerIds.filter(id => responseOf(e, id) !== 'UNANSWERED').length, addedParticipants: 0, removedParticipants: 0, notificationRecipients: S.familiesOf(s.id).length } : notFound();
}));

// ================================================================ Agent Dola
const dolaConversations = new Map(); // id -> { turns, expiresAt }
const DOLA_RETENTION = 45 * 60000;
get('/assistant/dola/status', () => ({ name: 'Agent Dola', available: true, mode: 'GROUNDED', maxMessageLength: 2000, capabilities: ['NAVIGATION', 'SCHEDULE', 'SQUAD_UPDATES', 'MATCHES'] }));
get('/assistant/dola/welcome', () => ({ contexts: ['coach', 'discover'] }));
get('/assistant/dola/conversations/latest', () => {
  const latest = [...dolaConversations.entries()].filter(([, c]) => c.expiresAt > Date.now()).at(-1);
  return latest ? { conversationId: latest[0], expiresAt: iso(new Date(latest[1].expiresAt)), turns: latest[1].turns } : noContent();
});
del('/assistant/dola/conversations/:id', ({ params }) => { dolaConversations.delete(params.id); return noContent(); });
const when = d => `${S.dayMonth(d)} at ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
function dolaAnswer(message, request) {
  const text = message.toLowerCase();
  const u16 = W.squadById(105), u14 = W.squadById(103);
  const training = S.nextTraining(105), u14Training = S.nextTraining(103), match = S.nextMatch(105), u14Match = S.nextMatch(103);
  const unanswered = training ? u16.playerIds.filter(id => responseOf(training, id) === 'UNANSWERED').length : 0;
  let answer, destinations, actions = [], followUps;
  if (/update|announce|message|famil|parent|ოჯახ/.test(text)) {
    const draft = `Matchday reminder: kick-off against ${match.opponentName} is on ${when(match.start)}. Please arrive 75 minutes early with the white home kit, shin pads and water. Reply in Sessions if your child cannot make it.`;
    answer = `Here is a draft coach update for U16 Boys. Review it before posting — it will notify ${S.familiesOf(105).length} families and players.\n\n“${draft}”`;
    destinations = [{ id: 'squad_updates:105', title: 'U16 Boys updates', path: '/squads/105' }];
    actions = [{ id: `act-${Date.now()}`, kind: 'COACH_UPDATE', state: 'PENDING', title: 'Post update to U16 Boys', body: draft, details: [{ label: 'Squad', value: 'U16 Boys' }, { label: 'Audience', value: `${S.familiesOf(105).length} families and players` }, { label: 'Acknowledgement', value: 'Requested' }], confirmLabel: 'Post update', expiresAt: iso(new Date(Date.now() + 30 * 60000)), receipt: '', destination: destinations[0] }];
    followUps = ['Make it shorter', 'Add the meeting point', 'Translate it into Georgian'];
  } else if (/match|game|opponent|fixture|მატჩ/.test(text)) {
    answer = `Your next fixtures:\n• U16 Boys vs ${match.opponentName} — ${when(match.start)} (${match.competition}).\n• U14 Boys vs ${u14Match.opponentName} — ${when(u14Match.start)}. ${u14Match.opponentName} asked to move kick-off to 12:30; the request is waiting in Requests.`;
    destinations = [{ id: 'match_exchange', title: 'Matches & competitions', path: '/match-exchange' }, { id: 'squad_schedule:105', title: 'U16 Boys sessions', path: '/squads/105?tab=sessions' }];
    followUps = ['Who is unavailable for the U16 game?', 'Draft a matchday update'];
  } else if (/job|volunteer|role|hiring/.test(text)) {
    answer = `There are ${W.roles.length} open football roles near you, including ${W.roles.slice(0, 3).map(r => `${r.title} (${W.clubById(r.clubId).name})`).join(', ')}.`;
    destinations = [{ id: 'jobs', title: 'Football jobs', path: '/jobs' }];
    followUps = ['Show volunteering roles only'];
  } else {
    answer = `Here is your week at FC Dinamo Tbilisi Academy:\n• U16 Boys train next on ${when(training.start)} (${training.title}). ${unanswered === 0 ? 'Every player has replied.' : unanswered === 1 ? 'One player has not replied yet.' : `${unanswered} players have not replied yet.`}\n• U14 Boys train on ${when(u14Training.start)}.\n• Next match: U16 Boys vs ${match.opponentName} on ${when(match.start)}.\n• ${S.requestItems.filter(i => i.actionable).length} requests are waiting for your decision.`;
    destinations = [{ id: 'squad_schedule:105', title: 'U16 Boys sessions', path: '/squads/105?tab=sessions' }, { id: 'my_squads', title: 'My squads', path: '/squads' }, { id: 'my_schedule', title: 'My schedule', path: '/calendar?scope=personal' }];
    followUps = ['Draft a coach update for U16 Boys', 'What are my next matches?', 'Which families still need to reply?'];
  }
  const conversationId = request?.conversationId && dolaConversations.has(request.conversationId) ? request.conversationId : `dola-${Date.now().toString(36)}`;
  const result = { conversationId, requestId: request?.requestId ?? `req-${Date.now()}`, answer, destinations, sources: [{ id: 'squad-schedule', title: 'Squad schedule', text: 'Training and match times for your squads.', reviewedAt: iso(new Date()) }], toolsUsed: ['schedule', 'squads'], modelCalls: 1, totalTokens: 812, actions, followUps };
  const conv = dolaConversations.get(conversationId) ?? { turns: [], expiresAt: 0 };
  conv.turns.push({ question: message, result }); conv.expiresAt = Date.now() + DOLA_RETENTION;
  dolaConversations.set(conversationId, conv);
  return result;
}
post('/assistant/dola/messages', ({ body }) => (body?.message ? dolaAnswer(String(body.message), body) : badRequest('Ask Dola something first.')));
post('/assistant/dola/messages/stream', ({ body }) => {
  if (!body?.message) return badRequest('Ask Dola something first.');
  const answer = dolaAnswer(String(body.message), body);
  const words = answer.answer.split(/(?<= )/);
  const chunks = [];
  for (let i = 0; i < words.length; i += 6) chunks.push(words.slice(i, i + 6).join(''));
  const events = [{ type: 'ready' }, ...chunks.map(text => ({ type: 'delta', text })), { type: 'complete', answer }];
  return reply(200, events.map(e => JSON.stringify(e)).join('\n') + '\n', { 'content-type': 'application/x-ndjson' });
});
post('/assistant/dola/conversations/:id/actions/:actionId/:decision', ({ params }) => {
  const conv = dolaConversations.get(params.id);
  const action = conv?.turns.flatMap(t => t.result.actions ?? []).find(a => a.id === params.actionId);
  if (!action) return notFound('This action is no longer available.');
  if (action.state !== 'PENDING') return reply(409, { status: 409, message: 'This action was already handled.' });
  if (params.decision === 'confirm' && action.kind === 'COACH_UPDATE') {
    S.squadMessages.push({ id: S.newSquadMessageId(), squadId: 105, authorId: ME, threadUserId: null, kind: 'ANNOUNCEMENT', title: 'Matchday reminder', body: action.body, important: true, createdAt: new Date(), reactions: new Map(), comments: [], acknowledged: new Map() });
    action.receipt = 'Posted to U16 Boys coach updates.';
  }
  action.state = params.decision === 'confirm' ? 'COMPLETED' : 'DISCARDED';
  return action;
});

// ================================================================ fallbacks
// Personal lists that sit between domains (club journey, invitations, applications, followed
// clubs). They register after every domain module has loaded, so another domain's handler for
// the same route always wins and these only fill the gap with Luka's real situation.
queueMicrotask(() => {
  get('/me/club-journey', () => ({
    applications: [], invitations: [], tryouts: [], recentDecisions: [],
    affiliations: [{ clubId: 1, clubName: DINAMO.name, status: 'ACTIVE', squadName: null, trialEndsOn: null, consentStatus: null, joinedAt: '2019-07-01T09:00:00Z', endedAt: null }],
  }));
  get('/organizations/invitations/mine', () => []);
  get('/organizations/team-invitations/mine', () => []);
  get('/recruitment/applications', () => []);
  get('/tryouts/my-applications', () => []);
});
