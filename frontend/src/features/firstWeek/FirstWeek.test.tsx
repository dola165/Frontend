import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import { CornerDock } from '../../components/layout/CornerDock';
import i18n from '../../i18n';
import { applyPreferencesUpdate, type Preferences } from '../preferences/preferencesStore';
import { FirstWeek } from './FirstWeek';

const server = vi.hoisted(() => ({ prefs: {} as Record<string, unknown>, followed: new Set<number>() }));
const auth = vi.hoisted(() => ({ user: { id: 0, dob: '1985-05-02' } }));
vi.mock('../../api/axiosConfig', async original => ({ ...(await original<object>()), apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: auth.user, sessionId: 'session', status: 'authenticated', bootstrapSession: async () => auth.user }) }));

const week = () => (server.prefs.start as { welcome?: { week?: string[]; cardDismissed?: boolean } }).welcome;
let nextUser = 8100;

function Address() {
    const location = useLocation();
    return <output data-testid="address">{`${location.pathname}${location.search}`}</output>;
}
const mount = (entry = '/home') => render(<MemoryRouter initialEntries={[entry]}>
    <Routes><Route path="*" element={<><CornerDock><FirstWeek /></CornerDock><Address /></>} /></Routes>
</MemoryRouter>);
const welcome = (choice: string, more: Record<string, unknown> = {}) => { server.prefs = { start: { welcome: { state: 'DONE', choice, week: [], cardDismissed: false, ...more } } }; };

beforeEach(async () => {
    await i18n.changeLanguage('en');
    auth.user = { id: nextUser++, dob: '1985-05-02' };
    server.followed = new Set();
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
        if (url === '/users/me/preferences') return { data: server.prefs };
        if (url === '/access/me') return { data: { allowed: ['follow', 'add_child'], refused: [] } };
        if (url === '/clubs/near-you') return { data: [{ id: 5, name: 'Rustavi Lions', logoUrl: null, bannerUrl: null, cityName: 'Rustavi', km: 1, followers: 3, following: false }] };
        return { data: [] };
    });
    vi.mocked(apiClient.put).mockImplementation(async (_url: string, body: unknown) => {
        server.prefs = applyPreferencesUpdate(server.prefs as Preferences, body as Preferences) as Record<string, unknown>;
        return { data: server.prefs };
    });
    vi.mocked(apiClient.post).mockImplementation(async (url: string) => { server.followed.add(Number(url.split('/')[2])); return { data: { following: true } }; });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });

describe('your first week, in the corner', () => {
    it('is a chip with its count that unfolds into the steps, and stays unfolded on the next page', async () => {
        const user = userEvent.setup();
        welcome('ME');
        mount();
        const chip = await screen.findByRole('button', { name: /Your first week · 0 of 3/ });
        expect(chip).toHaveAttribute('aria-expanded', 'false');
        await user.click(chip);
        expect(await screen.findByRole('heading', { name: 'Your first week' })).toBeInTheDocument();
        await waitFor(() => expect(week()?.week).toEqual(['open']));
        cleanup();
        mount('/world');
        expect(await screen.findByRole('link', { name: 'Find a trial that fits you' })).toHaveAttribute('href', '/world/opportunities?tab=trials&forMe=true');
        await user.click(screen.getByRole('button', { name: 'Fold' }));
        expect(await screen.findByRole('button', { name: /Your first week/ })).toHaveFocus();
    });

    it('ticks a step on another page and folds out of its way', async () => {
        const user = userEvent.setup();
        welcome('ME', { week: ['open'] });
        mount();
        await user.click(await screen.findByRole('link', { name: 'Find a trial that fits you' }));
        await waitFor(() => expect(week()?.week).toEqual(['trials']));
        expect(await screen.findByRole('button', { name: /Your first week · 1 of 3/ })).toBeInTheDocument();
    });

    it('follows clubs near you over the page and ticks the step', async () => {
        const user = userEvent.setup();
        welcome('FOLLOW', { week: ['open'] });
        mount();
        await user.click(await screen.findByRole('button', { name: 'Follow clubs near you' }));
        const sheet = await screen.findByRole('dialog', { name: 'Clubs near you' });
        expect(screen.getByTestId('address').textContent).toBe('/home');
        await user.click(await within(sheet).findByRole('button', { name: /Follow/ }));
        await waitFor(() => expect(server.followed.has(5)).toBe(true));
        await waitFor(() => expect(week()?.week).toEqual(['open', 'follow']));
    });

    it('shows a 17-year-old with an adult answer the follower’s week', async () => {
        auth.user = { id: nextUser++, dob: `${new Date().getFullYear() - 17}-01-01` };
        welcome('CHILD', { week: ['open'] });
        mount();
        expect(await screen.findByRole('button', { name: 'Follow clubs near you' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Add your child' })).toBeNull();
    });

    it('closes for good with X', async () => {
        const user = userEvent.setup();
        welcome('ME', { week: ['open'] });
        mount();
        await user.click(await screen.findByRole('button', { name: 'Close for good' }));
        await waitFor(() => expect(week()?.cardDismissed).toBe(true));
        expect(screen.queryByRole('heading', { name: 'Your first week' })).toBeNull();
    });

    it('stays out of the welcome, an action’s flow and the start sheet, and goes once all three are done', async () => {
        welcome('ME');
        for (const entry of ['/home?welcome=start', '/home?do=add_child', '/home?create=club&from=home']) {
            mount(entry);
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(screen.queryByRole('button', { name: /Your first week/ })).toBeNull();
            cleanup();
        }
        auth.user = { id: nextUser++, dob: '1985-05-02' };
        welcome('ME', { week: ['trials', 'follow', 'photo'] });
        mount();
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(screen.queryByRole('button', { name: /Your first week/ })).toBeNull();
    });
});
