import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../../../../i18n';
import { PlayersTab } from '../PlayersTab';
import type { ClubPlayerAffiliation, PageResult } from '../../../../features/clubs/domain';

const trialist: ClubPlayerAffiliation = {
    userId: 7,
    fullName: 'Giorgi Trialist',
    username: 'giorgi.trial',
    avatarUrl: null,
    status: 'TRIALIST',
    primary: false,
    source: 'application',
    joinedAt: '2026-08-10T10:00:00',
    endedAt: null,
    position: 'FWD',
    jerseyNumber: null,
    trialEndsOn: '2026-09-01',
    requiresParentalConsent: true,
    parentalConsentStatus: 'NOT_REQUIRED',
};

const active: ClubPlayerAffiliation = {
    userId: 8,
    fullName: 'Active Player',
    username: 'active.p',
    avatarUrl: null,
    status: 'ACTIVE',
    primary: true,
    source: 'invited',
    joinedAt: '2026-06-01T10:00:00',
    endedAt: null,
    position: 'MID',
    jerseyNumber: 10,
    trialEndsOn: null,
};

const makeDirectory = (content: ClubPlayerAffiliation[]): PageResult<ClubPlayerAffiliation> => ({
    content,
    pageNumber: 0,
    pageSize: 20,
    totalElements: content.length,
});

const renderTab = (overrides: Partial<Parameters<typeof PlayersTab>[0]> = {}) => {
    const props = {
        playerDirectory: makeDirectory([trialist, active]),
        playerLoading: false,
        playerError: null,
        playerStatusFilter: 'ALL' as const,
        pendingKey: null,
        canManagePlayerStatuses: true,
        totalPlayerPages: 1,
        onStatusFilterChange: vi.fn(),
        onPlayerStatusChange: vi.fn(),
        onTrialEndsChange: vi.fn(),
        onRetry: vi.fn(),
        onPageChange: vi.fn(),
        onTabChange: vi.fn(),
        ...overrides,
    };
    render(<PlayersTab {...props} />);
    return props;
};

describe('PlayersTab — phase A1 trialist actions', () => {
    it('keeps player intake unavailable with an explanation until joining access is ready', () => {
        const props=renderTab({canInvitePlayer:false,joiningUnavailableReason:'Joining access is loading.'});
        expect(screen.getByRole('button',{name:'Invite player'})).toBeDisabled();
        expect(screen.getByRole('status')).toHaveTextContent('Joining access is loading.');
        fireEvent.click(screen.getByRole('button',{name:'Invite player'}));
        expect(props.onTabChange).not.toHaveBeenCalled();
    });
    it('uses the known whole-cohort counts when an omitted total becomes non-finite', () => {
        renderTab({playerCounts:{ALL:Number.NaN,ACTIVE:86,REMOVED:2,PAST:0,TRIALIST:0}});
        expect(screen.getByRole('button',{name:/All players\s*88/})).toBeInTheDocument();
        expect(screen.queryByText('NaN')).not.toBeInTheDocument();
    });
    it('opens player intake rather than staff invitations', () => {
        const props=renderTab();fireEvent.click(screen.getByRole('button',{name:'Invite player'}));expect(props.onTabChange).toHaveBeenCalledWith('admissions');
    });
    it('shows a joining review and Release for preserved trialist rows', () => {
        renderTab();
        const promoteButtons = screen.getAllByRole('button', { name: 'Review joining' });
        expect(promoteButtons.length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByRole('button', { name: 'Release' }).length).toBeGreaterThanOrEqual(1);
    });

    it('continues the player’s joining arrangement without a parallel automatic promotion', () => {
        const props = renderTab();
        fireEvent.click(screen.getAllByRole('button', { name: 'Review joining' })[0]);
        expect(props.onTabChange).toHaveBeenCalledWith('admissions');expect(props.onPlayerStatusChange).not.toHaveBeenCalled();
    });

    it('Release goes through onPlayerStatusChange with REMOVED', () => {
        const props = renderTab();
        fireEvent.click(screen.getAllByRole('button', { name: 'Release' })[0]);
        expect(props.onPlayerStatusChange).toHaveBeenCalledWith(trialist.userId, 'REMOVED', 'Giorgi Trialist');
    });

    it('renders an editable trial-ends date input bound to the trialist row', () => {
        const props = renderTab();
        const input = screen.getByLabelText(`Trial ends Giorgi Trialist`) as HTMLInputElement;
        expect(input.value).toBe('2026-09-01');
        fireEvent.change(input, { target: { value: '2026-10-01' } });
        expect(props.onTrialEndsChange).toHaveBeenCalledWith(trialist.userId, '2026-10-01');
    });

    it('shows the trialist empty state when the TRIALIST filter has no rows', () => {
        renderTab({
            playerDirectory: makeDirectory([]),
            playerStatusFilter: 'TRIALIST',
        });
        expect(screen.getByText(/No one on trial/)).toBeInTheDocument();
    });

    it('keeps filter counts tied to the full affiliation set, not the current page', () => {
        renderTab({
            playerDirectory: makeDirectory([trialist]),
            playerStatusFilter: 'TRIALIST',
            playerCounts: { ALL: 86, TRIALIST: 2, ACTIVE: 84, PAST: 0, REMOVED: 0 },
        });
        expect(screen.getByRole('button', { name: /All players\s*86/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /On trial\s*2/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Active\s*84/ })).toBeInTheDocument();
    });

    it('does not render Promote/Release for active players', () => {
        renderTab({ playerDirectory: makeDirectory([active]) });
        expect(screen.queryByRole('button', { name: 'Promote' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Release' })).toBeNull();
    });

    it('keeps player status controls review-only for non-leadership roles', () => {
        renderTab({ canManagePlayerStatuses: false });
        expect(screen.queryByRole('button', { name: 'Promote' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Release' })).toBeNull();
        expect(screen.getAllByText('Review only').length).toBeGreaterThan(0);
        expect(screen.getByLabelText(`Trial ends ${trialist.fullName}`)).toBeDisabled();
    });

    it('lets an authorized coach review joining without leadership status permissions', () => {
        const onReviewJoining = vi.fn();
        const props = renderTab({ canManagePlayerStatuses: false, onReviewJoining });
        fireEvent.click(screen.getByRole('button', { name: 'Review joining' }));
        expect(onReviewJoining).toHaveBeenCalledWith(trialist.userId);
        expect(screen.queryByRole('button', { name: 'Release' })).toBeNull();
        expect(screen.getByLabelText(`Trial ends ${trialist.fullName}`)).toBeDisabled();
        expect(props.onPlayerStatusChange).not.toHaveBeenCalled();
    });
    it('takes a completed placement to its arrangement rather than altering the affiliation independently', () => {
        const onReviewJoining = vi.fn();
        const props = renderTab({ playerDirectory:makeDirectory([active]),joiningPlayerIds:[active.userId],onReviewJoining });
        fireEvent.click(screen.getByRole('button',{name:'Review placement'}));
        expect(onReviewJoining).toHaveBeenCalledWith(active.userId);
        expect(screen.queryByRole('button',{name:'Player actions'})).not.toBeInTheDocument();
        expect(props.onPlayerStatusChange).not.toHaveBeenCalled();
    });
    it('uses arrangement terms and dates for a linked request rather than old trialist controls', () => {
        const onReviewJoining = vi.fn();
        const props=renderTab({playerDirectory:makeDirectory([trialist]),joiningPlayerIds:[trialist.userId],onReviewJoining,onSendConsentEmail:vi.fn()});
        expect(screen.queryByRole('button',{name:'Release'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button',{name:'Send consent'})).not.toBeInTheDocument();
        expect(screen.getByLabelText(`Trial ends ${trialist.fullName}`)).toBeDisabled();
        fireEvent.click(screen.getByRole('button',{name:'View agreed terms'}));expect(onReviewJoining).toHaveBeenCalledWith(trialist.userId);
        expect(props.onPlayerStatusChange).not.toHaveBeenCalled();
    });

    it('phase A5: offers Send consent on a consent-flagged trialist and captures the parent email inline', () => {
        const onSendConsentEmail = vi.fn();
        renderTab({ playerDirectory: makeDirectory([trialist]), onSendConsentEmail });
        fireEvent.click(screen.getByRole('button', { name: 'Send consent' }));

        const input = screen.getByLabelText('Parent email Giorgi Trialist') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'parent@example.com' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));

        expect(onSendConsentEmail).toHaveBeenCalledWith(7, 'parent@example.com');
    });
});


describe('PlayersTab consent delivery states', () => {
    it('keeps the entered email after a failed send and clears it only after success', async () => {
        const send = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
        renderTab({ playerDirectory: makeDirectory([trialist]), onSendConsentEmail: send });
        fireEvent.click(screen.getByRole('button', { name: 'Send consent' }));
        fireEvent.change(screen.getByLabelText('Parent email Giorgi Trialist'), { target: { value: 'parent@example.com' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));
        await waitFor(() => expect(send).toHaveBeenCalledOnce());
        expect(screen.getByLabelText('Parent email Giorgi Trialist')).toHaveValue('parent@example.com');
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));
        await waitFor(() => expect(screen.queryByLabelText('Parent email Giorgi Trialist')).not.toBeInTheDocument());
        expect(send).toHaveBeenNthCalledWith(2, 7, 'parent@example.com');
    });

    it.each(['PENDING', 'DECLINED', 'EXPIRED'])('offers resend for %s', (status) => {
        const send = vi.fn();
        renderTab({ playerDirectory: makeDirectory([{ ...trialist, parentalConsentStatus: status, parentEmail: 'parent@example.com' }]), onSendConsentEmail: send });
        if (status === 'EXPIRED') expect(screen.getByText('Consent link expired')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Resend' }));
        expect(send).toHaveBeenCalledWith(7, 'parent@example.com');
    });
});
