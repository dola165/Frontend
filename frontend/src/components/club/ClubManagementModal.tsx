import { useEffect, useRef, useState } from 'react';
import { useDialogFocus } from '../workspace/useDialogFocus';
import { useClubPanelMotion } from '../../features/clubs/useClubPanelMotion';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRight,
    BellRing,
    Crown,
    GripHorizontal,
    Loader2,
    Settings,
    ShieldCheck,
    X
} from 'lucide-react';
import {
    clubRoleLabel,
    canReviewTryouts,
    isLeadershipRole,
    type ClubManagementOverview
} from '../../features/clubs/domain';
import {
    fetchClubManagementOverview
} from '../../features/clubs/api';
import { apiClient } from '../../api/axiosConfig';
import { extractApiErrorMessage } from '../../utils/apiError';

export type ClubManagementTab = 'personnel' | 'players' | 'invites' | 'applications' | 'roles' | 'squads' | 'tryouts';

interface ClubManagementModalProps {
    clubId: number;
    clubName: string;
    currentRole: string | null;
    initialTab?: ClubManagementTab | null;
    debugMode?: boolean;
    onClose: () => void;
    onDissolveClub?: () => void;
    onSquadCreated?: () => void;
    onDataChanged?: () => void;
    onMembershipLeft?: () => Promise<void> | void;
}

// ── helpers ──

const StatCard = ({ label, value, loading }: { label: string; value: number | string; loading?: boolean }) => (
    <div className="rounded-[2px] border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[color-mix(in_srgb,_var(--color-ink)_2%,_transparent)] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-secondary)]">{label}</p>
        <p className="mt-1.5 text-xl font-semibold text-[var(--color-text)] tabular-nums">
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-[var(--color-secondary)]" /> : value}
        </p>
    </div>
);

// ── component ──

export const ClubManagementModal = ({
    clubId,
    clubName,
    currentRole: currentRoleProp,
    debugMode: debugModeProp = false,
    onClose,
    onDissolveClub,
}: ClubManagementModalProps) => {
    const navigate = useNavigate();

    const debugActive = debugModeProp || localStorage.getItem('__gkz_debug_membership') === 'true';
    const currentRole = debugActive && !currentRoleProp ? 'OWNER' : currentRoleProp;

    const canManageLeadership = isLeadershipRole(currentRole);
    const canManageTryouts = canReviewTryouts(currentRole);

    const [overview, setOverview] = useState<ClubManagementOverview | null>(null);
    const [overviewLoading, setOverviewLoading] = useState(canManageLeadership || debugActive);
    const [overviewError, setOverviewError] = useState<string | null>(null);
    const [tryoutCount, setTryoutCount] = useState(0);
    const [tryoutsLoading, setTryoutsLoading] = useState(canManageTryouts || debugActive);
    const [errorMessage] = useState<string | null>(null);
    const [successMessage] = useState<string | null>(null);

    // Self-healing role recovery
    const [recoveredRole, setRecoveredRole] = useState<string | null>(null);
    useEffect(() => {
        if (currentRoleProp || overviewLoading) return;
        let cancelled = false;
        const recover = async () => {
            try {
                const ov = await fetchClubManagementOverview(clubId);
                if (!cancelled && ov.currentUserRole) setRecoveredRole(ov.currentUserRole);
            } catch { /* silent */ }
        };
        void recover();
        return () => { cancelled = true; };
    }, [clubId, currentRoleProp, overviewLoading]);

    const effectiveRole = currentRole || recoveredRole;

    // ── drag ──
    const modalRef = useRef<HTMLDivElement>(null);
    const motion = useClubPanelMotion(onClose);
    useDialogFocus(true, modalRef, motion.close);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0, left: 0, top: 0 });

    const handleDragStart = (e: React.MouseEvent) => {
        dragStart.current = { x: e.clientX, y: e.clientY, left: dragOffset.x, top: dragOffset.y };
        setDragging(true);
    };

    useEffect(() => {
        if (!dragging) return;
        const hM = (e: MouseEvent) => setDragOffset({ x: dragStart.current.left + e.clientX - dragStart.current.x, y: dragStart.current.top + e.clientY - dragStart.current.y });
        const hU = () => setDragging(false);
        document.addEventListener('mousemove', hM);
        document.addEventListener('mouseup', hU);
        return () => { document.removeEventListener('mousemove', hM); document.removeEventListener('mouseup', hU); };
    }, [dragging]);

    // ── data loading ──
    useEffect(() => {
        if (!canManageLeadership && !debugActive) { setOverviewLoading(false); return; }
        let cancelled = false;
        const load = async () => {
            setOverviewLoading(true);
            setOverviewError(null);
            try {
                const response = await fetchClubManagementOverview(clubId);
                if (!cancelled) setOverview(response);
            } catch (error) {
                if (!cancelled) setOverviewError(extractApiErrorMessage(error, 'Failed to load club data.'));
            } finally {
                if (!cancelled) setOverviewLoading(false);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [clubId, canManageLeadership, debugActive]);

    useEffect(() => {
        if (!canManageTryouts && !debugActive) return;
        let cancelled = false;
        const load = async () => {
            setTryoutsLoading(true);
            try {
                const response = await apiClient.get<{ length: number }[]>(`/admin/tryouts/clubs/${clubId}/applications`);
                if (!cancelled) setTryoutCount((response.data || []).length);
            } catch { /* non-critical */ }
            finally { if (!cancelled) setTryoutsLoading(false); }
        };
        void load();
        return () => { cancelled = true; };
    }, [clubId, canManageTryouts, debugActive]);

    // ── navigation ──
    const goWorkspace = (tab?: ClubManagementTab) => {
        onClose();
        navigate(`/clubs/${clubId}/workspace${tab ? `?tab=${tab}` : ''}`);
    };
    const goWorkspaceInbox = () => { onClose(); navigate(`/clubs/${clubId}/workspace?tab=inbox`); };
    const goSquads = () => { onClose(); navigate(`/clubs/${clubId}/squads`); };

    const memberCount = overview?.members.length ?? 0;
    const inviteCount = overview?.pendingInvitations.length ?? 0;
    const applicationCount = overview?.pendingApplications.length ?? 0;

    // ── no-access guard ──
    if (!effectiveRole && !debugActive && !overviewLoading) {
        return (
            <div className="club-motion-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-[color:var(--color-overlay)]/30 p-4" data-closing={motion.closing} style={{ pointerEvents: 'auto' } as React.CSSProperties}>
                <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Club access unavailable" data-closing={motion.closing} onAnimationEnd={motion.onAnimationEnd} className="club-motion-dialog w-full max-w-md rounded-[2px] border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-page)] p-8 text-center shadow-2xl" style={{ pointerEvents: 'auto' } as React.CSSProperties}>
                    <Settings className="mx-auto h-10 w-10 text-[var(--color-secondary)]" />
                    <h2 className="mt-4 text-lg font-semibold text-[var(--color-text)]">No Club Access</h2>
                    <p className="mt-3 text-sm text-[var(--color-secondary)]">We couldn&apos;t verify your membership role. Try refreshing or enable debug mode.</p>
                    <div className="mt-6 flex flex-col gap-2">
                        <button type="button" onClick={() => { localStorage.setItem('__gkz_debug_membership', 'true'); window.location.reload(); }} className="rounded-[2px] border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-on-accent)] transition-colors">
                            Enable Debug Mode
                        </button>
                        <button type="button" onClick={motion.close} className="rounded-[2px] border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[color-mix(in_srgb,_var(--color-ink)_3%,_transparent)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-secondary)] hover:text-[var(--color-text)] transition-colors">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="club-motion-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-[color:var(--color-overlay)]/30 p-4" data-closing={motion.closing} style={{ pointerEvents: 'auto' } as React.CSSProperties}>
            <div
                ref={modalRef}
                role="dialog" aria-modal="true" aria-label={`${clubName} settings`}
                data-closing={motion.closing} onAnimationEnd={motion.onAnimationEnd}
                className="club-motion-dialog max-h-[85dvh] overflow-y-auto w-full max-w-lg rounded-2xl border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-page)] shadow-[0_8px_40px_color-mix(in_srgb,_var(--color-shadow)_50%,_transparent)]"
                style={{ pointerEvents: 'auto', transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`, userSelect: dragging ? 'none' : undefined } as React.CSSProperties}
            >
                {/* header + drag handle */}
                <div className="flex items-center justify-between border-b border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] px-5 py-4 cursor-grab active:cursor-grabbing" onMouseDown={handleDragStart}>
                    <div>
                        <div className="flex items-center gap-2">
                            <GripHorizontal className="h-3.5 w-3.5 text-[var(--color-secondary)]" />
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">Club settings & tools</span>
                        </div>
                        <h2 className="mt-1.5 text-base font-semibold text-[var(--color-text)]">{clubName}</h2>
                        <p className="mt-0.5 text-[11px] text-[var(--color-secondary)]">
                            Signed in as {effectiveRole ? clubRoleLabel(effectiveRole) : 'Verifying…'}
                        </p>
                    </div>
                    <button type="button" onClick={motion.close} className="rounded-[2px] p-2 text-[var(--color-secondary)] hover:bg-[color-mix(in_srgb,_var(--color-ink)_4%,_transparent)] hover:text-[var(--color-text)] transition-colors" aria-label="Close">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* debug banner */}
                {debugActive && (
                    <div className="border-b border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-orange)]/10 px-4 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-orange)]">
                        🐛 Debug Mode — Actual role: {currentRoleProp || 'null'}
                    </div>
                )}

                {/* errors / success */}
                <div className="px-5 pt-4 space-y-2">
                    {errorMessage && <div className="rounded-[2px] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-2.5 text-[13px] font-medium text-[var(--color-danger)]">{errorMessage}</div>}
                    {successMessage && <div className="rounded-[2px] border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10 px-4 py-2.5 text-[13px] font-medium text-[var(--color-accent)]">{successMessage}</div>}
                </div>

                {/* stat cards */}
                <div className="px-5 pt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-secondary)]">Club Snapshot</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {(canManageLeadership || debugActive) && (
                            <>
                                <StatCard label="Members" value={memberCount} loading={overviewLoading && !overview} />
                                <StatCard label="Invites" value={inviteCount} loading={overviewLoading && !overview} />
                                <StatCard label="Applications" value={applicationCount} loading={overviewLoading && !overview} />
                            </>
                        )}
                        {(canManageTryouts || debugActive) && (
                            <StatCard label="Tryouts" value={tryoutCount} loading={tryoutsLoading} />
                        )}
                    </div>
                    {overviewError && <p className="mt-2 text-[11px] font-medium text-[var(--color-danger)]">{overviewError}</p>}
                </div>

                {/* quick actions */}
                <div className="px-5 py-4 space-y-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-secondary)]">Quick Actions</p>

                    <button
                        type="button"
                        onClick={() => goWorkspace()}
                        className="flex w-full items-center justify-between rounded-[2px] border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-3 text-left text-sm font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-on-accent)] transition-colors"
                    >
                        <span>Open Club Workspace</span>
                        <ArrowRight className="h-4 w-4" />
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={goWorkspaceInbox} className="rounded-[2px] border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[color-mix(in_srgb,_var(--color-ink)_3%,_transparent)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-secondary)] hover:border-[color-mix(in_srgb,_var(--color-border)_7.84%,_transparent)] hover:text-[var(--color-text)] transition-colors">
                            <BellRing className="mr-2 inline-block h-3.5 w-3.5" />
                            Club Inbox
                        </button>
                        {(canManageLeadership || debugActive) && (
                            <button type="button" onClick={goSquads} className="rounded-[2px] border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[color-mix(in_srgb,_var(--color-ink)_3%,_transparent)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-secondary)] hover:border-[color-mix(in_srgb,_var(--color-border)_7.84%,_transparent)] hover:text-[var(--color-text)] transition-colors">
                                <ShieldCheck className="mr-2 inline-block h-3.5 w-3.5" />
                                Squads
                            </button>
                        )}
                    </div>

                    {(canManageLeadership || debugActive) && (
                        <button type="button" onClick={() => goWorkspace('roles')} className="w-full rounded-[2px] border border-[var(--color-orange)]/20 bg-[var(--color-orange)]/10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-orange)] hover:bg-[var(--color-orange)] hover:text-[var(--color-on-accent)] transition-colors">
                            <Crown className="mr-2 inline-block h-3.5 w-3.5" />
                            Ownership &amp; Roles
                        </button>
                    )}
                </div>

                {onDissolveClub && <details className="mx-5 mb-5 rounded-xl border border-[color:var(--color-danger)]/20 p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-[var(--color-secondary)]">Advanced club settings</summary>
                    <p className="mt-3 text-xs leading-5 text-[var(--color-secondary)]">Dissolving ends club operations permanently. Review the consequences before continuing.</p>
                    <button type="button" onClick={onDissolveClub} className="mt-3 rounded-lg border border-[color:var(--color-danger)]/30 px-4 py-2.5 text-sm font-semibold text-[color:var(--color-danger)]">Dissolve Club</button>
                </details>}

                {/* footer */}
                <div className="border-t border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] px-5 py-3 flex justify-end">
                    <button type="button" onClick={motion.close} className="rounded-[2px] border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[color-mix(in_srgb,_var(--color-ink)_3%,_transparent)] px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-secondary)] hover:text-[var(--color-text)] transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
