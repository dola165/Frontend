import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreCartPage } from '../../pages/StoreCartPage';
import { CommerceDemoPage } from '../../pages/CommerceDemoPage';
import { fetchCartQuote, type CartQuote } from '../store/api';
import { saveCart, readCart } from '../store/cart';
import { fetchCampaign, type Campaign } from '../campaigns/api';
import { contributionMinorUnits, readPreviewRecords, previewKey } from './records';
import { paymentPreviewEnabled } from './config';

vi.mock('../store/api', async original => ({ ...await original<typeof import('../store/api')>(), fetchCartQuote: vi.fn() }));
vi.mock('../campaigns/api', async original => ({ ...await original<typeof import('../campaigns/api')>(), fetchCampaign: vi.fn() }));
const cart = [{ variantId: 7, quantity: 2, productId: 1, name: 'Academy shirt', variant: 'M', clubId: 10, seller: 'CLUB' as const, currency: 'EUR' }];
const quote: CartQuote = { clubId: 10, clubName: 'Academy FC', currency: 'EUR', subtotal: 6000, checkoutEnabled: false, message: 'Unavailable', lines: [{ variantId: 7, productId: 1, quantity: 2, name: 'Academy shirt', variant: 'M', unitAmount: 3000, lineAmount: 6000 }] };
const campaign: Campaign = { id: 8, clubId: 10, clubName: 'Academy FC', title: 'New training pitch', summary: 'A pitch for youth teams', description: 'New pitch', beneficiary: 'Youth teams', useOfFunds: 'Pitch', category: 'FACILITIES', currency: 'GBP', goalAmount: 1000, reportedAmount: 200, reportedNote: 'Club report', reportedAt: null, startsOn: null, endsOn: null, images: [], status: 'PUBLISHED', phase: 'ACTIVE', version: 1, updatedAt: '', publishedAt: null, updates: [] };
const scope = '9:session-a';
beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear();
    localStorage.setItem('userId', '9'); localStorage.setItem('gk-session-id', 'session-a');
    vi.stubEnv('VITE_PAYMENT_PREVIEW', 'true');
    vi.mocked(fetchCartQuote).mockResolvedValue(quote);
    vi.mocked(fetchCampaign).mockResolvedValue(campaign);
});
afterEach(() => vi.unstubAllEnvs());
const cartPage = () => { saveCart(cart); return render(<MemoryRouter><StoreCartPage /></MemoryRouter>); };

describe('payments inside the real commerce pages', () => {
    it('checks the actual cart again, records its currency/items, and retains it after success and refund', async () => {
        const view = cartPage();
        fireEvent.click(await screen.findByRole('button', { name: 'Simulate checkout' }));
        await screen.findByRole('heading', { name: 'Test payment successful' });
        expect(fetchCartQuote).toHaveBeenLastCalledWith(cart);
        expect(readPreviewRecords(scope)).toEqual([expect.objectContaining({ currency: 'EUR', amount: 6000, clubName: 'Academy FC', lines: ['Academy shirt · M × 2'], status: 'paid' })]);
        expect(readCart()).toEqual(cart);
        fireEvent.click(screen.getByRole('button', { name: 'Test a refund' }));
        fireEvent.click(screen.getByRole('button', { name: 'Confirm test refund' }));
        expect(readPreviewRecords(scope)[0].status).toBe('refunded');
        view.unmount(); cartPage();
        await screen.findByText(/Test refunded/);
        expect(readCart()).toEqual(cart);
    });
    it('records a decline, prevents duplicate submissions and supports an explicit retry', async () => {
        cartPage();
        const button = await screen.findByRole('button', { name: 'Simulate checkout' });
        fireEvent.click(screen.getByLabelText('Declined payment'));
        fireEvent.click(button); fireEvent.click(button);
        await screen.findByRole('heading', { name: 'Test payment declined' });
        expect(readPreviewRecords(scope)).toHaveLength(1);
        expect(readCart()).toEqual(cart);
        fireEvent.click(screen.getByRole('button', { name: 'Try another test' }));
        fireEvent.click(screen.getByRole('button', { name: 'Simulate checkout' }));
        await screen.findByRole('heading', { name: 'Test payment successful' });
        expect(readPreviewRecords(scope).map(r => r.status)).toEqual(['paid', 'declined']);
    });
    it('refreshes changed prices without recording a success against an obsolete quote', async () => {
        cartPage(); await screen.findByRole('button', { name: 'Simulate checkout' });
        vi.mocked(fetchCartQuote).mockResolvedValue({ ...quote, subtotal: 7000, lines: [{ ...quote.lines[0], unitAmount: 3500, lineAmount: 7000 }] });
        fireEvent.click(screen.getByRole('button', { name: 'Simulate checkout' }));
        await waitFor(() => expect(screen.getAllByText(/70.00/).length).toBeGreaterThan(0));
        expect(readPreviewRecords(scope)).toHaveLength(0);
    });
    it('does not simulate an order when stock validation fails', async () => {
        cartPage(); await screen.findByRole('button', { name: 'Simulate checkout' });
        vi.mocked(fetchCartQuote).mockRejectedValue(new Error('Out of stock'));
        fireEvent.click(screen.getByRole('button', { name: 'Simulate checkout' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Prices or stock could not be confirmed');
        expect(readPreviewRecords(scope)).toHaveLength(0);
    });
    it('ignores an in-flight simulation after the cart changes', async () => {
        cartPage(); await screen.findByRole('button', { name: 'Simulate checkout' });
        let finish!: (quote: CartQuote) => void;
        vi.mocked(fetchCartQuote).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        fireEvent.click(screen.getByRole('button', { name: 'Simulate checkout' }));
        fireEvent.click(screen.getByRole('button', { name: 'Clear cart' }));
        await act(async () => finish({ ...quote, subtotal: 7000 }));
        expect(readPreviewRecords(scope)).toHaveLength(0);
        expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
    });
    it('isolates records and discards an in-flight attempt when the account/session changes', async () => {
        cartPage(); await screen.findByRole('button', { name: 'Simulate checkout' });
        let finish!: (quote: CartQuote) => void;
        vi.mocked(fetchCartQuote).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        fireEvent.click(screen.getByRole('button', { name: 'Simulate checkout' }));
        act(() => { localStorage.setItem('userId', '11'); localStorage.setItem('gk-session-id', 'session-b'); window.dispatchEvent(new Event('gk-auth-changed')); });
        await act(async () => finish(quote));
        expect(readPreviewRecords(scope)).toHaveLength(0);
        expect(readPreviewRecords('11:session-b')).toHaveLength(0);
        expect(screen.queryByRole('heading', { name: 'Test payment successful' })).not.toBeInTheDocument();
    });
    it('removes the simulation in launch mode', async () => {
        vi.stubEnv('VITE_PAYMENT_PREVIEW', 'false');
        cartPage(); await screen.findByText('Subtotal');
        expect(screen.getByRole('button', { name: 'Checkout unavailable' })).toBeDisabled();
        expect(screen.queryByText('Test payments are on')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Simulate checkout' })).not.toBeInTheDocument();
    });
});

it('defaults production builds to off and supports an explicit prelaunch opt-in', () => {
    vi.stubEnv('DEV', false); vi.stubEnv('VITE_PAYMENT_PREVIEW', ''); expect(paymentPreviewEnabled()).toBe(false);
    vi.stubEnv('VITE_PAYMENT_PREVIEW', 'true'); expect(paymentPreviewEnabled()).toBe(true);
    vi.stubEnv('DEV', true); vi.stubEnv('VITE_PAYMENT_PREVIEW', 'false'); expect(paymentPreviewEnabled()).toBe(false);
});
it('validates money exactly and ignores malformed saved records', () => {
    expect(contributionMinorUnits('12.34')).toBe(1234);
    for (const value of ['0', '-1', '1.234', '1e2', '1001', 'NaN']) expect(contributionMinorUnits(value)).toBeNull();
    localStorage.setItem(previewKey(scope), JSON.stringify([{ kind: 'order', currency: 'INVALID', amount: -3 }]));
    expect(readPreviewRecords(scope)).toEqual([]);
});
it.each([['/demo/commerce', 'Actual store'], ['/demo/commerce?section=campaigns', 'Actual campaigns']])('redirects the old bookmark %s into the real product', async (path, destination) => {
    render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/demo/commerce" element={<CommerceDemoPage />} /><Route path="/store" element={<h1>Actual store</h1>} /><Route path="/campaigns" element={<h1>Actual campaigns</h1>} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: destination })).toBeInTheDocument();
});
