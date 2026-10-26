import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import i18n from '../../i18n';
import { applyPreferencesUpdate, type Preferences } from '../preferences/preferencesStore';
import { FirstWeek } from './FirstWeek';
import { WelcomeHost } from './WelcomeHost';
import { stepFromParam } from './welcomeSteps';

// A fake server: preferences, where the person is, clubs near them and by age, follows, professions and discovery.
const server = vi.hoisted(() => ({
    prefs: {} as Record<string, unknown>, followed: new Set<number>(), gets: [] as string[],
    /** Open listings near the person, by job category (ALL: no category); clubs for an age, when set. */
    jobs: {} as Record<string, number>, clubsForAge: null as null | unknown[],
    professions: { items: [] as { id: number; title: string; detail: null; since: null; published: boolean; label: null }[], version: 0 },
    discovery: { openTo: [] as string[], licence: null, rate: null, version: 0 },
}));
const auth = vi.hoisted(() => ({ user: { id: 0, dob: '1985-05-02' } }));
vi.mock('../../api/axiosConfig', async original => ({ ...(await original<object>()), apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: auth.user, sessionId: 'session', status: 'authenticated' }) }));

const club = (id: number, name: string, km: number) => ({ id, name, logoUrl: null, bannerUrl: null, cityName: 'Rustavi', km, followers: 3, following: false });
const place = { name: 'Rustavi', latitude: 41.5495, longitude: 45.0012, countryCode: 'GE', countryName: 'Georgia', source: 'SAVED' };
const start = () => server.prefs.start as { welcome?: Record<string, unknown>; childAge?: number; town?: { name: string } };
let nextUser = 7100;

function Address() {
    const location = useLocation();
    return <output data-testid="address">{`${location.pathname}${location.search}`}</output>;
}
const address = () => screen.getByTestId('address').textContent;
const mount = (entry: string) => render(<MemoryRouter initialEntries={[entry]}>
    <Routes>
        <Route path="/home" element={<><WelcomeHost /><FirstWeek /><Address /></>} />
        <Route path="*" element={<Address />} />
    </Routes>
</MemoryRouter>);
// The dialog loads lazily: the first test pays for the import.
const dialog = () => screen.findByRole('dialog', { name: /./ }, { timeout: 10000 });

beforeEach(async () => {
    await i18n.changeLanguage('en');
    auth.user = { id: nextUser++, dob: '1985-05-02' };
    server.prefs = { start: { town: { name: 'Rustavi', latitude: 41.5495, longitude: 45.0012, countryCode: 'GE' } } };
    server.followed = new Set(); server.gets = [];
    server.professions = { items: [], version: 0 };
    server.discovery = { openTo: [], licence: null, rate: null, version: 0 };
    server.jobs = {}; server.clubsForAge = null;
    vi.mocked(apiClient.get).mockImplementation(async (url: string, config?: { params?: unknown }) => {
        server.gets.push(url);
        if (url === '/jobs/listings') return { data: { content: [], totalElements: server.jobs[String((config?.params as { category?: string } | undefined)?.category ?? 'ALL')] ?? 0 } };
        if (url.startsWith('/clubs?') && server.clubsForAge) return { data: { content: server.clubsForAge, pageNumber: 0, pageSize: 8, totalElements: 0, totalPages: 0 } };
        if (url.startsWith('/clubs?')) return { data: { content: [{ id: 9, name: 'Rustavi Juniors', cityName: 'Rustavi', followerCount: 3, isFollowedByMe: false, latitude: 41.5495, longitude: 45.0012, presentation: { profileKind: 'ACADEMY', revision: 1, canEdit: false, sponsors: [], affiliations: [], programmes: [
            { name: 'U10 Development', ageMin: 8, ageMax: 10, sessionsPerWeek: 2, priceType: 'FIXED', amount: '80', currency: 'GEL', billingPeriod: 'MONTH', trialAmount: null, joiningFee: null, equipmentFee: null, details: null, published: true },
        ] } }], pageNumber: 0, pageSize: 8, totalElements: 1, totalPages: 1 } };
        if (url === '/clubs/near-you') return { data: [club(5, 'Rustavi Lions', 1), club(6, 'Rustavi Steel', 2), club(7, 'Gardabani Youth', 18), club(8, 'Tbilisi Juniors', 25)] };
        const data: Record<string, unknown> = {
            '/users/me/preferences': server.prefs, '/users/me/place': place, '/users/me/professions': server.professions, '/users/me/discovery': server.discovery,
        };
        return { data: data[url] ?? [] };
    });
    vi.mocked(apiClient.put).mockImplementation(async (url: string, body: unknown) => {
        if (url === '/users/me/professions') {
            const sent = body as { professions: { title: string }[] };
            server.professions = { items: sent.professions.map((item, index) => ({ id: index + 1, title: item.title, detail: null, since: null, published: true, label: null })), version: server.professions.version + 1 };
            return { data: server.professions };
        }
        if (url === '/users/me/discovery') { server.discovery = { ...(body as typeof server.discovery), version: server.discovery.version + 1 }; return { data: server.discovery }; }
        server.prefs = applyPreferencesUpdate(server.prefs as Preferences, body as Preferences) as Record<string, unknown>;
        return { data: server.prefs };
    });
    vi.mocked(apiClient.post).mockImplementation(async (url: string) => { server.followed.add(Number(url.split('/')[2])); return { data: { following: true } }; });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });

describe('the welcome', () => {
    it('asks what brings the person, large tiles first, with follow and Skip in the footer', async () => {
        mount('/home?welcome=start');
        const box = await dialog();
        expect(within(box).getByRole('heading', { name: 'What brings you to GrassKickZ?' })).toBeInTheDocument();
        expect(within(box).getByText('Welcome · 1 of 2')).toBeInTheDocument();
        for (const name of ['Play football: For me', 'Play football: For my child', /^A club/, /^Work or volunteer/, /^A business or organisation/, /I’m here to follow football/, 'Skip'])
            expect(within(box).getByRole('button', { name })).toBeInTheDocument();
        expect(within(box).getByText('Coaches, referees, physios, analysts, agents, volunteers')).toBeInTheDocument();
    });

    it('shows someone under 18 only Play for themselves and Follow', async () => {
        auth.user = { id: nextUser++, dob: `${new Date().getFullYear() - 14}-01-01` };
        mount('/home?welcome=start');
        const box = await dialog();
        expect(within(box).getByRole('button', { name: 'Play football: For me' })).toBeInTheDocument();
        expect(within(box).queryByRole('button', { name: 'Play football: For my child' })).toBeNull();
        expect(within(box).queryByRole('button', { name: /^A club/ })).toBeNull();
        expect(within(box).queryByRole('button', { name: /^Work or volunteer/ })).toBeNull();
        expect(within(box).getByRole('button', { name: /I’m here to follow football/ })).toBeInTheDocument();
    });

    it('opens step 1 for a 17-year-old who follows an adult answer, and shows them the follower’s week', async () => {
        auth.user = { id: nextUser++, dob: `${new Date().getFullYear() - 17}-01-01` };
        mount('/home?welcome=work');
        const box = await dialog();
        expect(within(box).getByRole('heading', { name: 'What brings you to GrassKickZ?' })).toBeInTheDocument();
        expect(within(box).queryByRole('button', { name: 'Play football: For my child' })).toBeNull();
        expect(within(box).queryByRole('button', { name: /^Work or volunteer/ })).toBeNull();
        cleanup();
        // Another 17-year-old whose stored answer is an adult one.
        auth.user = { id: nextUser++, dob: `${new Date().getFullYear() - 17}-01-01` };
        server.prefs = { start: { welcome: { state: 'DONE', choice: 'CHILD', week: [], cardDismissed: false } } };
        mount('/home');
        expect(await screen.findByRole('link', { name: 'Follow clubs near you' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Add your child' })).toBeNull();
    });

    it('treats Skip as following football: the welcome ends and the first week offers following', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=start');
        await user.click(within(await dialog()).getByRole('button', { name: 'Skip' }));
        expect(address()).toBe('/home');
        await waitFor(() => expect(start().welcome).toMatchObject({ state: 'DONE', choice: 'FOLLOW' }));
        expect(await screen.findByRole('heading', { name: 'Your first week' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Follow clubs near you' })).toHaveAttribute('href', '/world/clubs');
    });

    it('ticks the three nearest clubs to follow, follows them and lands on Home', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=start');
        await user.click(within(await dialog()).getByRole('button', { name: /I’m here to follow football/ }));
        const box = await dialog();
        expect(within(box).getByText('Welcome · 2 of 2')).toBeInTheDocument();
        const tiles = await within(box).findByRole('group', { name: 'Clubs to follow' });
        const ticked = within(tiles).getAllByRole('checkbox').filter(input => (input as HTMLInputElement).checked);
        expect(ticked).toHaveLength(3);
        await user.click(within(box).getByRole('button', { name: 'Follow 3 clubs' }));
        await waitFor(() => expect(address()).toBe('/home'));
        expect([...server.followed].sort()).toEqual([5, 6, 7]);
        await waitFor(() => expect(start().welcome).toMatchObject({ state: 'DONE', choice: 'FOLLOW' }));
    });

    it('asks a parent only the birth year and town, keeps only the age, and lands on World’s clubs for that age', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=start');
        await user.click(within(await dialog()).getByRole('button', { name: 'Play football: For my child' }));
        const box = await dialog();
        expect(within(box).getByText('Pick the year to see clubs.')).toBeInTheDocument();
        const year = new Date().getFullYear() - 9;
        await user.selectOptions(within(box).getByRole('combobox', { name: 'Born in' }), String(year));
        expect(await within(box).findByText('Rustavi Juniors')).toBeInTheDocument();
        // The tile carries the programme that takes age 9: its name, ages, how often and what it costs.
        expect(within(box).getByText('U10 Development')).toBeInTheDocument();
        expect(within(box).getByText('Ages 8–10 · 2× a week · 80 GEL / month')).toBeInTheDocument();
        expect(within(box).getByText('Rustavi · 0 km')).toBeInTheDocument();
        expect(server.gets.some(url => url.startsWith('/clubs?') && url.includes('age=9') && url.includes('city=Rustavi'))).toBe(true);
        await user.click(within(box).getByRole('button', { name: 'Show clubs for this age' }));
        // The same source as the list it showed: World's clubs for age 9 in Rustavi.
        await waitFor(() => expect(address()).toBe('/world/clubs?near=Rustavi&age=9'));
        await waitFor(() => expect(start().childAge).toBe(9));
        expect(Object.keys(start())).not.toContain('child');
    });

    it('lands on the town’s clubs when none listed a programme for that age, never an empty list', async () => {
        const user = userEvent.setup();
        server.clubsForAge = [];
        mount('/home?welcome=child');
        const box = await dialog();
        await user.selectOptions(within(box).getByRole('combobox', { name: 'Born in' }), String(new Date().getFullYear() - 5));
        expect(await within(box).findByText('No clubs here yet. World shows more.')).toBeInTheDocument();
        await user.click(within(box).getByRole('button', { name: 'Show clubs for this age' }));
        await waitFor(() => expect(address()).toBe('/world/clubs?near=Rustavi'));
    });

    it('finds the club: the nearest is suggested, the staff link is explained, and the club opens followed', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=club');
        const box = await dialog();
        expect(within(box).getByRole('heading', { name: 'Find your club' })).toBeInTheDocument();
        await user.click(await within(box).findByRole('radio', { name: /Rustavi Steel/ }));
        expect(within(box).getByText('Your club’s admin adds you with the staff link.')).toBeInTheDocument();
        await user.click(within(box).getByRole('button', { name: 'Follow and open' }));
        await waitFor(() => expect(address()).toBe('/clubs/6'));
        expect(server.followed.has(6)).toBe(true);
    });

    it('starts a club in the one create sheet when it is not found', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=club');
        await user.click(within(await dialog()).getByRole('button', { name: 'Not here? Start your club' }));
        expect(address()).toBe('/home?create=club&from=start');
    });

    it('opens page creation for the kind of business picked', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=business');
        await user.click(within(await dialog()).getByRole('button', { name: 'Sponsor' }));
        expect(address()).toBe('/home?create=business&from=start&business=SPONSOR');
        await waitFor(() => expect(start().welcome).toMatchObject({ state: 'DONE', choice: 'BUSINESS' }));
    });

    it('keeps what a person does and Open to work, then opens Jobs & volunteering on it', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=work');
        const box = await dialog();
        server.jobs = { MEDICAL: 2, ALL: 5 };
        await user.click(within(box).getByRole('button', { name: 'Physio' }));
        expect(within(box).getByRole('switch', { name: /Open to work/ })).toBeChecked();
        await user.click(within(box).getByRole('button', { name: 'Show jobs' }));
        await waitFor(() => expect(address()).toBe('/jobs/all?category=MEDICAL'));
        expect(server.professions.items.map(item => item.title)).toEqual(['Physio']);
        expect(server.discovery.openTo).toEqual(['WORK']);
    });

    it('opens jobs on an answer that has listings, or all listings, never an empty search', async () => {
        const user = userEvent.setup();
        server.jobs = { COACHING: 3, ALL: 3 };
        mount('/home?welcome=work');
        const box = await dialog();
        await user.click(within(box).getByRole('button', { name: 'Physio' }));
        await user.click(within(box).getByRole('button', { name: 'Coach' }));
        await user.click(within(box).getByRole('button', { name: 'Show jobs' }));
        await waitFor(() => expect(address()).toBe('/jobs/all?category=COACHING'));
        cleanup();
        auth.user = { id: nextUser++, dob: '1985-05-02' };
        server.jobs = {};
        mount('/home?welcome=work');
        const again = await dialog();
        await user.click(within(again).getByRole('button', { name: 'Physio' }));
        await user.click(within(again).getByRole('button', { name: 'Show jobs' }));
        await waitFor(() => expect(address()).toBe('/jobs/all'));
    });

    it('ticks a first-week step once opened and goes away when dismissed', async () => {
        const user = userEvent.setup();
        server.prefs = { start: { welcome: { state: 'DONE', choice: 'ME', week: [], cardDismissed: false } } };
        mount('/home');
        expect(await screen.findByText('0 of 3')).toBeInTheDocument();
        await user.click(screen.getByRole('link', { name: 'Find a trial that fits you' }));
        await waitFor(() => expect(start().welcome?.week).toEqual(['trials']));
        cleanup();
        mount('/home');
        expect(await screen.findByText('1 of 3')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Dismiss' }));
        await waitFor(() => expect(screen.queryByRole('heading', { name: 'Your first week' })).toBeNull());
    });

    it('opens step 1 for links of the earlier five-step welcome', () => {
        expect(stepFromParam('roles')).toBe('start');
        expect(stepFromParam('profile')).toBe('start');
        expect(stepFromParam('child')).toBe('child');
        expect(stepFromParam('nonsense')).toBeNull();
    });
});
