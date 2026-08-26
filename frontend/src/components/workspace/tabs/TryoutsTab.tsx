import { useCallback, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { DataTable, EmptyState, PageSpinner, SectionHeader } from '../helpers';
import type { SortState } from '../helpers';
import { UserIdentityCell } from '../UserIdentityCell';
import { StatusCell } from '../StatusCell';
import { OverflowActions } from '../../ui/OverflowActions';
import type { TryoutApplicantDto } from '../types';

interface TryoutsTabProps {
    tryoutApplicants: TryoutApplicantDto[];
    tryoutsLoading: boolean;
    pendingKey: string | null;
    /** Phase A2 — ACCEPTED opens the note modal in the parent; REJECTED stays direct. */
    onTryoutStatus: (applicationId: number, status: 'ACCEPTED' | 'REJECTED') => void;
}

export const TryoutsTab = ({ tryoutApplicants, tryoutsLoading, pendingKey, onTryoutStatus }: TryoutsTabProps) => {
    const [sort, setSort] = useState<SortState | null>(null);

    const handleSort = useCallback((col: number) => {
        setSort(prev =>
            prev?.column === col
                ? { column: col, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                : { column: col, direction: 'asc' }
        );
    }, []);

    const getTryoutSortValue = (app: TryoutApplicantDto, col: number): string | number | null => {
        switch (col) {
            case 0: return (app.name || '').toLowerCase();
            case 1: return app.position || '';
            case 2: return app.ageGroup || '';
            case 3: return app.status;
            default: return null;
        }
    };

    const sortedApplicants = useMemo(() => {
        if (!sort) return tryoutApplicants;
        const data = [...tryoutApplicants];
        data.sort((a, b) => {
            const aVal = getTryoutSortValue(a, sort.column);
            const bVal = getTryoutSortValue(b, sort.column);
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;
            const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return sort.direction === 'desc' ? -cmp : cmp;
        });
        return data;
    }, [tryoutApplicants, sort]);

    return (
        <div className="space-y-4">
            <SectionHeader eyebrow="Tryouts" title="Applicant Review" description="Review and respond to tryout applications." />
            {tryoutsLoading && sortedApplicants.length === 0 ? (
                <PageSpinner />
            ) : sortedApplicants.length === 0 ? (
                <EmptyState message="No tryout applications to review." />
            ) : (
                <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] overflow-hidden">
                    <DataTable columns={['Name', 'Position', 'Age Group', 'Status', '']} sort={sort} onSort={handleSort}>
                        {sortedApplicants.map((app) => (
                            <tr key={app.id} className="group h-11 hover:bg-[var(--fc-surface-hover)] transition-colors">
                                <td className="px-4">
                                    <UserIdentityCell avatarUrl={app.profilePictureUrl} fullName={app.name} size="sm" />
                                </td>
                                <td className="px-4 text-xs text-[var(--fc-text-secondary)]">{app.position || '—'}</td>
                                <td className="px-4 text-xs text-[var(--fc-text-secondary)]">{app.ageGroup || '—'}</td>
                                <td className="px-4"><StatusCell label={app.status} tone="info" /></td>
                                <td className="px-4 w-12">
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <OverflowActions
                                            triggerIcon="vertical"
                                            label="Tryout actions"
                                            items={[
                                                { id: 'accept', label: 'Accept', description: 'Approve tryout application', icon: <Check className="h-3.5 w-3.5" />, tone: 'positive', disabled: pendingKey === `tryout-${app.id}-ACCEPTED`, onSelect: () => onTryoutStatus(app.id, 'ACCEPTED') },
                                                { id: 'decline', label: 'Decline', description: 'Reject tryout application with a kind note (phase A6)', icon: <X className="h-3.5 w-3.5" />, tone: 'danger', divider: true, disabled: pendingKey === `tryout-${app.id}-REJECTED`, onSelect: () => onTryoutStatus(app.id, 'REJECTED') },
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
