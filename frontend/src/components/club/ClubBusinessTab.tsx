import { Link } from 'react-router-dom';
import { JobsDirectoryPage } from '../../pages/JobsDirectoryPage';
import { canManageClubOperations, type ClubMembershipRole } from '../../features/clubs/domain';
import type { ClubProfile } from '../../pages/ClubProfilePage';

export const ClubBusinessTab = ({
    club,
    ownClubRole,
}: {
    club: ClubProfile;
    ownClubRole: ClubMembershipRole | null;
    isAuthenticated: boolean;
    currentUserId?: number | null;
    onDataChanged?: () => void;
}) => (
    <section>
        {canManageClubOperations(ownClubRole) && (
            <Link className="inline-flex mb-4 text-sm underline" to={`/clubs/${club.id}/workspace?tab=jobs`}>
                Manage jobs and applications
            </Link>
        )}
        <JobsDirectoryPage fixedClubId={club.id} clubName={club.name} />
    </section>
);
