import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../../../i18n';
import { ApplicationsTab, type ApplicationFilters } from '../ApplicationsTab';
import type { ClubMembershipApplication } from '../../../../features/clubs/domain';
import type { RecruitmentReceipt } from '../../../../features/recruitment/RecruitmentApplication';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), refresh: vi.fn() }));
vi.mock('../../../../api/axiosConfig', () => ({ apiClient: api, DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost' } }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ refreshNavigationCapabilities: api.refresh }) }));

const pendingA: ClubMembershipApplication = {
    id: 501, userId: 21, fullName: 'Luka Trialist', username: 'luka.trial', avatarUrl: null,
    role: 'PLAYER', status: 'PENDING', message: 'I want to join the U15s.',
    createdAt: '2026-08-20T10:00:00', position: 'STRIKER', ageGroup: 'U15',
    jobId: null, jobTitle: null, age: 15, preferredFoot: 'LEFT', heightCm: 176,
    currentClubName: 'Saburtalo Academy', careerHistoryCount: 2, isMinor: true, currentConsentStatus: 'PENDING',
};

const pendingB: ClubMembershipApplication = {
    id: 502, userId: 22, fullName: 'Nika Goalkeeper', username: 'nika.gk', avatarUrl: null,
    role: 'PLAYER', status: 'PENDING', message: 'GK looking for a club.',
    createdAt: '2026-08-19T10:00:00', position: 'GOALKEEPER', ageGroup: 'U16',
    jobId: null, jobTitle: null, age: 17, preferredFoot: 'RIGHT', heightCm: 188,
    currentClubName: null, careerHistoryCount: 4, isMinor: true, currentConsentStatus: null,
};

const declined: ClubMembershipApplication = {
    id: 503, userId: 23, fullName: 'Adult Coach Candidate', username: 'coach.cand', avatarUrl: null,
    role: 'COACH', status: 'DECLINED', message: 'U14 coach opening.',
    createdAt: '2026-08-18T10:00:00', position: null, ageGroup: 'U14',
    jobId: null, jobTitle: null, age: 32, preferredFoot: null, heightCm: null,
    currentClubName: null, careerHistoryCount: null, isMinor: false, currentConsentStatus: null,
};

const baseFilters: ApplicationFilters = { position: '', ageGroup: '', status: 'PENDING', jobId: '' };

const receiptFor = (application: ClubMembershipApplication): RecruitmentReceipt => ({
    id: application.id, clubId: 1, clubName: 'FC Dinamo Tbilisi Academy',
    applicantName: application.fullName!, role: application.role, status: application.status,
    jobId: application.jobId ?? null, jobTitle: application.jobTitle ?? null, message: application.message ?? null,
    decisionMessage: null, offer: null, canRespond: false, canWithdraw: false,
    canOffer: application.status === 'PENDING', canCancelOffer: false, unavailableReason: null,
});

beforeEach(() => {
    vi.resetAllMocks();
    api.refresh.mockResolvedValue(undefined);
    api.post.mockResolvedValue({});
    api.get.mockImplementation(async (url: string) => {
        if (url === '/recruitment/applications/501/options') return { data: { specialisms: [], squads: [] } };
        const application = [pendingA, pendingB, declined].find((item) => url === `/recruitment/applications/${item.id}`);
        if (!application) throw new Error(`Unexpected mocked request: ${url}`);
        return { data: receiptFor(application) };
    });
});

const renderTab = (overrides: Partial<Parameters<typeof ApplicationsTab>[0]> = {}) => {
    const props = {
        applications: [pendingA, pendingB, declined],
        applicationsLoading: false,
        applicationsError: null,
        filters: baseFilters,
        bulkPending: false,
        onFiltersChange: vi.fn(),
        onAcceptApplication: vi.fn(),
        onDeclineApplication: vi.fn(),
        onBulkDecide: vi.fn().mockResolvedValue(true),
        onRetry: vi.fn(),
        ...overrides,
    };
    render(<MemoryRouter><ApplicationsTab {...props} /></MemoryRouter>);
    return props;
};

describe('ApplicationsTab — phase A3 triage', () => {
    it('renders the inline applicant summary chips', () => {
        renderTab();
        expect(screen.getByText('15y')).toBeInTheDocument();
        expect(screen.getByText('LEFT')).toBeInTheDocument();
        expect(screen.getByText('176 cm')).toBeInTheDocument();
        expect(screen.getByText('Saburtalo Academy')).toBeInTheDocument();
        expect(screen.getByText('2 past club(s)')).toBeInTheDocument();
        expect(screen.getAllByText('Minor').length).toBeGreaterThanOrEqual(1);
    });

    it('propagates filter changes', () => {
        const props = renderTab();
        fireEvent.change(screen.getByLabelText('Position'), { target: { value: 'GOALKEEPER' } });
        expect(props.onFiltersChange).toHaveBeenCalledWith({ ...baseFilters, position: 'GOALKEEPER' });
        fireEvent.change(screen.getByLabelText('Age group'), { target: { value: 'U16' } });
        expect(props.onFiltersChange).toHaveBeenCalledWith({ ...baseFilters, ageGroup: 'U16' });
    });

    it('disables the checkbox for non-pending rows', () => {
        renderTab();
        const declinedBox = screen.getByLabelText('Select Adult Coach Candidate') as HTMLInputElement;
        expect(declinedBox.disabled).toBe(true);
    });

    // Individual offers require applicant consent; bulk triage supports decline.
    it('bulk decline: selection → note modal → onBulkDecide with ids, action and message; selection clears on success', async () => {
        const props = renderTab();
        fireEvent.click(screen.getByLabelText('Select Luka Trialist'));
        fireEvent.click(screen.getByLabelText('Select Nika Goalkeeper'));
        expect(screen.queryByRole('button', { name: 'Accept (2)' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Decline (2)' }));

        const textarea = screen.getByLabelText(/Message to the applicant/) as HTMLTextAreaElement;
        fireEvent.change(textarea, { target: { value: 'Thursday 18:00, pitch 2.' } });
        expect(props.onBulkDecide).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Decline' }));

        await waitFor(() => expect(props.onBulkDecide).toHaveBeenCalledWith(
            [501, 502], 'DECLINE', 'Thursday 18:00, pitch 2.'
        ));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(screen.getByLabelText('Select Luka Trialist')).not.toBeChecked();
        expect(screen.getByLabelText('Select Nika Goalkeeper')).not.toBeChecked();
        expect(screen.queryByRole('button', { name: 'Decline (2)' })).toBeNull();
        expect(props.onAcceptApplication).not.toHaveBeenCalled();
    });

    it('bulk decline: opens the note modal with the Decline label', async () => {
        renderTab();
        fireEvent.click(screen.getByLabelText('Select Luka Trialist'));
        fireEvent.click(screen.getByRole('button', { name: 'Decline (1)' }));
        expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
        expect(screen.getByText('Decline applications')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Use template' }));
        expect(screen.getByLabelText(/Message to the applicant/)).toHaveValue('Thank you for applying. We will not be proceeding with this application.');
    });

    it('keeps the selection when the bulk request fails', async () => {
        const props = renderTab({ onBulkDecide: vi.fn().mockResolvedValue(false) });
        fireEvent.click(screen.getByLabelText('Select Luka Trialist'));
        fireEvent.click(screen.getByRole('button', { name: 'Decline (1)' }));
        fireEvent.change(screen.getByLabelText(/Message to the applicant/), { target: { value: 'Please contact us next season.' } });
        fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
        await waitFor(() => expect(props.onBulkDecide).toHaveBeenCalledExactlyOnceWith([501], 'DECLINE', 'Please contact us next season.'));
        expect(screen.getByRole('dialog', { name: 'Decline applications' })).toBeInTheDocument();
        expect(screen.getByLabelText(/Message to the applicant/)).toHaveValue('Please contact us next season.');
        expect(screen.getByLabelText('Select Luka Trialist')).toBeChecked();
        fireEvent.keyDown(document, { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(screen.getByRole('button', { name: 'Decline (1)' })).toBeInTheDocument();
        expect(screen.getByLabelText('Select Luka Trialist')).toBeChecked();
        expect(props.onAcceptApplication).not.toHaveBeenCalled();
    });

    it('reviews the complete message before preparing an individual offer that still requires applicant consent', async () => {
        const pending = receiptFor(pendingA);
        const offered: RecruitmentReceipt = { ...pending, status: 'OFFERED', canOffer: false, canCancelOffer: true,
            offer: { title: 'Player trial', specialism: null, squad_name: null, engagement: null,
                starts_on: null, ends_on: null, expires_at: '2026-10-17T12:00:00', permissions: [],
                message: 'Thursday 18:00, pitch 2.', appointment_id: null } };
        api.get.mockResolvedValueOnce({ data: pending })
            .mockResolvedValueOnce({ data: { specialisms: [], squads: [] } })
            .mockResolvedValueOnce({ data: offered });
        const props = renderTab();
        fireEvent.click(screen.getAllByRole('button', { name: 'Review' })[0]);
        const dialog = screen.getByRole('dialog', { name: 'Luka Trialist' });
        expect(within(dialog).getByText(pendingA.message!)).toBeInTheDocument();
        expect(within(dialog).getByText('Consent pending')).toBeInTheDocument();
        expect(api.post).not.toHaveBeenCalled();
        expect(within(dialog).queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
        fireEvent.click(await within(dialog).findByRole('button', { name: 'Prepare offer' }));
        const textarea = await within(dialog).findByLabelText('Next steps for the applicant');
        expect(within(dialog).getByText(/Access starts only after acceptance/)).toBeInTheDocument();
        fireEvent.change(textarea, { target: { value: 'Thursday 18:00, pitch 2.' } });
        expect(api.post).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Send offer' }));
        await waitFor(() => expect(props.onRetry).toHaveBeenCalledTimes(1));
        expect(api.post).toHaveBeenCalledExactlyOnceWith('/recruitment/applications/501/offer', expect.objectContaining({ message: 'Thursday 18:00, pitch 2.' }));
        expect(api.get).toHaveBeenNthCalledWith(1, '/recruitment/applications/501');
        expect(api.get).toHaveBeenNthCalledWith(2, '/recruitment/applications/501/options', expect.objectContaining({ signal: expect.any(AbortSignal) }));
        expect(api.get).toHaveBeenNthCalledWith(3, '/recruitment/applications/501');
        expect(api.refresh).toHaveBeenCalledTimes(1);
        expect(props.onAcceptApplication).not.toHaveBeenCalled();
        expect(within(dialog).getByText(/Acceptance records the old trial request/)).toHaveTextContent('Club participation and any required guardian confirmation remain separate steps.');
        expect(within(dialog).getByRole('article', { name: 'FC Dinamo Tbilisi Academy application' })).toHaveTextContent('Awaiting applicant response');
        expect(within(dialog).queryByRole('button', { name: 'Review acceptance' })).not.toBeInTheDocument();
        expect(within(dialog).queryByRole('button', { name: 'Accept offer' })).not.toBeInTheDocument();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('excludes hidden selections from the confirmed bulk request', async () => {
        const props = renderTab();
        fireEvent.click(screen.getByLabelText('Select Luka Trialist'));
        fireEvent.click(screen.getByLabelText('Select Nika Goalkeeper'));
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Nika' } });
        fireEvent.click(screen.getByRole('button', { name: 'Decline (1)' }));
        fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
        await waitFor(() => expect(props.onBulkDecide).toHaveBeenCalledExactlyOnceWith([502], 'DECLINE', null));
        expect(props.onAcceptApplication).not.toHaveBeenCalled();
    });

    it('hands a pending individual decline to the parent only after complete review', async () => {
        const props = renderTab();
        fireEvent.click(screen.getAllByRole('button', { name: 'Review' })[0]);
        const dialog = screen.getByRole('dialog', { name: 'Luka Trialist' });
        expect(within(dialog).getByText(pendingA.message!)).toBeInTheDocument();
        await within(dialog).findByRole('button', { name: 'Prepare offer' });
        expect(props.onDeclineApplication).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Decline' }));
        expect(props.onDeclineApplication).toHaveBeenCalledExactlyOnceWith(501);
        expect(props.onAcceptApplication).not.toHaveBeenCalled();
        expect(api.post).not.toHaveBeenCalled();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not expose offer or acceptance controls when the receipt denies current offer authority', async () => {
        api.get.mockResolvedValueOnce({ data: { ...receiptFor(pendingA), canOffer: false,
            unavailableReason: 'Current club leadership must review this application.' } });
        const props = renderTab();
        fireEvent.click(screen.getAllByRole('button', { name: 'Review' })[0]);
        const dialog = screen.getByRole('dialog', { name: 'Luka Trialist' });
        await within(dialog).findByText('Current club leadership must review this application.');
        expect(within(dialog).queryByRole('button', { name: 'Prepare offer' })).not.toBeInTheDocument();
        expect(within(dialog).queryByRole('button', { name: 'Review acceptance' })).not.toBeInTheDocument();
        expect(api.post).not.toHaveBeenCalled();
        expect(props.onAcceptApplication).not.toHaveBeenCalled();
    });

    it('sorts applicants by the applicant column despite the leading selection column', () => {
        renderTab();
        fireEvent.click(screen.getByRole('button', { name: /Applicant.*⇅/ }));
        expect(within(screen.getAllByRole('row')[1]).getByText('Adult Coach Candidate')).toBeInTheDocument();
    });
});
