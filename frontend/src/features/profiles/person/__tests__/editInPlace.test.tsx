import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AboutInPlace } from '../../football/AboutInPlace';
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
/** Where the address is now, and a link that asks for About me while the page is open. */
function Address() { const { search } = useLocation(); return <><output aria-label="address">{search}</output><Link to="/profile/7?edit=about">ask for about</Link></>; }
const mount = (search = '') => render(<MemoryRouter initialEntries={[`/profile/7${search}`]}><Address /><Routes><Route path="/profile/:id" element={<PersonProfilePage />} /></Routes></MemoryRouter>);
beforeAll(() => { Element.prototype.scrollIntoView = vi.fn(); });
beforeEach(() => { auth.user = { id: 7, dob: '1992-05-14' }; });
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

    it('offers a quiet way back into the welcome, at step 1', async () => {
        serve(); mount();
        expect(await screen.findByRole('link', { name: 'Change what brings you here' })).toHaveAttribute('href', '/home?welcome=start');
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
        // A one-time request: it leaves the address once taken, and What you do stays open.
        await waitFor(() => expect(screen.getByLabelText('address')).toHaveTextContent(/^$/));
        expect(work.getByRole('group', { name: 'What you do' })).toBeInTheDocument();
    });

    it('opens About me when ?edit=about arrives while the page is open', async () => {
        serve(); mount();
        expect(await screen.findByRole('button', { name: 'Write about you' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('link', { name: 'ask for about' }));
        expect(await screen.findByRole('textbox', { name: 'About me' })).toBeInTheDocument();
        await waitFor(() => expect(screen.getByLabelText('address')).toHaveTextContent(/^$/));
    });

    it('adds the phone colleagues see in Staff, in place, checks it and removes it', async () => {
        serve(); mount();
        vi.mocked(apiClient.put).mockImplementation(async (_path, body) => ({ data: { ...nino, phone: (body as { phone: string }).phone || null } }));
        const box = within((await screen.findByRole('heading', { name: 'Phone' })).closest('section')!);
        expect(box.getByText('Colleagues see it in Staff')).toBeInTheDocument();
        fireEvent.click(box.getByRole('button', { name: 'Add your phone' }));
        fireEvent.change(box.getByLabelText('Phone'), { target: { value: 'call me' } });
        fireEvent.click(box.getByRole('button', { name: 'Done' }));
        expect(box.getByRole('alert')).toHaveTextContent('Enter a number colleagues can call');
        expect(apiClient.put).not.toHaveBeenCalled();
        fireEvent.change(box.getByLabelText('Phone'), { target: { value: '555123456' } });
        fireEvent.click(box.getByRole('button', { name: 'Done' }));
        await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/users/me', { phone: '555123456' }));
        // Shown as people write it, the same as a club page's phone.
        expect(await box.findByText('+995 555 12 34 56')).toBeInTheDocument();
        fireEvent.click(box.getByRole('button', { name: 'Edit your phone' }));
        fireEvent.click(box.getByRole('button', { name: 'Remove' }));
        await waitFor(() => expect(apiClient.put).toHaveBeenLastCalledWith('/users/me', { phone: '' }));
        expect(await box.findByRole('button', { name: 'Add your phone' })).toBeInTheDocument();
    });

    it('opens the phone from ?edit=phone (Staff’s link), and offers it only to adults on their own profile', async () => {
        serve(); mount('?edit=phone');
        expect(await screen.findByLabelText('Phone')).toHaveFocus();
        cleanup();
        auth.user = { id: 7, dob: '2012-03-01' };
        serve(); mount();
        expect(await screen.findByRole('button', { name: 'Write about you' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Phone' })).not.toBeInTheDocument();
        cleanup();
        auth.user = { id: 9, dob: '1990-01-01' };
        serve(); mount();
        expect(await screen.findByRole('heading', { name: 'Nino Beridze' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Phone' })).not.toBeInTheDocument();
    });

    it('offers Try again after a failed save, also where the box is always open', async () => {
        vi.mocked(apiClient.put).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: {} });
        render(<AboutInPlace bio="" alwaysOpen />);
        const box = screen.getByRole('textbox', { name: 'About me' });
        fireEvent.change(box, { target: { value: 'Physio in Batumi.' } });
        fireEvent.blur(box);
        fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
        expect(await screen.findByText('Saved')).toBeInTheDocument();
        expect(apiClient.put).toHaveBeenLastCalledWith('/users/me', { bio: 'Physio in Batumi.' });
    });
});
