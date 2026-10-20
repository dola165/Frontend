import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import i18n from '../../i18n';
import type { RoleProfile } from '../roles/domain';
import { applyPreferencesUpdate, type Preferences } from '../preferences/preferencesStore';
import { FinishSetup } from './FinishSetup';
import { WelcomeHost } from './WelcomeHost';

// A fake server: preferences, football roles, the profile, its history, where the person is and the clubs near them.
const server = vi.hoisted(() => ({
    prefs: {} as Record<string, unknown>, roles: [] as RoleProfile[], near: [] as unknown[], followed: new Set<number>(),
    me: {} as Record<string, unknown>, history: [] as unknown[],
}));
const auth = vi.hoisted(() => ({ user: { id: 0, dob: '1985-05-02' } }));
vi.mock('../../api/axiosConfig', async original => ({ ...(await original<object>()), apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: auth.user, sessionId: 'session', status: 'authenticated', refreshNavigationCapabilities: () => Promise.resolve() }) }));

const clubs = [
    { id: 5, name: 'Rustavi Lions', logoUrl: null, bannerUrl: null, cityName: 'Rustavi', km: 0, followers: 12, following: false },
    { id: 6, name: 'Tbilisi Juniors', logoUrl: null, bannerUrl: null, cityName: 'Tbilisi', km: 27, followers: 40, following: false },
];
const place = { name: 'Rustavi', latitude: 41.5495, longitude: 45.0012, countryCode: 'GE', countryName: 'Georgia', source: 'SAVED' };
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
const next = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Next' }));
const moveNames = (region: HTMLElement) => within(region).getAllByRole('button').map(button => button.querySelector('strong')?.textContent);

beforeEach(async () => {
    await i18n.changeLanguage('en');
    auth.user = { id: nextUser++, dob: '1985-05-02' };
    server.prefs = { start: { town: { name: 'Rustavi', latitude: 41.5495, longitude: 45.0012, countryCode: 'GE' } } };
    server.roles = [{ role: 'FAN', primary: true, published: false }];
    server.near = clubs;
    server.followed = new Set();
    server.me = { fullName: 'Nika Beridze', bio: '', avatarUrl: null, playerProfile: null };
    server.history = [];
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
        if (url.startsWith('/clubs?')) return { data: { content: [{ id: 9, name: 'Gyumri Shirak Youth', cityName: 'Gyumri', followerCount: 3, isFollowedByMe: false, memberCount: 0 }], pageNumber: 0, pageSize: 8, totalElements: 1, totalPages: 1 } };
        const data: Record<string, unknown> = {
            '/users/me/preferences': server.prefs, '/users/me/roles': server.roles, '/users/me/place': place, '/clubs/near-you': server.near,
            '/users/me': server.me, [`/users/${auth.user.id}/career`]: { roles: [], appointments: [], entries: server.history },
            '/clubs/followed': [...server.followed].map(id => ({ id })),
        };
        return { data: data[url] ?? [] };
    });
    vi.mocked(apiClient.put).mockImplementation(async (url: string, body: unknown) => {
        if (url === '/users/me/roles') { server.roles = (body as { profiles: RoleProfile[] }).profiles; return { data: server.roles }; }
        if (url === '/users/me') { server.me = { ...server.me, ...(body as object) }; return { data: server.me }; }
        server.prefs = applyPreferencesUpdate(server.prefs as Preferences, body as Preferences) as Record<string, unknown>;
        return { data: server.prefs };
    });
    vi.mocked(apiClient.post).mockImplementation(async (url: string, body: unknown) => {
        if (url === '/users/me/career') {
            server.history = [...server.history, { id: server.history.length + 1, ...(body as object) }];
            return { data: { roles: [], appointments: [], entries: server.history } };
        }
        server.followed.add(Number(url.split('/')[2]));
        return { data: { following: true } };
    });
    vi.mocked(apiClient.delete).mockImplementation(async (url: string) => { server.followed.delete(Number(url.split('/')[2])); return { data: { following: false } }; });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });

describe('set up your profile', () => {
    it('a coach goes through all four steps; only the last offers to leave, and their club’s page is one of the ways', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=roles');
        const box = await dialog();
        expect(within(box).getByText('Set up your profile · Step 1 of 4')).toBeInTheDocument();
        expect(within(box).getByRole('heading', { name: 'What do you do in football?' })).toBeInTheDocument();
        expect(within(box).getByText('Choose all that fit. This shapes your profile; it never gives access to anything.')).toBeInTheDocument();
        // Small checks with one grey sentence; no pictures and nothing that leaves the setup.
        expect(within(box).queryByRole('img')).toBeNull();
        expect(within(box).queryByRole('button', { name: /page/i })).toBeNull();
        await user.click(await within(box).findByRole('checkbox', { name: /^Coach/ }));
        await next(user);
        await waitFor(() => expect(address()).toBe('/home?welcome=about'));
        // Chosen roles show on the profile, and the new role leads over the starting Fan role.
        expect(server.roles).toEqual([{ role: 'FAN', primary: false, published: true }, { role: 'COACH', primary: true, published: true }]);

        expect(await screen.findByLabelText('Headline')).toHaveValue('Coach · Rustavi');
        await user.type(screen.getByLabelText('About me'), 'Youth coach for ten years.');
        await user.type(screen.getByLabelText('Age groups you coach'), 'U10, U12');
        expect(screen.queryByLabelText('Where you play')).toBeNull();
        await next(user);
        await waitFor(() => expect(address()).toBe('/home?welcome=clubs'));
        expect(server.me.bio).toBe('Youth coach for ten years.');
        expect(server.roles.find(item => item.role === 'COACH')).toMatchObject({ headline: 'Coach · Rustavi', specialties: 'U10, U12' });

        expect(await screen.findByText('Near Rustavi')).toBeInTheDocument();
        const lions = (await screen.findByText('Rustavi Lions')).closest('li')!;
        expect(within(lions).getByText('Rustavi · 0 km · 12 followers')).toBeInTheDocument();
        await user.click(within(lions).getByRole('button', { name: 'Follow' }));
        expect(await within(lions).findByRole('button', { name: 'Following' })).toHaveAttribute('aria-pressed', 'true');
        await next(user);
        await waitFor(() => expect(address()).toBe('/home?welcome=profile'));

        const card = await screen.findByRole('article', { name: 'Your profile' });
        expect(within(card).getByText('Nika Beridze')).toBeInTheDocument();
        expect(within(card).getByText('Coach · Rustavi')).toBeInTheDocument();
        expect(within(card).getByText('Youth coach for ten years.')).toBeInTheDocument();
        expect(within(card).getByText('U10, U12')).toBeInTheDocument();
        expect(await within(card).findByText('Following 1 club')).toBeInTheDocument();
        const moves = screen.getByRole('region', { name: 'What’s next' });
        expect(moveNames(moves)).toEqual(['Create your club’s page', 'Here for a business? Create an organisation page']);
        await user.click(within(moves).getByRole('button', { name: /Create your club’s page/ }));
        await waitFor(() => expect(address()).toBe('/home?create=club&from=start'));
        await waitFor(() => expect(welcome()).toEqual({ state: 'DONE', at: null, skipped: [] }));
    });

    it('a parent and organiser skip what they like and get their own next steps', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=roles');
        await user.click(await screen.findByRole('checkbox', { name: /^Parent or guardian/ }));
        await user.click(screen.getByRole('checkbox', { name: /^Tournament organiser/ }));
        await next(user);
        await waitFor(() => expect(address()).toBe('/home?welcome=about'));
        await user.click(screen.getByRole('button', { name: 'Skip this step' }));
        await waitFor(() => expect(address()).toBe('/home?welcome=clubs'));
        await user.click(screen.getByRole('button', { name: 'Skip this step' }));
        await waitFor(() => expect(address()).toBe('/home?welcome=profile'));
        const moves = await screen.findByRole('region', { name: 'What’s next' });
        expect(moveNames(moves)).toEqual(['Create your club’s page', 'Add your child', 'Create a tournament', 'Here for a business? Create an organisation page']);
        await user.click(within(moves).getByRole('button', { name: /Add your child/ }));
        await waitFor(() => expect(address()).toBe('/parent?tab=children'));
        await waitFor(() => expect(welcome()).toEqual({ state: 'DONE', at: null, skipped: ['ABOUT', 'FOLLOW'] }));
    });

    it('a 15-year-old sees only roles they can hold, starts as a player and is offered nothing to create', async () => {
        const user = userEvent.setup();
        auth.user = { id: nextUser++, dob: `${new Date().getFullYear() - 15}-01-01` };
        mount('/home?welcome=roles');
        await waitFor(async () => expect(await screen.findByRole('checkbox', { name: /^Player/ })).toBeChecked());
        for (const adultOnly of [/^Parent/, /^Tournament organiser/, /^Agent/, /^Venue manager/])
            expect(screen.queryByRole('checkbox', { name: adultOnly })).toBeNull();
        await next(user);
        await waitFor(() => expect(address()).toBe('/home?welcome=about'));
        await user.type(await screen.findByLabelText('Where you play'), 'Central midfield, left foot');
        await next(user);
        await waitFor(() => expect(address()).toBe('/home?welcome=clubs'));
        expect(server.roles.find(item => item.role === 'PLAYER')).toMatchObject({ specialties: 'Central midfield, left foot', headline: 'Player · Rustavi' });
        await next(user);
        await waitFor(() => expect(address()).toBe('/home?welcome=profile'));
        await screen.findByRole('article', { name: 'Your profile' });
        expect(screen.queryByRole('region', { name: 'What’s next' })).toBeNull();
        await user.click(screen.getByRole('button', { name: 'Finish' }));
        await waitFor(() => expect(address()).toBe('/home'));
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('skipped from the start, it comes back as a card on Home that opens the step again', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=roles');
        await user.click(within(await dialog()).getByRole('button', { name: 'Skip setup' }));
        await waitFor(() => expect(address()).toBe('/home'));
        expect(screen.queryByRole('dialog')).toBeNull();
        await waitFor(() => expect(welcome()).toEqual({ state: 'DONE', at: null, skipped: ['ROLES', 'ABOUT', 'FOLLOW'] }));
        const card = await screen.findByRole('region', { name: 'Finish setting up' });
        expect(within(card).getAllByRole('link').map(link => link.textContent))
            .toEqual(['Say what you do in football', 'Add a photo and a few words about you', 'Follow clubs near you']);
        await user.click(within(card).getByRole('link', { name: 'Add a photo and a few words about you' }));
        await waitFor(() => expect(address()).toBe('/home?welcome=about'));
        expect(await screen.findByRole('heading', { name: 'About you' })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Skip setup' }));
        await waitFor(() => expect(address()).toBe('/home'));
        await user.click(within(await screen.findByRole('region', { name: 'Finish setting up' })).getByRole('button', { name: 'Dismiss' }));
        await waitFor(() => expect(screen.queryByRole('region', { name: 'Finish setting up' })).toBeNull());
        expect(welcome()).toMatchObject({ state: 'DONE', cardDismissed: true });
    });

    it('a setup left open comes back where it was; Escape is "Skip setup", and other accounts never get it', async () => {
        server.prefs = { start: { welcome: { state: 'OPEN', at: 'FOLLOW' } } };
        mount('/home');
        await waitFor(() => expect(address()).toBe('/home?welcome=clubs'));
        fireEvent.keyDown(await dialog(), { key: 'Escape' });
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

    it('with no club near them it says so, and a search finds any club by name', async () => {
        const user = userEvent.setup();
        server.near = [];
        mount('/home?welcome=clubs');
        expect(await screen.findByText('No clubs near you yet. Search for one by name.')).toBeInTheDocument();
        await user.type(screen.getByRole('searchbox', { name: 'Search clubs by name' }), 'Gyumri');
        const row = (await screen.findByText('Gyumri Shirak Youth')).closest('li')!;
        expect(within(row).getByText('Gyumri · 3 followers')).toBeInTheDocument();
        await user.click(within(row).getByRole('button', { name: 'Follow' }));
        await waitFor(() => expect([...server.followed]).toEqual([9]));
    });

    it('the finished profile is edited in place, history included', async () => {
        const user = userEvent.setup();
        server.roles = [{ role: 'COACH', primary: true, published: true, headline: 'Coach · Rustavi' }];
        mount('/home?welcome=profile');
        const card = await screen.findByRole('article', { name: 'Your profile' });
        const about = within(card).getByRole('region', { name: 'About' });
        await user.click(within(about).getByRole('button', { name: 'Edit' }));
        await user.type(within(about).getByRole('textbox', { name: 'About me' }), 'UEFA B licence.');
        await user.click(within(about).getByRole('button', { name: 'Save' }));
        expect(await within(about).findByText('UEFA B licence.')).toBeInTheDocument();

        const history = within(card).getByRole('region', { name: 'Football history' });
        await user.click(within(history).getByRole('button', { name: 'Add' }));
        await user.type(within(history).getByLabelText('What you did'), 'U14 coach');
        await user.type(within(history).getByLabelText('Club or organisation'), 'Rustavi Lions');
        fireEvent.change(within(history).getByLabelText('Since'), { target: { value: '2021-09' } });
        await user.click(within(history).getByRole('button', { name: 'Save' }));
        expect(await within(history).findByText('U14 coach')).toBeInTheDocument();
        expect(within(history).getByText('Rustavi Lions · 2021')).toBeInTheDocument();
        expect(server.history).toEqual([expect.objectContaining({ role: 'COACH', title: 'U14 coach', startsOn: '2021-09-01', published: true })]);
    });
});
