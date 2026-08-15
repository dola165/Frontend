import { Briefcase, Crown, LogOut } from 'lucide-react';
import type { ClubManagedMember, ClubManagementOverview } from '../../../features/clubs/domain';
import { clubRoleLabel } from '../../../features/clubs/domain';
import { DataTable, EmptyState, Pill, SectionHeader } from '../helpers';
import { UserIdentityCell } from '../UserIdentityCell';
import { OverflowActions } from '../../ui/OverflowActions';

interface RolesTabProps {
    overview: ClubManagementOverview;
    currentUserId: number | null;
    currentRole: string | null;
    pendingKey: string | null;
    confirmingOwnershipTransferUserId: number | null;
    confirmingSelfLeave: boolean;
    isOwner: boolean;
    transferCandidates: ClubManagedMember[];
    onConfirmOwnershipTransfer: (userId: number | null) => void;
    onTransferOwnership: (member: ClubManagedMember) => Promise<void>;
    onConfirmSelfLeave: (v: boolean) => void;
    onLeaveClub: () => Promise<void>;
    onOpenJobs?: () => void;
}

export const RolesTab = ({
    overview, pendingKey,
    confirmingSelfLeave, isOwner,
    transferCandidates, onTransferOwnership,
    onConfirmSelfLeave, onLeaveClub, onOpenJobs
}: RolesTabProps) => (
    <div className="space-y-4">
        <SectionHeader
            eyebrow="Roles"
            title="Authority & Ownership"
            description="View your clearance, manage role assignments, transfer ownership, or leave the club."
            action={
                onOpenJobs ? (
                    <button
                        type="button"
                        onClick={onOpenJobs}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#16a34a]/30 bg-[#16a34a]/10 px-3 py-2 text-xs font-semibold text-[#16a34a] hover:bg-[#16a34a]/20"
                    >
                        <Briefcase className="h-3.5 w-3.5" /> Looking for a coach?
                    </button>
                ) : undefined
            }
        />
        <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-4 py-3">
                <p className="text-xs font-medium text-[var(--fc-text-muted)]">Your Clearance</p>
                <p className="mt-1 text-lg font-semibold text-[var(--fc-text-primary)]">{clubRoleLabel(overview.currentUserRole)}</p>
            </div>
            <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-4 py-3">
                <p className="text-xs font-medium text-[var(--fc-text-muted)]">Assignable Roles</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                    {overview.assignableStaffRoles.length === 0 ? (
                        <span className="text-xs text-[var(--fc-text-muted)]">None</span>
                    ) : (
                        overview.assignableStaffRoles.map((role) => (
                            <Pill key={role} label={clubRoleLabel(role)} tone="success" />
                        ))
                    )}
                </div>
            </div>
            <div className="rounded-xl border border-[var(--fc-state-warning-soft)] bg-[var(--fc-state-warning-soft)] px-4 py-3">
                <p className="text-xs font-medium text-[var(--fc-state-warning)]">Membership Exit</p>
                <p className="mt-1 text-xs text-[var(--fc-text-secondary)]">
                    {isOwner ? 'Transfer ownership before you can leave.' : 'Leave this club when ready.'}
                </p>
            </div>
        </div>

        {isOwner && (
            <div className="space-y-4">
                <SectionHeader eyebrow="Ownership" title="Transfer Ownership" description="Hand over club ownership to an eligible member." />
                {transferCandidates.length === 0 ? (
                    <EmptyState message="No eligible members available for ownership transfer." />
                ) : (
                    <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] overflow-hidden">
                        <DataTable columns={['Member', 'Current Role', '']}>
                            {transferCandidates.map((member) => (
                                <tr key={member.userId} className="group h-11 hover:bg-[var(--fc-surface-hover)] transition-colors">
                                    <td className="px-4">
                                        <UserIdentityCell avatarUrl={member.avatarUrl} fullName={member.fullName} username={member.username} />
                                    </td>
                                    <td className="px-4"><Pill label={clubRoleLabel(member.role)} /></td>
                                    <td className="px-4 w-12">
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <OverflowActions
                                                triggerIcon="vertical"
                                                label="Transfer ownership"
                                                items={[
                                                    { id: 'transfer', label: 'Transfer Ownership', description: `Hand over club ownership to ${member.fullName || member.username}`, icon: <Crown className="h-3.5 w-3.5" />, tone: 'warning', disabled: pendingKey === `transfer-${member.userId}`, confirm: { title: 'Transfer Ownership?', body: 'This will transfer ownership. You will lose owner privileges and be redirected.' }, onSelect: () => void onTransferOwnership(member) },
                                                ]}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </DataTable>
                    </div>
                )}
            </div>
        )}

        <div className="rounded-xl border border-[var(--fc-state-danger-soft)] bg-[var(--fc-state-danger-soft)] px-4 py-3">
            <div className="flex items-start gap-3">
                <LogOut className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fc-state-danger)]" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--fc-text-primary)]">Leave This Club</p>
                    <p className="mt-1 text-xs text-[var(--fc-text-secondary)]">
                        {isOwner ? 'Transfer ownership before leaving. The owner cannot leave directly.' : 'This removes your membership and closes your access to club management.'}
                    </p>
                    {!isOwner && (
                        <div className="mt-3">
                            {confirmingSelfLeave ? (
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => onConfirmSelfLeave(false)} disabled={pendingKey === 'leave-club'} className="rounded-xl border border-[var(--fc-border)] px-3 py-1.5 text-xs font-medium text-[var(--fc-text-secondary)] disabled:opacity-50">Cancel</button>
                                    <button type="button" onClick={() => void onLeaveClub()} disabled={pendingKey === 'leave-club'} className="rounded-xl bg-[var(--fc-state-danger)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">{pendingKey === 'leave-club' ? 'Leaving...' : 'Confirm Leave'}</button>
                                </div>
                            ) : (
                                <button type="button" onClick={() => onConfirmSelfLeave(true)} className="rounded-xl border border-[var(--fc-state-danger)] px-3 py-1.5 text-xs font-semibold text-[var(--fc-state-danger)] hover:bg-[var(--fc-state-danger)] hover:text-white transition-colors">Leave Club</button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
);
