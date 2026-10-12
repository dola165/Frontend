import type { MouseEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { DRAWER_KINDS } from './kinds';

/** The address parameters of World's drawers: the thing itself on the right, who is behind it on the left. */
export const PEEK = 'peek';
export const SIDE = 'side';
/** A drawer's value (`person-12`) as its kind and id, when it is one World can show. */
export const parsePeek = (value?: string | null) => {
    const at = value ? value.indexOf('-') : -1;
    const kind = at > 0 ? value!.slice(0, at) : undefined, id = at > 0 ? value!.slice(at + 1) : undefined;
    return kind && id && (DRAWER_KINDS as readonly string[]).includes(kind) ? { kind, id } : null;
};
/** The drawer of one thing, as the address names it (`person-12`). */
export const peekOf = (kind: string, id: number | string) => `${kind}-${id}`;

/** A link's click handler: a plain click opens the drawer; with a modifier (new tab, new window) the link goes to the full page. */
export const peekClick = (peek: string | undefined, open: (value: string) => void) => (event: MouseEvent) => {
    if (!peek || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    open(peek);
};

interface DrawerState { /** This visit added one history entry for the drawers, so closing them goes back over it. */ drawers?: boolean }

/**
 * World's drawers, kept in the address so a shared link opens them. The first drawer to open adds one history entry;
 * everything after (another thing, who is behind it, closing just the left one) replaces it. So Back, or a click
 * between the drawers, closes them all in one step and returns to the list where it was.
 */
export function usePeek() {
    const [params, setParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const pushed = Boolean((location.state as DrawerState | null)?.drawers);
    const right = parsePeek(params.get(PEEK)), left = parsePeek(params.get(SIDE));
    const write = (change: (next: URLSearchParams) => void) => {
        const first = !right && !left;
        setParams(current => { const next = new URLSearchParams(current); change(next); return next; },
            { replace: !first, preventScrollReset: true, state: first ? { drawers: true } : location.state });
    };
    /** Opens a thing on the right; who was behind the last one closes, unless the thing was opened from there (`keepSide`). */
    const open = (value: string, { keepSide = false } = {}) => write(next => { next.set(PEEK, value); if (!keepSide) next.delete(SIDE); });
    const openSide = (value: string) => write(next => next.set(SIDE, value));
    const closeSide = () => setParams(current => { const next = new URLSearchParams(current); next.delete(SIDE); return next; },
        { replace: true, preventScrollReset: true, state: location.state });
    const closeAll = () => {
        if (pushed) {
            // Going back keeps the page where it is (the browser would put back the scroll of the entry it returns to).
            const restoring = history.scrollRestoration;
            history.scrollRestoration = 'manual';
            window.addEventListener('popstate', () => setTimeout(() => { history.scrollRestoration = restoring; }, 0), { once: true });
            navigate(-1);
        } else setParams(current => { const next = new URLSearchParams(current); next.delete(PEEK); next.delete(SIDE); return next; }, { replace: true, preventScrollReset: true });
    };
    return { right, left, open, openSide, closeSide, closeAll, value: params.get(PEEK) || undefined };
}
