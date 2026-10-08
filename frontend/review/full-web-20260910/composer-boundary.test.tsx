// Diagnostics intentionally assert current data-loss/wrong-attachment behavior.
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { PostComposer } from '../../src/components/feed/PostComposer';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  localStorage.clear();
  URL.createObjectURL = vi.fn(file => 'blob:' + file.name);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); server.resetHandlers(); });
function latch() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }
it('DIAGNOSTIC: successful old submission clears newer text typed while pending', async () => {
  const started = latch(), finish = latch(); const bodies: unknown[] = [];
  server.use(http.post('*/posts', async ({ request }) => { bodies.push(await request.json()); started.release(); await finish.promise; return HttpResponse.json({ id: 1 }); }));
  render(<MemoryRouter><PostComposer onPostCreated={() => {}} /></MemoryRouter>);
  fireEvent.change(screen.getByRole('textbox', { name: 'Create a post' }), { target: { value: 'Original published text' } });
  fireEvent.click(screen.getByRole('button', { name: 'Publish post' })); await started.promise;
  fireEvent.change(screen.getByRole('textbox', { name: 'Create a post' }), { target: { value: 'New unsaved text while waiting' } });
  await act(async () => { finish.release(); });
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Create a post' })).toHaveValue(''));
  expect(bodies).toEqual([{ content: 'Original published text', clubId: null, isPublic: true, mediaIds: [] }]);
});
it('DIAGNOSTIC: replacing an in-flight photo then retrying publishes the removed photo ID', async () => {
  const started = latch(), finish = latch(); const bodies: { mediaIds: number[] }[] = []; let uploads = 0;
  server.use(
    http.post('*/media/upload', async () => { uploads++; started.release(); await finish.promise; return HttpResponse.json({ id: 101, url: '/uploads/first.jpg' }); }),
    http.post('*/posts', async ({ request }) => { bodies.push(await request.json() as { mediaIds: number[] }); return bodies.length === 1 ? HttpResponse.json({ error: 'Synthetic failure' }, { status: 503 }) : HttpResponse.json({ id: 2 }); }),
  );
  const { container } = render(<MemoryRouter><PostComposer onPostCreated={() => {}} /></MemoryRouter>);
  const picker = container.querySelector('input[accept="image/*"]')!;
  fireEvent.change(picker, { target: { files: [new File(['A'], 'first.png', { type: 'image/png' })] } });
  fireEvent.click(screen.getByRole('button', { name: 'Publish post' })); await started.promise;
  fireEvent.click(screen.getByRole('button', { name: 'Remove attachment' }));
  fireEvent.change(picker, { target: { files: [new File(['B'], 'replacement.png', { type: 'image/png' })] } });
  expect(screen.getByAltText('Upload preview')).toHaveAttribute('src', 'blob:replacement.png');
  await act(async () => { finish.release(); });
  await screen.findByText(/Failed to publish this post/);
  fireEvent.click(screen.getByRole('button', { name: 'Publish post' }));
  await waitFor(() => expect(bodies).toHaveLength(2));
  expect(uploads).toBe(1);
  expect(bodies.map(body => body.mediaIds)).toEqual([[101], [101]]);
});
