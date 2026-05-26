import { ExternalLink } from 'lucide-react';
import type { ClubOpportunity, ClubProfile } from '../../../pages/ClubProfilePage';

interface TabOpportunitiesProps {
    club: ClubProfile;
    isOwnClubAdmin: boolean;
}

const orderedTypes: ClubOpportunity['type'][] = ['FUNDRAISING', 'JOB', 'VOLUNTEER', 'WISHLIST'];

export const TabOpportunities = ({ club, isOwnClubAdmin }: TabOpportunitiesProps) => {
    const grouped = new Map<ClubOpportunity['type'], ClubOpportunity[]>();
    (club.opportunities || []).forEach((opportunity) => {
        const existing = grouped.get(opportunity.type) || [];
        grouped.set(opportunity.type, [...existing, opportunity]);
    });

    const opportunityCount = club.opportunities?.length ?? 0;

    return (
        <section className="bg-surface border border-subtle">
            <div className="border-b border-subtle px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] accent-primary">Entity Tab</p>
                        <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-primary">Opportunities</h2>
                        <p className="mt-2 text-sm leading-6 text-secondary">Fundraising, jobs, volunteers, and wishlist items published from the club workspace.</p>
                    </div>
                    <div className="border border-subtle bg-base px-4 py-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">Live Entries</p>
                        <p className="mt-2 text-2xl font-black uppercase tracking-tight text-primary">{opportunityCount}</p>
                        {isOwnClubAdmin && <p className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] accent-primary">Manage via club admin</p>}
                    </div>
                </div>
            </div>

            {opportunityCount === 0 ? (
                <div className="px-5 py-12 text-center">
                    <h3 className="text-lg font-black uppercase tracking-[0.14em] text-primary">No Active Opportunities</h3>
                    <p className="mt-2 text-sm text-secondary">This club has not published fundraising, jobs, volunteer roles, or wishlist items yet.</p>
                </div>
            ) : (
                orderedTypes.map((type) => {
                    const items = grouped.get(type) || [];
                    if (items.length === 0) return null;

                    return (
                        <section key={type} className="border-t border-subtle">
                            <div className="border-b border-subtle bg-base px-4 py-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">{type.replace('_', ' ')}</p>
                            </div>
                            <div className="divide-y divide-[color:var(--border-subtle)]">
                                {items.map((item) => (
                                    <article key={item.id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="min-w-0">
                                            <p className="text-sm font-black uppercase tracking-[0.12em] text-primary">{item.title}</p>
                                            <p className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] accent-primary">{type.replace('_', ' ')}</p>
                                        </div>
                                        {item.externalLink ? (
                                            <a
                                                href={item.externalLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 border border-subtle bg-base px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary"
                                            >
                                                Open Link
                                                <ExternalLink className="h-3.5 w-3.5" />
                                            </a>
                                        ) : (
                                            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-secondary">No external link</span>
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
