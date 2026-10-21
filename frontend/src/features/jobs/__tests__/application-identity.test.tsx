import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuthSessionId, setStoredAccessToken, setStoredUserId } from '../../../utils/authStorage';
import { JobDetail } from '../JobDetail';
import { apiClient } from '../../../api/axiosConfig';
import * as clubs from '../../clubs/api';
import type { Job } from '../api';

const account = vi.hoisted(() => ({ id: 1, status: 'authenticated' as 'authenticated' | 'bootstrapping' }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: account.status, user: account.status === 'authenticated' ? { id: account.id } : undefined }) }));
vi.mock('../../clubs/api', async original => ({ ...await original<typeof import('../../clubs/api')>(), fetchPublicJob: vi.fn(), fetchMyJobApplication: vi.fn(), createClubApplication: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() }, DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost' } }));
vi.mock('../../recruitment/RecruitmentApplication', () => ({ RecruitmentApplication: ({ applicationId }: { applicationId: number }) => <p role="status">Saved application {applicationId}</p> }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en', resolvedLanguage: 'en' } }) }));

const job: Job = { id: 401, clubId: 10, clubName: 'Alpha FC', title: 'U12 assistant coach', description: 'Three evenings a week.', category: 'COACHING', engagementType: 'PAID', requiredRole: 'COACH', status: 'OPEN', createdAt: '2026-10-10T10:00:00Z', applicationCount: 0, direction: 'HIRING', poster: { kind: 'CLUB', id: 10, name: 'Alpha FC', avatarUrl: null, city: 'Tbilisi' }, applyMethod: 'IN_APP' };
const element = () => <MemoryRouter initialEntries={['/jobs/401']}><JobDetail id={401} /></MemoryRouter>;
const message = () => screen.getByRole('textbox');
const login = (id: number) => { account.id = id; account.status = 'authenticated'; setStoredUserId(id); setStoredAccessToken(`synthetic-test-session-${id}`); };
const waitForForm = async () => { const input = await screen.findByRole('textbox'); await waitFor(() => expect(input).toBeEnabled()); return input; };

beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear(); login(1);
    vi.mocked(clubs.fetchPublicJob).mockResolvedValue(job);
    vi.mocked(clubs.fetchMyJobApplication).mockResolvedValue(null);
    vi.mocked(apiClient.get).mockResolvedValue({ data: { allowed: true, reason: null, message: null, pendingApplicationId: null, pendingInvitationId: null, eligibleFrom: null } });
});

describe('Job application ownership across login and pending replies', () => {
    it('does not show the previous accounts unsent answer after bootstrap and a new login', async () => {
        const view = render(element()); await waitForForm();
        fireEvent.change(message(), { target: { value: 'Private answer from account A' } });
        act(() => { account.status = 'bootstrapping'; setStoredAccessToken('synthetic-session-b'); });
        view.rerender(element());
        act(() => login(2)); view.rerender(element());
        expect(await waitForForm()).toHaveValue('');
        expect(screen.queryByDisplayValue('Private answer from account A')).not.toBeInTheDocument();
        expect(clubs.createClubApplication).not.toHaveBeenCalled();
    });

    it('retires an unsent answer when storage changes before AuthContext catches up', async () => {
        render(element()); await waitForForm();
        fireEvent.change(message(), { target: { value: 'Answer in the retired login' } });
        act(() => setStoredAccessToken('synthetic-session-next'));
        expect(await waitForForm()).toHaveValue('');
        expect(clubs.fetchMyJobApplication).toHaveBeenCalledTimes(2);
    });

    it('rechecks the application receipt for a new login to the same account', async () => {
        vi.mocked(clubs.fetchMyJobApplication).mockResolvedValueOnce({ id: 501, clubId: 10, status: 'PENDING' });
        const view = render(element());
        await screen.findByText('Saved application 501');
        let recheck!: (value: clubs.MyJobApplication | null) => void;
        vi.mocked(clubs.fetchMyJobApplication).mockImplementationOnce(() => new Promise(resolve => { recheck = resolve; }));
        act(() => login(1)); view.rerender(element());
        await waitFor(() => expect(clubs.fetchMyJobApplication).toHaveBeenCalledTimes(2));
        expect(screen.queryByText('Saved application 501')).not.toBeInTheDocument();
        await act(async () => recheck(null));
        expect(await waitForForm()).toHaveValue('');
    });

    it.each(['success', 'failure'] as const)('keeps the new accounts answer and busy state separate from an old pending %s', async outcome => {
        let finish!: () => void;
        vi.mocked(clubs.createClubApplication).mockImplementationOnce(() => new Promise((resolve, reject) => { finish = () => outcome === 'success' ? resolve({ applicationId: 501 }) : reject(new Error('Retired login response')); }));
        const view = render(element()); await waitForForm();
        fireEvent.change(message(), { target: { value: 'Submitted by account A' } });
        const firstSession = getAuthSessionId();
        fireEvent.submit(message().closest('form')!);
        expect(clubs.createClubApplication).toHaveBeenCalledWith(10, 'COACH', 'Submitted by account A', { jobId: 401 }, { _authSessionId: firstSession });
        act(() => login(2)); view.rerender(element());
        expect(await waitForForm()).toHaveValue('');
        fireEvent.change(message(), { target: { value: 'Unsent answer from account B' } });
        await act(async () => finish());
        expect(message()).toHaveValue('Unsent answer from account B');
        expect(message()).toBeEnabled();
        expect(screen.queryByText('Saved application 501')).not.toBeInTheDocument();
        expect(screen.queryByText('Retired login response')).not.toBeInTheDocument();
        expect(clubs.createClubApplication).toHaveBeenCalledOnce();
    });

    it('keeps an answer on ordinary rerender and eligibility recheck in the same login', async () => {
        const view = render(element()); await waitForForm();
        fireEvent.change(message(), { target: { value: 'Keep this answer for the current login' } });
        view.rerender(element());
        expect(message()).toHaveValue('Keep this answer for the current login');
        act(() => window.dispatchEvent(new Event('focus')));
        expect(await waitForForm()).toHaveValue('Keep this answer for the current login');
        expect(clubs.createClubApplication).not.toHaveBeenCalled();
    });

    it('reads the accepted application after leaving during an unknown response instead of resubmitting', async () => {
        let finish!: (value: { applicationId: number }) => void;
        vi.mocked(clubs.createClubApplication).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const view = render(element()); await waitForForm();
        fireEvent.change(message(), { target: { value: 'Original application answer' } });
        fireEvent.submit(message().closest('form')!); view.unmount();
        vi.mocked(clubs.fetchMyJobApplication).mockResolvedValueOnce({ id: 501, clubId: 10, status: 'PENDING' });
        render(element()); await screen.findByText('Saved application 501');
        await act(async () => finish({ applicationId: 501 }));
        expect(screen.getByText('Saved application 501')).toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(clubs.createClubApplication).toHaveBeenCalledOnce();
    });
});
