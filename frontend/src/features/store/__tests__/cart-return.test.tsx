import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { StoreCartPage } from '../../../pages/StoreCartPage';
import { saveCart } from '../cart';
import { fetchCartQuote, fetchStoreProduct, type CartQuote } from '../api';
import { commandOrder, fetchOrders, requestPurchase, type StoreOrder } from '../orders/api';

const auth = vi.hoisted(() => ({ status: 'authenticated', sessionId: '' }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../api', async original => ({ ...await original<typeof import('../api')>(), fetchCartQuote: vi.fn(), fetchStoreProduct: vi.fn() }));
vi.mock('../orders/api', () => ({ requestPurchase: vi.fn(), commandOrder: vi.fn(), fetchOrders: vi.fn(), fetchOrder: vi.fn(), renewOrder: vi.fn() }));
const material = { description: 'Reviewed item', images: [], sizes: ['M'], category: 'SHIRT', collection: null, sellerArrangement: null };
const quote: CartQuote = { clubId: 10, clubName: 'Actual club seller', currency: 'GEL', subtotal: 2468, checkoutEnabled: false, message: '', lines: [{ variantId: 7, productId: 1, productVersion: 3, materialDigest: 'a'.repeat(64), material, name: 'Actual shirt', variant: 'M', quantity: 2, unitAmount: 1234, lineAmount: 2468 }] };
const saved: StoreOrder = { id: 'order-1', buyerId: 2, clubId: 10, sellerName: 'Actual club seller', currency: 'GEL', total: 24.68, fulfillment: 'COLLECTION', buyerContact: 'chosen contact', buyerNote: 'My note', sellerAnswer: '', status: 'REQUESTED', settlement: 'UNREPORTED', version: 0, createdAt: '2026-10-30T12:00:00Z', updatedAt: '2026-10-30T12:00:00Z', lines: [{ productId: 1, variantId: 7, originalVariantId: 7, productVersion: 3, name: 'Actual shirt', variant: 'M', quantity: 2, unitPrice: 12.34, material, materialDigest: 'a'.repeat(64) }], history: [] };
let records: StoreOrder[];
beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear(); auth.sessionId = crypto.randomUUID();
    localStorage.setItem('gk-session-id', auth.sessionId); localStorage.setItem('userId', '2'); records = [];
    saveCart([{ productId: 1, variantId: 7, quantity: 2, name: 'Actual shirt', variant: 'M', clubId: 10, currency: 'GEL' }]);
    vi.mocked(fetchCartQuote).mockResolvedValue(quote);
    vi.mocked(fetchStoreProduct).mockResolvedValue({ id: 1, clubId: 10, name: 'Actual shirt', price: 12.34, images: [], active: true, currency: 'GEL' });
    vi.mocked(requestPurchase).mockImplementation(async () => { records = [{ ...saved }]; return records[0]; });
    vi.mocked(fetchOrders).mockImplementation(async () => [...records]);
    vi.mocked(commandOrder).mockImplementation(async (_id, command) => { records = [{ ...records[0], status: command.action === 'CANCEL' ? 'CANCELLED' : records[0].status, version: 1 }]; return records[0]; });
});
const mount = () => render(<MemoryRouter initialEntries={['/store/cart']}><Routes><Route path="/store/cart" element={<StoreCartPage />} /></Routes></MemoryRouter>);
const enter = async () => {
    await screen.findByRole('button', { name: 'Request purchase' });
    fireEvent.change(screen.getByLabelText('Your contact for this request'), { target: { value: 'chosen contact' } });
    fireEvent.change(screen.getByLabelText('Message (optional)'), { target: { value: 'My note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Request purchase' }));
};

it('save → My requests → cancel → Back to cart → fresh reviewed quote sends a new UUID in the same mounted page', async () => {
    mount(); await enter();
    fireEvent.click(await screen.findByRole('link', { name: 'Open My requests' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel and release any reservation' }));
    expect(await screen.findByText(/cancelled · collection/)).toBeInTheDocument();
    expect(commandOrder).toHaveBeenCalledWith(saved.id, expect.objectContaining({ action: 'CANCEL' }), auth.sessionId);
    fireEvent.click(screen.getByRole('link', { name: 'Back to cart' }));
    expect(await screen.findByRole('heading', { name: 'Your cart' })).toBeInTheDocument();
    const choice = await screen.findByRole('button', { name: 'Review current quote for another purchase' });
    expect(screen.queryByRole('form', { name: 'Purchase request' })).not.toBeInTheDocument();
    let loaded!: (value: CartQuote) => void;
    vi.mocked(fetchCartQuote).mockImplementationOnce(() => new Promise(resolve => { loaded = resolve; }));
    fireEvent.click(choice);
    await waitFor(() => expect(fetchCartQuote).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('button', { name: 'Request purchase' })).not.toBeInTheDocument();
    await act(async () => loaded({ ...quote, subtotal: 4000, lines: [{ ...quote.lines[0], unitAmount: 2000, lineAmount: 4000, productVersion: 4, materialDigest: 'b'.repeat(64) }] }));
    expect(screen.getByLabelText('Your contact for this request')).toHaveValue('chosen contact');
    expect(screen.getByLabelText('Message (optional)')).toHaveValue('My note');
    fireEvent.click(screen.getByRole('button', { name: 'Request purchase' }));
    await waitFor(() => expect(requestPurchase).toHaveBeenCalledTimes(2));
    const [first, next] = vi.mocked(requestPurchase).mock.calls.map(call => call[0]);
    expect(next.requestId).not.toBe(first.requestId);
    expect(next).toMatchObject({ contact: 'chosen contact', note: 'My note', lines: [{ variantId: 7, quantity: 2, productVersion: 4, unitPrice: 20, materialDigest: 'b'.repeat(64) }] });
});

it('an uncertain attempt across My requests and Back to cart keeps its original UUID/body and offers no fresh-purchase shortcut', async () => {
    vi.mocked(requestPurchase).mockRejectedValueOnce({ response: { status: 503 } });
    mount(); await enter();
    await screen.findByRole('button', { name: 'Retry same request' });
    fireEvent.click(screen.getByRole('link', { name: 'My requests' }));
    expect(await screen.findByText('No purchase requests yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Back to cart' }));
    const retry = await screen.findByRole('button', { name: 'Retry same request' });
    expect(screen.getByLabelText('Your contact for this request')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Review current quote for another purchase' })).not.toBeInTheDocument();
    fireEvent.click(retry);
    await waitFor(() => expect(requestPurchase).toHaveBeenCalledTimes(2));
    expect(vi.mocked(requestPurchase).mock.calls[0]).toEqual(vi.mocked(requestPurchase).mock.calls[1]);
});
