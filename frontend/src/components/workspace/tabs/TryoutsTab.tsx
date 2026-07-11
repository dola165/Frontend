import { Check, X } from 'lucide-react';
import { DataTable, EmptyState, PageSpinner, SectionHeader } from '../helpers';
import { UserIdentityCell } from '../UserIdentityCell';
import { StatusCell } from '../StatusCell';
import { OverflowActions } from '../../ui/OverflowActions';
import type { TryoutApplicantDto } from '../types';

interface TryoutsTabProps {
    tryoutApplicants: TryoutApplicantDto[];
    tryoutsLoading: boolean;
    pendingKey: string | null;
    onTryoutStatus: (applicationId: number, status: 'ACCEPTED' | 'REJECTED') => Promise<void>;
}

export const TryoutsTab = ({ tryoutApplicants, tryoutsLoading, pendingKey, onTryoutStatus }: TryoutsTabProps) => (
    <div className="space-y-4">
        <SectionHeader eyebrow="Tryouts" title="Applicant Review" description="Review and respond to tryout applications." />
        {tryoutsLoading && tryoutApplicants.length === 0 ? (
            <PageSpinner />
        ) : tryoutApplicants.length === 0 ? (
            <EmptyState message="No tryout applications to review." />
        ) : (
            <div className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] overflow-hidden">
                <DataTable columns={['Name', 'Position', 'Age Group', 'Status', '']}>
                    {tryoutApplicants.map((app) => (
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
                                            { id: 'accept', label: 'Accept', description: 'Approve tryout application', icon: <Check className="h-3.5 w-3.5" />, tone: 'positive', disabled: pendingKey === `tryout-${app.id}-ACCEPTED`, onSelect: () => void onTryoutStatus(app.id, 'ACCEPTED') },
                                            { id: 'decline', label: 'Decline', description: 'Reject tryout application', icon: <X className="h-3.5 w-3.5" />, tone: 'danger', divider: true, disabled: pendingKey === `tryout-${app.id}-REJECTED`, confirm: { title: 'Decline tryout?', body: `Decline the tryout application from ${app.name}?` }, onSelect: () => void onTryoutStatus(app.id, 'REJECTED') },
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
