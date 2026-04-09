import type { ReactNode } from 'react';
import { ArrowRight, BriefcaseBusiness, ExternalLink, Heart, ShieldCheck, Sparkles, Users } from 'lucide-react';
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
        type: 'JOB',
        label: 'Job Opportunities',
        toneClassName: 'club-tone-blue'
    },
    {
        type: 'VOLUNTEER',
        label: 'Volunteer Opportunities',
        toneClassName: 'club-tone-violet'
    },
    {
        type: 'WISHLIST',
        label: 'Wish List',
        toneClassName: 'club-tone-pink'
    }
];

export const ClubOpportunities = ({ club, onOpenModule, showOpportunityBoard = true }: ClubOpportunitiesProps) => {
    const opportunities = club?.opportunities || [];
    const groupedCounts = orderedTypes.map((entry) => ({
        ...entry,
        count: opportunities.filter((opportunity) => opportunity.type === entry.type).length,
        latest: opportunities.find((opportunity) => opportunity.type === entry.type)
    }));

    return (
        <aside className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--app-header-height)+64px)]">
            {showOpportunityBoard && (
                <section className="club-page-panel rounded-[4px] overflow-hidden">
                    <div className="border-b border-subtle px-4 py-3.5">
                        <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--club-tone-green)]">
                            <span>$</span>
                            Opportunities
                        </div>
                    </div>

                    <div className="space-y-3 p-3.5">
                        {groupedCounts.map((entry) => (
                            <div
                                key={entry.type}
                                className={`club-opportunity-tile ${entry.toneClassName} rounded-[4px] border px-3.5 py-3.5`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-sm font-black tracking-[0.01em] text-[color:var(--club-item-accent)]">
                                        {entry.label}
                                    </span>
                                    <span className="text-sm font-black text-[color:var(--club-item-accent)]">
                                        {entry.count}
                                    </span>
                                </div>

                                {entry.latest ? (
                                    <div className="mt-2 flex items-center justify-between gap-3">
                                        <p className="truncate text-xs text-secondary">{entry.latest.title}</p>
                                        {entry.latest.externalLink ? (
                                            <a
                                                href={entry.latest.externalLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.16em] text-primary"
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
                            <div className="rounded-[4px] border border-dashed border-subtle px-4 py-5 text-sm text-secondary">
                                No live business requests are published yet.
                            </div>
                        )}
                    </div>

                    {onOpenModule && (
                        <button
                            type="button"
                            onClick={onOpenModule}
                            className="club-open-board-button inline-flex w-full items-center justify-between border-t border-subtle px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-primary"
                        >
                            Open Business Board
                            <ArrowRight className="h-3.5 w-3.5 text-[color:var(--club-tone-green)]" />
                        </button>
                    )}
                </section>
            )}

            <section className="club-page-panel rounded-[4px] overflow-hidden">
                <div className="border-b border-subtle px-4 py-3.5">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">Club Stats</p>
                </div>

                <div className="space-y-3 p-3.5">
                    <StatRow icon={<Users className="h-4 w-4 text-[color:var(--club-tone-green)]" />} label="Members" value={club?.memberCount || 0} />
                    <StatRow icon={<Sparkles className="h-4 w-4 text-[color:var(--club-tone-blue)]" />} label="Followers" value={club?.followerCount || 0} />
                    <StatRow icon={<ShieldCheck className="h-4 w-4 text-[color:var(--club-tone-violet)]" />} label="Status" value={club?.statusLabel || (club?.isOfficial ? 'Verified' : 'Unverified')} />
                    <StatRow icon={<Heart className="h-4 w-4 text-[color:var(--club-tone-pink)]" />} label="Honours" value={club?.honours.length || 0} />
                </div>

                {!!club?.trustedByClubs?.length && (
                    <div className="border-t border-subtle px-4 py-3.5">
                        <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--club-tone-blue)]">
                            <BriefcaseBusiness className="h-3.5 w-3.5" />
                            Trusted By
                        </div>
                        <p className="mt-3 text-sm leading-6 text-secondary">
                            {club.trustedByClubs.map((trustedClub) => trustedClub.clubName).join(', ')}
                        </p>
                    </div>
                )}
            </section>
        </aside>
    );
};

const StatRow = ({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) => (
    <div className="flex items-center justify-between gap-3 rounded-[4px] border border-subtle bg-[color:var(--club-zone-highlight)] px-3.5 py-3.5">
        <div className="flex items-center gap-3">
            {icon}
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-secondary">{label}</span>
        </div>
        <span className="text-lg font-black uppercase tracking-[0.08em] text-primary">{value}</span>
    </div>
);
