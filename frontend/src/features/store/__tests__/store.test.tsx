vi.mock('../../paymentPreview/config', () => ({ paymentPreviewEnabled: () => false }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated' }) }));
import type { ImgHTMLAttributes } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorePage } from '../../../pages/StorePage';
import { ClubStorePage } from '../../../pages/ClubStorePage';
import { StoreCataloguePage } from '../../../pages/StoreCataloguePage';
import { StoreProductPage } from '../../../pages/StoreProductPage';
import { StoreCartPage } from '../../../pages/StoreCartPage';
import { StoreProductsPage } from '../../clubWorkspace/commerce/StoreProductsPage';
import { addCartItem, readCart, saveCart } from '../cart';
import { activeFilters, catalogueHeading, cataloguePath, catalogueSearch, readCatalogue } from '../query';
import * as api from '../api';
vi.mock('../api', async original => ({ ...await original<typeof import('../api')>(), deleteStoreProduct: vi.fn(), fetchStoreLocations: vi.fn(), fetchStoreProduct: vi.fn(), fetchStoreCatalog: vi.fn(), fetchStoreFront: vi.fn(), fetchStoreClub: vi.fn(), fetchAllClubStoreProducts: vi.fn(), updateStoreProduct: vi.fn(), fetchCartQuote: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost:8080' }, apiClient: { get: vi.fn(async () => ({ data: [] })) } }));
vi.mock('../../../components/ui/MediaImage', () => ({ MediaImage: (props: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} /> }));
const product: api.StoreProduct = { id: 1, clubId: 10, clubName: 'Alpha FC', name: 'Home shirt', price: 12.34, currency: 'GEL', version: 3, active: true, variants: [{ id: 7, label: 'M', stock: 5 }] };
const own: api.StoreProduct = { id: 2, clubId: null, clubName: 'GrassKickZ', sellerKind: 'GRASSKICKZ', collection: 'BALLS', name: 'Match ball', price: 85, currency: 'GEL', active: true, variants: [{ id: 21, label: 'Size 5', stock: 9 }] };
const item = { variantId: 7, quantity: 2, productId: 1, name: 'Home shirt', variant: 'M', clubId: 10, seller: 'CLUB' as const, currency: 'GEL' };
const catalogue = (content: api.StoreProduct[], totalElements = content.length) => ({ content, totalElements });
beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
    vi.mocked(api.fetchStoreLocations).mockResolvedValue([]);
    vi.mocked(api.fetchStoreClub).mockResolvedValue({ id: 10, name: 'Alpha FC', cityName: 'Tbilisi', myRole: null });
    vi.mocked(api.fetchStoreFront).mockResolvedValue({ city: 'Tbilisi', collections: [{ id: 'BALLS', products: 4, image: '/p/ball.svg' }], near: [{ clubId: 10, name: 'Alpha FC', logoUrl: null, city: 'Tbilisi', products: 3, distanceKm: 2.4, followed: false }], followed: [], sellers: 1, own: 4 });
    vi.mocked(api.fetchStoreCatalog).mockResolvedValue(catalogue([product, own]));
});

describe('The search in the address', () => {
    it('reads, writes and names a search', () => {
        const query = readCatalogue(new URLSearchParams('seller=grasskickz&collection=BALLS&minPrice=10&sort=PRICE_LOW&page=2&currency=EUR&bogus=1'));
        expect(query).toMatchObject({ seller: 'grasskickz', collection: 'BALLS', minPrice: '10', sort: 'PRICE_LOW', page: 2, currency: 'EUR', clubId: undefined });
        expect(catalogueSearch(query).toString()).toBe('collection=BALLS&seller=grasskickz&minPrice=10&currency=EUR&sort=PRICE_LOW&page=2');
        expect(catalogueHeading(query)).toEqual({ title: 'Balls', hint: 'GrassKickZ equipment' });
        expect(activeFilters(query, false).map(filter => filter.label)).toEqual(['Sold by GrassKickZ', 'Balls', 'From 10 EUR', 'EUR']);
        expect(cataloguePath({ seller: 'clubs', category: 'SHIRT' })).toBe('/store/all?category=SHIRT&seller=clubs');
        expect(readCatalogue(new URLSearchParams('sort=NOPE'), 10)).toMatchObject({ sort: 'RELEVANCE', clubId: 10, seller: '' });
    });
});

describe('Cart rules', () => {
    it('keeps a saved cart when another seller or too many items are added', () => {
        addCartItem(item);
        expect(() => addCartItem({ ...item, clubId: 0, seller: 'GRASSKICKZ', variantId: 21 })).toThrow(/another seller/);
        expect(() => addCartItem({ ...item, quantity: 99 })).toThrow(/99/);
        expect(readCart()).toEqual([item]);
    });
    it('ignores invalid persisted carts and keeps GrassKickZ lines', () => {
        localStorage.setItem('gk.store.cart.v1:guest', 'bad json'); expect(readCart()).toEqual([]);
        const ball = { ...item, clubId: 0, seller: 'GRASSKICKZ' as const, variantId: 21, productId: 2 };
        localStorage.setItem('gk.store.cart.v1:guest', JSON.stringify([{ ...item, quantity: -1 }, { ...item, clubId: -1 }, ball]));
        expect(readCart()).toEqual([ball]);
    });
});

describe('Storefront and catalogue', () => {
    it('opens every door on the catalogue with that choice applied', async () => {
        render(<MemoryRouter initialEntries={['/store']}><Routes><Route path="/store" element={<StorePage />} /></Routes></MemoryRouter>);
        await waitFor(() => expect(screen.getAllByRole('link').find(link => link.getAttribute('href') === '/clubs/10/store')).toHaveTextContent('Tbilisi · 2 km · 3 products'));
        expect(screen.getByRole('link', { name: 'Shop GrassKickZ equipment' })).toHaveAttribute('href', '/store/all?seller=grasskickz');
        expect(screen.getByRole('link', { name: 'Explore club stores' })).toHaveAttribute('href', '/store/all?seller=clubs');
        expect(screen.getAllByRole('link').filter(link => link.getAttribute('href') === '/store/all?collection=BALLS&seller=grasskickz').map(link => link.textContent)).toEqual(['Balls', expect.stringContaining('4 products')]);
        expect(screen.getAllByRole('link', { name: 'View all' })[0]).toHaveAttribute('href', '/store/all?seller=grasskickz');
        expect(api.fetchStoreCatalog).toHaveBeenCalledWith(expect.objectContaining({ sort: 'RELEVANCE', near: 'Tbilisi', size: 10 }), expect.any(AbortSignal));
    });
    it('sends an old search link to the catalogue', async () => {
        render(<MemoryRouter initialEntries={['/store?category=SHIRT']}><Routes><Route path="/store" element={<StorePage />} /><Route path="/store/all" element={<StoreCataloguePage />} /></Routes></MemoryRouter>);
        expect(await screen.findByRole('heading', { name: 'Shirts' })).toBeInTheDocument();
    });
    it('keeps the club, the search and the page in the address and in the request', async () => {
        vi.mocked(api.fetchStoreCatalog).mockResolvedValue(catalogue([product], 30));
        render(<MemoryRouter initialEntries={['/clubs/10/store?query=shirt&currency=EUR']}><Routes><Route path="/clubs/:id/store" element={<ClubStorePage />} /></Routes></MemoryRouter>);
        expect(await screen.findByRole('heading', { name: 'Alpha FC store' })).toBeInTheDocument();
        expect(api.fetchStoreCatalog).toHaveBeenCalledWith(expect.objectContaining({ clubId: 10, query: 'shirt', currency: 'EUR', size: 24, page: 0, sort: 'RELEVANCE' }), expect.any(AbortSignal));
        expect(screen.getByRole('link', { name: /Home shirt/ })).toHaveAttribute('href', '/store/products/1');
        expect(screen.getByText('1–24 of 30')).toBeInTheDocument();
        fireEvent.click(screen.getAllByRole('button', { name: 'Next page' })[0]);
        await waitFor(() => expect(api.fetchStoreCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ clubId: 10, query: 'shirt', page: 1 }), expect.any(AbortSignal)));
        expect(screen.queryByRole('button', { name: 'Add a product' })).not.toBeInTheDocument();
    });
    it('offers Add a product to the club administrator', async () => {
        vi.mocked(api.fetchStoreClub).mockResolvedValue({ id: 10, name: 'Alpha FC', myRole: 'CLUB_ADMIN' });
        render(<MemoryRouter initialEntries={['/clubs/10/store']}><Routes><Route path="/clubs/:id/store" element={<ClubStorePage />} /></Routes></MemoryRouter>);
        fireEvent.click(await screen.findByRole('button', { name: 'Add a product' }));
        expect(await screen.findByLabelText('Product name')).toBeInTheDocument();
    });
    it('removes one filter at a time and names the search', async () => {
        render(<MemoryRouter initialEntries={['/store/all?seller=grasskickz&collection=BALLS&minPrice=10']}><Routes><Route path="/store/all" element={<StoreCataloguePage />} /></Routes></MemoryRouter>);
        expect(await screen.findByRole('heading', { name: 'Balls' })).toBeInTheDocument();
        expect(api.fetchStoreCatalog).toHaveBeenCalledWith(expect.objectContaining({ seller: 'grasskickz', collection: 'BALLS', minPrice: 10 }), expect.any(AbortSignal));
        fireEvent.click(screen.getAllByRole('button', { name: 'Remove Balls' })[0]);
        await waitFor(() => expect(api.fetchStoreCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ seller: 'grasskickz', collection: undefined, minPrice: 10 }), expect.any(AbortSignal)));
        expect(screen.getByRole('heading', { name: 'GrassKickZ equipment' })).toBeInTheDocument();
    });
});

describe('Product and cart', () => {
    it('switches photos and sizes and never lets an unavailable size into the cart', async () => {
        vi.mocked(api.fetchStoreProduct).mockResolvedValue({ ...product, clubWhatsappNumber: '+995 555 123 456', clubEmail: 'shop@alpha.test', images: ['/uploads/first.jpg', '/uploads/second.jpg'], variants: [{ id: 7, label: 'M', stock: 5 }, { id: 8, label: 'L', stock: 2 }, { id: 9, label: 'XL', stock: 0 }] });
        render(<MemoryRouter initialEntries={['/store/products/1']}><Routes><Route path="/store/products/:id" element={<StoreProductPage />} /></Routes></MemoryRouter>);
        await screen.findByRole('heading', { name: 'Home shirt' });
        fireEvent.click(screen.getByRole('button', { name: 'Photo 2' }));
        expect(screen.getByRole('img', { name: 'Home shirt, photo 2' })).toHaveAttribute('src', expect.stringContaining('second.jpg'));
        fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '5' } });
        fireEvent.click(screen.getByRole('button', { name: 'L' }));
        expect(screen.getByLabelText('Quantity')).toHaveValue(1);
        expect(screen.getByRole('button', { name: 'XL, out of stock' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
        expect(readCart()[0]).toEqual(expect.objectContaining({ variantId: 8, quantity: 1, clubId: 10, seller: 'CLUB' }));
        expect(screen.getByRole('link', { name: 'Ask on WhatsApp' })).toHaveAttribute('href', expect.stringContaining(encodeURIComponent('Home shirt · L × 1')));
        expect(screen.getByRole('link', { name: 'Back to results' })).toHaveAttribute('href', '/clubs/10/store');
    });
    it('drops an obsolete quote on a failed recheck while keeping the cart', async () => {
        saveCart([item]);
        vi.mocked(api.fetchCartQuote).mockResolvedValueOnce({ clubId: 10, clubName: 'Alpha FC', currency: 'GEL', lines: [{ ...item, unitAmount: 1234, lineAmount: 2468 }], subtotal: 2468, checkoutEnabled: false, message: 'Unavailable' }).mockRejectedValue({ response: { data: { error: 'Not enough stock' } } });
        render(<MemoryRouter><StoreCartPage /></MemoryRouter>);
        expect(await screen.findByText('Subtotal')).toBeInTheDocument();
        expect(screen.getAllByText('GEL 24.68')).toHaveLength(2);
        expect(screen.getByRole('link', { name: 'Contact Alpha FC' })).toHaveAttribute('href', '/clubs/10?tab=contact');
        fireEvent.change(screen.getByLabelText('Quantity of Home shirt, M'), { target: { value: '3' } });
        expect(await screen.findByRole('alert')).toHaveTextContent('Not enough stock');
        expect(screen.queryByText('Subtotal')).not.toBeInTheDocument();
        expect(readCart()[0].quantity).toBe(3);
        expect(screen.getByRole('button', { name: 'Checkout unavailable' })).toBeDisabled();
    });
});

describe('The club’s own products (workspace)', () => {
    it('keeps stock edits and the original version after a failed save', async () => {
        vi.mocked(api.fetchAllClubStoreProducts).mockResolvedValue([product]);
        vi.mocked(api.updateStoreProduct).mockRejectedValue({ response: { data: { error: 'This product changed. Reload its latest version before saving.' } } });
        render(<MemoryRouter><StoreProductsPage clubId={10} /></MemoryRouter>);
        fireEvent.click(await screen.findByRole('button', { name: 'Edit Home shirt' }));
        fireEvent.change(screen.getByLabelText('Stock 1'), { target: { value: '4' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save product' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('This product changed');
        expect(screen.getByLabelText('Stock 1')).toHaveValue(4);
        expect(screen.getByLabelText('Stock 1')).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Retry original change' })).toBeEnabled();
        expect(api.updateStoreProduct).toHaveBeenCalledWith(10, 1, expect.objectContaining({ version: 3, variants: [{ id: 7, label: 'M', stock: 4 }] }), expect.any(String), null);
    });
    it('rejects a stale archive and asks again after loading the newer product', async () => {
        vi.mocked(api.fetchAllClubStoreProducts).mockResolvedValue([product]);
        vi.mocked(api.deleteStoreProduct).mockRejectedValueOnce({ response: { status: 409, data: { error: 'Product changed; it was not archived.' } } }).mockResolvedValueOnce(undefined);
        render(<MemoryRouter><StoreProductsPage clubId={10} /></MemoryRouter>);
        fireEvent.click(await screen.findByRole('button', { name: 'Archive Home shirt' }));
        expect(api.deleteStoreProduct).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Confirm archive' }));
        await screen.findByRole('alert');
        expect(api.deleteStoreProduct).toHaveBeenLastCalledWith(10, 1, 3, expect.any(String), null);
        vi.mocked(api.fetchAllClubStoreProducts).mockResolvedValue([{ ...product, version: 4, name: 'New kit' }]);
        fireEvent.click(screen.getByRole('button', { name: 'Reload products' }));
        await screen.findByRole('heading', { name: 'New kit' });
        fireEvent.click(screen.getByRole('button', { name: 'Archive New kit' }));
        vi.mocked(api.fetchAllClubStoreProducts).mockResolvedValue([]);
        fireEvent.click(screen.getByRole('button', { name: 'Confirm archive' }));
        await screen.findByText('Product archived.');
        expect(api.deleteStoreProduct).toHaveBeenLastCalledWith(10, 1, 4, expect.any(String), null);
    });
});
