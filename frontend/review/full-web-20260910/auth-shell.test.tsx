import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthProvider, useAuth } from '../../src/context/AuthContext';
import { apiClient } from '../../src/api/axiosConfig';
const server = setupServer(
  http.get('*/auth/csrf', () => HttpResponse.json({ headerName: 'X-XSRF-TOKEN', token: 'synthetic' })),
  http.get('*/users/me', () => HttpResponse.json({ id: 1, fullName: 'Account A', role: 'ORGANIZER', dob: '1990-01-01', profileComplete: true, onboardingRequired: false })),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => { cleanup(); server.resetHandlers(); localStorage.clear(); });
function Identity() {
  const { user, status } = useAuth();
  return <><p>{status}: {user?.fullName}</p><button onClick={() => void apiClient.post('/posts', { content: 'Auth boundary review' })}>Post</button></>;
}
it('DIAGNOSTIC: a second-tab login leaves A displayed while API writes authenticate as B', async () => {
  localStorage.setItem('accessToken', 'A-token');
  render(<AuthProvider><Identity /></AuthProvider>);
  await screen.findByText('authenticated: Account A');
  let resolve!: (auth: string | null) => void;
  const request = new Promise<string | null>(r => { resolve = r; });
  server.use(http.post('*/posts', ({ request }) => { resolve(request.headers.get('Authorization')); return HttpResponse.json({ id: 1 }); }));
  await act(async () => {
    localStorage.setItem('accessToken', 'B-token'); localStorage.setItem('userId', '2');
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken', oldValue: 'A-token', newValue: 'B-token', storageArea: localStorage }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'userId', oldValue: '1', newValue: '2', storageArea: localStorage }));
  });
  expect(screen.getByText('authenticated: Account A')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Post' }));
  expect(await request).toBe('Bearer B-token');
});
