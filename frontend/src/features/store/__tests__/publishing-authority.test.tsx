import { useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthProvider, useAuth } from '../../../context/AuthContext';
import { AuthSessionBoundary } from '../../../context/AuthSessionBoundary';
import { setStoredAccessToken, clearStoredAuth, getAuthSessionId } from '../../../utils/authStorage';
import { ClubStorePage } from '../../../pages/ClubStorePage';
import { StoreHead } from '../front/StoreFrontTop';
import { fetchMyClubMembershipContext } from '../../clubs/api';
import * as api from '../api';

vi.mock('../api', async original => ({ ...await original<typeof import('../api')>(), fetchStoreClub: vi.fn(), fetchStoreCatalog: vi.fn(), fetchStoreLocations: vi.fn(), createStoreProduct: vi.fn() }));
vi.mock('../../clubs/api', async original => ({ ...await original<typeof import('../../clubs/api')>(), fetchMyClubMembershipContext: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en', resolvedLanguage: 'en' } }) }));
const server = setupServer(
    http.get('*/auth/csrf', () => HttpResponse.json({ headerName: 'X-XSRF-TOKEN', token: 'test-only' })),
    http.get('*/users/me', ({ request }) => HttpResponse.json({ id: request.headers.get('Authorization') === 'Bearer Bravo' ? 2 : 1, fullName: 'Synthetic store manager', profileComplete: true, emailVerified: true })),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => { cleanup(); clearStoredAuth(); server.resetHandlers(); });
let auth!: ReturnType<typeof useAuth>;
function Capture() { const value = useAuth(); useEffect(() => { auth = value; }, [value]); return <output>{value.status}:{value.user?.id ?? '-'}</output>; }
const open = () => render(<MemoryRouter initialEntries={['/clubs/10/store?add=1']}><AuthProvider><Capture /><AuthSessionBoundary><Routes><Route path="/clubs/:id/store" element={<ClubStorePage />} /></Routes></AuthSessionBoundary></AuthProvider></MemoryRouter>);
const openHead = () => render(<MemoryRouter><AuthProvider><Capture /><AuthSessionBoundary><StoreHead /></AuthSessionBoundary></AuthProvider></MemoryRouter>);
let role: 'OWNER' | 'CLUB_ADMIN' | 'COACH' = 'OWNER';
let products: api.StoreProduct[] = [];
beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear(); setStoredAccessToken('Alpha'); role = 'OWNER'; products = [];
    vi.mocked(api.fetchStoreClub).mockImplementation(async () => ({ id: 10, name: 'Alpha FC', myRole: role }));
    vi.mocked(fetchMyClubMembershipContext).mockImplementation(async () => ({ clubId: 10, clubName: 'Alpha FC', myRole: role, hasClubMembership: true, canCreateClub: false }));
    vi.mocked(api.fetchStoreLocations).mockResolvedValue([]);
    vi.mocked(api.fetchStoreCatalog).mockImplementation(async () => ({ content: products.filter(product => product.active), totalElements: products.filter(product => product.active).length }));
    vi.mocked(api.createStoreProduct).mockImplementation(async (clubId, payload) => {
        const product = { ...payload, id: 81, clubId, clubName: 'Alpha FC', version: 0 };
        products.push(product); return product;
    });
});

describe('Store publishing uses current backend owner/admin authority', () => {
    it('keeps a coach on the public store even when the address requests the editor', async () => {
        role = 'COACH'; open();
        await screen.findByText('authenticated:1');
        await screen.findByText('Nothing for sale yet');
        expect(screen.queryByLabelText('Product name')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Add a product' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Add your first product' })).not.toBeInTheDocument();
        expect(api.createStoreProduct).not.toHaveBeenCalled();
    });

    it.each([{ role: 'OWNER', published: true }, { role: 'CLUB_ADMIN', published: false }] as const)('lets $role save an explicitly $published publication state for the named club', async choice => {
        role = choice.role; open();
        fireEvent.change(await screen.findByLabelText('Product name'), { target: { value: 'New club shirt' } });
        fireEvent.change(screen.getByLabelText('Price'), { target: { value: '12.34' } });
        const visibility = screen.getByRole('checkbox', { name: 'Published in the Store' });
        if (!choice.published) fireEvent.click(visibility);
        fireEvent.click(screen.getByRole('button', { name: 'Save product' }));
        await waitFor(() => expect(api.createStoreProduct).toHaveBeenCalledOnce());
        expect(api.createStoreProduct).toHaveBeenCalledWith(10, expect.objectContaining({ name: 'New club shirt', active: choice.published, price: 12.34 }), expect.stringMatching(/^[\da-f-]{36}$/i), getAuthSessionId());
        await waitFor(() => expect(screen.queryByLabelText('Product name')).not.toBeInTheDocument());
        if (choice.published) expect(await screen.findByRole('link', { name: /New club shirt/ })).toHaveAttribute('href', '/store/products/81');
        else expect(screen.queryByRole('link', { name: /New club shirt/ })).not.toBeInTheDocument();
    });

    it.each(['OWNER', 'CLUB_ADMIN', 'COACH'] as const)('aligns the storefront add-product entrance with %s authority', async currentRole => {
        role = currentRole; openHead();
        await screen.findByText('authenticated:1');
        await waitFor(() => expect(fetchMyClubMembershipContext).toHaveBeenCalledOnce());
        await act(async () => { await vi.mocked(fetchMyClubMembershipContext).mock.results[0].value; });
        if (currentRole === 'COACH') expect(screen.queryByRole('link', { name: /Add a product to/ })).not.toBeInTheDocument();
        else expect(await screen.findByRole('link', { name: 'Add a product to Alpha FC’s store' })).toHaveAttribute('href', '/clubs/10/store?add=1');
    });

    it('does not open an editor while current club authority is unresolved', async () => {
        let finish!: (value: api.StoreClub) => void;
        vi.mocked(api.fetchStoreClub).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        open(); await screen.findByText('authenticated:1');
        expect(screen.queryByLabelText('Product name')).not.toBeInTheDocument();
        await act(async () => finish({ id: 10, name: 'Alpha FC', myRole: 'COACH' }));
        await screen.findByText('Nothing for sale yet');
        expect(screen.queryByLabelText('Product name')).not.toBeInTheDocument();
    });

    it('retires the former owners editor and rechecks the next coach login', async () => {
        open();
        fireEvent.change(await screen.findByLabelText('Product name'), { target: { value: 'Private unfinished product from A' } });
        role = 'COACH';
        await act(async () => { await auth.loginWithAccessToken('Bravo'); });
        await screen.findByText('authenticated:2');
        await screen.findByText('Nothing for sale yet');
        expect(screen.queryByLabelText('Product name')).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue('Private unfinished product from A')).not.toBeInTheDocument();
        expect(api.createStoreProduct).not.toHaveBeenCalled();
    });
});
