// Home, step 7 (owner, 29 October 2026), as the server builds it (backend V255, RecordPostService, ClubPostRules,
// PostRepository.photosShown):
//   * The clubs' records write the routine posts in the club's name, one per moment: a trial, a squad taking players,
//     a job, a fundraiser's progress, a tournament's entries or winners, a new club. The record decides what the post
//     shows when read, so a closed record keeps no button. Children are never named.
//   * Who posts as the club: the Owner, Admins and the Media officer for the whole club; head and assistant coaches
//     and team managers for their own squads (the post shows the squad). In the sandbox: Luka as the Owner (no persona)
//     and the `media` persona for all of Dinamo; `headcoach` for U14 and U16 Boys; `teammanager` for U16 Boys;
//     `headofcoaching` for every squad but not the whole club. A club created here as a page: its owner and staff.
//   * Children's photos stay with the club's people: a photo on a post of a club with any squad of children shows only
//     to its followers and the people linked to it, unless the post is for an adult squad.
import * as W from './world.mjs';
import * as S from './world-social.mjs';
import * as F from './world-football.mjs';
import * as V from './viewer.mjs';
import { canPostForClub, linkedPageClubs } from './pages-data.mjs';
import { nana } from './world-projects.mjs';
import { collectMatchMoments, matchRecordView, matchAdditionsReadable } from './home-match-moments.mjs';

const DINAMO = 1;
const hours = h => new Date(Date.now() - h * 3600000);

/** The moments the sandbox's records reached, each written once as the club's post. */
const SEEDS = [
    { kind: 'TRIAL', recordId: 505, moment: 'OPENED', clubId: 7, hoursAgo: 2 },
    { kind: 'TRIAL', recordId: 502, moment: 'OPENED', clubId: DINAMO, squadId: 104, hoursAgo: 20 },
    { kind: 'TRIAL', recordId: 503, moment: 'OPENED', clubId: 6, hoursAgo: 30 },
    { kind: 'TRIAL', recordId: 508, moment: 'OPENED', clubId: 12, hoursAgo: 5 },
    { kind: 'SQUAD', recordId: 1302, moment: 'OPENED', clubId: DINAMO, squadId: 102, hoursAgo: 9 },
    { kind: 'JOB', recordId: 402, moment: 'OPENED', clubId: 3, hoursAgo: 4 },
    { kind: 'JOB', recordId: 401, moment: 'OPENED', clubId: DINAMO, hoursAgo: 26 },
    { kind: 'PROJECT', recordId: 1201, moment: 'HALFWAY', clubId: DINAMO, hoursAgo: 7 },
    { kind: 'PROJECT', recordId: 1204, moment: 'HALFWAY', clubId: 6, hoursAgo: 40 },
    { kind: 'TOURNAMENT', recordId: 302, moment: 'ENTRIES_OPEN', clubId: 3, hoursAgo: 12 },
    { kind: 'TOURNAMENT', recordId: 304, moment: 'ENTRIES_OPEN', clubId: 12, hoursAgo: 15 },
    { kind: 'CLUB', recordId: 8, moment: 'LIVE', clubId: 8, hoursAgo: 3 },
];

/** The topic a moment posts under (RecordPostService.topicOf). */
export const recordTopic = record => record.kind === 'TRIAL' || record.kind === 'SQUAD' ? 'TRIAL'
    : record.kind === 'RESULTS' ? 'RESULT' : record.kind === 'WEEKEND' ? 'FIXTURE'
    : record.kind === 'JOB' ? 'JOB' : record.kind === 'TOURNAMENT' ? (record.moment === 'WINNERS' ? 'RESULT' : 'TOURNAMENT') : 'CLUB_NEWS';

const titleOf = seed => {
    const trial = seed.kind === 'TRIAL' && F.trialList.find(t => t.id === seed.recordId);
    if (trial) return `Open trial · ${trial.squadName}`;
    if (seed.kind === 'SQUAD') return W.squads.find(s => s.id === seed.squadId)?.name ?? 'Squad';
    if (seed.kind === 'JOB') return W.roles.find(r => r.id === seed.recordId)?.title ?? 'Job';
    if (seed.kind === 'PROJECT') return F.campaigns.find(c => c.id === seed.recordId)?.title ?? 'Project';
    if (seed.kind === 'TOURNAMENT') return W.tournaments.find(t => t.id === seed.recordId)?.name ?? 'Tournament';
    return W.clubById(seed.recordId)?.name ?? 'Club';
};

// Nana, the kit parent persona, follows nobody: her child's club still comes first on her Home.
S.follows.get(nana.id)?.clear();

// The records' posts join the world's posts once.
for (const seed of SEEDS) S.posts.push({
    id: S.newPostId(), authorId: null, clubId: seed.clubId, squadId: seed.squadId ?? null, content: titleOf(seed), createdAt: hours(seed.hoursAgo),
    mediaUrls: [], isPublic: true, editedAt: null, sharedPostId: null, shares: 0, reactions: new Map(), comments: [], hiddenBy: new Set(),
    record: { kind: seed.kind, recordId: seed.recordId, moment: seed.moment, line: null, hidden: false, version: 0 },
});

// ---------------------------------------------------------------- who posts as the club

const ALL_SQUADS = () => W.squads.filter(s => s.clubId === DINAMO).map(s => s.id);
/** The Dinamo squads the persona may post for, and whether it may post for the whole club. */
export function postingOf(headers) {
    if (V.isNewcomer(headers)) return { club: false, squads: [] };
    const persona = V.personaOf(headers);
    if (!persona || persona === 'media') return { club: true, squads: ALL_SQUADS() };
    if (persona === 'headcoach' || persona === 'projectcoach') return { club: false, squads: [103, 105] };
    if (persona === 'teammanager') return { club: false, squads: [105] };
    if (persona === 'headofcoaching') return { club: false, squads: ALL_SQUADS() };
    return { club: false, squads: [] };
}
export const mayPost = (headers, clubId, squadId) => {
    if (Number(clubId) !== DINAMO) return !squadId && canPostForClub(V.viewerId(headers), clubId);
    const posting = postingOf(headers);
    return squadId ? posting.squads.includes(Number(squadId)) : posting.club;
};
/**
 * Whether the person leads the club (its Owner or an Admin), who alone posts to Club leadership: Luka at Dinamo (no
 * persona), and whoever runs a club created here as a page. The Media officer posts publicly only.
 */
export const leadsClub = (headers, clubId) => Number(clubId) === DINAMO
    ? !V.isNewcomer(headers) && !V.personaOf(headers)
    : canPostForClub(V.viewerId(headers), clubId);
/** `GET /posts/authors`: each club first, then its squads; `leadership` on a club's entry for its Owner and Admins. */
export function authorsOf(headers) {
    const posting = postingOf(headers), dinamo = W.clubById(DINAMO);
    const author = (club, squadId = null, name = club.name) => ({ clubId: club.id, clubName: club.name, crestUrl: club.logoUrl ?? null, squadId, name,
        leadership: !squadId && leadsClub(headers, club.id) });
    const found = posting.club ? [author(dinamo)] : [];
    for (const id of posting.squads) found.push(author(dinamo, id, W.squads.find(s => s.id === id)?.name ?? 'Squad'));
    for (const id of linkedPageClubs(V.viewerId(headers))) {
        const club = W.clubById(id);
        if (club && id !== DINAMO && mayPost(headers, id, null)) found.push(author(club));
    }
    return found;
}

// ---------------------------------------------------------------- the switches

const switches = new Map(); // clubId -> { off: Set, version }
const KINDS = ['TRIAL', 'SQUAD', 'JOB', 'PROJECT', 'TOURNAMENT', 'RESULTS', 'WEEKEND'];
export function sweepMatchMoments(now = new Date()) {
    collectMatchMoments(S.posts, (kind, clubId, day) => {
        const post = { id: S.newPostId(), authorId: null, clubId, squadId: null, content: kind === 'RESULTS' ? 'From the results' : 'This weekend', createdAt: now,
            mediaUrls: [], isPublic: true, editedAt: null, sharedPostId: null, shares: 0, reactions: new Map(), comments: [], hiddenBy: new Set(),
            record: { kind, recordId: clubId, moment: day, eventIds: [], line: null, hidden: false, version: 0 } };
        S.posts.push(post); return post;
    }, switchesOf, now);
}
export const switchesOf = clubId => switches.get(Number(clubId)) ?? { off: new Set(), version: 0 };
export const switchesDto = clubId => { const s = switchesOf(clubId); return { kinds: KINDS.map(kind => ({ kind, on: !s.off.has(kind) })), version: s.version, canChange: true }; };
export function saveSwitches(clubId, off, version) {
    const current = switchesOf(clubId);
    if (current.version !== version) return null;
    sweepMatchMoments(); // Count the current off-period moments before a re-enable.
    switches.set(Number(clubId), { off: new Set(off.filter(kind => KINDS.includes(kind))), version: version + 1 });
    return switchesDto(clubId);
}

// ---------------------------------------------------------------- what a written post shows

const HOURS = { PART_TIME: 'PART_TIME', FULL_TIME: 'FULL_TIME', VOLUNTEER: 'VOLUNTEER', CONTRACT: 'PAID' };
const mayEnter = headers => !V.isNewcomer(headers) && ['', 'headcoach', 'teammanager', 'headofcoaching'].includes(V.personaOf(headers) ?? '');

/** The record as the post shows it now (RecordPostService.views); null when the record is gone. */
export function recordView(post, viewer, headers) {
    const r = post.record;
    if (!r) return null;
    const canChange = mayPost(headers, post.clubId, post.squadId);
    // Staff get the photos' ids, in the card's order, so adding one keeps the others.
    const base = { kind: r.kind, moment: r.moment, recordId: r.recordId, line: r.line, hidden: r.hidden, canChange, version: r.version,
        photoIds: canChange ? [...(post.mediaIds ?? [])] : null };
    if (r.kind === 'RESULTS' || r.kind === 'WEEKEND') return matchRecordView(post, base, viewer, headers);
    if (r.kind === 'TRIAL') {
        const t = F.trialList.find(x => x.id === r.recordId);
        if (!t) return null;
        const open = !t.status || t.status === 'OPEN';
        return { ...base, title: post.content, state: open ? 'OPEN' : 'CLOSED', action: open ? 'APPLY' : null, startsAt: t.date instanceof Date ? t.date.toISOString() : t.date,
            placeName: W.venues?.find(v => v.id === t.venueId)?.name ?? W.clubById(t.clubId)?.city ?? null, ageGroup: t.ageGroup };
    }
    if (r.kind === 'SQUAD') {
        const g = F.groupById(r.recordId);
        if (!g) return null;
        const squad = W.squads.find(s => s.id === post.squadId);
        const open = g.published !== false && g.intakeOpen !== false;
        return { ...base, title: squad?.name ?? post.content, state: open ? 'OPEN' : 'CLOSED', action: open ? 'ASK' : null, ageGroup: squad?.category ?? squad?.ageGroup ?? null, gender: squad?.gender ?? null };
    }
    if (r.kind === 'JOB') {
        const job = W.roles.find(x => x.id === r.recordId);
        if (!job) return null;
        return { ...base, title: job.title, state: 'OPEN', action: 'VIEW_JOB', hours: HOURS[job.employment] ?? null };
    }
    if (r.kind === 'PROJECT') {
        const c = F.campaigns.find(x => x.id === r.recordId);
        if (!c || c.status === 'ARCHIVED') return null;
        // Its phase by its dates (CampaignRepository.phase): Support only while active.
        const state = { ACTIVE: 'OPEN', CLOSED: 'ENDED' }[c.phase ?? c.status] ?? c.phase ?? c.status;
        return { ...base, title: c.title, state, action: state === 'OPEN' ? 'SUPPORT' : null,
            reportedAmount: c.reportedAmount == null ? null : String(c.reportedAmount), goalAmount: c.goalAmount == null ? null : String(c.goalAmount), currency: c.currency ?? 'GEL' };
    }
    if (r.kind === 'TOURNAMENT') {
        const t = W.tournaments.find(x => x.id === r.recordId);
        if (!t) return null;
        const open = t.status === 'REGISTRATION';
        const iso = d => d instanceof Date ? d.toISOString() : d;
        return { ...base, title: t.name, state: open ? 'OPEN' : t.status === 'COMPLETED' ? 'DONE' : 'CLOSED', action: r.moment === 'ENTRIES_OPEN' && open && mayEnter(headers) ? 'ENTER' : null,
            startsAt: iso(t.start), endsAt: iso(t.end), placeName: t.city };
    }
    const club = W.clubById(r.recordId);
    if (!club) return null;
    const following = V.clubFollowsOf(viewer).has(club.id);
    const ages = [...new Set(W.squads.filter(s => s.clubId === club.id).map(s => s.category ?? s.ageGroup).filter(Boolean))].sort();
    return { ...base, title: club.name, state: 'OPEN', action: following ? null : 'FOLLOW', placeName: club.city, ages, following };
}

/**
 * Staff add one line and photos, or hide it for everyone; a stale version is refused (409). `photos` is every photo
 * the post keeps ({ id, url }, earlier ones included); null keeps them as they are.
 */
export function changeRecord(post, { line, photos, hidden, version }) {
    if (post.record.version !== version) return false;
    post.record.line = typeof line === 'string' && line.trim() ? line.trim().slice(0, 500) : null;
    post.record.hidden = Boolean(hidden);
    if (photos) { post.mediaIds = photos.map(photo => photo.id); post.mediaUrls = photos.map(photo => photo.url); }
    post.record.version++;
    return true;
}

// ---------------------------------------------------------------- children's photos

const ADULT = /(^|[^a-z])(senior|seniors|first team|women|men|veterans)([^a-z]|$)/i;
const childrens = squad => !ADULT.test(`${squad.category ?? ''} ${squad.name ?? ''}`);
/** Whether a club post's photos show to the reader (PostRepository.photosShown). */
export function photosShown(post, viewer, linkedClubs, headers = {}) {
    if (!matchAdditionsReadable(post, viewer, headers)) return false;
    if (!post.clubId) return true;
    if (linkedClubs.has(post.clubId) || V.clubFollowsOf(viewer).has(post.clubId)) return true;
    const squad = post.squadId ? W.squads.find(s => s.id === post.squadId) : null;
    if (squad && !childrens(squad)) return true;
    return !W.squads.some(s => s.clubId === post.clubId && childrens(s));
}
