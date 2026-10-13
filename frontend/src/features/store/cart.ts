import type { StoreSellerKind } from './api';

/** One line of the cart. GrassKickZ's own products carry `clubId` 0 and the seller kind says so. */
export interface CartItem { variantId: number; quantity: number; productId: number; name: string; variant: string; clubId: number; seller?: StoreSellerKind; currency: string; }
const key = 'gk.store.cart.v1';
/** Fired on this window when the cart changes, so the cart count in the storefront follows. */
const CHANGED = 'gk-cart';
export const readCart = (): CartItem[] => {
    try {
        const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
        if (!Array.isArray(value)) return [];
        return value.filter((item): item is CartItem => item && Number.isSafeInteger(item.variantId) && item.variantId > 0
            && Number.isSafeInteger(item.productId) && item.productId > 0 && Number.isSafeInteger(item.clubId) && item.clubId >= 0 && typeof item.name === 'string'
            && typeof item.variant === 'string' && ['GEL', 'EUR', 'GBP', 'USD'].includes(item.currency)
            && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99).slice(0, 25);
    } catch { return []; }
};
export const saveCart = (items: CartItem[]) => { localStorage.setItem(key, JSON.stringify(items)); window.dispatchEvent(new Event(CHANGED)); };
export const addCartItem = (item: CartItem) => {
    const items = readCart();
    if (items.some(existing => existing.clubId !== item.clubId || existing.currency !== item.currency)) throw new Error('Your cart has items from another seller or in another currency. Open the cart and clear it before starting a new order.');
    const existing = items.find(entry => entry.variantId === item.variantId);
    if (existing) {
        if (existing.quantity + item.quantity > 99) throw new Error('A cart line can hold at most 99 items.');
        existing.quantity += item.quantity;
    } else {
        if (items.length >= 25) throw new Error('The cart can hold at most 25 lines.');
        items.push(item);
    }
    saveCart(items);
};
