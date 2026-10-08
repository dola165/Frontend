import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
vi.mock('./bridge', async importOriginal => ({ ...await importOriginal<typeof import('./bridge')>(), isAndroidApp: true }));
import { AuthProvider, useAuth } from '../context/AuthContext';
import { setStoredAccessToken } from '../utils/authStorage';

afterEach(() => { cleanup(); localStorage.clear(); delete window.GrassKickZ; });
function Account() { const { user, status } = useAuth(); return <p>{user?.fullName ?? status}</p>; }
function connection(active: boolean, offline: () => boolean) {
    const requests: string[] = [];
    window.GrassKickZ = { onmessage: null, postMessage: message => {
        const request = JSON.parse(message); requests.push(request.path ?? request.kind);
        let data: unknown = {};
        if (request.kind === 'session') data = { active, session: '1' };
        if (request.path === '/api/auth/csrf') data = { headerName: 'X-XSRF-TOKEN', token: 'csrf' };
        if (request.path === '/api/users/me') data = { id: 17, fullName: 'Android Test Account', profileComplete: true };
        const reply = request.path === '/api/users/me' && offline() ? { error: 'Offline' }
            : { status: 200, headers: { 'content-type': 'application/json' }, body: btoa(JSON.stringify(data)) };
        queueMicrotask(() => window.GrassKickZ?.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ id: request.id, ...reply }) })));
    } };
    return requests;
}
it('keeps native sign-in through a failed bootstrap and recovers with retry', async () => {
    setStoredAccessToken('native-session');
    let offline = true;
    const requests = connection(true, () => offline);
    render(<AuthProvider><Account /></AuthProvider>);
    await screen.findByRole('alert');
    expect(localStorage.getItem('accessToken')).toBe('native-session');
    expect(requests).not.toContain('logout');
    offline = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Android Test Account');
    expect(requests).not.toContain('/api/auth/refresh');
});
it('allows guest account screens without trying to refresh a nonexistent login', async () => {
    const requests = connection(false, () => false);
    render(<AuthProvider><Account /></AuthProvider>);
    await screen.findByText('anonymous');
    expect(requests).not.toContain('/api/users/me');
    expect(requests).not.toContain('/api/auth/refresh');
});
