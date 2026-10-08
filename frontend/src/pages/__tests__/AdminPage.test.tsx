import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminPage } from '../AdminPage';
import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import type { AdminClub } from '../../features/admin/api';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));

const club = (overrides: Partial<AdminClub> = {}): AdminClub => ({
    id: 41, name: 'Tbilisi Juniors', type: 'ACADEMY', isOfficial: false,
    description: 'Local youth academy.', cityName: 'Tbilisi', countryName: 'Georgia', ...overrides,
});
const page = (content: AdminClub[], pageNumber = 0, totalElements = content.length) => ({
    data: { content, pageNumber, pageSize: 12, totalElements },
});
const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
const setAccount = (role = 'SYSTEM_ADMIN', id = 7, sessionId = 'admin-session') => {
    vi.mocked(useAuth).mockReturnValue({ status: 'authenticated', user: { id, role }, sessionId } as ReturnType<typeof useAuth>);
};
const renderPage = () => render(<MemoryRouter><AdminPage /></MemoryRouter>);
const openClubs = async () => {
    const result = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Club verification' }));
    await screen.findByRole('heading', { name: 'Tbilisi Juniors' });
    return result;
};
const review = () => fireEvent.click(screen.getByRole('button', { name: 'Review verification' }));

beforeEach(() => {
    vi.resetAllMocks();
    setAccount();
    vi.mocked(apiClient.get).mockResolvedValue(page([club()]));
});

describe('administration club verification', () => {
    it.each(['FAN', 'CLUB_ADMIN', 'ORGANIZER'])('does not load admin data or expose verification for %s', role => {
        setAccount(role);
        renderPage();
        expect(screen.getByRole('alert')).toHaveTextContent('System administrator access is required.');
        expect(screen.queryByRole('button', { name: 'Club verification' })).not.toBeInTheDocument();
        expect(apiClient.get).not.toHaveBeenCalled();
        expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('requires review, submits once while pending, and refetches the authoritative verified state', async () => {
        const save = deferred<{ data: { id: number; isOfficial: boolean } }>();
        vi.mocked(apiClient.post).mockReturnValue(save.promise);
        await openClubs();
        expect(apiClient.get).toHaveBeenCalledWith('/clubs', expect.objectContaining({
            params: { search: undefined, page: 0, size: 12, sort: 'NEWEST' },
        }));
        expect(screen.queryByRole('button', { name: 'Confirm verification' })).not.toBeInTheDocument();
        review();
        expect(screen.getByText(/eligible to host tournaments/)).toBeInTheDocument();
        const confirm = screen.getByRole('button', { name: 'Confirm verification' });
        fireEvent.click(confirm);
        fireEvent.click(confirm);
        expect(apiClient.post).toHaveBeenCalledTimes(1);
        expect(apiClient.post).toHaveBeenCalledWith('/admin/clubs/41/verification', undefined, expect.objectContaining({ signal: expect.any(AbortSignal) }));
        expect(screen.getByRole('button', { name: 'Verifying…' })).toBeDisabled();
        expect(screen.getByLabelText('Search clubs')).toBeDisabled();
        expect(screen.getByText('Unverified club')).toBeInTheDocument();
        vi.mocked(apiClient.get).mockResolvedValue(page([club({ isOfficial: true })]));
        await act(async () => save.resolve({ data: { id: 41, isOfficial: true } }));
        expect(await screen.findByText('Verified club')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Tbilisi Juniors is verified.');
        expect(apiClient.get).toHaveBeenCalledTimes(2);
        expect(screen.queryByRole('button', { name: 'Review verification' })).not.toBeInTheDocument();
    });

    it('cancels review without a write and does not offer verification for an already verified club', async () => {
        await openClubs();
        review();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('button', { name: 'Confirm verification' })).not.toBeInTheDocument();
        expect(apiClient.post).not.toHaveBeenCalled();
        vi.mocked(apiClient.get).mockResolvedValue(page([club({ isOfficial: true })]));
        fireEvent.click(screen.getByRole('button', { name: 'Refresh clubs' }));
        expect(await screen.findByText('Verified club')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Review verification' })).not.toBeInTheDocument();
    });

    it.each([403, 409])('shows a server %s failure without changing the verification badge', async status => {
        vi.mocked(apiClient.post).mockRejectedValue({ response: { status, data: { error: 'Club verification is unavailable.' } } });
        await openClubs();
        review();
        fireEvent.click(screen.getByRole('button', { name: 'Confirm verification' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Club verification is unavailable.');
        expect(screen.getByText('Unverified club')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Confirm verification' })).toBeEnabled();
        expect(screen.queryByText('Tbilisi Juniors is verified.')).not.toBeInTheDocument();
    });

    it.each([{ id: 42, isOfficial: true }, { id: 41, isOfficial: false }, {}])('does not invent success for an unconfirmed response %j', async data => {
        vi.mocked(apiClient.post).mockResolvedValue({ data });
        await openClubs();
        review();
        fireEvent.click(screen.getByRole('button', { name: 'Confirm verification' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Could not confirm verification.');
        expect(screen.getByText('Unverified club')).toBeInTheDocument();
        expect(apiClient.get).toHaveBeenCalledTimes(1);
    });

    it('keeps a successful write distinct from a failed list refresh and retries the read only', async () => {
        vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 41, isOfficial: true } });
        await openClubs();
        vi.mocked(apiClient.get).mockRejectedValue(new Error('Offline'));
        review();
        fireEvent.click(screen.getByRole('button', { name: 'Confirm verification' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the club list.');
        expect(screen.getByRole('status')).toHaveTextContent('Tbilisi Juniors is verified.');
        vi.mocked(apiClient.get).mockResolvedValue(page([club({ isOfficial: true })]));
        fireEvent.click(screen.getByRole('button', { name: 'Retry club list' }));
        expect(await screen.findByText('Verified club')).toBeInTheDocument();
        expect(apiClient.post).toHaveBeenCalledTimes(1);
    });

    it('ignores an old search response and keeps the latest search through pagination', async () => {
        await openClubs();
        const old = deferred<ReturnType<typeof page>>();
        vi.mocked(apiClient.get).mockReturnValueOnce(old.promise);
        fireEvent.change(screen.getByLabelText('Search clubs'), { target: { value: 'old' } });
        await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
        vi.mocked(apiClient.get).mockResolvedValue(page([club({ name: 'New result' })], 0, 13));
        fireEvent.change(screen.getByLabelText('Search clubs'), { target: { value: 'new' } });
        expect(await screen.findByRole('heading', { name: 'New result' })).toBeInTheDocument();
        await act(async () => old.resolve(page([club({ name: 'Stale result' })])));
        expect(screen.queryByText('Stale result')).not.toBeInTheDocument();
        vi.mocked(apiClient.get).mockResolvedValue(page([club({ id: 42, name: 'New second page' })], 1, 13));
        fireEvent.click(screen.getByRole('button', { name: 'Next clubs' }));
        expect(await screen.findByRole('heading', { name: 'New second page' })).toBeInTheDocument();
        expect(apiClient.get).toHaveBeenLastCalledWith('/clubs', expect.objectContaining({ params: { search: 'new', page: 1, size: 12, sort: 'NEWEST' } }));
        expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    });

    it('retires pending verification UI when the signed-in administrator changes', async () => {
        const save = deferred<{ data: { id: number; isOfficial: boolean } }>();
        vi.mocked(apiClient.post).mockReturnValue(save.promise);
        const view = await openClubs();
        review();
        fireEvent.click(screen.getByRole('button', { name: 'Confirm verification' }));
        const signal = vi.mocked(apiClient.post).mock.calls[0][2]?.signal;
        setAccount('FAN', 8, 'other-session');
        view.rerender(<MemoryRouter><AdminPage /></MemoryRouter>);
        expect(signal?.aborted).toBe(true);
        await act(async () => save.resolve({ data: { id: 41, isOfficial: true } }));
        expect(screen.getByRole('alert')).toHaveTextContent('System administrator access is required.');
        expect(screen.queryByText('Tbilisi Juniors is verified.')).not.toBeInTheDocument();
    });

    it('distinguishes email verification in the user directory from club verification', async () => {
        vi.mocked(apiClient.get).mockResolvedValue({ data: {
            content: [{ id: 8, displayName: 'Example Admin', username: 'example', email: 'example@example.test', role: 'SYSTEM_ADMIN', emailVerified: true, profileComplete: true }],
            pageNumber: 0, pageSize: 24, totalElements: 1,
        } });
        renderPage();
        const heading = await screen.findByRole('heading', { name: 'Example Admin' });
        expect(within(heading.closest('article')!).getByText('Email verified')).toBeInTheDocument();
        expect(screen.getByText('Email Verified In View')).toBeInTheDocument();
    });
});
