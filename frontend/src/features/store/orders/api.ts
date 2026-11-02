import { apiClient, type AuthSessionRequestConfig } from '../../../api/axiosConfig';
import type { AuthSessionId } from '../../../utils/authStorage';

export type OrderAction = 'ACCEPT' | 'DECLINE' | 'CANCEL' | 'FULFILL' | 'REPORT_EXTERNAL_SETTLEMENT';
export interface Material { description: string | null; images: string[]; sizes: string[]; category: string | null; collection: string | null; sellerArrangement: string | null }
export interface Terms { currency: string; total: number; lines: OrderLine[] }
export interface OrderLine { productId: number; variantId: number | null; originalVariantId: number; productVersion: number; name: string; variant: string; quantity: number; unitPrice: number; material?: Material | null; materialDigest?: string | null }
export interface StoreOrder {
    id: string; buyerId: number; clubId: number | null; sellerName: string; currency: string; total: number;
    fulfillment: 'COLLECTION' | 'DELIVERY'; buyerContact: string; buyerNote: string; sellerAnswer: string;
    status: 'REQUESTED' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'FULFILLED'; settlement: 'UNREPORTED' | 'SELLER_REPORTED_EXTERNAL';
    version: number; createdAt: string; updatedAt: string; lines: OrderLine[];
    history: Array<{ actorId: number; action: string; note: string; version: number; createdAt: string; previousTerms?: Terms | null; terms?: Terms | null }>;
}
export interface PurchaseRequest {
    requestId: string; clubId: number | null; currency: string;
    lines: Array<{ variantId: number; quantity: number; productVersion: number; unitPrice: number; materialDigest: string }>;
    fulfillment: 'COLLECTION' | 'DELIVERY'; contact: string; note: string;
}
export interface Renewal { requestId: string; version: number; currency: string; lines: PurchaseRequest['lines'] }
export interface OrderCommand { requestId: string; version: number; action: OrderAction; note: string; externalAmount?: number; externalCurrency?: string }
export const requestPurchase = async (input: PurchaseRequest, sessionId: AuthSessionId) =>
    (await apiClient.post<StoreOrder>('/store/orders', input, { _authSessionId: sessionId } as AuthSessionRequestConfig)).data;
export const fetchOrders = async (seller: number | undefined, signal: AbortSignal, page = 0) =>
    (await apiClient.get<StoreOrder[]>(seller === undefined ? '/store/orders' : seller === 0 ? '/store/platform/orders' : `/clubs/${seller}/store/orders`, { signal, params: { page } })).data;
export const commandOrder = async (id: string, input: OrderCommand, sessionId: AuthSessionId) =>
    (await apiClient.post<StoreOrder>(`/store/orders/${id}/commands`, input, { _authSessionId: sessionId } as AuthSessionRequestConfig)).data;

export const fetchOrder = async (id: string, sessionId: AuthSessionId, signal?: AbortSignal) =>
    (await apiClient.get<StoreOrder>(`/store/orders/${id}`, { _authSessionId: sessionId, signal } as AuthSessionRequestConfig)).data;
export const renewOrder = async (id: string, input: Renewal, sessionId: AuthSessionId) =>
    (await apiClient.post<StoreOrder>(`/store/orders/${id}/renew`, input, { _authSessionId: sessionId } as AuthSessionRequestConfig)).data;
