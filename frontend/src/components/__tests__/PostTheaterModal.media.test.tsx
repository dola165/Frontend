import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { PostTheaterModal } from '../PostTheaterModal';
import type { FeedPostDto } from '../feed/FeedPost';

vi.mock('../../android/bridge', () => ({ isAndroidApp: true }));
vi.mock('../../api/axiosConfig', () => ({
    apiClient: { get: vi.fn() },
    DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost:3000/' },
}));

import { apiClient } from '../../api/axiosConfig';

const post: FeedPostDto = {
    id: 1, content: 'Training update', authorName: 'Jordan', createdAt: '2026-09-02T08:00:00Z',
    likeCount: 0, commentCount: 0, isLikedByMe: false,
    mediaUrls: ['/uploads/portrait.jpg', '/uploads/drill.mp4', '/uploads/team.jpg'],
};
const callbacks = () => ({ onClose: vi.fn(), onSubmitComment: vi.fn(), onLikeToggle: vi.fn() });

beforeEach(() => { vi.mocked(apiClient.get).mockImplementation(async url => ({ data: url.endsWith('/comments') ? [] : post })); });
afterEach(cleanup);

it('withholds old media until the canonical post allows it and never revives revoked photos', async () => {
    let resolve!: (value: { data: FeedPostDto }) => void;
    vi.mocked(apiClient.get).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    render(<PostTheaterModal isOpen post={post} {...callbacks()} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Checking current post access');
    await act(async () => resolve({ data: { ...post, mediaUrls: [] } }));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(document.querySelector('video')).toBeNull();
});

it('keeps a deleted or hidden source out of the viewer even with a previously loaded media URL', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce({ response: { status: 404 } });
    render(<PostTheaterModal isOpen post={post} {...callbacks()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

it('fills the viewer stage with one contained active image and supports keyboard navigation', async () => {
    const actions = callbacks();
    render(<PostTheaterModal isOpen post={post} initialMediaIndex={0} {...actions} />);
    const image = await screen.findByRole('img', { name: 'Post media in viewer' });
    expect(image.className).toContain('h-full w-full object-contain');
    expect(image).toHaveAttribute('src', `${location.origin}/uploads/portrait.jpg`);
    expect(screen.getAllByRole('img')).toHaveLength(1);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    const video = document.querySelector('video')!;
    expect(video).toHaveAttribute('src', `${location.origin}/uploads/drill.mp4`);
    expect(video).toHaveAttribute('preload', 'metadata');
    expect(video).not.toHaveAttribute('autoplay');
    expect(video.className).toContain('h-full w-full object-contain');

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'ArrowRight' });
    expect(document.querySelector('video')).toBe(video);
    fireEvent.click(screen.getByRole('button', { name: 'Next post media' }));
    expect(screen.getByRole('img', { name: 'Post media in viewer' })).toHaveAttribute('src', `${location.origin}/uploads/team.jpg`);
    expect(document.querySelector('video')).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(actions.onClose).toHaveBeenCalledOnce());
});

it('releases the active video when the viewer closes', async () => {
    const actions = callbacks();
    const view = render(<PostTheaterModal isOpen post={post} initialMediaIndex={1} {...actions} />);
    await waitFor(() => expect(document.querySelector('video')).toHaveAttribute('src', `${location.origin}/uploads/drill.mp4`));
    act(() => view.rerender(<PostTheaterModal isOpen={false} post={post} initialMediaIndex={1} {...actions} />));
    expect(document.querySelector('video')).toBeNull();
});

it('rechecks commenter privacy instead of rendering a cached name or avatar in the viewer', async () => {
    const current = { id: 70, content: 'Current public comment', authorName: null, authorAvatarUrl: null, createdAt: post.createdAt };
    vi.mocked(apiClient.get).mockImplementation(async url => ({ data: url.endsWith('/comments') ? [current] : post }));
    render(<PostTheaterModal isOpen post={post} commentsData={[{ ...current, authorName: 'Retired child identity', authorAvatarUrl: '/uploads/retired-child.jpg' }]} {...callbacks()} />);
    await screen.findByRole('article', { name: 'Comment by Member' });
    expect(screen.queryByText('Retired child identity')).not.toBeInTheDocument();
    expect(document.querySelector('img[src*="retired-child"]')).toBeNull();
});
