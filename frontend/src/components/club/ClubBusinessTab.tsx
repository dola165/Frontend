import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, BriefcaseBusiness, HeartHandshake, ShoppingBag } from 'lucide-react';
import { JobsDirectoryPage } from '../../pages/JobsDirectoryPage';
import { canManageClubOperations, type ClubMembershipRole } from '../../features/clubs/domain';
import type { ClubProfile } from '../../pages/ClubProfilePage';
import '../../features/store/store.css';

export const ClubBusinessTab = ({ club, ownClubRole }: {
    club: ClubProfile; ownClubRole: ClubMembershipRole | null;
    isAuthenticated: boolean; currentUserId?: number | null; onDataChanged?: () => void;
}) => {
    const [params] = useSearchParams();
    const jobsOpen = params.get('opportunity') === 'jobs';
    return <section className="club-opportunities-hub">
        <header className="mb-6">
            <h2 className="text-2xl font-bold">Opportunities</h2>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">Shop, support a project or find a role at {club.name}.</p>
        </header>
        {jobsOpen ? <>
            <div className="store-page jobs-page opportunity-hub-actions">
                {canManageClubOperations(ownClubRole) && <Link className="opportunity-nav-button" to={`/clubs/${club.id}/workspace?tab=jobs`}>Manage jobs and applications<ArrowRight size={17}/></Link>}
            </div>
            <JobsDirectoryPage fixedClubId={club.id} clubName={club.name}/>
        </> : <div className="club-opportunity-choices">
            {[
                { label: 'Store', description: 'Discover kits, clothing and merchandise from the club.', action: 'Open club store', icon: ShoppingBag, tone: 'store', href: `/clubs/${club.id}/store` },
                { label: 'Fundraising & campaigns', description: 'Explore projects, see their progress and find out how to help.', action: 'Open club campaigns', icon: HeartHandshake, tone: 'campaigns', href: `/clubs/${club.id}/campaigns` },
                { label: 'Jobs & volunteering', description: 'Find paid roles and ways to contribute your time and skills.', action: 'View club jobs & volunteering', icon: BriefcaseBusiness, tone: 'jobs', href: `/clubs/${club.id}?tab=business&opportunity=jobs` },
            ].map(({ label, description, action, icon: Icon, tone, href }) => <Link key={tone} to={href} className={`club-opportunity-choice opportunity-tone-${tone}`}>
                <Icon size={26} aria-hidden="true"/><h3>{label}</h3><p>{description}</p><span>{action}<ArrowRight size={17} aria-hidden="true"/></span>
            </Link>)}
        </div>}
    </section>;
};
