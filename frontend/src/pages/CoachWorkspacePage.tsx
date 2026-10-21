import { useAuth } from '../context/AuthContext';
import { accessibleClubs } from '../components/layout/clubAccess';
import { CoachWorkspace } from '../features/clubWorkspace/coachHub/CoachWorkspace';
import { EmptyNote, GkRoot, PageFrame } from '../design/primitives';
import { useSearchParams } from 'react-router-dom';
import { isCurrentAuthSession } from '../utils/authStorage';
import { appLanguage } from '../utils/formatting';

/** My squads: the coach's own workspace, for the club where the person has staff responsibilities. */
export default function CoachWorkspacePage() {
    const { isAuthenticated, sessionId, user } = useAuth();
    const [params] = useSearchParams();
    if (!isAuthenticated) return null;
    const hints = params.getAll('clubId'), ka = appLanguage() === 'ka';
    if (hints.length && !isCurrentAuthSession(sessionId)) return <GkRoot><PageFrame><EmptyNote title={ka ? 'თქვენი სესია შეიცვალა' : 'Your sign-in changed'}>{ka ? 'ხელახლა გახსენით ჩემი გუნდები.' : 'Reopen My squads.'}</EmptyNote></PageFrame></GkRoot>;
    const available = accessibleClubs(user?.navigationCapabilities).filter(club => club.canOpenWorkspace);
    const requested = hints.length === 1 && /^[1-9]\d*$/.test(hints[0]) && Number.isSafeInteger(Number(hints[0])) ? Number(hints[0]) : null;
    const clubId = hints.length ? available.find(club => club.id === requested)?.id : available[0]?.id;
    if (hints.length && !clubId) return <GkRoot><PageFrame><EmptyNote title={ka ? 'კლუბის გუნდები მიუწვდომელია' : 'Club squads unavailable'}>{ka ? 'ამ კლუბზე წვდომა ვერ დადასტურდა.' : 'Your current access to this club could not be confirmed.'}</EmptyNote></PageFrame></GkRoot>;
    if (!clubId) return <GkRoot><PageFrame><EmptyNote title="No squads yet">When a club makes you a coach of a squad, it appears here.</EmptyNote></PageFrame></GkRoot>;
    // A new account or club starts afresh and never inherits another's squads.
    return <CoachWorkspace key={`${sessionId}:${clubId}`} clubId={clubId} />;
}
