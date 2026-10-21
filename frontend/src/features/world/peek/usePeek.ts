import { useContext, useState, type MouseEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useStage, WIDE } from '../stage/stageContext';
import { useMediaQuery } from '../useMediaQuery';
import { PeekPlaceContext, useDrawerPlace } from './drawerContext';
import { DRAWER_KINDS } from './kinds';

/** The address parameters of World's drawers: the thing itself on the right, who is behind it on the left. */
export const PEEK = 'peek';
export const SIDE = 'side';
/** Which part of the thing on the right shows (a club's Matches); none is its overview. */
export const PART = 'part';
/** Everything the drawers keep in the address: it all closes with them, and with a different list. */
export const DRAWER_PARAMS = [PEEK, SIDE, PART];
/** A drawer's value (`person-12`) as its kind and id, when it is one World can show. */
export const parsePeek = (value?: string | null) => {
    const at = value ? value.indexOf('-') : -1;
    const kind = at > 0 ? value!.slice(0, at) : undefined, id = at > 0 ? value!.slice(at + 1) : undefined;
    return kind && id && (DRAWER_KINDS as readonly string[]).includes(kind) ? { kind, id } : null;
};
/** The drawer of one thing, as the address names it (`person-12`). */
export const peekOf = (kind: string, id: number | string) => `${kind}-${id}`;

/**
 * A link's click handler: a plain click opens the drawer; with a modifier (new tab, new window) the link goes to the full
 * page. A click from the keyboard (Enter) says so, so the pane beside the list takes focus.
 */
export const peekClick = (peek: string | undefined, open: (value: string, options?: { focus?: boolean }) => void) => (event: MouseEvent) => {
    if (!peek || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    open(peek, { focus: event.detail === 0 });
};

/**
 * What a history entry remembers about the drawers: that it was added for them (closing them goes back over it), and
 * that the thing shows in the pane beside the list (so coming Back to it from its full page shows it there again).
 */
interface DrawerState { drawers?: boolean; pane?: boolean }
const stateOf = (state: unknown) => (state ?? {}) as DrawerState;

/**
 * History state for a write that changes the list while something is shown beside it (a sort, more results, the map's
 * panel folded): the pane stays where it is. The drawers' own entry is not carried, so closing never undoes the change.
 */
export const keepPane = (state: unknown) => stateOf(state).pane ? { pane: true } : undefined;

/** Focus asked for by an open from the keyboard: the pane takes it once, when it shows that thing. */
let paneFocus: string | null = null;
export function takePaneFocus(value?: string) {
    if (!value || paneFocus !== value) return false;
    paneFocus = null;
    return true;
}

/**
 * World's drawers, kept in the address so a shared link opens them. The first drawer to open adds one history entry;
 * everything after (another thing, who is behind it, closing just the left one) replaces it. So Back, or a click
 * between the drawers, closes them all in one step and returns to the list where it was.
 *
 * Where it shows is decided when it is pressed and kept in the history entry: from the list under the map, in the pane
 * beside it; from anywhere else (the map's panel, a docked strip, the overview), and for a shared link, in a drawer.
 */
export function usePeek() {
    const [params, setParams] = useSearchParams();
    const place = useContext(PeekPlaceContext);
    const location = useLocation();
    const navigate = useNavigate();
    const current = stateOf(location.state);
    const right = parsePeek(params.get(PEEK)), left = parsePeek(params.get(SIDE));
    const write = (change: (next: URLSearchParams) => void, pane: boolean) => {
        const first = !right && !left;
        setParams(next => { const copy = new URLSearchParams(next); change(copy); return copy; },
            { replace: !first, preventScrollReset: true, state: { drawers: first || current.drawers, pane } });
    };
    /** Opens a thing on the right; who was behind the last one closes, unless the thing was opened from there (`keepSide`). */
    const open = (value: string, { keepSide = false, focus = false } = {}) => {
        paneFocus = place === 'pane' && focus ? value : null;
        write(next => { if (next.get(PEEK) !== value) next.delete(PART); next.set(PEEK, value); if (!keepSide) next.delete(SIDE); }, place === 'pane');
    };
    /** Who is behind the thing: stacked in the pane when the thing is there, else the left drawer. */
    const openSide = (value: string) => write(next => next.set(SIDE, value), place === 'pane');
    const closeSide = () => setParams(next => { const copy = new URLSearchParams(next); copy.delete(SIDE); return copy; },
        { replace: true, preventScrollReset: true, state: location.state });
    const closeAll = () => {
        if (current.drawers) {
            // Going back keeps the page where it is (the browser would put back the scroll of the entry it returns to).
            const restoring = history.scrollRestoration;
            history.scrollRestoration = 'manual';
            window.addEventListener('popstate', () => setTimeout(() => { history.scrollRestoration = restoring; }, 0), { once: true });
            navigate(-1);
        } else setParams(next => { const copy = new URLSearchParams(next); DRAWER_PARAMS.forEach(key => copy.delete(key)); return copy; }, { replace: true, preventScrollReset: true });
    };
    return { right, left, open, openSide, closeSide, closeAll, value: params.get(PEEK) || undefined };
}

/**
 * Which part of a thing shows (a club's Teams & training, its Matches; none is its overview), and how to show another.
 * The thing on the right keeps it in the address, so a shared link and Back from its full page return to the same part;
 * who is stacked over it (or in the left drawer) keeps its own while it shows.
 */
export function usePeekPart(): [string | undefined, (part?: string) => void] {
    const [params, setParams] = useSearchParams();
    const location = useLocation();
    const { side } = useDrawerPlace();
    const [own, setOwn] = useState<string>();
    if (side === 'left') return [own, setOwn];
    const show = (part?: string) => setParams(next => { const copy = new URLSearchParams(next); if (part) copy.set(PART, part); else copy.delete(PART); return copy; },
        { replace: true, preventScrollReset: true, state: location.state });
    return [params.get(PART) || undefined, show];
}

/**
 * Whether the open thing shows in the pane beside the list: it was pressed there (its history entry says so), the list
 * column is on screen, and the screen is wide enough for both. Otherwise it is a drawer; the two never show at once.
 */
export function usePaneShown() {
    const [params] = useSearchParams();
    const location = useLocation();
    const { paneHost } = useStage();
    const wide = useMediaQuery(WIDE, true);
    return Boolean(stateOf(location.state).pane && paneHost && wide && params.get(PEEK));
}

/**
 * How a thing shown in the pane or a drawer opens what it relates to (a club's coach, a person's club, a club's match):
 * in the pane it stacks over the thing, with a way back; from the drawer on the right it opens on the left beside it;
 * from the left one it opens on the right, the left one kept. Opening the thing everything was opened from goes back to
 * it rather than stacking it over itself.
 */
export function useRelatedOpen() {
    const drawers = usePeek();
    const { place, side } = useDrawerPlace();
    return (value: string, options?: { focus?: boolean }) => {
        if (value === drawers.value) drawers.closeSide();
        else if (place === 'pane' || side === 'right') drawers.openSide(value);
        else drawers.open(value, { ...options, keepSide: true });
    };
}
