import { apiClient } from '../../api/axiosConfig';

// ── Club store (WEB_APP_MASTER_PLAN.md §4.1, Phase 3) ──
// Catalog-only: no payments. The order CTA opens the club's contact channels
// carried on the product DTO (clubWhatsappNumber / clubEmail).

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

export interface StoreProductPayload {
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
