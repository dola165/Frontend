import type { Repo } from './upToDate';

/**
 * Which version a person is on, in words, without them knowing commits or release numbers. Each build knows the commit
 * it was made from and its last commits with their parents (the backend in its jar, this web app in its bundle, both
 * taken at build or dev-server start). A build contains release N when N's commit is in its history; its changes past
 * N are the commits it has that N does not, merges left out. The live release comes from the server: it is the live
 * site itself, or it asked the live site, or it is the newest release in this copy's list.
 */

export type Place = 'LIVE' | 'COPY';
export type LiveSource = 'HERE' | 'LIVE_SITE' | 'NO_ANSWER' | 'ASKING' | 'NOT_ASKED';
export type MatchedBy = 'LISTED' | 'COMMIT' | 'BRANCH' | 'KEY' | 'MARKED_LIVE';
export interface Words { en: string; ka: string }
export interface ReleaseTask { id: number; key: string; title: string; status: string; how: MatchedBy }
/** A release, newest first. No summary: only the live site knows it, this copy's list is older. */
export interface Release { number: number; date: string | null; backend: string; web: string; summary: Words | null; tasks: ReleaseTask[] }
/** Where a build stands: the newest release in its history and its changes past it; release null when it has none. */
export interface At { known: boolean; release: number | null; changes: number }
export interface Build { known: boolean; head?: string | null; branch?: string | null; builtAt?: string | null; dirty?: number }
export interface Seen { release: number | null; backend: string | null; web: string | null; at?: string | null }
export interface Live { release: number | null; changes: number; source: LiveSource; checkedAt: string | null }
/** What GET /team-work/versions answers. A backend from before this page sends only `backend`. */
export interface Versions {
    backend: Repo;
    place?: Place;
    liveOrigin?: string;
    build?: Build;
    at?: At;
    live?: Live;
    releases?: Release[];
    seen?: Seen | null;
}

/** The web app's own build as baked by vite.config.ts; `graph` is "id parent parent" per commit, newest first. */
export interface WebBuild extends Build { graph?: string[] }
declare const __GIT_BUILD__: WebBuild | undefined;
export const webBuild = (): WebBuild => (typeof __GIT_BUILD__ === 'object' && __GIT_BUILD__ ? __GIT_BUILD__ : { known: false });

/** Where a build with this commit graph stands against the releases (their commit in this repository). */
export function atRelease(graph: string[] | undefined, releases: { number: number; commit: string }[]): At {
    if (!graph?.length) return { known: false, release: null, changes: 0 };
    const parents = new Map<string, string[]>();
    for (const line of graph) {
        const [id, ...rest] = line.trim().toLowerCase().split(/\s+/);
        if (id) parents.set(id, rest);
    }
    // Ids are shortened in the bundle; a release names its commit in full or in part.
    const find = (commit: string) => {
        const wanted = commit.trim().toLowerCase();
        if (wanted.length < 7) return null;
        const found = [...parents.keys()].filter(id => wanted.startsWith(id) || id.startsWith(wanted));
        return found.length === 1 ? found[0] : null;
    };
    for (const release of [...releases].sort((a, b) => b.number - a.number)) {
        const start = find(release.commit);
        if (!start) continue;
        const inRelease = new Set<string>();
        const next = [start];
        while (next.length) {
            const id = next.pop() as string;
            if (inRelease.has(id) || !parents.has(id)) continue;
            inRelease.add(id);
            next.push(...(parents.get(id) ?? []));
        }
        const changes = [...parents].filter(([id, up]) => !inRelease.has(id) && up.length < 2).length;
        return { known: true, release: release.number, changes };
    }
    return { known: true, release: null, changes: 0 };
}

/** Everything the page says about the version, worked out once. */
export interface Standing {
    place: Place;
    /** Whether either side could tell where it stands. */
    known: boolean;
    /** The release this copy is on: the older of the two sides when they differ. */
    release: number | null;
    /** Backend and web are on different releases. */
    split: boolean;
    /** Changes past `release` in both repositories, and files not committed when they were built. */
    changes: number;
    dirty: number;
    /** Exactly a release: both sides on it, nothing past it, nothing uncommitted. */
    exact: boolean;
    backend: At;
    web: At;
    live: Live;
    /** The releases live has and this copy does not, oldest first. */
    behind: Release[];
    /** This copy has a release live does not have yet. */
    aheadOfLive: boolean;
    /** The backend is older than this page: it sends no releases. */
    oldBackend: boolean;
}

const UNKNOWN: At = { known: false, release: null, changes: 0 };

/** Where this server and this page stand, against the releases and live. */
export function standing(versions: Versions, web: WebBuild): Standing {
    const releases = versions.releases ?? [];
    const oldBackend = !versions.releases;
    const backend = versions.at?.known ? versions.at : UNKNOWN;
    const webAt = web.known ? atRelease(web.graph, releases.map(release => ({ number: release.number, commit: release.web }))) : UNKNOWN;
    const sides = [backend, webAt].filter(side => side.known);
    const numbers = sides.map(side => side.release);
    const release = numbers.length === 0 || numbers.includes(null) ? null : Math.min(...(numbers as number[]));
    const split = sides.length === 2 && backend.release !== webAt.release;
    const changes = sides.reduce((sum, side) => sum + side.changes, 0);
    const dirty = (versions.build?.known ? versions.build.dirty ?? 0 : 0) + (web.known ? web.dirty ?? 0 : 0);
    const place: Place = versions.place ?? 'COPY';
    const live: Live = place === 'LIVE' ? { release, changes, source: 'HERE', checkedAt: versions.live?.checkedAt ?? null }
        : versions.live ?? { release: releases[0]?.number ?? null, changes: 0, source: 'NOT_ASKED', checkedAt: null };
    const behind = sides.length === 0 || live.release == null ? []
        : releases.filter(r => r.number <= (live.release as number) && (release == null || r.number > release)).sort((a, b) => a.number - b.number);
    return {
        place, known: sides.length > 0, release, split, changes, dirty,
        exact: release != null && !split && changes === 0 && dirty === 0,
        backend, web: webAt, live, behind,
        aheadOfLive: release != null && live.release != null && release > live.release,
        oldBackend,
    };
}

/**
 * What is new since the person last looked: the releases after the one they saw, up to the one they are on now, oldest
 * first. A first look shows the release they are on. Empty when they already saw this release or a later one.
 */
export function newSince(seen: Seen | null | undefined, now: number | null, releases: Release[]): { first: boolean; releases: Release[] } {
    const first = !seen || seen.release == null;
    if (now == null) return { first, releases: [] };
    const from = first ? now - 1 : seen.release as number;
    return { first, releases: releases.filter(r => r.number > from && r.number <= now).sort((a, b) => a.number - b.number) };
}

type Copy = (en: string, ka: string) => string;
const plus = (copy: Copy, changes: number) => changes === 0 ? '' : changes === 1 ? copy(' plus 1 change', ' (+1 ცვლილება)') : copy(` plus ${changes} changes`, ` (+${changes} ცვლილება)`);

/** The page's first line: which release live runs, or which release this local copy is on. */
export function headline(copy: Copy, s: Standing): string {
    if (!s.known) return s.place === 'LIVE' ? copy('Live · which release is not known', 'ლაივი · რომელი რელიზია, უცნობია')
        : copy('Your local copy · which release is not known', 'თქვენი ლოკალური ასლი · რომელი რელიზია, უცნობია');
    if (s.place === 'LIVE') return s.release == null ? copy('Live is on a version from before release 1', 'ლაივზეა 1-ელ რელიზამდელი ვერსია')
        : copy(`Live is on release ${s.release}${plus(copy, s.changes)}`, `ლაივზეა რელიზი ${s.release}${plus(copy, s.changes)}`);
    const where = copy('your local copy', 'თქვენი ლოკალური ასლი');
    if (s.release == null) return copy(`You’re on a version from before release 1 · ${where}`, `თქვენ ხართ 1-ელ რელიზამდელ ვერსიაზე · ${where}`);
    return copy(`You’re on release ${s.release}${plus(copy, s.changes)} · ${where}`, `თქვენ ხართ რელიზ ${s.release}-ზე${plus(copy, s.changes)} · ${where}`);
}

/** The second line: how this compares with live, in words. */
export function comparedWithLive(copy: Copy, s: Standing): string {
    if (s.oldBackend) return copy('Your backend copy is older than this page, so it can’t say which release it is. Update it with the update message.',
        'თქვენი ბექენდის ასლი ამ გვერდზე ძველია და ვერ ამბობს, რომელი რელიზია. განაახლეთ განახლების ტექსტით.');
    if (!s.known) return copy('It was built without git, so it can’t tell. Check your project folders below.', 'ის git-ის გარეშე აიწყო, ამიტომ ვერ გაიგებს. შეამოწმეთ თქვენი პროექტების საქაღალდე ქვემოთ.');
    if (s.place === 'LIVE') return s.changes === 0 && !s.split
        ? copy('This is what everyone using the app sees.', 'ამას ხედავს ყველა, ვინც აპს იყენებს.')
        : copy('Live runs changes that are not recorded as a release yet.', 'ლაივზე არის ცვლილებები, რომლებიც ჯერ რელიზად არ ჩაწერილა.');
    const live = s.live.release;
    if (live == null) return copy('Which release is live is not known.', 'უცნობია, რომელი რელიზია ლაივზე.');
    if (s.aheadOfLive) return copy(`That release isn’t live yet: live is release ${live}.`, `ეს რელიზი ჯერ ლაივზე არ არის: ლაივზეა რელიზი ${live}.`);
    if (s.behind.length > 0) {
        const n = s.behind.length, list = s.behind.map(r => r.number).join(', ');
        return copy(`${n === 1 ? '1 release' : `${n} releases`} behind live (release ${live}): you’re missing release ${list}.`,
            `ლაივს (რელიზი ${live}) ${n} რელიზით ჩამორჩებით: გაკლიათ რელიზი ${list}.`);
    }
    if (s.split) return copy(`Backend and web are on different releases (backend ${s.backend.release ?? '–'}, web ${s.web.release ?? '–'}).`,
        `ბექენდი და ვები სხვადასხვა რელიზზეა (ბექენდი ${s.backend.release ?? '–'}, ვები ${s.web.release ?? '–'}).`);
    if (s.changes > 0) return copy(`The same as live, plus ${s.changes === 1 ? '1 change that isn’t' : `${s.changes} changes that aren’t`} live yet.`,
        `იგივეა, რაც ლაივზე, და კიდევ ${s.changes} ცვლილება, რომელიც ჯერ ლაივზე არ არის.`);
    return s.dirty > 0 ? copy('The same as live, with edits that are not committed.', 'იგივეა, რაც ლაივზე, დაუკომიტებელი ცვლილებებით.')
        : copy('The same as live.', 'იგივეა, რაც ლაივზე.');
}

/** How the live release is known, honestly. */
export function liveSourceLine(copy: Copy, s: Standing): string {
    switch (s.live.source) {
        case 'HERE': return copy('This server is the live site.', 'ეს სერვერი ლაივ საიტია.');
        case 'LIVE_SITE': return copy('The live site said which release it runs.', 'ლაივ საიტმა თქვა, რომელი რელიზი მუშაობს.');
        case 'ASKING': return copy('The live site is being asked which release it runs; until it answers, live is taken as the newest release your copy knows. Open this page again in a moment.',
            'ლაივ საიტს ეკითხება, რომელი რელიზი მუშაობს; პასუხამდე ლაივად ითვლება უახლესი რელიზი, რომელიც თქვენმა ასლმა იცის. ცოტა ხანში ისევ გახსენით ეს გვერდი.');
        case 'NO_ANSWER': return copy('The live site did not answer (it may be behind the preview password), so live is taken as the newest release your copy knows. Live may be newer.',
            'ლაივ საიტმა არ უპასუხა (შეიძლება პაროლით არის დაკეტილი), ამიტომ ლაივად ითვლება უახლესი რელიზი, რომელიც თქვენმა ასლმა იცის. ლაივი შეიძლება უფრო ახალი იყოს.');
        default: return copy('Live is taken as the newest release your copy knows: no live address is set here.', 'ლაივად ითვლება უახლესი რელიზი, რომელიც თქვენმა ასლმა იცის: ლაივის მისამართი აქ არ არის.');
    }
}
