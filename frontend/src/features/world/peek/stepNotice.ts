/**
 * What a step in a drawer just did ("Invitation accepted."). The drawer reads its thing (a match, a tournament) again
 * after it, which replaces the step, so the sentence is kept here, read once by the drawer's action as it mounts again,
 * then dropped.
 */
import { getAuthSessionId, isCurrentAuthSession, type AuthSessionId } from '../../../utils/authStorage';

let notice: { text: string; session: AuthSessionId; context?: string } | null = null;
export const noteDone = (text: string, session = getAuthSessionId(), context?: string) => { notice = { text, session, context }; };
export const readNotice = (context?: string) => notice && isCurrentAuthSession(notice.session)
    && (!notice.context || notice.context === context) ? notice.text : null;
export const clearNotice = () => { notice = null; };
/** Focuses the notice once, when it appears: a ref with one identity, so a re-render (a tick, a tab change) never pulls focus back. */
export const focusNotice = (node: HTMLElement | null) => { node?.focus({ preventScroll: true }); };
