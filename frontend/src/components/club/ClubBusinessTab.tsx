import { useClubProfileSearchParams } from '../../features/clubs/clubProfilePreviewContext';
import { ClubOpportunityOverview } from './ClubOpportunityOverview';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { JobsDirectoryPage } from '../../pages/JobsDirectoryPage';
import { canManageClubOperations, type ClubMembershipRole } from '../../features/clubs/domain';
import type { ClubProfile } from '../../pages/ClubProfilePage';
import '../../features/store/store.css';

export const ClubBusinessTab = ({ club, ownClubRole, isAuthenticated }: {
    club: ClubProfile; ownClubRole: ClubMembershipRole | null;
    isAuthenticated: boolean; currentUserId?: number | null; onDataChanged?: () => void;
}) => {
    const [params] = useClubProfileSearchParams();
    const jobsOpen = params.get('opportunity') === 'jobs';
    return <section className="club-opportunities-hub">
        {!jobsOpen && <header className="mb-6">
            <h2 className="text-2xl font-bold">Opportunities</h2>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">Shop, support a project or find a role at {club.name}.</p>
        </header>}
        {jobsOpen ? <>
            <div className="store-page jobs-page opportunity-hub-actions">
                {isAuthenticated && canManageClubOperations(ownClubRole) && <Link className="opportunity-nav-button" to={`/clubs/${club.id}/workspace?tab=jobs`}>Manage roles and applications<ArrowRight size={17}/></Link>}
            </div>
            <JobsDirectoryPage fixedClubId={club.id} clubName={club.name}/>
        </> : <ClubOpportunityOverview key={club.id} clubId={club.id} role={isAuthenticated ? ownClubRole : null}/>}
    </section>;
};
