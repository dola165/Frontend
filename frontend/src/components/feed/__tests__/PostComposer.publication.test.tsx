import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { PostComposer } from '../PostComposer';

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
afterEach(() => { cleanup(); server.resetHandlers(); vi.unstubAllGlobals(); });
const photo = (name: string) => new File([name], name, { type: 'image/png' });
const first = photo('first.png'), replacement = photo('replacement.png');
function latch() {
    let release!: () => void;
    const promise = new Promise<void>(resolve => { release = resolve; });
    return { promise, release };
}
type Post = { content: string; clubId: number | null; isPublic: boolean; mediaIds: number[] };
function setup(compact = false, clubId?: number) {
    const created = vi.fn(), event = vi.fn();
    const { container } = render(<MemoryRouter><PostComposer compact={compact} clubId={clubId}
        onPostCreated={created} onCreateEvent={event} /></MemoryRouter>);
    const text = screen.getByRole('textbox', { name: clubId ? 'Create a club post' : 'Create a post' });
    fireEvent.focus(text);
    fireEvent.change(text, { target: { value: 'Photo caption' } });
    const picker = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const publish = screen.getByRole('button', { name: 'Publish post' });
    return { text, picker, publish, created, event };
}
const select = (picker: HTMLInputElement, file: File) => fireEvent.change(picker, { target: { files: [file] } });

it.each([
    { name: 'compact Home/profile', compact: true, clubId: undefined },
    { name: 'expanded personal', compact: false, clubId: undefined },
    { name: 'club', compact: true, clubId: 17 },
])('locks the $name draft until publication completes, then permits a fresh draft', async ({ compact, clubId }) => {
    const started = latch(), finish = latch(); const bodies: Post[] = [];
    server.use(http.post('*/posts', async ({ request }) => {
        bodies.push(await request.json() as Post); started.release(); await finish.promise;
        return HttpResponse.json({ postId: 41 });
    }));
    const { text, picker, publish, created, event } = setup(compact, clubId);
    fireEvent.change(text, { target: { value: 'Original published text' } });
    fireEvent.click(publish); await started.promise;
    expect(text).toBeDisabled(); expect(picker).toBeDisabled();
    expect(publish).toBeDisabled(); expect(screen.getByRole('button', { name: 'Photo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Event' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Publishing your post');
    await userEvent.type(text, 'New text while pending');
    fireEvent.change(text, { target: { value: 'Late input event' } });
    fireEvent.click(screen.getByRole('button', { name: 'Event' }));
    expect(text).toHaveValue('Original published text'); expect(event).not.toHaveBeenCalled();
    await act(async () => { finish.release(); });
    await waitFor(() => expect(created).toHaveBeenCalledTimes(1));
    expect(created).toHaveBeenCalledWith(41);
    expect(text).toHaveValue(''); expect(text).toBeEnabled();
    expect(screen.getByRole('link', { name: 'View your post' })).toHaveAttribute('href', '/posts/41');
    expect(screen.getByRole('status')).toHaveTextContent('Post published.');
    await userEvent.type(text, 'Fresh draft after success');
    expect(text).toHaveValue('Fresh draft after success');
    expect(bodies).toEqual([{ content: 'Original published text', clubId: clubId ?? null, isPublic: true, mediaIds: [] }]);
});

it('locks attachment removal and ignores late file selection while upload is pending', async () => {
    const started = latch(), finish = latch(); const bodies: Post[] = [];
    server.use(
        http.post('*/media/upload', async () => { started.release(); await finish.promise; return HttpResponse.json({ id: 101 }); }),
        http.post('*/posts', async ({ request }) => { bodies.push(await request.json() as Post); return new HttpResponse(null, { status: 503 }); }),
    );
    const { picker, publish, text } = setup(); select(picker, first);
    fireEvent.click(publish); await started.promise;
    expect(screen.getByRole('button', { name: 'Remove attachment' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove attachment' }));
    select(picker, replacement);
    expect(screen.getByAltText('Upload preview')).toHaveAttribute('src', 'blob:first.png');
    await act(async () => { finish.release(); });
    await screen.findByText(/Failed to publish this post/);
    expect(text).toBeEnabled(); expect(picker).toBeEnabled(); expect(publish).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Remove attachment' })).toBeEnabled();
    expect(screen.getByAltText('Upload preview')).toHaveAttribute('src', 'blob:first.png');
    expect(bodies[0].mediaIds).toEqual([101]);
});

it('retains the exact draft and reuses its successful upload on an ordinary publication retry', async () => {
    let uploads = 0; const bodies: Post[] = [];
    server.use(
        http.post('*/media/upload', () => { uploads++; return HttpResponse.json({ id: 101 }); }),
        http.post('*/posts', async ({ request }) => {
            bodies.push(await request.json() as Post);
            return bodies.length === 1 ? new HttpResponse(null, { status: 503 }) : HttpResponse.json({ id: 1 });
        }),
    );
    const { text, picker, publish, created } = setup();
    fireEvent.change(text, { target: { value: 'Keep my draft' } }); select(picker, first);
    fireEvent.click(publish); await screen.findByText(/Failed to publish this post/);
    expect(created).not.toHaveBeenCalled(); expect(text).toHaveValue('Keep my draft');
    expect(screen.getByAltText('Upload preview')).toHaveAttribute('src', 'blob:first.png');
    fireEvent.click(publish); await waitFor(() => expect(created).toHaveBeenCalledTimes(1));
    expect(uploads).toBe(1); expect(bodies[1]).toEqual(bodies[0]);
    expect(text).toHaveValue(''); expect(screen.queryByAltText('Upload preview')).toBeNull();
});

it.each(['remove', 'replace'])('does not reuse the old uploaded ID after %s following a failed post', async action => {
    let uploads = 0; const bodies: Post[] = [];
    server.use(
        http.post('*/media/upload', () => HttpResponse.json({ id: ++uploads === 1 ? 101 : 202 })),
        http.post('*/posts', async ({ request }) => {
            bodies.push(await request.json() as Post);
            return bodies.length === 1 ? new HttpResponse(null, { status: 503 }) : HttpResponse.json({ id: 1 });
        }),
    );
    const { text, picker, publish, created } = setup();
    fireEvent.change(text, { target: { value: 'Original text' } }); select(picker, first);
    fireEvent.click(publish); await screen.findByText(/Failed to publish this post/);
    fireEvent.click(screen.getByRole('button', { name: 'Remove attachment' }));
    if (action === 'replace') select(picker, replacement);
    fireEvent.change(text, { target: { value: 'Corrected text' } });
    fireEvent.click(publish); await waitFor(() => expect(created).toHaveBeenCalledTimes(1));
    expect(bodies.map(body => body.mediaIds)).toEqual([[101], action === 'replace' ? [202] : []]);
    expect(uploads).toBe(action === 'replace' ? 2 : 1); expect(bodies[1].content).toBe('Corrected text');
});

it('restores editing after upload failure and retries the selected photo without publishing prematurely', async () => {
    let uploads = 0; const publishRequest = vi.fn(() => HttpResponse.json({ id: 1 }));
    server.use(
        http.post('*/media/upload', () => ++uploads === 1 ? new HttpResponse(null, { status: 503 }) : HttpResponse.json({ id: 101 })),
        http.post('*/posts', publishRequest),
    );
    const { picker, publish, created } = setup(); select(picker, first);
    fireEvent.click(publish); await screen.findByText(/Photo upload failed/);
    expect(publishRequest).not.toHaveBeenCalled(); expect(publish).toBeEnabled();
    expect(screen.getByAltText('Upload preview')).toHaveAttribute('src', 'blob:first.png');
    fireEvent.click(publish); await waitFor(() => expect(created).toHaveBeenCalledTimes(1));
    expect(uploads).toBe(2); expect(publishRequest).toHaveBeenCalledTimes(1);
});

it('sends only one publication for repeated submit clicks while the response is held', async () => {
    const started = latch(), finish = latch(); let posts = 0;
    server.use(http.post('*/posts', async () => { posts++; started.release(); await finish.promise; return HttpResponse.json({ id: 1 }); }));
    const { text, publish, created } = setup();
    fireEvent.change(text, { target: { value: 'One post' } });
    act(() => { fireEvent.click(publish); fireEvent.click(publish); });
    await started.promise; fireEvent.click(publish);
    await act(async () => { finish.release(); });
    await waitFor(() => expect(created).toHaveBeenCalledTimes(1)); expect(posts).toBe(1);
});

it.each([undefined, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('does not forward an invalid confirmed post ID (%s)', async postId => {
    server.use(http.post('*/posts', () => HttpResponse.json({ postId })));
    const { publish, created } = setup();
    fireEvent.click(publish);
    await waitFor(() => expect(created).toHaveBeenCalledWith(undefined));
    expect(screen.queryByRole('link', { name: 'View your post' })).not.toBeInTheDocument();
});
