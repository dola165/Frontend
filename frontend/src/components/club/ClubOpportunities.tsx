import { ArrowRight, Briefcase, ExternalLink, HeartHandshake, ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import type { ClubOpportunity, ClubProfile } from '../../pages/ClubProfilePage';

interface ClubOpportunitiesProps {
    club: ClubProfile | null;
    onOpenModule?: () => void;
    showOpportunityBoard?: boolean;
}

const orderedTypes: Array<{
    type: ClubOpportunity['type'];
    label: string;
    toneClassName: string;
}> = [
    {
        type: 'FUNDRAISING',
        label: 'Fundraising/Grassroots',
        toneClassName: 'club-tone-green'
    },
    {
        type: 'VOLUNTEER',
        label: 'Volunteer Opportunities',
        toneClassName: 'club-tone-violet'
    }
];

export const ClubOpportunities = ({ club, onOpenModule, showOpportunityBoard = true }: ClubOpportunitiesProps) => {
    const opportunities = club?.opportunities || [];
    const groupedCounts = orderedTypes.map((entry) => ({
        ...entry,
        count: opportunities.filter((opportunity) => opportunity.type === entry.type).length,
        latest: opportunities.find((opportunity) => opportunity.type === entry.type)
    }));

    const [agentEngagementCount, setAgentEngagementCount] = useState(0);

    useEffect(() => {
        if (!club?.id) return;
        apiClient.get(`/clubs/${club.id}/agent-engagements`, { params: { status: 'ACTIVE' } })
            .then(res => setAgentEngagementCount(Array.isArray(res.data) ? res.data.length : 0))
            .catch(() => setAgentEngagementCount(0));
    }, [club?.id]);

    return (
        <aside className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--app-header-height)+14px)]">
            {showOpportunityBoard && (
                <section className="rounded-[4px] overflow-hidden border border-[color:var(--club-theme-border-subtle)]">
                    <div className="border-b border-[color:var(--club-theme-border-subtle)] px-4 py-3.5">
                        <div className="inline-flex items-center gap-2 text-[11px] font-semibold  text-[color:var(--club-tone-green)]">
                            <span>$</span>
                            Opportunities
                        </div>
                    </div>

                    <div className="space-y-3 p-3.5">
                        {groupedCounts.map((entry) => (
                            <div
                                key={entry.type}
                                className={`rounded-[4px] border px-3.5 py-3.5 ${entry.toneClassName}`}
                                style={{ background: 'rgba(10,10,12,0.6)', borderColor: 'var(--club-item-accent-border)' }}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-sm font-semibold tracking-[0.01em] text-[color:var(--club-item-accent)]">
                                        {entry.label}
                                    </span>
                                    <span className="text-sm font-semibold text-[color:var(--club-item-accent)]">
                                        {entry.count}
                                    </span>
                                </div>

                                {entry.latest ? (
                                    <div className="mt-2 flex items-center justify-between gap-3">
                                        <p className="truncate text-xs text-[#a1a1aa]">{entry.latest.title}</p>
                                        {entry.latest.externalLink ? (
                                            <a
                                                href={entry.latest.externalLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-[10px] font-semibold  text-[#f4f4f5]"
                                            >
                                                Open
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        ))}

                        {opportunities.length === 0 && (
                            <div className="rounded-[4px] border border-dashed border-[#ffffff0d] px-4 py-5 text-sm text-[#a1a1aa]">
                                No live business requests are published yet.
                            </div>
                        )}

                        {/* Store — Official Club Merchandise (internal store, always visible) */}
                        <div className="border-t border-[color:var(--club-theme-border-subtle)] pt-3 mt-1">
                            <div
                                className="rounded-[4px] border px-3.5 py-3.5"
                                style={{
                                    background: 'rgba(10,10,12,0.6)',
                                    borderColor: '#d4a853',
                                }}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#d4a853' }}>
                                        <ShoppingBag className="h-4 w-4" />
                                        Official Club Store
                                    </span>
                                </div>
                                <p className="mt-1.5 text-xs text-[#a1a1aa] leading-relaxed">
                                    Official kit, training gear, and equipment. All purchases support your club directly.
                                </p>
                                <Link
                                    to={`/clubs/${club?.id}/store`}
                                    className="mt-2.5 inline-flex w-full items-center justify-between rounded-[4px] border px-3 py-2 text-xs font-semibold transition-colors hover:bg-[rgba(212,168,83,0.08)]"
                                    style={{ borderColor: 'rgba(212,168,83,0.3)', color: '#d4a853' }}
                                >
                                    Visit Store
                                    <ArrowRight className="h-3 w-3" />
                                </Link>
                            </div>
                        </div>

                        {/* Agent Engagements — shows count if any active relationships */}
                        {agentEngagementCount > 0 && (
                            <div className="pt-3">
                                <div
                                    className="rounded-[4px] border px-3.5 py-3.5"
                                    style={{
                                        background: 'rgba(10,10,12,0.6)',
                                        borderColor: 'var(--club-tone-violet)',
                                    }}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="flex items-center gap-2 text-sm font-semibold text-[color:var(--club-tone-violet)]">
                                            <Briefcase className="h-4 w-4" />
                                            Agent Engagements
                                        </span>
                                        <span className="text-sm font-bold text-[color:var(--club-tone-violet)]">{agentEngagementCount}</span>
                                    </div>
                                    <p className="mt-1.5 text-xs text-[#a1a1aa] leading-relaxed">
                                        {agentEngagementCount} active agent relationship{agentEngagementCount !== 1 ? 's' : ''}. Agents help discover talent and facilitate player movement.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Talanti Foundation — Charity/Fundraising (hardcoded, always visible) */}
                        <div className="pt-3">
                            <div
                                className="rounded-[4px] border px-3.5 py-3.5"
                                style={{
                                    background: 'rgba(10,10,12,0.6)',
                                    borderColor: 'var(--club-tone-pink)',
                                }}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <span className="flex items-center gap-2 text-sm font-semibold text-[color:var(--club-tone-pink)]">
                                        <HeartHandshake className="h-4 w-4" />
                                        Talanti Foundation
                                    </span>
                                </div>
                                <p className="mt-1.5 text-xs text-[#a1a1aa] leading-relaxed">
                                    Support community football projects and youth development. Clubs and players run their own fundraisers.
                                </p>
                                <div className="mt-2.5 flex gap-2">
                                    <a
                                        href="https://www.gofundme.com/discover"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[4px] border px-3 py-2 text-xs font-semibold transition-colors hover:bg-[rgba(255,107,157,0.08)]"
                                        style={{ borderColor: 'rgba(255,107,157,0.3)', color: 'var(--club-tone-pink)' }}
                                    >
                                        Donate
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                    <a
                                        href="https://www.gofundme.com/create"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[4px] border px-3 py-2 text-xs font-semibold transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                                        style={{ borderColor: 'var(--club-theme-border-subtle)', color: 'var(--club-theme-text-secondary)' }}
                                    >
                                        Start a Fundraiser
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    {onOpenModule && (
                        <button
                            type="button"
                            onClick={onOpenModule}
                            className="inline-flex w-full items-center justify-between border-t border-[color:var(--club-theme-border-subtle)] px-4 py-3 text-[11px] font-semibold  text-[color:var(--club-theme-text-secondary)] hover:text-[color:var(--club-theme-text-primary)] transition-colors"
                        >
                            Open Business Board
                            <ArrowRight className="h-3.5 w-3.5 text-[color:var(--club-tone-green)]" />
                        </button>
                    )}
                </section>
            )}
        </aside>
    );
};

