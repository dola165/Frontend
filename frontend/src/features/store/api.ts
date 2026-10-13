import { formatMoney } from '../../utils/formatting';
import { apiClient } from '../../api/axiosConfig';

// ── Store: GrassKickZ's own equipment and the clubs' stores ──
// One catalogue (`/store/products`) with two kinds of seller. Checkout waits for a payment provider.

export type StoreProductCategory = 'SHIRT' | 'FOOTWEAR' | 'TRAINING' | 'EQUIPMENT' | 'ACCESSORIES' | 'TICKETS' | 'MEMBERSHIP' | 'EVENT' | 'OTHER';
export const STORE_CATEGORIES: StoreProductCategory[] = ['SHIRT', 'FOOTWEAR', 'TRAINING', 'EQUIPMENT', 'ACCESSORIES', 'TICKETS', 'MEMBERSHIP', 'EVENT', 'OTHER'];

/** What groups GrassKickZ's own equipment on the storefront. Backend field to add (BACKEND_NEEDS.md, "Store"). */
export type StoreCollection = 'BALLS' | 'CONES' | 'BIBS' | 'SHIN_GUARDS' | 'GLOVES' | 'GOALS' | 'TRAINING_WEAR' | 'ACCESSORIES';
/** Who sells a product: GrassKickZ itself (no club behind it) or a club. Backend field to add. */
export type StoreSellerKind = 'GRASSKICKZ' | 'CLUB';
export type StoreSort = 'RELEVANCE' | 'NEWEST' | 'PRICE_LOW' | 'PRICE_HIGH';

export interface StoreProduct {
    id: number;
    currency?: string;
    version?: number;
    variants?: StoreVariant[];
    clubId?: number | null;
    clubName?: string | null;
    clubLogoUrl?: string | null;
    clubWhatsappNumber?: string | null;
    clubEmail?: string | null;
    sellerKind?: StoreSellerKind | null;
    collection?: StoreCollection | null;
    name?: string | null;
    description?: string | null;
    price?: number | null;
    sizes?: string[] | null;
    images?: string[] | null;
    active?: boolean | null;
    createdAt?: string | null;
    category?: StoreProductCategory | null;
    clubCityName?: string | null;
    clubCountryName?: string | null;
}
export interface StoreVariant { id?: number; label: string; stock: number; }

export interface StoreProductPayload {
    currency?: string;
    variants?: StoreVariant[];
    version?: number;
    name?: string;
    description?: string | null;
    price?: number;
    sizes?: string[];
    images?: string[];
    active?: boolean;
    category?: StoreProductCategory;
}

export const GRASSKICKZ = 'GrassKickZ';
/** Who sells it; products the backend serves today carry no `sellerKind`, and every one of those is a club's. */
export const sellerOf = (product: Pick<StoreProduct, 'sellerKind' | 'clubId'>): StoreSellerKind => product.sellerKind ?? (product.clubId ? 'CLUB' : 'GRASSKICKZ');
export const sellerName = (product: StoreProduct) => sellerOf(product) === 'GRASSKICKZ' ? GRASSKICKZ : product.clubName ?? 'Club';
export const totalStock = (product: StoreProduct) => product.variants?.reduce((sum, variant) => sum + Math.max(0, variant.stock), 0) ?? 0;
/** Honest availability from the variants' stock: in stock, running low, or gone. */
export const availability = (product: StoreProduct): { tone: 'in' | 'low' | 'out'; label: string } => {
    const stock = totalStock(product);
    return stock === 0 ? { tone: 'out', label: 'Out of stock' } : stock <= 5 ? { tone: 'low', label: `Only ${stock} left` } : { tone: 'in', label: 'In stock' };
};

export interface StoreCatalogParams {
    page?: number; size?: number; clubId?: number; seller?: 'grasskickz' | 'clubs'; query?: string; category?: string; collection?: string;
    currency?: string; country?: string; city?: string; variant?: string; minPrice?: number; maxPrice?: number; sort?: StoreSort;
    /** The city relevance favours (the storefront's area). */ near?: string;
}
export interface StorePage<T> { content: T[]; totalElements: number }
export const fetchStoreCatalog = async (params: StoreCatalogParams, signal?: AbortSignal) =>
    (await apiClient.get<StorePage<StoreProduct>>('/store/products', { params, signal })).data;
export const fetchStoreProduct = async (id: number, signal?: AbortSignal) =>
    (await apiClient.get<StoreProduct>(`/store/products/${id}`, { signal })).data;

/** A club with something on sale, as the storefront shows it. */
export interface StoreSeller { clubId: number; name: string; logoUrl: string | null; city: string | null; products: number; distanceKm: number | null; followed: boolean }
export interface StoreFront {
    /** The city the storefront is centred on; null when none is known. */
    city: string | null;
    /** GrassKickZ's own equipment, grouped. */
    collections: Array<{ id: StoreCollection; products: number; image: string | null }>;
    /** Sellers nearest the city, nearest first, and the ones the person follows. */
    near: StoreSeller[]; followed: StoreSeller[];
    /** How many clubs sell something, and how many products GrassKickZ sells itself. */
    sellers: number; own: number;
}
// Backend needed: GET /store/front?near=City (BACKEND_NEEDS.md, "Store").
export const fetchStoreFront = async (near: string | undefined, signal?: AbortSignal) =>
    (await apiClient.get<StoreFront>('/store/front', { params: { near }, signal })).data;

export interface StoreLocation { country: string; city: string | null; }
export const fetchStoreLocations = async (clubId?: number, signal?: AbortSignal): Promise<StoreLocation[]> =>
    (await apiClient.get<StoreLocation[]>('/store/locations', { params: { clubId }, signal })).data;

export interface CartQuote { clubId: number; clubName: string; sellerKind?: StoreSellerKind | null; currency: string; lines: Array<{ variantId: number; quantity: number; productId: number; name: string; variant: string; unitAmount: number; lineAmount: number }>; subtotal: number; checkoutEnabled: boolean; message: string; }
export const fetchCartQuote = async (items: Array<{ variantId: number; quantity: number }>, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    items.forEach(item => params.append('item', `${item.variantId}:${item.quantity}`));
    return (await apiClient.get<CartQuote>(`/store/cart/quote?${params}`, { signal })).data;
};
export const formatStorePrice = formatMoney;

/** The little a store needs to know about a club: its name, crest, city and whether the viewer runs it. */
export interface StoreClub { id: number; name: string; logoUrl?: string | null; cityName?: string | null; myRole?: string | null; isStaffMember?: boolean | null }
export const fetchStoreClub = async (clubId: number, signal?: AbortSignal) => (await apiClient.get<StoreClub>(`/clubs/${clubId}`, { signal })).data;

// ── A club's own products (the workspace and "Add a product" on its store) ──
export const fetchAllClubStoreProducts = async (clubId: number) => (await apiClient.get<StoreProduct[]>(`/clubs/${clubId}/store/products/all`)).data;
export const createStoreProduct = async (clubId: number, payload: StoreProductPayload) => (await apiClient.post<StoreProduct>(`/clubs/${clubId}/store/products`, payload)).data;
export const updateStoreProduct = async (clubId: number, productId: number, payload: StoreProductPayload) => (await apiClient.patch<StoreProduct>(`/clubs/${clubId}/store/products/${productId}`, payload)).data;
export const deleteStoreProduct = async (clubId: number, productId: number, version: number | undefined) => { await apiClient.delete(`/clubs/${clubId}/store/products/${productId}`, { params: { version } }); };
