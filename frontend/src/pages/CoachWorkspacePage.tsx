import { useAuth } from '../context/AuthContext';
import { accessibleClubs } from '../components/layout/clubAccess';
import { CoachWorkspace } from '../features/clubWorkspace/coachHub/CoachWorkspace';
import { EmptyNote, GkRoot, PageFrame } from '../design/primitives';

/** My squads: the coach's own workspace, for the club where the person has staff responsibilities. */
export default function CoachWorkspacePage() {
    const { isAuthenticated, sessionId, user } = useAuth();
    if (!isAuthenticated) return null;
    const clubId = accessibleClubs(user?.navigationCapabilities).find(club => club.canOpenWorkspace)?.id;
    if (!clubId) return <GkRoot><PageFrame><EmptyNote title="No squads yet">When a club makes you a coach of a squad, it appears here.</EmptyNote></PageFrame></GkRoot>;
    // A new account or club starts afresh and never inherits another's squads.
    return <CoachWorkspace key={`${sessionId}:${clubId}`} clubId={clubId} />;
}
