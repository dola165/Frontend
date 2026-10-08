import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '../../../../i18n';
import { TryoutsTab } from '../TryoutsTab';
import { apiClient } from '../../../../api/axiosConfig';
import { createTryout, updateTryout, deleteTryout } from '../../../../api/tryouts';

vi.mock('../../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() }, DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost' } }));
vi.mock('../../../../api/tryouts', async () => ({ ...(await vi.importActual('../../../../api/tryouts')), createTryout: vi.fn().mockResolvedValue({ id: 5 }), updateTryout: vi.fn(), deleteTryout: vi.fn() }));

const session = { tryoutId: 1, clubId: 8, title: 'Autumn academy session', tryoutDate: '2099-09-18T18:00:23', deadline: '2099-09-17T12:00:23', position: 'STRIKER', ageGroup: 'U17', description: 'Bring boots.' };
const baseProps = {
    clubId: 8, tryoutsLoading: false, pendingKey: null, onTryoutStatus: vi.fn(),
    tryoutApplicants: [
        { id: 51, userId: 15, name: 'Luka Trialist', status: 'PENDING', position: 'STRIKER', ageGroup: 'U17', matchScore: 0, attributes: {} },
        { id: 52, userId: 16, name: 'Nika Accepted', status: 'ACCEPTED', position: 'GOALKEEPER', ageGroup: 'U17', matchScore: 0, attributes: {} },
    ],
};

describe('Tryout review and session editor', () => {
    beforeEach(() => { vi.clearAllMocks(); vi.mocked(apiClient.get).mockResolvedValue({ data: { canManage: true, total: 1, openCount: 1, hasMore: false, content: [session] } }); });

    it('edits and cancels the selected real browse identity and reloads the remaining sessions', async () => {
        const other = { ...session, tryoutId: 29, title: 'Second session', status: 'CLOSED', deadline: '2020-09-17T12:00:23' };
        vi.mocked(apiClient.get).mockResolvedValue({ data: { canManage: true, total: 1, openCount: 1, hasMore: false, content: [session, other] } });
        render(<MemoryRouter><TryoutsTab {...baseProps}/></MemoryRouter>);
        fireEvent.click(await screen.findByRole('button', { name: 'Edit Second session' }));
        const dialog = screen.getByRole('dialog');
        fireEvent.change(within(dialog).getByLabelText('Tryout title'), { target: { value: 'Cosmetic correction' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save tryout' }));
        await waitFor(() => expect(updateTryout).toHaveBeenCalledWith(29, expect.objectContaining({ title: 'Cosmetic correction', deadline: other.deadline, tryoutDate: other.tryoutDate })));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: 'Cancel Second session' }));
        vi.mocked(apiClient.get).mockResolvedValue({ data: { canManage: true, total: 1, openCount: 1, hasMore: false, content: [session] } });
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel tryout' }));
        await waitFor(() => expect(deleteTryout).toHaveBeenCalledWith(29));
        await waitFor(() => expect(screen.queryByText('Second session')).not.toBeInTheDocument());
        expect(screen.getByText(session.title)).toBeVisible();
    });

    it.each([0, -1, undefined])('rejects unusable browse identities instead of offering invalid mutations (%s)', async tryoutId => {
        vi.mocked(apiClient.get).mockResolvedValue({ data: { canManage: true, total: 1, openCount: 1, hasMore: false, content: [{ ...session, tryoutId }] } });
        render(<MemoryRouter><TryoutsTab {...baseProps}/></MemoryRouter>);
        expect(await screen.findByText('Tryout action failed')).toBeVisible();
        expect(screen.queryByRole('button', { name: `Edit ${session.title}` })).not.toBeInTheDocument();
    });

    it('keeps completed decisions read-only and hands pending decisions to the parent note flow', async () => {
        render(<MemoryRouter><TryoutsTab {...baseProps} /></MemoryRouter>);
        await screen.findByText(session.title);
        expect(screen.getAllByRole('button', { name: 'Accept' })).toHaveLength(1);
        fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
        expect(baseProps.onTryoutStatus).toHaveBeenCalledWith(51, 'ACCEPTED');
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Nika' } });
        expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
        expect(screen.getByText('Decision complete')).toBeInTheDocument();
    });

    it('submits a trimmed session through the existing API and closes after saving', async () => {
        render(<MemoryRouter><TryoutsTab {...baseProps} /></MemoryRouter>);
        fireEvent.click(await screen.findByRole('button', { name: 'Post a tryout' }));
        const dialog = screen.getByRole('dialog', { name: 'New tryout' });
        fireEvent.change(within(dialog).getByLabelText('Tryout title'), { target: { value: '  Goalkeeper session  ' } });
        fireEvent.change(within(dialog).getByLabelText('Tryout date'), { target: { value: '2099-09-20T16:00' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save tryout' }));
        await waitFor(() => expect(createTryout).toHaveBeenCalledWith({ clubId: 8, title: 'Goalkeeper session', tryoutDate: '2099-09-20T16:00', deadline: undefined, position: undefined, ageGroup: undefined, description: undefined }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('shows a past session as completed even when its application deadline has passed', async () => {
        vi.mocked(apiClient.get).mockResolvedValue({ data: { canManage: true, total: 1, openCount: 1, hasMore: false, content: [{ ...session, status: 'EXPIRED', tryoutDate: '2020-09-18T18:00:00', deadline: '2020-09-17T12:00:00' }] } });
        render(<MemoryRouter><TryoutsTab {...baseProps} /></MemoryRouter>);
        await screen.findByText('Tryout date passed');
        expect(screen.queryByText('Applications closed')).not.toBeInTheDocument();
    });
});
