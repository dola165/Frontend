import type { ClubManagementOverview, ClubPlayerAffiliation, PageResult } from '../../features/clubs/domain';
import { clubRoleLabel } from '../../features/clubs/domain';
import type { WorkspaceTab, TryoutApplicantDto } from './types';

interface ContextPanelProps {
    activeTab: WorkspaceTab;
    overview: ClubManagementOverview | null;
    playerDirectory: PageResult<ClubPlayerAffiliation> | null;
    tryoutApplicants: TryoutApplicantDto[];
    currentRole: string | null;
    onTabChange: (tab: WorkspaceTab) => void;
}

export const ContextPanel = ({
    activeTab, overview, playerDirectory, tryoutApplicants, currentRole, onTabChange,
}: ContextPanelProps) => (
    <aside className="w-[280px] shrink-0 border-l border-[var(--fc-border)] bg-[var(--fc-sidebar-bg)] overflow-y-auto">
        <div className="p-4">
            <p className="text-xs font-semibold text-[var(--fc-text-muted)] uppercase tracking-wider">Context</p>

            {/* ── overview ── */}
            {activeTab === 'overview' && (
                <div className="mt-3 space-y-3">
                    <div className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
                        <p className="text-xs font-semibold text-[var(--fc-text-primary)]">This Week</p>
                        <p className="mt-2 text-xs text-[var(--fc-text-muted)]">Schedule view coming soon. Check the calendar tab for upcoming events.</p>
                    </div>
                    {overview && (
                        <div className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
                            <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Quick Stats</p>
                            <div className="mt-2 space-y-1.5 text-xs text-[var(--fc-text-secondary)]">
                                <p>{overview.members.length} staff member{overview.members.length !== 1 ? 's' : ''}</p>
                                <p>{overview.activePlayerCount} active player{overview.activePlayerCount !== 1 ? 's' : ''}</p>
                                <p>{overview.trialistCount} trialist{overview.trialistCount !== 1 ? 's' : ''}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── players ── */}
            {activeTab === 'players' && (
                <div className="mt-3 space-y-3">
                    {/* Awaiting Decision */}
                    <div className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
                        <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Awaiting Decision</p>
                        <p className="mt-1 text-2xl font-semibold text-amber-500">
                            {playerDirectory?.content.filter((p) => p.status === 'TRIALIST').length ?? overview?.trialistCount ?? 0}
                        </p>
                        <p className="text-xs text-[var(--fc-text-secondary)]">players pending</p>
                        {playerDirectory && playerDirectory.content.filter((p) => p.status === 'TRIALIST').slice(0, 5).map((p) => (
                            <div key={p.userId} className="mt-2 flex items-center gap-2 rounded border border-[var(--fc-border)] p-2">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--fc-surface-hover)] text-xs font-semibold text-[var(--fc-text-secondary)]">
                                    {(p.fullName || p.username || '?').charAt(0).toUpperCase()}
                                </div>
                                <span className="flex-1 text-xs font-medium text-[var(--fc-text-primary)] truncate">{p.fullName || p.username}</span>
                                <button
                                    type="button"
                                    onClick={() => onTabChange('players')}
                                    className="text-xs font-semibold text-[#16a34a] hover:underline shrink-0"
                                >
                                    Accept
                                </button>
                            </div>
                        ))}
                        {(!playerDirectory || playerDirectory.content.filter((p) => p.status === 'TRIALIST').length === 0) && (
                            <p className="mt-2 text-xs text-[var(--fc-text-muted)]">No players awaiting decision.</p>
                        )}
                    </div>

                    {/* Active Squad */}
                    <div className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
                        <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Active Squad</p>
                        {(() => {
                            const activePlayers = playerDirectory?.content.filter((p) => p.status === 'ACTIVE') ?? [];
                            const posCounts: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
                            const DEF_KEYS = ['DEF', 'DEFENDER', 'CB', 'LB', 'RB', 'SW', 'FB', 'WB'];
                            const MID_KEYS = ['MID', 'MIDFIELDER', 'CM', 'CDM', 'CAM', 'LM', 'RM', 'DM', 'AM'];
                            const FWD_KEYS = ['FWD', 'FORWARD', 'ST', 'CF', 'LW', 'RW', 'SS', 'WINGER'];
                            activePlayers.forEach((p) => {
                                const raw = p.position?.toUpperCase() || '';
                                if (raw === 'GK' || raw === 'GOALKEEPER') posCounts.GK++;
                                else if (DEF_KEYS.some((k) => raw === k || raw.startsWith(k))) posCounts.DEF++;
                                else if (MID_KEYS.some((k) => raw === k || raw.startsWith(k))) posCounts.MID++;
                                else if (FWD_KEYS.some((k) => raw === k || raw.startsWith(k))) posCounts.FWD++;
                            });
                            const maxCount = Math.max(...Object.values(posCounts), 1);
                            const colors: Record<string, string> = {
                                GK: '#16a34a', DEF: '#3b82f6', MID: '#d97706', FWD: '#ef4444',
                            };
                            return (
                                <>
                                    {activePlayers.length === 0 && (
                                        <p className="mt-1 text-xs text-[var(--fc-text-muted)]">No active players</p>
                                    )}
                                    {(Object.keys(posCounts) as (keyof typeof posCounts)[]).map((pos) => (
                                        <div key={pos} className="mt-2">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-medium text-[var(--fc-text-secondary)]">{pos}</span>
                                                <span className="font-semibold text-[var(--fc-text-primary)]">{posCounts[pos]}</span>
                                            </div>
                                            <div className="mt-1 h-1.5 rounded-full bg-[var(--fc-surface-hover)]">
                                                <div
                                                    className="h-full rounded-full transition-all"
                                                    style={{ width: `${(posCounts[pos] / maxCount) * 100}%`, backgroundColor: colors[pos] }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </>
                            );
                        })()}
                    </div>

                    {/* Legend */}
                    <div className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
                        <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Legend</p>
                        <div className="mt-2 space-y-1.5 text-xs text-[var(--fc-text-secondary)]">
                            <div className="flex items-center gap-2">
                                <span className="inline-block h-2 w-2 rounded-full bg-[var(--fc-state-success)]" />
                                Active — full member
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-block h-2 w-2 rounded-full bg-[var(--fc-state-warning)]" />
                                Trialist — pending review
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-block h-2 w-2 rounded-full bg-[var(--fc-text-muted)]" />
                                Past / Removed — inactive
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── personnel ── */}
            {activeTab === 'personnel' && (
                <div className="mt-3 space-y-3">
                    <div className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
                        <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Role Explanations</p>
                        <div className="mt-2 space-y-2 text-xs">
                            <div>
                                <p className="font-semibold text-[var(--fc-text-primary)]">Owner</p>
                                <p className="text-[var(--fc-text-secondary)]">Full control over the club. Can transfer ownership, manage all roles, and delete the club.</p>
                            </div>
                            <div>
                                <p className="font-semibold text-[var(--fc-text-primary)]">Club Admin</p>
                                <p className="text-[var(--fc-text-secondary)]">Day-to-day management. Can manage staff, players, squads, and review applications.</p>
                            </div>
                            <div>
                                <p className="font-semibold text-[var(--fc-text-primary)]">Coach</p>
                                <p className="text-[var(--fc-text-secondary)]">Manages squads and players. Can review tryouts but cannot change club settings.</p>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => onTabChange('invites')}
                        className="w-full rounded-md border border-[var(--fc-accent-border)] bg-[var(--fc-accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--fc-accent)] hover:opacity-80 transition-opacity"
                    >
                        Invite Staff Members
                    </button>
                </div>
            )}

            {/* ── invites ── */}
            {activeTab === 'invites' && (
                <div className="mt-3 space-y-3">
                    <div className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
                        <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Pending Invites</p>
                        <p className="mt-1 text-2xl font-semibold text-[var(--fc-accent)]">
                            {overview?.pendingInvitations.length ?? 0}
                        </p>
                        <p className="text-xs text-[var(--fc-text-secondary)]">awaiting response</p>
                    </div>
                    <div className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
                        <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Tips</p>
                        <p className="mt-1 text-xs text-[var(--fc-text-secondary)]">
                            Search for users by name or username. Select a role before sending the invitation. Invited users receive a notification.
                        </p>
                    </div>
                </div>
            )}

            {/* ── applications ── */}
            {activeTab === 'applications' && (
                <div className="mt-3 space-y-3">
                    <div className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
                        <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Pending Applications</p>
                        <p className="mt-1 text-2xl font-semibold text-[var(--fc-accent)]">
                            {overview?.pendingApplications.length ?? 0}
                        </p>
                        <p className="text-xs text-[var(--fc-text-secondary)]">to review</p>
                    </div>
                    <div className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
                        <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Review Tips</p>
                        <p className="mt-1 text-xs text-[var(--fc-text-secondary)]">
                            Accept to grant membership with the requested role. Decline to reject. Accepted members appear in the Personnel or Players tab.
                        </p>
                    </div>
                </div>
            )}

            {/* ── roles ── */}
            {activeTab === 'roles' && (
                <div className="mt-3 space-y-3">
                    <div className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
                        <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Role Hierarchy</p>
                        <div className="mt-2 space-y-1.5 text-xs text-[var(--fc-text-secondary)]">
                            <p><span className="font-semibold text-[var(--fc-text-primary)]">Owner</span> — Ultimate authority</p>
                            <p className="ml-3"><span className="font-semibold text-[var(--fc-text-primary)]">Club Admin</span> — Appointed by Owner</p>
                            <p className="ml-3"><span className="font-semibold text-[var(--fc-text-primary)]">Coach</span> — Manages players</p>
                        </div>
                    </div>
                    {overview && currentRole === 'OWNER' && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
                            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Transfer Ownership</p>
                            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                                Transferring ownership is permanent. You will become a Club Admin after the transfer.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* ── squads ── */}
            {activeTab === 'squads' && (
                <div className="mt-3 space-y-3">
                    <div className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
                        <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Squad Tips</p>
                        <p className="mt-1 text-xs text-[var(--fc-text-secondary)]">
                            Create squads to organize players into teams. Each squad can have its own roster with jersey numbers and positions.
                        </p>
                    </div>
                </div>
            )}

            {/* ── tryouts ── */}
            {activeTab === 'tryouts' && (
                <div className="mt-3 space-y-3">
                    <div className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
                        <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Applicant Stats</p>
                        <p className="mt-1 text-2xl font-semibold text-[var(--fc-accent)]">{tryoutApplicants.length}</p>
                        <p className="text-xs text-[var(--fc-text-secondary)]">total applicants</p>
                    </div>
                    {tryoutApplicants.length > 0 && (
                        <div className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
                            <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Position Breakdown</p>
                            <div className="mt-2 space-y-1 text-xs text-[var(--fc-text-secondary)]">
                                {Object.entries(
                                    tryoutApplicants.reduce<Record<string, number>>((acc, a) => {
                                        const pos = a.position || 'Unknown';
                                        acc[pos] = (acc[pos] || 0) + 1;
                                        return acc;
                                    }, {}),
                                ).map(([pos, count]) => (
                                    <div key={pos} className="flex items-center justify-between">
                                        <span>{pos}</span>
                                        <span className="font-semibold">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── inbox ── */}
            {activeTab === 'inbox' && (
                <div className="mt-3 space-y-3">
                    <div className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
                        <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Club Inbox</p>
                        <p className="mt-1 text-xs text-[var(--fc-text-secondary)]">
                            Notifications scoped to this club. Click a notification to navigate to the relevant page. Use "Mark All Read" to clear unread indicators.
                        </p>
                    </div>
                </div>
            )}
        </div>
    </aside>
);
