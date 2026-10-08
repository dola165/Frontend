import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { OpportunityLink } from '../ui/OpportunityLink';
import type { ClubProfile } from '../../pages/ClubProfilePage';

interface ClubOpportunitiesProps {
    club: ClubProfile | null;
    onOpenModule?: () => void;
    showOpportunityBoard?: boolean;
}

export const ClubOpportunities = ({ club, onOpenModule, showOpportunityBoard = true }: ClubOpportunitiesProps) => {
    if (!club || !showOpportunityBoard) return null;
    return (
        <aside className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--app-header-height)+14px)]">
            <section className="rounded-xl overflow-hidden bg-[color:var(--club-theme-surface)] border border-[color:var(--club-theme-border-subtle)]">
                <h2 className="border-b border-[color:var(--club-theme-border-subtle)] px-4 py-3.5 text-xs font-semibold text-[color:var(--club-theme-text-primary)]">Support & opportunities</h2>
                <div className="space-y-3 p-3.5">
                    <OpportunityLink kind="store" to={`/clubs/${club.id}/store`} description="Shop products from this club" />
                    <OpportunityLink kind="campaigns" to={`/clubs/${club.id}/campaigns`} description="Discover this club's projects" />
                    <OpportunityLink kind="jobs" to={`/clubs/${club.id}?tab=business&opportunity=jobs`} description="See ongoing roles at this club" preview />
                </div>
                {onOpenModule && <Link to={`/clubs/${club.id}?tab=business`} className="flex w-full justify-between border-t border-[color:var(--club-theme-border-subtle)] px-4 py-3 text-xs text-[color:var(--club-theme-text-secondary)]">View all club opportunities<ArrowRight className="h-3.5 w-3.5" /></Link>}
            </section>
        </aside>
    );
};
