import { ArrowRight, Briefcase, HeartHandshake, ShoppingBag } from 'lucide-react';
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
    icon: typeof HeartHandshake;
    href: string;
}> = [
    {
        key: 'FUNDRAISING',
        types: ['FUNDRAISING'],
        label: 'Fundraising / Campaigns',
        toneClassName: 'club-tone-green',
        icon: HeartHandshake,
        href: '/campaigns'
    },
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

                        {opportunities.length === 0 && (
                            <div className="rounded-[4px] border border-dashed border-[#ffffff0d] px-4 py-5 text-sm text-[#a1a1aa]">
                                No live business requests are published yet.
                            </div>
                        )}

                        {/* Store — Official Club Merchandise (internal store, always visible) */}
                        <div className="border-t border-[color:var(--club-theme-border-subtle)] pt-3 mt-1">
                            <Link
                                to={`/clubs/${club.id}/store`}
                                className="block rounded-[4px] border px-3.5 py-3.5 transition-colors hover:bg-[rgba(212,168,83,0.08)]"
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
                                <div className="mt-2.5 inline-flex w-full items-center justify-between rounded-[4px] border px-3 py-2 text-xs font-semibold" style={{ borderColor: 'rgba(212,168,83,0.3)', color: '#d4a853' }}>
                                    Explore store
                                    <ArrowRight className="h-3 w-3" />
                                </div>
                            </Link>
                        </div>

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

