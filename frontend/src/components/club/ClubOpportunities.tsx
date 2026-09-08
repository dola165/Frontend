import { ArrowRight, Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ClubOpportunity, ClubProfile } from '../../pages/ClubProfilePage';

interface ClubOpportunitiesProps {
    club: ClubProfile | null;
    onOpenModule?: () => void;
    showOpportunityBoard?: boolean;
}

const orderedTypes: Array<{
    key: string;
    types: ClubOpportunity['type'][];
    label: string;
    toneClassName: string;
    icon: typeof Briefcase;
    href: string;
}> = [
    {
        key: 'JOBS',
        types: ['JOB', 'VOLUNTEER'],
        label: 'Jobs & volunteering',
        toneClassName: 'club-tone-violet',
        icon: Briefcase,
        href: '/jobs'
    }
];

export const ClubOpportunities = ({ club, onOpenModule, showOpportunityBoard = true }: ClubOpportunitiesProps) => {
    const opportunities = club?.opportunities || [];
    const groupedCounts = orderedTypes.map((entry) => ({
        ...entry,
        count: opportunities.filter((opportunity) => entry.types.includes(opportunity.type)).length,
        latest: opportunities.find((opportunity) => entry.types.includes(opportunity.type))
    }));

    if (!club) return null;

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
                        {groupedCounts.map((entry) => {
                            const Icon = entry.icon;
                            return (
                            <Link
                                key={entry.key}
                                to={entry.href}
                                className={`block rounded-[4px] border px-3.5 py-3.5 ${entry.toneClassName}`}
                                style={{ background: 'rgba(10,10,12,0.6)', borderColor: 'var(--club-item-accent-border)' }}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <span className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.01em] text-[color:var(--club-item-accent)]">
                                        <Icon className="h-4 w-4" />
                                        {entry.label}
                                    </span>
                                    <span className="text-sm font-semibold text-[color:var(--club-item-accent)]">
                                        {entry.count}
                                    </span>
                                </div>

                                {entry.latest ? (
                                    <div className="mt-2 flex items-center justify-between gap-3">
                                        <p className="truncate text-xs text-[#a1a1aa]">{entry.latest.title}</p>
                                        <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[#f4f4f5]">
                                            Explore
                                            <ArrowRight className="h-3 w-3" />
                                        </span>
                                    </div>
                                ) : (
                                    <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#f4f4f5]">
                                        Explore
                                        <ArrowRight className="h-3 w-3" />
                                    </div>
                                )}
                            </Link>
                            );
                        })}

                        {groupedCounts.every((entry) => entry.count === 0) && (
                            <div className="rounded-[4px] border border-dashed border-[#ffffff0d] px-4 py-5 text-sm text-[#a1a1aa]">
                                No open roles are published yet.
                            </div>
                        )}

                    </div>

                    {onOpenModule && (
                        <button
                            type="button"
                            onClick={onOpenModule}
                            className="inline-flex w-full items-center justify-between border-t border-[color:var(--club-theme-border-subtle)] px-4 py-3 text-[11px] font-semibold  text-[color:var(--club-theme-text-secondary)] hover:text-[color:var(--club-theme-text-primary)] transition-colors"
                        >
                            View all opportunities
                            <ArrowRight className="h-3.5 w-3.5 text-[color:var(--club-tone-green)]" />
                        </button>
                    )}
                </section>
            )}
        </aside>
    );
};

