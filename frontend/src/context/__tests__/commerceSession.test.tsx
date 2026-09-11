import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthProvider, useAuth } from '../AuthContext';
import { AuthSessionBoundary } from '../AuthSessionBoundary';
import { StoreTab } from '../../components/workspace/tabs/StoreTab';
import { CommerceDraftScope } from '../../components/workspace/CommerceDraftScope';
import { useCommerceDraftState } from '../../components/workspace/commerceDraftState';
import { apiClient } from '../../api/axiosConfig';
import { clearStoredAuth, getAuthSessionId, setStoredAccessToken, setRefreshedAccessToken } from '../../utils/authStorage';

const server = setupServer(
    http.get('*/auth/csrf', () => HttpResponse.json({ headerName: 'X-XSRF-TOKEN', token: 'csrf' })),
    http.get('*/users/me', ({ request }) => HttpResponse.json({
        id: request.headers.get('Authorization') === 'Bearer Bravo' ? 2 : 1,
        fullName: request.headers.get('Authorization') === 'Bearer Bravo' ? 'Bravo' : 'Alpha',
        profileComplete: true, emailVerified: true,
    })),
    http.get('*/clubs/10/store/products/all', () => HttpResponse.json([])),
    http.get('*/review-expired', ({ request }) => request.headers.get('Authorization') === 'Bearer Alpha renewed'
        ? HttpResponse.json({ ok: true }) : new HttpResponse(null, { status: 401 })),
    http.post('*/auth/refresh', () => HttpResponse.json({ accessToken: 'Alpha renewed' })),
    http.post('*/auth/logout', () => new HttpResponse(null, { status: 204 })),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => { localStorage.clear(); setStoredAccessToken('Alpha'); });
afterEach(() => { cleanup(); clearStoredAuth(); server.resetHandlers(); });

let currentAuth!: ReturnType<typeof useAuth>;
function CaptureAuth() {
    const auth = useAuth();
    useEffect(() => { currentAuth = auth; }, [auth]);
    return <output>{auth.status}:{auth.user?.fullName ?? '-'}</output>;
}
function AuthenticatedStore({ visit }: { visit: number }) {
    return useAuth().isAuthenticated ? <StoreTab key={visit} clubId={10} /> : null;
}
const storeApp = (visit: number) => <MemoryRouter><AuthProvider><CaptureAuth />
    <AuthSessionBoundary><AuthenticatedStore visit={visit} /></AuthSessionBoundary>
</AuthProvider></MemoryRouter>;
const beforeUnload = () => {
    const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event);
    return event.defaultPrevented;
};
const latch = () => {
    let release!: () => void;
    const promise = new Promise<void>(resolve => { release = resolve; });
    return { release, promise };
};
async function startStore() {
    const view = render(storeApp(1));
    await screen.findByRole('button', { name: 'Add product' });
    // Exercise the real path: a loaded workspace module survives logout/login.
    await act(async () => { await currentAuth.logout(); });
    await screen.findByText('anonymous:-');
    await act(async () => { await currentAuth.loginWithAccessToken('Alpha'); });
    fireEvent.click(await screen.findByRole('button', { name: 'Add product' }));
    fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Unsaved review shirt' } });
    fireEvent.change(screen.getByLabelText('Price'), { target: { value: '12.34' } });
    return view;
}
async function renew() {
    const generation = getAuthSessionId();
    await act(async () => { expect((await apiClient.get('/review-expired')).data).toEqual({ ok: true }); });
    expect(getAuthSessionId()).toBe(generation);
}

it('preserves the real Store editor and unload warning through automatic renewal and revisits after login', async () => {
    const view = await startStore();
    view.rerender(storeApp(2));
    expect(screen.getByLabelText('Product name')).toHaveValue('Unsaved review shirt');
    expect(beforeUnload()).toBe(true);
    await renew();
    expect(beforeUnload()).toBe(true);
    view.rerender(storeApp(3));
    expect(screen.getByLabelText('Product name')).toHaveValue('Unsaved review shirt');
    expect(screen.getByLabelText('Price')).toHaveValue(12.34);
    expect(beforeUnload()).toBe(true);
    // Re-reading the profile and repeated renewal events must also be harmless.
    await act(async () => { await currentAuth.bootstrapSession(); setRefreshedAccessToken('Alpha renewed', getAuthSessionId()); });
    view.rerender(storeApp(4));
    expect(screen.getByLabelText('Product name')).toHaveValue('Unsaved review shirt');
    fireEvent.click(screen.getByRole('button', { name: 'Close editor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard edits' }));
    expect(beforeUnload()).toBe(false);
});

it.each(['upload', 'save'] as const)('preserves a pending Store %s and its completion through renewal and navigation', async operation => {
    const started = latch(), finish = latch(); let calls = 0;
    const url = operation === 'upload' ? '*/media/upload' : '*/clubs/10/store/products';
    server.use(http.post(url, async () => {
        calls++; started.release(); await finish.promise;
        return HttpResponse.json(operation === 'upload' ? { url: 'data:image/png;base64,cGhvdG8=' } : { id: 2 });
    }));
    const view = await startStore();
    try {
        if (operation === 'upload') fireEvent.change(screen.getByLabelText('Add product photo (up to 8)'), {
            target: { files: [new File(['photo'], 'photo.png', { type: 'image/png' })] },
        });
        else fireEvent.submit(screen.getByLabelText('Product name').closest('form')!);
        await started.promise;
        await renew();
        view.rerender(storeApp(2));
        expect(screen.getByLabelText('Product name')).toHaveValue('Unsaved review shirt');
        expect(screen.getByLabelText('Product name')).toBeDisabled();
        expect(beforeUnload()).toBe(true); expect(calls).toBe(1);
        // Complete while the originating view is unmounted, then revisit again.
        view.rerender(storeApp(3));
        await act(async () => { finish.release(); });
        if (operation === 'upload') await screen.findByAltText('Product photo 1');
        else await screen.findByText('Product saved.');
        view.rerender(storeApp(4));
        if (operation === 'upload') {
            expect(screen.getByAltText('Product photo 1')).toBeInTheDocument();
            expect(screen.getByLabelText('Product name')).toHaveValue('Unsaved review shirt');
            expect(screen.getByLabelText('Product name')).toBeEnabled();
            expect(beforeUnload()).toBe(true);
        } else {
            expect(screen.queryByLabelText('Product name')).toBeNull();
            expect(screen.getByText('Product saved.')).toBeVisible();
            expect(beforeUnload()).toBe(false);
        }
        expect(calls).toBe(1);
    } finally { finish.release(); }
});

it.each(['logout', 'same-account-login', 'other-account-login'] as const)('retires retained drafts and unload protection on %s', async transition => {
    const view = await startStore();
    await renew(); expect(beforeUnload()).toBe(true);
    await act(async () => {
        if (transition === 'logout') await currentAuth.logout();
        else await currentAuth.loginWithAccessToken(transition === 'other-account-login' ? 'Bravo' : 'Alpha');
    });
    expect(beforeUnload()).toBe(false);
    expect(screen.queryByLabelText('Product name')).toBeNull();
    if (transition === 'logout') await act(async () => { await currentAuth.loginWithAccessToken('Alpha'); });
    view.rerender(storeApp(2));
    fireEvent.click(await screen.findByRole('button', { name: 'Add product' }));
    expect(screen.getByLabelText('Product name')).toHaveValue('');
});

function FeatureDraft({ feature }: { feature: string }) {
    const [text, setText] = useCommerceDraftState('form:text', '');
    const [, setEditing] = useCommerceDraftState('editing', false);
    return <input aria-label={feature} value={text} onChange={e => { setText(e.target.value); setEditing(true); }} />;
}
function FeatureScopes({ visit }: { visit: number }) {
    return <div key={visit}>{['StoreTab', 'CampaignsTab', 'JobsTab'].map(feature =>
        <CommerceDraftScope key={feature} clubId={10} feature={feature}><FeatureDraft feature={feature} /></CommerceDraftScope>)}</div>;
}
const featureApp = (visit: number) => <AuthProvider><CaptureAuth /><AuthSessionBoundary><FeatureScopes visit={visit} /></AuthSessionBoundary></AuthProvider>;
it('preserves every feature store across a remote renewal and still retires them on a remote new login', async () => {
    const view = render(featureApp(1)); await screen.findByText('authenticated:Alpha');
    for (const feature of ['StoreTab', 'CampaignsTab', 'JobsTab']) fireEvent.change(screen.getByLabelText(feature), { target: { value: feature + ' draft' } });
    const sessionId = getAuthSessionId();
    await act(async () => {
        localStorage.setItem(`gk-session-token:${sessionId}`, 'Alpha renewed');
        window.dispatchEvent(new StorageEvent('storage', { key: `gk-session-token:${sessionId}`, storageArea: localStorage }));
        window.dispatchEvent(new StorageEvent('storage', { key: 'theme', storageArea: localStorage }));
    });
    view.rerender(featureApp(2));
    for (const feature of ['StoreTab', 'CampaignsTab', 'JobsTab']) expect(screen.getByLabelText(feature)).toHaveValue(feature + ' draft');
    expect(beforeUnload()).toBe(true);
    await act(async () => {
        const newSession = crypto.randomUUID();
        localStorage.setItem(`gk-session-token:${newSession}`, 'Alpha');
        localStorage.setItem('gk-session-id', newSession);
        window.dispatchEvent(new StorageEvent('storage', { key: 'gk-session-id', storageArea: localStorage }));
    });
    await screen.findByText('authenticated:Alpha'); view.rerender(featureApp(3));
    for (const feature of ['StoreTab', 'CampaignsTab', 'JobsTab']) expect(screen.getByLabelText(feature)).toHaveValue('');
    expect(beforeUnload()).toBe(false);
});
