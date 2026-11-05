import { describe, expect, it } from 'vitest';
import { placeScore, seenTips, tipForPage, tipScore, tipsOff, TIP_PREFIX, TIPS_OFF, type FirstTip } from './firstTips';
import { FIRST_TIPS } from './tipCatalog';
import { placeTip } from './tipPlacement';

const words = (text: string) => ({ en: text, ka: text });
const tip = (id: string, ...places: NonNullable<FirstTip['places']>): FirstTip => ({ id, title: words(id), body: words(id), ask: words(id), places });
const params = (search = '') => new URLSearchParams(search);

describe('placeScore', () => {
    it('matches fixed segments, named segments and a trailing rest', () => {
        expect(placeScore({ path: '/world' }, '/world', params())).not.toBeNull();
        expect(placeScore({ path: '/world' }, '/world/clubs', params())).toBeNull();
        expect(placeScore({ path: '/world/*' }, '/world', params())).not.toBeNull();
        expect(placeScore({ path: '/world/*' }, '/world/clubs/7', params())).not.toBeNull();
        expect(placeScore({ path: '/clubs/:id/workspace' }, '/clubs/12/workspace', params())).not.toBeNull();
        expect(placeScore({ path: '/clubs/:id/workspace' }, '/clubs/12', params())).toBeNull();
        expect(placeScore({ path: '/clubs/:id' }, '/home', params())).toBeNull();
    });

    it('needs every named query value; true takes any value', () => {
        expect(placeScore({ path: '/world/tournaments', query: { peek: 'draw-new' } }, '/world/tournaments', params('?peek=draw-new'))).not.toBeNull();
        expect(placeScore({ path: '/world/tournaments', query: { peek: 'draw-new' } }, '/world/tournaments', params('?peek=other'))).toBeNull();
        expect(placeScore({ path: '/world/tournaments', query: { peek: 'draw-new' } }, '/world/tournaments', params())).toBeNull();
        expect(placeScore({ path: '/home', query: { compose: true } }, '/home', params('?compose=post'))).not.toBeNull();
        expect(placeScore({ path: '/world/*', query: { peek: 'arrange-*' } }, '/world/matches', params('?peek=arrange-direct.c12'))).not.toBeNull();
        expect(placeScore({ path: '/world/*', query: { peek: 'arrange-*' } }, '/world/matches', params('?peek=club-12'))).toBeNull();
    });

    it('scores the more exact place higher', () => {
        const at = (path: string, query?: Record<string, string>) => placeScore({ path, query }, '/world/tournaments', params('?peek=draw-new')) ?? -1;
        expect(at('/world/tournaments', { peek: 'draw-new' })).toBeGreaterThan(at('/world/tournaments'));
        expect(at('/world/tournaments')).toBeGreaterThan(at('/world/*'));
        expect(at('/world/:tab')).toBeLessThan(at('/world/tournaments'));
        // An exact value beats a beginning, which beats any value.
        const peek = (value: string | true) => placeScore({ path: '/world/*', query: { peek: value } }, '/world', params('?peek=draw-new')) ?? -1;
        expect(peek('draw-new')).toBeGreaterThan(peek('draw-*'));
        expect(peek('draw-*')).toBeGreaterThan(peek(true));
    });

    it('puts a window before the page it opens on, however exact the page', () => {
        const page = tip('mine', { path: '/world/matches', query: { tab: 'mine' } });
        const arrange: FirstTip = { ...tip('arrange', { path: '/world/*', query: { peek: 'arrange-*' } }), action: true };
        const here = params('?tab=mine&peek=arrange-direct');
        expect(tipScore(arrange, '/world/matches', here)).toBeGreaterThan(tipScore(page, '/world/matches', here) ?? 0);
        expect(tipForPage([page, arrange], '/world/matches', '?tab=mine&peek=arrange-direct', new Set())?.id).toBe('arrange');
    });
});

describe('tipForPage', () => {
    const tips = [tip('world', { path: '/world/*' }), tip('tournaments', { path: '/world/tournaments' }),
        tip('draw', { path: '/world/tournaments', query: { peek: 'draw-new' } }), tip('home', { path: '/home' }), tip('post')];

    it('shows the page’s own tip first, then its section’s', () => {
        expect(tipForPage(tips, '/world/tournaments', '?peek=draw-new', new Set())?.id).toBe('draw');
        expect(tipForPage(tips, '/world/tournaments', '?peek=draw-new', new Set(['draw']))?.id).toBe('tournaments');
        expect(tipForPage(tips, '/world/tournaments', '', new Set(['draw', 'tournaments']))?.id).toBe('world');
        expect(tipForPage(tips, '/world/tournaments', '', new Set(['draw', 'tournaments', 'world']))).toBeNull();
    });

    it('never picks a tip that shows only when asked for', () => {
        expect(tipForPage(tips, '/messages', '', new Set())).toBeNull();
        expect(tipForPage([tip('post')], '/home', '', new Set())).toBeNull();
    });
});

describe('seen tips in preferences', () => {
    it('reads tip ids and the off switch from finished tutorials only', () => {
        const preferences = { tutorials: { completed: ['calendar', `${TIP_PREFIX}world`, `${TIP_PREFIX}create-tournament`] } };
        expect([...seenTips(preferences)]).toEqual(['world', 'create-tournament']);
        expect(tipsOff(preferences)).toBe(false);
        expect(tipsOff({ tutorials: { completed: [TIPS_OFF] } })).toBe(true);
        expect(seenTips({}).size).toBe(0);
    });
});

describe('the catalogue', () => {
    it('has unique ids the server keeps (tip-<id> fits its 40-character names)', () => {
        const ids = FIRST_TIPS.map(item => item.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) expect(`${TIP_PREFIX}${id}`).toMatch(/^[a-z0-9][a-z0-9-]{0,39}$/);
        // The server keeps at most 200 finished tutorials; leave room for the guided tours and later tips.
        expect(ids.length).toBeLessThanOrEqual(120);
    });

    it('says everything in English and Georgian, briefly', () => {
        for (const item of FIRST_TIPS) {
            for (const text of [item.title, item.body, item.ask].filter((words): words is NonNullable<typeof words> => Boolean(words))) {
                expect(text.en.trim(), item.id).not.toBe('');
                expect(text.ka.trim(), item.id).not.toBe('');
                expect(/[ა-ჿ]/.test(text.ka), `${item.id}: Georgian text`).toBe(true);
            }
            expect(item.body.en.length, `${item.id}: body`).toBeLessThanOrEqual(320);
            expect(item.ask?.en.length ?? 0, `${item.id}: ask`).toBeLessThanOrEqual(48);
            expect(item.places?.length || item.action, `${item.id}: shown by a page or by a button`).toBeTruthy();
        }
    });

    it('gives no two tips the same exact place', () => {
        const places = FIRST_TIPS.flatMap(item => (item.places ?? []).map(place => `${place.path}?${new URLSearchParams(Object.entries(place.query ?? {}).map(([key, value]) => [key, String(value)])).toString()}`));
        expect(new Set(places).size).toBe(places.length);
    });
});

describe('placeTip', () => {
    const card = { width: 352, height: 220 };
    const viewport = { width: 1690, height: 1000 };

    it('sits left of Agent Dola’s button with the pointer on the button', () => {
        const anchor = { top: 16, bottom: 56, left: 1370, right: 1480 };
        const placed = placeTip(anchor, card, viewport);
        expect(placed.side).toBe('left');
        expect(placed.left + card.width).toBeLessThan(anchor.left);
        expect(placed.top + placed.pointer).toBe((anchor.top + anchor.bottom) / 2);
    });

    it('drops below the button on a phone and stays on screen', () => {
        const anchor = { top: 6, bottom: 50, left: 230, right: 274 };
        const placed = placeTip(anchor, card, { width: 390, height: 800 });
        expect(placed.side).toBe('below');
        expect(placed.top).toBeGreaterThan(anchor.bottom);
        expect(placed.left).toBeGreaterThanOrEqual(12);
        expect(placed.left + card.width).toBeLessThanOrEqual(390 - 12);
        expect(placed.left + placed.pointer).toBe((anchor.left + anchor.right) / 2);
    });

    it('waits in the corner, above a bottom bar, when nothing can be pointed at', () => {
        const placed = placeTip(null, card, { width: 390, height: 800 }, 56);
        expect(placed.side).toBe('corner');
        expect(placed.left).toBe(12);
        expect(placed.top + card.height).toBeLessThanOrEqual(800 - 56);
    });
});
