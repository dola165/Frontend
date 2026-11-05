import { getAuthSessionId, getStoredUserId } from '../../utils/authStorage';

export type FeedCursor = { cursor: number; cursorTime?: string; cursorTier?: number };
export type FeedPlace = { starts: (FeedCursor | null)[]; page: number; y: number };
const places = new Map<string, FeedPlace>();
let owner = '';
const key = (view: string) => {
    const current = `${getAuthSessionId()}:${getStoredUserId()}`;
    if (owner !== current) { places.clear(); owner = current; }
    return `${current}:${view}`;
};
// Cursor/position only: returning always reads the current audience and source state.
export const readFeedPlace = (view: string) => getAuthSessionId() && getStoredUserId() ? places.get(key(view)) : undefined;
export const saveFeedPlace = (view: string, place: FeedPlace) => { if (getAuthSessionId() && getStoredUserId()) places.set(key(view), place); };
