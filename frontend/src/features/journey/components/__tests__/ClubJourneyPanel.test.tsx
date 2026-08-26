import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../../../../i18n';
import { ClubJourneyPanel } from '../ClubJourneyPanel';

vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
}));

vi.mock('../../../clubs/api', () => ({
    fetchClubJourney: vi.fn(),
    acceptClubInvitation: vi.fn().mockResolvedValue({ status: 'ACCEPTED' }),
    declineClubInvitation: vi.fn().mockResolvedValue({ status: 'DECLINED' }),
    cancelClubApplication: vi.fn().mockResolvedValue({ status: 'CANCELLED' }),
}));

vi.mock('../../../../utils/apiError', () => ({
    extractApiErrorMessage: vi.fn(() => 'Something went wrong.'),
}));

import {
    acceptClubInvitation,
    cancelClubApplication,
    fetchClubJourney,
} from '../../../clubs/api';

const journeyPayload = {
    applications: [
        { applicationId: 601, clubId: 2, clubName: 'Metro United Academy', role: 'PLAYER', status: 'PENDING', createdAt: null, decisionMessage: null },
        { applicationId: 602, clubId: 3, clubName: 'Lakeside Athletic', role: 'PLAYER', status: 'DECLINED', createdAt: null, decisionMessage: 'This intake is full — try again at our next tryouts. Keep training!' },
    ],
    invitations: [
        { inviteId: 701, clubId: 4, clubName: 'Creekside FC', role: 'PLAYER', createdAt: null, expiresAt: null },
    ],
    tryouts: [
        { tryoutApplicationId: 801, tryoutId: 11, clubId: 2, clubName: 'Metro United Academy', title: 'U15 Open Tryout', tryoutDate: null, status: 'ACCEPTED', decisionMessage: 'Bring boots.' },
    ],
    affiliations: [
        { clubId: 2, clubName: 'Metro United Academy', status: 'TRIALIST', squadName: 'U15', trialEndsOn: '2026-09-01', consentStatus: 'PENDING', joinedAt: null, endedAt: null },
    ],
    recentDecisions: [
        { kind: 'APPLICATION' as const, clubName: 'Lakeside Athletic', status: 'DECLINED', decidedAt: null, message: 'This intake is full.' },
    ],
};

describe('ClubJourneyPanel — phase A4', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchClubJourney).mockResolvedValue(journeyPayload);
    });

    it('renders the status pills with counts', async () => {
        render(<ClubJourneyPanel />);
        await waitFor(() => expect(screen.getByText(/On trial · 1/)).toBeInTheDocument());
        expect(screen.getByText(/Applied · 1/)).toBeInTheDocument();
        expect(screen.getByText(/Invited · 1/)).toBeInTheDocument();
        expect(screen.getByText(/Member · 0/)).toBeInTheDocument();
        expect(screen.getByText(/Not accepted · 1/)).toBeInTheDocument();
    });

    it('renders affiliations, applications, tryouts and decisions', async () => {
        render(<ClubJourneyPanel />);
        await waitFor(() => expect(screen.getAllByText(/Metro United Academy/).length).toBeGreaterThanOrEqual(1));
        expect(screen.getByText('This intake is full — try again at our next tryouts. Keep training!')).toBeInTheDocument();
        expect(screen.getByText(/U15 Open Tryout/)).toBeInTheDocument();
        expect(screen.getByText(/Lakeside Athletic · DECLINED/)).toBeInTheDocument();
    });

    it('cancels a pending application and refreshes', async () => {
        render(<ClubJourneyPanel />);
        await waitFor(() => expect(screen.getByText(/Applied · 1/)).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        await waitFor(() => expect(cancelClubApplication).toHaveBeenCalledWith(2, 601));
        expect(fetchClubJourney).toHaveBeenCalledTimes(2); // initial + refresh
    });

    it('accepts an invitation and refreshes', async () => {
        render(<ClubJourneyPanel />);
        await waitFor(() => expect(screen.getByText(/Creekside FC/)).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
        await waitFor(() => expect(acceptClubInvitation).toHaveBeenCalledWith(701));
        expect(fetchClubJourney).toHaveBeenCalledTimes(2);
    });

    it('shows the empty state when there is no activity', async () => {
        vi.mocked(fetchClubJourney).mockResolvedValue({
            applications: [], invitations: [], tryouts: [], affiliations: [], recentDecisions: [],
        });
        render(<ClubJourneyPanel />);
        await waitFor(() => expect(screen.getByText(/No club activity yet/)).toBeInTheDocument());
    });
});
