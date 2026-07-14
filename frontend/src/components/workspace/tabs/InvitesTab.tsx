import { useCallback, useMemo, useState } from 'react';
import { Ban, Loader2, Search, UserPlus } from 'lucide-react';
import { clubInviteStatusLabel, clubRoleLabel, type ClubMembershipRole, type ClubManagementOverview } from '../../../features/clubs/domain';
import type { PageResult } from '../../../features/clubs/domain';
import { DataTable, EmptyState, formatMetaTime, Pill, SectionHeader } from '../helpers';
import type { SortState } from '../helpers';
import { UserIdentityCell } from '../UserIdentityCell';
import { StatusCell } from '../StatusCell';
import { OverflowActions } from '../../ui/OverflowActions';
import type { UserSearchDto } from '../types';

interface InvitesTabProps {
    overview: ClubManagementOverview | null;
    searchQuery: string;
    searchPage: number;
    searchResults: PageResult<UserSearchDto> | null;
    searchLoading: boolean;
    selectedInviteRole: ClubMembershipRole;
    pendingKey: string | null;
    invitedUserIds: Set<number>;
    totalSearchPages: number;
    onSearchQueryChange: (query: string) => void;
    onSearchPageChange: (page: number) => void;
    onInviteRoleChange: (role: ClubMembershipRole) => void;
    onInvite: (userId: number) => Promise<void>;
    onCancelInvite: (inviteId: number) => Promise<void>;
}

export const InvitesTab = ({
    overview, searchQuery, searchResults, searchLoading,
    selectedInviteRole, pendingKey, invitedUserIds, totalSearchPages,
    onSearchQueryChange, onSearchPageChange, onInviteRoleChange, onInvite, onCancelInvite
}: InvitesTabProps) => {
    const [searchSort, setSearchSort] = useState<SortState | null>(null);
    const [inviteSort, setInviteSort] = useState<SortState | null>(null);

    const handleSearchSort = useCallback((col: number) => {
        setSearchSort(prev =>
            prev?.column === col
                ? { column: col, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                : { column: col, direction: 'asc' }
        );
    }, []);

    const handleInviteSort = useCallback((col: number) => {
        setInviteSort(prev =>
            prev?.column === col
                ? { column: col, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                : { column: col, direction: 'asc' }
        );
    }, []);

    const getSearchSortValue = (u: UserSearchDto, col: number): string | number | null => {
        switch (col) {
            case 0: return (u.fullName || u.username || '').toLowerCase();
            case 1: return u.position || u.userType || '';
            default: return null;
        }
    };

    const getInviteSortValue = (inv: any, col: number): string | number | null => {
        switch (col) {
            case 0: return (inv.fullName || inv.username || '').toLowerCase();
            case 1: return inv.role;
            case 2: return inv.status;
            case 3: return inv.createdAt ?? '';
            default: return null;
        }
    };

    const sortedSearchResults = useMemo(() => {
        if (!searchSort || !searchResults) return searchResults?.content ?? [];
        const data = [...searchResults.content];
        data.sort((a, b) => {
            const aVal = getSearchSortValue(a, searchSort.column);
            const bVal = getSearchSortValue(b, searchSort.column);
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;
            const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return searchSort.direction === 'desc' ? -cmp : cmp;
        });
        return data;
    }, [searchResults?.content, searchSort]);

    const sortedInvitations = useMemo(() => {
        if (!inviteSort || !overview) return overview?.pendingInvitations ?? [];
        const data = [...overview.pendingInvitations];
        data.sort((a, b) => {
            const aVal = getInviteSortValue(a, inviteSort.column);
            const bVal = getInviteSortValue(b, inviteSort.column);
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;
            const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return inviteSort.direction === 'desc' ? -cmp : cmp;
        });
        return data;
    }, [overview?.pendingInvitations, inviteSort]);

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <SectionHeader eyebrow="Invites" title="Invite Members" description="Search users and invite them to join with a specific club role." />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1 relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fc-text-muted)]" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => { onSearchQueryChange(e.target.value); onSearchPageChange(0); }}
                            placeholder="Search by name or username..."
                            className="w-full rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] py-2 pl-10 pr-4 text-sm text-[var(--fc-text-primary)] outline-none placeholder:text-[var(--fc-text-muted)] focus:ring-1 focus:ring-[var(--fc-accent)]"
                        />
                    </div>
                    <select
                        value={selectedInviteRole}
                        onChange={(e) => onInviteRoleChange(e.target.value as ClubMembershipRole)}
                        disabled={(overview?.assignableInviteRoles.length ?? 0) === 0}
                        className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-3 py-2 text-sm font-medium text-[var(--fc-text-primary)] outline-none focus:ring-1 focus:ring-[var(--fc-accent)] disabled:opacity-50"
                    >
                        {(overview?.assignableInviteRoles || []).map((role) => (
                            <option key={role} value={role}>{clubRoleLabel(role)}</option>
                        ))}
                    </select>
                </div>
                {searchQuery.trim().length < 2 ? (
                    <p className="text-xs text-[var(--fc-text-muted)]">Type at least two characters to search.</p>
                ) : searchLoading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-[var(--fc-text-muted)]" />
                    </div>
                ) : searchResults?.content.length ? (
                    <div className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] overflow-hidden">
                        <DataTable columns={['User', 'Details', 'Action']} sort={searchSort} onSort={handleSearchSort}>
                            {sortedSearchResults.map((user) => {
                                const alreadyInvited = invitedUserIds.has(user.id);
                                return (
                                    <tr key={user.id} className="h-11 hover:bg-[var(--fc-surface-hover)] transition-colors">
                                        <td className="px-4">
                                            <UserIdentityCell fullName={user.fullName} username={user.username} size="sm" />
                                        </td>
                                        <td className="px-4">
                                            <div className="flex flex-wrap gap-1">
                                                {user.position && <Pill label={user.position} />}
                                                {user.userType && <Pill label={user.userType} />}
                                            </div>
                                        </td>
                                        <td className="px-4">
                                            {alreadyInvited ? (
                                                <Pill label="Already Invited" tone="info" />
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => void onInvite(user.id)}
                                                    disabled={pendingKey === `invite-${user.id}` || (overview?.assignableInviteRoles.length ?? 0) === 0}
                                                    className="inline-flex items-center gap-1.5 rounded-md bg-[var(--fc-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                                                >
                                                    {pendingKey === `invite-${user.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                                                    Invite as {clubRoleLabel(selectedInviteRole)}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </DataTable>
                        {searchResults.totalElements > searchResults.pageSize && (
                            <div className="flex items-center justify-between border-t border-[var(--fc-border)] px-4 h-11">
                                <p className="text-xs text-[var(--fc-text-muted)]">Page {searchResults.pageNumber + 1} of {totalSearchPages}</p>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => onSearchPageChange(Math.max(0, searchResults.pageNumber - 1))} disabled={searchResults.pageNumber === 0} className="rounded-md border border-[var(--fc-border)] px-2.5 py-1 text-xs font-medium text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)] disabled:opacity-40">Prev</button>
                                    <button type="button" onClick={() => onSearchPageChange(searchResults.pageNumber + 1)} disabled={searchResults.pageNumber + 1 >= totalSearchPages} className="rounded-md border border-[var(--fc-border)] px-2.5 py-1 text-xs font-medium text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)] disabled:opacity-40">Next</button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <EmptyState message="No users matched this search." />
                )}
            </div>

            <div className="space-y-4">
                <SectionHeader eyebrow="Pending" title="Sent Invitations" />
                {overview && sortedInvitations.length === 0 ? (
                    <EmptyState message="No pending invitations." />
                ) : overview && (
                    <div className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] overflow-hidden">
                        <DataTable columns={['User', 'Role', 'Status', 'Sent', '']} sort={inviteSort} onSort={handleInviteSort}>
                            {sortedInvitations.map((invite) => (
                                <tr key={invite.id} className="group h-11 hover:bg-[var(--fc-surface-hover)] transition-colors">
                                    <td className="px-4">
                                        <UserIdentityCell avatarUrl={invite.avatarUrl} fullName={invite.fullName} username={invite.username} />
                                    </td>
                                    <td className="px-4"><Pill label={clubRoleLabel(invite.role)} /></td>
                                    <td className="px-4"><StatusCell label={clubInviteStatusLabel(invite.status)} tone="info" /></td>
                                    <td className="px-4">
                                        <div className="text-xs text-[var(--fc-text-secondary)]">
                                            {formatMetaTime(invite.createdAt) && <p>Sent: {formatMetaTime(invite.createdAt)}</p>}
                                            {formatMetaTime(invite.expiresAt) && <p>Expires: {formatMetaTime(invite.expiresAt)}</p>}
                                        </div>
                                    </td>
                                    <td className="px-4 w-12">
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <OverflowActions
                                                triggerIcon="vertical"
                                                label="Invitation actions"
                                                items={[
                                                    { id: 'cancel', label: 'Cancel Invitation', description: 'Revoke this invitation', icon: <Ban className="h-3.5 w-3.5" />, tone: 'danger', disabled: pendingKey === `cancel-${invite.id}`, confirm: { title: 'Cancel invitation?', body: `Cancel the invitation for ${invite.fullName || invite.username}?` }, onSelect: () => void onCancelInvite(invite.id) },
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
        </div>
    );
};
