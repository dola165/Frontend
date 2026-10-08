import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { PostComposer } from '../PostComposer';
import { setStoredAccessToken } from '../../../utils/authStorage';
import { apiClient } from '../../../api/axiosConfig';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('URL', class extends URL {
        static createObjectURL = vi.fn((file: File) => `blob:${file.name}`);
        static revokeObjectURL = vi.fn();
    });
});
afterEach(() => { cleanup(); server.resetHandlers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const photo = (name: string) => new File([name], name, { type: 'image/png' });
const select = (...files: File[]) => fireEvent.change(screen.getByLabelText('Choose photo'), { target: { files } });
function setup(caption = 'Weekend football') {
    const created = vi.fn();
    const rendered = render(<MemoryRouter><PostComposer onPostCreated={created} /></MemoryRouter>);
    const text = screen.getByRole('textbox', { name: 'Create a post' });
    fireEvent.change(text, { target: { value: caption } });
    return { ...rendered, created, text, publish: screen.getByRole('button', { name: 'Publish post' }) };
}
function latch() {
    let release!: () => void;
    const promise = new Promise<void>(resolve => { release = resolve; });
    return { promise, release };
}

it.each([{ caption: '', name: 'missing' }, { caption: '   ', name: 'blank' }, { caption: 'x'.repeat(2001), name: 'too long' }])('requires a valid caption before any upload when it is $name', async ({ caption }) => {
    const upload = vi.fn(() => HttpResponse.json({ id: 1 }));
    server.use(http.post('*/media/upload', upload));
    const { publish } = setup(caption); select(photo('first.png'));
    expect(publish).toBeDisabled(); fireEvent.click(publish);
    await act(async () => undefined); expect(upload).not.toHaveBeenCalled();
    expect(screen.getByText(/A caption is required/)).toBeVisible();
});

it('supports ten photos and rejects an oversized selection without losing the album', () => {
    setup(); select(...Array.from({ length: 10 }, (_, index) => photo(`${index}.png`)));
    expect(screen.getAllByAltText(/Upload preview/)).toHaveLength(10);
    expect(screen.getByRole('button', { name: 'Photo' })).toBeDisabled();
    select(photo('eleventh.png'));
    expect(screen.getByRole('alert')).toHaveTextContent('up to 10 photos');
    expect(screen.getAllByAltText(/Upload preview/)).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo 3' }));
    select(photo('replacement.png'));
    expect(screen.getAllByAltText(/Upload preview/)).toHaveLength(10);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:2.png');
});

it('rejects an invalid batch atomically and preserves the current photos', () => {
    setup(); select(photo('original.png'));
    select(photo('valid.png'), new File(['clip'], 'clip.mp4', { type: 'video/mp4' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Videos are not supported');
    expect(screen.getAllByAltText(/Upload preview/)).toHaveLength(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
});

it('reuses successful uploads after a partial failure and publishes in the edited order', async () => {
    const published: number[][] = [];
    const transport = vi.spyOn(apiClient, 'post');
    const attempts = () => transport.mock.calls.filter(([path]) => path === '/media/upload')
        .map(([, body]) => ((body as FormData).get('file') as File).name);
    let uploads = 0;
    server.use(http.post('*/media/upload', () => {
        uploads++;
        if (uploads === 2) return new HttpResponse(null, { status: 503 });
        return HttpResponse.json({ id: [101, 0, 103, 102][uploads - 1] });
    }), http.post('*/posts', async ({ request }) => { published.push((await request.json() as { mediaIds: number[] }).mediaIds); return HttpResponse.json({ postId: 7 }); }));
    const { publish, created } = setup(); select(photo('first.png'), photo('second.png'), photo('third.png'));
    fireEvent.click(publish); await screen.findByText(/Photo upload failed/);
    expect(published).toHaveLength(0); expect(attempts()).toEqual(['first.png', 'second.png']);
    fireEvent.click(screen.getByRole('button', { name: 'Move photo 3 earlier' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move photo 2 earlier' }));
    fireEvent.click(publish); await waitFor(() => expect(created).toHaveBeenCalledTimes(1));
    expect(attempts()).toEqual(['first.png', 'second.png', 'third.png', 'second.png']);
    expect(published).toEqual([[103, 101, 102]]);
});

it('retains only current uploaded identities after removing and adding photos following a failed post', async () => {
    let uploads = 0; const posts: number[][] = [];
    server.use(http.post('*/media/upload', () => HttpResponse.json({ id: ++uploads })),
        http.post('*/posts', async ({ request }) => { posts.push((await request.json() as { mediaIds: number[] }).mediaIds); return posts.length === 1 ? new HttpResponse(null, { status: 503 }) : HttpResponse.json({ postId: 7 }); }));
    const { publish, created } = setup(); select(photo('first.png'), photo('second.png'));
    fireEvent.click(publish); await screen.findByText(/Failed to publish this post/);
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo 1' })); select(photo('third.png'));
    fireEvent.click(publish); await waitFor(() => expect(created).toHaveBeenCalledTimes(1));
    expect(uploads).toBe(3); expect(posts).toEqual([[1, 2], [2, 3]]);
});

it('does not publish if an upload response has no persisted media identity', async () => {
    const publishRequest = vi.fn(() => HttpResponse.json({ postId: 7 }));
    server.use(http.post('*/media/upload', () => HttpResponse.json({})), http.post('*/posts', publishRequest));
    const { publish } = setup(); select(photo('first.png')); fireEvent.click(publish);
    await screen.findByText(/Photo upload failed/); expect(publishRequest).not.toHaveBeenCalled();
});

it('retiring an account during upload clears its draft and never publishes with another account', async () => {
    const started = latch(), finish = latch(); const post = vi.fn(() => HttpResponse.json({ postId: 7 }));
    server.use(http.post('*/media/upload', async () => { started.release(); await finish.promise; return HttpResponse.json({ id: 1 }); }), http.post('*/posts', post));
    const { publish, created } = setup(); select(photo('private.png')); fireEvent.click(publish); await started.promise;
    act(() => setStoredAccessToken('different-account-token'));
    expect(screen.getByRole('textbox', { name: 'Create a post' })).toHaveValue('');
    expect(screen.queryByAltText(/Upload preview/)).toBeNull();
    await act(async () => finish.release());
    expect(post).not.toHaveBeenCalled(); expect(created).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private.png');
});

it('releases remaining local previews on unmount without revoking them during reorder', () => {
    const { unmount } = setup(); select(photo('first.png'), photo('second.png'));
    fireEvent.click(screen.getByRole('button', { name: 'Move photo 2 earlier' }));
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first.png'); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:second.png');
});
