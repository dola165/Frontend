import type { AuthSessionId } from '../../utils/authStorage';

/** Home follows the existing Inbox count refresh. It adds no timer or second polling rhythm. */
export const homeInboxRead = 'home-inbox-read';
export function announceHomeInboxRead(session: AuthSessionId) {
    window.dispatchEvent(new CustomEvent(homeInboxRead, { detail: { session } }));
}
