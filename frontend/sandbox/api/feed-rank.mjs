// The Home feed's foundation, faked as the server would do it: every post carries a topic, a place and a reach,
// and Discover ranks them in one fixed order for the person reading. Ranking belongs to the backend; this file
// states the rules so they can be built there (docs/claude-sandbox/BACKEND_NEEDS.md, "Sign-in and the start").
//
//   1. People and clubs the person is linked to (their squads, club, children), and their own posts.
//   2. Who they follow.
//   3. Posts near them on the topics they chose (near: 40 km for local news, 120 km for regional notices
//      such as tournament entries and jobs; no chosen topics means every topic).
//   4. National highlights (pro clubs, advice from referees, specialists and agents).
//   5. Posts from far away only if popular (40 reactions or more); a regional notice never travels.
//   6. Posts near them on other topics, so Home is never empty.
//   "Show less like this" moves that author's posts on that topic to the end.
//   Within a tier, newest first. Reach is set by the kind of post, never by the poster.
import * as W from './world.mjs';

export const NEAR_KM = 40;
export const REGION_KM = 120;
export const POPULAR_REACTIONS = 40;

const toRad = value => (value * Math.PI) / 180;
export function kmBetween(a, b) {
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The topics a person can choose, and the post topics and tags each one covers. */
export const INTEREST_TOPICS = {
  CLUBS: { topics: ['CLUB_NEWS', 'TRAINING', 'RESULT', 'FIXTURE', 'TRIAL'] },
  YOUTH: { tags: ['YOUTH'] },
  MATCHES: { topics: ['RESULT', 'FIXTURE'] },
  TOURNAMENTS: { topics: ['TOURNAMENT'] },
  WOMENS: { tags: ['WOMENS'] },
  JOBS: { topics: ['JOB', 'PLAYER_SEARCH'] },
  STORE: { topics: ['STORE'] },
};

/** How far a post reaches, by what kind of post it is. */
const REACH_BY_TOPIC = { RESULT: 'LOCAL', FIXTURE: 'LOCAL', TRAINING: 'LOCAL', TRIAL: 'LOCAL', CLUB_NEWS: 'LOCAL', TOURNAMENT: 'REGIONAL', JOB: 'REGIONAL', PLAYER_SEARCH: 'REGIONAL', STORE: 'FOLLOWERS', ADVICE: 'NATIONAL', PERSONAL: 'FOLLOWERS' };
const RADIUS = { LOCAL: NEAR_KM, REGIONAL: REGION_KM, NATIONAL: Infinity };

const RULES = [
  ['PLAYER_SEARCH', /looking for a (?:club|team|women’s team)/i],
  ['JOB', /hiring|volunteers? (?:for|needed|wanted)|\bjob\b|applications close|helpers/i],
  ['RESULT', /full time|final score|\bwin\b|\blose\b|\bdraw\b|player of the match|three points|tough afternoon against|a good game on/i],
  ['FIXTURE', /matchday|next up|kick-off|kick off|come and support|looking for (?:a )?(?:\S+ )?friendl|\bvs\b/i],
  ['TRIAL', /trial|taster|first session for new|talent day|bring a friend|under 8s/i],
  ['STORE', /new kit|kit (?:collection|day)|training tops|merch|club store|\bstore\b|sponsors? for/i],
  ['TRAINING', /session|training|drill|rondo|screening|camp|floodlights|under the lights/i],
  ['TOURNAMENT', /registration (?:closes|opens)|entries? (?:open|close)|\bcup\b|festival|tournament|is entered for|sunday league|places left/i],
];
const ADVICE = /\btips?\b|\bguide\b|hydration|nerves are normal|before signing|check the licence|respect the officials|strength training|how do you|question for/i;
const YOUTH = /\bu\d{1,2}\b|under \d|academy|kids|children|youth|aged \d|families|parents|boys|girls/i;
const WOMENS = /girls|women/i;

const facts = new Map(); // post id -> { topic, tags, reach }
/** A few seeded posts the keyword rules misread. */
const OVERRIDES = new Map([
  [901, { topic: 'FIXTURE' }], // U14 parents: Saturday kick-off moved
  [903, { topic: 'CLUB_NEWS' }], // volunteers painted the changing rooms
  [907, { topic: 'ADVICE' }], // the one drill you would keep
  [908, { topic: 'CLUB_NEWS' }], // U18s called up for a camp
  [904, { topic: 'FIXTURE' }], // Matchday: come and support
]);

function classify(post) {
  const text = post.content ?? '';
  const author = post.authorId ? W.personById(post.authorId) : null;
  const club = post.clubId ? W.clubById(post.clubId) : null;
  let topic = RULES.find(([, pattern]) => pattern.test(text))?.[0];
  if (!post.clubId && (['REFEREE', 'SPECIALIST', 'AGENT'].includes(author?.role) || ADVICE.test(text))) topic = 'ADVICE';
  if (!topic) topic = post.clubId ? 'CLUB_NEWS' : 'PERSONAL';
  topic = OVERRIDES.get(post.id)?.topic ?? topic;
  const tags = [];
  if (YOUTH.test(text) || club?.type === 'ACADEMY' || club?.type === 'SCHOOL') tags.push('YOUTH');
  if (WOMENS.test(text)) tags.push('WOMENS');
  // A professional club's news is a national highlight; its trials, jobs and tournaments keep their own reach.
  const national = club?.type === 'PROFESSIONAL' && ['CLUB_NEWS', 'RESULT', 'FIXTURE'].includes(topic);
  return { topic, tags, reach: national ? 'NATIONAL' : REACH_BY_TOPIC[topic] };
}

/** Where a post happens: its club, else its author's club, else the author's town; null for posts about nowhere in particular. */
export function placeOf(post) {
  const club = post.clubId ? W.clubById(post.clubId) : post.authorId ? W.clubById(W.personById(post.authorId)?.clubId) : null;
  if (club) return { city: club.city, latitude: club.lat, longitude: club.lng };
  const city = post.authorId ? W.personById(post.authorId)?.city : null;
  const centre = city ? W.cities[city] : null;
  return centre ? { city, latitude: centre.lat, longitude: centre.lng } : null;
}

/** The three facts every post carries. Classified once; a post edited later is read again. */
export function factsOf(post) {
  const cached = facts.get(post.id);
  if (cached && cached.content === post.content) return cached.value;
  const value = { ...classify(post), place: placeOf(post) };
  facts.set(post.id, { content: post.content, value });
  return value;
}

export const topicMatches = (post, topics) => {
  if (!topics.length) return true;
  const { topic, tags } = factsOf(post);
  return topics.some(interest => (INTEREST_TOPICS[interest]?.topics ?? []).includes(topic) || (INTEREST_TOPICS[interest]?.tags ?? []).some(tag => tags.includes(tag)));
};
export const authorKey = post => (post.clubId ? `club:${post.clubId}` : `user:${post.authorId}`);
export const demotionKey = post => `${authorKey(post)}:${factsOf(post).topic}`;

/**
 * Discover for one person. `viewer`: { id, linkedClubs, linkedPeople, followedPeople, followedClubs, home: { lat, lng },
 * topics, demoted }. Returns [{ post, why }] in reading order; `why` is what "Why am I seeing this?" says.
 */
export function rankFeed(posts, viewer) {
  const ranked = [];
  for (const post of posts) {
    const f = factsOf(post);
    const club = post.clubId ? W.clubById(post.clubId) : null;
    const name = club?.name ?? W.personById(post.authorId)?.fullName ?? 'GrassKickZ';
    const km = viewer.home && f.place ? Math.round(kmBetween(viewer.home, { lat: f.place.latitude, lng: f.place.longitude })) : null;
    const near = km != null && km <= (RADIUS[f.reach] ?? 0);
    const matches = topicMatches(post, viewer.topics);
    const popular = post.reactions.size >= POPULAR_REACTIONS;
    const own = post.authorId === viewer.id;
    let tier, why;
    if (own || (post.clubId && viewer.linkedClubs.has(post.clubId)) || (post.authorId && viewer.linkedPeople.has(post.authorId))) {
      tier = 1; why = { kind: own ? 'OWN' : 'LINKED', name };
    } else if ((post.authorId && viewer.followedPeople.has(post.authorId)) || (post.clubId && viewer.followedClubs.has(post.clubId))) {
      tier = 2; why = { kind: 'FOLLOWING', name };
    } else if (f.reach === 'FOLLOWERS') {
      continue;
    } else if (f.reach !== 'NATIONAL' && near && matches) {
      tier = 3; why = { kind: viewer.topics.length ? 'NEAR_TOPIC' : 'NEAR', name, place: f.place.city, distanceKm: km, topic: f.topic };
    } else if (f.reach === 'NATIONAL') {
      tier = 4; why = { kind: 'NATIONAL', name };
    } else if (!near && popular && f.reach === 'LOCAL') {
      tier = 5; why = { kind: 'POPULAR', name, place: f.place?.city ?? null, reactions: post.reactions.size };
    } else if (near) {
      tier = 6; why = { kind: 'NEAR', name, place: f.place.city, distanceKm: km, topic: f.topic };
    } else continue;
    if (viewer.demoted.has(demotionKey(post))) { tier = 9; why = { ...why, kind: 'LESS', topic: f.topic }; }
    ranked.push({ post, tier, why });
  }
  return ranked.sort((a, b) => a.tier - b.tier || b.post.createdAt - a.post.createdAt || b.post.id - a.post.id).map(({ post, why }) => ({ post, why }));
}
