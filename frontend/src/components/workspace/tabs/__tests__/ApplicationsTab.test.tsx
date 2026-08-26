import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../../../../i18n';
import { ApplicationsTab, type ApplicationFilters } from '../ApplicationsTab';
import type { ClubMembershipApplication } from '../../../../features/clubs/domain';

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

const baseFilters: ApplicationFilters = { position: '', ageGroup: '', status: 'PENDING' };

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
    render(<ApplicationsTab {...props} />);
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

    it('bulk accept: selection → note modal → onBulkDecide with ids, action and message; selection clears on success', async () => {
        const props = renderTab();
        fireEvent.click(screen.getByLabelText('Select Luka Trialist'));
        fireEvent.click(screen.getByLabelText('Select Nika Goalkeeper'));
        fireEvent.click(screen.getByRole('button', { name: 'Accept (2)' }));

        const textarea = screen.getByLabelText(/Note to the player/) as HTMLTextAreaElement;
        fireEvent.change(textarea, { target: { value: 'Thursday 18:00, pitch 2.' } });
        fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

        await waitFor(() => expect(props.onBulkDecide).toHaveBeenCalledWith(
            [501, 502], 'ACCEPT', 'Thursday 18:00, pitch 2.'
        ));
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Accept (2)' })).toBeNull());
    });

    it('bulk decline: opens the note modal with the Decline label', async () => {
        renderTab();
        fireEvent.click(screen.getByLabelText('Select Luka Trialist'));
        fireEvent.click(screen.getByRole('button', { name: 'Decline (1)' }));
        expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
        expect(screen.getByText('Decline applications')).toBeInTheDocument();
    });

    it('keeps the selection when the bulk request fails', async () => {
        const props = renderTab({ onBulkDecide: vi.fn().mockResolvedValue(false) });
        fireEvent.click(screen.getByLabelText('Select Luka Trialist'));
        fireEvent.click(screen.getByRole('button', { name: 'Accept (1)' }));
        fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
        await waitFor(() => expect(props.onBulkDecide).toHaveBeenCalled());
        await waitFor(() => expect(screen.getByRole('button', { name: 'Accept (1)' })).toBeInTheDocument());
    });
});
