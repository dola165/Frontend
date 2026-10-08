import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthProvider, useAuth } from '../AuthContext';
import { apiClient } from '../../api/axiosConfig';
import { requiredAccountStep } from '../../utils/authRedirect';

const server = setupServer(
    http.get('*/auth/csrf', () => HttpResponse.json({ headerName: 'X-XSRF-TOKEN', token: 'masked-request-token' })),
    http.get('*/users/me', () => HttpResponse.json({ id: 1, role: 'PLAYER', fullName: 'Test Player',
        dob: '2000-01-01', profileComplete: true, onboardingRequired: false, mustChangePassword: false })),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => { cleanup(); server.resetHandlers(); localStorage.clear(); });
function Destination() {
    const { user, status } = useAuth();
    return <div>{status === 'authenticated' ? requiredAccountStep(user) ?? '/home' : status}</div>;
}

it.each([
    ['PASSWORD_CHANGE_REQUIRED', '/set-password'],
    ['DOB_REQUIRED', '/onboarding'],
    ['ONBOARDING_REQUIRED', '/onboarding'],
])('updates a running session to the completion screen for %s', async (code, destination) => {
    localStorage.setItem('accessToken', 'existing-session');
    server.use(http.get('*/restricted-action', () => HttpResponse.json({ code }, { status: 403 })));
    render(<AuthProvider><Destination /></AuthProvider>);
    await screen.findByText('/home');
    await act(async () => {
        await expect(apiClient.get('/restricted-action')).rejects.toMatchObject({ response: { status: 403 } });
    });
    await waitFor(() => expect(screen.getByText(destination)).toBeInTheDocument());
    expect(localStorage.getItem('accessToken')).toBe('existing-session');
});
