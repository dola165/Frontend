import { ArrowRight, Briefcase, HeartHandshake, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ClubProfile } from '../../pages/ClubProfilePage';

interface ClubOpportunitiesProps {
    club: ClubProfile | null;
    onOpenModule?: () => void;
    showOpportunityBoard?: boolean;
}

export const ClubOpportunities = ({ club, onOpenModule, showOpportunityBoard = true }: ClubOpportunitiesProps) => {
    if (!club || !showOpportunityBoard) return null;
    const entries = [
        { label: 'Store', description: 'Shop products from this club', icon: ShoppingBag, tone: 'club-tone-green', href: `/clubs/${club.id}/store` },
        { label: 'Fundraising & campaigns', description: "Discover this club's projects", icon: HeartHandshake, tone: 'club-tone-amber', href: `/clubs/${club.id}/campaigns` },
        { label: 'Jobs & volunteering', description: 'See opportunities at this club', icon: Briefcase, tone: 'club-tone-violet', href: `/clubs/${club.id}?tab=business&opportunity=jobs` },
    ];
    return (
        <aside className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--app-header-height)+14px)]">
            <section className="rounded-lg overflow-hidden border border-[color:var(--club-theme-border-subtle)]">
                <h2 className="border-b border-[color:var(--club-theme-border-subtle)] px-4 py-3.5 text-xs font-semibold text-[color:var(--club-theme-text-primary)]">Support & opportunities</h2>
                <div className="space-y-3 p-3.5">
                    {entries.map(({ label, description, icon: Icon, tone, href }) => (
                        <Link key={href} to={href} className={`block rounded-lg border px-3.5 py-3.5 ${tone}`} style={{ background: 'var(--club-item-accent-soft)', borderColor: 'var(--club-item-accent-border)' }}>
                            <span className="flex items-center gap-2 text-xs font-semibold text-[color:var(--club-item-accent)]"><Icon className="h-4 w-4 shrink-0" />{label}<ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0" /></span>
                            <p className="mt-2 text-xs text-[color:var(--club-theme-text-secondary)]">{description}</p>
                        </Link>
                    ))}
                </div>
                {onOpenModule && <button type="button" onClick={onOpenModule} className="flex w-full justify-between border-t border-[color:var(--club-theme-border-subtle)] px-4 py-3 text-xs text-[color:var(--club-theme-text-secondary)]">View all club opportunities<ArrowRight className="h-3.5 w-3.5" /></button>}
            </section>
        </aside>
    );
};
