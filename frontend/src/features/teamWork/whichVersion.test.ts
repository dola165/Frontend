import { describe, expect, it } from 'vitest';
import { atRelease, comparedWithLive, headline, liveSourceLine, newSince, standing, webBuild, type Release, type Versions, type WebBuild } from './whichVersion';

const english = (en: string) => en;
const full = (id: string) => id.padEnd(40, '0');
// Web history, newest first: two commits of my own on top of release 5, which merged a side branch into release 4.
const MINE = 'a00000000001', MINE_2 = 'a00000000002', R5 = 'b50000000005', SIDE = 'c00000000001', R4 = 'b40000000004', BASE = 'd00000000001';
const graph = [`${MINE} ${MINE_2}`, `${MINE_2} ${R5}`, `${R5} ${R4} ${SIDE}`, `${SIDE} ${R4}`, `${R4} ${BASE}`, BASE];
const release = (number: number, web: string): Release => ({ number, date: '2026-10-26', backend: full(`e0${number}`), web: full(web), summary: { en: `Release ${number}`, ka: `რელიზი ${number}` }, tasks: [] });
const releases = [release(5, R5), release(4, R4)];
const build = (lines: string[], dirty = 0): WebBuild => ({ known: true, head: lines[0].split(' ')[0], branch: 'codex/real-backend-integration-20261017', dirty, graph: lines });
const versions = (over: Partial<Versions> = {}): Versions => ({
    backend: { known: true, commits: [] }, place: 'COPY', liveOrigin: 'https://app.grasskickz.com',
    build: { known: true, head: full('e05'), dirty: 0 }, at: { known: true, release: 5, changes: 0 },
    live: { release: 5, changes: 0, source: 'LIVE_SITE', checkedAt: '2026-10-26T10:00:00Z' }, releases, seen: null, ...over,
});

describe('where a build stands', () => {
    it('finds the newest release in its history and counts what it has past it, merges left out', () => {
        expect(atRelease(graph, releases.map(r => ({ number: r.number, commit: r.web })))).toEqual({ known: true, release: 5, changes: 2 });
        expect(atRelease(graph.slice(2), [{ number: 5, commit: full(R5) }])).toEqual({ known: true, release: 5, changes: 0 });
        // The side branch was merged by release 5, so a copy at release 4 with it has 1 change.
        expect(atRelease([`${SIDE} ${R4}`, `${R4} ${BASE}`, BASE], [{ number: 5, commit: full(R5) }, { number: 4, commit: full(R4) }])).toEqual({ known: true, release: 4, changes: 1 });
    });

    it('matches a release by a short or full id, and knows when a build holds no release or no history', () => {
        expect(atRelease(graph, [{ number: 5, commit: R5.slice(0, 8) }]).release).toBe(5);
        expect(atRelease([BASE], [{ number: 5, commit: full(R5) }])).toEqual({ known: true, release: null, changes: 0 });
        expect(atRelease(undefined, [{ number: 5, commit: full(R5) }])).toEqual({ known: false, release: null, changes: 0 });
        expect(atRelease(graph, [{ number: 5, commit: 'b00' }]).release).toBeNull();
    });

    it('says "not known" when the bundle has no build stamp (tests and Docker builds)', () => {
        expect(webBuild()).toEqual({ known: false });
    });
});

describe('which version a person is on', () => {
    it('on the live site: the release, and that it is live', () => {
        const s = standing(versions({ place: 'LIVE', live: { release: 5, changes: 0, source: 'HERE', checkedAt: null } }), build(graph.slice(2)));
        expect(s).toMatchObject({ place: 'LIVE', release: 5, exact: true, behind: [] });
        expect(headline(english, s)).toBe('Live is on release 5');
        expect(comparedWithLive(english, s)).toBe('This is what everyone using the app sees.');
        expect(liveSourceLine(english, s)).toBe('This server is the live site.');
    });

    it('a local copy matching a release: the same as live', () => {
        const s = standing(versions(), build(graph.slice(2)));
        expect(s).toMatchObject({ place: 'COPY', release: 5, exact: true, changes: 0 });
        expect(headline(english, s)).toBe('You’re on release 5 · your local copy');
        expect(comparedWithLive(english, s)).toBe('The same as live.');
    });

    it('a local copy ahead of live: the release plus its own changes', () => {
        const s = standing(versions(), build(graph, 1));
        expect(s).toMatchObject({ release: 5, changes: 2, dirty: 1, exact: false, behind: [] });
        expect(headline(english, s)).toBe('You’re on release 5 plus 2 changes · your local copy');
        expect(comparedWithLive(english, s)).toBe('The same as live, plus 2 changes that aren’t live yet.');
    });

    it('a local copy behind live: how many releases and which ones it is missing', () => {
        const s = standing(versions({ at: { known: true, release: 4, changes: 0 } }), build([`${R4} ${BASE}`, BASE]));
        expect(s.release).toBe(4);
        expect(s.behind.map(r => r.number)).toEqual([5]);
        expect(comparedWithLive(english, s)).toBe('1 release behind live (release 5): you’re missing release 5.');
    });

    it('backend and web on different releases: the older one, and says so', () => {
        const s = standing(versions({ live: { release: 4, changes: 0, source: 'NO_ANSWER', checkedAt: null } }), build([`${R4} ${BASE}`, BASE]));
        expect(s).toMatchObject({ release: 4, split: true, exact: false });
        expect(comparedWithLive(english, s)).toBe('Backend and web are on different releases (backend 5, web 4).');
        expect(liveSourceLine(english, s)).toMatch(/did not answer.*Live may be newer/);
        const asking = standing(versions({ live: { release: 5, changes: 0, source: 'ASKING', checkedAt: null } }), build(graph.slice(2)));
        expect(liveSourceLine(english, asking)).toMatch(/being asked.*newest release your copy knows/);
    });

    it('a release recorded in this copy that live does not run yet', () => {
        const s = standing(versions({ live: { release: 4, changes: 0, source: 'LIVE_SITE', checkedAt: null } }), build(graph.slice(2)));
        expect(s.aheadOfLive).toBe(true);
        expect(comparedWithLive(english, s)).toBe('That release isn’t live yet: live is release 4.');
    });

    it('unknown: built without git on both sides, or a backend from before this page', () => {
        const s = standing(versions({ at: { known: false, release: null, changes: 0 }, build: { known: false } }), { known: false });
        expect(s).toMatchObject({ known: false, release: null, behind: [] });
        expect(headline(english, s)).toBe('Your local copy · which release is not known');
        expect(comparedWithLive(english, s)).toMatch(/built without git/);
        const old = standing({ backend: { known: true, commits: [] } }, build(graph));
        expect(old.oldBackend).toBe(true);
        expect(comparedWithLive(english, old)).toMatch(/older than this page/);
    });
});

describe('what is new since the person last looked', () => {
    it('the releases after the one they saw, oldest first; nothing when they saw this one; the current one at first', () => {
        const all = [release(5, R5), release(4, R4), release(3, BASE)];
        expect(newSince({ release: 3, backend: null, web: null }, 5, all).releases.map(r => r.number)).toEqual([4, 5]);
        expect(newSince({ release: 5, backend: null, web: null }, 5, all)).toEqual({ first: false, releases: [] });
        expect(newSince(null, 5, all)).toMatchObject({ first: true, releases: [{ number: 5 }] });
        expect(newSince(null, null, all)).toEqual({ first: true, releases: [] });
    });
});
