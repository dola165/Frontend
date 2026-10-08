import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { TabMedia } from '../TabMedia';
import { PostPage } from '../../../../pages/PostPage';
import type { FeedPostDto } from '../../../feed/FeedPost';

vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); server.resetHandlers(); });
const post = (id: number, urls = [`https://images.test/${id}.jpg`]): FeedPostDto => ({ id, clubId: 7, content: `Match ${id}`, authorName: 'Club coach', createdAt: '2026-09-13T12:00:00Z', mediaUrls: urls, likeCount: 1, commentCount: 0, isLikedByMe: false });
const renderGallery = () => render(<MemoryRouter><TabMedia clubId={7} mediaType="pictures" /></MemoryRouter>);

it('loads one media page at a time by cursor and preserves the visible page while a failed page retries', async () => {
    const cursors: Array<string | null> = []; let failed = false;
    server.use(http.get('*/posts/club/7', ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor'); cursors.push(cursor);
        if (cursor && !failed) { failed = true; return new HttpResponse(null, { status: 503 }); }
        return HttpResponse.json(cursor ? { posts: [post(80)], nextCursor: null } : { posts: [post(100)], nextCursor: 99 });
    }));
    renderGallery(); await screen.findByRole('link', { name: 'Open photo 1 from Match 100' });
    fireEvent.click(screen.getByRole('button', { name: 'Load older posts' }));
    await screen.findByRole('alert'); expect(screen.getByRole('link', { name: 'Open photo 1 from Match 100' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Retry media' }));
    await screen.findByRole('link', { name: 'Open photo 1 from Match 80' });
    expect(screen.queryByRole('link', { name: 'Open photo 1 from Match 100' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Newer posts' }));
    await screen.findByRole('link', { name: 'Open photo 1 from Match 100' });
    expect(cursors).toEqual([null, '99', '99', null]);
});

it('shows a retryable initial failure rather than claiming no media exists', async () => {
    let attempts = 0;
    server.use(http.get('*/posts/club/7', () => ++attempts === 1 ? new HttpResponse(null, { status: 503 }) : HttpResponse.json({ posts: [], nextCursor: null })));
    renderGallery(); await screen.findByRole('alert');
    expect(screen.queryByText('No photos published yet.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry media' }));
    expect(await screen.findByText('No photos published yet.')).toBeVisible();
});

it('can keep searching older posts when the first page contains no photos', async () => {
    server.use(http.get('*/posts/club/7', ({ request }) => HttpResponse.json(new URL(request.url).searchParams.has('cursor')
        ? { posts: [post(80)], nextCursor: null } : { posts: [post(100, [])], nextCursor: 99 })));
    renderGallery(); await screen.findByText('No photos in the posts loaded so far.');
    fireEvent.click(screen.getByRole('button', { name: 'Load older posts' }));
    await screen.findByRole('link', { name: 'Open photo 1 from Match 80' });
});

it('keeps only one gallery page mounted and returns directly to the latest page', async () => {
    server.use(http.get('*/posts/club/7', ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        return HttpResponse.json(cursor === '79' ? { posts: [post(60)], nextCursor: null }
            : cursor === '99' ? { posts: [post(80)], nextCursor: 79 }
                : { posts: [post(100)], nextCursor: 99 });
    }));
    renderGallery();
    await screen.findByRole('link', { name: 'Open photo 1 from Match 100' });
    fireEvent.click(screen.getByRole('button', { name: 'Load older posts' }));
    await screen.findByRole('link', { name: 'Open photo 1 from Match 80' });
    fireEvent.click(screen.getByRole('button', { name: 'Load older posts' }));
    await screen.findByRole('link', { name: 'Open photo 1 from Match 60' });
    expect(screen.getAllByRole('link')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Back to latest' }));
    await screen.findByRole('link', { name: 'Open photo 1 from Match 100' });
    expect(screen.getAllByRole('link')).toHaveLength(1);
});

it('does not request video bytes for gallery thumbnails', async () => {
    server.use(http.get('*/posts/club/7', () => HttpResponse.json({ posts: [post(100, ['https://media.test/drill.mp4'])], nextCursor: null })));
    render(<MemoryRouter><TabMedia clubId={7} mediaType="videos" /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Open video 1 from Match 100' })).toBeVisible();
    expect(document.querySelector('video')).toBeNull();
});

it('refresh retry starts from the first page rather than the previous pagination cursor', async () => {
    const cursors: Array<string | null> = []; let attempts = 0;
    server.use(http.get('*/posts/club/7', ({ request }) => {
        cursors.push(new URL(request.url).searchParams.get('cursor'));
        return ++attempts === 2 ? new HttpResponse(null, { status: 503 }) : HttpResponse.json({ posts: [post(100 + attempts)], nextCursor: 99 });
    }));
    renderGallery(); await screen.findByRole('link', { name: 'Open photo 1 from Match 101' });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh photos' })); await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Retry media' })); await screen.findByRole('link', { name: 'Open photo 1 from Match 103' });
    expect(cursors).toEqual([null, null, null]); expect(screen.queryByRole('link', { name: 'Open photo 1 from Match 101' })).toBeNull();
});

it('rejects a stalled cursor without appending a repeated page', async () => {
    server.use(http.get('*/posts/club/7', () => HttpResponse.json({ posts: [post(100)], nextCursor: 99 })));
    renderGallery(); await screen.findByRole('link', { name: 'Open photo 1 from Match 100' });
    fireEvent.click(screen.getByRole('button', { name: 'Load older posts' })); await screen.findByRole('alert');
    expect(screen.getAllByRole('link')).toHaveLength(1);
});

it('opens the selected album image in the existing post viewer with working media controls', async () => {
    const album = post(100, ['https://images.test/first.jpg', 'https://images.test/second.jpg']);
    server.use(http.get('*/posts/club/7', () => HttpResponse.json({ posts: [album], nextCursor: null })),
        http.get('*/posts/100', () => HttpResponse.json(album)), http.get('*/posts/100/comments', () => HttpResponse.json([])));
    render(<MemoryRouter initialEntries={['/clubs/7']}><Routes>
        <Route path="/clubs/:id" element={<TabMedia clubId={7} mediaType="pictures" />} />
        <Route path="/posts/:postId" element={<PostPage />} />
    </Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole('link', { name: 'Open photo 2 from Match 100' }));
    await screen.findByRole('dialog', { name: 'Post by Club coach' });
    await waitFor(() => expect(screen.getByAltText('Post media in viewer')).toHaveAttribute('src', 'https://images.test/second.jpg'));
    fireEvent.click(screen.getByRole('button', { name: 'Previous post media' }));
    expect(screen.getByAltText('Post media in viewer')).toHaveAttribute('src', 'https://images.test/first.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Close post viewer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
});

it('ignores a late gallery response after switching clubs', async () => {
    let release!: () => void; const response = new Promise<void>(resolve => { release = resolve; });
    let started!: () => void; const observed = new Promise<void>(resolve => { started = resolve; });
    server.use(http.get('*/posts/club/7', async () => { started(); await response; return HttpResponse.json({ posts: [post(100)], nextCursor: null }); }),
        http.get('*/posts/club/8', () => HttpResponse.json({ posts: [{ ...post(200), clubId: 8 }], nextCursor: null })));
    const { rerender } = renderGallery(); await observed;
    rerender(<MemoryRouter><TabMedia clubId={8} mediaType="pictures" /></MemoryRouter>);
    await screen.findByRole('link', { name: 'Open photo 1 from Match 200' });
    await act(async () => release());
    expect(screen.queryByRole('link', { name: 'Open photo 1 from Match 100' })).toBeNull();
});
