import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import i18n from '../../i18n';
import type { RoleProfile } from '../roles/domain';
import { applyPreferencesUpdate, type Preferences } from '../preferences/preferencesStore';
import { FinishSetup } from './FinishSetup';
import { WelcomeHost } from './WelcomeHost';

// A fake server: the person's preferences document, their football roles and the club directory.
const server = vi.hoisted(() => ({ prefs: {} as Record<string, unknown>, roles: [] as RoleProfile[], follows: [] as string[] }));
const auth = vi.hoisted(() => ({ user: { id: 0, dob: '1985-05-02' } }));
vi.mock('../../api/axiosConfig', async original => ({ ...(await original<object>()), apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: auth.user, sessionId: 'session', status: 'authenticated', refreshNavigationCapabilities: () => Promise.resolve() }) }));

const clubs = [
    { id: 5, name: 'Rustavi Lions', cityName: 'Rustavi', latitude: 41.55, longitude: 45.0, isFollowedByMe: false },
    { id: 6, name: 'Tbilisi Juniors', cityName: 'Tbilisi', latitude: 41.71, longitude: 44.82, isFollowedByMe: false },
];
const welcome = () => (server.prefs.start as { welcome?: Record<string, unknown> } | undefined)?.welcome;
let nextUser = 7100;

function Address() {
    const location = useLocation();
    return <output data-testid="address">{`${location.pathname}${location.search}`}</output>;
}
const address = () => screen.getByTestId('address').textContent;
function mount(entry: string) {
    render(<MemoryRouter initialEntries={[entry]}>
        <Routes>
            <Route path="/home" element={<><WelcomeHost /><FinishSetup /><Address /></>} />
            <Route path="*" element={<Address />} />
        </Routes>
    </MemoryRouter>);
}
const dialog = () => screen.findByRole('dialog');

beforeEach(async () => {
    await i18n.changeLanguage('en');
    auth.user = { id: nextUser++, dob: '1985-05-02' };
    server.prefs = { start: { town: { name: 'Rustavi', latitude: 41.5495, longitude: 45.0012 } } };
    server.roles = [{ role: 'FAN', primary: true, published: false }];
    server.follows = [];
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => ({
        data: url === '/users/me/preferences' ? server.prefs : url === '/users/me/roles' ? server.roles : url === '/clubs' ? clubs : [],
    }));
    vi.mocked(apiClient.put).mockImplementation(async (url: string, body: unknown) => {
        if (url === '/users/me/roles') { server.roles = (body as { profiles: RoleProfile[] }).profiles; return { data: server.roles }; }
        server.prefs = applyPreferencesUpdate(server.prefs as Preferences, body as Preferences) as Record<string, unknown>;
        return { data: server.prefs };
    });
    vi.mocked(apiClient.post).mockImplementation(async (url: string) => { server.follows.push(`POST ${url}`); return { data: { following: true } }; });
    vi.mocked(apiClient.delete).mockImplementation(async (url: string) => { server.follows.push(`DELETE ${url}`); return { data: { following: false } }; });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });

describe('the welcome after sign-up', () => {
    it('a coach says what they do, then finds or creates their club', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=roles');
        expect(await within(await dialog()).findByRole('heading', { name: 'What do you do in football?' })).toBeInTheDocument();
        await user.click(await screen.findByRole('checkbox', { name: /^Coach/ }));
        await user.click(screen.getByRole('button', { name: 'Next' }));
        await waitFor(() => expect(address()).toBe('/home?welcome=club'));
        // Profile sections only, hidden, and the new role leads over the starting Fan role.
        expect(server.roles).toEqual([{ role: 'FAN', primary: false, published: false }, { role: 'COACH', primary: true, published: false }]);
        expect(await screen.findByRole('heading', { name: 'Find your club' })).toBeInTheDocument();
        expect(await screen.findByText('Rustavi Lions')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Create your club’s page' }));
        await waitFor(() => expect(address()).toBe('/home?create=club&from=start'));
        await waitFor(() => expect(welcome()).toEqual({ state: 'DONE', at: null, skipped: ['FOLLOW'] }));
    });

    it('a parent adds their child right in the popup; an organizer goes to create a tournament', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=roles');
        await user.click(await screen.findByRole('checkbox', { name: /^Parent/ }));
        await user.click(screen.getByRole('checkbox', { name: /^Tournament organizer/ }));
        await user.click(screen.getByRole('button', { name: 'Next' }));
        await waitFor(() => expect(address()).toBe('/home?welcome=child'));
        expect(await screen.findByLabelText('Child’s full name')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Skip' }));
        await waitFor(() => expect(address()).toBe('/home?welcome=tournament'));
        await user.click(await screen.findByRole('button', { name: /Create a tournament/ }));
        await waitFor(() => expect(address()).toBe('/tournaments/setup'));
        await waitFor(() => expect(welcome()).toEqual({ state: 'DONE', at: null, skipped: ['CHILD', 'FOLLOW'] }));
    });

    it('with nothing chosen it goes straight to clubs near the town, followed with one tap', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=roles');
        await user.click(await screen.findByRole('checkbox', { name: /^Fan/ }));
        await user.click(screen.getByRole('button', { name: 'Next' }));
        await waitFor(() => expect(address()).toBe('/home?welcome=follow'));
        expect(server.roles).toEqual([{ role: 'FAN', primary: true, published: false }]);
        expect(await screen.findByRole('combobox', { name: 'Your town' })).toHaveValue('Rustavi');
        const lions = (await screen.findByText('Rustavi Lions')).closest('li')!;
        await user.click(within(lions).getByRole('button', { name: 'Follow' }));
        await user.click(await within(lions).findByRole('button', { name: 'Following' }));
        await waitFor(() => expect(server.follows).toEqual(['POST /clubs/5/follow', 'DELETE /clubs/5/follow']));
        await user.click(screen.getByRole('button', { name: 'Next' }));
        await waitFor(() => expect(address()).toBe('/home?welcome=business'));
        await user.click(screen.getByRole('button', { name: 'Sponsor or brand' }));
        await waitFor(() => expect(address()).toBe('/home?create=business&from=start&business=SPONSOR'));
    });

    it('everything skipped comes back once as a card on Home, never as the popup', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=roles');
        await user.click(await screen.findByRole('button', { name: 'Skip' }));
        await waitFor(() => expect(address()).toBe('/home?welcome=follow'));
        await user.click(screen.getByRole('button', { name: 'Skip' }));
        await waitFor(() => expect(address()).toBe('/home?welcome=business'));
        await user.click(screen.getByRole('button', { name: 'Done' }));
        await waitFor(() => expect(address()).toBe('/home'));
        expect(screen.queryByRole('dialog')).toBeNull();
        const card = await screen.findByRole('region', { name: 'Finish setting up' });
        expect(within(card).getAllByRole('link').map(link => link.textContent)).toEqual(['Say what you do in football', 'Follow clubs near you']);
        await user.click(within(card).getByRole('button', { name: 'Dismiss' }));
        await waitFor(() => expect(screen.queryByRole('region', { name: 'Finish setting up' })).toBeNull());
        expect(welcome()).toMatchObject({ state: 'DONE', skipped: ['ROLES', 'FOLLOW'], cardDismissed: true });
    });

    it('a popup left open comes back where it was; closing it ends it, and other accounts never get it', async () => {
        const user = userEvent.setup();
        server.prefs = { start: { welcome: { state: 'OPEN', at: 'FOLLOW' } } };
        mount('/home');
        await waitFor(() => expect(address()).toBe('/home?welcome=follow'));
        await user.click(within(await dialog()).getByRole('button', { name: 'Close' }));
        await waitFor(() => expect(address()).toBe('/home'));
        await waitFor(() => expect(welcome()).toEqual({ state: 'DONE', at: null, skipped: ['FOLLOW'] }));

        cleanup();
        auth.user = { id: nextUser++, dob: '1985-05-02' };
        server.prefs = {};
        mount('/home');
        await act(async () => { await Promise.resolve(); });
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(address()).toBe('/home');
    });
});
