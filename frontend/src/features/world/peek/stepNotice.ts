/**
 * What a step in a drawer just did ("Invitation accepted."). The drawer reads its thing (a match, a tournament) again
 * after it, which replaces the step, so the sentence is kept here, read once by the drawer's action as it mounts again,
 * then dropped.
 */
let notice: string | null = null;
export const noteDone = (text: string) => { notice = text; };
export const readNotice = () => notice;
export const clearNotice = () => { notice = null; };
/** Focuses the notice once, when it appears: a ref with one identity, so a re-render (a tick, a tab change) never pulls focus back. */
export const focusNotice = (node: HTMLElement | null) => { node?.focus({ preventScroll: true }); };
