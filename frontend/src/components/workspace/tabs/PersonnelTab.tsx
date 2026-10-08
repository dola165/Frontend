import { useCallback, useMemo, useState } from 'react';
import { ExternalLink, Loader2, Pencil, UserMinus, X } from 'lucide-react';
import type { ClubManagedMember, ClubManagementOverview, ClubMembershipRole } from '../../../features/clubs/domain';
import { clubRoleLabel, isLegacyAgentMembershipRole } from '../../../features/clubs/domain';
import { updateClubStaffProfile } from '../../../features/clubs/api';
import { DataTable, EmptyState, Pill, SectionHeader } from '../helpers';
import type { SortState } from '../helpers';
import { UserIdentityCell } from '../UserIdentityCell';
import { OverflowActions } from '../../ui/OverflowActions';

interface PersonnelTabProps {
    clubId: number;
    onProfileSaved?: () => Promise<void>;
    overview: ClubManagementOverview | null;
    currentUserId: number | null;
    currentRole: string | null;
    canManageLeadership: boolean;
    pendingKey: string | null;
    confirmingRemovalUserId: number | null;
    onRoleChange: (userId: number, role: ClubMembershipRole) => Promise<void>;
    onRemoveMember: (member: ClubManagedMember) => Promise<void>;
    onConfirmRemoval: (userId: number | null) => void;
}

export const PersonnelTab = ({
    clubId, overview, currentUserId, currentRole, canManageLeadership, pendingKey,
    onRoleChange, onRemoveMember, onProfileSaved
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
    const [editingProfile, setEditingProfile] = useState<ClubManagedMember | null>(null);
    const [profileTitle, setProfileTitle] = useState('');
    const [profileBio, setProfileBio] = useState('');
    const [profileQualifications, setProfileQualifications] = useState('');
    const [profilePublic, setProfilePublic] = useState(true);
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);

    const beginProfileEdit = (member: ClubManagedMember) => {
        setEditingProfile(member);
        setProfileTitle(member.publicTitle || clubRoleLabel(member.role));
        setProfileBio(member.clubBio || '');
        setProfileQualifications(member.qualifications || '');
        setProfilePublic(member.isPublic !== false);
        setProfileError(null);
    };

    const saveProfile = async () => {
        if (!editingProfile) return;
        setProfileSaving(true);
        setProfileError(null);
        try {
            await updateClubStaffProfile(clubId, editingProfile.userId, {
                publicTitle: profileTitle.trim() || null,
                clubBio: profileBio.trim() || null,
                qualifications: profileQualifications.trim() || null,
                isPublic: profilePublic,
            });
            await onProfileSaved?.();
            setEditingProfile(null);
        } catch (error) {
            setProfileError(error instanceof Error ? error.message : 'Could not save the public profile.');
        } finally {
            setProfileSaving(false);
        }
    };

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
            <SectionHeader eyebrow="Personnel" title="Management access" description="Administrative membership and public profile details for this person." />
            {overview && sortedMembers.length === 0 ? (
                <EmptyState message="No staff members are attached to this club." />
            ) : overview && (
                <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] overflow-hidden">
                    <DataTable columns={['Member', 'Management access', 'Status', '']} sort={sort} onSort={handleSort}>
                        {sortedMembers.map((member) => {
                            const isSelf = member.userId === currentUserId;
                            const lockReason = memberLockReason(member);
                            return (
                                <tr key={member.userId} className="group h-11 hover:bg-[var(--fc-surface-hover)] transition-colors">
                                    <td className="px-4">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <UserIdentityCell avatarUrl={member.avatarUrl} fullName={member.fullName} username={member.username} />
                                            {canManageLeadership && !isLegacyAgentMembershipRole(member.role) && (
                                                <button type="button" onClick={() => beginProfileEdit(member)} className="rounded-lg p-1.5 text-[var(--fc-text-muted)] hover:text-[var(--fc-accent)]" title="Edit public staff profile" aria-label={`Edit public profile for ${member.fullName || member.username}`}>
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4">
                                        {member.roleEditable ? (
                                            <select
                                                value={member.role}
                                                onChange={(e) => { const r = e.target.value as ClubMembershipRole; if (r !== member.role) void onRoleChange(member.userId, r); }}
                                                disabled={pendingKey === `role-${member.userId}`}
                                                className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-2.5 py-1.5 text-sm font-medium text-[var(--fc-text-primary)] outline-none focus:ring-1 focus:ring-[var(--fc-accent)] disabled:opacity-50"
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
                                            <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
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
            {editingProfile && (
                <div className="rounded-xl border border-[var(--fc-accent-border)] bg-[var(--fc-card-bg)] p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-[var(--fc-text-primary)]">Public People profile</p>
                            <p className="mt-1 text-xs text-[var(--fc-text-secondary)]">Publish how {editingProfile.fullName || editingProfile.username} appears on the club’s public People tab.</p>
                        </div>
                        <button type="button" onClick={() => setEditingProfile(null)} className="p-1 text-[var(--fc-text-muted)] hover:text-[var(--fc-text-primary)]" aria-label="Close profile editor"><X className="h-4 w-4" /></button>
                    </div>
                    {profileError && <p className="mt-3 text-xs font-semibold text-[var(--fc-state-danger)]">{profileError}</p>}
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1 text-xs font-semibold text-[var(--fc-text-secondary)]">Public title<input value={profileTitle} onChange={(e) => setProfileTitle(e.target.value)} maxLength={100} className="rounded-lg border border-[var(--fc-border)] bg-[var(--fc-page-bg)] px-3 py-2 text-sm text-[var(--fc-text-primary)] outline-none" /></label>
                        <label className="grid gap-1 text-xs font-semibold text-[var(--fc-text-secondary)]">Qualifications<input value={profileQualifications} onChange={(e) => setProfileQualifications(e.target.value)} maxLength={2000} className="rounded-lg border border-[var(--fc-border)] bg-[var(--fc-page-bg)] px-3 py-2 text-sm text-[var(--fc-text-primary)] outline-none" /></label>
                        <label className="grid gap-1 text-xs font-semibold text-[var(--fc-text-secondary)] sm:col-span-2">Club biography<textarea value={profileBio} onChange={(e) => setProfileBio(e.target.value)} maxLength={5000} rows={4} className="rounded-lg border border-[var(--fc-border)] bg-[var(--fc-page-bg)] px-3 py-2 text-sm text-[var(--fc-text-primary)] outline-none" /></label>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-xs font-semibold text-[var(--fc-text-secondary)]"><input type="checkbox" checked={profilePublic} onChange={(e) => setProfilePublic(e.target.checked)} className="accent-[var(--color-accent)]" /> Visible on public People tab</label>
                        <div className="flex gap-2">
                            <a href={`/clubs/${clubId}?tab=people`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--fc-border)] px-3 py-2 text-xs font-semibold text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)]"><ExternalLink className="h-3.5 w-3.5" /> Preview</a>
                            <button type="button" onClick={() => void saveProfile()} disabled={profileSaving} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--fc-accent)] px-3 py-2 text-xs font-semibold text-[color:var(--color-on-accent)] disabled:opacity-50">{profileSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save profile</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
