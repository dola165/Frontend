/**
 * "Show deleted": whether search also looks in the person's chats in Recently deleted. Off unless they turn it on;
 * remembered for this tab's session and only for the person who turned it on.
 */
const KEY = 'tw-search-deleted';

export function showsDeleted(user: number | null): boolean {
    try { return user != null && window.sessionStorage.getItem(KEY) === String(user); } catch { return false; }
}

export function keepShowDeleted(user: number | null, on: boolean) {
    try {
        if (on && user != null) window.sessionStorage.setItem(KEY, String(user));
        else window.sessionStorage.removeItem(KEY);
    } catch { /* no storage: it stays on until the box closes */ }
}
