import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ShieldAlert, X } from 'lucide-react';
import type { ClubMembershipApplication } from '../../../features/clubs/domain';
import { clubRoleLabel } from '../../../features/clubs/domain';
import { DataTable, EmptyState, ErrorBlock, formatMetaTime, PageSpinner, Pill, SectionHeader } from '../helpers';
import type { SortState } from '../helpers';
import { UserIdentityCell } from '../UserIdentityCell';
import { OverflowActions } from '../../ui/OverflowActions';
import { DecisionNoteModal } from './DecisionNoteModal';

const POSITION_OPTIONS = [
    'GOALKEEPER', 'CENTER_BACK', 'FULLBACK', 'LEFT_BACK', 'RIGHT_BACK',
    'DEFENSIVE_MIDFIELDER', 'CENTRAL_MIDFIELDER', 'ATTACKING_MIDFIELDER',
    'WINGER', 'LEFT_WINGER', 'RIGHT_WINGER', 'STRIKER', 'FORWARD',
] as const;

const AGE_GROUP_OPTIONS = ['U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'U21', 'SENIOR'] as const;

const STATUS_OPTIONS = ['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED'] as const;

export interface ApplicationFilters {
    position: string;
    ageGroup: string;
    status: string;
}

interface ApplicationsTabProps {
    applications: ClubMembershipApplication[];
    applicationsLoading: boolean;
    applicationsError: string | null;
    filters: ApplicationFilters;
    bulkPending: boolean;
    onFiltersChange: (filters: ApplicationFilters) => void;
    onAcceptApplication: (applicationId: number) => void;
    onDeclineApplication: (applicationId: number) => void;
    /** Returns true when the request completed (selection is cleared only then). */
    onBulkDecide: (applicationIds: number[], action: 'ACCEPT' | 'DECLINE', message: string | null) => Promise<boolean>;
    onRetry: () => void;
}

export const ApplicationsTab = ({
    applications, applicationsLoading, applicationsError, filters, bulkPending,
    onFiltersChange, onAcceptApplication, onDeclineApplication, onBulkDecide, onRetry,
}: ApplicationsTabProps) => {
    const { t } = useTranslation();
    const [sort, setSort] = useState<SortState | null>(null);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [bulkAction, setBulkAction] = useState<'ACCEPT' | 'DECLINE' | null>(null);

    const pendingIds = useMemo(
        () => applications.filter((a) => a.status === 'PENDING').map((a) => a.id),
        [applications]
    );

    const handleSort = useCallback((col: number) => {
        setSort(prev =>
            prev?.column === col
                ? { column: col, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                : { column: col, direction: 'asc' }
        );
    }, []);

    const getAppSortValue = (app: ClubMembershipApplication, col: number): string | number | null => {
        switch (col) {
            case 0: return (app.fullName || app.username || '').toLowerCase();
            case 1: return app.role;
            case 2: return app.message || '';
            case 3: return app.createdAt ?? '';
            default: return null;
        }
    };

    const sortedApplications = useMemo(() => {
        if (!sort) return applications;
        const data = [...applications];
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
    }, [applications, sort]);

    const toggleSelect = (id: number) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleBulkConfirm = async (message: string | null) => {
        if (!bulkAction) return;
        const action = bulkAction;
        const ok = await onBulkDecide(Array.from(selected), action, message);
        if (ok) {
            setSelected(new Set());
            setBulkAction(null);
        }
    };

    const summaryChips = (app: ClubMembershipApplication) => {
        const chips: string[] = [];
        if (app.age != null) chips.push(t('applications.summaryAge', { age: app.age }));
        if (app.preferredFoot) chips.push(app.preferredFoot);
        if (app.heightCm != null) chips.push(t('applications.summaryHeight', { height: app.heightCm }));
        if (app.currentClubName) chips.push(app.currentClubName);
        if (app.careerHistoryCount != null && app.careerHistoryCount > 0) {
            chips.push(t('applications.summaryHistory', { count: app.careerHistoryCount }));
        }
        return chips;
    };

    return (
        <div className="space-y-4">
            <SectionHeader eyebrow="Applications" title="Membership Requests" description="Review and act on membership applications — filter, see each applicant at a glance, and decide in bulk." />

            {/* Phase A3 filter bar */}
            <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--fc-text-secondary)]">
                    {t('applications.filterPosition')}
                    <select
                        value={filters.position}
                        onChange={(e) => onFiltersChange({ ...filters, position: e.target.value })}
                        className="rounded-lg border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-2 py-1.5 text-xs text-[var(--fc-text-primary)] outline-none focus:ring-1 focus:ring-[var(--fc-accent)]"
                    >
                        <option value="">{t('applications.allPositions')}</option>
                        {POSITION_OPTIONS.map((p) => <option key={p} value={p}>{p.replaceAll('_', ' ')}</option>)}
                    </select>
                </label>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--fc-text-secondary)]">
                    {t('applications.filterAgeGroup')}
                    <select
                        value={filters.ageGroup}
                        onChange={(e) => onFiltersChange({ ...filters, ageGroup: e.target.value })}
                        className="rounded-lg border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-2 py-1.5 text-xs text-[var(--fc-text-primary)] outline-none focus:ring-1 focus:ring-[var(--fc-accent)]"
                    >
                        <option value="">{t('applications.allAgeGroups')}</option>
                        {AGE_GROUP_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                </label>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--fc-text-secondary)]">
                    {t('applications.filterStatus')}
                    <select
                        value={filters.status}
                        onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
                        className="rounded-lg border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-2 py-1.5 text-xs text-[var(--fc-text-primary)] outline-none focus:ring-1 focus:ring-[var(--fc-accent)]"
                    >
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </label>
                {pendingIds.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setSelected(prev => prev.size === pendingIds.length ? new Set() : new Set(pendingIds))}
                        className="ml-auto text-[11px] font-semibold text-[var(--fc-accent)] hover:underline"
                    >
                        {selected.size === pendingIds.length
                            ? t('applications.clearSelection')
                            : t('applications.selectAllPending', { count: pendingIds.length })}
                    </button>
                )}
            </div>

            {/* Phase A3 bulk bar */}
            {selected.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--fc-accent-border)] bg-[var(--fc-accent-soft)] px-4 py-2.5">
                    <p className="text-xs font-semibold text-[var(--fc-text-primary)]">
                        {t('applications.selected', { count: selected.size })}
                    </p>
                    <div className="ml-auto flex items-center gap-2">
                        <button
                            type="button"
                            disabled={bulkPending}
                            onClick={() => setBulkAction('ACCEPT')}
                            className="inline-flex items-center gap-1 rounded-xl bg-[#16a34a] px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                        >
                            <Check className="h-3 w-3" />
                            {t('applications.acceptSelected', { count: selected.size })}
                        </button>
                        <button
                            type="button"
                            disabled={bulkPending}
                            onClick={() => setBulkAction('DECLINE')}
                            className="inline-flex items-center gap-1 rounded-xl border border-[var(--fc-state-danger)] px-2.5 py-1 text-xs font-semibold text-[var(--fc-state-danger)] hover:bg-[var(--fc-state-danger-soft)] disabled:opacity-50"
                        >
                            <X className="h-3 w-3" />
                            {t('applications.declineSelected', { count: selected.size })}
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelected(new Set())}
                            className="text-xs font-medium text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)]"
                        >
                            {t('applications.clearSelection')}
                        </button>
                    </div>
                </div>
            )}

            {applicationsLoading && applications.length === 0 ? (
                <PageSpinner />
            ) : applicationsError && applications.length === 0 ? (
                <ErrorBlock message={applicationsError} onRetry={onRetry} />
            ) : applications.length === 0 ? (
                <EmptyState message="No applications match the current filters." />
            ) : (
                <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] overflow-hidden">
                    <DataTable columns={['', 'Applicant', 'Role', 'Message', 'Submitted', '']} sort={sort} onSort={handleSort}>
                        {sortedApplications.map((app) => {
                            const isPending = app.status === 'PENDING';
                            return (
                                <tr key={app.id} className="group h-11 hover:bg-[var(--fc-surface-hover)] transition-colors">
                                    <td className="px-4 w-8">
                                        <input
                                            type="checkbox"
                                            checked={selected.has(app.id)}
                                            disabled={!isPending}
                                            onChange={() => toggleSelect(app.id)}
                                            aria-label={`Select ${app.fullName || app.username}`}
                                            className="h-3.5 w-3.5 accent-[#16a34a]"
                                        />
                                    </td>
                                    <td className="px-4">
                                        <UserIdentityCell avatarUrl={app.avatarUrl} fullName={app.fullName} username={app.username} />
                                        {/* Phase A3 — inline applicant summary */}
                                        <div className="mt-1 flex flex-wrap items-center gap-1">
                                            {summaryChips(app).map((chip) => (
                                                <Pill key={chip} label={chip} tone="neutral" />
                                            ))}
                                            {app.isMinor && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--fc-state-warning)]">
                                                    <ShieldAlert className="h-3 w-3" />
                                                    {t('applications.minor')}
                                                </span>
                                            )}
                                            {app.isMinor && app.currentConsentStatus === 'PENDING' && (
                                                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--fc-state-warning)]">
                                                    · {t('applications.consentPending')}
                                                </span>
                                            )}
                                        </div>
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
                                                    { id: 'accept', label: 'Accept', description: 'Approve membership request', icon: <Check className="h-3.5 w-3.5" />, tone: 'positive', disabled: !isPending, onSelect: () => onAcceptApplication(app.id) },
                                                    { id: 'decline', label: 'Decline', description: 'Reject this application with a kind note (phase A6)', icon: <X className="h-3.5 w-3.5" />, tone: 'danger', divider: true, disabled: !isPending, onSelect: () => onDeclineApplication(app.id) },
                                                ]}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </DataTable>
                </div>
            )}

            {bulkAction && (
                <DecisionNoteModal
                    title={bulkAction === 'ACCEPT' ? t('applications.acceptTitle') : t('applications.declineTitle')}
                    subtitle={t('applications.subtitle')}
                    saving={bulkPending}
                    confirmLabel={bulkAction === 'ACCEPT' ? t('decisions.accept') : t('applications.declineConfirm')}
                    danger={bulkAction === 'DECLINE'}
                    onClose={() => setBulkAction(null)}
                    onConfirm={(message) => void handleBulkConfirm(message)}
                />
            )}
        </div>
    );
};
