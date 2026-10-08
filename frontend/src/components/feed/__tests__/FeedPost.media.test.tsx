import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FeedPost, type FeedPostDto } from '../FeedPost';
import { apiClient } from '../../../api/axiosConfig';

vi.mock('../../../android/bridge', () => ({ isAndroidApp: true }));
vi.mock('../../../api/axiosConfig', () => ({
    apiClient: { get: vi.fn() },
    DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost:3000/' },
}));

class TestObserver {
    static observers: TestObserver[] = [];
    target?: Element;
    callback: IntersectionObserverCallback;
    disconnect = vi.fn();
    constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
        TestObserver.observers.push(this);
    }
    observe = (target: Element) => { this.target = target; };
    notify(isIntersecting: boolean) {
        this.callback([{ target: this.target, isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
}

const post: FeedPostDto = { id: 1, content: 'Training update', authorName: 'Jordan', authorAvatarUrl: '/uploads/avatar.jpg',
    createdAt: '2026-09-02T08:00:00Z', likeCount: 0, commentCount: 0, isLikedByMe: false };
const callbacks = () => ({ onLikeToggle: vi.fn(), onToggleComments: vi.fn(), onSubmitComment: vi.fn(), onImageClick: vi.fn() });
beforeEach(() => {
    TestObserver.observers = [];
    vi.stubGlobal('IntersectionObserver', TestObserver);
    vi.clearAllMocks();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('defers protected feed photos and avatars until nearby while retaining the existing media action', () => {
    const actions = callbacks();
    const view = render(<MemoryRouter><FeedPost {...actions} post={{ ...post, mediaUrls: ['/uploads/training.jpg'] }} isCommentsOpen={false} /></MemoryRouter>);
    const photo = screen.getByRole('img', { name: 'Post media' });
    const avatar = screen.getByRole('img', { name: 'Jordan' });
    expect(photo).toHaveAttribute('loading', 'lazy');
    expect(photo).not.toHaveAttribute('src');
    expect(avatar).not.toHaveAttribute('src');
    expect(apiClient.get).not.toHaveBeenCalled();
    const photoObserver = TestObserver.observers.find(observer => observer.target === photo)!;
    act(() => photoObserver.notify(false));
    expect(photo).not.toHaveAttribute('src');
    act(() => photoObserver.notify(true));
    expect(photo).toHaveAttribute('src', `${location.origin}/uploads/training.jpg`);
    expect(avatar).not.toHaveAttribute('src');
    fireEvent.click(photo);
    expect(actions.onImageClick).toHaveBeenCalledOnce();
    view.unmount();
    expect(TestObserver.observers.every(observer => observer.disconnect.mock.calls.length > 0)).toBe(true);
});

it('shows a stable video play tile without loading preview bytes', () => {
    const actions = callbacks();
    const props = { ...actions, post: { ...post, mediaUrls: ['/uploads/drill.mp4'] }, isCommentsOpen: false };
    const view = render(<MemoryRouter><FeedPost {...props} /></MemoryRouter>);
    const tile = screen.getByText('Video · Open to play');
    expect(view.container.querySelector('video')).toBeNull();
    expect(apiClient.get).not.toHaveBeenCalled();
    view.rerender(<MemoryRouter><FeedPost {...props} likePending /></MemoryRouter>);
    expect(screen.getByText('Video · Open to play')).toBe(tile);
    fireEvent.click(tile);
    expect(actions.onImageClick).toHaveBeenCalledOnce();
    expect(apiClient.get).not.toHaveBeenCalled();
});

it('keeps video play tiles available when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const view = render(<MemoryRouter><FeedPost {...callbacks()} post={{ ...post, mediaUrls: ['/uploads/drill.webm?token=seed'] }} isCommentsOpen={false} /></MemoryRouter>);
    expect(screen.getByText('Video · Open to play')).toBeVisible();
    expect(view.container.querySelector('video')).toBeNull();
});
