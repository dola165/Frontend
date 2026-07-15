import { useCallback, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { ClubManagementOverview } from '../../../features/clubs/domain';
import { clubRoleLabel } from '../../../features/clubs/domain';
import { DataTable, EmptyState, formatMetaTime, Pill, SectionHeader } from '../helpers';
import type { SortState } from '../helpers';
import { UserIdentityCell } from '../UserIdentityCell';
import { OverflowActions } from '../../ui/OverflowActions';

interface ApplicationsTabProps {
    overview: ClubManagementOverview | null;
    pendingKey: string | null;
    onAcceptApplication: (applicationId: number) => Promise<void>;
    onDeclineApplication: (applicationId: number) => Promise<void>;
}

export const ApplicationsTab = ({ overview, pendingKey, onAcceptApplication, onDeclineApplication }: ApplicationsTabProps) => {
    const [sort, setSort] = useState<SortState | null>(null);

    const handleSort = useCallback((col: number) => {
        setSort(prev =>
            prev?.column === col
                ? { column: col, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                : { column: col, direction: 'asc' }
        );
    }, []);

    const getAppSortValue = (app: any, col: number): string | number | null => {
        switch (col) {
            case 0: return (app.fullName || app.username || '').toLowerCase();
            case 1: return app.role;
            case 2: return app.message || '';
            case 3: return app.createdAt ?? '';
            default: return null;
        }
    };

    const sortedApplications = useMemo(() => {
        if (!sort || !overview) return overview?.pendingApplications ?? [];
        const data = [...overview.pendingApplications];
        data.sort((a, b) => {
            const aVal = getAppSortValue(a, sort.column);
            const bVal = getAppSortValue(b, sort.column);
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;
            const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return sort.direction === 'desc' ? -cmp : cmp;
        });
        return data;
    }, [overview?.pendingApplications, sort]);

    return (
        <div className="space-y-4">
            <SectionHeader eyebrow="Applications" title="Membership Requests" description="Review and act on pending club membership applications." />
            {overview && sortedApplications.length === 0 ? (
                <EmptyState message="No pending applications to review." />
            ) : overview && (
                <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] overflow-hidden">
                    <DataTable columns={['Applicant', 'Role', 'Message', 'Submitted', '']} sort={sort} onSort={handleSort}>
                        {sortedApplications.map((app) => (
                            <tr key={app.id} className="group h-11 hover:bg-[var(--fc-surface-hover)] transition-colors">
                                <td className="px-4">
                                    <UserIdentityCell avatarUrl={app.avatarUrl} fullName={app.fullName} username={app.username} />
                                </td>
                                <td className="px-4"><Pill label={clubRoleLabel(app.role)} /></td>
                                <td className="px-4">
                                    <p className="text-xs text-[var(--fc-text-secondary)] max-w-[200px] truncate">{app.message || '—'}</p>
                                </td>
                                <td className="px-4 text-xs text-[var(--fc-text-secondary)]">{formatMetaTime(app.createdAt) || 'Recently'}</td>
                                <td className="px-4 w-12">
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <OverflowActions
                                            triggerIcon="vertical"
                                            label="Application actions"
                                            items={[
                                                { id: 'accept', label: 'Accept', description: 'Approve membership request', icon: <Check className="h-3.5 w-3.5" />, tone: 'positive', disabled: pendingKey === `accept-${app.id}` || pendingKey === `decline-${app.id}`, onSelect: () => void onAcceptApplication(app.id) },
                                                { id: 'decline', label: 'Decline', description: 'Reject this application', icon: <X className="h-3.5 w-3.5" />, tone: 'danger', divider: true, disabled: pendingKey === `accept-${app.id}` || pendingKey === `decline-${app.id}`, confirm: { title: 'Decline application?', body: `Decline the application from ${app.fullName || app.username}?` }, onSelect: () => void onDeclineApplication(app.id) },
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
    );
};
