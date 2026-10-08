// Diagnostic: a passing assertion below means draft loss was reproduced.
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthProvider, useAuth } from '../../src/context/AuthContext';
import { AuthSessionBoundary } from '../../src/context/AuthSessionBoundary';
import { MemoryRouter } from 'react-router-dom';
import { StoreTab } from '../../src/components/workspace/tabs/StoreTab';
import { apiClient } from '../../src/api/axiosConfig';
import { getAuthSessionId, setStoredAccessToken, setRefreshedAccessToken } from '../../src/utils/authStorage';
import { CommerceDraftContext, useCommerceDraftState, useScopedDraftStore } from '../../src/components/workspace/commerceDraftState';

const server = setupServer(
    http.get('*/auth/csrf', () => HttpResponse.json({ headerName: 'X-XSRF-TOKEN', token: 'csrf' })),
    http.get('*/users/me', () => HttpResponse.json({ id: 1, fullName: 'Alpha', profileComplete: true, emailVerified: true })),
    http.get('*/clubs/10/store/all', () => HttpResponse.json([])),
    http.get('*/review-expired', ({ request }) => request.headers.get('Authorization') === 'Bearer Alpha renewed'
        ? HttpResponse.json({ ok: true }) : new HttpResponse(null, { status: 401 })),
    http.post('*/auth/refresh', () => HttpResponse.json({ accessToken: 'Alpha renewed' })),
    http.post('*/auth/logout', () => new HttpResponse(null, { status: 204 })),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(cleanup);
function Form() {
    const [draft, setDraft] = useCommerceDraftState('form:text', '');
    const [editing, setEditing] = useCommerceDraftState('editing', true);
    return <input aria-label="Retained workspace draft" data-editing={editing} value={draft} onChange={e => { setDraft(e.target.value); setEditing(true); }} />;
}
function Workspace() {
    const { store } = useScopedDraftStore(10, 'store');
    return <CommerceDraftContext.Provider value={store}><Form /></CommerceDraftContext.Provider>;
}
const app = (visit: number) => <AuthProvider><AuthSessionBoundary><Workspace key={visit} /></AuthSessionBoundary></AuthProvider>;

it('diagnostic: renewal after a fresh login loses the retained draft and unload protection', async () => {
    localStorage.clear();
    setStoredAccessToken('Alpha');
    const generation = getAuthSessionId();
    const view = render(app(1));
    fireEvent.change(await screen.findByLabelText('Retained workspace draft'), { target: { value: 'Unsaved Alpha product' } });
    view.rerender(app(2));
    expect(screen.getByLabelText('Retained workspace draft')).toHaveValue('Unsaved Alpha product');
    const before = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(before);
    expect(before.defaultPrevented).toBe(true);
    await act(async () => { setRefreshedAccessToken('Alpha renewed', generation); });
    expect(getAuthSessionId()).toBe(generation);
    // The existing mounted form misleadingly survives; the shared store was cleared.
    expect(screen.getByLabelText('Retained workspace draft')).toHaveValue('Unsaved Alpha product');
    const after = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
    view.rerender(app(3));
    expect(screen.getByLabelText('Retained workspace draft')).toHaveValue('');
});

it('diagnostic: real Store editor loses unsaved product after an automatic 401 renewal and revisit', async () => {
    localStorage.clear(); setStoredAccessToken('Alpha');
    let currentAuth!: ReturnType<typeof useAuth>;
    function CaptureAuth() { currentAuth = useAuth(); return null; }
    function AuthenticatedStore({ visit }: { visit: number }) {
        return useAuth().isAuthenticated ? <StoreTab key={visit} clubId={10} /> : <span>Signed out</span>;
    }
    const storeApp = (visit: number) => <MemoryRouter><AuthProvider><CaptureAuth /><AuthSessionBoundary><AuthenticatedStore visit={visit} /></AuthSessionBoundary></AuthProvider></MemoryRouter>;
    const view = render(storeApp(1));
    // A normal app path loads the lazy workspace, then signs out and back in
    // without a document reload. Its module-level registry remains loaded.
    await screen.findByRole('button', { name: 'Add product' });
    await act(async () => { await currentAuth.logout(); });
    expect(screen.getByText('Signed out')).toBeVisible();
    await act(async () => { await currentAuth.loginWithAccessToken('Alpha'); });
    const generation = getAuthSessionId();
    fireEvent.click(await screen.findByRole('button', { name: 'Add product' }));
    fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Unsaved review shirt' } });
    view.rerender(storeApp(2));
    expect(screen.getByLabelText('Product name')).toHaveValue('Unsaved review shirt');
    await act(async () => { expect((await apiClient.get('/review-expired')).data).toEqual({ ok: true }); });
    expect(getAuthSessionId()).toBe(generation);
    expect(screen.getByLabelText('Product name')).toHaveValue('Unsaved review shirt');
    const unload = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
    view.rerender(storeApp(3));
    expect(screen.queryByLabelText('Product name')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    expect(screen.getByLabelText('Product name')).toHaveValue('');
});
