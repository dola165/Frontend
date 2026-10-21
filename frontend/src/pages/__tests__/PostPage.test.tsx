import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
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

const renderPage = (initialEntry = '/posts/42') => render(
    <MemoryRouter initialEntries={[initialEntry]}>
        <Link to="/posts/2">Open post 2</Link>
        <Link to="/posts/1">Return post 1</Link>
        <Routes><Route path="/posts/:postId" element={<PostPage />} /></Routes>
    </MemoryRouter>
);

const post = (id: number, content: string) => ({
    id,
    authorId: 7,
    authorName: 'Jordan Lee',
    content,
    createdAt: '2026-09-08T08:00:00Z',
    likeCount: 0,
    commentCount: 1,
    isLikedByMe: false,
});

const comment = (id: number, content: string) => ({
    id,
    authorName: 'Casey',
    content,
    createdAt: '2026-09-08T09:00:00Z',
});

const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((resolvePromise) => {
        resolve = resolvePromise;
    });
    return { promise, resolve };
};

describe('PostPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ isAuthenticated: false });
    });

    it('ignores a saved comment response from an earlier visit to the same post', async () => {
        const user = userEvent.setup();
        vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true } as ReturnType<typeof useAuth>);
        const submitted = deferred<{ data: ReturnType<typeof comment> }>();
        const saved = comment(99, 'Saved exactly once');
        let onServer = false;
        vi.mocked(apiClient.post).mockReturnValue(submitted.promise);
        vi.mocked(apiClient.get).mockImplementation(async (url) => ({
            data: String(url).endsWith('/comments') ? (onServer ? [saved] : []) : {
                ...post(Number(String(url).split('/').at(-1)), `Post ${url}`),
                commentCount: onServer ? 1 : 0,
            },
        }));
        renderPage('/posts/1');
        await screen.findByText('Post /posts/1');
        await user.click(screen.getByRole('button', { name: 'Comment' }));
        await user.type(screen.getByRole('textbox'), saved.content);
        await user.click(screen.getByRole('button', { name: 'Post comment' }));
        await user.click(screen.getByRole('link', { name: 'Open post 2' }));
        await screen.findByText('Post /posts/2');
        onServer = true;
        await user.click(screen.getByRole('link', { name: 'Return post 1' }));
        await screen.findByText('Post /posts/1');
        await user.click(screen.getByRole('button', { name: 'Comment' }));
        expect(await screen.findByText(saved.content)).toBeInTheDocument();
        await act(async () => submitted.resolve({ data: saved }));
        expect(screen.getAllByText(saved.content)).toHaveLength(1);
        expect(screen.getByText('1 comment')).toBeInTheDocument();
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

    it('starts omitted interaction defaults at zero and updates them after a like and comment', async () => {
        const user = userEvent.setup();
        vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true } as ReturnType<typeof useAuth>);
        vi.mocked(apiClient.get).mockImplementation(async url => ({ data: String(url).endsWith('/comments') ? [] : {
            id: 42, authorId: 7, authorName: 'Jordan Lee', content: 'A brand new post', createdAt: '2026-09-08T08:00:00Z',
        } }));
        vi.mocked(apiClient.put).mockResolvedValue({ data: { id: 42, myReaction: 'LIKE', reactionCount: 1, reactionCounts: { LIKE: 1 }, likeCount: 1, isLikedByMe: true } });
        vi.mocked(apiClient.post).mockResolvedValue({ data: comment(12, 'Great album') });
        renderPage();
        expect(await screen.findByText('A brand new post')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Reacted by/ })).not.toBeInTheDocument();
        expect(screen.getByText('0 comments')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'React' }));
        expect(await screen.findByRole('button', { name: 'Reacted by 1 person' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Safe hands' })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Comment' }));
        await user.type(screen.getByRole('textbox'), 'Great album');
        await user.click(screen.getByRole('button', { name: 'Post comment' }));
        expect(await screen.findByText('1 comment')).toBeInTheDocument();
        expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    });

    it('gives guests a safe unavailable state with a return-aware sign-in link', async () => {
        (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue({ response: { status: 404 } });

        renderPage();

        expect(await screen.findByRole('heading', { name: 'Post unavailable' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Sign in to check' })).toHaveAttribute('href', '/login?next=%2Fposts%2F42');
    });

    it('opens every attachment from a shared post with the keyboard and plays video', async () => {
        const user = userEvent.setup();
        const createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
        const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:post-page-media' });
        Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
        (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
            if (url.includes('/uploads/')) return Promise.resolve({ data: new Blob(['fixture media']) });
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
        await waitFor(() => expect(video).toHaveAttribute('src', 'blob:post-page-media'));
        expect(apiClient.get).toHaveBeenCalledWith('http://localhost:8080/uploads/five.mp4', expect.objectContaining({ responseType: 'blob' }));
        if (createDescriptor) Object.defineProperty(URL, 'createObjectURL', createDescriptor); else Reflect.deleteProperty(URL, 'createObjectURL');
        if (revokeDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeDescriptor); else Reflect.deleteProperty(URL, 'revokeObjectURL');
    });

    it('clears comments and loads the new post comments after route navigation', async () => {
        const user = userEvent.setup();
        (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
            if (url === '/posts/1') return Promise.resolve({ data: post(1, 'First post') });
            if (url === '/posts/1/comments') return Promise.resolve({ data: [comment(11, 'First post comment')] });
            if (url === '/posts/2') return Promise.resolve({ data: post(2, 'Second post') });
            if (url === '/posts/2/comments') return Promise.resolve({ data: [comment(22, 'Second post comment')] });
            return Promise.reject(new Error(`Unexpected request: ${url}`));
        });

        renderPage('/posts/1');
        expect(await screen.findByText('First post')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Comment' }));
        expect(await screen.findByText('First post comment')).toBeInTheDocument();
        await user.type(screen.getByRole('textbox', { name: "Write a comment on Jordan Lee's post" }), 'Draft for first post');

        await user.click(screen.getByRole('link', { name: 'Open post 2' }));
        expect(await screen.findByText('Second post')).toBeInTheDocument();
        expect(screen.queryByText('First post comment')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Comment' }));
        expect(await screen.findByText('Second post comment')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: "Write a comment on Jordan Lee's post" })).toHaveValue('');
        expect(apiClient.get).toHaveBeenCalledWith('/posts/2/comments');
    });

    it('ignores an older post response that arrives after the new route loads', async () => {
        const user = userEvent.setup();
        const firstResponse = deferred<{ data: ReturnType<typeof post> }>();
        const secondResponse = deferred<{ data: ReturnType<typeof post> }>();
        (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
            if (url === '/posts/1') return firstResponse.promise;
            if (url === '/posts/2') return secondResponse.promise;
            return Promise.reject(new Error(`Unexpected request: ${url}`));
        });

        renderPage('/posts/1');
        await user.click(screen.getByRole('link', { name: 'Open post 2' }));
        await act(async () => secondResponse.resolve({ data: post(2, 'Second post') }));
        expect(await screen.findByText('Second post')).toBeInTheDocument();

        await act(async () => firstResponse.resolve({ data: post(1, 'Stale first post') }));
        expect(screen.queryByText('Stale first post')).not.toBeInTheDocument();
        expect(screen.getByText('Second post')).toBeInTheDocument();
    });

    it('ignores old comments that arrive after comments for the new route', async () => {
        const user = userEvent.setup();
        const firstComments = deferred<{ data: ReturnType<typeof comment>[] }>();
        (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
            if (url === '/posts/1') return Promise.resolve({ data: post(1, 'First post') });
            if (url === '/posts/1/comments') return firstComments.promise;
            if (url === '/posts/2') return Promise.resolve({ data: post(2, 'Second post') });
            if (url === '/posts/2/comments') return Promise.resolve({ data: [comment(22, 'Current comment')] });
            return Promise.reject(new Error(`Unexpected request: ${url}`));
        });

        renderPage('/posts/1');
        expect(await screen.findByText('First post')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Comment' }));
        await user.click(screen.getByRole('link', { name: 'Open post 2' }));
        expect(await screen.findByText('Second post')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Comment' }));
        expect(await screen.findByText('Current comment')).toBeInTheDocument();

        await act(async () => firstComments.resolve({ data: [comment(11, 'Stale comment')] }));
        expect(screen.queryByText('Stale comment')).not.toBeInTheDocument();
        expect(screen.getByText('Current comment')).toBeInTheDocument();
    });
});
