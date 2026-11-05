import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { PostComposer } from '../PostComposer';
import type { PostAuthor } from '../../../features/feed/postAuthors';

const club: PostAuthor = { clubId: 1, clubName: 'FC Dinamo Tbilisi Academy', name: 'FC Dinamo Tbilisi Academy' };
const server = setupServer();
let bodies: unknown[];
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); bodies = [];
  localStorage.setItem('userId', '7'); localStorage.setItem('gk-session-id', 'login-7');
  server.use(http.get('*/posts/authors', () => HttpResponse.json([club])),
    http.post('*/posts', async ({ request }) => { bodies.push(await request.json()); return HttpResponse.json({ postId: 42 }); }));
});
afterEach(() => { cleanup(); server.resetHandlers(); });
const editor = (authors = [club], loaded = true) => <PostComposer asSelf authors={authors} authorsLoaded={loaded} authorName="Luka" onPostCreated={() => {}} />;
function write() {
  fireEvent.change(screen.getByRole('combobox', { name: 'Post as' }), { target: { value: 'club:1' } });
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Training on Friday' } });
}

it('carries the Dinamo author and caption through actual Home → World → Home navigation', async () => {
  render(<MemoryRouter initialEntries={['/home']}><Link to="/home">Home</Link><Link to="/world">World</Link><Routes>
    <Route path="/home" element={editor()} /><Route path="/world" element={<p>World route</p>} />
  </Routes></MemoryRouter>);
  write(); fireEvent.click(screen.getByRole('link', { name: 'World' }));
  expect(screen.queryByRole('textbox')).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: 'Home' }));
  expect(screen.getByRole('textbox')).toHaveValue('Training on Friday');
  expect(screen.getByRole('combobox')).toHaveValue('club:1');
  fireEvent.click(screen.getByRole('button', { name: 'Publish post' }));
  await waitFor(() => expect(bodies).toHaveLength(1));
  expect(bodies[0]).toMatchObject({ clubId: 1, content: 'Training on Friday' });
});

it('blocks a restored author while authority loads or is lost; changing to Self requires a deliberate choice', async () => {
  const view = render(<MemoryRouter>{editor()}</MemoryRouter>); write();
  view.rerender(<MemoryRouter>{editor([], false)}</MemoryRouter>);
  expect(screen.getByRole('combobox')).toHaveValue('club:1');
  expect(screen.getByRole('button', { name: 'Publish post' })).toBeDisabled();
  view.rerender(<MemoryRouter>{editor([])}</MemoryRouter>);
  expect(screen.getByRole('alert')).toHaveTextContent('Your draft keeps its author');
  fireEvent.click(screen.getByRole('button', { name: 'Publish post' })); expect(bodies).toHaveLength(0);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'self' } });
  fireEvent.click(screen.getByRole('button', { name: 'Publish post' }));
  await waitFor(() => expect(bodies).toHaveLength(1));
  expect(bodies[0]).toMatchObject({ clubId: null, content: 'Training on Friday' });
});

it('rechecks authority before publication and preserves the draft when the cached choice was revoked', async () => {
  server.use(http.get('*/posts/authors', () => HttpResponse.json([])));
  render(<MemoryRouter>{editor()}</MemoryRouter>); write();
  fireEvent.click(screen.getByRole('button', { name: 'Publish post' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Your draft keeps its author');
  expect(bodies).toHaveLength(0); expect(screen.getByRole('textbox')).toHaveValue('Training on Friday');
  expect(screen.getByRole('combobox')).toHaveValue('club:1');
});

it('isolates the caption and author across account changes and a fresh login to the same account', () => {
  render(<MemoryRouter>{editor()}</MemoryRouter>); write();
  act(() => { localStorage.setItem('userId', '8'); localStorage.setItem('gk-session-id', 'login-8'); window.dispatchEvent(new Event('gk-auth-changed')); });
  expect(screen.getByRole('textbox')).toHaveValue(''); expect(screen.getByRole('combobox')).toHaveValue('self');
  act(() => { localStorage.setItem('userId', '7'); localStorage.setItem('gk-session-id', 'new-login-7'); window.dispatchEvent(new Event('gk-auth-changed')); });
  expect(screen.getByRole('textbox')).toHaveValue(''); expect(screen.getByRole('combobox')).toHaveValue('self');
});

it('requires an explicit author for an older caption-only Home draft', () => {
  sessionStorage.setItem('gk.post-composer.personal.draft:7', JSON.stringify({ content: 'Older saved caption' }));
  render(<MemoryRouter>{editor()}</MemoryRouter>);
  expect(screen.getByRole('textbox')).toHaveValue('Older saved caption');
  expect(screen.getByRole('button', { name: 'Publish post' })).toBeDisabled();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'club:1' } });
  expect(screen.getByRole('button', { name: 'Publish post' })).toBeEnabled();
});
