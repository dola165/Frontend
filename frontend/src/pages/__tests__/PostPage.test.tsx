import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PostPage } from '../PostPage';

vi.mock('../../api/axiosConfig', () => ({
    apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
    DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost:8080' },
}));

vi.mock('../../context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';

const renderPage = () => render(
    <MemoryRouter initialEntries={['/posts/42']}>
        <Routes><Route path="/posts/:postId" element={<PostPage />} /></Routes>
    </MemoryRouter>
);

describe('PostPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ isAuthenticated: false });
    });

    it('renders the exact public post returned by the single-post endpoint', async () => {
        (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {
            id: 42,
            authorId: 7,
            authorName: 'Jordan Lee',
            content: 'The shared training update',
            createdAt: '2026-09-08T08:00:00Z',
            likeCount: 2,
            commentCount: 0,
            isLikedByMe: false,
        } });

        renderPage();

        expect(await screen.findByText('The shared training update')).toBeInTheDocument();
        expect(apiClient.get).toHaveBeenCalledWith('/posts/42');
    });

    it('gives guests a safe unavailable state with a return-aware sign-in link', async () => {
        (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue({ response: { status: 404 } });

        renderPage();

        expect(await screen.findByRole('heading', { name: 'Post unavailable' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Sign in to check' })).toHaveAttribute('href', '/login?next=%2Fposts%2F42');
    });

    it('opens every attachment from a shared post with the keyboard and plays video', async () => {
        const user = userEvent.setup();
        (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
            if (url.endsWith('/comments')) return Promise.resolve({ data: [] });
            return Promise.resolve({ data: {
                id: 42,
                authorId: 7,
                authorName: 'Jordan Lee',
                content: 'Five media update',
                createdAt: '2026-09-08T08:00:00Z',
                likeCount: 2,
                commentCount: 0,
                isLikedByMe: false,
                mediaUrls: [
                    '/uploads/one.jpg',
                    '/uploads/two.jpg',
                    '/uploads/three.jpg',
                    '/uploads/four.jpg',
                    '/uploads/five.mp4',
                ],
            } });
        });

        renderPage();

        const mediaTrigger = await screen.findByRole('button', { name: "Open media from Jordan Lee's post" });
        mediaTrigger.focus();
        await user.keyboard('{Enter}');

        expect(await screen.findByRole('dialog', { name: 'Post by Jordan Lee' })).toBeInTheDocument();
        const nextButton = screen.getByRole('button', { name: 'Next post media' });
        await user.click(nextButton);
        await user.click(nextButton);
        await user.click(nextButton);
        await user.click(nextButton);

        expect(screen.getByText('5 / 5')).toBeInTheDocument();
        const video = document.querySelector('video[controls]');
        expect(video).toHaveAttribute('src', 'http://localhost:8080/uploads/five.mp4');
    });
});
