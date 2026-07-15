import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Handshake, MessageCircle, X } from 'lucide-react';
import { fetchClubAgentEngagements, respondToEngagement } from '../../../features/agents/api';
import type { AgentEngagement } from '../../../features/agents/domain';
import { EmptyState, PageSpinner, SectionHeader } from '../helpers';
import { extractApiErrorMessage } from '../../../utils/apiError';

interface AgentEngagementsTabProps {
    clubId: number;
}

const STATUS_COLORS: Record<string, string> = {
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    DECLINED: 'bg-red-500/10 text-red-400 border-red-500/20',
    CANCELLED: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    TERMINATED: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const STATUS_LABEL: Record<string, string> = {
    PENDING: 'Pending',
    ACTIVE: 'Active',
    DECLINED: 'Declined',
    CANCELLED: 'Cancelled',
    TERMINATED: 'Terminated',
};

export const AgentEngagementsTab = ({ clubId }: AgentEngagementsTabProps) => {
    const navigate = useNavigate();
    const [engagements, setEngagements] = useState<AgentEngagement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pendingId, setPendingId] = useState<number | null>(null);

    const loadEngagements = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await fetchClubAgentEngagements(clubId);
            setEngagements(data);
        } catch (err) {
            setError(extractApiErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadEngagements();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clubId]);

    const handleRespond = async (engagementId: number, decision: string) => {
        try {
            setPendingId(engagementId);
            await respondToEngagement(engagementId, clubId, decision);
            await loadEngagements();
        } catch (err) {
            setError(extractApiErrorMessage(err));
        } finally {
            setPendingId(null);
        }
    };

    if (loading && engagements.length === 0) {
        return (
            <div className="space-y-4">
                <SectionHeader eyebrow="Agents" title="Agent Engagements" description="Agents who have initiated contact with your club." />
                <PageSpinner />
            </div>
        );
    }

    if (error && engagements.length === 0) {
        return (
            <div className="space-y-4">
                <SectionHeader eyebrow="Agents" title="Agent Engagements" description="Agents who have initiated contact with your club." />
                <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-6 text-center">
                    <p className="text-sm text-[var(--fc-state-danger)] mb-3">{error}</p>
                    <button
                        type="button"
                        onClick={() => { void loadEngagements(); }}
                        className="px-4 py-2 text-xs font-medium rounded-[6px] bg-[var(--fc-accent)] text-white hover:opacity-90 transition-opacity"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <SectionHeader eyebrow="Agents" title="Agent Engagements" description="Agents who have initiated contact with your club." />

            {engagements.length === 0 ? (
                <EmptyState
                    icon={<Handshake className="h-8 w-8" />}
                    message="No agent engagements yet"
                    description="When agents initiate contact, engagements will appear here. You can accept or decline them."
                />
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {engagements.map((eng) => (
                        <div
                            key={eng.engagementId}
                            className="rounded-[6px] border border-[#ffffff0d] bg-[#16181d] p-4 flex items-center justify-between"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="h-10 w-10 rounded-full bg-[#ffffff0d] flex items-center justify-center text-sm font-semibold text-[var(--fc-text-secondary)] shrink-0 overflow-hidden">
                                    {eng.agentAvatarUrl ? (
                                        <img src={eng.agentAvatarUrl} alt={eng.agentName} className="h-full w-full object-cover" />
                                    ) : (
                                        (eng.agentName || 'A').charAt(0).toUpperCase()
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-[#f4f4f5] truncate">{eng.agentName}</p>
                                    <p className="text-xs text-[#a1a1aa] truncate">{eng.agencyName || 'Independent Agent'}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-medium border ${STATUS_COLORS[eng.status] || STATUS_COLORS.PENDING}`}>
                                    {STATUS_LABEL[eng.status] || eng.status}
                                </span>

                                {eng.status === 'PENDING' && (
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            disabled={pendingId === eng.engagementId}
                                            onClick={() => { void handleRespond(eng.engagementId, 'ACTIVE'); }}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium rounded-[4px] bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                                        >
                                            <Check className="h-3 w-3" />
                                            Accept
                                        </button>
                                        <button
                                            type="button"
                                            disabled={pendingId === eng.engagementId}
                                            onClick={() => { void handleRespond(eng.engagementId, 'DECLINED'); }}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium rounded-[4px] bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
                                        >
                                            <X className="h-3 w-3" />
                                            Decline
                                        </button>
                                    </div>
                                )}

                                {eng.status === 'ACTIVE' && (
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/messages?chatWith=${eng.agentUserId}`)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-[4px] bg-[var(--fc-accent-soft)] text-[var(--fc-accent)] hover:opacity-80 transition-opacity"
                                    >
                                        <MessageCircle className="h-3 w-3" />
                                        Message
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
