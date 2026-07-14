import { BellRing, ClipboardList, Send, ShieldCheck, Trophy, UserCheck, UserPlus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ClubManagementOverview } from '../../../features/clubs/domain';
import { SectionHeader } from '../helpers';
import { MetricCardV2 } from '../MetricCardV2';
import { QuickLinkTile } from '../QuickLinkTile';
import type { WorkspaceTab } from '../types';

interface OverviewTabProps {
    overview: ClubManagementOverview | null;
    clubId: number;
    onTabChange: (tab: WorkspaceTab) => void;
    overdueTrialistCount?: number;
}

export const OverviewTab = ({ overview, onTabChange, overdueTrialistCount = 0 }: OverviewTabProps) => {
    const navigate = useNavigate();
    const pendingActions = (overview?.pendingInvitations.length ?? 0) + (overview?.pendingApplications.length ?? 0);
    const totalTrialists = overview?.trialistCount ?? 0;
    const regularTrialistCount = Math.max(0, totalTrialists - overdueTrialistCount);
    const hasUrgent = totalTrialists > 0 || (overview?.pendingApplications.length ?? 0) > 0;
    const hasOverdue = overdueTrialistCount > 0;

    return (
        <div className="space-y-4">
            <SectionHeader eyebrow="Dashboard" title="Club Overview" description="Key metrics and shortcuts for managing your club." />

            {/* Urgent items */}
            {hasUrgent && (
                <div className={`rounded-md border p-4 ${
                    hasOverdue
                        ? 'border-[var(--fc-state-danger-soft)] bg-[var(--fc-state-danger-soft)]'
                        : 'border-[var(--fc-state-warning-soft)] bg-[var(--fc-state-warning-soft)]'
                }`}>
                    <p className="text-sm font-semibold text-[var(--fc-text-primary)]">Action Required</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm">
                        {hasOverdue && (
                            <button
                                type="button"
                                onClick={() => onTabChange('players')}
                                className="font-medium text-[var(--fc-state-danger)] hover:underline"
                            >
                                {overdueTrialistCount} overdue trialist{overdueTrialistCount !== 1 ? 's' : ''} require{overdueTrialistCount === 1 ? 's' : ''} immediate review
                            </button>
                        )}
                        {regularTrialistCount > 0 && (
                            <button
                                type="button"
                                onClick={() => onTabChange('players')}
                                className="font-medium text-[var(--fc-accent)] hover:underline"
                            >
                                {regularTrialistCount} trialist{regularTrialistCount !== 1 ? 's' : ''} awaiting review
                            </button>
                        )}
                        {(overview?.pendingApplications.length ?? 0) > 0 && (
                            <button
                                type="button"
                                onClick={() => onTabChange('applications')}
                                className="font-medium text-[var(--fc-accent)] hover:underline"
                            >
                                {overview!.pendingApplications.length} application{overview!.pendingApplications.length !== 1 ? 's' : ''} to review
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Metric Cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCardV2 label="Members" value={overview?.members.length ?? 0} icon={Users} />
                <MetricCardV2 label="Active Players" value={overview?.activePlayerCount ?? 0} icon={UserCheck} tone="success" />
                <MetricCardV2 label="Trialists" value={totalTrialists} icon={UserPlus} tone={hasOverdue ? 'danger' : 'warning'} />
                <MetricCardV2 label="Pending" value={pendingActions} icon={BellRing} tone={pendingActions > 0 ? 'danger' : 'default'} />
            </div>

            {/* Quick Links */}
            <SectionHeader eyebrow="Shortcuts" title="Quick Links" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <QuickLinkTile
                    icon={Users} title="Personnel" subtitle="Manage staff roles and permissions"
                    onClick={() => onTabChange('personnel')}
                />
                <QuickLinkTile
                    icon={UserPlus} title="Players" subtitle="Track trialists, active, and past players"
                    onClick={() => onTabChange('players')}
                    badge={(overview?.activePlayerCount ?? 0) > 0 ? String(overview!.activePlayerCount) : null}
                />
                <QuickLinkTile
                    icon={Send} title="Invites" subtitle="Search and invite new members"
                    onClick={() => onTabChange('invites')}
                    badge={(overview?.pendingInvitations.length ?? 0) > 0 ? String(overview!.pendingInvitations.length) : null}
                />
                <QuickLinkTile
                    icon={ClipboardList} title="Applications" subtitle="Review membership requests"
                    onClick={() => onTabChange('applications')}
                    badge={(overview?.pendingApplications.length ?? 0) > 0 ? String(overview!.pendingApplications.length) : null}
                />
                <QuickLinkTile
                    icon={ShieldCheck} title="Squads" subtitle="Create and manage team rosters"
                    onClick={() => onTabChange('squads')}
                />
                <QuickLinkTile
                    icon={Trophy} title="Tournament" subtitle="Host a bracket competition"
                    onClick={() => navigate('/tournaments/setup')}
                />
            </div>

            {/* Week schedule placeholder */}
            <div className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-4">
                <p className="text-xs font-semibold text-[var(--fc-text-muted)]">THIS WEEK</p>
                <p className="mt-1 text-sm font-semibold text-[var(--fc-text-primary)]">Schedule</p>
                <p className="mt-1 text-sm text-[var(--fc-text-secondary)]">
                    Schedule view coming soon. Visit the Calendar for upcoming events.
                </p>
            </div>
        </div>
    );
};
