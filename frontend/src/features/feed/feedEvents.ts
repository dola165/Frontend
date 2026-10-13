import { apiClient } from '../../api/axiosConfig';

/**
 * What a person does with the feed, recorded for the learning algorithm that comes later: what they saw, opened, hid
 * and asked less of. Follows are recorded by the server itself. Sent in small batches, best effort: a lost event
 * never changes what the person sees. Backend needed: POST /feed/events (BACKEND_NEEDS.md, "Sign-in and the start").
 */
export type FeedEventType = 'SEEN' | 'OPENED' | 'HIDDEN' | 'LESS' | 'UNDO_LESS';
interface FeedEvent { postId: number; type: FeedEventType; at: string }

const queue: FeedEvent[] = [];
const seen = new Set<number>();
let timer: number | null = null;
let listening = false;

export function recordFeedEvent(postId: number, type: FeedEventType) {
    if (type === 'SEEN') {
        if (seen.has(postId)) return;
        seen.add(postId);
    }
    queue.push({ postId, type, at: new Date().toISOString() });
    if (type === 'SEEN') schedule(); else void flushFeedEvents();
}

function schedule() {
    if (!listening && typeof document !== 'undefined') {
        listening = true;
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void flushFeedEvents(); });
        window.addEventListener('gk-auth-changed', () => { seen.clear(); queue.length = 0; });
    }
    if (timer !== null) return;
    timer = window.setTimeout(() => { timer = null; void flushFeedEvents(); }, 4000);
}

export async function flushFeedEvents() {
    if (!queue.length) return;
    const events = queue.splice(0, 100);
    try { await apiClient.post('/feed/events', { events }); } catch { /* best effort */ }
}
