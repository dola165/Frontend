import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreCartPage } from '../../pages/StoreCartPage';
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

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated', sessionId: 'session-a' }) }));
describe('Store keeps payment outside the app', () => {
    it('never offers a simulated checkout even when preview mode is enabled', async () => {
        cartPage(); await screen.findByText('Subtotal');
        expect(screen.queryByRole('button', { name: 'Simulate checkout' })).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Test payment successful' })).not.toBeInTheDocument();
        expect(readPreviewRecords(scope)).toHaveLength(0);
        expect(readCart()).toEqual(cart);
        expect(screen.getByRole('link', { name: /Contact Academy/ })).toBeInTheDocument();
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
