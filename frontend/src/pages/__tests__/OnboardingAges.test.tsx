import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import '../../i18n';
import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { OnboardingPage } from '../OnboardingPage';

// The Google path's birth-date step: Google itself cannot run without a client id, so the step is checked here.
vi.mock('../../api/axiosConfig', () => ({ apiClient: { post: vi.fn(), put: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
const logout = vi.fn().mockResolvedValue(undefined);
const Where = () => <output data-testid="where">{useLocation().pathname}</output>;
const year = new Date().getFullYear();

beforeEach(() => {
    vi.resetAllMocks(); sessionStorage.clear(); localStorage.clear(); logout.mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({ user: { id: 41, fullName: 'Google Person', role: 'FAN', dob: null, email: 'google.person@example.test', profileComplete: false, onboardingRequired: true }, sessionId: 's', bootstrapSession: vi.fn().mockResolvedValue(null), logout } as unknown as ReturnType<typeof useAuth>);
});
const mount = () => render(<MemoryRouter initialEntries={['/onboarding']}><Routes><Route path="/onboarding" element={<OnboardingPage />} /><Route path="*" element={<Where />} /></Routes></MemoryRouter>);
const submit = (dob: string) => { fireEvent.change(document.getElementById('onboarding-dob')!, { target: { value: dob } }); fireEvent.submit(document.querySelector('form')!); };

it('asks a 13 to 15-year-old Google account for a parent’s email before saving the birth date', async () => {
    mount();
    submit(`${year - 14}-02-01`);
    expect(await screen.findByText('A parent approves your account')).toBeInTheDocument();
    expect(apiClient.put).not.toHaveBeenCalled();
    fireEvent.change(document.getElementById('onboarding-parent-email')!, { target: { value: 'parent@example.test' } });
    vi.mocked(apiClient.put).mockRejectedValue({ response: { status: 503, data: {} } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/users/me/onboarding', expect.objectContaining({ parentEmail: 'parent@example.test' }), expect.anything()));
});

it('signs out an under-13 Google account the server removed and shows the parent answer', async () => {
    vi.mocked(apiClient.put).mockRejectedValue({ response: { status: 400, data: { code: 'AGE_BELOW_MINIMUM' } } });
    mount();
    submit(`${year - 10}-02-01`);
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/signup'));
    expect(logout).toHaveBeenCalled();
    expect(localStorage.getItem('grasskickz.age-refusal.v1')).not.toBeNull();
});
