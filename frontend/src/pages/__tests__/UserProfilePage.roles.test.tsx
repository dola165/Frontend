import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import { UserProfilePage } from '../UserProfilePage';
import { AgentProfilePage } from '../AgentProfilePage';
import type { FeedPostDto } from '../../components/feed/FeedPost';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() }, DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost' } }));
vi.mock('../../components/feed/PostComposer', () => ({ PostComposer: () => null }));
vi.mock('../../components/ui/MediaImage', () => ({ MediaImage: () => null }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function setup(roles: string[], raw = 'FAN', extra = {}, url = '/profile/7?tab=career', posts: FeedPostDto[] = []) {
    vi.mocked(apiClient.get).mockImplementation(async path => ({ data: path === '/users/me' ? { id: 99 }
        : path === '/users/7' ? { id: 7, fullName: 'Football member', username: 'member', role: raw, followerCount: 1, followingCount: 2,
            footballProfile: { roles, appointments: [], entries: [] }, ...extra }
        : path.includes('/portfolio') ? [] : path.includes('/referees/') ? null : { posts } }));
    return render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/profile/:id" element={<UserProfilePage />} /><Route path="/agents/:id" element={<AgentProfilePage />} /></Routes></MemoryRouter>);
}
beforeEach(() => vi.resetAllMocks());

it.each(['COACH', 'REFEREE', 'AGENT', 'CLUB_STAFF'])('gives %s a professional career without player statistics', async role => {
    setup([role], 'ORGANIZER');
    expect(await screen.findByRole('heading', { name: 'Football member' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Career' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Career & qualifications' })).toBeInTheDocument();
    expect(screen.queryByText('Goals', { exact: true })).not.toBeInTheDocument();
});

it('shows player statistics for a secondary player identity', async () => {
    setup(['PARENT', 'PLAYER'], 'PARENT');
    expect(await screen.findByText('Goals', { exact: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Career' })).toBeInTheDocument();
});

it.each(['FAN', 'PARENT', 'VENUE_MANAGER', 'ORGANIZER'])('ignores stale stats URLs for a simple %s profile', async role => {
    setup([role], role, {}, '/profile/7?tab=stats');
    expect(await screen.findByRole('heading', { name: 'Football member' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Career' })).not.toBeInTheDocument();
    expect(screen.queryByText('Goals', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByText('userProfile.aboutTitle')).toBeInTheDocument();
});

it('keeps career and stats hidden on a private professional profile', async () => {
    setup(['COACH', 'PLAYER'], 'PLAYER', { isPrivate: true });
    expect(await screen.findAllByText('This profile is private.')).not.toHaveLength(0);
    expect(screen.queryByRole('tab', { name: 'Career' })).not.toBeInTheDocument();
    expect(screen.queryByText('Goals', { exact: true })).not.toBeInTheDocument();
});

it('redirects an old agent URL to the shared professional profile', async () => {
    setup(['AGENT'], 'AGENT', {}, '/agents/7');
    expect(await screen.findByRole('heading', { name: 'Career & qualifications' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Player representation' })).toBeInTheDocument();
});

it('supports manual keyboard tab activation and identifies the active panel', async () => {
    setup(['COACH']);
    const career = await screen.findByRole('tab', { name: 'Career' });
    expect(career).toHaveAttribute('aria-selected', 'true');
    career.focus();
    fireEvent.keyDown(career, { key: 'Home' });
    const about = screen.getByRole('tab', { name: 'userProfile.tabs.about' });
    expect(about).toHaveFocus();
    expect(career).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(about);
    expect(about).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', about.id);
});

it('shows a labelled video gallery tile without fetching clip bytes before opening it', async () => {
    const clip: FeedPostDto = { id: 11, content: 'Training clip', authorName: 'Football member', createdAt: '2026-09-23T10:00:00Z',
        likeCount: 0, commentCount: 0, isLikedByMe: false, mediaUrls: ['/uploads/training.mp4'] };
    setup(['FAN'], 'FAN', {}, '/profile/7?tab=videos', [clip]);
    expect(await screen.findByRole('button', { name: 'Open video from post 11' })).toBeVisible();
    expect(screen.getByText('Video · Open to play')).toBeVisible();
    expect(document.querySelector('video')).toBeNull();
    expect(vi.mocked(apiClient.get).mock.calls.some(([url]) => String(url).includes('/uploads/training.mp4'))).toBe(false);
});
