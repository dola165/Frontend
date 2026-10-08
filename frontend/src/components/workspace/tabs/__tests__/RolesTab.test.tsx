import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RolesTab } from '../RolesTab';
import type { ClubManagedMember, ClubManagementOverview } from '../../../../features/clubs/domain';
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ refreshNavigationCapabilities: vi.fn().mockResolvedValue(undefined) }) }));

const member = (userId: number, fullName: string, eligible?: boolean): ClubManagedMember => ({
    userId, fullName, username: `member${userId}`, role: 'COACH', roleEditable: true,
    ownershipTransferEligible: eligible,
});
const props = (members: ClubManagedMember[], isOwner = true) => ({
    overview: {
        currentUserRole: isOwner ? 'OWNER' : 'COACH', assignableInviteRoles: [], assignableStaffRoles: [],
        activePlayerCount: 0, trialistCount: 0, overdueTrialistCount: 0, pendingTryoutCount: 0,
        members, pendingInvitations: [], pendingApplications: [],
    } as ClubManagementOverview,
    currentUserId: 1, currentRole: isOwner ? 'OWNER' : 'COACH', pendingKey: null,
    confirmingOwnershipTransferUserId: null, confirmingSelfLeave: false, isOwner,
    onConfirmOwnershipTransfer: vi.fn(), onTransferOwnership: vi.fn().mockResolvedValue(undefined),
    onConfirmSelfLeave: vi.fn(), onLeaveClub: vi.fn().mockResolvedValue(undefined),
});

describe('RolesTab ownership eligibility', () => {
    it('offers only server-approved staff and transfers the chosen candidate after confirmation', () => {
        const eligible = member(2, 'Eligible organizer', true);
        const input = props([
            eligible, member(3, 'Fan administrator', false), member(4, 'Player coach', false),
            member(5, 'Incomplete organizer', false), member(6, 'Restricted organizer', false),
            member(7, 'Older response without eligibility'), member(1, 'Current owner', true),
        ]);
        render(<RolesTab {...input} />);
        expect(screen.getByText('Eligible organizer')).toBeInTheDocument();
        for (const hidden of input.overview.members.slice(1)) expect(screen.queryByText(hidden.fullName!)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Transfer ownership' }));
        fireEvent.click(screen.getByRole('menuitem', { name: /Transfer Ownership/ }));
        expect(input.onTransferOwnership).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
        expect(input.onTransferOwnership).toHaveBeenCalledWith(eligible);
    });

    it('shows the empty state when no staff member is eligible', () => {
        render(<RolesTab {...props([member(2, 'Fan administrator', false), member(3, 'Unknown eligibility')])} />);
        expect(screen.getByText('No eligible members available for ownership transfer.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Transfer ownership' })).not.toBeInTheDocument();
    });

    it('removes a candidate when refreshed eligibility changes', () => {
        const input = props([member(2, 'Eligible organizer', true)]);
        const { rerender } = render(<RolesTab {...input} />);
        expect(screen.getByText('Eligible organizer')).toBeInTheDocument();
        rerender(<RolesTab {...props([member(2, 'Eligible organizer', false)])} />);
        expect(screen.queryByText('Eligible organizer')).not.toBeInTheDocument();
        expect(screen.getByText('No eligible members available for ownership transfer.')).toBeInTheDocument();
    });

    it('does not offer ownership transfer to a coach', () => {
        render(<RolesTab {...props([member(2, 'Eligible organizer', true)], false)} />);
        expect(screen.queryByRole('button', { name: 'Transfer ownership' })).not.toBeInTheDocument();
        expect(screen.queryByText('Eligible organizer')).not.toBeInTheDocument();
    });
});
