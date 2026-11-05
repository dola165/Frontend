import { accessibleClubs } from '../../components/layout/clubAccess';
import { useAuth } from '../../context/AuthContext';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { useClubFollowing } from '../squadCommunication/useClubCrest';
import { ActionButton } from './ActionButton';
import { FollowButton } from './FollowButton';
import { useResultsWaiting } from './useResultsWaiting';
import './actions.css';

/**
 * A squad page's doors, each shown only when the person may: the score owed (its dot), a match for this squad, staff
 * for it (Assistant coach chosen), joining, and following the club.
 * Staff and joining wait for the rule-checker; nothing is assumed from the page. The club's own staff, members and
 * players are not offered Join or Follow: they are in it already.
 */
export function SquadDoors({ squadId, clubId, clubName }: { squadId: number; clubId: number; clubName: string }) {
    const copy = useJourneyCopy();
    const { user } = useAuth();
    const inClub = accessibleClubs(user?.navigationCapabilities).some(club => club.id === clubId && club.relationships.some(relation => relation !== 'Agent engagement'));
    const waiting = useResultsWaiting()?.filter(result => result.squadId === squadId);
    const owed = waiting?.[0];
    const [following, setFollowing] = useClubFollowing(clubId);
    const squad = { kind: 'squad' as const, id: squadId, clubId };
    return <div className="gk-doors" role="group" aria-label={copy('Do something for this squad', 'მოქმედებები გუნდისთვის')}>
        {owed && <ActionButton action="report_score" subject={{ kind: 'match', source: owed.kind, id: owed.id, squadId }} size="sm"
            label={owed.opponentName ? copy(`Score v ${owed.opponentName}`, `ანგარიში: ${owed.opponentName}`) : copy('Add the score', 'ანგარიშის დამატება')} className="gk-action--owed" />}
        <ActionButton action="arrange_match" subject={squad} size="sm" />
        <ActionButton action="invite_staff" subject={squad} size="sm" fallback={false} />
        {!inClub && <ActionButton action="join_squad" subject={squad} size="sm" fallback={false} label={copy('Join', 'შესვლა')} />}
        {!inClub && <FollowButton subject={{ kind: 'club', id: clubId }} following={following} name={clubName} size="sm" onChange={setFollowing} />}
    </div>;
}
