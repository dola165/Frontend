import { getAuthSessionId, getStoredUserId } from '../../../utils/authStorage';
import type { CartQuote } from '../api';

/** Existing sign-out cleanup already clears this Store marker namespace. No private body is persisted. */
export const purchaseMarkerKey = (quote: CartQuote) => `gk-store-change:purchase:${getAuthSessionId() ?? 'legacy'}:${getStoredUserId() ?? 'guest'}:${quote.clubId}:${quote.lines.map(line => `${line.variantId}:${line.quantity}`).sort().join(',')}`;
export const readPurchaseMarker = (key: string) => {
    try { return sessionStorage.getItem(key); }
    catch { return null; }
};
