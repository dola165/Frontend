import { useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthProvider, useAuth } from '../../../context/AuthContext';
import { AuthSessionBoundary } from '../../../context/AuthSessionBoundary';
import { clearStoredAuth, setStoredAccessToken } from '../../../utils/authStorage';
import { ClubStorePage } from '../../../pages/ClubStorePage';
import { StoreProductPage } from '../../../pages/StoreProductPage';
import { StoreProductsPage } from '../../clubWorkspace/commerce/StoreProductsPage';
import * as api from '../api';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../paymentPreview/config', () => ({ paymentPreviewEnabled: () => false }));
vi.mock('../api', async original => ({ ...await original<typeof import('../api')>(), fetchStoreProduct: vi.fn(), fetchStoreClub: vi.fn(), fetchStoreCatalog: vi.fn(), fetchStoreLocations: vi.fn(), fetchAllClubStoreProducts: vi.fn(), createStoreProduct: vi.fn(), updateStoreProduct: vi.fn() }));
const server = setupServer(
    http.get('*/auth/csrf', () => HttpResponse.json({ headerName: 'X-XSRF-TOKEN', token: 'test-only' })),
    http.get('*/users/me', ({ request }) => HttpResponse.json({ id: request.headers.get('Authorization') === 'Bearer Bravo' ? 2 : 1, fullName: 'Synthetic store manager', profileComplete: true, emailVerified: true })),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => { cleanup(); clearStoredAuth(); server.resetHandlers(); });
let auth!: ReturnType<typeof useAuth>;
function Capture() { const value = useAuth(); useEffect(() => { auth = value; }, [value]); return <output>{value.status}:{value.user?.id ?? '-'}</output>; }
const product: api.StoreProduct = { id: 81, clubId: 10, clubName: 'Synthetic club', name: 'Synthetic shirt', price: 95, currency: 'GEL', version: 3, active: true, variants: [{ id: 701, label: 'L', stock: 6 }] };
let role: string | null = 'OWNER';
const open = (page: 'club' | 'product') => render(<MemoryRouter initialEntries={[page === 'club' ? '/clubs/10/store' : '/store/products/81']}><AuthProvider><Capture /><AuthSessionBoundary><Routes>
    <Route path="/clubs/:id/store" element={<ClubStorePage />} />
    <Route path="/store/products/:id" element={<StoreProductPage />} />
    <Route path="/clubs/10/workspace" element={<StoreProductsPage clubId={10} />} />
</Routes></AuthSessionBoundary></AuthProvider></MemoryRouter>);
beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear(); setStoredAccessToken('Alpha'); role = 'OWNER';
    vi.mocked(api.fetchStoreProduct).mockResolvedValue(product);
    vi.mocked(api.fetchStoreClub).mockImplementation(async () => ({ id: 10, name: 'Synthetic club', myRole: role }));
    vi.mocked(api.fetchStoreCatalog).mockResolvedValue({ content: [product], totalElements: 1 });
    vi.mocked(api.fetchStoreLocations).mockResolvedValue([]);
    vi.mocked(api.fetchAllClubStoreProducts).mockResolvedValue([product]);
});

describe('Manage store opens the existing manager only with confirmed club leadership', () => {
    it.each([{ page: 'club', role: 'OWNER' }, { page: 'club', role: 'CLUB_ADMIN' }, { page: 'product', role: 'OWNER' }, { page: 'product', role: 'CLUB_ADMIN' }] as const)('takes $role from the public $page to the named clubs existing editor', async choice => {
        role = choice.role; open(choice.page);
        const link = await screen.findByRole('link', { name: 'Manage store' });
        expect(link).toHaveAttribute('href', '/clubs/10/workspace?tab=store');
        fireEvent.click(link);
        fireEvent.click(await screen.findByRole('button', { name: 'Edit Synthetic shirt' }));
        expect(await screen.findByLabelText('Product name')).toHaveValue('Synthetic shirt');
        expect(screen.getByLabelText('Variant 1')).toHaveValue('L');
        expect(screen.getByLabelText('Stock 1')).toHaveValue(6);
        expect(api.createStoreProduct).not.toHaveBeenCalled(); expect(api.updateStoreProduct).not.toHaveBeenCalled();
    });

    it.each([{ page: 'club', role: 'COACH' }, { page: 'club', role: 'PLAYER' }, { page: 'club', role: null }, { page: 'product', role: 'COACH' }, { page: 'product', role: 'PLAYER' }, { page: 'product', role: null }] as const)('keeps $role browsing the public $page without a management entrance', async choice => {
        role = choice.role; open(choice.page); await screen.findByText('authenticated:1');
        await screen.findByRole('heading', { name: choice.page === 'club' ? 'Synthetic club store' : 'Synthetic shirt' });
        await waitFor(() => expect(api.fetchStoreClub).toHaveBeenCalled());
        await act(async () => { await vi.mocked(api.fetchStoreClub).mock.results.at(-1)!.value; });
        expect(screen.queryByRole('link', { name: 'Manage store' })).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Product name')).not.toBeInTheDocument();
    });

    it('waits for the product sellers authority before exposing the manager', async () => {
        let finish!: (club: api.StoreClub) => void;
        vi.mocked(api.fetchStoreClub).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        open('product'); await screen.findByRole('heading', { name: 'Synthetic shirt' });
        await waitFor(() => expect(api.fetchStoreClub).toHaveBeenCalledOnce());
        expect(screen.queryByRole('link', { name: 'Manage store' })).not.toBeInTheDocument();
        await act(async () => finish({ id: 10, name: 'Synthetic club', myRole: 'OWNER' }));
        expect(await screen.findByRole('link', { name: 'Manage store' })).toHaveAttribute('href', '/clubs/10/workspace?tab=store');
    });

    it('keeps a product readable when authority cannot be confirmed', async () => {
        vi.mocked(api.fetchStoreClub).mockRejectedValue(new Error('Unavailable'));
        open('product'); await screen.findByRole('heading', { name: 'Synthetic shirt' });
        await waitFor(() => expect(api.fetchStoreClub).toHaveBeenCalledOnce());
        await act(async () => { await vi.mocked(api.fetchStoreClub).mock.results[0].value.catch(() => undefined); });
        expect(screen.queryByRole('link', { name: 'Manage store' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'L' })).toBeEnabled();
    });

    it('does not use another clubs leadership response for this product', async () => {
        vi.mocked(api.fetchStoreClub).mockResolvedValue({ id: 20, name: 'Other club', myRole: 'OWNER' });
        open('product'); await screen.findByRole('heading', { name: 'Synthetic shirt' });
        await waitFor(() => expect(api.fetchStoreClub).toHaveBeenCalledOnce());
        await act(async () => { await vi.mocked(api.fetchStoreClub).mock.results[0].value; });
        expect(screen.queryByRole('link', { name: 'Manage store' })).not.toBeInTheDocument();
    });

    it('retires an owners management entrance when the next login is a coach', async () => {
        open('product'); await screen.findByRole('link', { name: 'Manage store' });
        role = 'COACH'; await act(async () => { await auth.loginWithAccessToken('Bravo'); });
        await screen.findByText('authenticated:2'); await screen.findByRole('heading', { name: 'Synthetic shirt' });
        await waitFor(() => expect(api.fetchStoreClub).toHaveBeenCalledTimes(2));
        await act(async () => { await vi.mocked(api.fetchStoreClub).mock.results.at(-1)!.value; });
        expect(screen.queryByRole('link', { name: 'Manage store' })).not.toBeInTheDocument();
        expect(api.createStoreProduct).not.toHaveBeenCalled(); expect(api.updateStoreProduct).not.toHaveBeenCalled();
    });
});
