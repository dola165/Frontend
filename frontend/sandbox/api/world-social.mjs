// Synthetic social layer for the sandbox, built on world.mjs: extra people, the follow
// graph, posts with reactions and comments, notifications, requests, direct chats and
// squad communication. Uses its own seeded generator and id ranges so the shared world
// (and the other domains that read it) stay stable whatever this module does.
import * as W from './world.mjs';

const { NOW, ME_ID, personById, clubById, squadById } = W;

// ---------------------------------------------------------------- helpers
let seed = 1651010;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const choose = list => list[Math.floor(rnd() * list.length)];
const between = (min, max) => min + Math.floor(rnd() * (max - min + 1));
const shuffled = list => { const copy = [...list]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; };

/** Keeps synthetic activity out of the small hours whatever time the server starts: the
 * 23:00–07:00 window is compressed into 23:00–23:59. Monotonic, never moves a time forward. */
export function plausible(date) {
  const d = new Date(date), hour = d.getHours();
  if (hour >= 7 && hour < 23) return d;
  const start = new Date(d); start.setHours(23, 0, 0, 0);
  if (hour < 7) start.setDate(start.getDate() - 1);
  return new Date(start.getTime() + (d - start) * (59 / 480));
}
export const minutesAgo = minutes => plausible(new Date(NOW.getTime() - minutes * 60000));
export const hoursAgo = hours => minutesAgo(hours * 60);
const after = (date, minutes) => plausible(new Date(Math.min(date.getTime() + minutes * 60000, NOW.getTime() - 60000)));
export const weekday = d => d.toLocaleDateString('en-GB', { weekday: 'long' });
export const dayMonth = d => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const hhmm = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const photo = slug => `/sandbox-media/photo/${slug}.svg`;
export const name = id => personById(id)?.fullName ?? 'GrassKickZ member';
export const firstName = id => personById(id)?.firstName ?? '';

// ---------------------------------------------------------------- extra people
// Profile route /profile/30 is a featured U16 Boys striker; the other clubs get named
// coaches so their posts, chats and requests have a real person behind them.
const taken = new Set(W.people.map(p => p.fullName));
function addPerson({ id, first, last, ...rest }) {
  if (personById(id)) return personById(id);
  const fullName = `${first} ${last}`;
  if (taken.has(fullName)) throw new Error(`world-social: duplicate name ${fullName}`);
  taken.add(fullName);
  const p = { id, firstName: first, lastName: last, fullName, username: `${first}.${last}`.toLowerCase(), gender: 'MALE', city: 'Tbilisi', clubId: null, position: null, avatarUrl: `/sandbox-media/avatar/${id}.svg`, ...rest };
  W.people.push(p);
  return p;
}

export const FEATURED_PLAYER_ID = 30;
const u16 = squadById(105);
addPerson({ id: 30, first: 'Saba', last: 'Lomidze', role: 'PLAYER', birthYear: NOW.getFullYear() - 16, clubId: 1, position: 'ST', headline: 'Striker · FC Dinamo Tbilisi Academy', shirtNumber: 17, squadId: 105, preferredFoot: 'LEFT' });
addPerson({ id: 31, first: 'Nino', last: 'Lomidze', gender: 'FEMALE', role: 'PARENT', birthYear: 1983, headline: 'Parent' });
if (!u16.playerIds.includes(30)) u16.playerIds.push(30);
if (!W.parents.some(link => link.childId === 30)) W.parents.push({ parentId: 31, childId: 30 });

const externalCoaches = [
  [32, 'Irakli', 'Gabunia', 3, 'Head coach'], [33, 'Davit', 'Arveladze', 4, 'Head of youth'], [34, 'Rati', 'Gogichaishvili', 5, 'U14 head coach'],
  [35, 'Natia', 'Kipiani', 6, 'Founder & coach', 'FEMALE'], [36, 'Mako', 'Tsintsadze', 10, 'Women’s team coach', 'FEMALE'], [37, 'Vakhtang', 'Kobakhidze', 11, 'Academy director'],
  [38, 'Keti', 'Mgeladze', 12, 'Girls’ programme lead', 'FEMALE'], [39, 'Ilia', 'Sulaberidze', 7, 'Head coach'],
];
export const clubCoach = {};
for (const [id, first, last, clubId, title, gender = 'MALE'] of externalCoaches) {
  const club = clubById(clubId);
  addPerson({ id, first, last, gender, role: 'COACH', birthYear: 1975 + (id % 15), city: club.city, clubId, headline: `${title} · ${club.name}`, staffTitle: title });
  clubCoach[clubId] = id;
}
// The licences these coaches state on their profiles (as stated: nothing checks them).
const STATED_LICENCES = { 32: 'UEFA B licence', 33: 'UEFA A licence', 34: 'UEFA C licence', 35: 'UEFA B licence', 36: 'UEFA C licence', 37: 'UEFA Pro licence', 38: 'UEFA B licence', 39: 'UEFA A licence' };
for (const [id, licence] of Object.entries(STATED_LICENCES)) W.personById(id).licences = [licence];

// ---------------------------------------------------------------- shortcuts into the world
export const staffBy = title => W.staff.find(s => s.title === title)?.personId;
export const STAFF = {
  assistant: staffBy('Assistant coach'), gk: staffBy('Goalkeeper coach'), fitness: staffBy('Fitness coach'), analyst: staffBy('Performance analyst'),
  nutrition: staffBy('Nutritionist'), physio: staffBy('Physiotherapist'), psych: staffBy('Sports psychologist'), director: staffBy('Academy director'),
  manager: staffBy('Team manager'), kit: staffBy('Kit manager'), welfare: staffBy('Welfare officer'), scout: staffBy('Scout'), youth: staffBy('Youth coach'),
};
export const parentOf = childId => W.parents.find(link => link.childId === childId)?.parentId ?? null;
export const childOf = parentId => W.parents.find(link => link.parentId === parentId)?.childId ?? null;
const playerAt = (squadId, position) => squadById(squadId).playerIds.find(id => personById(id).position === position);
const referee = i => W.referees[i].id;
const agentId = W.agents.find(a => a.headline.includes('Youth'))?.id ?? W.agents[0].id;
const specialist = profession => W.people.find(p => p.profession === profession)?.id;
const freeAgent = position => W.people.find(p => p.freeAgent && p.position === position)?.id;
/** The one date of birth every list and profile uses (the club workspace reads it too, through world-club). */
export const birthDate = p => `${p.birthYear}-${String(1 + (p.id * 7) % 12).padStart(2, '0')}-${String(1 + (p.id * 13) % 28).padStart(2, '0')}`;
export const ageOf = p => {
  const [y, m, d] = birthDate(p).split('-').map(Number), now = new Date();
  return now.getFullYear() - y - ((now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) ? 1 : 0);
};
export const isMinor = p => ageOf(p) < 18;
const matchesFor = squadId => W.matches.filter(m => m.squadId === squadId).sort((a, b) => a.start - b.start);
export const lastResult = squadId => matchesFor(squadId).filter(m => m.status === 'COMPLETED').at(-1);
export const nextMatch = squadId => matchesFor(squadId).find(m => m.status === 'SCHEDULED');
export const where = m => m.home ? 'Digomi' : clubById(m.opponentClubId).city;
const resultLine = m => { const [ours, theirs] = m.score; return ours > theirs ? `win ${ours}–${theirs}` : ours < theirs ? `lose ${ours}–${theirs}` : `draw ${ours}–${theirs}`; };
export const nextTraining = squadId => W.events.filter(e => e.type === 'TRAINING' && e.squadId === squadId && e.start > NOW).sort((a, b) => a.start - b.start)[0];

// ---------------------------------------------------------------- follow graph
export const follows = new Map(); // followerId -> Set(followeeId)
export const clubFollows = new Map(); // userId -> Set(clubId)
const followSet = id => { if (!follows.has(id)) follows.set(id, new Set()); return follows.get(id); };
const follow = (a, b) => { if (a !== b && personById(b)) followSet(a).add(b); };
for (const p of W.people) {
  const sameClub = p.clubId ? W.people.filter(o => o.clubId === p.clubId && o.id !== p.id) : [];
  const n = p.role === 'PLAYER' ? between(6, 22) : p.role === 'PARENT' ? between(3, 10) : between(8, 30);
  for (let i = 0; i < n; i++) follow(p.id, (sameClub.length && rnd() < 0.7 ? choose(sameClub) : choose(W.people)).id);
  if (p.clubId === 1 && rnd() < 0.8) follow(p.id, ME_ID);
}
const myFollows = [STAFF.assistant, STAFF.gk, STAFF.director, STAFF.welfare, STAFF.youth, referee(1), specialist('Football photographer'), 31, ...u16.playerIds.slice(0, 4).map(parentOf), 32, 33];
followSet(ME_ID).clear();
for (const id of myFollows) if (id) follow(ME_ID, id);
for (const id of [30, 31, 32, 33, 34, 37, ...W.referees.slice(0, 4).map(r => r.id), ...W.agents.map(a => a.id)]) follow(id, ME_ID);
clubFollows.set(ME_ID, new Set([2, 11, 12]));
export const followersOf = id => W.people.filter(p => follows.get(p.id)?.has(id)).map(p => p.id);
export const followingOf = id => [...(follows.get(id) ?? [])];
export const isFollowing = (a, b) => follows.get(a)?.has(b) === true;
export const toggleFollow = (a, b) => { const set = followSet(a); if (set.has(b)) set.delete(b); else set.add(b); return set.has(b); };

// ---------------------------------------------------------------- posts
// Internal record: { id, authorId, clubId, content, createdAt, mediaUrls, isPublic, editedAt,
// sharedPostId, shares, reactions: Map(userId -> type), comments: [], hiddenBy: Set }
export const posts = [];
let nextPostId = 910;
let nextCommentId = 20001;
export const newPostId = () => nextPostId++;
export const newCommentId = () => nextCommentId++;

const MOODS = {
  celebrate: ['LOVE', 'LOVE', 'LIKE', 'LIKE', 'LIKE', 'WOW'],
  info: ['LIKE', 'LIKE', 'LIKE', 'LIKE', 'LOVE'],
  fun: ['HAHA', 'HAHA', 'LIKE', 'LOVE'],
  tough: ['SAD', 'LIKE', 'LIKE', 'LOVE'],
  wow: ['WOW', 'LOVE', 'LIKE', 'LIKE'],
};
const clubCommunity = clubId => W.people.filter(p => p.clubId === clubId || (clubId === 1 && p.role === 'PARENT')).map(p => p.id);
function reactionMap(post, count, mood) {
  const pool = shuffled([...new Set([...(post.clubId ? clubCommunity(post.clubId) : []), ...followersOf(post.authorId ?? ME_ID), ...W.people.slice(0, 120).map(p => p.id)])])
    .filter(id => id !== post.authorId && id !== ME_ID);
  return new Map(pool.slice(0, count).map(id => [id, choose(MOODS[mood] ?? MOODS.info)]));
}

function addPost({ id = newPostId(), author = null, club = null, at, text, media = [], reactions = [between(2, 18), 'info'], mine = null, comments = [], shares = 0, sharedPostId = null }) {
  const post = { id, authorId: author, clubId: club, content: text.trim(), createdAt: at, mediaUrls: media.map(photo), isPublic: true, editedAt: null, sharedPostId, shares, reactions: new Map(), comments: [], hiddenBy: new Set() };
  post.reactions = reactionMap(post, reactions[0], reactions[1]);
  if (mine && author !== ME_ID) post.reactions.set(ME_ID, mine);
  let minutes = 7;
  for (const [authorId, content, gap] of comments) {
    minutes += gap ?? between(4, 90);
    post.comments.push({ id: newCommentId(), authorId, content, createdAt: after(at, minutes) });
  }
  posts.push(post);
  return post;
}

const u16Result = lastResult(105), u14Result = lastResult(103), u16Next = nextMatch(105), u14Next = nextMatch(103);
const u14Scorer = playerAt(103, 'ST') ?? playerAt(103, 'AM') ?? squadById(103).playerIds[9];
const u14Keeper = playerAt(103, 'GK');
const u12 = squadById(102), u12Scorer = u12.playerIds[9], u12Parent = parentOf(u12Scorer);
const trialU14Girls = W.trials.find(t => t.id === 502), trialRiverside = W.trials.find(t => t.id === 501), trialGldani = W.trials.find(t => t.id === 503), trialKutaisi = W.trials.find(t => t.id === 504), trialVake = W.trials.find(t => t.id === 505);
const cup = W.tournaments.find(t => t.id === 302), festival = W.tournaments.find(t => t.id === 303), girlsCup = W.tournaments.find(t => t.id === 304);
const job = W.roles.find(r => r.id === 401), volunteers = W.roles.find(r => r.id === 403);
const P = id => parentOf(id);
const saba = 30, koba9 = playerAt(105, 'AM'), temo = playerAt(105, 'RW');
// Goal scorers for the most recent U16 result: Saba first, then the 10 and the right winger.
const u16Goals = [saba, saba, koba9, temo, koba9].slice(0, u16Result.score[0]);
const scorerLine = ids => [...new Set(ids)].map(id => { const n = ids.filter(x => x === id).length; return n > 1 ? `${name(id)} (${n})` : name(id); }).join(', ');
const sabaGoals = u16Goals.filter(id => id === saba).length;
const u16Following = matchesFor(105).filter(m => m.status === 'SCHEDULED')[1];
const u14Opponent = clubCoach[u14Next.opponentClubId] ?? 33;

// World posts 900–909 keep their ids and wording; they gain photos, reactions and comments.
const worldPostExtras = {
  900: { media: ['u16-possession'], reactions: [27, 'celebrate'], comments: [[STAFF.assistant, 'Best session of the month. The rondo numbers were brilliant.'], [P(koba9), 'He came home exhausted and happy 😊']] },
  901: { reactions: [19, 'info'], comments: [[P(squadById(103).playerIds[2]), 'Thanks coach, we will be there at 10:15.'], [P(squadById(103).playerIds[5]), 'Is the Digomi car park open on Saturday?'], [ME_ID, 'Yes, the main car park opens at 9:30.']] },
  902: { media: ['riverside-trial'], reactions: [14, 'info'], comments: [[W.parents[3].parentId, 'Is it for both boys and girls?'], [32, 'Yes, the U12 group is mixed. Everyone is welcome.']] },
  903: { media: ['rustavi-changing-rooms', 'rustavi-volunteers'], reactions: [38, 'celebrate'] },
  904: { reactions: [12, 'info'] },
  905: { reactions: [9, 'info'], comments: [[38, 'Batumi Seaside girls would love a game. Sending you a message.']] },
  906: { media: ['gldani-floodlights'], reactions: [44, 'wow'], comments: [[35, 'Thank you to every family who helped raise the money!']] },
  907: { author: STAFF.assistant, reactions: [23, 'info'], comments: [[32, '4v4+3 positional game. It has everything.'], [ME_ID, 'Rondos. Every single day.'], [33, 'Finishing waves — keeps the strikers happy.'], [STAFF.gk, 'Anything where the keeper plays out under pressure.']] },
  908: { media: ['u18-camp'], reactions: [52, 'celebrate'], comments: [[STAFF.director, 'Well deserved. Proud of the whole U18 staff.'], [STAFF.fitness, 'Great reward for a lot of hard work.']] },
  909: { reactions: [7, 'info'] },
};
for (const wp of W.posts) {
  const extra = worldPostExtras[wp.id] ?? {};
  addPost({ id: wp.id, author: extra.author ?? wp.authorId ?? (wp.clubId ? clubCoach[wp.clubId] ?? null : null), club: wp.clubId, at: plausible(wp.created), text: wp.text, ...extra });
}

const u16FinalWhistle = u16Result.end;
const seededPosts = [
  // FC Dinamo Tbilisi Academy
  { author: ME_ID, club: 1, at: after(u16FinalWhistle, 120), media: ['u16-telavi-1', 'u16-telavi-2'], reactions: [46, 'celebrate'], shares: 3,
    text: `Full time in ${where(u16Result)}: U16 Boys ${resultLine(u16Result)} against ${u16Result.opponentName}.\n${u16Goals.length ? `${scorerLine(u16Goals)} with the goals. ` : ''}Patient in the first half, quick in transition after the break. Thank you to every family who came to support.`,
    comments: [[31, 'So proud of the whole team today! ❤️'], [P(temo), 'What a goal from Temo 😍'], [STAFF.analyst, 'Clips are up in the squad space for Tuesday’s review.'], [P(koba9), 'Great atmosphere on the bus home.']] },
  { author: ME_ID, club: 1, at: after(u14Result.end, 150), media: ['u14-locomotive'], reactions: [31, 'celebrate'],
    text: `U14 Boys ${resultLine(u14Result)} against ${u14Result.opponentName}. A goal down after ten minutes and the group never panicked. Player of the match: ${name(u14Scorer)}. Big saves from ${name(u14Keeper)} when it mattered.`,
    comments: [[P(u14Scorer), 'He has not stopped smiling since!'], [34, 'Well played Dinamo. A good test for our boys too.']] },
  { author: STAFF.director, club: 1, at: hoursAgo(26), reactions: [22, 'info'],
    text: `We are hiring: ${job.title} (part-time, three evenings a week). UEFA C or working towards it, plus a child safeguarding certificate. Applications close ${dayMonth(job.deadline)} — full details in Jobs.`,
    comments: [[W.people.find(p => p.freeAgent)?.id, 'Shared with my coaching course group.'], [STAFF.youth, 'Great opportunity to join a brilliant U12 staff.']] },
  { author: ME_ID, club: 1, at: hoursAgo(31), media: ['u14-girls-trial'], reactions: [28, 'info'], shares: 6,
    text: `Open trial for our U14 Girls squad: ${dayMonth(trialU14Girls.date)} at ${hhmm(trialU14Girls.date)}, Dinamo Academy Training Centre (Digomi). ${trialU14Girls.spots - trialU14Girls.taken} places left — register through Tryouts. Boots, shin pads and water.`,
    comments: [[W.parents.find(link => personById(link.childId).gender === 'FEMALE')?.parentId, 'Registered! My daughter cannot wait.'], [STAFF.youth, 'Looking forward to meeting everyone.']] },
  { author: STAFF.director, club: 1, at: hoursAgo(50), reactions: [17, 'celebrate'],
    text: `Our U12 Mixed squad is entered for the ${cup.name} in Vake Park on ${dayMonth(cup.start)}. Seven-a-side, at least four games for every team. Come and cheer them on!` },
  { author: STAFF.manager, club: 1, at: hoursAgo(55), media: ['kit-room'], reactions: [15, 'info'],
    text: 'Kit collection for U14 and U16: the new training tops are in. Please collect from the kit room before Thursday’s session — sizes are on the list by the door.',
    comments: [[P(u16.playerIds[1]), 'Picked ours up today, they look great.']] },
  { author: ME_ID, club: 1, at: hoursAgo(20), media: ['digomi-lights-1', 'digomi-lights-2', 'digomi-lights-3', 'digomi-lights-4'], reactions: [39, 'celebrate'],
    text: 'Wednesday night under the lights at Digomi. U16 Boys working on third-man runs and finishing in the box.' },
  // Dinamo staff, personal
  { author: STAFF.gk, at: hoursAgo(5), media: ['gk-distribution'], reactions: [21, 'info'], mine: 'LIKE',
    text: 'Goalkeeper session today: distribution under pressure. Every keeper from U12 to U18 took forty passes off their weaker foot. Small gains, every week.',
    comments: [[saba, 'Thanks for staying late for finishing practice!'], [STAFF.assistant, 'Visible in the build-up already.']] },
  { author: STAFF.fitness, at: hoursAgo(29), reactions: [18, 'wow'],
    text: 'Autumn screening done for U14–U18: sprint, jump and Yo-Yo IR1. Big improvements in the U16 group since August — average 10 m sprint down by four hundredths. Recovery matters as much as the work.' },
  { author: STAFF.physio, at: hoursAgo(41), reactions: [16, 'info'],
    text: 'Return-to-play reminder for families: no player returns after a knock without clearance from the medical team, even if they feel fine on the day. Thank you for helping us keep them safe.' },
  { author: STAFF.analyst, at: hoursAgo(70), media: ['analysis-board'], reactions: [24, 'wow'], mine: 'WOW',
    text: `Clip of the week from the U16 game in ${where(u16Result)}: the press starts on the back pass to their centre back, our 9 curves his run and the 10 jumps the pivot. Four players, one idea.`,
    comments: [[ME_ID, 'This is exactly the picture we want every week.']] },
  { author: STAFF.nutrition, at: hoursAgo(76), reactions: [13, 'info'],
    text: 'Matchday breakfast guide for U14 and U16 families: oats or bread with eggs, fruit and water about three hours before kick-off. Skip the energy drinks. The full guide is in your squad updates.' },
  { author: STAFF.welfare, at: hoursAgo(12), reactions: [20, 'info'], mine: 'LIKE',
    text: 'Parents’ safeguarding evening this Thursday at 19:00 in the academy clubhouse. We will cover online safety, travel to away games and who to contact with a concern. Tea and khachapuri provided.',
    comments: [[P(u16.playerIds[4]), 'We will be there.'], [31, 'Thank you for organising this.']] },
  { author: STAFF.psych, at: hoursAgo(98), reactions: [26, 'info'],
    text: 'Pre-match nerves are normal. With the U16s we practise a sixty-second routine: three slow breaths, one cue word, first action planned. Ask your coach about it before the weekend.' },
  { author: STAFF.assistant, at: hoursAgo(3), media: ['rondo-5v2'], reactions: [12, 'info'],
    text: 'Rondos 5v2 to start every session this month. Two-touch maximum, defenders swap on interception. Simple, competitive, and the boys love it.' },
  { author: STAFF.scout, at: hoursAgo(84), reactions: [11, 'info'],
    text: 'Busy weekend: six youth games across Tbilisi and Rustavi. The level of the U14 regional league keeps rising — lots of brave, technical full-backs.' },
  { author: STAFF.youth, at: hoursAgo(35), media: ['u16-girls-training'], reactions: [30, 'celebrate'],
    text: `U16 Girls back in training after the break. Five weeks to the ${girlsCup.name} in Batumi — let’s go!`,
    comments: [[38, 'See you in Batumi! 🌊']] },
  // Luka Gelashvili, personal
  { author: ME_ID, at: hoursAgo(122), media: ['coach-education'], reactions: [34, 'info'],
    text: 'Finished the UEFA A refresher weekend in Tbilisi. Best session: designing practices from the game model backwards. Thank you to the GFF coach education team.',
    comments: [[33, 'Great course. See you at the next one.'], [STAFF.director, 'Looking forward to the debrief with the staff.']] },
  { key: 'playing-time', author: ME_ID, at: hoursAgo(9), reactions: [19, 'info'],
    text: 'Question for fellow youth coaches: how do you manage playing time in competitive U16 league games? We aim for at least half of the available minutes for every player across a month.',
    comments: [[32, 'We rotate by quarters in league games and track minutes on a shared sheet. Parents appreciate the transparency.', 25], [33, 'Same target here. Cup games are where we allow ourselves more freedom.'], [STAFF.assistant, 'The monthly view is the key. Single games will never be perfectly fair.'], [37, 'We publish a minutes table to families every month. It removed most of the difficult conversations.'], [P(u16.playerIds[6]), 'As a parent: knowing the plan matters more than the exact minutes.'], [ME_ID, 'Thank you all — really useful. We will try the monthly table.']] },
  // Featured player
  { author: saba, at: after(u16FinalWhistle, 360), media: ['saba-telavi'], reactions: [58, 'celebrate'], mine: 'LOVE',
    text: `${sabaGoals === 2 ? 'Two goals' : sabaGoals === 1 ? 'A goal' : 'Ninety minutes'} in ${where(u16Result)} and ${u16Result.score[0] > u16Result.score[1] ? 'three points' : 'a lot to learn from'}. Thanks coach and the boys for the trust ⚽`,
    comments: [[temo, 'Next week a hat-trick 😄'], [31, 'Proud of you, my son ❤️'], [STAFF.gk, 'Left foot is getting dangerous.']] },
  { author: saba, at: hoursAgo(47), reactions: [21, 'info'],
    text: 'Extra finishing work after training with the keepers. Left foot feeling good.' },
  { author: saba, at: hoursAgo(7), reactions: [25, 'celebrate'],
    text: `Next up: ${u16Next.opponentName} on ${weekday(u16Next.start)}. Let’s keep the run going.` },
  // Families
  { author: u12Parent, at: hoursAgo(15), media: ['u12-first-goal'], reactions: [41, 'celebrate'],
    text: `First goal in a Dinamo shirt for ${firstName(u12Scorer)} today 😊 Thank you to the U12 coaches for making every child feel part of the team.`,
    comments: [[STAFF.youth, 'Well deserved! What a finish.'], [P(u12.playerIds[3]), 'Congratulations!']] },
  // Other clubs
  { author: 32, club: 3, at: hoursAgo(18), reactions: [16, 'info'],
    text: `Riverside U12 open trial on ${dayMonth(trialRiverside.date)} at Vake Park Pitches, ${hhmm(trialRiverside.date)}. ${trialRiverside.spots - trialRiverside.taken} places left. Licensed coaches, small groups, and every player gets the ball.` },
  { author: 33, club: 4, at: hoursAgo(28), media: ['saburtalo-camp'], reactions: [29, 'celebrate'],
    text: 'U16 squad training camp in Bakuriani during the school break: twenty-eight players, double sessions and a lot of team building. Thank you to the families for the support.' },
  { author: clubCoach[u14Result.opponentClubId] ?? null, club: u14Result.opponentClubId, at: hoursAgo(60), reactions: [14, 'tough'],
    text: `Tough afternoon against Dinamo Academy U14 on ${weekday(u14Result.start)}, but proud of the response in training this week. Back to work on Saturday.` },
  { author: 37, club: 11, at: hoursAgo(22), media: ['kutaisi-festival'], reactions: [33, 'info'], shares: 4,
    text: `${festival.name}: registration closes ${dayMonth(festival.entryDeadline)}. Three days of 9v9 football in Kutaisi, a coaching clinic and accommodation partners for travelling teams.` },
  { author: 37, club: 11, at: hoursAgo(90), reactions: [12, 'info'],
    text: `U16 regional trial day on ${dayMonth(trialKutaisi.date)} at Ramaz Shengelia Stadium. Only ${trialKutaisi.spots - trialKutaisi.taken} places left.` },
  { author: 38, club: 12, at: hoursAgo(44), media: ['batumi-girls'], reactions: [27, 'celebrate'],
    text: `${girlsCup.name}: groups and finals by the sea, ${dayMonth(girlsCup.start)}. Entries open until ${dayMonth(girlsCup.entryDeadline)}.` },
  { author: 35, club: 6, at: hoursAgo(11), reactions: [18, 'info'],
    text: `Saturday morning taster session for kids aged 6–9 at Gldani Sports Complex, ${hhmm(trialGldani.date)}. Bring trainers and water — everyone plays!` },
  { author: 39, club: 7, at: hoursAgo(38), media: ['vake-under8'], reactions: [22, 'celebrate'],
    text: `Under 8s: a fun first session for new families on ${dayMonth(trialVake.date)} at Vake Park Pitches. Parents are welcome to stay and watch.` },
  { author: 36, club: 10, at: hoursAgo(66), reactions: [15, 'info'],
    text: `${volunteers.title} for the Rustavi community cup: help with set-up, registration and first aid. Two hours makes a big difference.` },
  { author: clubCoach[u16Result.opponentClubId] ?? null, club: u16Result.opponentClubId, at: hoursAgo(102), reactions: [10, 'tough'],
    text: `Thanks to Dinamo Academy U16 for a good game on ${weekday(u16Result.start)}. Lessons learned — we go again this weekend.` },
  { club: 14, at: hoursAgo(57), media: ['mtskheta-kit'], reactions: [24, 'celebrate'],
    text: 'New kit day! Thank you to our local sponsors for the green-and-white shirts for U8 to U14.' },
  { club: 15, at: hoursAgo(80), reactions: [8, 'info'],
    text: 'Five-a-side Sunday league: two places left for the autumn round. Teams of six to eight, games at 11:00 by the lake.' },
  { club: 2, at: hoursAgo(33), media: ['first-team-academy'], reactions: [61, 'celebrate'], mine: 'LIKE',
    text: 'Four academy players trained with the first team this week. The pathway is real.',
    comments: [[STAFF.director, 'Brilliant moment for the whole academy.'], [P(squadById(107).playerIds[0]), 'Dreams coming true!']] },
  { club: 16, at: hoursAgo(110), reactions: [9, 'info'],
    text: 'Samegrelo talent day for U10–U13 this Saturday at our home ground. Free entry, coaches from three academies watching.' },
  // Officials, specialists, agents, free agents
  { author: referee(1), at: hoursAgo(16), reactions: [37, 'info'],
    text: 'Refereeing tip for youth coaches: talk to the officials before kick-off, not after. Five minutes of conversation prevents most problems.',
    comments: [[ME_ID, 'Good advice. We always introduce our captains to the referee.']] },
  { author: referee(0), at: hoursAgo(74), reactions: [19, 'info'],
    text: 'Proud to officiate in the GFF U14 Youth League again this season. Respect the officials — we are learning too.' },
  { author: specialist('Football photographer'), at: after(u16FinalWhistle, 600), media: ['telavi-frame-1', 'telavi-frame-2', 'telavi-frame-3'], reactions: [48, 'wow'],
    text: `Some frames from ${weekday(u16Result.start)}’s U16 game in ${where(u16Result)}. Dinamo Academy in full flow.`,
    comments: [[31, 'Could I get the second photo in full size please?'], [specialist('Football photographer'), 'Of course — sending it to you now.']] },
  { author: agentId, at: hoursAgo(53), reactions: [14, 'info'],
    text: 'Families: before signing anything with an agent, check the licence on the GFF register and talk to your academy first. A good agent will always encourage that.' },
  { author: freeAgent('CM'), at: hoursAgo(24), reactions: [11, 'info'],
    text: 'Central midfielder looking for a club in Tbilisi for the spring. Two seasons in the Tbilisi Community League. Happy to trial — messages open.',
    comments: [[33, 'Send me a message, our senior side is looking.']] },
  { author: freeAgent('GK'), at: hoursAgo(62), reactions: [9, 'info'],
    text: 'Goalkeeper looking for a women’s team in Tbilisi. Available evenings and weekends.' },
  { author: specialist('Strength & conditioning coach'), at: hoursAgo(88), reactions: [16, 'info'],
    text: 'Youth strength training is safe and effective when it is coached well. Bodyweight first, technique always, load later.' },
  { author: specialist('Sports nutritionist'), at: hoursAgo(115), reactions: [12, 'info'],
    text: 'Hydration check for evening sessions: drink little and often through the afternoon, and bring a full bottle to training. Thirst is a late signal.' },
  { author: 33, at: hoursAgo(14), reactions: [6, 'info'],
    text: 'Looking for a U14 friendly on a Sunday in late October. Our ground or yours — message me.' },
];
export const postKeys = {};
for (const spec of seededPosts) { const post = addPost(spec); if (spec.key) postKeys[spec.key] = post.id; }
// A reshare from Luka of the U16 result keeps the share flow realistic.
const u16Post = posts.find(p => p.authorId === ME_ID && p.clubId === 1 && p.content.startsWith('Full time in'));
addPost({ author: ME_ID, at: after(u16Post.createdAt, 30), text: 'Proud of this group. Onwards to the next one.', sharedPostId: u16Post.id, reactions: [14, 'celebrate'] });
postKeys.u16Result = u16Post.id;
export const postById = id => posts.find(p => p.id === Number(id));

// ---------------------------------------------------------------- notifications (for Luka)
const nextU16Training = nextTraining(105);
export const notifications = [];
let nextNotificationId = 30001;
function notify({ minutes, read = false, scope = 'PERSONAL', clubId = null, type, title, body, entityType = null, entityId = null, linkPath = null, eventId = null }) {
  notifications.push({ id: nextNotificationId++, type, scope, clubId, clubName: clubId ? clubById(clubId).name : null, entityType, entityId, title, body, isRead: read, createdAt: minutesAgo(minutes), linkPath, eventId, userId: ME_ID });
}
// Conversation and request ids referenced below are defined further down.
export const CONVERSATION = { assistant: 801, lomidze: 802, staffGroup: 803, director: 805, referee: 806, agent: 807, coaches: 808, riverside: 809, welfare: 810, saburtalo: 804 };
export const APPLICATION_ID = 6101, TRYOUT_APPLICATION_ID = 6201, APPOINTMENT_ID = 6301, PERMISSION_ID = 6401;
notify({ minutes: 12, type: 'NEW_MESSAGE', title: `New message from ${name(STAFF.assistant)}`, body: 'Can we go through the line-up for Monday before training?', entityType: 'conversation', entityId: CONVERSATION.assistant });
notify({ minutes: 38, scope: 'CLUB', clubId: 1, type: 'CLUB_APPLICATION_RECEIVED', title: 'New membership application', body: 'Davit Kvirikashvili (born 2012) applied to join U14 Boys.', entityType: 'club_membership_application', entityId: APPLICATION_ID });
notify({ minutes: 64, type: 'POST_COMMENT', title: 'New comments on your post', body: `${name(37)}: We publish a minutes table to families every month…`, entityType: 'post', entityId: postKeys['playing-time'], linkPath: `/posts/${postKeys['playing-time']}` });
notify({ minutes: 95, type: 'SQUAD_PRIVATE_MESSAGE', title: `${name(31)} sent a private message`, body: 'U16 Boys · Saba’s ankle is fine after the weekend, he can train on Wednesday.', entityType: 'squad', entityId: 105, linkPath: '/squads/105?tab=coach&thread=31' });
notify({ minutes: 130, scope: 'CLUB', clubId: 1, type: 'MATCH_EXCHANGE_UPDATED', title: 'Kick-off change requested', body: `${u14Next.opponentName} asked to move U14 Boys’ ${weekday(u14Next.start)} game to 12:30.`, entityType: 'match_exchange', entityId: u14Next.id, linkPath: u14Next.kind === 'FRIENDLY' ? `/match-exchange/${u14Next.id}` : `/calendar?eventId=${u14Next.id}`, eventId: u14Next.id });
notify({ minutes: 190, type: 'SCHEDULE_EVENT_UPDATED', title: 'Training moved to Pitch 2', body: `U16 Boys · ${nextU16Training.title} on ${dayMonth(nextU16Training.start)} now takes place on Pitch 2.`, entityType: 'schedule_event', entityId: nextU16Training.id });
notify({ minutes: 300, scope: 'CLUB', clubId: 1, type: 'TRYOUT_APPLICATION_RECEIVED', title: 'New tryout applications', body: `U14 Girls trial on ${dayMonth(trialU14Girls.date)}: 3 new applications to review.`, entityType: 'tryout_application', entityId: TRYOUT_APPLICATION_ID });
notify({ minutes: 420, read: true, type: 'NEW_FOLLOWER', title: `${name(32)} followed you`, body: 'Head coach · Riverside Academy', entityType: 'user', entityId: 32, linkPath: '/profile/32' });
notify({ minutes: 610, read: true, type: 'SQUAD_UPDATE_ACKNOWLEDGED', title: 'Families are acknowledging your update', body: `9 of 12 U16 Boys families have seen “Matchday: ${u16Next.opponentName}”.`, entityType: 'squad', entityId: 105, linkPath: '/squads/105' });
notify({ minutes: 1500, read: true, type: 'CLUB_ANNOUNCEMENT', title: 'FC Dinamo Tbilisi posted an update', body: 'Four academy players trained with the first team this week.', clubId: 2, entityType: 'post', entityId: posts.find(p => p.clubId === 2).id });
notify({ minutes: 2100, read: true, scope: 'CLUB', clubId: 1, type: 'CLUB_STAFF_APPOINTMENT', title: 'Staff appointment awaiting confirmation', body: `${name(STAFF.youth)} · Youth coach, U16 Girls.`, entityType: 'club_staff_appointment', entityId: APPOINTMENT_ID });
notify({ minutes: 2900, read: true, scope: 'CLUB', clubId: 1, type: 'CLUB_INVITATION_ACCEPTED', title: 'Invitation accepted', body: 'Giorgi Bolkvadze accepted the invitation to join U14 Boys.' });
notify({ minutes: 4300, read: true, type: 'TOURNAMENT_FIXTURES_PUBLISHED', title: `${cup.name} fixtures published`, body: `U12 Mixed play four games on ${dayMonth(cup.start)} at Vake Park Pitches.`, entityType: 'tournament', entityId: cup.id, linkPath: `/tournaments/${cup.id}` });
notify({ minutes: 5600, read: true, type: 'POST_REACTION', title: 'Your post is popular', body: `Your U16 Boys result post has ${u16Post.reactions.size} reactions.`, entityType: 'post', entityId: u16Post.id, linkPath: `/posts/${u16Post.id}` });
notify({ minutes: 6200, read: true, scope: 'CLUB', clubId: 1, type: 'MATCH_EXCHANGE_UPDATED', title: 'Referee confirmed', body: `${name(W.matches.find(m => m.id === u16Next.id).refereeId)} will referee U16 Boys vs ${u16Next.opponentName}.`, entityType: 'match_exchange', entityId: u16Next.id, linkPath: `/match-exchange/${u16Next.id}`, eventId: u16Next.id });
// Staff permission requests reach Luka through the club inbox (club domain).

// ---------------------------------------------------------------- requests centre
const u14Girls = squadById(104);
export const requestItems = [];
function request(item) { requestItems.push({ key: `${item.family}:${item.id}`, actionLabel: 'Open request', ...item, updatedAt: item.updatedAt.toISOString() }); }
request({ family: 'CLUB_APPLICATION', id: APPLICATION_ID, title: 'Membership application · U14 Boys', context: 'Davit Kvirikashvili · FC Dinamo Tbilisi Academy', status: 'PENDING', direction: 'INCOMING', actionable: true, updatedAt: minutesAgo(38), destination: `/clubs/1/workspace?tab=applications&applicationId=${APPLICATION_ID}`, actionLabel: 'Review application' });
request({ family: 'TRYOUT_APPLICATION', id: TRYOUT_APPLICATION_ID, title: `Tryout application · ${u14Girls.name} trial`, context: `Elene Jishkariani · ${dayMonth(trialU14Girls.date)}`, status: 'SUBMITTED', direction: 'INCOMING', actionable: true, updatedAt: minutesAgo(300), destination: `/clubs/1/workspace?tab=tryouts&applicationId=${TRYOUT_APPLICATION_ID}`, actionLabel: 'Review application' });
request({ family: 'MATCH_CHANGE', id: 6601, title: `Kick-off change · U14 Boys vs ${u14Next.opponentName}`, context: `${u14Next.opponentName} proposes 12:30 on ${dayMonth(u14Next.start)}`, status: 'PENDING', direction: 'INCOMING', actionable: true, updatedAt: minutesAgo(130), destination: u14Next.kind === 'FRIENDLY' ? `/match-exchange/${u14Next.id}` : `/calendar?eventId=${u14Next.id}`, actionLabel: 'Review proposal' });
request({ family: 'STAFF_APPOINTMENT', id: APPOINTMENT_ID, title: 'Staff appointment · Youth coach, U16 Girls', context: `${name(STAFF.youth)} · FC Dinamo Tbilisi Academy`, status: 'PENDING', direction: 'INCOMING', actionable: true, updatedAt: hoursAgo(35), destination: `/club-operations?appointmentId=${APPOINTMENT_ID}`, actionLabel: 'Review appointment' });
request({ family: 'CLUB_INVITATION', id: 6801, title: 'Club invitation · U12 assistant coach', context: 'Sent to Irakli Gorgadze · FC Dinamo Tbilisi Academy', status: 'PENDING', direction: 'OUTGOING', actionable: false, updatedAt: hoursAgo(52), destination: '/clubs/1/workspace?tab=invites' });
request({ family: 'TOURNAMENT_ENTRY', id: 6502, title: `Entry · ${cup.name}`, context: 'U12 Mixed · awaiting organiser approval from Riverside Academy', status: 'AWAITING_APPROVAL', direction: 'OUTGOING', actionable: false, updatedAt: hoursAgo(49), destination: `/tournaments/${cup.id}` });
request({ family: 'MATCH_CHANGE', id: 6602, title: `Venue change · U16 Boys vs ${u16Following.opponentName}`, context: `Sent to ${u16Following.opponentName} · move to Dinamo Academy Training Centre`, status: 'PENDING', direction: 'OUTGOING', actionable: false, updatedAt: hoursAgo(27), destination: `/match-exchange/${u16Following.id}` });
request({ family: 'CLUB_APPLICATION', id: 6102, title: 'Membership application · U16 Boys', context: 'Saba Lomidze · FC Dinamo Tbilisi Academy', status: 'ACCEPTED', direction: 'INCOMING', actionable: false, updatedAt: hoursAgo(24 * 61), destination: '/profile/30' });
request({ family: 'CLUB_INVITATION', id: 6802, title: 'Club invitation · Goalkeeper coach, U12', context: 'Sent to Tamaz Kharaishvili', status: 'DECLINED', direction: 'OUTGOING', actionable: false, updatedAt: hoursAgo(24 * 20), destination: '/clubs/1/workspace?tab=invites' });
request({ family: 'MATCH_PROPOSAL', id: 6603, title: `Friendly · U14 Boys vs ${u14Result.opponentName}`, context: `Agreed and played · ${dayMonth(u14Result.start)}`, status: 'COMPLETED', direction: 'OUTGOING', actionable: false, updatedAt: hoursAgo(24 * 5), destination: `/match-exchange/${u14Result.id}` });
export const historyStatuses = new Set(['ACCEPTED', 'APPROVED', 'DECLINED', 'REJECTED', 'COMPLETED', 'WITHDRAWN', 'CANCELLED', 'ENDED', 'EXPIRED']);

// ---------------------------------------------------------------- direct and group chats
export const conversations = [];
export const chatMessages = []; // { id, conversationId, senderId, content, createdAt }
let nextMessageId = 50001;
export const newMessageId = () => nextMessageId++;
function conversation({ id, type = 'DIRECT', name: title = null, members, creator = ME_ID, unread = 0, contextId = null, lines }) {
  const conv = { id, contextType: type, name: title, contextId, members: [...new Set([...members, ME_ID])], creatorId: creator, unread: new Map([[ME_ID, unread]]) };
  conversations.push(conv);
  // lines: [senderId, text, minutesAgo] oldest first
  for (const [senderId, content, ago] of lines) chatMessages.push({ id: newMessageId(), conversationId: id, senderId, content, createdAt: minutesAgo(ago) });
  return conv;
}
const A = STAFF.assistant;
conversation({ id: CONVERSATION.assistant, members: [A], unread: 2, lines: [
  [ME_ID, `Good session tonight. ${firstName(saba)} looked sharp in the finishing drill.`, 26 * 60],
  [A, 'Agreed. His movement off the shoulder is much better than in August.', 26 * 60 - 12],
  [ME_ID, `Let’s keep the same back four for ${weekday(u16Next.start)} unless the physio says otherwise.`, 25 * 60],
  [A, `Physio cleared ${firstName(u16.playerIds[4])} this morning.`, 40],
  [A, 'Can we go through the line-up for Monday before training?', 12],
] });
conversation({ id: CONVERSATION.lomidze, members: [31], unread: 1, lines: [
  [31, 'Good evening coach, Saba twisted his ankle a little at school today.', 3 * 24 * 60],
  [ME_ID, `Thank you for letting me know. Ice tonight and please ask him to see ${firstName(STAFF.physio)} (physio) before Wednesday’s session.`, 3 * 24 * 60 - 20],
  [31, 'He saw her this morning — she says it is fine.', 2 * 24 * 60],
  [ME_ID, 'Great news. He can train fully on Wednesday then.', 2 * 24 * 60 - 45],
  [31, 'Thank you! He is very excited about the match.', 95],
] });
conversation({ id: CONVERSATION.staffGroup, type: 'GROUP', name: 'U16 Boys coaching staff', members: [A, STAFF.gk, STAFF.fitness, STAFF.physio, STAFF.analyst], lines: [
  [STAFF.analyst, `Clips from ${u16Result.opponentName} are uploaded: twelve pressing moments, four set pieces.`, 4 * 24 * 60],
  [STAFF.fitness, 'GPS loads from Sunday are high for the wide players. I suggest a lighter Tuesday.', 3 * 24 * 60],
  [ME_ID, 'Agreed — Tuesday becomes recovery and video. Main session Wednesday.', 3 * 24 * 60 - 30],
  [STAFF.physio, 'Two players on reduced load this week, details in the medical notes.', 2 * 24 * 60],
  [STAFF.gk, 'Both keepers will do the distribution block with the U18s on Thursday.', 26 * 60],
  [A, `Opposition report for ${u16Next.opponentName} is ready. They play a 3-4-3 and press high from goal kicks.`, 70],
] });
conversation({ id: CONVERSATION.saburtalo, type: 'MATCH_CHALLENGE', name: `U14 Boys vs ${u14Next.opponentName}`, contextId: u14Next.id, members: [u14Opponent], creator: u14Opponent, unread: 1, lines: [
  [u14Opponent, `Hello Luka, could we move ${weekday(u14Next.start)}’s U14 game to 12:30? Our pitch is booked until midday.`, 160],
  [ME_ID, 'That should work for us. I will confirm with our families today.', 140],
  [u14Opponent, 'Thank you. I have sent the change request through Match Exchange.', 131],
] });
conversation({ id: CONVERSATION.director, members: [STAFF.director], lines: [
  [STAFF.director, `Do we want to enter the ${festival.name} with the U14 Boys?`, 26 * 60],
  [ME_ID, 'Yes — it is a great level for them and the coaching clinic is useful for our younger staff.', 25 * 60],
  [STAFF.director, 'Agreed. I will look at the travel budget this week.', 22 * 60],
] });
conversation({ id: CONVERSATION.referee, members: [referee(1)], lines: [
  [referee(1), 'Coach, a quick note for Monday: please make sure both teams’ player cards are ready 30 minutes before kick-off.', 30 * 60],
  [ME_ID, 'Of course. Our team manager will bring them to the referees’ room.', 29 * 60],
] });
conversation({ id: CONVERSATION.agent, members: [agentId], lines: [
  [agentId, 'Good afternoon. I am following the development of one of your U18 players. Could we talk?', 4 * 24 * 60],
  [ME_ID, 'Thank you for reaching out. All contact about academy players goes through our academy director and the family — I will pass on your details.', 4 * 24 * 60 - 90],
  [agentId, 'Understood, thank you.', 4 * 24 * 60 - 100],
] });
conversation({ id: CONVERSATION.coaches, type: 'GROUP', name: 'Dinamo Academy coaches', members: W.staff.filter(s => s.kind === 'COACH').map(s => s.personId), lines: [
  [STAFF.director, 'Reminder: coaches’ meeting on Friday at 17:00 in the clubhouse.', 2 * 24 * 60],
  [STAFF.youth, 'I will share the U16 Girls plan for the Batumi cup.', 2 * 24 * 60 - 30],
  [ME_ID, 'Thank you all. Please bring one session you are proud of from this month.', 30 * 60],
  [STAFF.scout, 'I will bring the notes from the regional U14 games too.', 6 * 60],
] });
conversation({ id: CONVERSATION.riverside, members: [32], lines: [
  [32, 'Hi Luka! Would your U14 Boys be up for a friendly at Vake Park in November?', 5 * 24 * 60],
  [ME_ID, 'Definitely. Sunday mornings work best for us.', 5 * 24 * 60 - 60],
  [32, 'Perfect, I will propose a date in Match Exchange.', 5 * 24 * 60 - 75],
] });
conversation({ id: CONVERSATION.welfare, members: [STAFF.welfare], lines: [
  [STAFF.welfare, 'Can you mention Thursday’s safeguarding evening in your next U16 update?', 9 * 60],
  [ME_ID, 'Done — it is in the matchday update.', 7 * 60],
] });
export const conversationById = id => conversations.find(c => c.id === Number(id));

// ---------------------------------------------------------------- squad communication
export const MY_SQUADS = [105, 103];
export const squadMessages = []; // { id, squadId, authorId, threadUserId, kind, title, body, important, createdAt, reactions: Map(userId->kind), comments: [], acknowledged: Map(userId->Date), readBy }
let nextSquadMessageId = 70001;
export const newSquadMessageId = () => nextSquadMessageId++;
export const familiesOf = squadId => squadById(squadId).playerIds.map(id => parentOf(id) ?? id);
function squadPost(squadId, { kind = 'ANNOUNCEMENT', author = ME_ID, thread = null, title = null, body, important = false, ago, at = null, ackShare = 0, reactions = [], comments = [], until = null }) {
  const createdAt = at ?? minutesAgo(ago);
  ago = (NOW - createdAt) / 60000;
  // `expiresAt`: when an announcement stops being pinned (end of the day it concerns).
  const expiresAt = kind === 'ANNOUNCEMENT' && until ? new Date(until.getFullYear(), until.getMonth(), until.getDate(), 23, 59) : null;
  const msg = { id: newSquadMessageId(), squadId, authorId: author, threadUserId: thread, kind, title, body, important, createdAt, expiresAt, reactions: new Map(), comments: [], acknowledged: new Map() };
  const families = familiesOf(squadId);
  if (important) for (const id of families.slice(0, Math.round(families.length * ackShare))) msg.acknowledged.set(id, minutesAgo(ago - between(5, Math.max(6, ago - 1))));
  for (const [userId, reaction] of reactions) msg.reactions.set(userId, reaction);
  for (const [authorId, text, minutesLater] of comments) msg.comments.push({ id: newCommentId(), authorId, body: text, createdAt: minutesAgo(ago - minutesLater) });
  squadMessages.push(msg);
  return msg;
}
function seedSquad(squadId, { next, result, training }) {
  const players = squadById(squadId).playerIds, fam = familiesOf(squadId);
  squadPost(squadId, { title: 'Autumn screening results', body: `Every player has received their sprint and jump results from ${firstName(STAFF.fitness)}. Ask your child to bring their sheet to Tuesday’s session so we can set targets together.`, at: plausible(W.day(-9, 19, 10)), until: W.day(-4) });
  if (result) squadPost(squadId, { title: result.home ? `Home game against ${result.opponentName}` : `Travel to ${result.opponentName}`, body: result.home ? `Meet at ${hhmm(new Date(result.start.getTime() - 75 * 60000))} in the home dressing room at Digomi. White home kit, shin pads and water.` : `Bus leaves the Digomi gate at ${hhmm(new Date(result.start.getTime() - 150 * 60000))}. Bring the black away kit, both boots and a packed lunch.`, important: true, ackShare: 1, at: after(new Date(result.start.getTime() - 2 * 86400000), 8 * 60), until: result.start });
  if (result) squadPost(squadId, { title: `Great ${resultLine(result).split(' ')[0] === 'win' ? 'win' : 'effort'} against ${result.opponentName}`, body: `Final score ${result.score[0]}–${result.score[1]}. Proud of how we stayed together after a difficult start. Video review on Tuesday at 17:30 before training.`, at: after(result.end, 200), until: new Date(result.end.getTime() + 3 * 86400000),
    reactions: fam.slice(0, 7).map((id, i) => [id, ['CELEBRATE', 'HEART', 'LIKE', 'CELEBRATE', 'ROCKET', 'HEART', 'LIKE'][i]]),
    comments: [[fam[0], 'Fantastic game, thank you coaches!', 30], [fam[3], 'The boys were brilliant in the second half.', 55], [players[2], 'See you Tuesday coach 💪', 90]] });
  if (training) squadPost(squadId, { title: `Training moved to Pitch 2 on ${weekday(training.start)}`, body: `Same time (${hhmm(training.start)}), Pitch 2 at the Dinamo Academy Training Centre. Pitch 1 is being re-lined for the weekend.`, ago: 26 * 60, until: training.start, reactions: [[fam[1], 'LIKE'], [fam[5], 'LIKE']] });
  const nextVenue = next && W.venueById(next.venueId);
  if (next) squadPost(squadId, { title: `Matchday: ${next.opponentName}`, body: `Kick-off ${hhmm(next.start)} on ${dayMonth(next.start)}${next.home ? ' at Digomi' : ` at ${nextVenue?.name ?? clubById(next.opponentClubId).city}`}. ${next.home ? `Meet at ${hhmm(new Date(next.start.getTime() - 75 * 60000))} in the home dressing room. White home kit` : clubById(next.opponentClubId).city === 'Tbilisi' ? `Meet at the venue at ${hhmm(new Date(next.start.getTime() - 60 * 60000))}. Black away kit` : `Bus leaves the Digomi gate at ${hhmm(new Date(next.start.getTime() - 150 * 60000))}. Black away kit`}, shin pads and water. Families: the safeguarding evening is on Thursday at 19:00 in the clubhouse.`, important: true, ackShare: 0.75, ago: 6 * 60, until: next.start,
    reactions: [[fam[2], 'LIKE'], [fam[6], 'HEART']], comments: [[fam[4], 'Will there be parking at the academy?', 40], [ME_ID, 'Yes, the main car park opens an hour before kick-off.', 55]] });
  // Squad group chat
  const chat = [
    [players[0], 'Who has the spare bibs from Wednesday?', 30 * 60], [players[5], 'I took them home, will bring them tomorrow', 30 * 60 - 8],
    [fam[3], 'Is anyone driving from Saburtalo on Saturday? We have two free seats.', 20 * 60], [fam[7], 'Yes please! Two seats for us would be great 🙏', 20 * 60 - 15],
    [ME_ID, 'Reminder: bring both boots tomorrow, we may train on the artificial pitch.', 5 * 60], [players[9], 'Got it coach 👍', 5 * 60 - 3], [players[3], 'Will do', 4 * 60],
  ];
  for (const [author, body, ago] of chat) squadPost(squadId, { kind: 'CHAT', author, body, ago });
}
seedSquad(105, { next: u16Next, result: u16Result, training: nextU16Training });
seedSquad(103, { next: u14Next, result: u14Result, training: nextTraining(103) });
// Private family threads for U16 Boys
const privateThreads = [
  [31, [[31, 'Good evening coach. Saba twisted his ankle a little at school, but the physio says he is fine.', 2 * 24 * 60], [ME_ID, 'Thank you for telling us. He can train fully on Wednesday.', 2 * 24 * 60 - 30], [31, 'Saba’s ankle is fine after the weekend, he can train on Wednesday.', 95]]],
  [parentOf(u16.playerIds[2]), [[parentOf(u16.playerIds[2]), 'Dachi has a school exam on Friday morning, he may be ten minutes late to Thursday’s session.', 26 * 60], [ME_ID, 'No problem, thank you for letting us know.', 25 * 60]]],
  [parentOf(u16.playerIds[7]), [[parentOf(u16.playerIds[7]), 'Could we have a short chat about Sandro’s position this season?', 4 * 60]]],
];
for (const [thread, lines] of privateThreads) for (const [author, body, ago] of lines) squadPost(105, { kind: 'CHAT', author, thread, body, ago });
export const squadUnread = new Map([[105, new Map([[31, 1], [parentOf(u16.playerIds[7]), 1]])], [103, new Map()]]);
export const squadNotify = new Map([[105, true], [103, true]]);
export const sessionResponses = new Map(); // `${eventId}:${playerId}` -> response

// ---------------------------------------------------------------- account
export const roleProfiles = new Map([[ME_ID, [
  { role: 'COACH', primary: true, published: true, headline: 'Head of Coaching · FC Dinamo Tbilisi Academy', specialties: 'Youth development U14–U18, positional play, coach education', qualifications: 'UEFA A licence · GFF Youth Diploma', serviceArea: 'Tbilisi' },
  { role: 'CLUB_STAFF', primary: false, published: true, headline: 'Academy leadership team', specialties: 'Coaching curriculum, staff development, player pathway', qualifications: null, serviceArea: 'Tbilisi' },
]]]);
export const accountProfile = {
  bio: 'Head of Coaching at FC Dinamo Tbilisi Academy. I coach the U16 and U14 Boys and lead our coaching curriculum from U12 to the reserve team. UEFA A licence.',
  bannerUrl: photo('profile-banner-1'),
};
