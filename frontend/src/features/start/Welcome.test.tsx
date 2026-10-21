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

// A fake server: preferences, roles, the profile, professions, where the person is, clubs, and what pages they may make.
const server = vi.hoisted(() => ({
    prefs: {} as Record<string, unknown>, roles: [] as RoleProfile[], followed: new Set<number>(), me: {} as Record<string, unknown>,
    professions: { items: [] as { id: number; title: string }[], version: 0 }, puts: [] as string[],
}));
const auth = vi.hoisted(() => ({ user: { id: 0, dob: '1985-05-02' } }));
vi.mock('../../api/axiosConfig', async original => ({ ...(await original<object>()), apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: auth.user, sessionId: 'session', status: 'authenticated', refreshNavigationCapabilities: () => Promise.resolve() }) }));

const club = (id: number, name: string, followers: number) => ({ id, name, logoUrl: null, bannerUrl: null, cityName: 'Rustavi', km: 0, followers, following: false });
const place = { name: 'Rustavi', latitude: 41.5495, longitude: 45.0012, countryCode: 'GE', countryName: 'Georgia', source: 'SAVED' };
const welcome = () => (server.prefs.start as { welcome?: Record<string, unknown> } | undefined)?.welcome;
const start = () => server.prefs.start as Record<string, unknown>;
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
// The dialog loads lazily: the first test pays for the import.
const dialog = () => screen.findByRole('dialog', { name: /./ }, { timeout: 10000 });
const next = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Next' }));
const tileNames = (list: HTMLElement) => within(list).getAllByRole('button').map(button => button.querySelector('strong')?.textContent);
const choosePage = async (user: ReturnType<typeof userEvent.setup>) => {
    expect(await screen.findByRole('heading', { name: 'Do you want to create a page?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create a page' }));
    return screen.findByRole('list', { name: 'Create a page' });
};

beforeEach(async () => {
    await i18n.changeLanguage('en');
    auth.user = { id: nextUser++, dob: '1985-05-02' };
    server.prefs = { start: { town: { name: 'Rustavi', latitude: 41.5495, longitude: 45.0012, countryCode: 'GE' } } };
    // What the server answers for a new account: its account type, unpublished, in place of saved roles.
    server.roles = [{ role: 'FAN', primary: true, published: false }];
    server.followed = new Set();
    server.me = { fullName: 'Nika Beridze', bio: '', avatarUrl: null };
    server.professions = { items: [], version: 0 };
    server.puts = [];
    vi.mocked(apiClient.get).mockImplementation(async (url: string, config?: { params?: unknown }) => {
        if (url.startsWith('/clubs?')) return { data: { content: [{ id: 9, name: 'Gyumri Shirak Youth', cityName: 'Gyumri', followerCount: 3, isFollowedByMe: false, memberCount: 0 }], pageNumber: 0, pageSize: 8, totalElements: 1, totalPages: 1 } };
        if (url === '/clubs/near-you') {
            const clubs = (config?.params as { sort?: string } | undefined)?.sort === 'POPULAR' ? [club(5, 'Rustavi Lions', 40), club(6, 'Tbilisi Juniors', 12)] : [club(6, 'Tbilisi Juniors', 12), club(7, 'Rustavi Steel', 2)];
            return { data: clubs.map(item => ({ ...item, following: server.followed.has(item.id) })) };
        }
        if (url.startsWith('/posts/user/')) return { data: { posts: [], nextCursor: null } };
        const id = auth.user.id;
        const data: Record<string, unknown> = {
            '/users/me/preferences': server.prefs, '/users/me/roles': server.roles, '/users/me/place': place, '/users/me': server.me,
            [`/users/${id}/career`]: { roles: [], appointments: [], entries: [] }, '/users/me/professions': server.professions,
            [`/users/${id}`]: { id, username: 'nika', fullName: server.me.fullName, role: 'FAN', followerCount: 0, followingCount: 0, isFollowedByMe: false, roleProfiles: [], footballProfile: null },
            [`/users/${id}/professions`]: [],
            '/pages/eligibility': { age: 39, kinds: ['CLUB', 'FAN_CLUB', 'BUSINESS', 'PAGE'].map(kind => ({ kind, allowed: true, minimumAge: 16 })) },
        };
        return { data: data[url] ?? [] };
    });
    vi.mocked(apiClient.put).mockImplementation(async (url: string, body: unknown) => {
        server.puts.push(url);
        if (url === '/users/me/roles') {
            const profiles = (body as { profiles: RoleProfile[] }).profiles;
            server.roles = profiles.length ? profiles : [{ role: 'FAN', primary: true, published: false }];
            return { data: server.roles };
        }
        if (url === '/users/me') { server.me = { ...server.me, ...(body as object) }; return { data: server.me }; }
        if (url === '/users/me/professions') {
            const sent = body as { professions: { title: string }[] };
            server.professions = { items: sent.professions.map((item, index) => ({ id: index + 1, title: item.title })), version: server.professions.version + 1 };
            return { data: server.professions };
        }
        server.prefs = applyPreferencesUpdate(server.prefs as Preferences, body as Preferences) as Record<string, unknown>;
        return { data: server.prefs };
    });
    vi.mocked(apiClient.post).mockImplementation(async (url: string) => { server.followed.add(Number(url.split('/')[2])); return { data: { following: true } }; });
    vi.mocked(apiClient.delete).mockImplementation(async (url: string) => { server.followed.delete(Number(url.split('/')[2])); return { data: { following: false } }; });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });

describe('set up your profile', () => {
    it('starts with nothing ticked; Next with nothing chosen offers to continue as Other', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=roles');
        const box = await dialog();
        expect(within(box).getByText('Set up your profile · Step 1 of 5')).toBeInTheDocument();
        const tiles = await within(box).findByRole('group', { name: 'What do you do in football?' });
        expect(within(tiles).getAllByRole('checkbox').filter(input => (input as HTMLInputElement).checked)).toEqual([]);
        expect(within(tiles).getByRole('checkbox', { name: /^Business or sponsor/ })).toBeInTheDocument();
        await next(user);
        const note = screen.getByRole('dialog', { name: 'Continue as Other' });
        expect(note).toHaveTextContent('You’ll continue as Other, an everyday member. Add roles any time.');
        await user.click(within(note).getByRole('button', { name: 'Choose a role' }));
        expect(screen.queryByRole('dialog', { name: 'Continue as Other' })).toBeNull();
        expect(address()).toBe('/home?welcome=roles');
        await next(user);
        await user.click(within(screen.getByRole('dialog', { name: 'Continue as Other' })).getByRole('button', { name: 'Continue' }));
        await waitFor(() => expect(address()).toBe('/home?welcome=about'));
        // Other saves no roles, and has no headline or "What do you do?" to fill in.
        expect(server.puts).not.toContain('/users/me/roles');
        expect(await screen.findByLabelText('About me')).toBeInTheDocument();
        expect(screen.queryByLabelText('Headline')).toBeNull();
        expect(screen.queryByLabelText('What do you do?')).toBeNull();
    });

    it('a coach and sponsor picks what they do, follows a club, edits the profile beside its preview and creates a page', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=roles');
        await user.click(await screen.findByRole('checkbox', { name: /^Coach/ }));
        await user.click(screen.getByRole('checkbox', { name: /^Business or sponsor/ }));
        await next(user);
        await waitFor(() => expect(address()).toBe('/home?welcome=about'));
        expect(server.roles).toEqual([expect.objectContaining({ role: 'COACH', primary: true, published: true, headline: null })]);
        expect(start().business).toBe(true);

        expect(await screen.findByLabelText('Headline')).toHaveValue('Coach · Rustavi');
        await user.click(screen.getByRole('button', { name: 'Head coach' }));
        await user.click(screen.getByRole('button', { name: 'Sponsorship' }));
        await user.type(screen.getByLabelText('What do you do?'), 'Futsal{Enter}');
        expect(screen.getByRole('button', { name: 'Remove Futsal' })).toBeInTheDocument();
        await next(user);
        await waitFor(() => expect(address()).toBe('/home?welcome=clubs'));
        expect(server.roles[0]).toMatchObject({ role: 'COACH', headline: 'Coach · Rustavi', specialties: 'Head coach, Futsal' });
        expect(server.professions.items.map(item => item.title)).toEqual(['Sponsorship']);

        const popular = await screen.findByRole('list', { name: 'Popular in Georgia' });
        expect(within(popular).queryAllByRole('checkbox')).toEqual([]);
        expect(within(popular).getAllByRole('button').every(button => button.getAttribute('aria-pressed') === 'false')).toBe(true);
        // "Near Rustavi" leaves out what Popular already shows.
        const near = screen.getByRole('list', { name: 'Near Rustavi' });
        expect(within(near).getAllByRole('listitem').map(item => item.querySelector('strong')?.textContent)).toEqual(['Rustavi Steel']);
        // Follow follows at once and says Following; the rest of the tile does nothing.
        const lions = within(popular).getByText('Rustavi Lions').closest('li') as HTMLElement;
        await user.click(within(lions).getByText('Rustavi Lions'));
        expect([...server.followed]).toEqual([]);
        await user.click(within(lions).getByRole('button', { name: 'Follow Rustavi Lions' }));
        expect(await within(lions).findByRole('button', { name: 'Following Rustavi Lions' })).toHaveAttribute('aria-pressed', 'true');
        expect([...server.followed]).toEqual([5]);
        expect(within(lions).getByText('Rustavi · 41 followers')).toBeInTheDocument();
        await next(user);
        await waitFor(() => expect(address()).toBe('/home?welcome=profile'));
        expect([...server.followed]).toEqual([5]);

        const preview = await screen.findByLabelText('Preview of your profile');
        await waitFor(() => expect(within(preview).getAllByText('Coach · Rustavi').length).toBeGreaterThan(0));
        await user.type(screen.getByLabelText('About me'), 'Twenty years on the touchline.');
        expect(within(preview).getByText('Twenty years on the touchline.')).toBeInTheDocument();
        expect(server.me.bio).toBe('');
        await user.click(screen.getByRole('button', { name: 'Save profile' }));
        await waitFor(() => expect(address()).toBe('/home?welcome=page'));
        expect(server.me.bio).toBe('Twenty years on the touchline.');

        // First the question, with how a page looks (an example, no counts); the kinds come after "Create a page".
        expect(await screen.findByText('Riverside FC')).toBeInTheDocument();
        expect(screen.getByText('Example')).toBeInTheDocument();
        let pages = await choosePage(user);
        expect(tileNames(pages)).toEqual(['Sponsor or business', 'Club', 'Fan club', 'Other']);
        expect(within(pages).queryAllByRole('radio')).toEqual([]);
        const club = within(pages).getByRole('button', { name: 'Club If your club isn’t on GrassKickZ yet.' });
        expect(club).toHaveAccessibleDescription('Squads, players, staff, fees, grounds, events, honours and posts.');
        // Back returns to the question.
        await user.click(screen.getByRole('button', { name: 'Back' }));
        pages = await choosePage(user);
        await user.click(within(pages).getByRole('button', { name: /^Club/ }));
        await waitFor(() => expect(address()).toBe('/home?create=club&from=start'));
        await waitFor(() => expect(welcome()).toMatchObject({ state: 'DONE', at: null }));
    });

    it('offers pages in the order that fits: football roles first a club, an everyday member a fan club', async () => {
        const user = userEvent.setup();
        server.roles = [{ role: 'PLAYER', primary: true, published: true }];
        mount('/home?welcome=page');
        expect(tileNames(await choosePage(user))).toEqual(['Club', 'Fan club', 'Sponsor or business', 'Other']);
        cleanup();
        server.roles = [{ role: 'FAN', primary: true, published: false }];
        mount('/home?welcome=page');
        expect(tileNames(await choosePage(user))).toEqual(['Fan club', 'Club', 'Sponsor or business', 'Other']);
        await user.click(screen.getByRole('button', { name: 'Not now' }));
        await waitFor(() => expect(address()).toBe('/home'));
    });

    it('a 15-year-old sees only roles they can hold, nothing ticked, and no business answer', async () => {
        auth.user = { id: nextUser++, dob: `${new Date().getFullYear() - 15}-01-01` };
        mount('/home?welcome=roles');
        const tiles = await screen.findByRole('group', { name: 'What do you do in football?' });
        expect(within(tiles).getAllByRole('checkbox').map(input => input.closest('label')?.querySelector('strong')?.textContent))
            .toEqual(['Player', 'Coach', 'Club or academy staff', 'Referee', 'Fan']);
        expect(within(tiles).getAllByRole('checkbox').every(input => !(input as HTMLInputElement).checked)).toBe(true);
    });

    it('clubs already followed say Following; a tap unfollows at once, and a follow that fails goes back and says so', async () => {
        const user = userEvent.setup();
        server.followed = new Set([6]);
        mount('/home?welcome=clubs');
        const popular = await screen.findByRole('list', { name: 'Popular in Georgia' });
        await user.click(within(popular).getByRole('button', { name: 'Following Tbilisi Juniors' }));
        await waitFor(() => expect([...server.followed]).toEqual([]));
        expect(within(popular).getByRole('button', { name: 'Follow Tbilisi Juniors' })).toHaveAttribute('aria-pressed', 'false');
        vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('offline'));
        await user.click(within(popular).getByRole('button', { name: 'Follow Rustavi Lions' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('That follow did not go through. Try again.');
        expect(within(popular).getByRole('button', { name: 'Follow Rustavi Lions' })).toHaveAttribute('aria-pressed', 'false');
        expect([...server.followed]).toEqual([]);
        await next(user);
        await waitFor(() => expect(address()).toBe('/home?welcome=profile'));
    });

    it('skipped from the start, it comes back as a card on Home that opens the step again', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=roles');
        await user.click(within(await dialog()).getByRole('button', { name: 'Skip setup' }));
        await waitFor(() => expect(address()).toBe('/home'));
        await waitFor(() => expect(welcome()).toEqual({ state: 'DONE', at: null, skipped: ['ROLES', 'ABOUT', 'FOLLOW'] }));
        const card = await screen.findByRole('region', { name: 'Finish setting up' });
        await user.click(within(card).getByRole('link', { name: 'Add a photo and a few words about you' }));
        await waitFor(() => expect(address()).toBe('/home?welcome=about'));
        expect(await screen.findByRole('heading', { name: 'About you' })).toBeInTheDocument();
    });

    it('a setup left open comes back where it was; Escape closes the Other note first, then is "Skip setup"', async () => {
        const user = userEvent.setup();
        server.prefs = { start: { welcome: { state: 'OPEN', at: 'ROLES' } } };
        mount('/home');
        await waitFor(() => expect(address()).toBe('/home?welcome=roles'));
        await screen.findByRole('group', { name: 'What do you do in football?' });
        await next(user);
        fireEvent.keyDown(screen.getByRole('dialog', { name: 'Continue as Other' }), { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Continue as Other' })).toBeNull());
        expect(address()).toBe('/home?welcome=roles');
        fireEvent.keyDown(await dialog(), { key: 'Escape' });
        await waitFor(() => expect(address()).toBe('/home'));

        cleanup();
        auth.user = { id: nextUser++, dob: '1985-05-02' };
        server.prefs = {};
        mount('/home');
        await act(async () => { await Promise.resolve(); });
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
