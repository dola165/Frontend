import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PostTheaterModal } from '../PostTheaterModal';
import type { FeedPostDto } from '../feed/FeedPost';

vi.mock('../../android/bridge', () => ({ isAndroidApp: true }));
vi.mock('../../api/axiosConfig', () => ({
    apiClient: { get: vi.fn() },
    DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost:3000/' },
}));

const post: FeedPostDto = {
    id: 1, content: 'Training update', authorName: 'Jordan', createdAt: '2026-09-02T08:00:00Z',
    likeCount: 0, commentCount: 0, isLikedByMe: false,
    mediaUrls: ['/uploads/portrait.jpg', '/uploads/drill.mp4', '/uploads/team.jpg'],
};
const callbacks = () => ({ onClose: vi.fn(), onSubmitComment: vi.fn(), onLikeToggle: vi.fn() });

afterEach(cleanup);

it('fills the viewer stage with one contained active image and supports keyboard navigation', async () => {
    const actions = callbacks();
    render(<PostTheaterModal isOpen post={post} initialMediaIndex={0} {...actions} />);
    const image = screen.getByRole('img', { name: 'Post media in viewer' });
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

it('releases the active video when the viewer closes', () => {
    const actions = callbacks();
    const view = render(<PostTheaterModal isOpen post={post} initialMediaIndex={1} {...actions} />);
    expect(document.querySelector('video')).toHaveAttribute('src', `${location.origin}/uploads/drill.mp4`);
    act(() => view.rerender(<PostTheaterModal isOpen={false} post={post} initialMediaIndex={1} {...actions} />));
    expect(document.querySelector('video')).toBeNull();
});
