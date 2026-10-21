import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreProductsPage } from '../../clubWorkspace/commerce/StoreProductsPage';
import { StoreProductPage } from '../../../pages/StoreProductPage';
import { StoreCartPage } from '../../../pages/StoreCartPage';
import { ct } from '../copy';
import { readCart } from '../cart';
import * as api from '../api';

const language = vi.hoisted(() => ({ value: 'en' }));
vi.mock('../../../utils/formatting', async original => ({ ...await original<typeof import('../../../utils/formatting')>(), appLanguage: () => language.value }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated', sessionId: 'label-test', user: { id: 1 } }) }));
vi.mock('../../paymentPreview/config', () => ({ paymentPreviewEnabled: () => false }));
vi.mock('../api', async original => ({ ...await original<typeof import('../api')>(), fetchStoreProduct: vi.fn(), fetchStoreClub: vi.fn(), fetchAllClubStoreProducts: vi.fn(), updateStoreProduct: vi.fn(), fetchCartQuote: vi.fn() }));

const product: api.StoreProduct = {
    id: 1, clubId: 10, clubName: 'Synthetic club', name: 'Synthetic shirt', price: 12.34, currency: 'GEL', active: true, version: 3,
    clubWhatsappNumber: '+995555010101', clubEmail: 'shop@example.test',
    variants: [{ id: 7, label: 'L', stock: 6 }, { id: 8, label: 'Home', stock: 4 }, { id: 9, label: '  Custom / 12  ', stock: 2 }, { id: 10, label: 'XS', stock: 0 }, { id: 11, label: 'One size', stock: 1 }],
};
const ownerView = () => <MemoryRouter><StoreProductsPage clubId={10} /></MemoryRouter>;
const publicView = () => <MemoryRouter initialEntries={['/store/products/1']}><Routes><Route path="/store/products/:id" element={<StoreProductPage />} /><Route path="/store/cart" element={<StoreCartPage />} /></Routes></MemoryRouter>;
beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); language.value = 'en';
    vi.mocked(api.fetchStoreProduct).mockResolvedValue(product);
    vi.mocked(api.fetchStoreClub).mockResolvedValue({ id: 10, name: 'Synthetic club', myRole: null });
    vi.mocked(api.fetchAllClubStoreProducts).mockResolvedValue([product]);
    vi.mocked(api.updateStoreProduct).mockResolvedValue(product);
    vi.mocked(api.fetchCartQuote).mockResolvedValue({ clubId: 10, clubName: 'Synthetic club', currency: 'GEL', lines: [{ variantId: 7, productId: 1, name: 'Synthetic shirt', variant: 'L', quantity: 2, unitAmount: 1234, lineAmount: 2468 }], subtotal: 2468, checkoutEnabled: false, message: 'Unavailable' });
});
afterEach(cleanup);

describe('Product variant labels stay product data in every locale', () => {
    it('localizes the new one-size default and replaces it when a size is explicitly added', async () => {
        language.value = 'ka'; render(ownerView());
        fireEvent.click(await screen.findByRole('button', { name: ct('Add product') }));
        expect(screen.getByLabelText(ct('Variant {v0}', { v0: 1 }))).toHaveValue(ct('One size'));
        fireEvent.click(screen.getByRole('button', { name: 'L' }));
        expect(screen.getByLabelText(ct('Variant {v0}', { v0: 1 }))).toHaveValue('L');
        expect(screen.queryByLabelText(ct('Variant {v0}', { v0: 2 }))).not.toBeInTheDocument();
    });

    it('keeps owner inputs, preview and an unchanged save verbatim across a language switch', async () => {
        const view = render(ownerView());
        fireEvent.click(await screen.findByRole('button', { name: 'Edit Synthetic shirt' }));
        language.value = 'ka'; view.rerender(ownerView());
        product.variants!.forEach((variant, index) => expect(screen.getByLabelText(ct('Variant {v0}', { v0: index + 1 }))).toHaveValue(variant.label));
        const preview = screen.getByRole('complementary');
        expect(within(preview).getByText('L', { exact: true })).toBeInTheDocument();
        expect(within(preview).getByText('Home', { exact: true })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: ct('Save product') }));
        await waitFor(() => expect(api.updateStoreProduct).toHaveBeenCalledWith(10, 1, expect.objectContaining({ version: 3, variants: product.variants }), expect.stringMatching(/^[0-9a-f-]{36}$/i), null));
    });

    it('saves an edited custom label without translating it into interface copy', async () => {
        language.value = 'ka'; render(ownerView());
        fireEvent.click(await screen.findByRole('button', { name: ct('Edit {v0}', { v0: 'Synthetic shirt' }) }));
        fireEvent.change(screen.getByLabelText(ct('Variant {v0}', { v0: 1 })), { target: { value: 'Home' } });
        expect(within(screen.getByRole('complementary')).getAllByText('Home', { exact: true })).toHaveLength(2);
        fireEvent.click(screen.getByRole('button', { name: ct('Save product') }));
        await waitFor(() => expect(api.updateStoreProduct).toHaveBeenCalledWith(10, 1, expect.objectContaining({ variants: [{ id: 7, label: 'Home', stock: 6 }, ...product.variants!.slice(1)] }), expect.stringMatching(/^[0-9a-f-]{36}$/i), null));
    });

    it.each(['en', 'ka'])('keeps %s selector, selected ID, enquiry and cart labels aligned', async locale => {
        language.value = locale; const view = render(publicView());
        if (locale === 'ka') expect(ct('L')).toBe('წ'); // Football-result copy remains unchanged.
        await screen.findByRole('heading', { name: 'Synthetic shirt' });
        expect(screen.getByRole('button', { name: 'L' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Home' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Custom / 12' })).toBeEnabled();
        expect(screen.getByRole('button', { name: `XS${ct(', out of stock')}` })).toBeDisabled();
        fireEvent.change(screen.getByLabelText(ct('Quantity')), { target: { value: '2' } });
        for (const name of ['Ask on WhatsApp', 'Email the club']) {
            const href = screen.getByRole('link', { name: ct(name) }).getAttribute('href')!;
            expect(decodeURIComponent(href)).toContain('Synthetic shirt · L × 2');
        }
        language.value = locale === 'ka' ? 'en' : 'ka'; view.rerender(publicView());
        expect(screen.getByRole('button', { name: 'L' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByLabelText(ct('Quantity'))).toHaveValue(2);
        fireEvent.click(screen.getByRole('button', { name: ct('Add to cart') }));
        expect(readCart()).toEqual([{ variantId: 7, productId: 1, clubId: 10, seller: 'CLUB', name: 'Synthetic shirt', variant: 'L', quantity: 2, currency: 'GEL' }]);
        fireEvent.click(screen.getByRole('link', { name: ct('View cart') }));
        expect(await screen.findByLabelText(ct('Quantity of {v0}, {v1}', { v0: 'Synthetic shirt', v1: 'L' }))).toHaveValue(2);
        expect(await screen.findByText('Synthetic shirt · L × 2')).toBeInTheDocument();
    });

    it('keeps API labels intact in the larger variant select too', async () => {
        language.value = 'ka';
        vi.mocked(api.fetchStoreProduct).mockResolvedValue({ ...product, variants: [...product.variants!, ...Array.from({ length: 7 }, (_, index) => ({ id: 20 + index, label: `Custom ${index}`, stock: 1 }))] });
        render(publicView()); await screen.findByRole('heading', { name: 'Synthetic shirt' });
        const select = screen.getByRole('combobox', { name: ct('Size') });
        expect(within(select).getByRole('option', { name: 'L' })).toHaveAttribute('value', '7');
        expect(within(select).getByRole('option', { name: 'Home' })).toHaveAttribute('value', '8');
        fireEvent.change(select, { target: { value: '8' } });
        expect(decodeURIComponent(screen.getByRole('link', { name: ct('Email the club') }).getAttribute('href')!)).toContain('Synthetic shirt · Home × 1');
    });
});
