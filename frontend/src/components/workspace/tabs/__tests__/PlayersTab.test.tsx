import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
        totalPlayerPages: 1,
        onStatusFilterChange: vi.fn(),
        onPlayerStatusChange: vi.fn(),
        onPromotePlayer: vi.fn(),
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
    it('shows Promote and Release buttons for trialist rows', () => {
        renderTab();
        const promoteButtons = screen.getAllByRole('button', { name: 'Promote' });
        expect(promoteButtons.length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByRole('button', { name: 'Release' }).length).toBeGreaterThanOrEqual(1);
    });

    it('Promote opens the promote flow via onPromotePlayer', () => {
        const props = renderTab();
        fireEvent.click(screen.getAllByRole('button', { name: 'Promote' })[0]);
        expect(props.onPromotePlayer).toHaveBeenCalledWith(expect.objectContaining({ userId: trialist.userId }));
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

    it('does not render Promote/Release for active players', () => {
        renderTab({ playerDirectory: makeDirectory([active]) });
        expect(screen.queryByRole('button', { name: 'Promote' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Release' })).toBeNull();
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
