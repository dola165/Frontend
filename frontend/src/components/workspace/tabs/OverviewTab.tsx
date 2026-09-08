import { BellRing, CalendarDays, CheckCircle2, ClipboardList, Inbox, Send, ShieldCheck, Trophy, UserCheck, UserPlus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ClubManagementOverview } from '../../../features/clubs/domain';
import type { ScheduleEventOccurrence } from '../../../features/schedule/api';
import { SectionHeader } from '../helpers';
import { MetricCardV2 } from '../MetricCardV2';
import { QuickLinkTile } from '../QuickLinkTile';
import type { WorkspaceTab } from '../types';

interface OverviewTabProps {
    overview: ClubManagementOverview | null;
    clubId: number;
    onTabChange: (tab: WorkspaceTab) => void;
    overdueTrialistCount?: number;
    canManageLeadership: boolean;
    canManageOperations: boolean;
    upcomingEvents: ScheduleEventOccurrence[];
    scheduleLoading: boolean;
    scheduleError: string | null;
    tryoutPendingCount: number;
    unreadInboxCount: number;
    onOpenSchedule: () => void;
    onRetrySchedule: () => void;
}

export const OverviewTab = ({
    overview,
    onTabChange,
    overdueTrialistCount = 0,
    canManageLeadership,
    canManageOperations,
    upcomingEvents,
    scheduleLoading,
    scheduleError,
    tryoutPendingCount,
    unreadInboxCount,
    onOpenSchedule,
    onRetrySchedule,
}: OverviewTabProps) => {
    const navigate = useNavigate();
    const pendingApplications = overview?.pendingApplications.length ?? 0;
    const pendingInvitations = overview?.pendingInvitations.length ?? 0;
    const tryoutReviews = overview?.pendingTryoutCount ?? tryoutPendingCount;
    const pendingActions = pendingInvitations + pendingApplications + tryoutReviews + (overview?.overdueTrialistCount ?? 0);
    const totalTrialists = overview?.trialistCount ?? 0;
    const regularTrialistCount = Math.max(0, totalTrialists - overdueTrialistCount);
    const hasUrgent = totalTrialists > 0 || pendingApplications > 0 || pendingInvitations > 0 || tryoutReviews > 0;
    const hasOverdue = overdueTrialistCount > 0;

    return (
        <div className="space-y-4">
            <SectionHeader eyebrow="Dashboard" title="Club Overview" description="Key metrics and shortcuts for managing your club." />

            {/* Urgent items */}
            {hasUrgent && (
                <div className={`rounded-xl border p-4 ${
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
                        {pendingApplications > 0 && (
                            <button
                                type="button"
                                onClick={() => onTabChange('applications')}
                                className="font-medium text-[var(--fc-accent)] hover:underline"
                            >
                                {pendingApplications} application{pendingApplications !== 1 ? 's' : ''} to review
                            </button>
                        )}
                        {pendingInvitations > 0 && canManageOperations && (
                            <button type="button" onClick={() => onTabChange('invites')} className="font-medium text-[var(--fc-accent)] hover:underline">
                                {pendingInvitations} invitation{pendingInvitations !== 1 ? 's' : ''} awaiting response
                            </button>
                        )}
                        {tryoutReviews > 0 && canManageOperations && (
                            <button type="button" onClick={() => onTabChange('tryouts')} className="font-medium text-[var(--fc-accent)] hover:underline">
                                {tryoutReviews} tryout applicant{tryoutReviews !== 1 ? 's' : ''} to review
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Metric Cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCardV2 label="Staff" value={overview?.members.length ?? 0} icon={Users} />
                <MetricCardV2 label="Active Players" value={overview?.activePlayerCount ?? 0} icon={UserCheck} tone="success" />
                <MetricCardV2 label="Trialists" value={totalTrialists} icon={UserPlus} tone={hasOverdue ? 'danger' : 'warning'} />
                <MetricCardV2 label="Action Items" value={pendingActions} icon={BellRing} tone={pendingActions > 0 ? 'danger' : 'default'} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCardV2 label="Applications" value={pendingApplications} icon={ClipboardList} tone={pendingApplications > 0 ? 'warning' : 'default'} />
                <MetricCardV2 label="Invitations" value={pendingInvitations} icon={Send} tone={pendingInvitations > 0 ? 'warning' : 'default'} />
                <MetricCardV2 label="Tryout Reviews" value={tryoutReviews} icon={CheckCircle2} tone={tryoutReviews > 0 ? 'warning' : 'default'} />
                <MetricCardV2 label="Unread Inbox" value={unreadInboxCount} icon={Inbox} tone={unreadInboxCount > 0 ? 'warning' : 'default'} />
            </div>

            {/* Quick Links */}
            <SectionHeader eyebrow="Shortcuts" title="Quick Links" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {canManageLeadership && (
                    <QuickLinkTile
                        icon={Users} title="Personnel" subtitle="Manage staff roles and permissions"
                        onClick={() => onTabChange('personnel')}
                    />
                )}
                {canManageOperations && (
                    <>
                        <QuickLinkTile
                            icon={UserPlus} title="Players" subtitle="Track trialists, active, and past players"
                            onClick={() => onTabChange('players')}
                            badge={(overview?.activePlayerCount ?? 0) > 0 ? String(overview!.activePlayerCount) : null}
                        />
                        <QuickLinkTile
                            icon={Send}
                            title="Invites"
                            subtitle={overview?.assignableInviteRoles.length ? 'Search and invite new members' : 'Review or cancel pending invitations'}
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
                    </>
                )}
                <QuickLinkTile
                    icon={Trophy} title="Tournament" subtitle="Host a bracket competition"
                    onClick={() => navigate('/tournaments/setup')}
                />
            </div>

            {/* Authoritative schedule summary */}
            <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="text-xs font-semibold text-[var(--fc-text-muted)]">NEXT 7 DAYS</p>
                        <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-[var(--fc-text-primary)]"><CalendarDays className="h-4 w-4 text-[var(--fc-accent)]" />Schedule</p>
                    </div>
                    <button type="button" onClick={onOpenSchedule} className="inline-flex items-center gap-1.5 self-start rounded-lg border border-[var(--fc-border)] px-3 py-2 text-xs font-semibold text-[var(--fc-text-primary)] hover:bg-[var(--fc-surface-hover)]">
                        Open calendar
                    </button>
                </div>
                {scheduleLoading ? (
                    <p className="mt-4 text-sm text-[var(--fc-text-muted)]">Loading upcoming events…</p>
                ) : scheduleError ? (
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--fc-text-secondary)]">
                        <span>Schedule unavailable right now.</span>
                        <button type="button" onClick={onRetrySchedule} className="font-semibold text-[var(--fc-accent)] hover:underline">Retry</button>
                    </div>
                ) : upcomingEvents.length === 0 ? (
                    <p className="mt-4 text-sm text-[var(--fc-text-secondary)]">No club events are scheduled in the next 7 days.</p>
                ) : (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {upcomingEvents.slice(0, 3).map((event) => (
                            <button key={`${event.eventId}-${event.occurrenceId}`} type="button" onClick={onOpenSchedule} className="rounded-lg border border-[var(--fc-border)] px-3 py-2 text-left hover:bg-[var(--fc-surface-hover)]">
                                <p className="truncate text-sm font-semibold text-[var(--fc-text-primary)]">{event.title}</p>
                                <p className="mt-1 text-xs text-[var(--fc-text-secondary)]">{new Date(event.startsAt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                                {event.locationName && <p className="mt-1 truncate text-xs text-[var(--fc-text-muted)]">{event.locationName}</p>}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
