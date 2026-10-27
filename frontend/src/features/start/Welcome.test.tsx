import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import i18n from '../../i18n';
import { applyPreferencesUpdate, type Preferences } from '../preferences/preferencesStore';
import { FirstWeek } from './FirstWeek';
import { WelcomeHost } from './WelcomeHost';
import { finished, stepFromParam, weekDone } from './welcomeSteps';

// A fake server: preferences, where the person is, clubs near them and by age, follows, professions and discovery.
const server = vi.hoisted(() => ({
    prefs: {} as Record<string, unknown>, followed: new Set<number>(), gets: [] as string[],
    /** Open listings near the person, by job category (ALL: no category); clubs for an age, when set. */
    jobs: {} as Record<string, number>, clubsForAge: null as null | unknown[],
    professions: { items: [] as { id: number; title: string; detail: null; since: null; published: boolean; label: null }[], version: 0 },
    discovery: { openTo: [] as string[], licence: null, rate: null, version: 0 },
    /** Staff jobs this person was invited to and has not answered (`/club-operations/mine`). */
    invitedJobs: [] as unknown[],
    /** `/pages/mine` fails (whether the person already has a club cannot be checked). */
    pagesFail: false,
    posts: [] as { url: string; body: unknown }[], puts: [] as { url: string; body: unknown }[],
}));
const auth = vi.hoisted(() => ({ user: { id: 0, dob: '1985-05-02' } as { id: number; dob: string; navigationCapabilities?: unknown } }));
vi.mock('../../api/axiosConfig', async original => ({ ...(await original<object>()), apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('../../utils/authStorage', async original => ({ ...(await original<object>()), isCurrentAuthSession: () => true }));
vi.mock('../../context/AuthContext', () =>({ useAuth: () => ({ user: auth.user, sessionId: 'session', status: 'authenticated', refreshNavigationCapabilities: async () => undefined }) }));

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
    server.invitedJobs = []; server.posts = []; server.puts = []; server.pagesFail = false;
    vi.mocked(apiClient.get).mockImplementation(async (url: string, config?: { params?: unknown }) => {
        server.gets.push(url);
        if (url === '/pages/mine' && server.pagesFail) throw new Error('Network Error');
        if (url === '/staff-invite/NET') throw new Error('Network Error');
        if (url === '/club-operations/mine') return { data: { appointments: server.invitedJobs, permissions: [], clubs: [] } };
        if (url === '/clubs/41/page') return { data: { identity: { version: 3 } } };
        if (url === '/staff-invite/ABC123') return { data: { clubId: 9, clubName: 'Rustavi Juniors', clubLogoUrl: null, job: 'ASSISTANT_COACH', title: 'Assistant coach', clubWide: true, squads: [], invitedBy: null, status: 'ACTIVE', expiresAt: '2026-11-03T00:00:00Z' } };
        if (url === '/jobs/listings') {
            const category = String((config?.params as { category?: string } | undefined)?.category ?? 'ALL');
            const total = server.jobs[category] ?? 0;
            return { data: { content: total ? [{ id: 700 + total, title: `${category} help wanted`, clubName: 'Rustavi Juniors', clubCityName: 'Rustavi', distanceKm: 2 }] : [], totalElements: total } };
        }
        if (url.startsWith('/clubs?') && server.clubsForAge) return { data: { content: server.clubsForAge, pageNumber: 0, pageSize: 8, totalElements: 0, totalPages: 0 } };
        if (url.startsWith('/clubs?')) return { data: { content: [{ id: 9, name: 'Rustavi Juniors', cityName: 'Rustavi', followerCount: 3, isFollowedByMe: false, latitude: 41.5495, longitude: 45.0012, presentation: { profileKind: 'ACADEMY', revision: 1, canEdit: false, sponsors: [], affiliations: [], programmes: [
            { name: 'U10 Development', ageMin: 8, ageMax: 10, sessionsPerWeek: 2, priceType: 'FIXED', amount: '80', currency: 'GEL', billingPeriod: 'MONTH', trialAmount: null, joiningFee: null, equipmentFee: null, details: null, published: true },
        ] } }], pageNumber: 0, pageSize: 8, totalElements: 1, totalPages: 1 } };
        if (url === '/clubs/near-you') return { data: [club(5, 'Rustavi Lions', 1), club(6, 'Rustavi Steel', 2), club(7, 'Gardabani Youth', 18), club(8, 'Tbilisi Juniors', 25)] };
        const data: Record<string, unknown> = {
            '/users/me/preferences': server.prefs, '/users/me/place': place, '/users/me/professions': server.professions, '/users/me/discovery': server.discovery,
            '/access/me': { allowed: ['add_child', 'start_club', 'follow'], refused: [] },
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
        if (url.endsWith('/identity')) { server.puts.push({ url, body }); return { data: {} }; }
        server.prefs = applyPreferencesUpdate(server.prefs as Preferences, body as Preferences) as Record<string, unknown>;
        return { data: server.prefs };
    });
    vi.mocked(apiClient.post).mockImplementation(async (url: string, body?: unknown) => {
        server.posts.push({ url, body });
        if (url === '/organizations/setup') return { data: { id: 40, clubId: 41, profilePath: '/clubs/41', workspacePath: '/clubs/41/workspace' } };
        if (url === '/staff-invite/ABC123') return { data: { appointmentId: 90, clubId: 9, clubName: 'Rustavi Juniors', title: 'Assistant coach', squads: [], alreadyJoined: false } };
        if (url.includes('/operations/appointments/')) return { data: {} };
        if (url === '/family/children') return { data: { childId: 55, name: 'Luka Beridze' } };
        server.followed.add(Number(url.split('/')[2])); return { data: { following: true } };
    });
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

    it('shows a parent the clubs for the child’s age inside the welcome, then offers adding the child and opens Parent Hub', async () => {
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
        await user.click(within(box).getByRole('checkbox', { name: /Rustavi Juniors/ }));
        await user.click(within(box).getByRole('button', { name: 'Follow and continue' }));
        let add = await screen.findByRole('dialog', { name: 'Add your child' });
        expect(server.followed.has(9)).toBe(true);
        // A screen of its own in the address: Back returns to the clubs, with the year kept.
        expect(address()).toBe('/home?welcome=child&part=add');
        await user.click(within(add).getByRole('button', { name: 'Back' }));
        expect(within(await screen.findByRole('dialog', { name: 'Clubs for your child' })).getByRole('combobox', { name: 'Born in' })).toHaveValue(String(year));
        await user.click(screen.getByRole('button', { name: 'Follow and continue' }));
        add = await screen.findByRole('dialog', { name: 'Add your child' });
        // The year already given: the date can only fall in it.
        const born = add.querySelector('input[type=date]')!;
        expect(born).toHaveAttribute('min', `${year}-01-01`);
        expect(born).toHaveAttribute('max', `${year}-12-31`);
        await user.type(within(add).getByRole('textbox', { name: 'Child’s full name' }), 'Luka Beridze');
        fireEvent.change(born, { target: { value: `${year}-05-14` } });
        await user.click(within(add).getByRole('checkbox', { name: /parent or legal guardian/ }));
        await user.click(within(add).getByRole('button', { name: 'Create child profile' }));
        await waitFor(() => expect(address()).toBe('/parent?player=55'));
        expect(server.posts.find(post => post.url === '/family/children')?.body).toMatchObject({ fullName: 'Luka Beridze', dateOfBirth: `${year}-05-14`, responsible: true });
        await waitFor(() => expect(start().welcome).toMatchObject({ state: 'DONE', choice: 'CHILD' }));
        expect(start().childAge).toBe(9);
    });

    it('lands a parent who skips adding the child on Home, never on World', async () => {
        const user = userEvent.setup();
        server.clubsForAge = [];
        mount('/home?welcome=child');
        const box = await dialog();
        await user.selectOptions(within(box).getByRole('combobox', { name: 'Born in' }), String(new Date().getFullYear() - 5));
        // No club lists a group for that age: the nearest clubs instead, and it says so.
        expect(await within(box).findByText('None list a group for this age yet. These are the nearest.')).toBeInTheDocument();
        expect(within(box).getByText('Rustavi Lions')).toBeInTheDocument();
        await user.click(within(box).getByRole('button', { name: 'Continue' }));
        await user.click(within(await screen.findByRole('dialog', { name: 'Add your child' })).getByRole('button', { name: 'Not now' }));
        await waitFor(() => expect(address()).toBe('/home'));
        await waitFor(() => expect(start().welcome).toMatchObject({ state: 'DONE', choice: 'CHILD' }));
    });

    it('lets a player follow clubs near them with a heart and finish on Home', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=me');
        const box = await dialog();
        expect(within(box).getByRole('button', { name: 'Finish' })).toBeInTheDocument();
        await user.click(await within(box).findByRole('checkbox', { name: /Rustavi Juniors/ }));
        await user.click(within(box).getByRole('button', { name: 'Follow and finish' }));
        await waitFor(() => expect(address()).toBe('/home'));
        expect(server.followed.has(9)).toBe(true);
        await waitFor(() => expect(start().welcome).toMatchObject({ state: 'DONE', choice: 'ME' }));
    });

    it('starts a club from step 2: the town filled in, the colours chosen, and the new club opens', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=club');
        // Whether the person already has a club is asked first; then the form.
        const box = await screen.findByRole('dialog', { name: 'Start your club' }, { timeout: 10000 });
        await waitFor(() => expect(within(box).getByRole('combobox', { name: 'Town' })).toHaveValue('Rustavi'));
        await user.type(within(box).getByRole('textbox', { name: 'Club name' }), 'Rustavi Kites');
        await user.click(within(box).getByRole('radio', { name: 'Navy, Gold' }));
        await user.click(within(box).getByRole('button', { name: 'Start my club' }));
        await waitFor(() => expect(address()).toBe('/clubs/41?edit=1&new=1'));
        expect(server.posts.find(post => post.url === '/organizations/setup')?.body).toMatchObject({ displayName: 'Rustavi Kites', pageKind: 'CLUB', location: { city: 'Rustavi' } });
        // The crest it showed is the crest the club keeps, saved before the page opens.
        expect(server.puts).toEqual([{ url: '/clubs/41/page/identity', body: { version: 3, crest: { kind: 'generated', design: { shape: 'shield', primary: 'navy', secondary: 'gold', initials: 'RK' }, kept: true } } }]);
        await waitFor(() => expect(start().welcome).toMatchObject({ state: 'DONE', choice: 'CLUB' }));
    });

    it('joins a club the person was invited to: Join accepts the invite and opens the club', async () => {
        const user = userEvent.setup();
        server.invitedJobs = [{ id: 77, club_id: 6, club_name: 'Rustavi Steel', user_id: auth.user.id, title: 'Assistant coach', specialisations: [], engagement: 'VOLUNTEER', squad_id: null, permissions: [], starts_on: '2026-10-27', ends_on: null, status: 'INVITED', effective_status: 'INVITED', revision: 2, published: true, club_wide: true }];
        mount('/home?welcome=club');
        const first = await screen.findByRole('dialog', { name: 'Start your club' }, { timeout: 10000 });
        await user.click(await within(first).findByRole('button', { name: 'Already in a club?' }));
        const box = await screen.findByRole('dialog', { name: 'Find your club' });
        // The invite is there before anything is typed.
        expect(await within(box).findByText('You’re invited')).toBeInTheDocument();
        await user.click(within(box).getByRole('button', { name: 'Join Rustavi Steel' }));
        await waitFor(() => expect(address()).toBe('/clubs/6/workspace'));
        expect(server.posts).toContainEqual({ url: '/clubs/6/operations/appointments/77/transition', body: { status: 'ACTIVE', revision: 2 } });
        await waitFor(() => expect(start().welcome).toMatchObject({ state: 'DONE', choice: 'CLUB' }));
    });

    it('asks for the admin’s code at a club with no invite, and joins with the whole link pasted', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=club');
        const first = await screen.findByRole('dialog', { name: 'Start your club' }, { timeout: 10000 });
        await user.type(await within(first).findByRole('textbox', { name: 'Club name' }), 'Rustavi');
        await user.click(within(first).getByRole('button', { name: 'Already in a club?' }));
        const box = await screen.findByRole('dialog', { name: 'Find your club' });
        // What was typed is the search.
        expect(within(box).getByRole('searchbox', { name: 'Club name' })).toHaveValue('Rustavi');
        expect(address()).toBe('/home?welcome=club&part=find');
        await user.click(await within(box).findByRole('button', { name: 'Join Rustavi Juniors' }));
        // While the code field is open, the club's own Join turns into Cancel: one Join on screen for it.
        expect(within(box).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(within(box).queryByRole('button', { name: 'Join Rustavi Juniors' })).toBeNull();
        await user.type(within(box).getByRole('textbox', { name: 'Enter the code your admin gave you' }), 'https://grasskickz.com/staff-invite/ABC123');
        await user.click(within(box).getAllByRole('button', { name: 'Join' }).at(-1)!);
        await waitFor(() => expect(address()).toBe('/clubs/9/workspace'));
        expect(server.posts.map(post => post.url)).toEqual(['/staff-invite/ABC123']);
    });

    it('goes back to starting the club when no club has that name', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=club');
        const first = await screen.findByRole('dialog', { name: 'Start your club' }, { timeout: 10000 });
        await user.click(await within(first).findByRole('button', { name: 'Already in a club?' }));
        const box = await screen.findByRole('dialog', { name: 'Find your club' });
        server.clubsForAge = [];
        await user.type(within(box).getByRole('searchbox', { name: 'Club name' }), 'Gori Eagles');
        await user.click(await within(box).findByRole('button', { name: 'Start Gori Eagles' }));
        const again = await screen.findByRole('dialog', { name: 'Start your club' });
        expect(within(again).getByRole('textbox', { name: 'Club name' })).toHaveValue('Gori Eagles');
        expect(address()).toBe('/home?welcome=club');
    });

    it('shows someone already on a club’s staff their club with Open, not a new one', async () => {
        const user = userEvent.setup();
        auth.user = { ...auth.user, navigationCapabilities: { version: 1, workspaces: [{ id: 'club.workspace', context: { type: 'club', id: 3, label: 'Rustavi Lions' } }] } };
        mount('/home?welcome=club');
        const box = await dialog();
        expect(within(box).getByRole('heading', { name: 'Your club' })).toBeInTheDocument();
        expect(within(box).getByText('Rustavi Lions')).toBeInTheDocument();
        expect(within(box).queryByRole('button', { name: 'Start my club' })).toBeNull();
        await user.click(within(box).getByRole('button', { name: 'Open' }));
        await waitFor(() => expect(address()).toBe('/clubs/3'));
    });

    it('stays open when the page beside it is clicked; only X or Skip close it', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=start');
        await dialog();
        await user.click(document.querySelector('[data-dialog-backdrop]')!);
        expect(screen.getByRole('dialog', { name: 'What brings you to GrassKickZ?' })).toBeInTheDocument();
        expect(address()).toBe('/home?welcome=start');
        expect(start().welcome?.state).not.toBe('DONE');
        await user.click(screen.getByRole('button', { name: 'Close' }));
        await waitFor(() => expect(address()).toBe('/home'));
    });

    it('leaves a finished answer and its first week alone when the reopened welcome is closed', async () => {
        const user = userEvent.setup();
        const kept = { state: 'DONE', at: null, choice: 'CLUB', week: ['invite-staff'], cardDismissed: true };
        server.prefs = { start: { welcome: kept } };
        mount('/home?welcome=start');
        await user.click(within(await dialog()).getByRole('button', { name: 'Skip' }));
        await waitFor(() => expect(address()).toBe('/home'));
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(start().welcome).toEqual(kept);
    });

    it('keeps the first week for the same answer, starts afresh for a new one, and never stores more than the server takes', () => {
        const done = { state: 'DONE' as const, choice: 'CLUB' as const, week: ['invite-staff', 'Bad step!', 'crest'], cardDismissed: true };
        expect(finished(done, 'club')).toMatchObject({ choice: 'CLUB', week: ['invite-staff', 'crest'], cardDismissed: true });
        expect(finished(done, 'me')).toMatchObject({ choice: 'ME', week: [], cardDismissed: false });
        const many = Array.from({ length: 12 }, (_, index) => `step-${String.fromCharCode(97 + index)}`);
        expect(weekDone({ state: 'DONE', week: many }, 'last').week).toHaveLength(10);
        expect(weekDone({ state: 'DONE', week: many }, 'last').week?.at(-1)).toBe('last');
    });

    it('asks whether the person already has a club before showing the form, and says so when it could not', async () => {
        server.pagesFail = true;
        mount('/home?welcome=club');
        const box = await screen.findByRole('dialog', { name: 'Start your club' }, { timeout: 10000 });
        expect(within(box).getByText('We couldn’t check whether you already have a club.')).toBeInTheDocument();
        server.pagesFail = false;
        await userEvent.setup().click(within(box).getByRole('button', { name: 'Try again' }));
        expect(await screen.findByRole('dialog', { name: 'Start your club' })).toBeInTheDocument();
        await waitFor(() => expect(screen.queryByText('We couldn’t check whether you already have a club.')).toBeNull());
    });

    it('says it could not check a code when the check never arrived, not that the code is wrong', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=club');
        await user.click(within(await screen.findByRole('dialog', { name: 'Start your club' }, { timeout: 10000 })).getByRole('button', { name: 'Already in a club?' }));
        const box = await screen.findByRole('dialog', { name: 'Find your club' });
        await user.type(within(box).getByRole('searchbox', { name: 'Club name' }), 'Rustavi');
        await user.click(await within(box).findByRole('button', { name: 'Join Rustavi Juniors' }));
        await user.type(within(box).getByRole('textbox', { name: 'Enter the code your admin gave you' }), 'NET');
        await user.click(within(box).getByRole('button', { name: 'Join' }));
        expect(await within(box).findByText('Couldn’t check the code just now. Check your connection and try again.')).toBeInTheDocument();
    });

    it('opens again at step 1 after it was finished, from the profile’s link', async () => {
        server.prefs = { start: { welcome: { state: 'DONE', choice: 'FOLLOW', week: [], cardDismissed: false } } };
        mount('/home?welcome=start');
        expect(within(await dialog()).getByRole('heading', { name: 'What brings you to GrassKickZ?' })).toBeInTheDocument();
    });

    it('opens page creation for the kind of business picked', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=business');
        await user.click(within(await dialog()).getByRole('button', { name: 'Sponsor' }));
        expect(address()).toBe('/home?create=business&from=welcome&business=SPONSOR');
        await waitFor(() => expect(start().welcome).toMatchObject({ state: 'DONE', choice: 'BUSINESS' }));
    });

    it('shows the matching listings near the person as chips are tapped, keeps the answers and finishes on Home', async () => {
        const user = userEvent.setup();
        server.jobs = { MEDICAL: 2, ALL: 5 };
        mount('/home?welcome=work');
        const box = await dialog();
        expect(await within(box).findByText('5')).toBeInTheDocument();
        await user.click(within(box).getByRole('button', { name: 'Physio' }));
        expect(await within(box).findByText('2')).toBeInTheDocument();
        expect(within(box).getByText('MEDICAL help wanted')).toBeInTheDocument();
        expect(within(box).getByRole('switch', { name: /Open to work/ })).toBeChecked();
        await user.click(within(box).getByRole('button', { name: 'Finish' }));
        await waitFor(() => expect(address()).toBe('/home'));
        expect(server.professions.items.map(item => item.title)).toEqual(['Physio']);
        expect(server.discovery.openTo).toEqual(['WORK']);
        await waitFor(() => expect(start().welcome).toMatchObject({ state: 'DONE', choice: 'WORK' }));
    });

    it('says plainly when nothing matches and still finishes; See all jobs opens the same search', async () => {
        const user = userEvent.setup();
        mount('/home?welcome=work');
        const box = await dialog();
        await user.click(within(box).getByRole('button', { name: 'Physio' }));
        expect(await within(box).findByText('Nothing near you for that yet. Clubs who need help can still find you.')).toBeInTheDocument();
        await user.click(within(box).getByRole('button', { name: 'See all jobs' }));
        await waitFor(() => expect(address()).toBe('/jobs/all?category=MEDICAL'));
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

    it('does not come back over the create sheet a link asks for', async () => {
        server.prefs = { start: { welcome: { state: 'OPEN', at: 'START' } } };
        mount('/home?create=fan-club&from=home');
        await new Promise(resolve => setTimeout(resolve, 300));
        expect(screen.queryByRole('dialog', { name: 'What brings you to GrassKickZ?' })).toBeNull();
        expect(address()).toBe('/home?create=fan-club&from=home');
    });

    it('opens step 1 for links of the earlier five-step welcome', () => {
        expect(stepFromParam('roles')).toBe('start');
        expect(stepFromParam('profile')).toBe('start');
        expect(stepFromParam('child')).toBe('child');
        expect(stepFromParam('nonsense')).toBeNull();
    });
});
