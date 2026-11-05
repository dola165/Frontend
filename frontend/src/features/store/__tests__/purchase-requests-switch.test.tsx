import type { ImgHTMLAttributes } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreCartPage } from '../../../pages/StoreCartPage';
import { StorePage } from '../../../pages/StorePage';
import { StoreProductsPage } from '../../clubWorkspace/commerce/StoreProductsPage';
import { saveCart } from '../cart';
import * as api from '../api';
import { fetchOrders } from '../orders/api';

// Release 17 holds purchase requests back: the server lists `store.purchase-requests` only while its switch is on.
const door = { id: 'store.purchase-requests', context: { type: 'user', id: 2, label: 'My requests' } };
const auth = vi.hoisted(() => ({ status: 'authenticated', sessionId: 'switch-session', user: { id: 2, navigationCapabilities: { version: 1, workspaces: [] as unknown[] } } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../api', async original => ({ ...await original<typeof import('../api')>(), fetchCartQuote: vi.fn(), fetchStoreProduct: vi.fn(), fetchStoreFront: vi.fn(), fetchStoreCatalog: vi.fn(), fetchStoreLocations: vi.fn(), fetchAllClubStoreProducts: vi.fn() }));
vi.mock('../orders/api', () => ({ requestPurchase: vi.fn(), commandOrder: vi.fn(), fetchOrders: vi.fn(), fetchOrder: vi.fn(), renewOrder: vi.fn() }));
vi.mock('../platform/api', () => ({ fetchPlatformAccess: vi.fn(async () => ({ canManage: false })) }));
vi.mock('../../../api/axiosConfig', () => ({ DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost:8080' }, apiClient: { get: vi.fn(async () => ({ data: [] })) } }));
vi.mock('../../../components/ui/MediaImage', () => ({ MediaImage: (props: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} /> }));

const quote: api.CartQuote = { clubId: 10, clubName: 'Alpha FC', currency: 'GEL', subtotal: 2468, checkoutEnabled: false, message: '',
    lines: [{ variantId: 7, productId: 1, productVersion: 3, materialDigest: 'a'.repeat(64), name: 'Home shirt', variant: 'M', quantity: 2, unitAmount: 1234, lineAmount: 2468 }] };
beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
    auth.status = 'authenticated'; auth.user.navigationCapabilities.workspaces = [];
    localStorage.setItem('gk-session-id', auth.sessionId); localStorage.setItem('userId', '2');
    saveCart([{ productId: 1, variantId: 7, quantity: 2, name: 'Home shirt', variant: 'M', clubId: 10, currency: 'GEL' }]);
    vi.mocked(api.fetchCartQuote).mockResolvedValue(quote);
    vi.mocked(api.fetchStoreProduct).mockResolvedValue({ id: 1, clubId: 10, name: 'Home shirt', price: 12.34, images: [], active: true, currency: 'GEL' });
    vi.mocked(api.fetchStoreLocations).mockResolvedValue([]);
    vi.mocked(api.fetchStoreFront).mockResolvedValue({ city: null, collections: [], near: [], followed: [], sellers: 0, own: 0 });
    vi.mocked(api.fetchStoreCatalog).mockResolvedValue({ content: [], totalElements: 0 });
    vi.mocked(api.fetchAllClubStoreProducts).mockResolvedValue([]);
    vi.mocked(fetchOrders).mockResolvedValue([]);
});

function Where() { const location = useLocation(); return <output aria-label="Address">{location.pathname + location.search}</output>; }
const cart = (address = '/store/cart') => render(<MemoryRouter initialEntries={[address]}><Routes><Route path="/store/cart" element={<><StoreCartPage /><Where /></>} /></Routes></MemoryRouter>);
const storefront = () => render(<MemoryRouter initialEntries={['/store']}><Routes><Route path="/store" element={<StorePage />} /></Routes></MemoryRouter>);
const sellerTool = () => render(<MemoryRouter initialEntries={['/clubs/10/office?tab=tools&tool=store&storeRequests=1']}><StoreProductsPage clubId={10} /></MemoryRouter>);

describe('Purchase requests switched off (release 17 default)', () => {
    it('the cart offers no request and keeps checkout unavailable, as before purchase requests', async () => {
        cart();
        expect(await screen.findByText('Subtotal')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Checkout unavailable' })).toBeDisabled();
        expect(screen.getByText(/does not reserve this stock, place an order or take payment yet/)).toHaveTextContent('Contact Alpha FC to buy directly.');
        expect(screen.getByRole('link', { name: 'Contact Alpha FC' })).toHaveAttribute('href', '/clubs/10?tab=contact');
        expect(screen.queryByRole('form', { name: 'Purchase request' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'My requests' })).not.toBeInTheDocument();
    });
    it('a My requests link lands on the cart and asks for no requests', async () => {
        cart('/store/cart?view=requests');
        expect(await screen.findByRole('heading', { name: 'Your cart' })).toBeInTheDocument();
        expect(screen.getByRole('status', { name: 'Address' })).toHaveTextContent(/^\/store\/cart$/);
        expect(fetchOrders).not.toHaveBeenCalled();
    });
    it('the storefront and the club store tool show no request door', async () => {
        storefront();
        expect(await screen.findByRole('link', { name: 'Shop GrassKickZ equipment' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'My requests' })).not.toBeInTheDocument();
        sellerTool();
        expect(await screen.findByText('Supporters can browse products and prepare a cart. Online checkout is not available yet.')).toBeInTheDocument();
        expect(screen.queryByText('Purchase requests')).not.toBeInTheDocument();
        expect(fetchOrders).not.toHaveBeenCalled();
    });
    it('waits for the session before moving a My requests link', () => {
        auth.status = 'bootstrapping';
        cart('/store/cart?view=requests');
        expect(screen.getByRole('status', { name: 'Address' })).toHaveTextContent('/store/cart?view=requests');
    });
});

describe('Purchase requests switched on', () => {
    beforeEach(() => { auth.user.navigationCapabilities.workspaces = [door]; });
    it('the cart offers the request and My requests', async () => {
        cart();
        expect(await screen.findByRole('button', { name: 'Request purchase' })).toBeEnabled();
        expect(screen.getByRole('link', { name: 'My requests' })).toHaveAttribute('href', '/store/cart?view=requests');
        expect(screen.queryByRole('button', { name: 'Checkout unavailable' })).not.toBeInTheDocument();
    });
    it('My requests opens the person’s requests', async () => {
        cart('/store/cart?view=requests');
        expect(await screen.findByRole('heading', { name: 'My requests', level: 1 })).toBeInTheDocument();
        await waitFor(() => expect(fetchOrders).toHaveBeenCalledWith(undefined, expect.any(AbortSignal), 0));
    });
    it('the storefront and the club store tool show their doors', async () => {
        storefront();
        expect(await screen.findByRole('link', { name: 'My requests' })).toHaveAttribute('href', '/store/cart?view=requests');
        sellerTool();
        expect(await screen.findByText('Purchase requests', { selector: 'summary' })).toBeInTheDocument();
        await waitFor(() => expect(fetchOrders).toHaveBeenCalledWith(10, expect.any(AbortSignal), 0));
    });
});
