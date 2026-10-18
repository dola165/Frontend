import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuthSessionId, setRefreshedAccessToken, setStoredAccessToken, setStoredUserId } from '../../../utils/authStorage';
import { apiClient } from '../../../api/axiosConfig';
import * as clubs from '../../clubs/api';
import { PeekBody } from '../peek/PeekBody';

const account = vi.hoisted(() => ({ id: 1, status: 'authenticated' as 'authenticated' | 'bootstrapping' }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: account.status, user: account.status === 'authenticated' ? { id: account.id } : undefined }) }));
vi.mock('../../clubs/api', async original => ({ ...await original<typeof import('../../clubs/api')>(), fetchPublicJob: vi.fn(), fetchMyJobApplication: vi.fn(), createClubApplication: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() }, DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost' } }));
vi.mock('../../recruitment/RecruitmentApplication', () => ({ RecruitmentApplication: ({ applicationId }: { applicationId: number }) => <p role="status">Saved application {applicationId}</p> }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en', resolvedLanguage: 'en' } }) }));

const job = (id: number): clubs.ClubJob => ({ id, clubId: 10, clubName: 'QA club', title: `Assistant coach ${id}`, description: 'Two evenings a week.',
    category: 'COACHING', engagementType: 'PAID', requiredRole: 'COACH', status: 'OPEN', createdAt: '2026-10-10T10:00:00Z', applicationCount: 0 });
const element = (id = 401, place: 'pane' | 'drawer' = 'pane') => <MemoryRouter initialEntries={[`/world/opportunities?tab=jobs&peek=job-${id}`]}>
    <PeekBody kind="job" id={String(id)} place={place} side="right" close={() => undefined} />
</MemoryRouter>;
const message = () => screen.getByRole('textbox', { name: 'Message to the club' });
const login = (id: number) => { account.id = id; account.status = 'authenticated'; setStoredUserId(id); setStoredAccessToken(`synthetic-world-job-login-${id}`); };
const ready = async () => { const input = await screen.findByRole('textbox', { name: 'Message to the club' }); await waitFor(() => expect(input).toBeEnabled()); return input; };

beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear(); login(1);
    vi.mocked(clubs.fetchPublicJob).mockImplementation(async id => job(id));
    vi.mocked(clubs.fetchMyJobApplication).mockResolvedValue(null);
    vi.mocked(apiClient.get).mockResolvedValue({ data: { allowed: true, reason: null, message: null, pendingApplicationId: null, pendingInvitationId: null, eligibleFrom: null } });
});

describe('World job preview application login boundary', () => {
    it('retires an unsent answer across bootstrap and another account while the same pane stays open', async () => {
        const view = render(element()); await ready();
        fireEvent.change(message(), { target: { value: 'Private answer from account A' } });
        act(() => { account.status = 'bootstrapping'; setStoredAccessToken('synthetic-world-job-next'); }); view.rerender(element());
        act(() => login(2)); view.rerender(element());
        expect(await ready()).toHaveValue('');
        expect(screen.queryByDisplayValue('Private answer from account A')).not.toBeInTheDocument();
        expect(clubs.createClubApplication).not.toHaveBeenCalled();
    });

    it('retires the drawer form as soon as stored login changes before AuthContext catches up', async () => {
        render(element(401, 'drawer')); await ready();
        fireEvent.change(message(), { target: { value: 'Answer belonging to the retired login' } });
        act(() => setStoredAccessToken('synthetic-world-job-new-login'));
        expect(await ready()).toHaveValue('');
        expect(clubs.fetchMyJobApplication).toHaveBeenCalledTimes(2);
    });

    it('rechecks a saved receipt on a fresh login to the same account', async () => {
        vi.mocked(clubs.fetchMyJobApplication).mockResolvedValueOnce({ id: 501, clubId: 10, status: 'PENDING' });
        render(element()); await screen.findByText('Saved application 501');
        let resolve!: (value: clubs.MyJobApplication | null) => void;
        vi.mocked(clubs.fetchMyJobApplication).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
        act(() => login(1));
        await waitFor(() => expect(clubs.fetchMyJobApplication).toHaveBeenCalledTimes(2));
        expect(screen.queryByText('Saved application 501')).not.toBeInTheDocument();
        await act(async () => resolve(null)); expect(await ready()).toHaveValue('');
    });

    it.each(['success', 'failure'] as const)('keeps account B enabled and separate from account As pending %s', async outcome => {
        let finish!: () => void;
        vi.mocked(clubs.createClubApplication).mockImplementationOnce(() => new Promise((resolve, reject) => { finish = () => outcome === 'success' ? resolve({ applicationId: 501 }) : reject(new Error('Previous login response')); }));
        const view = render(element()); await ready();
        fireEvent.change(message(), { target: { value: 'Submitted by account A' } }); const originalSession = getAuthSessionId();
        fireEvent.submit(message().closest('form')!);
        expect(clubs.createClubApplication).toHaveBeenCalledWith(10, 'COACH', 'Submitted by account A', { jobId: 401 }, { _authSessionId: originalSession });
        act(() => login(2)); view.rerender(element());
        expect(await ready()).toHaveValue('');
        fireEvent.change(message(), { target: { value: 'Own answer from account B' } });
        await act(async () => finish());
        expect(message()).toHaveValue('Own answer from account B'); expect(message()).toBeEnabled();
        expect(screen.queryByText('Saved application 501')).not.toBeInTheDocument();
        expect(screen.queryByText('Previous login response')).not.toBeInTheDocument();
        expect(clubs.createClubApplication).toHaveBeenCalledOnce();
    });

    it('already isolates listing changes through the actual PeekBody key', async () => {
        const view = render(element()); await ready(); fireEvent.change(message(), { target: { value: 'Only for listing 401' } });
        view.rerender(element(402)); expect(await ready()).toHaveValue('');
        expect(screen.getByRole('heading', { name: 'Assistant coach 402', level: 2 })).toBeInTheDocument();
        expect(clubs.createClubApplication).not.toHaveBeenCalled();
    });

    it('keeps the current answer through ordinary rerender, token refresh and eligibility retry', async () => {
        const view = render(element()); await ready(); fireEvent.change(message(), { target: { value: 'Keep my current answer' } });
        const currentSession = getAuthSessionId();
        act(() => setRefreshedAccessToken('synthetic-world-job-refreshed-token', currentSession)); view.rerender(element());
        act(() => window.dispatchEvent(new Event('focus')));
        expect(await ready()).toHaveValue('Keep my current answer'); expect(getAuthSessionId()).toBe(currentSession);
        expect(clubs.fetchMyJobApplication).toHaveBeenCalledOnce(); expect(clubs.createClubApplication).not.toHaveBeenCalled();
    });

    it('reads the accepted receipt after leaving an unknown reply and returning without submitting again', async () => {
        let finish!: (value: { applicationId: number }) => void;
        vi.mocked(clubs.createClubApplication).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const view = render(element()); await ready(); fireEvent.change(message(), { target: { value: 'Original answer' } });
        fireEvent.submit(message().closest('form')!); view.unmount();
        vi.mocked(clubs.fetchMyJobApplication).mockResolvedValueOnce({ id: 501, clubId: 10, status: 'PENDING' });
        render(element()); await screen.findByText('Saved application 501'); await act(async () => finish({ applicationId: 501 }));
        expect(screen.getByText('Saved application 501')).toBeInTheDocument(); expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(clubs.createClubApplication).toHaveBeenCalledOnce();
    });
});
