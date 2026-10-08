import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/axiosConfig';
import { OnboardingPage } from '../OnboardingPage';
import { ForgotPasswordPage } from '../ForgotPasswordPage';
import { ResetPasswordPage } from '../ResetPasswordPage';
import { VerifyEmailPage } from '../VerifyEmailPage';
import { clearAuthFlow, getAuthFlow, rememberAuthFlow } from '../../utils/authRedirect';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { post: vi.fn(), put: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
let auth: ReturnType<typeof useAuth>;
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear(); clearAuthFlow();
  auth = { user: { id: 17, fullName: 'Initial Person', role: 'FAN', dob: null, profileComplete: false, onboardingRequired: true }, sessionId: 'initial-session', status: 'anonymous', bootstrapSession: vi.fn().mockResolvedValue(null) } as unknown as ReturnType<typeof useAuth>;
  vi.mocked(useAuth).mockImplementation(() => auth);
  vi.mocked(apiClient.post).mockResolvedValue({ data: { message: 'Request completed.' } });
});
const onboarding = () => <MemoryRouter initialEntries={['/onboarding']}><OnboardingPage /></MemoryRouter>;

it('preserves edited name, date and responsibility across background account refreshes', async () => {
  const user = userEvent.setup(), view = render(onboarding());
  const name = document.getElementById('onboarding-name') as HTMLInputElement;
  await user.clear(name); await user.type(name, 'An unfinished name');
  fireEvent.change(document.getElementById('onboarding-dob')!, { target: { value: '1992-05-03' } });
  await user.click(screen.getByRole('radio', { name: 'Parent or guardian' }));
  auth = { ...auth, user: { ...auth.user! } }; view.rerender(onboarding());
  expect(name).toHaveValue('An unfinished name');
  expect(document.getElementById('onboarding-dob')).toHaveValue('1992-05-03');
  expect(screen.getByRole('radio', { name: 'Parent or guardian' })).toBeChecked();
});

it('starts fresh when onboarding belongs to a different account', async () => {
  const user = userEvent.setup(), view = render(onboarding());
  await user.type(document.getElementById('onboarding-name')!, ' private edit');
  auth = { ...auth, user: { ...auth.user!, id: 18, fullName: 'Other Person' }, sessionId: 'next-session' }; view.rerender(onboarding());
  expect(document.getElementById('onboarding-name')).toHaveValue('Other Person');
});

it('deduplicates password recovery requests and retains the private invitation destination', async () => {
  rememberAuthFlow({ nextPath: '/join-squad#private-invite' });
  let finish!: (value: unknown) => void;
  vi.mocked(apiClient.post).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'PERSON@example.test' } });
  const form = document.querySelector('form')!; fireEvent.submit(form); fireEvent.submit(form);
  expect(apiClient.post).toHaveBeenCalledTimes(1);
  expect(vi.mocked(apiClient.post).mock.calls[0][1]).toEqual({ email: 'person@example.test' });
  await act(async () => finish({ data: { message: 'Check your email.' } }));
  expect(screen.getByRole('status')).toHaveTextContent('Check your email');
  expect(screen.getByRole('link')).toHaveAttribute('href', '/login');
  expect(getAuthFlow().nextPath).toBe('/join-squad#private-invite');
});

it('validates reset passwords before posting and prevents double submission', async () => {
  vi.mocked(apiClient.post).mockImplementation(() => new Promise(() => undefined));
  render(<MemoryRouter initialEntries={['/reset-password?token=disposable-reset']}><ResetPasswordPage /></MemoryRouter>);
  const inputs = document.querySelectorAll<HTMLInputElement>('input[type="password"]'), form = document.querySelector('form')!;
  inputs.forEach(input => fireEvent.change(input, { target: { value: 'weak' } })); fireEvent.submit(form);
  expect(apiClient.post).not.toHaveBeenCalled(); expect(screen.getByRole('alert')).toBeInTheDocument();
  inputs.forEach(input => fireEvent.change(input, { target: { value: 'StrongPassword1' } })); fireEvent.submit(form); fireEvent.submit(form);
  expect(apiClient.post).toHaveBeenCalledTimes(1);
});

it('offers a fresh reset link when the original token is missing', () => {
  render(<MemoryRouter><ResetPasswordPage /></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Request a new reset link' })).toHaveAttribute('href', '/forgot-password');
  expect(screen.getByRole('button')).toBeDisabled(); expect(apiClient.post).not.toHaveBeenCalled();
});

it('retries interrupted verification without requiring a second email', async () => {
  vi.mocked(apiClient.post).mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValueOnce({ data: { accountInvitation: false } }).mockResolvedValueOnce({ data: { message: 'Email verified.', email: 'person@example.test' } });
  const user = userEvent.setup(); render(<MemoryRouter initialEntries={['/verify-email?token=interrupted-verification']}><VerifyEmailPage /></MemoryRouter>);
  await user.click(await screen.findByRole('button', { name: 'Retry verification' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Email verified.'));
  expect(apiClient.post).toHaveBeenCalledTimes(3);
});

it('does not retry a failed verification for each keystroke in the resend address', async () => {
  vi.mocked(apiClient.post).mockRejectedValue({ response: { status: 400, data: { code: 'expired_token' } } });
  const user = userEvent.setup(); render(<MemoryRouter initialEntries={['/verify-email?token=expired-while-editing-email']}><VerifyEmailPage /></MemoryRouter>);
  await user.type(await screen.findByLabelText('Registration email'), 'corrected@example.test');
  expect(apiClient.post).toHaveBeenCalledTimes(1);
});

it('does not turn a verified email into a verification error when session refresh fails', async () => {
  auth = { ...auth, status: 'authenticated', bootstrapSession: vi.fn().mockRejectedValue(new Error('Connection interrupted')) };
  vi.mocked(apiClient.post).mockResolvedValue({ data: { message: 'Email verified.' } });
  render(<MemoryRouter initialEntries={['/verify-email?token=verified-with-refresh-failure']}><VerifyEmailPage /></MemoryRouter>);
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Email verified.'));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
