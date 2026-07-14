import { useEffect, useRef, useState } from 'react';
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
    onSquadCreated?: () => void;
    onDataChanged?: () => void;
    onMembershipLeft?: () => Promise<void> | void;
}

// ── helpers ──

const StatCard = ({ label, value, loading }: { label: string; value: number | string; loading?: boolean }) => (
    <div className="rounded-[2px] border border-[#ffffff0d] bg-[rgba(255,255,255,0.02)] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#71717a]">{label}</p>
        <p className="mt-1.5 text-xl font-semibold text-[#f4f4f5] tabular-nums">
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-[#71717a]" /> : value}
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
    onSquadCreated: _onSquadCreated,
    onDataChanged: _onDataChanged,
    onMembershipLeft: _onMembershipLeft
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
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 p-4" style={{ pointerEvents: 'none' } as React.CSSProperties}>
                <div className="w-full max-w-md rounded-[2px] border border-[#ffffff0d] bg-[#0d0d10] p-8 text-center shadow-2xl" style={{ pointerEvents: 'auto' } as React.CSSProperties}>
                    <Settings className="mx-auto h-10 w-10 text-[#71717a]" />
                    <h2 className="mt-4 text-lg font-semibold text-[#f4f4f5]">No Club Access</h2>
                    <p className="mt-3 text-sm text-[#a1a1aa]">We couldn&apos;t verify your membership role. Try refreshing or enable debug mode.</p>
                    <div className="mt-6 flex flex-col gap-2">
                        <button type="button" onClick={() => { localStorage.setItem('__gkz_debug_membership', 'true'); window.location.reload(); }} className="rounded-[2px] border border-[#00ff6e]/30 bg-[#00ff6e]/10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#00ff6e] hover:bg-[#00ff6e] hover:text-black transition-colors">
                            Enable Debug Mode
                        </button>
                        <button type="button" onClick={onClose} className="rounded-[2px] border border-[#ffffff0d] bg-[rgba(255,255,255,0.03)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 p-4" style={{ pointerEvents: 'none' } as React.CSSProperties}>
            <div
                ref={modalRef}
                className="w-full max-w-lg rounded-[2px] border border-[#ffffff0d] bg-[#0d0d10] shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
                style={{ pointerEvents: 'auto', transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`, userSelect: dragging ? 'none' : undefined } as React.CSSProperties}
            >
                {/* header + drag handle */}
                <div className="flex items-center justify-between border-b border-[#ffffff0d] px-5 py-4 cursor-grab active:cursor-grabbing" onMouseDown={handleDragStart}>
                    <div>
                        <div className="flex items-center gap-2">
                            <GripHorizontal className="h-3.5 w-3.5 text-[#71717a]" />
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#00ff6e]">Control Center</span>
                        </div>
                        <h2 className="mt-1.5 text-base font-semibold text-[#f4f4f5]">{clubName}</h2>
                        <p className="mt-0.5 text-[11px] text-[#71717a]">
                            Signed in as {effectiveRole ? clubRoleLabel(effectiveRole) : 'Verifying…'}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-[2px] p-2 text-[#71717a] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#f4f4f5] transition-colors" aria-label="Close">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* debug banner */}
                {debugActive && (
                    <div className="border-b border-[#ffffff0d] bg-[#ff9e58]/10 px-4 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[#ff9e58]">
                        🐛 Debug Mode — Actual role: {currentRoleProp || 'null'}
                    </div>
                )}

                {/* errors / success */}
                <div className="px-5 pt-4 space-y-2">
                    {errorMessage && <div className="rounded-[2px] border border-[#ef4444]/20 bg-[#ef4444]/10 px-4 py-2.5 text-[13px] font-medium text-[#ef4444]">{errorMessage}</div>}
                    {successMessage && <div className="rounded-[2px] border border-[#22c55e]/20 bg-[#22c55e]/10 px-4 py-2.5 text-[13px] font-medium text-[#22c55e]">{successMessage}</div>}
                </div>

                {/* stat cards */}
                <div className="px-5 pt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#71717a]">Club Snapshot</p>
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
                    {overviewError && <p className="mt-2 text-[11px] font-medium text-[#ef4444]">{overviewError}</p>}
                </div>

                {/* quick actions */}
                <div className="px-5 py-4 space-y-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#71717a]">Quick Actions</p>

                    <button
                        type="button"
                        onClick={() => goWorkspace()}
                        className="flex w-full items-center justify-between rounded-[2px] border border-[#00ff6e]/30 bg-[#00ff6e]/10 px-4 py-3 text-left text-sm font-semibold text-[#00ff6e] hover:bg-[#00ff6e] hover:text-black transition-colors"
                    >
                        <span>Open Club Workspace</span>
                        <ArrowRight className="h-4 w-4" />
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={goWorkspaceInbox} className="rounded-[2px] border border-[#ffffff0d] bg-[rgba(255,255,255,0.03)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa] hover:border-[#ffffff14] hover:text-[#f4f4f5] transition-colors">
                            <BellRing className="mr-2 inline-block h-3.5 w-3.5" />
                            Club Inbox
                        </button>
                        {(canManageLeadership || debugActive) && (
                            <button type="button" onClick={goSquads} className="rounded-[2px] border border-[#ffffff0d] bg-[rgba(255,255,255,0.03)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa] hover:border-[#ffffff14] hover:text-[#f4f4f5] transition-colors">
                                <ShieldCheck className="mr-2 inline-block h-3.5 w-3.5" />
                                Squads
                            </button>
                        )}
                    </div>

                    {(canManageLeadership || debugActive) && (
                        <button type="button" onClick={() => goWorkspace('roles')} className="w-full rounded-[2px] border border-[#ff9e58]/20 bg-[#ff9e58]/10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ff9e58] hover:bg-[#ff9e58] hover:text-black transition-colors">
                            <Crown className="mr-2 inline-block h-3.5 w-3.5" />
                            Ownership &amp; Roles
                        </button>
                    )}
                </div>

                {/* footer */}
                <div className="border-t border-[#ffffff0d] px-5 py-3 flex justify-end">
                    <button type="button" onClick={onClose} className="rounded-[2px] border border-[#ffffff0d] bg-[rgba(255,255,255,0.03)] px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
