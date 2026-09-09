import { apiClient } from '../../api/axiosConfig';

// ── Club store (WEB_APP_MASTER_PLAN.md §4.1, Phase 3) ──
// Shared catalog and stock. Checkout is unavailable until a provider is integrated.

export type StoreProductCategory =
    | 'SHIRT'
    | 'FOOTWEAR'
    | 'TRAINING'
    | 'EQUIPMENT'
    | 'ACCESSORIES'
    | 'TICKETS'
    | 'MEMBERSHIP'
    | 'EVENT'
    | 'OTHER';

export const STORE_CATEGORIES: StoreProductCategory[] = [
    'SHIRT', 'FOOTWEAR', 'TRAINING', 'EQUIPMENT', 'ACCESSORIES', 'TICKETS', 'MEMBERSHIP', 'EVENT', 'OTHER'
];

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

export const fetchStoreCatalogPage = async (page: number, size: number, clubId?: number) => {
    const response = await apiClient.get<{ content: StoreProduct[]; totalElements: number }>('/store/products', {
        params: { page, size, clubId },
    });
    return response.data;
};

/** Aggregates the whole active catalog (loops pages of 50; the demo catalog is small). */
export const fetchAllStoreCatalog = async () => {
    const all: StoreProduct[] = [];
    const size = 50;
    for (let page = 0; page < 20; page++) {
        const data = await fetchStoreCatalogPage(page, size);
        all.push(...(data.content ?? []));
        if (all.length >= data.totalElements) break;
    }
    return all;
};

export const fetchClubStoreProducts = async (clubId: number) => {
    const response = await apiClient.get<StoreProduct[]>(`/clubs/${clubId}/store/products`);
    return response.data;
};

export const fetchAllClubStoreProducts = async (clubId: number) => {
    const response = await apiClient.get<StoreProduct[]>(`/clubs/${clubId}/store/products/all`);
    return response.data;
};

export const createStoreProduct = async (clubId: number, payload: StoreProductPayload) => {
    const response = await apiClient.post<StoreProduct>(`/clubs/${clubId}/store/products`, payload);
    return response.data;
};

export const updateStoreProduct = async (clubId: number, productId: number, payload: StoreProductPayload) => {
    const response = await apiClient.patch<StoreProduct>(`/clubs/${clubId}/store/products/${productId}`, payload);
    return response.data;
};

export const deleteStoreProduct = async (clubId: number, productId: number) => {
    await apiClient.delete(`/clubs/${clubId}/store/products/${productId}`);
};

export interface StoreCatalogParams { page?: number; size?: number; clubId?: number; query?: string; category?: string; currency?: string; country?: string; city?: string; variant?: string; minPrice?: number; maxPrice?: number; sort?: string; }
export const fetchStoreCatalog = async (params: StoreCatalogParams, signal?: AbortSignal) =>
    (await apiClient.get<{content: StoreProduct[]; totalElements: number}>('/store/products', {params,signal})).data;
export const fetchStoreProduct = async (id: number, signal?: AbortSignal) =>
    (await apiClient.get<StoreProduct>(`/store/products/${id}`, {signal})).data;
export interface CartQuote { clubId: number; clubName: string; currency: string; lines: Array<{variantId:number;quantity:number;productId:number;name:string;variant:string;unitAmount:number;lineAmount:number}>; subtotal: number; checkoutEnabled: boolean; message: string; }
export const fetchCartQuote = async (items: Array<{variantId:number;quantity:number}>, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    items.forEach(item=>params.append('item',`${item.variantId}:${item.quantity}`));
    return (await apiClient.get<CartQuote>(`/store/cart/quote?${params}`,{signal})).data;
};
export const formatStorePrice = (price: number, currency = 'GEL') => new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(price);
