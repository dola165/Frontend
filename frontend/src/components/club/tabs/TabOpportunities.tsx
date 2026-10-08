import { ExternalLink } from 'lucide-react';
import type { ClubOpportunity, ClubProfile } from '../../../pages/ClubProfilePage';

interface TabOpportunitiesProps {
    club: ClubProfile;
    isOwnClubAdmin: boolean;
}

const orderedTypes: ClubOpportunity['type'][] = ['FUNDRAISING', 'JOB', 'VOLUNTEER'];

export const TabOpportunities = ({ club, isOwnClubAdmin }: TabOpportunitiesProps) => {
    const grouped = new Map<ClubOpportunity['type'], ClubOpportunity[]>();
    (club.opportunities || []).forEach((opportunity) => {
        const existing = grouped.get(opportunity.type) || [];
        grouped.set(opportunity.type, [...existing, opportunity]);
    });

    const opportunityCount = club.opportunities?.length ?? 0;

    return (
        <section className="bg-[var(--club-card)] border border-[var(--club-theme-border-subtle)]">
            <div className="border-b border-[var(--club-theme-border-subtle)] px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-[11px] font-semibold  text-[var(--club-tone-green)]">Get involved</p>
                        <h2 className="mt-2 text-2xl font-semibold uppercase tracking-tight text-[var(--club-theme-text-primary)]">Opportunities</h2>
                        <p className="mt-2 text-sm leading-6 text-[var(--club-theme-text-secondary)]">Fundraising projects and ongoing club roles published from the club workspace.</p>
                    </div>
                    <div className="border border-[var(--club-theme-border-subtle)] bg-[var(--color-surface)] px-4 py-3">
                        <p className="text-[11px] font-semibold  text-[var(--club-theme-text-secondary)]">Live Entries</p>
                        <p className="mt-2 text-2xl font-semibold uppercase tracking-tight text-[var(--club-theme-text-primary)]">{opportunityCount}</p>
                        {isOwnClubAdmin && <p className="mt-1 text-[11px] font-semibold  text-[var(--club-tone-green)]">Manage via club admin</p>}
                    </div>
                </div>
            </div>

            {opportunityCount === 0 ? (
                <div className="px-5 py-12 text-center">
                    <h3 className="text-lg font-semibold uppercase tracking-[0.14em] text-[var(--club-theme-text-primary)]">No Active Opportunities</h3>
                    <p className="mt-2 text-sm text-[var(--club-theme-text-secondary)]">This club has not published fundraising projects or ongoing roles yet.</p>
                </div>
            ) : (
                orderedTypes.map((type) => {
                    const items = grouped.get(type) || [];
                    if (items.length === 0) return null;

                    return (
                        <section key={type} className="border-t border-[var(--club-theme-border-subtle)]">
                            <div className="border-b border-[var(--club-theme-border-subtle)] bg-[var(--color-surface)] px-4 py-3">
                                <p className="text-[11px] font-semibold  text-[var(--club-theme-text-secondary)]">{type.replace('_', ' ')}</p>
                            </div>
                            <div className="divide-y divide-[var(--color-border)]">
                                {items.map((item) => (
                                    <article key={item.id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--club-theme-text-primary)]">{item.title}</p>
                                            <p className="mt-1 text-[11px] font-semibold  text-[var(--club-tone-green)]">{type.replace('_', ' ')}</p>
                                        </div>
                                        {item.externalLink ? (
                                            <a
                                                href={item.externalLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 border border-[var(--club-theme-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-[11px] font-semibold  text-[var(--club-theme-text-primary)]"
                                            >
                                                Open Link
                                                <ExternalLink className="h-3.5 w-3.5" />
                                            </a>
                                        ) : (
                                            <span className="text-[11px] font-semibold  text-[var(--club-theme-text-secondary)]">No external link</span>
                                        )}
                                    </article>
                                ))}
                            </div>
                        </section>
                    );
                })
            )}
        </section>
    );
};
