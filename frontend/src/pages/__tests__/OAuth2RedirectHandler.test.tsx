import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { clearAuthFlow, rememberAuthFlow } from '../../utils/authRedirect';
import { OAuth2RedirectHandler } from '../OAuth2RedirectHandler';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
const bootstrap = vi.fn();
let auth: ReturnType<typeof useAuth>;
const Destination = () => <p>{useLocation().pathname}</p>;
const callback = () => <MemoryRouter initialEntries={['/oauth2/callback']}><Routes>
    <Route path="/oauth2/callback" element={<OAuth2RedirectHandler />} />
    <Route path="*" element={<Destination />} />
</Routes></MemoryRouter>;

beforeEach(() => {
    vi.clearAllMocks(); clearAuthFlow();
    auth = { status: 'bootstrapping', user: null, bootstrapSession: bootstrap } as unknown as ReturnType<typeof useAuth>;
    vi.mocked(useAuth).mockImplementation(() => auth);
});

it('waits for the provider and recovers an absent callback session without a refresh loop', () => {
    const view = render(callback());
    expect(screen.getByRole('status')).toHaveTextContent('Initializing Secure Session');
    expect(bootstrap).not.toHaveBeenCalled();
    auth = { ...auth, status: 'anonymous' }; view.rerender(callback());
    expect(screen.getByText('/login')).toBeVisible();
    expect(bootstrap).not.toHaveBeenCalled();
});

it('continues an authenticated callback to its saved safe destination', () => {
    rememberAuthFlow({ nextPath: '/workspaces' });
    auth = { ...auth, status: 'authenticated', user: { id: 1, profileComplete: true } } as ReturnType<typeof useAuth>;
    render(callback()); expect(screen.getByText('/workspaces')).toBeVisible();
    expect(bootstrap).not.toHaveBeenCalled();
});

it.each([
    [{ mustChangePassword: true, profileComplete: true }, '/set-password'],
    [{ onboardingRequired: true, profileComplete: false }, '/onboarding'],
])('completes required account steps before the saved destination', (fields, destination) => {
    rememberAuthFlow({ nextPath: '/workspaces' });
    auth = { ...auth, status: 'authenticated', user: { id: 1, ...fields } } as ReturnType<typeof useAuth>;
    render(callback()); expect(screen.getByText(destination)).toBeVisible();
});
