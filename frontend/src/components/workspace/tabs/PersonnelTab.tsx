import { useCallback, useMemo, useState } from 'react';
import { UserMinus } from 'lucide-react';
import type { ClubManagedMember, ClubManagementOverview, ClubMembershipRole } from '../../../features/clubs/domain';
import { clubRoleLabel, isLegacyAgentMembershipRole } from '../../../features/clubs/domain';
import { DataTable, EmptyState, Pill, SectionHeader } from '../helpers';
import type { SortState } from '../helpers';
import { UserIdentityCell } from '../UserIdentityCell';
import { OverflowActions } from '../../ui/OverflowActions';

interface PersonnelTabProps {
    overview: ClubManagementOverview | null;
    currentUserId: number | null;
    currentRole: string | null;
    pendingKey: string | null;
    confirmingRemovalUserId: number | null;
    onRoleChange: (userId: number, role: ClubMembershipRole) => Promise<void>;
    onRemoveMember: (member: ClubManagedMember) => Promise<void>;
    onConfirmRemoval: (userId: number | null) => void;
}

export const PersonnelTab = ({
    overview, currentUserId, currentRole, pendingKey,
    onRoleChange, onRemoveMember
}: PersonnelTabProps) => {
    const canRemoveMember = (member: ClubManagedMember) => {
        if (!currentUserId || member.userId === currentUserId || member.role === 'OWNER') return false;
        if (currentRole === 'OWNER') return !isLegacyAgentMembershipRole(member.role);
        return currentRole === 'CLUB_ADMIN' && member.role !== 'CLUB_ADMIN';
    };

    const memberLockReason = (member: ClubManagedMember): string | null => {
        if (member.userId === currentUserId) return 'Your own role is locked. Use the membership exit action to step away.';
        if (member.role === 'OWNER') return 'Club ownership is protected. Transfer ownership first.';
        if (isLegacyAgentMembershipRole(member.role)) return 'Legacy agent — read-only.';
        if (currentRole === 'CLUB_ADMIN' && member.role === 'CLUB_ADMIN') return 'Club admins cannot modify other admins.';
        return member.roleEditable ? null : 'This role is locked by club authority rules.';
    };

    const [sort, setSort] = useState<SortState | null>(null);

    const handleSort = useCallback((col: number) => {
        setSort(prev =>
            prev?.column === col
                ? { column: col, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                : { column: col, direction: 'asc' }
        );
    }, []);

    const getPersonnelSortValue = (m: ClubManagedMember, col: number): string | number | null => {
        switch (col) {
            case 0: return (m.fullName || m.username || '').toLowerCase();
            case 1: return m.role;
            case 2: return null;
            default: return null;
        }
    };

    const sortedMembers = useMemo(() => {
        if (!sort || !overview) return overview?.members ?? [];
        const data = [...overview.members];
        data.sort((a, b) => {
            const aVal = getPersonnelSortValue(a, sort.column);
            const bVal = getPersonnelSortValue(b, sort.column);
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;
            const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return sort.direction === 'desc' ? -cmp : cmp;
        });
        return data;
    }, [overview?.members, sort]);

    return (
        <div className="space-y-4">
            <SectionHeader eyebrow="Personnel" title="Staff Members" description="Manage club staff roles. Player affiliations are managed in the Players tab." />
            {overview && sortedMembers.length === 0 ? (
                <EmptyState message="No staff members are attached to this club." />
            ) : overview && (
                <div className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] overflow-hidden">
                    <DataTable columns={['Member', 'Role', 'Status', '']} sort={sort} onSort={handleSort}>
                        {sortedMembers.map((member) => {
                            const isSelf = member.userId === currentUserId;
                            const lockReason = memberLockReason(member);
                            return (
                                <tr key={member.userId} className="group h-11 hover:bg-[var(--fc-surface-hover)] transition-colors">
                                    <td className="px-4">
                                        <UserIdentityCell avatarUrl={member.avatarUrl} fullName={member.fullName} username={member.username} />
                                    </td>
                                    <td className="px-4">
                                        {member.roleEditable ? (
                                            <select
                                                value={member.role}
                                                onChange={(e) => { const r = e.target.value as ClubMembershipRole; if (r !== member.role) void onRoleChange(member.userId, r); }}
                                                disabled={pendingKey === `role-${member.userId}`}
                                                className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-2.5 py-1.5 text-sm font-medium text-[var(--fc-text-primary)] outline-none focus:ring-1 focus:ring-[var(--fc-accent)] disabled:opacity-50"
                                            >
                                                {Array.from(new Set([member.role, ...(overview?.assignableStaffRoles || [])])).map((role) => (
                                                    <option key={role} value={role}>{clubRoleLabel(role)}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <Pill label={clubRoleLabel(member.role)} />
                                        )}
                                    </td>
                                    <td className="px-4">
                                        <div className="flex flex-wrap gap-1.5">
                                            {isSelf && <Pill label="You" tone="info" />}
                                            {lockReason && !isSelf && (
                                                <span className="text-xs text-[var(--fc-text-muted)] max-w-[200px] truncate" title={lockReason}>
                                                    Locked
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 w-12">
                                        {canRemoveMember(member) && (
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <OverflowActions
                                                    triggerIcon="vertical"
                                                    label="Staff actions"
                                                    items={[
                                                        { id: 'remove', label: 'Remove from Club', description: `Remove ${member.fullName || member.username} from the club staff`, icon: <UserMinus className="h-3.5 w-3.5" />, tone: 'danger', disabled: pendingKey === `remove-${member.userId}`, confirm: { title: 'Remove staff member?', body: `Remove "${member.fullName || member.username}" from the club staff? This cannot be undone.` }, onSelect: () => void onRemoveMember(member) },
                                                    ]}
                                                />
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </DataTable>
                </div>
            )}
        </div>
    );
};
