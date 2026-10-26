import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { apiClient } from '../../../../api/axiosConfig';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import type { PersonProfile, Profession } from '../../api';
import { PersonLayers } from '../PersonLayers';
import { readFootball } from '../../football/api';
import { PersonSide } from '../PersonSide';
import { PersonProfilePage } from '../PersonProfilePage';
import { personTabFrom, personTabs } from '../personTabs';
import type { PersonView } from '../usePersonProfile';
import { calendarDestination } from '../../../schedule/personal/calendarDestination';

const auth = vi.hoisted(() => ({ user: null as { id: number } | null, status: 'anonymous', sessionId: null as string | null }));
vi.mock('../../../agents/RepresentationPanel', () => ({ RepresentationPanel: () => null, RepresentationShortcut: () => null }));
vi.mock('../../../agents/ClubApproachesPanel', () => ({ ClubApproachesPanel: () => null }));
vi.mock('../../../../api/axiosConfig', () => ({ DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost:8080' }, apiClient: {
    get: vi.fn(async () => ({ data: [] })), post: vi.fn(), put: vi.fn(), delete: vi.fn(),
} }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => auth }));

const player: PersonProfile = {
    id: 30, username: 'saba', fullName: 'Saba Lomidze', role: 'PLAYER', position: 'Striker', preferredFoot: 'Left', heightCm: 171, weightKg: 60,
    followerCount: 2, followingCount: 3, isFollowedByMe: false, dateOfBirth: null,
    roleProfiles: [{ role: 'PLAYER', primary: true, published: true, headline: 'Striker', qualifications: 'Regional camp' }],
    footballProfile: { roles: ['PLAYER'], entries: [], appointments: [{ clubId: 1, clubName: 'Dinamo Academy', logoUrl: null, role: 'PLAYER', title: 'Player · #17', coaching: false, memberSince: '2018-01-01', biography: null, qualifications: null, squads: ['U16 Boys'] }] },
};
const professions: Profession[] = [
    { id: 1, title: 'Photographer', label: 'Photography', detail: null, since: '2019', published: true, verification: 'SELF_REPORTED', verifiedBy: null },
    { id: 2, title: 'Sports psychologist', label: 'Sports psychology', detail: null, since: '2015', published: true, verification: 'CLUB_CONFIRMED', verifiedBy: 'Dinamo Academy' },
];
const view = (overrides: Partial<PersonView>) => ({ profile: player, own: false, roles: ['PLAYER'], hidden: false, possibleMinor: true, professions, professionsFailed: false, ...overrides }) as PersonView;
const english = (text: string) => text;
const georgian = (_text: string, ka: string) => ka;

describe('work and skills recovery', () => {
    const labels = {
        en: { section: 'What you do', error: 'Work and skills couldn’t load', retry: 'Try again', loading: 'Loading work and skills…', add: 'Add', manage: 'Manage', edit: 'Edit', empty: 'Add what you do professionally' },
        ka: { section: 'რას აკეთებთ', error: 'სამუშაო და უნარები ვერ ჩაიტვირთა', retry: 'ხელახლა ცდა', loading: 'იტვირთება…', add: 'დამატება', manage: 'მართვა', edit: 'შეცვლა', empty: 'დაამატეთ თქვენი პროფესია' },
    };
    const later = <T,>() => {
        let resolve!: (value: T) => void;
        const promise = new Promise<T>(done => { resolve = done; });
        return { promise, resolve };
    };
    const mountProfile = async (language: 'en' | 'ka') => {
        const i18n = createInstance();
        await i18n.init({ lng: language, resources: { en: { translation: {} }, ka: { translation: {} } } });
        return render(<I18nextProvider i18n={i18n}><MemoryRouter initialEntries={['/profile/30']}>
            <Link to="/profile/31">Next profile read</Link>
            <Routes><Route path="/profile/:id" element={<PersonProfilePage />} /></Routes>
        </MemoryRouter></I18nextProvider>);
    };
    const section = (title: string) => within(screen.getByRole('heading', { name: title }).closest('section')!);
    const reads = (path: string) => vi.mocked(apiClient.get).mock.calls.filter(([requested]) => requested === path);
    const readonly = () => {
        expect(apiClient.post).not.toHaveBeenCalled(); expect(apiClient.put).not.toHaveBeenCalled(); expect(apiClient.delete).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled(); expect(XMLHttpRequest).not.toHaveBeenCalled();
    };
    beforeEach(() => {
        auth.user = { id: 30 }; auth.status = 'authenticated'; auth.sessionId = 'profile-read-fixture';
        vi.mocked(apiClient.get).mockReset();
        for (const method of [apiClient.post, apiClient.put, apiClient.delete]) vi.mocked(method).mockReset().mockRejectedValue(new Error('Unexpected fixture write'));
        vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected fixture transport'); }));
        vi.stubGlobal('XMLHttpRequest', vi.fn(() => { throw new Error('Unexpected fixture transport'); }));
    });
    afterEach(() => {
        cleanup(); readonly(); vi.unstubAllGlobals();
        auth.user = null; auth.status = 'anonymous'; auth.sessionId = null;
        vi.mocked(apiClient.get).mockReset().mockResolvedValue({ data: [] });
    });

    it.each([
        { language: 'en' as const, populated: true }, { language: 'ka' as const, populated: true },
        { language: 'en' as const, populated: false }, { language: 'ka' as const, populated: false },
    ])('recovers $language failed read into confirmed populated=$populated without treating unknown as empty', async ({ language, populated }) => {
        const words = labels[language];
        const retry = later<{ data: Profession[] }>(); let attempts = 0;
        vi.mocked(apiClient.get).mockImplementation(async path => {
            if (path === '/users/30') return { data: player };
            if (path === '/users/30/professions') {
                if (++attempts === 1) throw { response: { status: 503, data: { detail: 'Profile' } } };
                return retry.promise;
            }
            return { data: path === '/posts/user/30' ? { posts: [] } : [] };
        });
        await mountProfile(language); await screen.findByText(words.error);
        let work = section(words.section);
        expect({ add: Boolean(work.queryByRole('link', { name: words.add })), retry: Boolean(work.queryByRole('button', { name: words.retry })) }).toEqual({ add: false, retry: true });
        expect(work.getByRole('link', { name: words.manage })).toHaveAttribute('href', '/account/football#work');
        expect(work.queryByText(words.empty)).not.toBeInTheDocument();
        fireEvent.click(work.getByRole('button', { name: words.retry }));
        await waitFor(() => expect(attempts).toBe(2));
        work = section(words.section);
        expect(work.getByText(words.loading)).toBeInTheDocument();
        expect(work.queryByRole('button', { name: words.retry })).not.toBeInTheDocument();
        expect(work.queryByRole('link', { name: words.add })).not.toBeInTheDocument();
        const saved = [{ ...professions[0], title: 'Add', detail: 'Profile' }];
        await act(async () => retry.resolve({ data: populated ? saved : [] }));
        work = section(words.section);
        if (populated) {
            expect(work.getByRole('list', { name: language === 'ka' ? 'პროფესიები და უნარები' : 'Professions and skills' })).toHaveTextContent('Add');
            expect(work.getByRole('listitem')).toHaveTextContent('Profile');
            expect(work.getByRole('listitem')).not.toHaveTextContent('პროფილი');
            expect(work.getByRole('link', { name: words.edit })).toHaveAttribute('href', '/account/football#work');
        } else {
            expect(work.getByText(words.empty)).toBeInTheDocument();
            expect(work.getByRole('link', { name: words.add })).toHaveAttribute('href', '/account/football#work');
        }
        expect(reads('/users/30/professions')).toHaveLength(2); expect(reads('/users/30')).toHaveLength(2);
        expect(reads('/posts/user/30')).toHaveLength(1); readonly();
    });

    it('opens a profile whose answer leaves out zero counts, false flags and empty lists', async () => {
        const sparse: Record<string, unknown> = { ...player, followingCount: 1, footballProfile: { roles: ['PLAYER'] } };
        for (const key of ['followerCount', 'isFollowedByMe', 'roleProfiles', 'isPrivate']) delete sparse[key];
        vi.mocked(apiClient.get).mockImplementation(async path => ({ data: path === '/users/30' ? sparse : path === '/posts/user/30' ? { posts: [] } : [] }));
        await mountProfile('en');
        expect(await screen.findByRole('button', { name: /^0\s*followers$/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^1\s*following$/ })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /^Saba Lomidze/ })).toBeInTheDocument();
    });

    it('retires a captured retry and late response when navigation opens a different profile', async () => {
        const old = later<{ data: Profession[] }>(); let oldAttempts = 0;
        vi.mocked(apiClient.get).mockImplementation(async path => {
            if (path === '/users/30') return { data: player };
            if (path === '/users/31') return { data: { ...player, id: 31, fullName: 'Next Person', username: 'next' } };
            if (path === '/users/30/professions') {
                if (++oldAttempts === 1) throw new Error('offline');
                return old.promise;
            }
            if (path === '/users/31/professions') return { data: [{ ...professions[0], title: 'Next skill' }] };
            return { data: path.startsWith('/posts/user/') ? { posts: [] } : [] };
        });
        await mountProfile('en'); await screen.findByText(labels.en.error);
        const captured = section(labels.en.section).getByRole('button', { name: labels.en.retry });
        fireEvent.click(captured);
        await waitFor(() => expect(oldAttempts).toBe(2));
        const signal = reads('/users/30/professions')[1][1]?.signal;
        fireEvent.click(screen.getByRole('link', { name: 'Next profile read' }));
        await screen.findByRole('heading', { name: /^Next Person/ });
        expect(await screen.findByText('Next skill')).toBeInTheDocument();
        expect(signal?.aborted).toBe(true);
        const count = vi.mocked(apiClient.get).mock.calls.length;
        fireEvent.click(captured);
        await act(async () => old.resolve({ data: [{ ...professions[0], title: 'Old private skill' }] }));
        expect(screen.queryByText('Old private skill')).not.toBeInTheDocument();
        expect(section('What Next does').queryByRole('link', { name: /Add|Edit|Manage/ })).not.toBeInTheDocument();
        expect(apiClient.get).toHaveBeenCalledTimes(count);
        expect(reads('/users/31/professions')).toHaveLength(1); readonly();
    });
});

describe('person profile', () => {
    it('shows real lines and career, never a parent line to others, and never presents self-reported facts as verified', () => {
        const football = readFootball({ userId: 30, own: false, publicRole: null, whereYouAre: [
            { line: 'plays:4', kind: 'PLAYS_FOR', title: 'Player', label: 'Player · U16 Boys · Dinamo Academy', club: { id: 1, name: 'Dinamo Academy' }, squads: [{ id: 4, name: 'U16 Boys' }], actions: [{ action: 'leave_club', allowed: true }] },
            { line: 'parent:9', kind: 'PARENT_OF', title: 'Parent', label: 'Parent', child: { id: 9, name: 'Luka' } },
        ], career: { lines: [{ line: 'member:1', kind: 'MEMBER', title: 'Player', label: 'Player · U14', club: { id: 1, name: 'Dinamo Academy' }, squads: [{ id: 2, name: 'U14' }], since: '2022-09-01', until: '2024-06-30' }], counts: { matchesPlayed: 31 } } });
        render(<MemoryRouter><PersonLayers profile={player} football={football} professions={professions} professionsFailed={false} own={false} /></MemoryRouter>);
        const lines = within(screen.getByRole('list', { name: 'Where you are' }));
        expect(lines.getByText('Player · U16 Boys')).toBeInTheDocument();
        expect(screen.queryByText(/Luka/)).not.toBeInTheDocument();
        expect(lines.queryByRole('link', { name: 'Manage' })).not.toBeInTheDocument();
        expect(lines.queryByRole('button', { name: 'Leave' })).not.toBeInTheDocument();
        expect(screen.getByLabelText('Career in numbers')).toHaveTextContent('31 matches played');
        expect(within(screen.getByRole('list', { name: 'Career' })).getByText('Player · U14')).toBeInTheDocument();
        const work = within(screen.getByRole('list', { name: 'Professions and skills' }));
        expect(work.getByText('Self-reported')).toBeInTheDocument();
        expect(work.getByText('Confirmed by Dinamo Academy')).toBeInTheDocument();
        expect(screen.queryByText(/Qualifications/)).not.toBeInTheDocument();
    });

    it('keeps a possible minor’s body measurements off other people’s view', () => {
        render(<MemoryRouter><PersonSide view={view({})} /></MemoryRouter>);
        expect(screen.getByText('Striker')).toBeInTheDocument();
        expect(screen.queryByText('171 cm')).not.toBeInTheDocument();
        expect(screen.queryByText('60 kg')).not.toBeInTheDocument();
    });

    it('offers the schedule only on your own profile and only the overview of a private profile', () => {
        expect(personTabs({ own: true, hidden: false, career: true }, english).map(tab => tab.id)).toEqual(['overview', 'posts', 'career', 'media', 'schedule']);
        expect(personTabs({ own: false, hidden: false, career: false }, english).map(tab => tab.id)).toEqual(['overview', 'posts', 'media']);
        expect(personTabs({ own: false, hidden: true, career: true }, english).map(tab => tab.id)).toEqual(['overview']);
        const others = personTabs({ own: false, hidden: false, career: true }, english);
        expect(personTabFrom('schedule', others)).toBe('overview');
        expect(personTabFrom('stats', others)).toBe('career');
        expect(personTabFrom('videos', others)).toBe('media');
        expect(personTabs({ own: true, hidden: false, career: true }, georgian).map(tab => tab.label)).toEqual(['ჩემ შესახებ', 'პოსტები', 'კარიერა', 'ფოტოები და ვიდეოები', 'განრიგი']);
        expect(personTabFrom('about', others)).toBe('overview');
    });

    it('calls the first tab About me on your own profile and About on someone else’s, never Overview', () => {
        expect(personTabs({ own: true, hidden: false, career: false }, english)[0].label).toBe('About me');
        expect(personTabs({ own: false, hidden: false, career: false }, english)[0].label).toBe('About');
        expect(personTabs({ own: false, hidden: true, career: false }, english)[0].label).toBe('About');
        expect(personTabs({ own: false, hidden: false, career: false }, georgian)[0].label).toBe('შესახებ');
    });

    it.each([
        { language: 'en', error: 'Followed clubs couldn’t load.', retry: 'Try again', empty: 'Follow clubs to see their posts on Home.' },
        { language: 'ka', error: 'გამოწერილი კლუბები ვერ ჩაიტვირთა.', retry: 'ხელახლა ცდა', empty: 'გამოიწერეთ კლუბები და მათი პოსტები მთავარ გვერდზე გამოჩნდება.' },
    ])('recovers a failed followed-club read in $language without pretending the list is empty', async ({ language, error, retry, empty }) => {
        vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: [{ id: 1, name: 'Dinamo Academy' }] });
        const i18n = createInstance();
        await i18n.init({ lng: language, resources: { en: { translation: {} }, ka: { translation: {} } } });
        render(<I18nextProvider i18n={i18n}><MemoryRouter><PersonSide view={view({ own: true })} /></MemoryRouter></I18nextProvider>);
        expect(await screen.findByRole('alert')).toHaveTextContent(error);
        expect(screen.queryByText(empty)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: retry }));
        expect(await screen.findByRole('link', { name: 'Dinamo Academy' })).toHaveAttribute('href', '/clubs/1');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('sends every old calendar link to the schedule that now owns it', () => {
        expect(calendarDestination('')).toBe('/profile/me?tab=schedule');
        expect(calendarDestination('?eventId=355&date=2026-10-12')).toBe('/profile/me?tab=schedule&eventId=355&date=2026-10-12');
        expect(calendarDestination('?scope=squad&squadId=105&sessionId=9')).toBe('/squads/105?tab=sessions&sessionId=9');
        expect(calendarDestination('?clubId=1')).toBe('/clubs/1/workspace?tab=calendar');
        expect(calendarDestination('?scope=personal')).toBe('/profile/me?tab=schedule');
        expect(calendarDestination('?scope=squad')).toBe('/my-squads?tab=calendar');
    });
});
