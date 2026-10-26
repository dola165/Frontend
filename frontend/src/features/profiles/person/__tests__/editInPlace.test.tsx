import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { apiClient } from '../../../../api/axiosConfig';
import { PersonProfilePage } from '../PersonProfilePage';

const auth = vi.hoisted(() => ({ user: { id: 7, dob: '1992-05-14' } as Record<string, unknown>, status: 'authenticated', sessionId: 'edit-in-place', refreshNavigationCapabilities: vi.fn(async () => undefined) }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../agents/RepresentationPanel', () => ({ RepresentationPanel: () => null, RepresentationShortcut: () => null }));
vi.mock('../../../agents/ClubApproachesPanel', () => ({ ClubApproachesPanel: () => null }));
vi.mock('../../../../api/axiosConfig', () => ({ DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost:8080' }, apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

const nino = { id: 7, username: 'nino', fullName: 'Nino Beridze', role: 'FAN', followerCount: 0, followingCount: 0, isFollowedByMe: false, bio: '', avatarUrl: null, bannerUrl: null };
function serve() {
    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
        if (path === '/users/7') return { data: nino };
        if (path === '/users/7/football-profile') return { data: { userId: 7, own: true, publicRole: null, roleChoices: [], revision: 0, whereYouAre: [], career: { lines: [], counts: { sessionsCoached: 0, matchesPlayed: 0, matchesRefereed: 0 } } } };
        if (path === '/users/me/professions') return { data: { items: [], version: 1 } };
        if (path === '/users/me/discovery') return { data: { openTo: [], licence: null, rate: null, version: 1 } };
        if (path.startsWith('/posts/user/')) return { data: { posts: [] } };
        return { data: [] };
    });
}
const mount = (search = '') => render(<MemoryRouter initialEntries={[`/profile/7${search}`]}><Routes><Route path="/profile/:id" element={<PersonProfilePage />} /></Routes></MemoryRouter>);
beforeAll(() => { Element.prototype.scrollIntoView = vi.fn(); });
afterEach(() => { cleanup(); vi.mocked(apiClient.get).mockReset(); vi.mocked(apiClient.put).mockReset(); });

describe('making your profile, in place', () => {
    it('shows each empty part with one action: photo, cover, about me, what you do, and where to start', async () => {
        serve(); mount();
        expect(await screen.findByRole('button', { name: 'Add photo' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add cover' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Write about you' })).toBeInTheDocument();
        expect(await screen.findByRole('button', { name: 'Add what you do' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Join a squad/ })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'About me' })).toBeInTheDocument();
    });

    it('writes About me where it is shown and keeps it after Done', async () => {
        serve(); mount();
        vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
        fireEvent.click(await screen.findByRole('button', { name: 'Write about you' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'About me' }), { target: { value: 'Goalkeeper coach in Tbilisi.' } });
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/users/me', { bio: 'Goalkeeper coach in Tbilisi.' }));
        expect(await screen.findByText('Goalkeeper coach in Tbilisi.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    });

    it('opens What you do in place from ?edit=work (the first week’s link)', async () => {
        serve(); mount('?edit=work');
        const work = within((await screen.findByRole('heading', { name: 'What you do' })).closest('section')!);
        expect(await work.findByRole('group', { name: 'What you do' })).toBeInTheDocument();
        expect(work.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
});
