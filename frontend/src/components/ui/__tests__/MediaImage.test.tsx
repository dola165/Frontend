import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaImage } from '../MediaImage';
import { apiClient } from '../../../api/axiosConfig';
import { clearStoredAuth, setStoredAccessToken } from '../../../utils/authStorage';
import { protectedMediaUrl } from '../../../hooks/useMediaSource';

vi.mock('../../../api/axiosConfig', () => ({
    apiClient: { get: vi.fn() },
    DEPLOYMENT_URLS: { mediaBaseUrl: 'https://media.example.test/app/' },
}));
const get = vi.mocked(apiClient.get);
const create = vi.fn(() => 'blob:private-image');
const revoke = vi.fn();
beforeEach(() => {
    localStorage.clear(); get.mockReset(); create.mockClear(); revoke.mockClear();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe('protected media rendering', () => {
    it('shares a request and bytes only while consumers remain mounted', async () => {
        get.mockResolvedValue({ data: new Blob(['shared']) });
        const first = render(<MediaImage src="/uploads/shared.jpg" alt="First copy" />);
        const second = render(<MediaImage src="/uploads/shared.jpg" alt="Second copy" />);
        await waitFor(() => expect(screen.getByAltText('Second copy')).toHaveAttribute('src', 'blob:private-image'));
        expect(get).toHaveBeenCalledTimes(1);
        first.unmount();
        expect(revoke).not.toHaveBeenCalled();
        second.unmount();
        expect(revoke).toHaveBeenCalledTimes(1);
    });
    it('limits concurrent downloads and cancels queued work before unmount', async () => {
        get.mockReturnValue(new Promise(() => {}));
        const view = render(<>{Array.from({ length: 20 }, (_, n) => <MediaImage key={n} src={`/uploads/queued-${n}.jpg`} alt={`Queued ${n}`} />)}</>);
        expect(get).toHaveBeenCalledTimes(6);
        view.unmount();
        await act(async () => {});
        expect(get).toHaveBeenCalledTimes(6);
        expect(get.mock.calls.every(([, config]) => config?.signal?.aborted)).toBe(true);
        expect(create).not.toHaveBeenCalled();
    });
    it('defers lazy requests until nearby and loads the latest source', async () => {
        const observers = new Map<string, IntersectionObserverCallback>();
        const disconnect = vi.fn();
        vi.stubGlobal('IntersectionObserver', class {
            constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
                observers.set(options.rootMargin!, callback);
            }
            observe = vi.fn();
            disconnect = disconnect;
        });
        get.mockResolvedValue({ data: new Blob(['photo']) });
        const view = render(<MediaImage loading="lazy" src="/uploads/first.jpg" alt="Lazy" />);
        view.rerender(<MediaImage loading="lazy" src="/uploads/latest.jpg" alt="Lazy" />);
        expect(get).not.toHaveBeenCalled();
        const image = screen.getByAltText('Lazy');
        const notify = (margin: string, isIntersecting: boolean) => act(() => observers.get(margin)?.([{ target: image, isIntersecting } as unknown as IntersectionObserverEntry], {} as IntersectionObserver));
        notify('300px', false);
        expect(get).not.toHaveBeenCalled();
        notify('300px', true);
        await waitFor(() => expect(screen.getByAltText('Lazy')).toHaveAttribute('src', 'blob:private-image'));
        expect(get).toHaveBeenCalledWith('https://media.example.test/app/uploads/latest.jpg', expect.anything());
        expect(disconnect).not.toHaveBeenCalled();
        view.unmount();
        expect(disconnect).toHaveBeenCalledTimes(2);
        expect(revoke).toHaveBeenCalledWith('blob:private-image');
    });
    it('keeps a loaded lazy image through the scroll buffer, releases it far away, and refetches on return', async () => {
        const observers = new Map<string, IntersectionObserverCallback>();
        vi.stubGlobal('IntersectionObserver', class {
            constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
                observers.set(options.rootMargin!, callback);
            }
            observe = vi.fn();
            disconnect = vi.fn();
        });
        get.mockResolvedValue({ data: new Blob(['photo']) });
        render(<MediaImage loading="lazy" src="/uploads/portrait.jpg" alt="Portrait" />);
        const image = screen.getByAltText('Portrait');
        const notify = (margin: string, isIntersecting: boolean) => act(() => observers.get(margin)?.([{ target: image, isIntersecting } as unknown as IntersectionObserverEntry], {} as IntersectionObserver));
        notify('300px', true);
        await waitFor(() => expect(image).toHaveAttribute('src', 'blob:private-image'));
        Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 320 });
        Object.defineProperty(image, 'naturalHeight', { configurable: true, value: 400 });
        fireEvent.load(image);
        expect(image).toHaveAttribute('width', '320');
        expect(image).toHaveAttribute('height', '400');
        notify('300px', false);
        notify('600px', true);
        expect(image).toHaveAttribute('src', 'blob:private-image');
        expect(get).toHaveBeenCalledTimes(1);
        notify('600px', false);
        expect(image).not.toHaveAttribute('src');
        expect(image).toHaveAttribute('width', '320');
        expect(revoke).toHaveBeenCalledTimes(1);
        notify('600px', true);
        expect(get).toHaveBeenCalledTimes(1);
        notify('300px', true);
        await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
        expect(image).toHaveAttribute('src', 'blob:private-image');
    });
    it.each(['/uploads/second.jpg', 'https://other.test/image.jpg'])(
        'does not reuse revoked bytes after navigating through %s and back', async intermediate => {
            let finish: (value: unknown) => void = () => {};
            get.mockResolvedValueOnce({ data: new Blob(['first']) });
            const view = render(<MediaImage src="/uploads/first.jpg" alt="Return photo" />);
            await waitFor(() => expect(screen.getByAltText('Return photo')).toHaveAttribute('src', 'blob:private-image'));
            get.mockReturnValueOnce(new Promise(() => {}));
            view.rerender(<MediaImage src={intermediate} alt="Return photo" />);
            expect(revoke).toHaveBeenCalledWith('blob:private-image');
            get.mockReset();
            get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
            view.rerender(<MediaImage src="/uploads/first.jpg" alt="Return photo" />);
            expect(screen.getByAltText('Return photo')).not.toHaveAttribute('src');
            await act(async () => finish({ data: new Blob(['replacement']) }));
            expect(screen.getByAltText('Return photo')).toHaveAttribute('src', 'blob:private-image');
        },
    );
    it('uses the configured service, preserves image attributes and revokes bytes on unmount', async () => {
        get.mockResolvedValue({ data: new Blob(['jpeg'], { type: 'image/jpeg' }) });
        setStoredAccessToken('current-session');
        const view = render(<MediaImage src="/uploads/avatar.jpg" alt="Player" className="portrait" />);
        await waitFor(() => expect(screen.getByAltText('Player')).toHaveAttribute('src', 'blob:private-image'));
        expect(get).toHaveBeenCalledWith('https://media.example.test/app/uploads/avatar.jpg', expect.objectContaining({ responseType: 'blob', signal: expect.any(AbortSignal) }));
        expect(screen.getByAltText('Player')).toHaveClass('portrait');
        view.unmount(); expect(revoke).toHaveBeenCalledWith('blob:private-image');
    });
    it('does not send authenticated requests for external images or local artwork', () => {
        render(<><MediaImage src="https://other.test/uploads/image.jpg" alt="External"/><MediaImage src="/map-pins/ball.png" alt="Artwork"/></>);
        expect(get).not.toHaveBeenCalled();
        expect(screen.getByAltText('External')).toHaveAttribute('src', 'https://other.test/uploads/image.jpg');
        expect(protectedMediaUrl('https://media.example.test.evil.test/app/uploads/x.jpg')).toBeUndefined();
        expect(protectedMediaUrl('https://user:pass@media.example.test/app/uploads/x.jpg')).toBeUndefined();
    });
    it('clears previously loaded private bytes immediately on logout and rechecks as guest', async () => {
        get.mockResolvedValueOnce({ data: new Blob(['private']) }).mockReturnValueOnce(new Promise(() => {}));
        setStoredAccessToken('session');render(<MediaImage src="/uploads/private.jpg" alt="Private"/>);
        await waitFor(() => expect(screen.getByAltText('Private')).toHaveAttribute('src', 'blob:private-image'));
        act(() => clearStoredAuth());
        expect(screen.getByAltText('Private')).not.toHaveAttribute('src');
        expect(revoke).toHaveBeenCalledWith('blob:private-image');
        await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    });
    it('aborts obsolete loads and never displays an earlier attachment after navigation', async () => {
        let finish: (value: unknown) => void = () => {};
        get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockReturnValueOnce(new Promise(() => {}));
        const view=render(<MediaImage src="/uploads/first.jpg" alt="Photo"/>);
        const signal=get.mock.calls[0][1]?.signal;
        view.rerender(<MediaImage src="/uploads/second.jpg" alt="Photo"/>);
        expect(signal?.aborted).toBe(true);
        await act(async () => finish({ data: new Blob(['old']) }));
        expect(create).not.toHaveBeenCalled();expect(screen.getByAltText('Photo')).not.toHaveAttribute('src');
    });
    it('keeps the existing image error fallback usable without retrying anonymously', async () => {
        get.mockRejectedValue({ response: { status: 404 } });
        render(<MediaImage src="/uploads/denied.jpg" alt="Denied"/>);
        await waitFor(() => expect(screen.getByAltText('Denied')).toHaveAttribute('src','data:image/png;base64,invalid'));
        expect(get).toHaveBeenCalledTimes(1);
    });
});
