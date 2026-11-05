import { SELECTED } from './useDirectoryState';

/** History state of a link that chooses one World result: the map flies to it each time the link is followed. */
export interface ChoiceState { choose: string }

/** The result a link asked to show, when the visit came from such a link. */
export const askedChoice = (state: unknown) => {
    const choose = (state as Partial<ChoiceState> | null)?.choose;
    return typeof choose === 'string' && choose ? choose : undefined;
};

/**
 * How to follow a link that chooses one World result (`/world?tab=clubs&city=Tbilisi&selected=12`, as Dola gives).
 * From that same list it keeps the search and filters on screen and changes only the choice, so the map stays as it is
 * and flies to the result; from anywhere else the link opens as it is. Either way the map flies to the result, even
 * when it is already the chosen one. Any other link is followed as it is.
 */
export function followChoice(webPath: string, here: { pathname: string; search: string }): { to: string; state?: ChoiceState } {
    const at = webPath.indexOf('?');
    const path = at < 0 ? webPath : webPath.slice(0, at);
    const link = new URLSearchParams(at < 0 ? '' : webPath.slice(at + 1));
    const chosen = link.get(SELECTED);
    if (!chosen) return { to: webPath };
    const state = { choose: chosen };
    const current = new URLSearchParams(here.search);
    // The same list: the same page on the same tab (an address naming no tab shows the page's first).
    const tab = link.get('tab');
    if (path !== here.pathname || (current.get('tab') ?? tab) !== tab) return { to: webPath, state };
    current.set(SELECTED, chosen);
    return { to: `${path}?${current}`, state };
}
